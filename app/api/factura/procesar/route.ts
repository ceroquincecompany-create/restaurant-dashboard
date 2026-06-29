import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

// ─── Parser regex para facturas españolas (Avinatur y similares) ───
function parsearFacturaRegex(text: string): Record<string, unknown> | null {
  function num(s: string | undefined): number | null {
    if (!s) return null
    // Detectar formato europeo "1.554,40" vs estándar "1554.40"
    const lastDot   = s.lastIndexOf('.')
    const lastComma = s.lastIndexOf(',')
    let clean = s.trim()
    if (lastComma > lastDot) {
      clean = clean.replace(/\./g, '').replace(',', '.')
    } else {
      clean = clean.replace(/,/g, '')
    }
    const n = parseFloat(clean)
    return isNaN(n) ? null : n
  }
  function date(s: string | undefined): string | null {
    if (!s) return null
    const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
    if (!m) return null
    return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  }

  const numeroFactura =
    text.match(/Num(?:ero)?\s*(?:de\s*)?[Ff]actura[.:\s]+([A-Z0-9\/\-]+)/)?.[1] ??
    text.match(/(?:Factura|Invoice)\s+N[oº°]?\.?\s*:?\s*([A-Z0-9\/\-]+)/i)?.[1]
  const fechaStr =
    text.match(/Fecha\s*[Ff]actura[.:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/)?.[1] ??
    text.match(/(?:Fecha|Date)[.:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i)?.[1]
  const proveedor =
    text.match(/(?:Empresa|Razón\s*[Ss]ocial|Proveedor)[.:\s]+([^\n]+)/i)?.[1]?.trim()
  const cif =
    text.match(/(?:CIF|NIF)[.:\s]+([A-Z]\d{7}[A-Z0-9])/i)?.[1]
  const baseStr =
    text.match(/B\.?\s*Imponible[.:\s]+([\d.,]+)/i)?.[1] ??
    text.match(/Base\s*[Ii]mponible[.:\s]+([\d.,]+)/i)?.[1]
  const pctStr =
    text.match(/%\s*I\.?V\.?A\.?\s+([\d.,]+)/i)?.[1] ??
    text.match(/(?:IVA|VAT)\s*%?[.:\s]+([\d.,]+)/i)?.[1]
  const cuotaStr =
    text.match(/Cuota\s*I\.?V\.?A\.?\s+([\d.,]+)/i)?.[1] ??
    text.match(/(?:Cuota|Importe)\s*IVA[.:\s]+([\d.,]+)/i)?.[1]
  const totalStr =
    text.match(/Total\s*Factura\s*€?\s*[.:\s]+([\d.,]+)/i)?.[1] ??
    text.match(/TOTAL\s*[.:\s]+([\d.,]+)/)?.[1]
  const formaPago =
    text.match(/Forma\s*(?:de\s*)?[Pp]ago[.:\s]+([^\n]+)/i)?.[1]?.trim() ??
    text.match(/(?:Vencimiento|Pago)[.:\s]+([^\n]+)/i)?.[1]?.trim()

  const total = num(totalStr)
  // Mínimo: número de factura + total
  if (!numeroFactura || !total) return null

  return {
    supplier_name:  proveedor ?? null,
    supplier_cif:   cif ?? null,
    invoice_number: numeroFactura,
    date:           date(fechaStr),
    payment_method: formaPago ?? null,
    items:          [],
    base_amount:    num(baseStr),
    vat_rate:       num(pctStr),
    vat_amount:     num(cuotaStr),
    total,
  }
}

// ─── Extracción de texto de PDF (unpdf — compatible con Vercel Serverless) ───
async function extraerTextoPDF(base64: string): Promise<string> {
  const buffer = Buffer.from(base64, 'base64')

  // Intento 1: unpdf (pdfjs-dist isomórfico, sin worker de Node)
  try {
    const { extractText } = await import('unpdf')
    const { text } = await extractText(new Uint8Array(buffer), { mergePages: true })
    if (text) return text
  } catch (e) {
    console.error('[unpdf]', e instanceof Error ? e.message : e)
  }

  // Intento 2: leer texto raw del buffer (PDFs sin comprimir tienen texto legible)
  try {
    const raw     = buffer.toString('latin1')
    const matches = raw.match(/\(([^)]{3,200})\)/g) ?? []
    const text    = matches
      .map(m => m.slice(1, -1).replace(/\\n/g, '\n').replace(/\\\\/g, '\\'))
      .join(' ')
    if (text.length > 100) return text
  } catch { /* ignorar */ }

  return ''
}

// ─── Claude Haiku prompt ───────────────────────────────────────────
const PROMPT =
  'Extract from this Spanish supplier invoice. Return ONLY valid JSON, no markdown:\n' +
  '{"supplier_name":"","supplier_cif":"","invoice_number":"","date":"YYYY-MM-DD",' +
  '"payment_method":"","items":[{"description":"","quantity":0,"unit":"","unit_price":0,"amount":0}],' +
  '"base_amount":0,"vat_rate":0,"vat_amount":0,"total":0}.\n' +
  'Use null for missing fields. Numbers without currency symbols or thousands separators.'

// ─── Handler ───────────────────────────────────────────────────────
export async function POST(request: Request) {
  let body: { base64: string; mimeType: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { base64, mimeType } = body
  if (!base64 || !mimeType) {
    return NextResponse.json({ error: 'base64 y mimeType requeridos' }, { status: 400 })
  }

  // ── Paso 1: Si es PDF → extraer texto y probar regex (gratis) ────
  if (mimeType === 'application/pdf') {
    const texto = await extraerTextoPDF(base64)
    if (texto.trim().length > 100) {
      const regexResult = parsearFacturaRegex(texto)
      if (regexResult) {
        return NextResponse.json({ ...regexResult, _metodo: 'regex' })
      }
    }
  }

  // ── Paso 2: Claude Haiku (PDF escaneado o imagen) ─────────────
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY no configurada — el PDF no tiene texto extraíble y se requiere IA' },
      { status: 503 }
    )
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  try {
    let rawText: string

    if (mimeType === 'application/pdf') {
      const response = await (client.beta as any).messages.create({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 600,
        betas:      ['pdfs-2024-09-25'],
        messages:   [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
            { type: 'text', text: PROMPT },
          ],
        }],
      })
      rawText = response.content[0]?.type === 'text' ? response.content[0].text : ''
    } else {
      const validMime = (['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const)
        .includes(mimeType as any)
        ? (mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp')
        : 'image/jpeg'

      const response = await client.messages.create({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages:   [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: validMime, data: base64 } },
            { type: 'text', text: PROMPT },
          ],
        }],
      })
      rawText = response.content[0]?.type === 'text' ? response.content[0].text : ''
    }

    const clean  = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(clean)
    return NextResponse.json({ ...parsed, _metodo: 'haiku' })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('JSON') || msg.includes('parse')) {
      return NextResponse.json({ error: 'Factura no legible' })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

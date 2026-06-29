import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

// ─── Parser regex para facturas españolas ─────────────────────────
function parsearFacturaRegex(text: string): Record<string, unknown> | null {
  const t     = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = t.split('\n').map(l => l.trim()).filter(Boolean)

  // ── helpers ────────────────────────────────────────────────────
  function num(s: string | null | undefined): number | null {
    if (!s) return null
    const c = s.trim()
    const lastDot   = c.lastIndexOf('.')
    const lastComma = c.lastIndexOf(',')
    const clean = lastComma > lastDot
      ? c.replace(/\./g, '').replace(',', '.')
      : c.replace(/,/g, '')
    const n = parseFloat(clean)
    return isNaN(n) ? null : n
  }
  function toDate(s: string | null | undefined): string | null {
    if (!s) return null
    const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
    return m ? `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}` : null
  }
  // Typical Spanish VAT rates (accepts "10", "10.00", "10,00", "21", etc.)
  function isIvaRate(s: string): boolean {
    const n = num(s)
    return n !== null && [0,4,5,10,21].includes(Math.round(n))
  }

  // ── numero_factura + fecha_factura ─────────────────────────────
  let numeroFactura: string | null = null
  let fechaStr:      string | null = null

  // Strategy A (Avinatur): header row "Num Factura  Fecha Factura  Cod Cl  Zona"
  //                         data row  "26A058655    25/06/2026     07984   108"
  const headerIdx = lines.findIndex(l => /N[uú]m\.?\s+Factura/i.test(l))
  if (headerIdx >= 0) {
    const dataRow    = lines[headerIdx + 1] ?? ''
    const dataTokens = dataRow.split(/\s+/).filter(Boolean)
    if (dataTokens.length >= 2 && /^[A-Z0-9][A-Z0-9\-\/]{3,}$/i.test(dataTokens[0])) {
      numeroFactura = dataTokens[0]
      fechaStr      = dataTokens.find(tk => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(tk)) ?? null
    }
  }

  // Strategy B: inline "Num Factura: 26A058655" or "Nº Factura 26A058655"
  if (!numeroFactura) {
    numeroFactura =
      t.match(/N[uú]m\.?\s*(?:ero)?\s*(?:de\s*)?[Ff]actura\s*[.:\s]+([A-Z0-9][A-Z0-9\-\/]{3,})/i)?.[1] ??
      t.match(/(?:Factura|Invoice)\s+N[oº°]?\.?\s*:?\s*([A-Z0-9][A-Z0-9\-\/]{3,})/i)?.[1] ??
      t.match(/F(?:ra|act)\.?\s*[Nn](?:[oº°])?\.?\s*[:\s]+([A-Z0-9][A-Z0-9\-\/]{3,})/i)?.[1] ??
      null
  }

  // fecha fallback
  if (!fechaStr) {
    fechaStr =
      // multiline: "Fecha Factura\n25/06/2026" — search near the header
      (headerIdx >= 0
        ? (lines[headerIdx + 1] ?? '').match(/(\d{1,2}\/\d{1,2}\/\d{4})/)?.[1]
        : null) ??
      t.match(/Fecha\s*[Ff]actura[\s\S]{0,80}?(\d{1,2}\/\d{1,2}\/\d{4})/)?.[1] ??
      t.match(/(?:Fecha|Date)\s*[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i)?.[1] ??
      null
  }

  // ── proveedor_nombre ───────────────────────────────────────────
  // Look for a line with a Spanish company suffix in the first 25 lines
  const companySuffix = /\b(S\.L\.U?\.?|S\.A\.U?\.?|S\.L\.|S\.A\.|S\.C\.|S\.Coop\.|SLU|SAU?)\b/i
  let proveedor: string | null = null
  for (const line of lines.slice(0, 25)) {
    if (companySuffix.test(line) && line.length >= 5 && line.length <= 100) {
      proveedor = line.trim()
      break
    }
  }
  if (!proveedor) {
    proveedor =
      t.match(/(?:Empresa|Raz[oó]n\s*[Ss]ocial|Suministrador|Proveedor)\s*[:\s]+([^\n]{3,80})/i)?.[1]?.trim() ??
      null
  }

  // ── proveedor_cif ──────────────────────────────────────────────
  // Spanish CIF/NIF: letter + 7 digits + letter-or-digit (9 chars)
  // Avinatur: B98619943 — no "CIF:" label, just standalone in the text
  const cif =
    t.match(/(?:CIF|NIF)\s*[:\s]+([A-Z]\d{7}[A-Z0-9])/i)?.[1] ??
    // Standalone — word boundaries prevent partial matches
    t.match(/(?<![A-Z0-9])([A-Z]\d{7}[A-Z0-9])(?![A-Z0-9])/)?.[1] ??
    null

  // ── base_imponible, pct_iva, cuota_iva ────────────────────────
  let baseStr:  string | null = null
  let pctStr:   string | null = null
  let cuotaStr: string | null = null

  // Strategy 1: explicit labels (facturas estándar)
  baseStr =
    t.match(/B\.?\s*Imponible\s*[:\s]+([\d.,]+)/i)?.[1] ??
    t.match(/Base\s*[Ii]mponible\s*[:\s]+([\d.,]+)/i)?.[1] ??
    null
  pctStr =
    t.match(/(?:Tipo|%)?\s*I\.?V\.?A\.?\s*%?\s*[:\s]+([\d.,]+)\s*%/i)?.[1] ??
    t.match(/%\s*I\.?V\.?A\.?\s+([\d.,]+)/i)?.[1] ??
    null
  cuotaStr =
    t.match(/Cuota\s*I\.?V\.?A\.?\s*[:\s]*([\d.,]+)/i)?.[1] ??
    t.match(/Importe\s*IVA\s*[:\s]*([\d.,]+)/i)?.[1] ??
    null

  // Strategy 2 (Avinatur): detect totals data row by IVA rate position
  // Format: "5.36  5.36  10.00  0.54"  (base, base_acum, %iva, cuota)
  //      or "5.36  10.00  0.54"         (base, %iva, cuota)
  if (!baseStr || !pctStr || !cuotaStr) {
    for (const line of lines) {
      const tks = line.split(/\s+/).filter(Boolean)

      if (tks.length === 4) {
        // col[2] = %IVA
        if (tks.every(tk => num(tk) !== null) && isIvaRate(tks[2])) {
          if (!baseStr)  baseStr  = tks[0]
          if (!pctStr)   pctStr   = tks[2]
          if (!cuotaStr) cuotaStr = tks[3]
          break
        }
      }
      if (tks.length === 3) {
        // col[1] = %IVA
        if (tks.every(tk => num(tk) !== null) && isIvaRate(tks[1])) {
          if (!baseStr)  baseStr  = tks[0]
          if (!pctStr)   pctStr   = tks[1]
          if (!cuotaStr) cuotaStr = tks[2]
          break
        }
      }
    }
  }

  // ── total ──────────────────────────────────────────────────────
  // Avinatur: "Total Factura €" on one line, amount on the next
  let totalStr: string | null = null

  // Multiline: "Total Factura €\n5.90"
  const totalMulti = t.match(/(?:Total|Importe)\s+Factura\s*€?\s*\n\s*([\d.,]+)/i)?.[1]
  // Inline: "Total Factura € 5.90"
  const totalInline =
    t.match(/(?:Total|Importe)\s+Factura\s*€?\s*[:\s]+([\d.,]+)/i)?.[1] ??
    t.match(/\bTOTAL\s*€?\s*[:\s]+([\d.,]+)/i)?.[1] ??
    null

  totalStr = totalMulti ?? totalInline

  // Last resort: base + cuota
  const totalNum = num(totalStr)
  const finalTotal = totalNum ??
    (baseStr && cuotaStr
      ? Math.round(((num(baseStr) ?? 0) + (num(cuotaStr) ?? 0)) * 100) / 100
      : null)

  // ── forma de pago ──────────────────────────────────────────────
  const formaPago =
    t.match(/Forma\s*(?:de\s*)?[Pp]ago\s*[:\s]+([^\n]{2,60})/i)?.[1]?.trim() ??
    t.match(/Vencimiento\s*[:\s]+([^\n]{2,60})/i)?.[1]?.trim() ??
    null

  // Minimum required: invoice number + some total amount
  if (!numeroFactura || !finalTotal) return null

  return {
    supplier_name:  proveedor  ?? null,
    supplier_cif:   cif        ?? null,
    invoice_number: numeroFactura,
    date:           toDate(fechaStr),
    payment_method: formaPago  ?? null,
    items:          [],
    base_amount:    num(baseStr),
    vat_rate:       num(pctStr),
    vat_amount:     num(cuotaStr),
    total:          finalTotal,
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

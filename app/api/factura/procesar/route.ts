import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

// ─── Parser regex para facturas españolas ─────────────────────────
// Funciona con texto en una sola línea (output de unpdf) o multilínea
function parsearFacturaRegex(text: string): Record<string, unknown> | null {
  // flat: todo en una línea, espacios normalizados — para patrones lineales
  const flat = text.replace(/\r?\n|\r/g, ' ').replace(/\s{2,}/g, ' ').trim()

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
  function isIvaRate(s: string): boolean {
    const n = num(s)
    return n !== null && [0, 4, 5, 10, 21].includes(Math.round(n))
  }

  // ── numero_factura ────────────────────────────────────────────
  // Avinatur flat: "...Cod Cl Zona 26A058655 25/06/2026 07984 108..."
  // El número viene justo después de "Zona" (última columna de cabecera)
  const numeroFactura: string | null =
    flat.match(/\bZona\s+([A-Z0-9][A-Z0-9\-\/]{3,})(?=\s)/i)?.[1] ??
    // Footer Avinatur: "Factura 26A058655 Fecha Factura 25/06/2026"
    flat.match(/\bFactura\s+([A-Z0-9][A-Z0-9\-\/]{3,})\s+Fecha/i)?.[1] ??
    // Estándar: etiqueta + valor
    flat.match(/N[uú]m\.?\s*(?:ero)?\s*(?:de\s*)?[Ff]actura\s*[.:\s]+([A-Z0-9][A-Z0-9\-\/]{3,})/i)?.[1] ??
    flat.match(/(?:Factura|Invoice)\s+N[oº°]?\.?\s*:?\s*([A-Z0-9][A-Z0-9\-\/]{3,})/i)?.[1] ??
    null

  // ── fecha_factura ─────────────────────────────────────────────
  // Preferir la fecha junto a "Fecha Factura"
  const fechaStr: string | null =
    flat.match(/Fecha\s+Factura\s+(\d{1,2}\/\d{1,2}\/\d{4})/i)?.[1] ??
    flat.match(/(?:Fecha|Date)\s*[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i)?.[1] ??
    flat.match(/(\d{1,2}\/\d{1,2}\/\d{4})/)?.[1] ??
    null

  // ── proveedor_nombre ──────────────────────────────────────────
  // Avinatur: "Avinatur Producc. Avícolas, S.L.U Ctra. El Viso-..."
  // El nombre acaba justo antes del primer indicador de dirección
  const ADDRESS_START = /\s(?:Ctra\.|C\/|Avda?\.|Pg\.|Pol\.|P\.I\.|Camino\s|Paseo\s|Plaza\s|Km\s)/i
  let proveedor: string | null = null

  const addrM = flat.match(ADDRESS_START)
  if (addrM?.index !== undefined) {
    const before = flat.slice(0, addrM.index).trim()
    // Válido si contiene sufijo de empresa española y no es demasiado largo
    if (/\b(?:S\.L\.U?\.?|S\.A\.U?\.?|S\.C\.|S\.Coop\.|SLU|SAU?)\b/i.test(before) && before.length <= 100) {
      proveedor = before
    }
  }
  // Fallback: primer fragmento con sufijo empresarial en el texto
  if (!proveedor) {
    proveedor =
      flat.match(/([A-ZÀ-Ú][A-Za-zÀ-ú\s,.\-]+?(?:S\.L\.U?\.?|S\.A\.U?\.?|S\.C\.|SLU|SAU?))/)?.[1]?.trim() ??
      flat.match(/(?:Empresa|Raz[oó]n\s*[Ss]ocial|Proveedor)\s*[:\s]+([^,\n]{3,80})/i)?.[1]?.trim() ??
      null
  }

  // ── proveedor_cif ─────────────────────────────────────────────
  // CIF español: [A-Z]\d{7}[A-Z0-9] — 9 caracteres
  // Avinatur: B98619943 aparece sin etiqueta "CIF:"
  const cif =
    flat.match(/(?:CIF|NIF)\s*[:\s]+([A-Z]\d{7}[A-Z0-9])/i)?.[1] ??
    flat.match(/(?<![A-Z0-9])([A-Z]\d{7}[A-Z0-9])(?![A-Z0-9])/)?.[1] ??
    null

  // ── base_imponible, pct_iva, cuota_iva ───────────────────────
  let baseStr:  string | null = null
  let pctStr:   string | null = null
  let cuotaStr: string | null = null

  // Estrategia 1: cabecera Avinatur "B. Imponible %Iva Iva"
  // Datos inmediatamente a continuación: base  base_acum  %iva  cuota
  // Ej: "5.36 5.36 10.00 0.54"
  const aviM = flat.match(
    /B\.?\s*Imponible\s+%Iva\s+Iva[^0-9]*([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)/i
  )
  if (aviM) {
    baseStr  = aviM[1]  // base imponible
    // aviM[2] = base acumulada (igual cuando hay un tipo de IVA)
    pctStr   = aviM[3]  // % IVA (10.00)
    cuotaStr = aviM[4]  // cuota IVA (0.54)
  }

  // Estrategia 2: etiquetas explícitas (facturas estándar)
  if (!baseStr)  baseStr  =
    flat.match(/B\.?\s*Imponible\s*[:\s]+([\d.,]+)/i)?.[1] ??
    flat.match(/Base\s*[Ii]mponible\s*[:\s]+([\d.,]+)/i)?.[1] ?? null
  if (!pctStr)   pctStr   =
    flat.match(/%\s*I\.?V\.?A\.?\s+([\d.,]+)/i)?.[1] ??
    flat.match(/Tipo\s+IVA\s*[:\s]+([\d.,]+)/i)?.[1] ?? null
  if (!cuotaStr) cuotaStr =
    flat.match(/Cuota\s*I\.?V\.?A\.?\s*[:\s]*([\d.,]+)/i)?.[1] ??
    flat.match(/Importe\s+IVA\s*[:\s]*([\d.,]+)/i)?.[1] ?? null

  // Estrategia 3: secuencia numérica con tipo IVA reconocible
  // Busca "X X 10.00 Y" (Avinatur 4-col) o "X 10.00 Y" (3-col)
  if (!pctStr || !cuotaStr) {
    const seq4 = flat.match(/([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)/)
    if (seq4 && isIvaRate(seq4[3])) {
      if (!baseStr)  baseStr  = seq4[1]
      if (!pctStr)   pctStr   = seq4[3]
      if (!cuotaStr) cuotaStr = seq4[4]
    } else {
      const seq3 = flat.match(/([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)/)
      if (seq3 && isIvaRate(seq3[2])) {
        if (!baseStr)  baseStr  = seq3[1]
        if (!pctStr)   pctStr   = seq3[2]
        if (!cuotaStr) cuotaStr = seq3[3]
      }
    }
  }

  // ── total ─────────────────────────────────────────────────────
  // Avinatur footer: "Importe Factura 5.90"
  // También: "Total Factura € 5.90"
  const totalStr =
    flat.match(/Importe\s+Factura\s+([\d.,]+)/i)?.[1] ??
    flat.match(/Total\s+Factura\s*€?\s*([\d.,]+)/i)?.[1] ??
    flat.match(/\bTOTAL\s*€?\s*[:\s]+([\d.,]+)/i)?.[1] ??
    null

  const finalTotal = num(totalStr) ??
    (baseStr && cuotaStr
      ? Math.round(((num(baseStr) ?? 0) + (num(cuotaStr) ?? 0)) * 100) / 100
      : null)

  // ── forma de pago ─────────────────────────────────────────────
  const formaPago =
    flat.match(/Forma\s*(?:de\s*)?[Pp]ago\s*[:\s]+([^.]{2,60})/i)?.[1]?.trim() ??
    flat.match(/Vencimiento\s*[:\s]+([^.]{2,60})/i)?.[1]?.trim() ??
    null

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

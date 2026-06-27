import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET ?? ''

// ─── Svix webhook signature verification ─────────────────────
function verificarFirma(rawBody: string, headers: Headers): boolean {
  if (!WEBHOOK_SECRET) return true // sin secret configurado: pass through
  const msgId = headers.get('svix-id') ?? ''
  const msgTs = headers.get('svix-timestamp') ?? ''
  const msgSig = headers.get('svix-signature') ?? ''
  if (!msgId || !msgTs || !msgSig) return false

  const ts = parseInt(msgTs, 10)
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - ts) > 300) return false // timestamp > 5 min

  const toVerify = `${msgId}.${msgTs}.${rawBody}`
  const secretBytes = Buffer.from(WEBHOOK_SECRET.replace(/^whsec_/, ''), 'base64')
  const computed = crypto.createHmac('sha256', secretBytes).update(toVerify).digest('base64')

  return msgSig
    .split(' ')
    .map(s => s.split(',')[1])
    .filter(Boolean)
    .some(s => s === computed)
}

// ─── Qamarero email parser ────────────────────────────────────
interface CierreParsed {
  fecha_inicio:         string | null
  fecha_fin:            string | null
  abierto_por:          string | null
  cerrado_por:          string | null
  numero_sesion:        string | null
  ventas_efectivo:      number | null
  ventas_tarjeta:       number | null
  ventas_uber:          number | null
  ventas_total:         number | null
  operaciones_efectivo: number | null
  operaciones_tarjeta:  number | null
  operaciones_uber:     number | null
  ventas_pickup:        number | null
  ventas_delivery:      number | null
  ventas_self_service:  number | null
  ventas_por_categoria: Record<string, number>
  desajuste_caja:       number | null
}

function parsearCierreCaja(raw: string): CierreParsed {
  const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = text.split('\n').map(l => l.trim())

  function findLine(labelPatterns: RegExp[]): string | null {
    for (const line of lines) {
      for (const pat of labelPatterns) {
        const m = line.match(pat)
        if (m?.[1] !== undefined) return m[1].trim()
      }
    }
    return null
  }

  function toNum(s: string | null): number | null {
    if (!s) return null
    const n = parseFloat(s.replace(/[€\s]/g, '').replace(',', '.'))
    return isNaN(n) ? null : n
  }

  function toInt(s: string | null): number | null {
    if (!s) return null
    const n = parseInt(s.replace(/\D/g, ''), 10)
    return isNaN(n) ? null : n
  }

  // Parse DD/MM/YYYY HH:MM → ISO local datetime
  function parseDate(s: string | null): string | null {
    if (!s) return null
    const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}:\d{2})/)
    if (!m) return null
    const [, d, mo, y, t] = m
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}T${t}:00`
  }

  // ─ Scalar fields ─────────────────────────────────────────────
  const TAB = /[\t\s]{2,}/ // tab or 2+ spaces

  const fechaInicioRaw = findLine([
    /^(?:Inicio\s+sesi[oó]n|Inicio\s+de\s+sesi[oó]n|Apertura|Fecha\s+inicio|Fecha\s+apertura)\t(.+)/i,
    /^(?:Inicio\s+sesi[oó]n|Apertura)\s{2,}(.+)/i,
  ])
  const fechaFinRaw = findLine([
    /^(?:Fin\s+sesi[oó]n|Fin\s+de\s+sesi[oó]n|Cierre|Fecha\s+fin|Fecha\s+cierre)\t(.+)/i,
    /^(?:Fin\s+sesi[oó]n|Cierre)\s{2,}(.+)/i,
  ])

  const numeroSesion = findLine([
    /^N[uú]mero\s+de\s+sesi[oó]n\t(.+)/i,
    /^Sesi[oó]n\t(.+)/i,
    /^N[uú]m\.?\s+sesi[oó]n\t(.+)/i,
  ])

  const abiertoStr = findLine([
    /^Abierto\s+por\t(.+)/i,
    /^Apertura\s+por\t(.+)/i,
    /^Abierto\s+por\s{2,}(.+)/i,
  ])

  const cerradoStr = findLine([
    /^Cerrado\s+por\t(.+)/i,
    /^Cierre\s+por\t(.+)/i,
    /^Cerrado\s+por\s{2,}(.+)/i,
  ])

  // ─ Ventas ─────────────────────────────────────────────────────
  const efectivoStr = findLine([
    /^Ventas\s+en\s+efectivo\t([\d\s,\.\-]+\s*€?)/i,
    /^Efectivo\t([\d\s,\.\-]+\s*€?)/i,
  ])
  const tarjetaStr = findLine([
    /^Ventas\s+con\s+tarjeta\t([\d\s,\.\-]+\s*€?)/i,
    /^Tarjeta\t([\d\s,\.\-]+\s*€?)/i,
  ])
  const uberStr = findLine([
    /^Uber\.external\t([\d\s,\.\-]+\s*€?)/i,
    /^Uber\s+Eats\t([\d\s,\.\-]+\s*€?)/i,
    /^Uber\t([\d\s,\.\-]+\s*€?)/i,
  ])
  const totalStr = findLine([
    /^Ventas\s+totales\t([\d\s,\.\-]+\s*€?)/i,
    /^Total\s+ventas\t([\d\s,\.\-]+\s*€?)/i,
    /^Total\t([\d\s,\.\-]+\s*€?)/i,
  ])

  // ─ Operaciones ───────────────────────────────────────────────
  const opsEfectivoStr = findLine([
    /^N[uú]mero\s+de\s+operaciones\s*\(efectivo\)\t(\d+)/i,
    /^Op(?:eraciones?)?\s+efectivo\t(\d+)/i,
  ])
  const opsTarjetaStr = findLine([
    /^N[uú]mero\s+de\s+operaciones\s*\(tarjeta\)\t(\d+)/i,
    /^Op(?:eraciones?)?\s+tarjeta\t(\d+)/i,
  ])
  const opsUberStr = findLine([
    /^N[uú]mero\s+de\s+operaciones\s*\(Uber\.external\)\t(\d+)/i,
    /^N[uú]mero\s+de\s+operaciones\s*\(Uber\)\t(\d+)/i,
    /^Op(?:eraciones?)?\s+Uber\t(\d+)/i,
  ])

  // ─ Canales ───────────────────────────────────────────────────
  const pickupStr = findLine([
    /^Pickup\t([\d\s,\.\-]+\s*€?)/i,
    /^Pick\s+up\t([\d\s,\.\-]+\s*€?)/i,
    /^Recogida\t([\d\s,\.\-]+\s*€?)/i,
  ])
  const deliveryStr = findLine([
    /^Delivery\t([\d\s,\.\-]+\s*€?)/i,
    /^Entrega\s+a\s+domicilio\t([\d\s,\.\-]+\s*€?)/i,
    /^Domicilio\t([\d\s,\.\-]+\s*€?)/i,
  ])
  const selfServiceStr = findLine([
    /^Self\s+service\t([\d\s,\.\-]+\s*€?)/i,
    /^Self-service\t([\d\s,\.\-]+\s*€?)/i,
    /^Autoservicio\t([\d\s,\.\-]+\s*€?)/i,
  ])

  // ─ Desajuste ─────────────────────────────────────────────────
  const desajusteStr = findLine([
    /^Desajuste\s+de\s+caja\t([\d\s,\.\-]+\s*€?)/i,
    /^Desajuste\t([\d\s,\.\-]+\s*€?)/i,
    /^Diferencia\s+de\s+caja\t([\d\s,\.\-]+\s*€?)/i,
  ])

  // ─ Categorías (sección entre VENTAS POR CATEGORÍA y VENTAS POR ZONAS) ─
  const categorias: Record<string, number> = {}
  const catStart = text.search(/VENTAS\s+POR\s+CATEGOR[ÍI]A/i)
  const catEnd   = text.search(/VENTAS\s+POR\s+ZONAS/i)
  if (catStart >= 0) {
    const sectionRaw = text.slice(
      catStart,
      catEnd > catStart ? catEnd : undefined
    )
    for (const line of sectionRaw.split('\n').slice(1)) {
      const trimmed = line.trim()
      if (!trimmed || /VENTAS\s+POR/i.test(trimmed)) break
      const parts = trimmed.split('\t')
      if (parts.length >= 2) {
        const nombre  = parts[0].trim()
        const importe = toNum(parts[parts.length - 1].replace(/€/g, '').trim())
        if (nombre && importe !== null) categorias[nombre] = importe
      }
    }
  }

  return {
    fecha_inicio:         parseDate(fechaInicioRaw),
    fecha_fin:            parseDate(fechaFinRaw),
    abierto_por:          abiertoStr,
    cerrado_por:          cerradoStr,
    numero_sesion:        numeroSesion,
    ventas_efectivo:      toNum(efectivoStr),
    ventas_tarjeta:       toNum(tarjetaStr),
    ventas_uber:          toNum(uberStr),
    ventas_total:         toNum(totalStr),
    operaciones_efectivo: toInt(opsEfectivoStr),
    operaciones_tarjeta:  toInt(opsTarjetaStr),
    operaciones_uber:     toInt(opsUberStr),
    ventas_pickup:        toNum(pickupStr),
    ventas_delivery:      toNum(deliveryStr),
    ventas_self_service:  toNum(selfServiceStr),
    ventas_por_categoria: categorias,
    desajuste_caja:       toNum(desajusteStr),
  }
}

// ─── POST handler ─────────────────────────────────────────────
export async function POST(request: Request) {
  const rawBody = await request.text()

  if (!verificarFirma(rawBody, request.headers)) {
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
  }

  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  // Extraer texto del email desde la estructura de Resend
  const emailData = payload?.data ?? payload
  const textBody: string =
    emailData?.text ??
    emailData?.plain_text ??
    (emailData?.html ?? '').replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, '\n') ??
    ''

  if (!textBody.trim()) {
    return NextResponse.json({ error: 'Email sin contenido de texto' }, { status: 400 })
  }

  const parsed = parsearCierreCaja(textBody)

  const db = createClient(SUPABASE_URL, SERVICE_KEY ?? ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error } = await db.from('cierres_caja').upsert(
    {
      ...parsed,
      raw_email: rawBody.length > 50000 ? rawBody.slice(0, 50000) : rawBody,
    },
    { onConflict: 'numero_sesion', ignoreDuplicates: true }
  )

  if (error) {
    console.error('[cierre-caja]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, sesion: parsed.numero_sesion })
}

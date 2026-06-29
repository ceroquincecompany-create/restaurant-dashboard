// Parser compartido entre /api/cierre-caja (webhook) y /api/procesar-emails-recibidos (polling)

export interface CierreParsed {
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

export function parsearCierreCaja(raw: string): CierreParsed {
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
    let clean = s.replace(/[€\s]/g, '').trim()
    if (!clean || clean === '-') return null
    // Detectar formato europeo "1.554,40" (coma decimal): la coma aparece después del último punto
    const lastDot   = clean.lastIndexOf('.')
    const lastComma = clean.lastIndexOf(',')
    if (lastComma > lastDot) {
      clean = clean.replace(/\./g, '').replace(',', '.')
    } else {
      clean = clean.replace(/,/g, '')
    }
    const n = parseFloat(clean)
    return isNaN(n) ? null : n
  }

  function toInt(s: string | null): number | null {
    if (!s) return null
    const n = parseInt(s.replace(/\D/g, ''), 10)
    return isNaN(n) ? null : n
  }

  function parseDate(s: string | null): string | null {
    if (!s) return null
    const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}:\d{2})/)
    if (!m) return null
    const [, d, mo, y, t] = m
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}T${t}:00`
  }

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

  const efectivoStr = findLine([
    /^Ventas\s+en\s+efectivo\t([\d\s,.\-]+\s*€?)/i,
    /^Efectivo\t([\d\s,.\-]+\s*€?)/i,
  ])
  const tarjetaStr = findLine([
    /^Ventas\s+con\s+tarjeta\t([\d\s,.\-]+\s*€?)/i,
    /^Tarjeta\t([\d\s,.\-]+\s*€?)/i,
  ])
  const uberStr = findLine([
    /^Uber\.external\t([\d\s,.\-]+\s*€?)/i,
    /^Uber\s+Eats\t([\d\s,.\-]+\s*€?)/i,
    /^Uber\t([\d\s,.\-]+\s*€?)/i,
  ])
  const totalStr = findLine([
    /^Ventas\s+totales\t([\d\s,.\-]+\s*€?)/i,
    /^Total\s+ventas\t([\d\s,.\-]+\s*€?)/i,
    /^Total\t([\d\s,.\-]+\s*€?)/i,
  ])

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

  const pickupStr = findLine([
    /^Pickup\t([\d\s,.\-]+\s*€?)/i,
    /^Pick\s+up\t([\d\s,.\-]+\s*€?)/i,
    /^Recogida\t([\d\s,.\-]+\s*€?)/i,
  ])
  const deliveryStr = findLine([
    /^Delivery\t([\d\s,.\-]+\s*€?)/i,
    /^Entrega\s+a\s+domicilio\t([\d\s,.\-]+\s*€?)/i,
    /^Domicilio\t([\d\s,.\-]+\s*€?)/i,
  ])
  const selfServiceStr = findLine([
    /^Self\s+service\t([\d\s,.\-]+\s*€?)/i,
    /^Self-service\t([\d\s,.\-]+\s*€?)/i,
    /^Autoservicio\t([\d\s,.\-]+\s*€?)/i,
  ])

  const desajusteStr = findLine([
    /^Desajuste\s+de\s+caja\t([\d\s,.\-]+\s*€?)/i,
    /^Desajuste\t([\d\s,.\-]+\s*€?)/i,
    /^Diferencia\s+de\s+caja\t([\d\s,.\-]+\s*€?)/i,
  ])

  // Categorías entre VENTAS POR CATEGORÍA y VENTAS POR ZONAS
  const categorias: Record<string, number> = {}
  const catStart = text.search(/VENTAS\s+POR\s+CATEGOR[ÍI]A/i)
  const catEnd   = text.search(/VENTAS\s+POR\s+ZONAS/i)
  if (catStart >= 0) {
    const sectionEnd = catEnd > catStart ? catEnd : text.length
    const sectionRaw = text.slice(catStart, sectionEnd)
    for (const line of sectionRaw.split('\n').slice(1)) {
      const trimmed = line.trim()
      if (!trimmed) continue
      if (/VENTAS\s+POR/i.test(trimmed)) break
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

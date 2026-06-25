import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function calcHorasFichaje(entrada: string, salida: string): { total: number; nocturnas: number } {
  if (!entrada || !salida) return { total: 0, nocturnas: 0 }
  const [h1, m1] = entrada.split(':').map(Number)
  const [h2, m2] = salida.split(':').map(Number)
  const inicioMin = h1 * 60 + m1
  let finMin = h2 * 60 + m2
  if (finMin <= inicioMin) finMin += 24 * 60

  const total = (finMin - inicioMin) / 60
  let nocMin = Math.max(0, Math.min(finMin, 1800) - Math.max(inicioMin, 1320))
  if (inicioMin < 360 && finMin <= 1440) {
    nocMin += Math.min(finMin, 360) - inicioMin
  }
  return {
    total:     Math.round(total * 100) / 100,
    nocturnas: Math.round(Math.max(0, nocMin) / 60 * 100) / 100,
  }
}

export async function GET() {
  const db = createClient(SUPABASE_URL, SERVICE_KEY ?? ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const ahora = new Date()
  const today = ahora.toISOString().split('T')[0]
  const ahoraMin = ahora.getHours() * 60 + ahora.getMinutes()

  // Fichajes abiertos de hoy (sin hora_salida)
  const { data: fichajes, error: fErr } = await db
    .from('fichajes')
    .select('*')
    .eq('fecha', today)
    .is('hora_salida', null)
    .not('hora_entrada', 'is', null)

  if (fErr) return NextResponse.json({ error: fErr.message }, { status: 500 })
  if (!fichajes || fichajes.length === 0) return NextResponse.json({ ok: true, cerrados: 0 })

  const empIds = [...new Set(fichajes.map((f: any) => f.empleado_id as number))]

  const { data: turnos } = await db
    .from('turnos')
    .select('*')
    .eq('fecha', today)
    .in('empleado_id', empIds)

  const turnosPorEmp = new Map<number, any[]>()
  ;(turnos ?? []).forEach((t: any) => {
    const arr = turnosPorEmp.get(t.empleado_id) ?? []
    arr.push(t)
    turnosPorEmp.set(t.empleado_id, arr)
  })

  let cerrados = 0

  for (const fichaje of fichajes) {
    const turnosEmp = turnosPorEmp.get(fichaje.empleado_id) ?? []
    // Turno con hora_fin más tardía del día
    const turnoConFin = turnosEmp
      .filter((t: any) => t.hora_fin)
      .sort((a: any, b: any) => b.hora_fin.localeCompare(a.hora_fin))[0]

    if (!turnoConFin) continue

    const [fh, fm] = turnoConFin.hora_fin.split(':').map(Number)
    const finMasQuince = fh * 60 + fm + 15

    if (ahoraMin >= finMasQuince) {
      const horaSalida = `${String(fh).padStart(2, '0')}:${String(fm).padStart(2, '0')}:00`
      const { total, nocturnas } = calcHorasFichaje(fichaje.hora_entrada, horaSalida)

      await db.from('fichajes').update({
        hora_salida: horaSalida,
        horas_total: total,
        horas_nocturnas: nocturnas,
      }).eq('id', fichaje.id)

      cerrados++
    }
  }

  return NextResponse.json({ ok: true, cerrados })
}

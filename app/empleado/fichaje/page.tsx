'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Fichaje } from '@/lib/supabase'
import { useEmpleadoActual } from '@/lib/useEmpleado'
import { MapPin, RefreshCw, Navigation, LogIn, LogOut, AlertCircle, Clock } from 'lucide-react'

// Coordenadas SOFI Pinomonotano — Calle Estibadores 24-25, 41015 Sevilla
const LOCAL_LAT = 37.42296249221703
const LOCAL_LNG = -5.965540822072279
const RADIO_M = 200

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const φ1 = (lat1 * Math.PI) / 180, φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180, Δλ = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function horaActual(): string {
  const n = new Date()
  return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`
}

function calcHoras(entrada: string, salida: string): { total: number; nocturnas: number } {
  const [h1, m1] = entrada.split(':').map(Number)
  const [h2, m2] = salida.split(':').map(Number)
  const inicioMin = h1 * 60 + m1
  let finMin = h2 * 60 + m2
  if (finMin <= inicioMin) finMin += 24 * 60
  const total = (finMin - inicioMin) / 60
  const NOCHE_INI = 22 * 60, NOCHE_FIN = 30 * 60
  const nocturnas = Math.max(0, Math.min(finMin, NOCHE_FIN) - Math.max(inicioMin, NOCHE_INI)) / 60
  return { total: Math.round(total * 100) / 100, nocturnas: Math.round(nocturnas * 100) / 100 }
}

function duracion(entrada: string | null, salida: string | null): string {
  if (!entrada || !salida) return '—'
  const { total } = calcHoras(entrada, salida)
  const h = Math.floor(total)
  const m = Math.round((total - h) * 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

type GeoStatus = 'checking' | 'ok' | 'far' | 'denied' | 'error'

export default function PaginaFichaje() {
  const { empleado, loading: empLoading } = useEmpleadoActual()

  const [fichajesHoy, setFichajesHoy] = useState<Fichaje[]>([])
  const [fichajesMes, setFichajesMes] = useState<Fichaje[]>([])
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('checking')
  const [distancia, setDistancia] = useState<number | null>(null)
  const [fichando, setFichando] = useState(false)
  const [loading, setLoading] = useState(true)

  const today = new Date().toISOString().split('T')[0]
  const primerDiaMes = `${today.slice(0, 7)}-01`

  const cargar = useCallback(async () => {
    if (!empleado) return
    const [{ data: hoy }, { data: mes }] = await Promise.all([
      supabase
        .from('fichajes')
        .select('*')
        .eq('empleado_id', empleado.id)
        .eq('fecha', today)
        .order('hora_entrada', { ascending: true }),
      supabase
        .from('fichajes')
        .select('*')
        .eq('empleado_id', empleado.id)
        .gte('fecha', primerDiaMes)
        .lte('fecha', today)
        .order('fecha', { ascending: false })
        .order('hora_entrada', { ascending: false }),
    ])
    setFichajesHoy(hoy ?? [])
    setFichajesMes(mes ?? [])
    setLoading(false)
  }, [empleado, today, primerDiaMes])

  useEffect(() => {
    if (empLoading) return
    if (empleado) cargar()
    else setLoading(false)
  }, [empLoading, empleado, cargar])

  function obtenerUbicacion() {
    setGeoStatus('checking')
    if (!navigator.geolocation) { setGeoStatus('error'); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const d = Math.round(haversine(pos.coords.latitude, pos.coords.longitude, LOCAL_LAT, LOCAL_LNG))
        setDistancia(d)
        setGeoStatus(d <= RADIO_M ? 'ok' : 'far')
      },
      (err) => setGeoStatus(err.code === 1 ? 'denied' : 'error'),
      { timeout: 15000, maximumAge: 0 }
    )
  }

  useEffect(() => { obtenerUbicacion() }, [])

  useEffect(() => {
    if (empleado?.sin_restriccion_geo) { setGeoStatus('ok'); setDistancia(null) }
  }, [empleado?.sin_restriccion_geo])

  async function fichar() {
    if (!empleado || geoStatus !== 'ok') return
    setFichando(true)
    const hora = horaActual()

    // Estado por ÚLTIMO fichaje del día
    const ultimo = fichajesHoy[fichajesHoy.length - 1] ?? null
    const turnoAbierto = ultimo !== null && ultimo.hora_salida === null

    if (turnoAbierto && ultimo) {
      const { total, nocturnas } = ultimo.hora_entrada
        ? calcHoras(ultimo.hora_entrada, hora)
        : { total: 0, nocturnas: 0 }
      await supabase
        .from('fichajes')
        .update({ hora_salida: hora, horas_total: total, horas_nocturnas: nocturnas })
        .eq('id', ultimo.id)
    } else {
      await supabase.from('fichajes').insert({
        empleado_id: empleado.id,
        fecha: today,
        hora_entrada: hora,
      })
    }

    setFichando(false)
    cargar()
  }

  if (empLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="animate-spin text-[#F5B731]" size={24} />
      </div>
    )
  }

  const ultimoFichaje = fichajesHoy[fichajesHoy.length - 1] ?? null
  const turnoAbierto = ultimoFichaje !== null && ultimoFichaje.hora_salida === null
  const puedefichar = geoStatus === 'ok'

  const totalHoy = fichajesHoy.reduce((s, f) => s + (f.horas_total ?? 0), 0)
  const totalMes = fichajesMes.reduce((s, f) => s + (f.horas_total ?? 0), 0)
  const horasContrato = Number(empleado?.horas_contrato ?? 40) * 4.33

  // Agrupar historial mes por día
  const porDia = fichajesMes.reduce<Record<string, Fichaje[]>>((acc, f) => {
    acc[f.fecha] = acc[f.fecha] ? [...acc[f.fecha], f] : [f]
    return acc
  }, {})
  const diasOrdenados = Object.keys(porDia).sort((a, b) => b.localeCompare(a))

  return (
    <div className="px-4 py-5 max-w-lg mx-auto">

      {/* ── Geolocalización ──────────────────────────────── */}
      {empleado?.sin_restriccion_geo ? (
        <div className="rounded-xl px-4 py-3 mb-5 bg-amber-50 border border-amber-200 flex items-center gap-3">
          <MapPin size={20} className="text-amber-600 flex-shrink-0" />
          <div>
            <p className="text-base font-semibold text-amber-700">
              Fichaje habilitado
              <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-800">Modo prueba</span>
            </p>
            <p className="text-sm text-amber-600">Sin restricción de ubicación</p>
          </div>
        </div>
      ) : (
        <div className={`rounded-xl px-4 py-3 mb-5 ${
          geoStatus === 'ok'  ? 'bg-emerald-50 border border-emerald-200' :
          geoStatus === 'far' ? 'bg-rose-50 border border-rose-200' :
                                'bg-amber-50 border border-amber-200'
        }`}>
          {(geoStatus === 'denied' || geoStatus === 'error') ? (
            <div className="flex items-start gap-3">
              <MapPin size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                {geoStatus === 'denied' ? (
                  <>
                    <p className="text-base font-semibold text-amber-700">Ubicación denegada</p>
                    <p className="text-sm text-amber-600 mt-1">
                      En Chrome Android: candado en la barra → Permisos del sitio → Ubicación → Permitir
                    </p>
                  </>
                ) : (
                  <p className="text-base font-semibold text-amber-700">No se pudo obtener la ubicación</p>
                )}
                <button
                  onClick={obtenerUbicacion}
                  className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 text-sm font-semibold"
                >
                  <Navigation size={14} /> Reintentar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <MapPin size={20} className={
                  geoStatus === 'ok' ? 'text-emerald-600' :
                  geoStatus === 'far' ? 'text-rose-600' : 'text-amber-600'
                } />
                <div>
                  {geoStatus === 'checking' && <p className="text-base font-medium text-amber-700">Obteniendo ubicación...</p>}
                  {geoStatus === 'ok' && (
                    <>
                      <p className="text-base font-semibold text-emerald-700">En el local</p>
                      {distancia !== null && <p className="text-sm text-emerald-600">A {distancia}m</p>}
                    </>
                  )}
                  {geoStatus === 'far' && (
                    <>
                      <p className="text-base font-semibold text-rose-700">Fuera del radio</p>
                      <p className="text-sm text-rose-600">A {distancia}m (máx. {RADIO_M}m)</p>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={obtenerUbicacion}
                className="p-2.5 rounded-xl bg-white/60 hover:bg-white transition-colors flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <Navigation size={18} className="text-gray-500" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          BOTÓN CENTRAL
      ══════════════════════════════════════════════════ */}
      <div className="flex flex-col items-center mb-6">

        {turnoAbierto && ultimoFichaje?.hora_entrada && (
          <div className="mb-4 text-center">
            <p className="text-sm text-gray-400">Entrada registrada a las</p>
            <p className="text-4xl font-black text-gray-800 tabular-nums">
              {ultimoFichaje.hora_entrada.slice(0, 5)}
            </p>
          </div>
        )}

        {!turnoAbierto && fichajesHoy.length > 0 && totalHoy > 0 && (
          <div className="mb-4 text-center">
            <p className="text-sm text-gray-400">Total trabajado hoy</p>
            <p className="text-3xl font-black text-gray-800">{totalHoy.toFixed(1)}h</p>
          </div>
        )}

        <button
          onClick={fichar}
          disabled={!puedefichar || fichando}
          className={[
            'w-52 h-52 rounded-full flex flex-col items-center justify-center transition-all duration-150 select-none',
            !puedefichar
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : turnoAbierto
              ? 'bg-rose-500 text-white shadow-rose-200 shadow-xl active:scale-95'
              : 'bg-emerald-500 text-white shadow-emerald-200 shadow-xl active:scale-95',
          ].join(' ')}
        >
          {fichando ? (
            <RefreshCw size={48} className="animate-spin" />
          ) : turnoAbierto ? (
            <>
              <LogOut size={48} />
              <span className="text-xl font-black tracking-wide mt-2">FICHAR SALIDA</span>
            </>
          ) : (
            <>
              <LogIn size={48} />
              <span className="text-xl font-black tracking-wide mt-2">FICHAR ENTRADA</span>
            </>
          )}
        </button>

        {!puedefichar && geoStatus !== 'checking' && (
          <p className="text-sm text-rose-500 mt-4 flex items-center gap-1.5">
            <AlertCircle size={16} /> Debes estar en el local para fichar
          </p>
        )}
        {turnoAbierto && puedefichar && (
          <p className="text-sm text-gray-400 mt-4">Pulsa para registrar tu salida</p>
        )}
        {!turnoAbierto && fichajesHoy.length > 0 && puedefichar && (
          <p className="text-sm text-gray-400 mt-4">Turno cerrado · pulsa para iniciar otro</p>
        )}
      </div>

      {/* ── Fichajes de hoy ──────────────────────────────── */}
      {fichajesHoy.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <Clock size={14} className="text-gray-400" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Turnos de hoy</p>
          </div>
          <div className="divide-y divide-gray-50">
            {fichajesHoy.map((f, i) => (
              <div key={f.id} className="px-4 py-3 flex items-center justify-between min-h-[52px]">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-300 w-4 text-right">{i + 1}</span>
                  <p className="text-base tabular-nums text-gray-800">
                    {f.hora_entrada?.slice(0, 5) ?? '—'}
                    {' → '}
                    {f.hora_salida
                      ? f.hora_salida.slice(0, 5)
                      : <span className="text-emerald-500 font-semibold">En curso</span>
                    }
                  </p>
                </div>
                <span className="text-sm font-semibold text-gray-700">
                  {f.hora_salida ? duracion(f.hora_entrada, f.hora_salida) : '—'}
                </span>
              </div>
            ))}
            {fichajesHoy.filter(f => f.hora_salida).length > 1 && (
              <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-600">Total hoy</span>
                <span className="text-sm font-bold text-gray-800">{totalHoy.toFixed(1)}h</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Resumen mes ──────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{totalMes.toFixed(1)}h</p>
          <p className="text-sm text-gray-400 mt-0.5">Horas este mes</p>
        </div>
        <div className={`rounded-xl border p-4 text-center ${totalMes >= horasContrato ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200'}`}>
          <p className={`text-2xl font-bold ${totalMes >= horasContrato ? 'text-emerald-700' : 'text-gray-900'}`}>
            {horasContrato.toFixed(0)}h
          </p>
          <p className={`text-sm mt-0.5 ${totalMes >= horasContrato ? 'text-emerald-500' : 'text-gray-400'}`}>
            Contrato mensual
          </p>
        </div>
      </div>

      {/* ── Historial del mes agrupado por día ───────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Historial del mes</p>
        </div>
        {diasOrdenados.length === 0 ? (
          <p className="px-4 py-6 text-base text-gray-400 text-center">Sin fichajes este mes</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {diasOrdenados.map((fecha) => {
              const registros = porDia[fecha]
              const totalDia = registros.reduce((s, f) => s + (f.horas_total ?? 0), 0)
              const tieneAbierto = registros.some(f => !f.hora_salida)
              return (
                <div key={fecha} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-semibold text-gray-700 capitalize">
                      {new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', {
                        weekday: 'long', day: 'numeric', month: 'short',
                      })}
                    </p>
                    <span className={`text-sm font-bold ${tieneAbierto ? 'text-emerald-600' : 'text-gray-800'}`}>
                      {tieneAbierto ? 'En curso' : `${totalDia.toFixed(1)}h`}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {registros.map(f => (
                      <div key={f.id} className="flex items-center gap-2 text-sm text-gray-500">
                        <span className="tabular-nums">
                          {f.hora_entrada?.slice(0, 5) ?? '—'} → {f.hora_salida?.slice(0, 5) ?? '…'}
                        </span>
                        {f.horas_total != null && (
                          <span className="text-xs text-gray-400">
                            ({duracion(f.hora_entrada, f.hora_salida)})
                          </span>
                        )}
                        {(f.horas_nocturnas ?? 0) > 0 && (
                          <span className="text-xs text-blue-500">{f.horas_nocturnas}h noct.</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

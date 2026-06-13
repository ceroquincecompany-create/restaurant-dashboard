'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Fichaje } from '@/lib/supabase'
import { useEmpleadoActual } from '@/lib/useEmpleado'
import { MapPin, RefreshCw, Clock, AlertCircle, Navigation, LogIn, LogOut } from 'lucide-react'

const LOCAL_LAT = 37.3956
const LOCAL_LNG = -5.9845
const RADIO_M = 500

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
  let finMin = h2 * 60 + m2
  const inicioMin = h1 * 60 + m1
  if (finMin <= inicioMin) finMin += 24 * 60
  const total = (finMin - inicioMin) / 60
  const overlap = Math.max(0, Math.min(finMin, 30 * 60) - Math.max(inicioMin, 22 * 60))
  return { total: Math.round(total * 100) / 100, nocturnas: Math.round((overlap / 60) * 100) / 100 }
}

type GeoStatus = 'checking' | 'ok' | 'far' | 'denied' | 'error'

export default function PaginaFichaje() {
  const { empleado, loading: empLoading } = useEmpleadoActual()

  // Todos los fichajes del día (puede haber varios en turnos partidos)
  const [fichajesHoy, setFichajesHoy] = useState<Fichaje[]>([])
  // Fichaje activo = el que tiene entrada pero NO salida (turno abierto)
  const [fichajeActivo, setFichajeActivo] = useState<Fichaje | null>(null)
  // Historial del mes
  const [fichajesMes, setFichajesMes] = useState<Fichaje[]>([])

  const [geoStatus, setGeoStatus] = useState<GeoStatus>('checking')
  const [distancia, setDistancia] = useState<number | null>(null)
  const [fichando, setFichando] = useState(false)
  const [loading, setLoading] = useState(true)

  const today = new Date().toISOString().split('T')[0]
  const primerDiaMes = `${today.slice(0, 7)}-01`

  const cargar = useCallback(async () => {
    if (!empleado) return
    try {
      const [{ data: hoy }, { data: mes }] = await Promise.all([
        // Cargamos TODOS los fichajes del día (no solo el primero)
        supabase
          .from('fichajes')
          .select('*')
          .eq('empleado_id', empleado.id)
          .eq('fecha', today)
          .order('hora_entrada', { ascending: true }),
        // Historial del mes completo
        supabase
          .from('fichajes')
          .select('*')
          .eq('empleado_id', empleado.id)
          .gte('fecha', primerDiaMes)
          .lte('fecha', today)
          .order('fecha', { ascending: false })
          .order('hora_entrada', { ascending: false }),
      ])
      const hoyList = hoy ?? []
      setFichajesHoy(hoyList)
      // El fichaje activo es el último sin hora_salida (turno abierto)
      setFichajeActivo(hoyList.find(f => f.hora_salida === null) ?? null)
      setFichajesMes(mes ?? [])
    } finally {
      setLoading(false)
    }
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
    if (empleado?.sin_restriccion_geo) {
      setGeoStatus('ok')
      setDistancia(null)
    }
  }, [empleado?.sin_restriccion_geo])

  async function fichar() {
    if (!empleado || geoStatus !== 'ok') return
    setFichando(true)
    const hora = horaActual()

    if (!fichajeActivo) {
      // Sin turno abierto → crear nueva entrada (inicio de turno, sea el 1º o el 2º del día)
      await supabase.from('fichajes').insert({
        empleado_id: empleado.id,
        fecha: today,
        hora_entrada: hora,
      })
    } else {
      // Turno abierto → registrar salida
      const { total, nocturnas } = fichajeActivo.hora_entrada
        ? calcHoras(fichajeActivo.hora_entrada, hora)
        : { total: 0, nocturnas: 0 }
      await supabase
        .from('fichajes')
        .update({ hora_salida: hora, horas_total: total, horas_nocturnas: nocturnas })
        .eq('id', fichajeActivo.id)
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

  // Estado derivado del fichaje activo (no del historial completo)
  const enCurso = fichajeActivo !== null
  const puedefichar = geoStatus === 'ok'

  const totalMes = fichajesMes.reduce((s, f) => s + (f.horas_total ?? 0), 0)
  const horasContrato = Number(empleado?.horas_contrato ?? 40) * 4.33

  return (
    <div className="px-4 py-5 max-w-lg mx-auto">

      {/* ── Banner geolocalización ─────────────────────────── */}
      {empleado?.sin_restriccion_geo ? (
        <div className="rounded-xl px-4 py-3 mb-5 bg-amber-50 border border-amber-200">
          <div className="flex items-center gap-3">
            <MapPin size={20} className="text-amber-600 flex-shrink-0" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-base font-semibold text-amber-700">Fichaje habilitado</p>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-800">Modo prueba</span>
              </div>
              <p className="text-sm text-amber-600">Sin restricción de ubicación</p>
            </div>
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
                      En Chrome Android: toca el candado en la barra de direcciones → Permisos del sitio → Ubicación → Permitir
                    </p>
                  </>
                ) : (
                  <p className="text-base font-semibold text-amber-700">No se pudo obtener la ubicación</p>
                )}
                <button
                  onClick={obtenerUbicacion}
                  className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 text-sm font-semibold hover:bg-amber-200 active:scale-95 transition-all"
                >
                  <Navigation size={14} /> Reintentar ubicación
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <MapPin size={20} className={
                  geoStatus === 'ok'  ? 'text-emerald-600' :
                  geoStatus === 'far' ? 'text-rose-600' : 'text-amber-600'
                } />
                <div>
                  {geoStatus === 'checking' && <p className="text-base font-medium text-amber-700">Obteniendo ubicación...</p>}
                  {geoStatus === 'ok' && (
                    <>
                      <p className="text-base font-semibold text-emerald-700">En el local</p>
                      {distancia !== null && <p className="text-sm text-emerald-600">A {distancia}m — puedes fichar</p>}
                    </>
                  )}
                  {geoStatus === 'far' && (
                    <>
                      <p className="text-base font-semibold text-rose-700">Fuera del radio</p>
                      <p className="text-sm text-rose-600">A {distancia}m — necesitas estar a menos de {RADIO_M}m</p>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={obtenerUbicacion}
                className="p-2.5 rounded-xl bg-white/60 hover:bg-white transition-colors flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
                title="Actualizar ubicación"
              >
                <Navigation size={18} className="text-gray-500" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          BOTÓN DE FICHAJE — círculo grande
      ══════════════════════════════════════════════════════ */}
      <div className="flex flex-col items-center mb-6">

        {/* Hora de entrada del turno activo */}
        {enCurso && fichajeActivo?.hora_entrada && (
          <div className="mb-5 text-center">
            <p className="text-sm text-gray-400">Entrada registrada</p>
            <p className="text-4xl font-black text-gray-800 tabular-nums">{fichajeActivo.hora_entrada.slice(0, 5)}</p>
          </div>
        )}

        {/* Turnos cerrados hoy (sobre el botón) */}
        {fichajesHoy.filter(f => f.hora_salida !== null).length > 0 && !enCurso && (
          <div className="mb-4 w-full bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Turnos de hoy</p>
            </div>
            {fichajesHoy.filter(f => f.hora_salida !== null).map(f => (
              <div key={f.id} className="px-4 py-2.5 flex items-center justify-between">
                <span className="text-sm text-gray-700 tabular-nums">
                  {f.hora_entrada?.slice(0, 5)} → {f.hora_salida?.slice(0, 5)}
                </span>
                <span className="text-sm font-semibold text-gray-800">
                  {f.horas_total != null ? `${f.horas_total}h` : '—'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Botón círculo */}
        <button
          onClick={fichar}
          disabled={!puedefichar || fichando}
          className={[
            'w-56 h-56 rounded-full flex flex-col items-center justify-center transition-all duration-150 select-none',
            !puedefichar
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
              : enCurso
              ? 'bg-rose-500 text-white shadow-rose-200 shadow-xl active:scale-95'
              : 'bg-emerald-500 text-white shadow-emerald-200 shadow-xl active:scale-95',
          ].join(' ')}
        >
          {fichando ? (
            <RefreshCw size={52} className="animate-spin" />
          ) : enCurso ? (
            <>
              <LogOut size={52} />
              <span className="text-2xl font-black tracking-wide mt-2">SALIDA</span>
            </>
          ) : (
            <>
              <LogIn size={52} />
              <span className="text-2xl font-black tracking-wide mt-2">ENTRADA</span>
            </>
          )}
        </button>

        {/* Turno abierto — resumen bajo el círculo */}
        {enCurso && (
          <p className="text-sm text-gray-400 mt-4 text-center">
            Pulsa para registrar la salida de este turno
          </p>
        )}
        {!enCurso && fichajesHoy.length > 0 && (
          <p className="text-sm text-gray-400 mt-4 text-center">
            Turno cerrado · Pulsa para iniciar un nuevo turno
          </p>
        )}

        {/* Geo bloqueado */}
        {!puedefichar && geoStatus !== 'checking' && (
          <p className="text-base text-rose-500 mt-4 flex items-center gap-1.5 text-center">
            <AlertCircle size={16} /> Debes estar en el local para fichar
          </p>
        )}
      </div>

      {/* ── Resumen mes ────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 mb-5">
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

      {/* ── Historial del mes ───────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fichajes del mes</p>
        </div>
        {fichajesMes.length === 0 ? (
          <p className="px-4 py-6 text-base text-gray-400 text-center">Sin fichajes este mes</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {fichajesMes.map((f) => (
              <div key={f.id} className="px-4 py-3 flex items-center justify-between min-h-[52px]">
                <div>
                  <p className="text-base text-gray-800">
                    {new Date(f.fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </p>
                  <p className="text-sm text-gray-400 tabular-nums">
                    {f.hora_entrada?.slice(0, 5) ?? '—'} → {f.hora_salida?.slice(0, 5) ?? <span className="text-amber-500">En curso</span>}
                  </p>
                </div>
                <div className="text-right">
                  {f.horas_total != null ? (
                    <p className="text-base font-semibold text-gray-800">{f.horas_total}h</p>
                  ) : (
                    <span className="text-sm text-amber-600 font-medium">En curso</span>
                  )}
                  {(f.horas_nocturnas ?? 0) > 0 && (
                    <p className="text-xs text-blue-500">{f.horas_nocturnas}h noct.</p>
                  )}
                  {(f.horas_extra ?? 0) > 0 && (
                    <p className="text-xs text-amber-500">+{f.horas_extra}h extra</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

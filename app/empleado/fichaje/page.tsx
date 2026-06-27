'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Fichaje } from '@/lib/supabase'
import { useEmpleadoActual } from '@/lib/useEmpleado'
import { useFichajeActivo } from '@/lib/useFichajeActivo'
import { MapPin, RefreshCw, Clock, AlertCircle, Navigation, LogIn, LogOut, CheckCircle2, PauseCircle } from 'lucide-react'

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
  const { fichajeActivo, cargando: configCargando } = useFichajeActivo()
  const [fichajeHoy, setFichajeHoy] = useState<Fichaje | null>(null)
  const [fichajes, setFichajes] = useState<Fichaje[]>([])
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
        supabase.from('fichajes').select('*').eq('empleado_id', empleado.id).eq('fecha', today).maybeSingle(),
        supabase.from('fichajes').select('*').eq('empleado_id', empleado.id).gte('fecha', primerDiaMes).lte('fecha', today).order('fecha', { ascending: false }),
      ])
      setFichajeHoy(hoy ?? null)
      setFichajes(mes ?? [])
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
    if (!fichajeHoy) {
      await supabase.from('fichajes').insert({ empleado_id: empleado.id, fecha: today, hora_entrada: hora })
    } else if (!fichajeHoy.hora_salida) {
      const { total, nocturnas } = fichajeHoy.hora_entrada
        ? calcHoras(fichajeHoy.hora_entrada, hora)
        : { total: null, nocturnas: null }
      await supabase.from('fichajes').update({ hora_salida: hora, horas_total: total, horas_nocturnas: nocturnas }).eq('id', fichajeHoy.id)
    }
    setFichando(false)
    cargar()
  }

  if (empLoading || loading || configCargando) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="animate-spin text-[#F5B731]" size={24} />
      </div>
    )
  }

  if (fichajeActivo === false) {
    return (
      <div className="px-4 py-5 md:px-6 md:py-6 max-w-2xl">
        <div className="hidden md:block mb-5">
          <h1 className="text-xl font-bold text-gray-900">Fichaje</h1>
          <p className="text-sm text-gray-400 mt-0.5">Control de presencia</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-10 flex flex-col items-center text-center">
          <PauseCircle size={48} className="text-gray-300 mb-4" />
          <p className="text-base font-bold text-gray-600">El registro de jornada está temporalmente desactivado</p>
          <p className="text-sm text-gray-400 mt-2 max-w-xs leading-relaxed">
            El encargado ha pausado el sistema de fichajes. El resto de la app funciona con normalidad.
          </p>
        </div>
      </div>
    )
  }

  const estadoHoy = !fichajeHoy ? 'sin_fichar' : !fichajeHoy.hora_salida ? 'en_curso' : 'completado'
  const puedefichar = geoStatus === 'ok' && estadoHoy !== 'completado'
  const totalMes = fichajes.reduce((s, f) => s + (f.horas_total ?? 0), 0)
  const horasContrato = Number(empleado?.horas_contrato ?? 40) * 4.33

  // ── Clases del círculo según estado ─────────────────────────
  const circleCls = !puedefichar
    ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
    : estadoHoy === 'sin_fichar'
    ? 'bg-emerald-500 text-white shadow-emerald-200 shadow-xl active:scale-95'
    : 'bg-rose-500 text-white shadow-rose-200 shadow-xl active:scale-95'

  // ── Contenido del círculo ────────────────────────────────────
  function CircleContent() {
    if (fichando) return (
      <RefreshCw size={52} className="animate-spin" />
    )
    if (estadoHoy === 'completado') return (
      <>
        <CheckCircle2 size={52} className="text-emerald-400" />
        <span className="text-lg font-bold text-emerald-600 mt-1">Completado</span>
      </>
    )
    if (estadoHoy === 'sin_fichar') return (
      <>
        <LogIn size={52} />
        <span className="text-2xl font-black tracking-wide mt-2">ENTRADA</span>
      </>
    )
    return (
      <>
        <LogOut size={52} />
        <span className="text-2xl font-black tracking-wide mt-2">SALIDA</span>
      </>
    )
  }

  return (
    <div className="px-4 py-5 md:px-6 md:py-6 max-w-2xl">

      {/* ── Título (desktop) ──────────────────────────────── */}
      <div className="hidden md:block mb-5">
        <h1 className="text-xl font-bold text-gray-900">Fichaje</h1>
        <p className="text-sm text-gray-400 mt-0.5">Control de presencia</p>
      </div>

      {/* ── Banner de geolocalización ─────────────────────── */}
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
          geoStatus === 'ok' ? 'bg-emerald-50 border border-emerald-200' :
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
                    <p className="text-sm text-amber-600 mt-1">En Chrome Android: toca el candado en la barra de direcciones → Permisos del sitio → Ubicación → Permitir</p>
                  </>
                ) : (
                  <p className="text-base font-semibold text-amber-700">No se pudo obtener la ubicación</p>
                )}
                <button
                  onClick={obtenerUbicacion}
                  className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 text-sm font-semibold hover:bg-amber-200 active:scale-95 transition-all"
                >
                  <Navigation size={14} />
                  Reintentar ubicación
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
          MÓVIL: botón círculo grande
          ═════════════════════════════════════════════════════ */}
      <div className="md:hidden flex flex-col items-center mb-6">
        {/* Estado actual sobre el círculo */}
        {estadoHoy === 'en_curso' && fichajeHoy?.hora_entrada && (
          <div className="mb-5 text-center">
            <p className="text-sm text-gray-400">Entrada registrada</p>
            <p className="text-3xl font-black text-gray-800 tabular-nums">{fichajeHoy.hora_entrada.slice(0, 5)}</p>
          </div>
        )}

        {/* Círculo */}
        {estadoHoy === 'completado' ? (
          <div className="w-56 h-56 rounded-full bg-emerald-50 border-4 border-emerald-200 flex flex-col items-center justify-center gap-1">
            <CheckCircle2 size={56} className="text-emerald-500" />
            <p className="text-lg font-bold text-emerald-700">Jornada</p>
            <p className="text-lg font-bold text-emerald-700">completada</p>
            <p className="text-base text-emerald-600 mt-1">
              {fichajeHoy?.hora_entrada?.slice(0, 5)} → {fichajeHoy?.hora_salida?.slice(0, 5)}
            </p>
            {fichajeHoy?.horas_total != null && (
              <p className="text-sm font-semibold text-emerald-500">{fichajeHoy.horas_total}h trabajadas</p>
            )}
          </div>
        ) : (
          <button
            onClick={fichar}
            disabled={!puedefichar || fichando}
            className={`w-56 h-56 rounded-full flex flex-col items-center justify-center transition-all duration-150 ${circleCls}`}
          >
            <CircleContent />
          </button>
        )}

        {/* Mensaje de error geo bajo el círculo */}
        {!puedefichar && estadoHoy !== 'completado' && geoStatus !== 'ok' && geoStatus !== 'checking' && (
          <p className="text-base text-rose-500 mt-4 flex items-center gap-1.5 text-center">
            <AlertCircle size={16} /> Debes estar en el local
          </p>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          DESKTOP: botón rectangular
          ═════════════════════════════════════════════════════ */}
      <div className="hidden md:block bg-white rounded-2xl border border-gray-200 p-6 mb-5 text-center">
        {estadoHoy === 'completado' ? (
          <div>
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
              <Clock size={30} className="text-emerald-600" />
            </div>
            <p className="text-base font-bold text-emerald-700">Jornada completada</p>
            <p className="text-sm text-gray-500 mt-1">
              {fichajeHoy?.hora_entrada?.slice(0, 5)} → {fichajeHoy?.hora_salida?.slice(0, 5)}
              {fichajeHoy?.horas_total != null && <span className="font-semibold"> · {fichajeHoy.horas_total}h</span>}
              {(fichajeHoy?.horas_nocturnas ?? 0) > 0 && (
                <span className="text-blue-600"> ({fichajeHoy!.horas_nocturnas}h noct.)</span>
              )}
            </p>
          </div>
        ) : (
          <div>
            {estadoHoy === 'en_curso' && fichajeHoy?.hora_entrada && (
              <p className="text-sm text-gray-400 mb-3">
                Entrada registrada: <strong>{fichajeHoy.hora_entrada.slice(0, 5)}</strong>
              </p>
            )}
            <button
              onClick={fichar}
              disabled={!puedefichar || fichando}
              className={`w-full py-4 rounded-xl text-lg font-bold transition-all ${
                puedefichar
                  ? estadoHoy === 'sin_fichar'
                    ? 'bg-[#F5B731] text-[#1A1A1A] hover:bg-[#e0a820] active:scale-95'
                    : 'bg-[#1A1A1A] text-white hover:bg-gray-800 active:scale-95'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              {fichando
                ? <span className="flex items-center justify-center gap-2"><RefreshCw size={18} className="animate-spin" /> Registrando...</span>
                : estadoHoy === 'sin_fichar' ? '▶  FICHAR ENTRADA'
                : '⏹  FICHAR SALIDA'}
            </button>
            {!puedefichar && geoStatus !== 'ok' && geoStatus !== 'checking' && (
              <p className="text-xs text-rose-500 mt-2 flex items-center justify-center gap-1">
                <AlertCircle size={12} /> Debes estar en el local para fichar
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Resumen mes ───────────────────────────────────── */}
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

      {/* ── Historial del mes ─────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fichajes del mes</p>
        </div>
        {fichajes.length === 0 ? (
          <p className="px-4 py-6 text-base text-gray-400 text-center">Sin fichajes este mes</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {fichajes.map((f) => (
              <div key={f.id} className="px-4 py-3 flex items-center justify-between min-h-[52px]">
                <div>
                  <p className="text-base text-gray-800">
                    {new Date(f.fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </p>
                  <p className="text-sm text-gray-400">
                    {f.hora_entrada?.slice(0, 5) ?? '—'} → {f.hora_salida?.slice(0, 5) ?? '—'}
                  </p>
                </div>
                <div className="text-right">
                  {f.horas_total != null ? (
                    <p className="text-base font-semibold text-gray-800">{f.horas_total}h</p>
                  ) : (
                    <span className="text-sm text-amber-600 font-medium">En curso</span>
                  )}
                  {(f.horas_nocturnas ?? 0) > 0 && (
                    <p className="text-sm text-blue-600">{f.horas_nocturnas}h noct.</p>
                  )}
                  {(f.horas_extra ?? 0) > 0 && (
                    <p className="text-sm text-amber-600">+{f.horas_extra}h extra</p>
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

'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Fichaje, Turno } from '@/lib/supabase'
import { useEmpleadoActual } from '@/lib/useEmpleado'
import { RefreshCw, MapPin, Clock, CalendarDays, Umbrella, AlertCircle } from 'lucide-react'

// Coordenadas SOFI Pinomonotano — Calle Estibadores 24-25, 41015 Sevilla
const LOCAL_LAT = 37.3956
const LOCAL_LNG = -5.9845
const RADIO_M = 500

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function horaActual(): string {
  const n = new Date()
  return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`
}

function calcHorasTotal(entrada: string, salida: string): number {
  const [h1, m1] = entrada.split(':').map(Number)
  const [h2, m2] = salida.split(':').map(Number)
  let t = h2 * 60 + m2 - (h1 * 60 + m1)
  if (t < 0) t += 24 * 60
  return Math.round((t / 60) * 100) / 100
}

export default function PaginaInicio() {
  const { empleado, loading: empLoading } = useEmpleadoActual()
  const [fichajeHoy, setFichajeHoy] = useState<Fichaje | null | undefined>(undefined)
  const [proximoTurno, setProximoTurno] = useState<Turno | null>(null)
  const [diasRestantes, setDiasRestantes] = useState<number | null>(null)
  const [fichando, setFichando] = useState(false)
  const [geoStatus, setGeoStatus] = useState<'checking' | 'ok' | 'far' | 'error' | 'denied'>('checking')
  const [distancia, setDistancia] = useState<number | null>(null)

  const today = new Date().toISOString().split('T')[0]

  const cargarDatos = useCallback(async () => {
    if (!empleado) return
    const añoActual = new Date().getFullYear()
    const [{ data: fich }, { data: prox }, { data: sols }] = await Promise.all([
      supabase.from('fichajes').select('*').eq('empleado_id', empleado.id).eq('fecha', today).maybeSingle(),
      supabase.from('turnos').select('*').eq('empleado_id', empleado.id).gte('fecha', today).order('fecha').order('hora_inicio').limit(1).maybeSingle(),
      supabase.from('solicitudes_vacaciones').select('dias').eq('empleado_id', empleado.id).eq('estado', 'aprobada').gte('fecha_inicio', `${añoActual}-01-01`),
    ])
    setFichajeHoy(fich ?? null)
    setProximoTurno(prox ?? null)
    const usados = (sols ?? []).reduce((s, r) => s + r.dias, 0)
    setDiasRestantes(23 - usados)
  }, [empleado, today])

  useEffect(() => {
    if (empleado) cargarDatos()
  }, [empleado, cargarDatos])

  useEffect(() => {
    if (!navigator.geolocation) { setGeoStatus('error'); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const d = Math.round(haversine(pos.coords.latitude, pos.coords.longitude, LOCAL_LAT, LOCAL_LNG))
        setDistancia(d)
        setGeoStatus(d <= RADIO_M ? 'ok' : 'far')
      },
      (err) => setGeoStatus(err.code === 1 ? 'denied' : 'error'),
      { timeout: 10000, maximumAge: 60000 }
    )
  }, [])

  // Bypass geo check for employees without restriction
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
    } else if (fichajeHoy && !fichajeHoy.hora_salida) {
      const total = fichajeHoy.hora_entrada ? calcHorasTotal(fichajeHoy.hora_entrada, hora) : null
      await supabase.from('fichajes').update({ hora_salida: hora, horas_total: total }).eq('id', fichajeHoy.id)
    }
    setFichando(false)
    cargarDatos()
  }

  if (empLoading || fichajeHoy === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="animate-spin text-[#F5B731]" size={24} />
      </div>
    )
  }

  const nombreCorto = empleado?.nombre.split(' ')[0] ?? 'empleado'
  const hora = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 20 ? 'Buenas tardes' : 'Buenas noches'

  const estadoFichaje = !fichajeHoy
    ? 'sin_fichar'
    : !fichajeHoy.hora_salida
    ? 'en_curso'
    : 'completado'

  const puedefichar = geoStatus === 'ok' && estadoFichaje !== 'completado'

  return (
    <div className="px-4 py-5 md:px-6 md:py-6 max-w-2xl">

      {/* Saludo */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">{saludo}, {nombreCorto}</h1>
        <p className="text-base text-gray-500 mt-1 capitalize">
          {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Ubicación */}
      {empleado?.sin_restriccion_geo ? (
        <div className="rounded-xl px-4 py-3 mb-4 flex items-center gap-3 bg-amber-50 border border-amber-200">
          <MapPin size={18} className="flex-shrink-0 text-amber-600" />
          <span className="text-base text-amber-700 font-medium">
            Fichaje habilitado
            <span className="ml-2 text-xs font-bold px-1.5 py-0.5 bg-amber-200 text-amber-800 rounded-full">Modo prueba</span>
          </span>
        </div>
      ) : (
        <div className={`rounded-xl px-4 py-3 mb-4 flex items-center gap-3 text-base ${
          geoStatus === 'ok' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' :
          geoStatus === 'far' ? 'bg-rose-50 border border-rose-200 text-rose-700' :
          geoStatus === 'checking' ? 'bg-gray-50 border border-gray-200 text-gray-500' :
          'bg-amber-50 border border-amber-200 text-amber-700'
        }`}>
          <MapPin size={18} className="flex-shrink-0" />
          <span>
            {geoStatus === 'checking' && 'Obteniendo ubicación...'}
            {geoStatus === 'ok' && `En el local${distancia !== null ? ` · ${distancia}m` : ''}`}
            {geoStatus === 'far' && `Estás a ${distancia}m — necesitas estar a menos de ${RADIO_M}m`}
            {geoStatus === 'denied' && 'Activa la ubicación para poder fichar'}
            {geoStatus === 'error' && 'No se pudo obtener la ubicación'}
          </span>
        </div>
      )}

      {/* Botón FICHAR */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
        {estadoFichaje === 'completado' ? (
          <div className="flex items-center gap-4 py-2">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <Clock size={28} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-emerald-700">Jornada completada</p>
              <p className="text-base text-gray-500 mt-0.5">
                {fichajeHoy?.hora_entrada?.slice(0, 5)} → {fichajeHoy?.hora_salida?.slice(0, 5)}
                {fichajeHoy?.horas_total != null && (
                  <span className="font-semibold text-gray-700"> · {fichajeHoy.horas_total}h</span>
                )}
              </p>
            </div>
          </div>
        ) : (
          <div>
            {estadoFichaje === 'en_curso' && fichajeHoy?.hora_entrada && (
              <p className="text-base text-gray-500 mb-3 text-center">
                Entrada a las <strong className="text-gray-800">{fichajeHoy.hora_entrada.slice(0, 5)}</strong>
              </p>
            )}
            <button
              onClick={fichar}
              disabled={!puedefichar || fichando}
              className={`w-full min-h-[80px] rounded-xl text-xl font-bold transition-all active:scale-[0.98] ${
                puedefichar
                  ? estadoFichaje === 'sin_fichar'
                    ? 'bg-[#F5B731] text-[#1A1A1A] hover:bg-[#e0a820]'
                    : 'bg-[#1A1A1A] text-white hover:bg-gray-800'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              {fichando ? (
                <span className="flex items-center justify-center gap-2">
                  <RefreshCw size={22} className="animate-spin" /> Fichando...
                </span>
              ) : estadoFichaje === 'sin_fichar' ? (
                '▶  FICHAR ENTRADA'
              ) : (
                '⏹  FICHAR SALIDA'
              )}
            </button>
            {!puedefichar && geoStatus !== 'ok' && geoStatus !== 'checking' && (
              <p className="text-sm text-rose-500 mt-2 flex items-center justify-center gap-1.5">
                <AlertCircle size={14} /> Debes estar en el local para fichar
              </p>
            )}
          </div>
        )}
      </div>

      {/* Cards info */}
      <div className="grid grid-cols-2 gap-3">
        {/* Próximo turno */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays size={16} className="text-gray-400" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Próximo turno</p>
          </div>
          {proximoTurno ? (
            <div>
              <p className="text-base font-bold text-gray-900">{proximoTurno.tipo_turno}</p>
              <p className="text-base text-gray-600 mt-1">
                {new Date(proximoTurno.fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
              </p>
              {proximoTurno.hora_inicio && (
                <p className="text-sm text-gray-400 mt-0.5">
                  {proximoTurno.hora_inicio.slice(0, 5)} → {proximoTurno.hora_fin?.slice(0, 5) ?? '...'}
                </p>
              )}
            </div>
          ) : (
            <p className="text-base text-gray-400">Sin turnos</p>
          )}
        </div>

        {/* Vacaciones */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Umbrella size={16} className="text-gray-400" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Vacaciones</p>
          </div>
          {diasRestantes !== null ? (
            <div>
              <p className="text-3xl font-bold text-gray-900">{diasRestantes}</p>
              <p className="text-sm text-gray-400 mt-1">días disponibles</p>
              <p className="text-sm text-gray-300 mt-0.5">{23 - diasRestantes} de 23 usados</p>
            </div>
          ) : (
            <p className="text-base text-gray-400">Cargando...</p>
          )}
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Fichaje } from '@/lib/supabase'
import { useEmpleadoActual } from '@/lib/useEmpleado'
import { MapPin, RefreshCw, Clock, AlertCircle, Navigation } from 'lucide-react'

const LOCAL_LAT = 37.7749
const LOCAL_LNG = -1.4977
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
  return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`
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
      { timeout: 10000, maximumAge: 30000 }
    )
  }

  useEffect(() => { obtenerUbicacion() }, [])

  async function fichar() {
    if (!empleado || geoStatus !== 'ok') return
    setFichando(true)
    const hora = horaActual()
    if (!fichajeHoy) {
      await supabase.from('fichajes').insert({ empleado_id: empleado.id, fecha: today, hora_entrada: hora })
    } else if (!fichajeHoy.hora_salida) {
      const { total, nocturnas } = fichajeHoy.hora_entrada ? calcHoras(fichajeHoy.hora_entrada, hora) : { total: null, nocturnas: null }
      await supabase.from('fichajes').update({ hora_salida: hora, horas_total: total, horas_nocturnas: nocturnas }).eq('id', fichajeHoy.id)
    }
    setFichando(false)
    cargar()
  }

  if (empLoading || loading) return <div className="flex items-center justify-center min-h-screen"><RefreshCw className="animate-spin text-[#F5B731]" size={24} /></div>

  const estadoHoy = !fichajeHoy ? 'sin_fichar' : !fichajeHoy.hora_salida ? 'en_curso' : 'completado'
  const puedefichar = geoStatus === 'ok' && estadoHoy !== 'completado'

  const totalMes = fichajes.reduce((s, f) => s + (f.horas_total ?? 0), 0)
  const horasContrato = Number(empleado?.horas_contrato ?? 40) * 4.33

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Fichaje</h1>
        <p className="text-sm text-gray-400 mt-0.5">Control de presencia</p>
      </div>

      {/* Geolocalización */}
      <div className={`rounded-xl p-4 mb-4 ${
        geoStatus === 'ok' ? 'bg-emerald-50 border border-emerald-200' :
        geoStatus === 'far' ? 'bg-rose-50 border border-rose-200' :
        'bg-amber-50 border border-amber-200'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MapPin size={20} className={
              geoStatus === 'ok' ? 'text-emerald-600' : geoStatus === 'far' ? 'text-rose-600' : 'text-amber-600'
            } />
            <div>
              {geoStatus === 'checking' && <p className="text-sm font-medium text-amber-700">Obteniendo ubicación...</p>}
              {geoStatus === 'ok' && (
                <>
                  <p className="text-sm font-semibold text-emerald-700">En el local</p>
                  <p className="text-xs text-emerald-600">Estás a {distancia}m — puedes fichar</p>
                </>
              )}
              {geoStatus === 'far' && (
                <>
                  <p className="text-sm font-semibold text-rose-700">Fuera del radio permitido</p>
                  <p className="text-xs text-rose-600">Estás a {distancia}m — debes estar a menos de {RADIO_M}m para fichar</p>
                </>
              )}
              {geoStatus === 'denied' && <p className="text-sm font-medium text-amber-700">Permiso de ubicación denegado</p>}
              {geoStatus === 'error' && <p className="text-sm font-medium text-amber-700">No se pudo obtener la ubicación</p>}
            </div>
          </div>
          <button
            onClick={obtenerUbicacion}
            className="p-2 rounded-lg hover:bg-white/50 transition-colors"
            title="Actualizar ubicación"
          >
            <Navigation size={16} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* Botón fichar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-5 text-center">
        {estadoHoy === 'completado' ? (
          <div>
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
              <Clock size={30} className="text-emerald-600" />
            </div>
            <p className="text-base font-bold text-emerald-700">Jornada completada</p>
            <p className="text-sm text-gray-500 mt-1">
              {fichajeHoy?.hora_entrada?.slice(0,5)} → {fichajeHoy?.hora_salida?.slice(0,5)}
              {fichajeHoy?.horas_total != null && <span className="font-semibold"> · {fichajeHoy.horas_total}h</span>}
              {(fichajeHoy?.horas_nocturnas ?? 0) > 0 && <span className="text-blue-600"> ({fichajeHoy!.horas_nocturnas}h noct.)</span>}
            </p>
          </div>
        ) : (
          <div>
            {estadoHoy === 'en_curso' && fichajeHoy?.hora_entrada && (
              <p className="text-sm text-gray-400 mb-3">
                Entrada registrada: <strong>{fichajeHoy.hora_entrada.slice(0,5)}</strong>
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
              {fichando ? <span className="flex items-center justify-center gap-2"><RefreshCw size={18} className="animate-spin" /> Registrando...</span>
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

      {/* Resumen mes */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{totalMes.toFixed(1)}h</p>
          <p className="text-xs text-gray-400 mt-0.5">Horas este mes</p>
        </div>
        <div className={`rounded-xl border p-4 text-center ${totalMes >= horasContrato ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200'}`}>
          <p className={`text-2xl font-bold ${totalMes >= horasContrato ? 'text-emerald-700' : 'text-gray-900'}`}>
            {horasContrato.toFixed(0)}h
          </p>
          <p className={`text-xs mt-0.5 ${totalMes >= horasContrato ? 'text-emerald-500' : 'text-gray-400'}`}>Contrato mensual</p>
        </div>
      </div>

      {/* Historial */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fichajes del mes</p>
        </div>
        {fichajes.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-400 text-center">Sin fichajes este mes</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {fichajes.map((f) => (
              <div key={f.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-800">
                    {new Date(f.fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </p>
                  <p className="text-xs text-gray-400">
                    {f.hora_entrada?.slice(0,5) ?? '—'} → {f.hora_salida?.slice(0,5) ?? '—'}
                  </p>
                </div>
                <div className="text-right">
                  {f.horas_total != null ? (
                    <p className="text-sm font-semibold text-gray-800">{f.horas_total}h</p>
                  ) : (
                    <span className="text-xs text-amber-600 font-medium">En curso</span>
                  )}
                  {(f.horas_nocturnas ?? 0) > 0 && (
                    <p className="text-xs text-blue-600">{f.horas_nocturnas}h noct.</p>
                  )}
                  {(f.horas_extra ?? 0) > 0 && (
                    <p className="text-xs text-amber-600">+{f.horas_extra}h extra</p>
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

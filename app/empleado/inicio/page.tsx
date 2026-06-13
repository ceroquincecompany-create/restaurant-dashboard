'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Fichaje, Turno } from '@/lib/supabase'
import { useEmpleadoActual } from '@/lib/useEmpleado'
import {
  RefreshCw, MapPin, CalendarDays, Umbrella, AlertCircle,
  Bell, Thermometer, Sparkles, ChevronRight, Package, LogIn, LogOut,
} from 'lucide-react'

// Coordenadas SOFI Pinomonotano — Calle Estibadores 24-25, 41015 Sevilla
const LOCAL_LAT = 37.42296249221703
const LOCAL_LNG = -5.965540822072279
const RADIO_M = 200

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

// Genera "Hoy", "Mañana, miércoles" o "jueves" según la fecha del turno
function etiquetaTurno(turno: Turno): string {
  const hoyISO = new Date().toISOString().split('T')[0]
  const man = new Date(); man.setDate(man.getDate() + 1)
  const manISO = man.toISOString().split('T')[0]
  const diaSemana = new Date(turno.fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long' })
  const diaCapital = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1)

  let prefijo = ''
  if (turno.fecha === hoyISO) prefijo = 'Hoy'
  else if (turno.fecha === manISO) prefijo = `Mañana, ${diaCapital}`
  else prefijo = diaCapital

  const hora = turno.hora_inicio
    ? `${turno.hora_inicio.slice(0, 5)} – ${turno.hora_fin?.slice(0, 5) ?? '?'}`
    : null

  return hora ? `${prefijo} · ${hora}` : prefijo
}

export default function PaginaInicio() {
  const { empleado, loading: empLoading } = useEmpleadoActual()
  const [fichajesHoy, setFichajesHoy] = useState<Fichaje[] | undefined>(undefined)
  const [proximoTurno, setProximoTurno] = useState<Turno | null>(null)
  const [diasRestantes, setDiasRestantes] = useState<number | null>(null)
  const [fichando, setFichando] = useState(false)
  const [geoStatus, setGeoStatus] = useState<'checking' | 'ok' | 'far' | 'error' | 'denied'>('checking')
  const [distancia, setDistancia] = useState<number | null>(null)
  // Badges operacionales
  const [avisosActivos, setAvisosActivos] = useState(0)
  const [tempMañanaPendiente, setTempMañanaPendiente] = useState(false)
  const [tempNochePendiente, setTempNochePendiente] = useState(false)
  const [limpiezasPendientes, setLimpiezasPendientes] = useState(0)
  // Badge inventario mensual
  const [inventarioPendiente, setInventarioPendiente] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  const cargarDatos = useCallback(async () => {
    if (!empleado) return
    const añoActual = new Date().getFullYear()
    const localId = empleado.local_id ?? 1
    const ahora = new Date()
    const horaActualNum = ahora.getHours()
    const minutoActual = ahora.getMinutes()

    const horaStr = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}:00`

    const [{ data: fich }, { data: prox }, { data: sols }] = await Promise.all([
      supabase.from('fichajes').select('*').eq('empleado_id', empleado.id).eq('fecha', today).order('hora_entrada', { ascending: true }),
      supabase
        .from('turnos').select('*')
        .eq('empleado_id', empleado.id)
        .or(`fecha.gt.${today},and(fecha.eq.${today},hora_fin.gte.${horaStr})`)
        .order('fecha', { ascending: true })
        .order('hora_inicio', { ascending: true })
        .limit(1).maybeSingle(),
      supabase.from('solicitudes_vacaciones').select('dias').eq('empleado_id', empleado.id).eq('estado', 'aprobada').gte('fecha_inicio', `${añoActual}-01-01`),
    ])
    setFichajesHoy(fich ?? [])
    setProximoTurno(prox ?? null)
    const usados = (sols ?? []).reduce((s, r) => s + r.dias, 0)
    setDiasRestantes(23 - usados)

    // Badges operacionales
    const [{ count: avisos }, { count: tempMañana }, { count: tempNoche }, { data: limpiezasHoy }] = await Promise.all([
      supabase.from('avisos_equipo').select('id', { count: 'exact', head: true }).eq('activo', true).eq('local_id', localId),
      supabase.from('temperaturas').select('id', { count: 'exact', head: true }).eq('turno', 'mañana').gte('fecha', `${today}T00:00:00`).lte('fecha', `${today}T23:59:59`).eq('local_id', localId),
      supabase.from('temperaturas').select('id', { count: 'exact', head: true }).eq('turno', 'noche').gte('fecha', `${today}T00:00:00`).lte('fecha', `${today}T23:59:59`).eq('local_id', localId),
      supabase.from('limpiezas').select('tarea').eq('fecha', today).eq('local_id', localId),
    ])
    setAvisosActivos(avisos ?? 0)
    setTempMañanaPendiente(horaActualNum >= 11 && (tempMañana ?? 0) === 0)
    setTempNochePendiente((horaActualNum > 22 || (horaActualNum === 22 && minutoActual >= 30)) && (tempNoche ?? 0) === 0)
    const tareasCompletadas = new Set((limpiezasHoy ?? []).map((r: any) => r.tarea))
    const DIARIAS = ['Utensilios cocina', 'Superficies cocina', 'Superficies horizontales', 'Superficies verticales', 'Baños']
    setLimpiezasPendientes(DIARIAS.filter(t => !tareasCompletadas.has(t)).length)

    // Badge inventario: últimos 3 días del mes, no confirmado aún
    const finMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0)
    const ultimoDia = finMes.getDate()
    const diaHoy = ahora.getDate()
    if (diaHoy >= ultimoDia - 2) {
      const y = ahora.getFullYear()
      const m = ahora.getMonth() + 1
      const inicioMes = `${y}-${String(m).padStart(2, '0')}-01`
      const finMesISO = finMes.toISOString().split('T')[0]
      const { count } = await supabase.from('inventario_conteos')
        .select('id', { count: 'exact', head: true })
        .eq('empleado_id', empleado.id)
        .eq('cerrado', true)
        .gte('fecha', inicioMes)
        .lte('fecha', finMesISO)
      setInventarioPendiente((count ?? 0) === 0)
    } else {
      setInventarioPendiente(false)
    }
  }, [empleado, today])

  useEffect(() => { if (empleado) cargarDatos() }, [empleado, cargarDatos])

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
    const lista = fichajesHoy ?? []
    const ultimo = lista[lista.length - 1] ?? null
    const turnoAbierto = ultimo !== null && ultimo.hora_salida === null

    if (turnoAbierto && ultimo) {
      const total = ultimo.hora_entrada ? calcHorasTotal(ultimo.hora_entrada, hora) : null
      await supabase.from('fichajes').update({ hora_salida: hora, horas_total: total }).eq('id', ultimo.id)
    } else {
      await supabase.from('fichajes').insert({ empleado_id: empleado.id, fecha: today, hora_entrada: hora })
    }
    setFichando(false)
    cargarDatos()
  }

  if (empLoading || fichajesHoy === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="animate-spin text-[#F5B731]" size={24} />
      </div>
    )
  }

  const nombreCorto = empleado?.nombre.split(' ')[0] ?? 'empleado'
  const hora = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 20 ? 'Buenas tardes' : 'Buenas noches'

  const lista = fichajesHoy ?? []
  const ultimoFichaje = lista[lista.length - 1] ?? null
  const turnoAbierto = ultimoFichaje !== null && ultimoFichaje.hora_salida === null
  const puedefichar = geoStatus === 'ok'

  return (
    <div className="px-4 py-5 md:px-6 md:py-6 max-w-2xl">

      {/* Saludo */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">{saludo}, {nombreCorto}</h1>
        <p className="text-base text-gray-500 mt-1 capitalize">
          {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* ── Banners de alertas ── */}
      {(inventarioPendiente || avisosActivos > 0 || tempMañanaPendiente || tempNochePendiente || limpiezasPendientes > 0) && (
        <div className="space-y-2 mb-4">
          {inventarioPendiente && (
            <Link href="/empleado/inventario" className="flex items-center gap-3 bg-[#F5B731]/10 border border-[#F5B731]/40 rounded-xl px-4 py-3 active:scale-[0.98] transition-all">
              <Package size={18} className="text-[#F5B731] flex-shrink-0" />
              <span className="text-base font-semibold text-[#1A1A1A] flex-1">Inventario mensual pendiente</span>
              <ChevronRight size={16} className="text-[#F5B731]" />
            </Link>
          )}
          {avisosActivos > 0 && (
            <Link href="/empleado/ops" className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 active:scale-[0.98] transition-all">
              <Bell size={18} className="text-rose-500 flex-shrink-0" />
              <span className="text-base font-semibold text-rose-700 flex-1">{avisosActivos} aviso{avisosActivos !== 1 ? 's' : ''} activo{avisosActivos !== 1 ? 's' : ''}</span>
              <ChevronRight size={16} className="text-rose-400" />
            </Link>
          )}
          {tempMañanaPendiente && (
            <Link href="/empleado/ops" className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 active:scale-[0.98] transition-all">
              <Thermometer size={18} className="text-orange-500 flex-shrink-0" />
              <span className="text-base font-semibold text-orange-700 flex-1">Temperatura de mañana pendiente</span>
              <ChevronRight size={16} className="text-orange-400" />
            </Link>
          )}
          {tempNochePendiente && (
            <Link href="/empleado/ops" className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 active:scale-[0.98] transition-all">
              <Thermometer size={18} className="text-orange-500 flex-shrink-0" />
              <span className="text-base font-semibold text-orange-700 flex-1">Temperatura de noche pendiente</span>
              <ChevronRight size={16} className="text-orange-400" />
            </Link>
          )}
          {limpiezasPendientes > 0 && (
            <Link href="/empleado/ops" className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 active:scale-[0.98] transition-all">
              <Sparkles size={18} className="text-amber-500 flex-shrink-0" />
              <span className="text-base font-semibold text-amber-700 flex-1">{limpiezasPendientes} limpieza{limpiezasPendientes !== 1 ? 's' : ''} pendiente{limpiezasPendientes !== 1 ? 's' : ''}</span>
              <ChevronRight size={16} className="text-amber-400" />
            </Link>
          )}
        </div>
      )}

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
        <div className={`rounded-xl px-4 py-3 mb-4 text-base ${
          geoStatus === 'ok'       ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' :
          geoStatus === 'far'      ? 'bg-rose-50 border border-rose-200 text-rose-700' :
          geoStatus === 'checking' ? 'bg-gray-50 border border-gray-200 text-gray-500' :
          'bg-amber-50 border border-amber-200 text-amber-700'
        }`}>
          <div className="flex items-start gap-3">
            <MapPin size={18} className="flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              {geoStatus === 'checking' && <span>Obteniendo ubicación...</span>}
              {geoStatus === 'ok' && <span>En el local{distancia !== null ? ` · ${distancia}m` : ''}</span>}
              {geoStatus === 'far' && (
                <>
                  <p>Estás a {distancia}m — necesitas estar a menos de {RADIO_M}m</p>
                  <button onClick={obtenerUbicacion} className="mt-1.5 text-sm font-semibold underline underline-offset-2">Reintentar</button>
                </>
              )}
              {geoStatus === 'denied' && (
                <>
                  <p className="font-medium">Ubicación denegada</p>
                  <p className="text-sm mt-1 opacity-80">En Chrome Android: toca el candado → Permisos del sitio → Ubicación → Permitir</p>
                  <button onClick={obtenerUbicacion} className="mt-2 text-sm font-semibold underline underline-offset-2">Reintentar</button>
                </>
              )}
              {geoStatus === 'error' && (
                <>
                  <p>No se pudo obtener la ubicación</p>
                  <button onClick={obtenerUbicacion} className="mt-1.5 text-sm font-semibold underline underline-offset-2">Reintentar</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Botón FICHAR ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
        {turnoAbierto && ultimoFichaje?.hora_entrada && (
          <p className="text-base text-gray-500 mb-3 text-center">
            Entrada a las <strong className="text-gray-800">{ultimoFichaje.hora_entrada.slice(0, 5)}</strong>
          </p>
        )}
        {!turnoAbierto && lista.length > 0 && (
          <p className="text-base text-gray-500 mb-3 text-center">
            {lista.filter(f => f.hora_salida).reduce((s, f) => s + (f.horas_total ?? 0), 0).toFixed(1)}h trabajadas hoy
          </p>
        )}
        <button
          onClick={fichar}
          disabled={!puedefichar || fichando}
          className={`w-full min-h-[80px] rounded-xl text-xl font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-3 ${
            puedefichar
              ? turnoAbierto
                ? 'bg-[#1A1A1A] text-white hover:bg-gray-800'
                : 'bg-[#F5B731] text-[#1A1A1A] hover:bg-[#e0a820]'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {fichando ? (
            <><RefreshCw size={22} className="animate-spin" /> Fichando...</>
          ) : turnoAbierto ? (
            <><LogOut size={24} /> FICHAR SALIDA</>
          ) : (
            <><LogIn size={24} /> FICHAR ENTRADA</>
          )}
        </button>
        {!puedefichar && geoStatus !== 'checking' && (
          <p className="text-sm text-rose-500 mt-2 flex items-center justify-center gap-1.5">
            <AlertCircle size={14} /> Debes estar en el local para fichar
          </p>
        )}
      </div>

      {/* ── Cards info ── */}
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
              <p className="text-sm text-gray-500 mt-1 leading-snug">
                {etiquetaTurno(proximoTurno)}
              </p>
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

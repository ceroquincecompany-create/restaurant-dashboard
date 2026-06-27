'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Fichaje, Turno } from '@/lib/supabase'
import { useEmpleadoActual } from '@/lib/useEmpleado'
import { useFichajeActivo } from '@/lib/useFichajeActivo'
import {
  RefreshCw, MapPin, CalendarDays, Umbrella, AlertCircle,
  Bell, Thermometer, Sparkles, ChevronRight, Package, LogIn, LogOut, Clock, XCircle, PauseCircle,
} from 'lucide-react'

function calcAvisoTurno(turno: Turno | null, fichajes: Fichaje[]): 'pronto' | 'sin_fichar' | 'salida_pronto' | null {
  if (!turno) return null
  const ahora = new Date()
  const today = ahora.toISOString().split('T')[0]
  if (turno.fecha !== today) return null
  if (!turno.hora_inicio && !turno.hora_fin) return null

  const ahoraMin = ahora.getHours() * 60 + ahora.getMinutes()
  const parseMin = (h: string) => { const [hh, mm] = h.split(':').map(Number); return hh * 60 + mm }
  const inicioMin = turno.hora_inicio ? parseMin(turno.hora_inicio) : null
  const finMin    = turno.hora_fin    ? parseMin(turno.hora_fin)    : null

  const fichajeAbierto = fichajes.find(f => f.hora_salida === null && f.hora_entrada !== null) ?? null
  const hayEntrada = !!fichajeAbierto

  // Turno empieza en <= 30 min y aún no se ha fichado
  if (!hayEntrada && inicioMin !== null && inicioMin > ahoraMin && inicioMin - ahoraMin <= 30)
    return 'pronto'

  // Turno empezó hace >= 15 min y no hay fichaje de entrada
  if (!hayEntrada && inicioMin !== null && ahoraMin >= inicioMin && ahoraMin - inicioMin >= 15)
    return 'sin_fichar'

  // Turno termina en <= 15 min y hay entrada abierta sin salida
  if (hayEntrada && finMin !== null && finMin >= ahoraMin && finMin - ahoraMin <= 15)
    return 'salida_pronto'

  return null
}

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

function etiquetaTurno(turno: Turno): string {
  const hoyISO = new Date().toISOString().split('T')[0]
  const man = new Date(); man.setDate(man.getDate() + 1)
  const manISO = man.toISOString().split('T')[0]
  const fechaD = new Date(turno.fecha + 'T12:00:00')
  const diaSemana = fechaD.toLocaleDateString('es-ES', { weekday: 'long' })
  const diaCapital = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1)
  const fechaCorta = fechaD.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })

  let prefijo: string
  if (turno.fecha === hoyISO) prefijo = 'Hoy'
  else if (turno.fecha === manISO) prefijo = `Mañana, ${diaCapital}`
  else prefijo = `${diaCapital} ${fechaCorta}`

  const hora = turno.hora_inicio
    ? `${turno.hora_inicio.slice(0, 5)} – ${turno.hora_fin?.slice(0, 5) ?? '?'}`
    : null

  return hora ? `${prefijo} · ${hora}` : prefijo
}

export default function PaginaInicio() {
  const { empleado, loading: empLoading } = useEmpleadoActual()
  const { fichajeActivo, cargando: configCargando } = useFichajeActivo()
  const [fichajesHoy, setFichajesHoy] = useState<Fichaje[] | undefined>(undefined)
  const [proximoTurno, setProximoTurno] = useState<Turno | null>(null)
  const [diasRestantes, setDiasRestantes] = useState<number | null>(null)
  const [diasTotales, setDiasTotal]       = useState(23)
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
  // Tick cada 60s para recalcular aviso turno sin refetch
  const [tick, setTick] = useState(0)
  const [companerosTurno, setCompanerosTurno] = useState<string[]>([])

  const today = new Date().toISOString().split('T')[0]

  const cargarDatos = useCallback(async () => {
    if (!empleado) return
    const añoActual = new Date().getFullYear()
    const localId = empleado.local_id ?? 1
    const ahora = new Date()
    const horaActualNum = ahora.getHours()
    const minutoActual = ahora.getMinutes()
    const horaStr = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}:00`

    // ── Bloque principal: fichajes + turno + vacaciones ──────────────────
    try {
      const [
        { data: fich, error: fichErr },
        { data: turnosProx, error: proxErr },
        { data: sols, error: solsErr },
        { data: hist, error: histErr },
      ] = await Promise.all([
        supabase
          .from('fichajes').select('*')
          .eq('empleado_id', empleado.id).eq('fecha', today)
          .order('hora_entrada', { ascending: true }),
        supabase
          .from('turnos').select('*')
          .eq('empleado_id', empleado.id)
          .gte('fecha', today)
          .order('fecha', { ascending: true })
          .order('hora_inicio', { ascending: true })
          .limit(20),
        supabase
          .from('solicitudes_vacaciones').select('dias')
          .eq('empleado_id', empleado.id).eq('estado', 'aprobada')
          .gte('fecha_inicio', `${añoActual}-01-01`),
        supabase
          .from('vacaciones_historial').select('dias_totales,dias_usados_historico')
          .eq('empleado_id', empleado.id).eq('año', añoActual)
          .maybeSingle(),
      ])
      if (fichErr) console.error('[inicio] fichajes error:', fichErr.message)
      if (proxErr) console.error('[inicio] turnos error:', proxErr.message)
      if (solsErr) console.error('[inicio] solicitudes_vacaciones error:', solsErr.message)
      if (histErr) console.error('[inicio] vacaciones_historial error:', histErr.message)

      setFichajesHoy(fich ?? [])

      // Filtrar client-side: primer turno de hoy en adelante que no haya terminado ya
      const ahoraMin = ahora.getHours() * 60 + ahora.getMinutes()
      const toMin = (h: string) => { const [hh, mm] = h.split(':').map(Number); return hh * 60 + mm }
      const proxActivo = (turnosProx ?? []).find(t => {
        if (t.fecha > today) return true          // día futuro: siempre válido
        if (!t.hora_fin) return true              // hoy sin hora_fin: incluir
        return toMin(t.hora_fin.slice(0, 5)) > ahoraMin  // hoy: solo si no ha terminado
      }) ?? null
      setProximoTurno(proxActivo)

      // Compañeros del próximo turno
      try {
        let comps: string[] = []
        if (proxActivo) {
          const { data: turnosComp } = await supabase
            .from('turnos').select('empleado_id')
            .eq('fecha', proxActivo.fecha)
            .neq('empleado_id', empleado.id)
          const empIds = [...new Set((turnosComp ?? []).map((t: any) => t.empleado_id as number))]
          if (empIds.length > 0) {
            const { data: empsNombres } = await supabase
              .from('empleados').select('nombre')
              .in('id', empIds)
            comps = (empsNombres ?? []).map((e: any) => e.nombre as string).filter(Boolean)
          }
        }
        setCompanerosTurno(comps)
      } catch {
        setCompanerosTurno([])
      }

      const totales   = hist?.dias_totales          ?? 23
      const historico = hist?.dias_usados_historico ?? 0
      const usadosApp = (sols ?? []).reduce((s, r) => s + r.dias, 0)
      setDiasTotal(totales)
      setDiasRestantes(totales - historico - usadosApp)
    } catch (err) {
      console.error('[inicio] Excepción en bloque principal:', err)
      setFichajesHoy(prev => prev ?? [])
      setProximoTurno(null)
      setCompanerosTurno([])
      setDiasRestantes(0)
    }

    // ── Badges operacionales ─────────────────────────────────────────────
    try {
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
    } catch (err) {
      console.error('[inicio] Excepción en badges operacionales:', err)
    }

    // ── Badge inventario mensual ─────────────────────────────────────────
    try {
      const finMes    = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0)
      const ultimoDia = finMes.getDate()
      const diaHoy    = ahora.getDate()
      if (diaHoy >= ultimoDia - 2) {
        const y = ahora.getFullYear()
        const m = ahora.getMonth() + 1
        const inicioMes = `${y}-${String(m).padStart(2, '0')}-01`
        const finMesISO = finMes.toISOString().split('T')[0]
        const { count } = await supabase.from('inventario_conteos')
          .select('id', { count: 'exact', head: true })
          .eq('empleado_id', empleado.id).eq('cerrado', true)
          .gte('fecha', inicioMes).lte('fecha', finMesISO)
        setInventarioPendiente((count ?? 0) === 0)
      } else {
        setInventarioPendiente(false)
      }
    } catch (err) {
      console.error('[inicio] Excepción en badge inventario:', err)
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

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000)
    return () => clearInterval(interval)
  }, [])

  // DEBE estar antes de cualquier return condicional (reglas de hooks)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const avisoTurno = useMemo(() => calcAvisoTurno(proximoTurno, fichajesHoy ?? []), [proximoTurno, fichajesHoy, tick])

  const minutosTranscurridos = useMemo(() => {
    const lista = fichajesHoy ?? []
    const ultimo = lista[lista.length - 1] ?? null
    if (!ultimo || ultimo.hora_salida !== null || !ultimo.hora_entrada) return 0
    const [h, m] = ultimo.hora_entrada.split(':').map(Number)
    const entradaMin = h * 60 + m
    const ahoraMin = new Date().getHours() * 60 + new Date().getMinutes()
    let diff = ahoraMin - entradaMin
    if (diff < 0) diff += 24 * 60
    return diff
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fichajesHoy, tick])

  const horasTranscurridas = minutosTranscurridos / 60
  const avisarSalida = horasTranscurridas >= 6

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

  // Spinner mientras el hook resuelve
  if (empLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="animate-spin text-[#F5B731]" size={24} />
      </div>
    )
  }

  // Hook resuelto pero sin perfil vinculado → mensaje amigable en lugar de spinner infinito
  if (!empleado) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-6 text-center gap-4">
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
          <AlertCircle size={28} className="text-amber-500" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-800">Perfil no encontrado</h2>
          <p className="text-sm text-gray-500 mt-2 max-w-xs leading-relaxed">
            No encontramos tu perfil de empleado. Contacta con tu administrador para que vincule tu cuenta de acceso al sistema.
          </p>
        </div>
      </div>
    )
  }

  // Spinner mientras se cargan los datos del empleado
  if (fichajesHoy === undefined) {
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

      {/* ── Avisos de turno ── */}
      {avisoTurno === 'sin_fichar' && (
        <div className="flex items-center gap-3 mb-4 bg-rose-50 border border-rose-300 rounded-xl px-4 py-3">
          <XCircle size={20} className="text-rose-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-rose-800">Tienes un turno activo sin fichar</p>
            <p className="text-xs text-rose-600 mt-0.5">Recuerda registrar tu entrada lo antes posible</p>
          </div>
        </div>
      )}
      {avisoTurno === 'pronto' && (
        <div className="flex items-center gap-3 mb-4 bg-[#F5B731]/10 border border-[#F5B731]/50 rounded-xl px-4 py-3">
          <Clock size={20} className="text-[#F5B731] flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-[#1A1A1A]">Tu turno empieza pronto</p>
            <p className="text-xs text-gray-600 mt-0.5">Recuerda fichar tu entrada cuando llegues al local</p>
          </div>
        </div>
      )}
      {avisoTurno === 'salida_pronto' && (
        <div className="flex items-center gap-3 mb-4 bg-orange-50 border border-orange-300 rounded-xl px-4 py-3">
          <LogOut size={20} className="text-orange-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-orange-800">Recuerda fichar la salida</p>
            <p className="text-xs text-orange-600 mt-0.5">Tu turno termina en menos de 15 minutos</p>
          </div>
        </div>
      )}
      {avisarSalida && turnoAbierto && avisoTurno !== 'salida_pronto' && (
        <div className="flex items-center gap-3 mb-4 bg-[#F5B731]/15 border-2 border-[#F5B731] rounded-xl px-4 py-3">
          <Clock size={20} className="text-[#F5B731] flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-[#1A1A1A]">
              Llevas {horasTranscurridas.toFixed(1).replace('.0', '')} horas fichado
            </p>
            <p className="text-xs text-gray-600 mt-0.5">Recuerda fichar la salida cuando termines</p>
          </div>
        </div>
      )}

      {/* ── Banners de alertas operacionales ── */}
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

      {/* ── Botón FICHAR (o mensaje desactivado) ── */}
      {fichajeActivo === false && !configCargando ? (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 mb-4 text-center">
          <PauseCircle size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm font-semibold text-gray-500">El registro de jornada está temporalmente desactivado</p>
          <p className="text-xs text-gray-400 mt-1">Contacta con tu encargado para más información</p>
        </div>
      ) : (
      <div className={`bg-white rounded-2xl p-5 mb-4 ${
        turnoAbierto
          ? 'border-2 border-[#1A1A1A] shadow-lg'
          : 'border border-gray-200'
      }`}>
        {turnoAbierto && ultimoFichaje?.hora_entrada && (
          <div className="mb-3 text-center">
            <p className="text-base text-gray-500">
              Entrada a las <strong className="text-gray-800">{ultimoFichaje.hora_entrada.slice(0, 5)}</strong>
            </p>
            {horasTranscurridas >= 1 && (
              <p className="text-xs text-gray-400 mt-0.5">
                {horasTranscurridas.toFixed(1)}h en curso
              </p>
            )}
          </div>
        )}
        {!turnoAbierto && lista.length > 0 && (
          <p className="text-base text-gray-500 mb-3 text-center">
            {lista.filter(f => f.hora_salida).reduce((s, f) => s + (f.horas_total ?? 0), 0).toFixed(1)}h trabajadas hoy
          </p>
        )}
        <button
          onClick={fichar}
          disabled={!puedefichar || fichando}
          className={`w-full rounded-xl text-xl font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-3 ${
            turnoAbierto ? 'min-h-[96px]' : 'min-h-[80px]'
          } ${
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
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-3">
                <LogOut size={28} /> <span className="text-2xl">FICHAR SALIDA</span>
              </div>
              {avisarSalida && (
                <span className="text-sm font-medium text-white/70">
                  {Math.floor(horasTranscurridas)}h {Math.round((horasTranscurridas % 1) * 60)}min fichado
                </span>
              )}
            </div>
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
      )}

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
              <p className="text-sm text-gray-500 mt-1 leading-snug">{etiquetaTurno(proximoTurno)}</p>
              {companerosTurno.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-[10px] text-gray-400 mb-1.5">Compañeros</p>
                  <div className="flex items-center gap-1">
                    {companerosTurno.slice(0, 4).map((nombre, i) => (
                      <div key={i} title={nombre}
                        className="w-6 h-6 rounded-full bg-[#F5B731]/20 border border-[#F5B731]/40 flex items-center justify-center text-[9px] font-bold text-[#1A1A1A]">
                        {nombre.trim().charAt(0).toUpperCase()}
                      </div>
                    ))}
                    {companerosTurno.length > 4 && (
                      <span className="text-[10px] text-gray-400 ml-0.5">+{companerosTurno.length - 4}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-base text-gray-400">Sin turnos asignados</p>
          )}
        </div>

        {/* Vacaciones */}
        <Link href="/empleado/vacaciones" className="bg-white rounded-xl border border-gray-200 p-4 active:scale-[0.97] transition-all block">
          <div className="flex items-center gap-2 mb-3">
            <Umbrella size={16} className="text-[#F5B731]" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Vacaciones</p>
          </div>
          {diasRestantes !== null ? (
            <div>
              <p className="text-3xl font-bold text-gray-900">{diasRestantes}</p>
              <p className="text-sm text-gray-400 mt-1">días disponibles</p>
              <p className="text-sm text-gray-300 mt-0.5">{diasTotales - diasRestantes} de {diasTotales} usados</p>
            </div>
          ) : (
            <p className="text-base text-gray-400">Sin datos</p>
          )}
        </Link>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { SolicitudVacaciones } from '@/lib/supabase'
import {
  RefreshCw, Check, X, Clock, ChevronLeft, ChevronRight,
  Umbrella, PenLine, CheckCheck, CalendarDays, List,
} from 'lucide-react'

type Emp = { id: number; nombre: string; puesto: string }
type SolicitudConEmp = SolicitudVacaciones & { empleados: Emp | null }

const PALETTE = [
  'bg-blue-200 text-blue-900',
  'bg-emerald-200 text-emerald-900',
  'bg-violet-200 text-violet-900',
  'bg-rose-200 text-rose-900',
  'bg-amber-200 text-amber-900',
  'bg-cyan-200 text-cyan-900',
  'bg-orange-200 text-orange-900',
  'bg-fuchsia-200 text-fuchsia-900',
]
function empColor(id: number) { return PALETTE[id % PALETTE.length] }

function fmtFecha(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
}
function fmtFechaCorta(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}
function fmtCreatedAt(s: string) {
  return new Date(s).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fechasEnRango(inicio: string, fin: string): string[] {
  const dates: string[] = []
  const d = new Date(inicio + 'T12:00:00')
  const end = new Date(fin + 'T12:00:00')
  while (d <= end) { dates.push(d.toISOString().split('T')[0]); d.setDate(d.getDate() + 1) }
  return dates
}

function textoDocumento(sol: SolicitudConEmp): string {
  const nombre = sol.empleados?.nombre ?? 'El/la trabajador/a'
  return `El presente documento certifica que las vacaciones del trabajador/a han sido formalmente solicitadas, revisadas y aprobadas por la empresa.

DATOS DEL PERIODO VACACIONAL:
· Trabajador/a: ${nombre}
· Fecha de inicio: ${fmtFecha(sol.fecha_inicio)}
· Fecha de fin: ${fmtFecha(sol.fecha_fin)}
· Total días laborables: ${sol.dias} días
· Año fiscal: ${new Date(sol.fecha_inicio).getFullYear()}

El/la trabajador/a declara haber sido informado/a de la aprobación de las vacaciones solicitadas y acepta expresamente las fechas indicadas.

Al firmar este documento, el/la trabajador/a manifiesta su plena conformidad con el periodo vacacional aprobado, quedando constancia fehaciente de ello a todos los efectos legales y ante posibles inspecciones de trabajo (ET art. 38, RD 2001/1983).`
}

// ── CalendarioEquipo ─────────────────────────────────────────────
function CalendarioEquipo({
  año, mes, solicitudesAprobadas,
}: {
  año: number
  mes: number
  solicitudesAprobadas: SolicitudConEmp[]
}) {
  const primerDia = new Date(año, mes - 1, 1)
  const ultimoNum = new Date(año, mes, 0).getDate()
  const offset = (primerDia.getDay() + 6) % 7
  const celdas = [...Array(offset).fill(null), ...Array.from({ length: ultimoNum }, (_, i) => i + 1)]
  const hoy = new Date()

  const diasMap = useMemo(() => {
    const map = new Map<string, SolicitudConEmp[]>()
    solicitudesAprobadas.forEach(s => {
      fechasEnRango(s.fecha_inicio, s.fecha_fin).forEach(d => {
        if (!map.has(d)) map.set(d, [])
        map.get(d)!.push(s)
      })
    })
    return map
  }, [solicitudesAprobadas])

  // unique employees in this month
  const empsEnMes = useMemo(() => {
    const seen = new Map<number, string>()
    Array.from(diasMap.entries()).forEach(([k, sols]) => {
      if (k.startsWith(`${año}-${String(mes).padStart(2, '0')}`))
        sols.forEach(s => { if (s.empleados) seen.set(s.empleados.id, s.empleados.nombre) })
    })
    return Array.from(seen.entries()).map(([id, nombre]) => ({ id, nombre }))
  }, [diasMap, año, mes])

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {celdas.map((d, i) => {
          if (d === null) return <div key={i} />
          const iso = `${año}-${String(mes).padStart(2,'0')}-${String(d).padStart(2,'0')}`
          const enVac = diasMap.get(iso) ?? []
          const esHoy = d === hoy.getDate() && mes === hoy.getMonth() + 1 && año === hoy.getFullYear()
          const esFinDeSemana = new Date(iso + 'T12:00:00').getDay() === 0 || new Date(iso + 'T12:00:00').getDay() === 6
          return (
            <div key={i} className={`min-h-[52px] rounded-lg p-1 ${esHoy ? 'ring-2 ring-[#F5B731]' : ''} ${esFinDeSemana ? 'bg-gray-50' : 'bg-white border border-gray-100'}`}>
              <p className={`text-xs mb-1 text-center font-medium ${esHoy ? 'text-[#F5B731]' : esFinDeSemana ? 'text-gray-300' : 'text-gray-600'}`}>{d}</p>
              <div className="flex flex-wrap gap-0.5 justify-center">
                {enVac.map(s => (
                  <span key={s.id} title={s.empleados?.nombre} className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold ${empColor(s.empleados?.id ?? 0)}`}>
                    {(s.empleados?.nombre ?? '?').charAt(0).toUpperCase()}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      {empsEnMes.length > 0 && (
        <div className="flex flex-wrap gap-3 mt-4">
          {empsEnMes.map(e => (
            <span key={e.id} className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${empColor(e.id)}`}>
              <span className="w-4 h-4 rounded-full bg-white/60 flex items-center justify-center text-[9px] font-bold">
                {e.nombre.charAt(0).toUpperCase()}
              </span>
              {e.nombre}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────
export default function VacacionesAdmin() {
  const [solicitudes, setSolicitudes] = useState<SolicitudConEmp[]>([])
  const [firmadasIds, setFirmadasIds] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'pendientes' | 'historial' | 'calendario'>('pendientes')
  const [procesando, setProcesando] = useState<Record<number, boolean>>({})
  const [mesCal, setMesCal] = useState(new Date().getMonth() + 1)
  const [añoCal, setAñoCal] = useState(new Date().getFullYear())

  const cargar = useCallback(async () => {
    const { data: sols } = await supabase
      .from('solicitudes_vacaciones')
      .select('*, empleados(id, nombre, puesto)')
      .order('created_at', { ascending: false })

    const lista = (sols ?? []) as SolicitudConEmp[]

    const docIds = lista.filter(s => s.documento_firma_id).map(s => s.documento_firma_id!)
    let fSet = new Set<number>()
    if (docIds.length > 0) {
      const { data: firmasData } = await supabase
        .from('firmas')
        .select('documento_id')
        .in('documento_id', docIds)
        .eq('firmado', true)
      fSet = new Set((firmasData ?? []).map((f: any) => f.documento_id as number))
    }

    setSolicitudes(lista)
    setFirmadasIds(fSet)
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  function estadoBadge(s: SolicitudConEmp) {
    if (s.estado === 'pendiente') return { label: 'Pendiente', cls: 'bg-amber-100 text-amber-700', Icon: Clock }
    if (s.estado === 'rechazada') return { label: 'Rechazada', cls: 'bg-rose-100 text-rose-700', Icon: X }
    if (!s.documento_firma_id) return { label: 'Aprobada', cls: 'bg-emerald-100 text-emerald-700', Icon: Check }
    if (firmadasIds.has(s.documento_firma_id)) return { label: 'Aprobada y firmada', cls: 'bg-emerald-200 text-emerald-800', Icon: CheckCheck }
    return { label: 'Pendiente de firma', cls: 'bg-blue-100 text-blue-700', Icon: PenLine }
  }

  async function aprobar(sol: SolicitudConEmp) {
    setProcesando(p => ({ ...p, [sol.id]: true }))

    const titulo = `Aceptación de vacaciones — ${fmtFechaCorta(sol.fecha_inicio)} al ${fmtFechaCorta(sol.fecha_fin)}`

    const { data: docData, error: docErr } = await supabase
      .from('documentos_firma')
      .insert({
        tipo: 'Vacaciones',
        titulo,
        texto: textoDocumento(sol),
        empleado_id: sol.empleados?.id ?? sol.empleado_id,
        fecha_limite: sol.fecha_inicio,
      })
      .select('id')
      .single()

    if (docErr || !docData) {
      console.error('Error creando documento firma:', docErr)
      setProcesando(p => { const n = { ...p }; delete n[sol.id]; return n })
      return
    }

    await supabase
      .from('solicitudes_vacaciones')
      .update({ estado: 'aprobada', documento_firma_id: docData.id })
      .eq('id', sol.id)

    setProcesando(p => { const n = { ...p }; delete n[sol.id]; return n })
    cargar()
  }

  async function rechazar(sol: SolicitudConEmp) {
    setProcesando(p => ({ ...p, [sol.id]: true }))
    await supabase.from('solicitudes_vacaciones').update({ estado: 'rechazada' }).eq('id', sol.id)
    setProcesando(p => { const n = { ...p }; delete n[sol.id]; return n })
    cargar()
  }

  const pendientes = solicitudes.filter(s => s.estado === 'pendiente')
  const historial = solicitudes.filter(s => s.estado !== 'pendiente')
  const aprobadas = solicitudes.filter(s => s.estado === 'aprobada')

  const diasHoyEnVac = useMemo(() => {
    const hoy = new Date().toISOString().split('T')[0]
    return aprobadas.filter(s => s.fecha_inicio <= hoy && hoy <= s.fecha_fin)
  }, [aprobadas])

  const mesAnterior = () => { if (mesCal === 1) { setMesCal(12); setAñoCal(y => y - 1) } else setMesCal(m => m - 1) }
  const mesSiguiente = () => { if (mesCal === 12) { setMesCal(1); setAñoCal(y => y + 1) } else setMesCal(m => m + 1) }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><RefreshCw className="animate-spin text-[#F5B731]" size={22} /></div>

  return (
    <div className="p-6 max-w-5xl">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Gestión de Vacaciones</h1>
        <p className="text-sm text-gray-400 mt-0.5">Solicitudes del equipo · aprobación y firma legal</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-2xl font-bold text-amber-500">{pendientes.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">Pendientes de revisar</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-2xl font-bold text-emerald-600">{aprobadas.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">Vacaciones aprobadas</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-2xl font-bold text-blue-600">
            {aprobadas.filter(s => s.documento_firma_id && !firmadasIds.has(s.documento_firma_id!)).length}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Pendientes de firma</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-2xl font-bold text-violet-600">{diasHoyEnVac.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">Empleados hoy de vacaciones</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-xl w-fit">
        {([
          { key: 'pendientes', label: `Pendientes${pendientes.length > 0 ? ` (${pendientes.length})` : ''}`, Icon: Clock },
          { key: 'historial', label: 'Historial', Icon: List },
          { key: 'calendario', label: 'Calendario', Icon: CalendarDays },
        ] as const).map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* TAB: Pendientes */}
      {tab === 'pendientes' && (
        <div>
          {pendientes.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Umbrella size={32} className="mx-auto text-gray-200 mb-3" />
              <p className="text-sm text-gray-400">No hay solicitudes pendientes</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendientes.map(s => (
                <SolicitudCard
                  key={s.id}
                  sol={s}
                  badge={estadoBadge(s)}
                  procesando={!!procesando[s.id]}
                  onAprobar={() => aprobar(s)}
                  onRechazar={() => rechazar(s)}
                  showAcciones
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: Historial */}
      {tab === 'historial' && (
        <div>
          {historial.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <p className="text-sm text-gray-400">Sin historial todavía</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Empleado</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Periodo</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Días</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Estado</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Solicitado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {historial.map(s => {
                    const badge = estadoBadge(s)
                    const BadgeIcon = badge.Icon
                    return (
                      <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${empColor(s.empleado_id)}`}>
                              {(s.empleados?.nombre ?? '?').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-gray-800">{s.empleados?.nombre ?? '—'}</p>
                              <p className="text-xs text-gray-400">{s.empleados?.puesto ?? ''}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {fmtFechaCorta(s.fecha_inicio)} → {fmtFechaCorta(s.fecha_fin)}
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-gray-700">{s.dias}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${badge.cls}`}>
                            <BadgeIcon size={11} /> {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">{fmtCreatedAt(s.created_at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB: Calendario */}
      {tab === 'calendario' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-5">
            <button onClick={mesAnterior} className="p-2 rounded-lg hover:bg-gray-100 transition-colors"><ChevronLeft size={16} /></button>
            <p className="text-base font-semibold text-gray-800 capitalize">
              {new Date(añoCal, mesCal - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
            </p>
            <button onClick={mesSiguiente} className="p-2 rounded-lg hover:bg-gray-100 transition-colors"><ChevronRight size={16} /></button>
          </div>
          {aprobadas.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">No hay vacaciones aprobadas todavía</div>
          ) : (
            <CalendarioEquipo año={añoCal} mes={mesCal} solicitudesAprobadas={aprobadas} />
          )}
        </div>
      )}
    </div>
  )
}

// ── Tarjeta de solicitud pendiente ────────────────────────────────
function SolicitudCard({
  sol, badge, procesando, onAprobar, onRechazar, showAcciones,
}: {
  sol: SolicitudConEmp
  badge: { label: string; cls: string; Icon: React.ElementType }
  procesando: boolean
  onAprobar: () => void
  onRechazar: () => void
  showAcciones: boolean
}) {
  const { Icon } = badge
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${empColor(sol.empleado_id)}`}>
            {(sol.empleados?.nombre ?? '?').charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{sol.empleados?.nombre ?? 'Empleado'}</p>
            <p className="text-xs text-gray-400">{sol.empleados?.puesto ?? ''}</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${badge.cls}`}>
          <Icon size={11} /> {badge.label}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-400 mb-0.5">Fecha inicio</p>
          <p className="text-sm font-semibold text-gray-800">{fmtFechaCorta(sol.fecha_inicio)}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-400 mb-0.5">Fecha fin</p>
          <p className="text-sm font-semibold text-gray-800">{fmtFechaCorta(sol.fecha_fin)}</p>
        </div>
        <div className="bg-[#F5B731]/10 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-400 mb-0.5">Días laborables</p>
          <p className="text-sm font-bold text-gray-900">{sol.dias}</p>
        </div>
      </div>

      {sol.notas && (
        <p className="mt-3 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
          <span className="font-medium">Nota:</span> {sol.notas}
        </p>
      )}

      {showAcciones && (
        <div className="flex gap-2 mt-4">
          <button
            onClick={onRechazar}
            disabled={procesando}
            className="flex-1 py-2.5 text-sm font-semibold border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <X size={14} className="inline mr-1" /> Rechazar
          </button>
          <button
            onClick={onAprobar}
            disabled={procesando}
            className="flex-1 py-2.5 text-sm font-bold bg-[#F5B731] text-[#1A1A1A] rounded-xl hover:bg-[#e0a820] transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {procesando ? (
              <><RefreshCw size={14} className="animate-spin" /> Procesando...</>
            ) : (
              <><Check size={14} /> Aprobar y generar firma</>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { SolicitudVacaciones } from '@/lib/supabase'
import { useEmpleadoActual } from '@/lib/useEmpleado'
import {
  RefreshCw, Plus, X, Umbrella, ChevronLeft, ChevronRight,
  Clock, Check, CheckCheck, PenLine, AlertCircle,
} from 'lucide-react'


function diasLaborables(inicio: string, fin: string): number {
  let count = 0
  const d = new Date(inicio + 'T12:00:00')
  const end = new Date(fin + 'T12:00:00')
  while (d <= end) {
    if (d.getDay() !== 0 && d.getDay() !== 6) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

function fechasEnRango(inicio: string, fin: string): string[] {
  const dates: string[] = []
  const d = new Date(inicio + 'T12:00:00')
  const end = new Date(fin + 'T12:00:00')
  while (d <= end) { dates.push(d.toISOString().split('T')[0]); d.setDate(d.getDate() + 1) }
  return dates
}

function fmtFechaCorta(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

type EstadoFirma = 'pendiente' | 'aprobada_sin_firma' | 'pendiente_firma' | 'firmada' | 'rechazada'

function estadoFirma(s: SolicitudVacaciones, firmadasSet: Set<number>): EstadoFirma {
  if (s.estado === 'rechazada') return 'rechazada'
  if (s.estado === 'pendiente') return 'pendiente'
  if (!s.documento_firma_id) return 'aprobada_sin_firma'
  if (firmadasSet.has(s.documento_firma_id)) return 'firmada'
  return 'pendiente_firma'
}

const ESTADO_CFG: Record<EstadoFirma, { label: string; cls: string; Icon: React.ElementType }> = {
  pendiente:          { label: 'Pendiente',          cls: 'bg-amber-100 text-amber-700',   Icon: Clock },
  aprobada_sin_firma: { label: 'Aprobada',            cls: 'bg-emerald-100 text-emerald-700', Icon: Check },
  pendiente_firma:    { label: 'Firmar documento',   cls: 'bg-blue-100 text-blue-700',     Icon: PenLine },
  firmada:            { label: 'Aprobada y firmada', cls: 'bg-emerald-200 text-emerald-800', Icon: CheckCheck },
  rechazada:          { label: 'Rechazada',           cls: 'bg-rose-100 text-rose-700',     Icon: X },
}

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white'

function CalendarioMes({ año, mes, diasVac }: { año: number; mes: number; diasVac: Set<string> }) {
  const primerDia = new Date(año, mes - 1, 1)
  const ultimoNum = new Date(año, mes, 0).getDate()
  const offset = (primerDia.getDay() + 6) % 7
  const celdas = [...Array(offset).fill(null), ...Array.from({ length: ultimoNum }, (_, i) => i + 1)]
  const hoy = new Date()
  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['L','M','X','J','V','S','D'].map(d => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {celdas.map((d, i) => {
          if (d === null) return <div key={i} />
          const iso = `${año}-${String(mes).padStart(2,'0')}-${String(d).padStart(2,'0')}`
          const esVac = diasVac.has(iso)
          const esHoy = d === hoy.getDate() && mes === hoy.getMonth() + 1 && año === hoy.getFullYear()
          return (
            <div key={i} className={`aspect-square flex items-center justify-center rounded-lg text-xs font-medium ${
              esVac  ? 'bg-[#F5B731] text-[#1A1A1A] font-bold' :
              esHoy  ? 'bg-[#1A1A1A] text-white font-bold' :
              'text-gray-600'
            }`}>
              {d}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function PaginaVacaciones() {
  const { empleado, loading: empLoading } = useEmpleadoActual()
  const [solicitudes, setSolicitudes] = useState<SolicitudVacaciones[]>([])
  const [firmadasSet, setFirmadasSet] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ fecha_inicio: '', fecha_fin: '', notas: '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [mesCal, setMesCal] = useState(() => new Date().getMonth() + 1)
  const [añoCal, setAñoCal] = useState(() => new Date().getFullYear())
  const [historial, setHistorial] = useState<{ dias_totales: number; dias_usados_historico: number } | null>(null)

  const cargar = useCallback(async () => {
    if (!empleado) return
    const añoActualFetch = new Date().getFullYear()
    const [{ data: sols }, { data: hist }] = await Promise.all([
      supabase
        .from('solicitudes_vacaciones')
        .select('*')
        .eq('empleado_id', empleado.id)
        .order('fecha_inicio', { ascending: false }),
      supabase
        .from('vacaciones_historial')
        .select('dias_totales, dias_usados_historico')
        .eq('empleado_id', empleado.id)
        .eq('año', añoActualFetch)
        .maybeSingle(),
    ])

    const lista = (sols ?? []) as SolicitudVacaciones[]

    const docIds = lista.filter(s => s.documento_firma_id).map(s => s.documento_firma_id!)
    let fSet = new Set<number>()
    if (docIds.length > 0) {
      const { data: firmasData } = await supabase
        .from('firmas')
        .select('documento_id')
        .in('documento_id', docIds)
        .eq('empleado_id', empleado.id)
        .eq('firmado', true)
      fSet = new Set((firmasData ?? []).map((f: any) => f.documento_id as number))
    }

    setSolicitudes(lista)
    setFirmadasSet(fSet)
    setHistorial(hist ? { dias_totales: hist.dias_totales, dias_usados_historico: hist.dias_usados_historico } : null)
    setLoading(false)
  }, [empleado])

  useEffect(() => {
    if (empLoading) return
    if (empleado) cargar()
    else setLoading(false)
  }, [empLoading, empleado, cargar])

  const añoActual = new Date().getFullYear()
  const diasTotales = historial?.dias_totales ?? 23
  const diasUsadosHistorico = historial?.dias_usados_historico ?? 0
  const aprobadas = solicitudes.filter(s => s.estado === 'aprobada' && s.fecha_inicio.startsWith(String(añoActual)))
  const diasUsadosApp = aprobadas.reduce((s, r) => s + r.dias, 0)
  const diasUsados = diasUsadosHistorico + diasUsadosApp
  const diasRestantes = diasTotales - diasUsados

  const diasVac = useMemo(() => {
    const set = new Set<string>()
    aprobadas.forEach(s => fechasEnRango(s.fecha_inicio, s.fecha_fin).forEach(d => set.add(d)))
    return set
  }, [aprobadas])

  const pendientesDeFirma = useMemo(
    () => solicitudes.filter(s => s.estado === 'aprobada' && s.documento_firma_id && !firmadasSet.has(s.documento_firma_id!)).length,
    [solicitudes, firmadasSet]
  )

  const diasSolicitud = form.fecha_inicio && form.fecha_fin ? diasLaborables(form.fecha_inicio, form.fecha_fin) : 0

  async function solicitar() {
    if (!empleado) return
    if (!form.fecha_inicio || !form.fecha_fin) { setError('Selecciona las fechas'); return }
    if (diasSolicitud <= 0) { setError('Rango de fechas no válido'); return }
    if (diasSolicitud > diasRestantes) { setError(`Solo tienes ${diasRestantes} días disponibles este año`); return }
    setGuardando(true)
    setError('')
    const { error: err } = await supabase.from('solicitudes_vacaciones').insert({
      empleado_id: empleado.id,
      fecha_inicio: form.fecha_inicio,
      fecha_fin: form.fecha_fin,
      dias: diasSolicitud,
      notas: form.notas.trim() || null,
    })
    if (err) { setError(err.message); setGuardando(false); return }
    setGuardando(false)
    setModal(false)
    setForm({ fecha_inicio: '', fecha_fin: '', notas: '' })
    cargar()
  }

  const mesAnterior  = () => { if (mesCal === 1) { setMesCal(12); setAñoCal(y => y - 1) } else setMesCal(m => m - 1) }
  const mesSiguiente = () => { if (mesCal === 12) { setMesCal(1); setAñoCal(y => y + 1) } else setMesCal(m => m + 1) }

  if (empLoading || loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <RefreshCw className="animate-spin text-[#F5B731]" size={24} />
    </div>
  )

  return (
    <div className="px-4 py-5 max-w-2xl">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Vacaciones</h1>
          <p className="text-sm text-gray-400 mt-0.5">Año {añoActual}</p>
        </div>
        <button
          onClick={() => setModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#F5B731] text-[#1A1A1A] text-sm font-semibold rounded-xl hover:bg-[#e0a820] transition-colors"
        >
          <Plus size={15} /> Solicitar
        </button>
      </div>

      {/* Banner firma pendiente */}
      {pendientesDeFirma > 0 && (
        <Link
          href="/empleado/firmas"
          className="flex items-center gap-3 mb-5 px-4 py-3.5 bg-blue-50 border border-blue-200 rounded-2xl active:scale-[0.98] transition-all"
        >
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <PenLine size={18} className="text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-blue-900">
              {pendientesDeFirma === 1 ? '1 vacación pendiente de firma' : `${pendientesDeFirma} vacaciones pendientes de firma`}
            </p>
            <p className="text-xs text-blue-600 mt-0.5">Toca para firmar el documento de aceptación</p>
          </div>
          <AlertCircle size={18} className="text-blue-400 flex-shrink-0" />
        </Link>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{diasTotales}</p>
          <p className="text-xs text-gray-400 mt-0.5">Asignados</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{diasUsados}</p>
          <p className="text-xs text-gray-400 mt-0.5">Usados</p>
        </div>
        <div className={`rounded-xl border p-4 text-center ${diasRestantes > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
          <p className={`text-2xl font-bold ${diasRestantes > 0 ? 'text-emerald-700' : 'text-gray-400'}`}>{diasRestantes}</p>
          <p className={`text-xs mt-0.5 ${diasRestantes > 0 ? 'text-emerald-500' : 'text-gray-400'}`}>Restantes</p>
        </div>
      </div>

      {/* Calendario */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <button onClick={mesAnterior} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"><ChevronLeft size={16} /></button>
          <p className="text-sm font-semibold text-gray-800 capitalize">
            {new Date(añoCal, mesCal - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
          </p>
          <button onClick={mesSiguiente} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"><ChevronRight size={16} /></button>
        </div>
        <CalendarioMes año={añoCal} mes={mesCal} diasVac={diasVac} />
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#F5B731]" /> Aprobadas</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#1A1A1A]" /> Hoy</span>
        </div>
      </div>

      {/* Solicitudes */}
      <div className="space-y-3">
        {solicitudes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
            <Umbrella size={32} className="mx-auto text-gray-200 mb-2" />
            <p className="text-sm text-gray-400">Sin solicitudes todavía</p>
          </div>
        ) : (
          solicitudes.map(s => {
            const ef = estadoFirma(s, firmadasSet)
            const cfg = ESTADO_CFG[ef]
            const StatusIcon = cfg.Icon
            const esPendienteFirma = ef === 'pendiente_firma'
            return (
              <div key={s.id} className={`bg-white rounded-2xl border p-4 ${esPendienteFirma ? 'border-blue-200' : 'border-gray-200'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.cls}`}>
                        <StatusIcon size={10} /> {cfg.label}
                      </span>
                      <span className="text-sm font-medium text-gray-700">
                        {fmtFechaCorta(s.fecha_inicio)} → {fmtFechaCorta(s.fecha_fin)}
                      </span>
                    </div>
                    {s.notas && <p className="text-xs text-gray-400 mt-1.5">{s.notas}</p>}
                    {ef === 'firmada' && (
                      <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1">
                        <CheckCheck size={11} /> Firmado — válido como justificante legal
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-gray-900">{s.dias}</p>
                    <p className="text-xs text-gray-400">días</p>
                  </div>
                </div>

                {esPendienteFirma && (
                  <Link
                    href="/empleado/firmas"
                    className="mt-3 flex items-center justify-center gap-2 w-full py-2.5 bg-[#F5B731] text-[#1A1A1A] text-sm font-bold rounded-xl active:scale-[0.98] transition-all"
                  >
                    <PenLine size={14} /> Firmar documento de aceptación
                  </Link>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Modal solicitar */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">Solicitar vacaciones</h2>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Fecha inicio</label>
                  <input
                    type="date"
                    className={inputCls}
                    value={form.fecha_inicio}
                    onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Fecha fin</label>
                  <input
                    type="date"
                    className={inputCls}
                    value={form.fecha_fin}
                    onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value }))}
                    min={form.fecha_inicio}
                  />
                </div>
              </div>

              {diasSolicitud > 0 && (
                <div className="bg-[#F5B731]/10 rounded-xl px-4 py-2.5 text-center">
                  <p className="text-sm font-semibold text-gray-800">{diasSolicitud} días laborables</p>
                  <p className="text-xs text-gray-500">Te quedarán {diasRestantes - diasSolicitud} días restantes</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Notas (opcional)</label>
                <input
                  className={inputCls}
                  value={form.notas}
                  onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                  placeholder="Motivo u observaciones..."
                />
              </div>

              {error && <p className="text-xs text-rose-500">{error}</p>}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={solicitar}
                  disabled={guardando}
                  className="px-4 py-2 text-sm font-semibold bg-[#F5B731] text-[#1A1A1A] rounded-xl hover:bg-[#e0a820] transition-colors disabled:opacity-50"
                >
                  {guardando ? 'Enviando...' : 'Enviar solicitud'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useMemo, useCallback, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Empleado, Turno, Fichaje } from '@/lib/supabase'
import {
  CalendarDays, ClipboardList, UserCheck,
  ChevronLeft, ChevronRight, Plus, X, Trash2, RefreshCw, Copy, Undo2,
  Pencil, Download, List, LayoutGrid,
  CheckCircle2, XCircle, Clock, Users, AlertTriangle,
} from 'lucide-react'

// ─────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white'

function Modal({ titulo, onCerrar, maxW = 'max-w-sm', children }: {
  titulo: string; onCerrar: () => void; maxW?: string; children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={`bg-white rounded-xl shadow-xl w-full ${maxW} max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-sm font-semibold text-gray-800">{titulo}</h2>
          <button onClick={onCerrar} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// ── TAB: TURNOS ──────────────────────────────
// ─────────────────────────────────────────────

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const TIPOS_TURNO = ['Mediodía', 'Noche', 'Medio mediodía', 'Vacaciones', 'Baja']
const TURNO_STYLE: Record<string, { bg: string; text: string; abbr: string }> = {
  'Mediodía':       { bg: '#F5B731', text: '#1A1A1A', abbr: 'MD' },
  'Noche':          { bg: '#2563EB', text: '#fff',    abbr: 'NO' },
  'Medio mediodía': { bg: '#EC4899', text: '#fff',    abbr: 'MM' },
  'Vacaciones':     { bg: '#16A34A', text: '#fff',    abbr: 'VAC' },
  'Baja':           { bg: '#6B7280', text: '#fff',    abbr: 'BAJA' },
}

function inicioSemana(d: Date): Date {
  const dd = new Date(d); dd.setHours(0, 0, 0, 0)
  const dia = dd.getDay()
  dd.setDate(dd.getDate() - (dia === 0 ? 6 : dia - 1))
  return dd
}
function sumarDias(d: Date, n: number): Date {
  const dd = new Date(d); dd.setDate(dd.getDate() + n); return dd
}
function toISO(d: Date): string { return d.toISOString().split('T')[0] }
function calcHorasTurno(ini: string | null, fin: string | null): number {
  if (!ini || !fin) return 0
  const [h1, m1] = ini.split(':').map(Number)
  const [h2, m2] = fin.split(':').map(Number)
  let t = (h2 * 60 + m2) - (h1 * 60 + m1)
  if (t < 0) t += 24 * 60
  return t / 60
}
function formatDia(d: Date): string {
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

type UndoAntes = { tipo_turno: string; hora_inicio: string | null; hora_fin: string | null; notas: string | null }
type AccionDeshacer =
  | { tipo: 'crear';         turno: Turno;             desc: string }
  | { tipo: 'eliminar';      turno: Turno;             desc: string }
  | { tipo: 'editar';        id: number; antes: UndoAntes; desc: string }
  | { tipo: 'copiar_semana'; ids: number[];             desc: string }

const UNDO_KEY = 'sofi_turnos_historial'
const MAX_HISTORIAL = 10
function cargarHistorial(): AccionDeshacer[] {
  try { return JSON.parse(localStorage.getItem(UNDO_KEY) ?? '[]') } catch { return [] }
}
function guardarHistorial(h: AccionDeshacer[]) {
  localStorage.setItem(UNDO_KEY, JSON.stringify(h.slice(0, MAX_HISTORIAL)))
}

type FormTurno = { tipo_turno: string; hora_inicio: string; hora_fin: string; notas: string }
const FORM_TURNO_VACIO: FormTurno = { tipo_turno: 'Mediodía', hora_inicio: '13:00', hora_fin: '16:00', notas: '' }

function TurnosTab() {
  const [semana, setSemana] = useState(() => inicioSemana(new Date()))
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [loading, setLoading] = useState(true)
  const [celda, setCelda] = useState<{ empId: number; fecha: string } | null>(null)
  const [turnoEditar, setTurnoEditar] = useState<Turno | null>(null)
  const [form, setForm] = useState<FormTurno>(FORM_TURNO_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [modalCopiar, setModalCopiar] = useState(false)
  const [cargandoCopiar, setCargandoCopiar] = useState(false)
  const [turnosPrevSem, setTurnosPrevSem] = useState<Turno[]>([])
  const [empsCopiar, setEmpsCopiar] = useState<Set<number>>(new Set())
  const [modoCopiar, setModoCopiar] = useState<'añadir' | 'reemplazar'>('añadir')
  const [copiando, setCopiando] = useState(false)
  const [historial, setHistorial] = useState<AccionDeshacer[]>([])
  const [deshaciendo, setDeshaciendo] = useState(false)

  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => sumarDias(semana, i)), [semana])
  const fechaInicio = toISO(semana)
  const fechaFin    = toISO(sumarDias(semana, 6))

  const cargar = useCallback(async () => {
    setLoading(true)
    const [{ data: emps }, { data: trns }] = await Promise.all([
      supabase.from('empleados').select('*').eq('estado', 'activo').order('nombre'),
      supabase.from('turnos').select('*').gte('fecha', fechaInicio).lte('fecha', fechaFin),
    ])
    setEmpleados(emps ?? [])
    setTurnos(trns ?? [])
    setLoading(false)
  }, [fechaInicio, fechaFin])

  useEffect(() => { cargar() }, [cargar])
  useEffect(() => { setHistorial(cargarHistorial()) }, [])

  const mapa = useMemo(() => {
    const m: Record<number, Record<string, Turno[]>> = {}
    turnos.forEach((t) => {
      if (!m[t.empleado_id]) m[t.empleado_id] = {}
      if (!m[t.empleado_id][t.fecha]) m[t.empleado_id][t.fecha] = []
      m[t.empleado_id][t.fecha].push(t)
    })
    return m
  }, [turnos])

  function horasEmp(empId: number) {
    return turnos
      .filter((t) => t.empleado_id === empId && t.tipo_turno !== 'Vacaciones' && t.tipo_turno !== 'Baja')
      .reduce((s, t) => s + calcHorasTurno(t.hora_inicio, t.hora_fin), 0)
  }

  const activos        = empleados.length
  const totalContrato  = empleados.reduce((s, e) => s + Number(e.horas_contrato ?? 0), 0)
  const totalAsignadas = empleados.reduce((s, e) => s + horasEmp(e.id), 0)
  const vacsSemana     = turnos.filter((t) => t.tipo_turno === 'Vacaciones').length

  function pushUndo(accion: AccionDeshacer) {
    setHistorial((h) => {
      const nuevo = [accion, ...h].slice(0, MAX_HISTORIAL)
      guardarHistorial(nuevo)
      return nuevo
    })
  }

  function abrirCelda(empId: number, fecha: string) {
    setCelda({ empId, fecha }); setTurnoEditar(null); setForm(FORM_TURNO_VACIO); setError('')
  }
  function abrirEditar(t: Turno, e: React.MouseEvent) {
    e.stopPropagation()
    setCelda({ empId: t.empleado_id, fecha: t.fecha })
    setTurnoEditar(t)
    setForm({ tipo_turno: t.tipo_turno, hora_inicio: t.hora_inicio ?? '13:00', hora_fin: t.hora_fin ?? '16:00', notas: t.notas ?? '' })
    setError('')
  }
  function cerrar() { setCelda(null); setTurnoEditar(null); setForm(FORM_TURNO_VACIO); setError('') }

  async function guardar() {
    if (!celda) return
    setGuardando(true)
    const payload = {
      empleado_id: celda.empId, fecha: celda.fecha,
      tipo_turno: form.tipo_turno,
      hora_inicio: form.hora_inicio || null,
      hora_fin: form.hora_fin || null,
      notas: form.notas || null,
    }
    const emp = empleados.find(e => e.id === celda.empId)
    if (turnoEditar) {
      const { error: err } = await supabase.from('turnos').update({ tipo_turno: payload.tipo_turno, hora_inicio: payload.hora_inicio, hora_fin: payload.hora_fin, notas: payload.notas }).eq('id', turnoEditar.id)
      if (err) { setError(err.message); setGuardando(false); return }
      pushUndo({ tipo: 'editar', id: turnoEditar.id, antes: { tipo_turno: turnoEditar.tipo_turno, hora_inicio: turnoEditar.hora_inicio, hora_fin: turnoEditar.hora_fin, notas: turnoEditar.notas }, desc: `Editar turno ${turnoEditar.tipo_turno} — ${emp?.nombre.split(' ')[0]} ${turnoEditar.fecha}` })
    } else {
      const { data, error: err } = await supabase.from('turnos').insert(payload).select().single()
      if (err || !data) { setError(err?.message ?? 'Error'); setGuardando(false); return }
      pushUndo({ tipo: 'crear', turno: data as Turno, desc: `Crear turno ${form.tipo_turno} — ${emp?.nombre.split(' ')[0]} ${celda.fecha}` })
    }
    setGuardando(false); cerrar(); cargar()
  }

  async function eliminar() {
    if (!turnoEditar) return
    const t = turnoEditar
    const emp = empleados.find(e => e.id === t.empleado_id)
    await supabase.from('turnos').delete().eq('id', t.id)
    pushUndo({ tipo: 'eliminar', turno: t, desc: `Eliminar turno ${t.tipo_turno} — ${emp?.nombre.split(' ')[0]} ${t.fecha}` })
    cerrar(); cargar()
  }

  async function eliminarDirecto(turno: Turno, e: React.MouseEvent) {
    e.stopPropagation()
    const emp = empleados.find(x => x.id === turno.empleado_id)
    await supabase.from('turnos').delete().eq('id', turno.id)
    pushUndo({ tipo: 'eliminar', turno, desc: `Eliminar turno ${turno.tipo_turno} — ${emp?.nombre.split(' ')[0]} ${turno.fecha}` })
    cargar()
  }

  async function deshacer() {
    if (historial.length === 0 || deshaciendo) return
    const [ultima, ...resto] = historial
    setDeshaciendo(true)
    if (ultima.tipo === 'crear') {
      await supabase.from('turnos').delete().eq('id', ultima.turno.id)
    } else if (ultima.tipo === 'eliminar') {
      const { id: _id, ...payload } = ultima.turno
      await supabase.from('turnos').insert(payload)
    } else if (ultima.tipo === 'editar') {
      await supabase.from('turnos').update(ultima.antes).eq('id', ultima.id)
    } else if (ultima.tipo === 'copiar_semana') {
      await supabase.from('turnos').delete().in('id', ultima.ids)
    }
    setHistorial(resto); guardarHistorial(resto); setDeshaciendo(false); cargar()
  }

  async function abrirModalCopiar() {
    setModalCopiar(true); setCargandoCopiar(true)
    const prevInicio = toISO(sumarDias(semana, -7))
    const prevFin    = toISO(sumarDias(semana, -1))
    const { data } = await supabase.from('turnos').select('*').gte('fecha', prevInicio).lte('fecha', prevFin)
    const prevTurnos = data ?? []
    setTurnosPrevSem(prevTurnos)
    const empIdsActivos = new Set(empleados.map(e => e.id))
    const idsConTurnos = new Set(prevTurnos.filter(t => empIdsActivos.has(t.empleado_id)).map(t => t.empleado_id))
    setEmpsCopiar(idsConTurnos)
    setModoCopiar('añadir')
    setCargandoCopiar(false)
  }

  function cerrarModalCopiar() { setModalCopiar(false); setTurnosPrevSem([]); setEmpsCopiar(new Set()); setCopiando(false) }
  function toggleEmpCopiar(empId: number) {
    setEmpsCopiar(prev => { const next = new Set(prev); next.has(empId) ? next.delete(empId) : next.add(empId); return next })
  }

  const turnosACopiar = useMemo(() => turnosPrevSem.filter(t => empsCopiar.has(t.empleado_id)), [turnosPrevSem, empsCopiar])
  const empsConTurnosPrev = useMemo(() => empleados.filter(e => turnosPrevSem.some(t => t.empleado_id === e.id)), [empleados, turnosPrevSem])

  async function confirmarCopiar() {
    if (turnosACopiar.length === 0) return
    setCopiando(true)
    if (modoCopiar === 'reemplazar') {
      await supabase.from('turnos').delete().in('empleado_id', Array.from(empsCopiar)).gte('fecha', fechaInicio).lte('fecha', fechaFin)
    }
    const nuevos = turnosACopiar.map(({ id: _id, created_at: _ca, ...resto }) => ({
      ...resto, fecha: toISO(sumarDias(new Date(resto.fecha + 'T12:00:00'), 7)),
    }))
    const { data: insertados, error: err } = await supabase.from('turnos').insert(nuevos).select()
    setCopiando(false)
    if (!err) {
      const ids = (insertados ?? []).map((t: Turno) => t.id)
      const nEmps = empsCopiar.size
      pushUndo({ tipo: 'copiar_semana', ids, desc: `Copiar semana anterior — ${ids.length} turnos de ${nEmps} empleado${nEmps !== 1 ? 's' : ''}` })
    }
    cerrarModalCopiar(); cargar()
  }

  const empModal = celda ? empleados.find((e) => e.id === celda.empId) : null
  const tituloSemana = `${formatDia(semana)} – ${formatDia(sumarDias(semana, 6))}`
  const ultimaAccion = historial[0]

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw className="animate-spin text-[#F5B731]" size={24} />
    </div>
  )

  return (
    <div className="p-6">
      <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Turnos</h1>
          <p className="text-sm text-gray-400 mt-0.5">Cuadrante semanal</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={deshacer} disabled={historial.length === 0 || deshaciendo} title={ultimaAccion ? `Deshacer: ${ultimaAccion.desc}` : 'Sin acciones'} className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {deshaciendo ? <RefreshCw size={14} className="animate-spin" /> : <Undo2 size={14} />}
            Deshacer
            {historial.length > 0 && <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5 font-mono leading-none">{historial.length}</span>}
          </button>
          <button onClick={abrirModalCopiar} className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Copy size={14} /> Copiar semana anterior
          </button>
          <div className="flex items-center gap-1">
            <button onClick={() => setSemana((d) => sumarDias(d, -7))} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"><ChevronLeft size={16} /></button>
            <button onClick={() => setSemana(inicioSemana(new Date()))} className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Hoy</button>
            <span className="text-sm font-medium text-gray-700 px-1">{tituloSemana}</span>
            <button onClick={() => setSemana((d) => sumarDias(d, 7))} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Empleados activos', value: activos },
          { label: 'Horas asignadas',   value: `${totalAsignadas.toFixed(0)}h` },
          { label: 'Horas contrato',    value: `${totalContrato.toFixed(0)}h` },
          { label: 'Vacaciones semana', value: vacsSemana },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-2xl font-bold text-gray-900">{k.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {Object.entries(TURNO_STYLE).map(([tipo, s]) => (
          <span key={tipo} className="flex items-center gap-1.5 text-xs font-medium">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: s.bg }} />
            {tipo}
          </span>
        ))}
      </div>

      {empleados.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-sm text-gray-400">No hay empleados activos</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 w-44">Empleado</th>
                  {dias.map((d, i) => {
                    const esHoy = toISO(d) === toISO(new Date())
                    return (
                      <th key={i} className={`px-2 py-3 text-center text-xs font-medium w-24 ${esHoy ? 'text-[#F5B731]' : 'text-gray-500'}`}>
                        <span className="block">{DIAS[i]}</span>
                        <span className={`block text-xs mt-0.5 ${esHoy ? 'font-bold' : 'font-normal text-gray-400'}`}>{d.getDate()} {d.toLocaleDateString('es-ES', { month: 'short' })}</span>
                      </th>
                    )
                  })}
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 w-20">Horas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {empleados.map((emp) => {
                  const horas = horasEmp(emp.id)
                  const desv  = horas - Number(emp.horas_contrato ?? 0)
                  return (
                    <tr key={emp.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-xs font-semibold text-gray-800 leading-tight">{emp.nombre.split(' ')[0]}</p>
                        <p className="text-[10px] text-gray-400">{emp.nombre.split(' ').slice(1).join(' ')}</p>
                      </td>
                      {dias.map((d, i) => {
                        const fecha = toISO(d)
                        const celdaTurnos = mapa[emp.id]?.[fecha] ?? []
                        return (
                          <td key={i} className="px-1.5 py-2 align-top cursor-pointer group" onClick={() => abrirCelda(emp.id, fecha)}>
                            <div className="min-h-[36px] flex flex-col gap-0.5">
                              {celdaTurnos.map((t) => {
                                const s = TURNO_STYLE[t.tipo_turno] ?? { bg: '#E5E7EB', text: '#374151', abbr: '?' }
                                return (
                                  <div key={t.id} className="relative group/chip w-full">
                                    <button onClick={(e) => abrirEditar(t, e)} className="flex flex-col items-center rounded px-1 py-0.5 text-[10px] font-bold leading-tight w-full hover:opacity-80 transition-opacity" style={{ backgroundColor: s.bg, color: s.text }}>
                                      <span>{s.abbr}</span>
                                      {t.hora_inicio && t.hora_fin && <span className="text-[9px] opacity-70 font-normal">{t.hora_inicio.slice(0, 5)}-{t.hora_fin.slice(0, 5)}</span>}
                                    </button>
                                    <button onClick={(e) => eliminarDirecto(t, e)} className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-black/60 text-white opacity-0 group-hover/chip:opacity-100 transition-opacity flex items-center justify-center" title="Eliminar turno"><X size={7} /></button>
                                  </div>
                                )
                              })}
                              {celdaTurnos.length === 0 && (
                                <div className="flex items-center justify-center h-9 rounded border border-dashed border-transparent group-hover:border-gray-200 transition-colors">
                                  <Plus size={12} className="text-gray-200 group-hover:text-gray-400 transition-colors" />
                                </div>
                              )}
                            </div>
                          </td>
                        )
                      })}
                      <td className="px-3 py-3 text-center">
                        <p className="text-xs font-bold text-gray-700">{horas.toFixed(1)}h</p>
                        <p className={`text-[10px] font-medium ${desv >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{desv >= 0 ? '+' : ''}{desv.toFixed(1)}</p>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {celda && (
        <Modal titulo={turnoEditar ? 'Editar turno' : `Nuevo turno — ${empModal?.nombre.split(' ')[0] ?? ''} · ${celda.fecha}`} onCerrar={cerrar}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">Tipo de turno</label>
              <div className="grid grid-cols-3 gap-1.5">
                {TIPOS_TURNO.map((tipo) => {
                  const s = TURNO_STYLE[tipo]; const sel = form.tipo_turno === tipo
                  return (
                    <button key={tipo} type="button" onClick={() => setForm((f) => ({ ...f, tipo_turno: tipo }))} className={`px-2 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${sel ? 'border-transparent' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}`} style={sel ? { backgroundColor: s.bg, color: s.text, borderColor: s.bg } : {}}>{tipo}</button>
                  )
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Hora inicio</label>
                <input type="time" className={inputCls} value={form.hora_inicio} onChange={(e) => setForm((f) => ({ ...f, hora_inicio: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Hora fin</label>
                <input type="time" className={inputCls} value={form.hora_fin} onChange={(e) => setForm((f) => ({ ...f, hora_fin: e.target.value }))} />
              </div>
            </div>
            {form.hora_inicio && form.hora_fin && (
              <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-500 text-center">
                Duración: <strong>{calcHorasTurno(form.hora_inicio, form.hora_fin).toFixed(1)}h</strong>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Notas</label>
              <input className={inputCls} value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} placeholder="Opcional" />
            </div>
            {error && <p className="text-xs text-rose-500">{error}</p>}
            <div className="flex items-center justify-between pt-1">
              <div>
                {turnoEditar && (
                  <button onClick={eliminar} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                    <Trash2 size={13} /> Eliminar
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={cerrar} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
                <button onClick={guardar} disabled={guardando} className="px-4 py-2 text-sm font-semibold bg-[#F5B731] text-[#1A1A1A] rounded-lg hover:bg-[#e0a820] transition-colors disabled:opacity-50">
                  {guardando ? '...' : turnoEditar ? 'Guardar' : 'Añadir'}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {modalCopiar && (
        <Modal titulo="Copiar semana anterior" onCerrar={cerrarModalCopiar} maxW="max-w-md">
          {cargandoCopiar ? (
            <div className="flex items-center justify-center py-8"><RefreshCw className="animate-spin text-[#F5B731]" size={22} /></div>
          ) : turnosPrevSem.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-500">No hay turnos en la semana anterior.</p>
              <button onClick={cerrarModalCopiar} className="mt-4 px-4 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cerrar</button>
            </div>
          ) : (
            <div className="space-y-5">
              {turnos.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <p className="text-sm font-semibold text-amber-800">Ya existen {turnos.length} turno{turnos.length !== 1 ? 's' : ''} esta semana</p>
                  <div className="flex gap-2 mt-3">
                    {(['añadir', 'reemplazar'] as const).map((m) => (
                      <button key={m} onClick={() => setModoCopiar(m)} className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg border-2 transition-all ${modoCopiar === m ? (m === 'añadir' ? 'bg-[#F5B731] text-[#1A1A1A] border-[#F5B731]' : 'bg-rose-500 text-white border-rose-500') : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                        {m === 'añadir' ? 'Añadir' : 'Reemplazar'}
                        <span className="block text-[10px] font-normal mt-0.5 opacity-80">{m === 'añadir' ? 'Mantener existentes' : 'Borrar y sobreescribir'}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Empleados a copiar</p>
                  <div className="flex gap-2">
                    <button onClick={() => setEmpsCopiar(new Set(empsConTurnosPrev.map(e => e.id)))} className="text-xs text-[#F5B731] font-semibold hover:underline">Todos</button>
                    <span className="text-gray-300">·</span>
                    <button onClick={() => setEmpsCopiar(new Set())} className="text-xs text-gray-400 hover:text-gray-600">Ninguno</button>
                  </div>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {empsConTurnosPrev.map((emp) => {
                    const nTurnos = turnosPrevSem.filter(t => t.empleado_id === emp.id).length
                    const sel = empsCopiar.has(emp.id)
                    return (
                      <label key={emp.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${sel ? 'bg-[#F5B731]/10' : 'hover:bg-gray-50'}`}>
                        <input type="checkbox" checked={sel} onChange={() => toggleEmpCopiar(emp.id)} className="w-4 h-4 rounded accent-[#F5B731] flex-shrink-0" />
                        <span className="text-sm font-medium text-gray-800 flex-1">{emp.nombre}</span>
                        <span className="text-xs text-gray-400">{nTurnos} turno{nTurnos !== 1 ? 's' : ''}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
              <div className={`rounded-xl px-4 py-3 ${turnosACopiar.length > 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-50 border border-gray-200'}`}>
                <p className={`text-sm font-semibold ${turnosACopiar.length > 0 ? 'text-emerald-700' : 'text-gray-500'}`}>
                  {turnosACopiar.length > 0 ? `Se copiarán ${turnosACopiar.length} turno${turnosACopiar.length !== 1 ? 's' : ''} de ${empsCopiar.size} empleado${empsCopiar.size !== 1 ? 's' : ''}` : 'Selecciona al menos un empleado'}
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={cerrarModalCopiar} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
                <button onClick={confirmarCopiar} disabled={turnosACopiar.length === 0 || copiando} className="px-5 py-2 text-sm font-semibold bg-[#F5B731] text-[#1A1A1A] rounded-lg hover:bg-[#e0a820] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  {copiando ? <span className="flex items-center gap-2"><RefreshCw size={14} className="animate-spin" /> Copiando...</span> : 'Confirmar copia'}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// ── TAB: PRESENCIA ───────────────────────────
// ─────────────────────────────────────────────

type EmpSlim = { id: number; nombre: string; puesto: string }
type FilaPresencia = { empleado: EmpSlim; turno: Turno; fichajeAbierto: Fichaje | null; fichajesCerrados: Fichaje[] }

function parseMin(h: string): number { const [hh, mm] = h.split(':').map(Number); return hh * 60 + mm }
function esTurnoActivo(turno: Turno, ahoraMin: number): boolean {
  const inicio = turno.hora_inicio ? parseMin(turno.hora_inicio) : null
  const fin    = turno.hora_fin    ? parseMin(turno.hora_fin)    : null
  if (inicio !== null && ahoraMin < inicio) return false
  if (fin !== null && ahoraMin > fin + 30)  return false
  return true
}
function fmtHora(h: string | null) { return h ? h.slice(0, 5) : '—' }
function fmtActualizacion(d: Date) { return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }

const PRESENCE_PALETTE = ['bg-blue-100 text-blue-800', 'bg-emerald-100 text-emerald-800', 'bg-violet-100 text-violet-800', 'bg-amber-100 text-amber-800', 'bg-rose-100 text-rose-800', 'bg-cyan-100 text-cyan-800']
function avatarColor(id: number) { return PRESENCE_PALETTE[id % PRESENCE_PALETTE.length] }

function PresenciaTab() {
  const [filas, setFilas] = useState<FilaPresencia[]>([])
  const [sinTurno, setSinTurno] = useState<EmpSlim[]>([])
  const [loading, setLoading] = useState(true)
  const [ultimaActualizacion, setUltimaActualizacion] = useState(new Date())
  const [tick, setTick] = useState(0)

  const cargar = useCallback(async () => {
    const ahora = new Date()
    const today = ahora.toISOString().split('T')[0]
    const ahoraMin = ahora.getHours() * 60 + ahora.getMinutes()
    const [{ data: emps }, { data: turnosData }, { data: fichajesData }] = await Promise.all([
      supabase.from('empleados').select('id, nombre, puesto').eq('activo', true).order('nombre'),
      supabase.from('turnos').select('*').eq('fecha', today),
      supabase.from('fichajes').select('*').eq('fecha', today),
    ])
    const empLista: EmpSlim[] = (emps ?? []) as EmpSlim[]
    const turnosPorEmp = new Map<number, Turno[]>()
    ;(turnosData ?? []).forEach((t: Turno) => { const arr = turnosPorEmp.get(t.empleado_id) ?? []; arr.push(t); turnosPorEmp.set(t.empleado_id, arr) })
    const fichajesPorEmp = new Map<number, Fichaje[]>()
    ;(fichajesData ?? []).forEach((f: Fichaje) => { const arr = fichajesPorEmp.get(f.empleado_id) ?? []; arr.push(f); fichajesPorEmp.set(f.empleado_id, arr) })
    const filasResult: FilaPresencia[] = []
    const sinTurnoResult: EmpSlim[] = []
    empLista.forEach(emp => {
      const turnosEmp = turnosPorEmp.get(emp.id) ?? []
      const turnoActivo = turnosEmp.find(t => esTurnoActivo(t, ahoraMin)) ?? null
      if (!turnoActivo) {
        const fEmp = fichajesPorEmp.get(emp.id) ?? []
        if (fEmp.find(f => f.hora_salida === null)) sinTurnoResult.push(emp)
        return
      }
      const fichajesEmp = fichajesPorEmp.get(emp.id) ?? []
      filasResult.push({ empleado: emp, turno: turnoActivo, fichajeAbierto: fichajesEmp.find(f => f.hora_salida === null) ?? null, fichajesCerrados: fichajesEmp.filter(f => f.hora_salida !== null) })
    })
    filasResult.sort((a, b) => (a.fichajeAbierto ? 1 : 0) - (b.fichajeAbierto ? 1 : 0))
    setFilas(filasResult); setSinTurno(sinTurnoResult); setUltimaActualizacion(new Date()); setLoading(false)
  }, [])

  useEffect(() => {
    cargar()
    const interval = setInterval(() => { cargar(); setTick(t => t + 1) }, 60000)
    return () => clearInterval(interval)
  }, [cargar])

  const presentes = useMemo(() => filas.filter(f => f.fichajeAbierto !== null), [filas])
  const ausentes  = useMemo(() => filas.filter(f => f.fichajeAbierto === null), [filas])

  if (loading) return <div className="flex items-center justify-center h-64"><RefreshCw className="animate-spin text-[#F5B731]" size={22} /></div>

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Control de Presencia</h1>
          <p className="text-sm text-gray-400 mt-0.5">Empleados con turno activo ahora mismo</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Actualizado {fmtActualizacion(ultimaActualizacion)}</span>
          <button onClick={cargar} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors" title="Actualizar ahora"><RefreshCw size={14} className="text-gray-600" /></button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center"><p className="text-3xl font-bold text-gray-900">{filas.length}</p><p className="text-xs text-gray-400 mt-1">Con turno activo</p></div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4 text-center"><p className="text-3xl font-bold text-emerald-700">{presentes.length}</p><p className="text-xs text-emerald-500 mt-1">Ficharon entrada</p></div>
        <div className="bg-rose-50 rounded-xl border border-rose-200 p-4 text-center"><p className="text-3xl font-bold text-rose-600">{ausentes.length}</p><p className="text-xs text-rose-400 mt-1">Sin fichar</p></div>
      </div>
      {filas.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Users size={36} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm font-semibold text-gray-500">Ningún empleado tiene turno activo ahora mismo</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-5">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50"><p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Turno activo ahora</p></div>
          <div className="divide-y divide-gray-50">
            {filas.map(fila => {
              const presente = fila.fichajeAbierto !== null
              return (
                <div key={fila.empleado.id} className="flex items-center gap-4 px-5 py-4">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${avatarColor(fila.empleado.id)}`}>{fila.empleado.nombre.charAt(0).toUpperCase()}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{fila.empleado.nombre}</p>
                    <p className="text-xs text-gray-400">{fila.empleado.puesto}{fila.turno.tipo_turno && ` · ${fila.turno.tipo_turno}`}{fila.turno.hora_inicio && ` · ${fmtHora(fila.turno.hora_inicio)} – ${fmtHora(fila.turno.hora_fin)}`}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {presente ? (
                      <div>
                        <p className="text-xs text-emerald-600 font-semibold">Entrada {fmtHora(fila.fichajeAbierto!.hora_entrada)}</p>
                        {fila.fichajesCerrados.length > 0 && <p className="text-xs text-gray-400">+{fila.fichajesCerrados.length} turno(s) anterior(es)</p>}
                      </div>
                    ) : (
                      <p className="text-xs text-rose-500 font-semibold">No ha fichado</p>
                    )}
                  </div>
                  <div className="flex-shrink-0">{presente ? <CheckCircle2 size={22} className="text-emerald-500" /> : <XCircle size={22} className="text-rose-500" />}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {sinTurno.length > 0 && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-amber-200 flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-600" />
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Fichados sin turno programado</p>
          </div>
          <div className="divide-y divide-amber-100">
            {sinTurno.map(emp => (
              <div key={emp.id} className="flex items-center gap-3 px-5 py-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${avatarColor(emp.id)}`}>{emp.nombre.charAt(0).toUpperCase()}</div>
                <div><p className="text-sm font-medium text-gray-800">{emp.nombre}</p><p className="text-xs text-gray-500">{emp.puesto}</p></div>
                <div className="ml-auto"><Clock size={16} className="text-amber-500" /></div>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="text-center text-xs text-gray-300 mt-6">Actualización automática cada 60 segundos · tick #{tick}</p>
    </div>
  )
}

// ─────────────────────────────────────────────
// ── TAB: FICHAJES ────────────────────────────
// ─────────────────────────────────────────────

function calcHorasFichaje(entrada: string, salida: string): { total: number; nocturnas: number } {
  if (!entrada || !salida) return { total: 0, nocturnas: 0 }
  const [h1, m1] = entrada.split(':').map(Number)
  const [h2, m2] = salida.split(':').map(Number)
  const inicioMin = h1 * 60 + m1
  let finMin = h2 * 60 + m2
  if (finMin <= inicioMin) finMin += 24 * 60  // ajuste cruce de medianoche

  const total = (finMin - inicioMin) / 60

  // Tramo nocturno continuo: 22:00 → 06:00 del día siguiente (1320 → 1800 en timeline extendido)
  let nocMin = Math.max(0, Math.min(finMin, 1800) - Math.max(inicioMin, 1320))

  // Tramo madrugada aislado: 00:00 → 06:00 para turnos que empiezan en madrugada
  // sin cruzar medianoche (el cruce ya queda cubierto en el tramo anterior como 1440-1800)
  if (inicioMin < 360 && finMin <= 1440) {
    nocMin += Math.min(finMin, 360) - inicioMin
  }

  return {
    total:     Math.round(total * 100) / 100,
    nocturnas: Math.round(Math.max(0, nocMin) / 60 * 100) / 100,
  }
}

function descargarCSV(rows: string[][], nombre: string) {
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = nombre; a.click()
  URL.revokeObjectURL(url)
}

type FormFichaje = { empleado_id: string; fecha: string; hora_entrada: string; hora_salida: string; horas_extra: string }
const FORM_FICHAJE_VACIO: FormFichaje = { empleado_id: '', fecha: new Date().toISOString().split('T')[0], hora_entrada: '', hora_salida: '', horas_extra: '0' }

type FilaDia = { empleadoId: number; empleadoNombre: string; fecha: string; fichajes: Fichaje[]; totalHoras: number; totalNocturnas: number; totalExtra: number }

function FichajesTab() {
  const [fichajes, setFichajes] = useState<Fichaje[]>([])
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEmp, setFiltroEmp] = useState('')
  const [fechaDesde, setFechaDesde] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0] })
  const [fechaHasta, setFechaHasta] = useState(() => new Date().toISOString().split('T')[0])
  const [vista, setVista] = useState<'detalle' | 'agrupada'>('agrupada')
  const [modal, setModal] = useState(false)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [form, setForm] = useState<FormFichaje>(FORM_FICHAJE_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [confirmEliminar, setConfirmEliminar] = useState<number | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    const [{ data: fichs }, { data: emps }] = await Promise.all([
      supabase.from('fichajes').select('*').order('fecha', { ascending: false }).order('empleado_id').order('hora_entrada', { ascending: true }),
      supabase.from('empleados').select('*').eq('activo', true).order('nombre'),
    ])
    setFichajes(fichs ?? []); setEmpleados(emps ?? []); setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const filtrados = useMemo(() => fichajes.filter((f) => {
    const matchEmp = !filtroEmp || String(f.empleado_id) === filtroEmp
    return matchEmp && f.fecha >= fechaDesde && f.fecha <= fechaHasta
  }), [fichajes, filtroEmp, fechaDesde, fechaHasta])

  const filasDia = useMemo((): FilaDia[] => {
    const mapa = new Map<string, FilaDia>()
    for (const f of filtrados) {
      const emp = empleados.find(e => e.id === f.empleado_id)
      const key = `${f.empleado_id}_${f.fecha}`
      if (!mapa.has(key)) mapa.set(key, { empleadoId: f.empleado_id, empleadoNombre: emp?.nombre ?? String(f.empleado_id), fecha: f.fecha, fichajes: [], totalHoras: 0, totalNocturnas: 0, totalExtra: 0 })
      const fila = mapa.get(key)!
      fila.fichajes.push(f)
      fila.totalHoras += f.horas_total ?? 0
      fila.totalNocturnas += f.horas_nocturnas ?? 0
      fila.totalExtra += f.horas_extra ?? 0
    }
    for (const fila of mapa.values()) {
      fila.totalHoras = Math.round(fila.totalHoras * 100) / 100
      fila.totalNocturnas = Math.round(fila.totalNocturnas * 100) / 100
      fila.totalExtra = Math.round(fila.totalExtra * 100) / 100
    }
    return Array.from(mapa.values()).sort((a, b) => b.fecha.localeCompare(a.fecha) || a.empleadoNombre.localeCompare(b.empleadoNombre))
  }, [filtrados, empleados])

  const resumen = useMemo(() => {
    const totalH = filtrados.reduce((s, f) => s + (f.horas_total ?? 0), 0)
    const noctH  = filtrados.reduce((s, f) => s + (f.horas_nocturnas ?? 0), 0)
    const extraH = filtrados.reduce((s, f) => s + (f.horas_extra ?? 0), 0)
    return { total: Math.round(totalH * 100) / 100, nocturnas: Math.round(noctH * 100) / 100, extra: Math.round(extraH * 100) / 100, normal: Math.round(Math.max(0, totalH - extraH - noctH) * 100) / 100 }
  }, [filtrados])

  const autoCalc = useMemo(() => {
    if (!form.hora_entrada || !form.hora_salida) return null
    return calcHorasFichaje(form.hora_entrada, form.hora_salida)
  }, [form.hora_entrada, form.hora_salida])

  function abrirCrear() { setEditandoId(null); setForm({ ...FORM_FICHAJE_VACIO, empleado_id: filtroEmp || '' }); setError(''); setModal(true) }
  function abrirEditar(f: Fichaje) { setEditandoId(f.id); setForm({ empleado_id: String(f.empleado_id), fecha: f.fecha, hora_entrada: f.hora_entrada ?? '', hora_salida: f.hora_salida ?? '', horas_extra: String(f.horas_extra ?? 0) }); setError(''); setModal(true) }
  function cerrar() { setModal(false); setEditandoId(null); setForm(FORM_FICHAJE_VACIO); setError('') }

  async function guardar() {
    if (!form.empleado_id) { setError('Selecciona un empleado'); return }
    if (!form.fecha) { setError('La fecha es obligatoria'); return }
    setGuardando(true); setError('')
    const { total, nocturnas } = autoCalc ?? { total: 0, nocturnas: 0 }
    const payload = { empleado_id: Number(form.empleado_id), fecha: form.fecha, hora_entrada: form.hora_entrada || null, hora_salida: form.hora_salida || null, horas_total: total || null, horas_nocturnas: nocturnas || null, horas_extra: parseFloat(form.horas_extra) || null }
    let err
    if (editandoId !== null) { ;({ error: err } = await supabase.from('fichajes').update(payload).eq('id', editandoId)) }
    else { ;({ error: err } = await supabase.from('fichajes').insert(payload)) }
    if (err) { setError(err.message); setGuardando(false); return }
    setGuardando(false); cerrar(); cargar()
  }

  async function eliminar(id: number) { await supabase.from('fichajes').delete().eq('id', id); setConfirmEliminar(null); cargar() }

  function exportarCSV() {
    const cabecera = ['Empleado', 'Fecha', 'Entrada', 'Salida', 'Total (h)', 'Nocturnas (h)', 'Extra (h)']
    const filas = filtrados.map((f) => { const emp = empleados.find((e) => e.id === f.empleado_id); return [emp?.nombre ?? String(f.empleado_id), f.fecha, f.hora_entrada?.slice(0, 5) ?? '', f.hora_salida?.slice(0, 5) ?? '', String(f.horas_total ?? 0), String(f.horas_nocturnas ?? 0), String(f.horas_extra ?? 0)] })
    descargarCSV([cabecera, ...filas], `fichajes_${fechaDesde}_${fechaHasta}.csv`)
  }

  function exportarAgrupado() {
    const cabecera = ['Empleado', 'Fecha', 'Turnos', 'Detalle', 'Total (h)', 'Nocturnas (h)', 'Extra (h)']
    const filas = filasDia.map((fila) => { const detalle = fila.fichajes.map(f => `${f.hora_entrada?.slice(0,5) ?? '?'}-${f.hora_salida?.slice(0,5) ?? '?'}`).join(' | '); return [fila.empleadoNombre, fila.fecha, String(fila.fichajes.length), detalle, String(fila.totalHoras), String(fila.totalNocturnas), String(fila.totalExtra)] })
    descargarCSV([cabecera, ...filas], `fichajes_agrupado_${fechaDesde}_${fechaHasta}.csv`)
  }

  if (loading) return <div className="flex items-center justify-center h-64"><RefreshCw className="animate-spin text-[#F5B731]" size={24} /></div>

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Control de Fichajes</h1>
          <p className="text-sm text-gray-400 mt-0.5">Registro de entradas y salidas · múltiples turnos por día</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={vista === 'agrupada' ? exportarAgrupado : exportarCSV} className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Download size={14} /> Exportar CSV
          </button>
          <button onClick={abrirCrear} className="flex items-center gap-2 px-4 py-2 bg-[#F5B731] text-[#1A1A1A] text-sm font-semibold rounded-lg hover:bg-[#e0a820] transition-colors">
            <Plus size={15} /> Nuevo fichaje
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Horas normales',  value: resumen.normal.toFixed(1) + 'h',    cls: 'text-gray-800' },
          { label: 'Horas nocturnas', value: resumen.nocturnas.toFixed(1) + 'h', cls: 'text-blue-700' },
          { label: 'Horas extra',     value: resumen.extra.toFixed(1) + 'h',     cls: 'text-amber-600' },
          { label: 'Total horas',     value: resumen.total.toFixed(1) + 'h',     cls: 'text-gray-900 font-bold' },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className={`text-2xl font-bold ${k.cls}`}>{k.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <select className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white" value={filtroEmp} onChange={(e) => setFiltroEmp(e.target.value)}>
          <option value="">Todos los empleados</option>
          {empleados.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <input type="date" className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731]" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
          <span className="text-gray-400 text-sm">—</span>
          <input type="date" className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731]" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
        </div>
        <span className="text-xs text-gray-400 flex-1">{filtrados.length} registros</span>
        <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-1">
          <button onClick={() => setVista('agrupada')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${vista === 'agrupada' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}><LayoutGrid size={13} /> Por día</button>
          <button onClick={() => setVista('detalle')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${vista === 'detalle' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}><List size={13} /> Detalle</button>
        </div>
      </div>

      {vista === 'agrupada' && (
        filasDia.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center"><ClipboardList size={32} className="mx-auto text-gray-200 mb-3" /><p className="text-sm text-gray-400">No hay fichajes para este período</p></div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium">Empleado</th>
                    <th className="text-left px-4 py-3 font-medium">Fecha</th>
                    <th className="text-left px-4 py-3 font-medium">Turnos del día</th>
                    <th className="text-center px-4 py-3 font-medium">Total</th>
                    <th className="text-center px-4 py-3 font-medium">Nocturnas</th>
                    <th className="text-center px-4 py-3 font-medium">Extra</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filasDia.map((fila) => {
                    const tieneAbierto = fila.fichajes.some(f => !f.hora_salida)
                    return (
                      <tr key={`${fila.empleadoId}_${fila.fecha}`} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 font-medium text-gray-800">{fila.empleadoNombre}</td>
                        <td className="px-4 py-3 text-gray-500">{new Date(fila.fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {fila.fichajes.map(f => (
                              <span key={f.id} className={`inline-flex items-center gap-1 text-xs font-mono px-2 py-1 rounded-md ${!f.hora_salida ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-600'}`}>
                                {f.hora_entrada?.slice(0, 5) ?? '?'} → {f.hora_salida?.slice(0, 5) ?? '…'}
                                <button onClick={() => abrirEditar(f)} className="ml-0.5 text-gray-400 hover:text-[#F5B731] transition-colors" title="Editar"><Pencil size={10} /></button>
                                {confirmEliminar === f.id ? (
                                  <span className="flex items-center gap-0.5 ml-0.5">
                                    <button onClick={() => eliminar(f.id)} className="text-rose-500 hover:text-rose-700 text-xs font-bold">✓</button>
                                    <button onClick={() => setConfirmEliminar(null)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
                                  </span>
                                ) : (
                                  <button onClick={() => setConfirmEliminar(f.id)} className="ml-0.5 text-gray-400 hover:text-rose-500 transition-colors" title="Eliminar"><Trash2 size={10} /></button>
                                )}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">{tieneAbierto ? <span className="text-emerald-600 font-medium text-xs">En curso</span> : <span className="font-semibold text-gray-800">{fila.totalHoras.toFixed(1)}h</span>}</td>
                        <td className="px-4 py-3 text-center">{fila.totalNocturnas > 0 ? <span className="text-blue-700 font-medium">{fila.totalNocturnas.toFixed(1)}h</span> : <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-3 text-center">{fila.totalExtra > 0 ? <span className="text-amber-600 font-medium">{fila.totalExtra.toFixed(1)}h</span> : <span className="text-gray-300">—</span>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {vista === 'detalle' && (
        filtrados.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center"><ClipboardList size={32} className="mx-auto text-gray-200 mb-3" /><p className="text-sm text-gray-400">No hay fichajes para este período</p></div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium">Empleado</th>
                    <th className="text-left px-4 py-3 font-medium">Fecha</th>
                    <th className="text-center px-4 py-3 font-medium">Entrada</th>
                    <th className="text-center px-4 py-3 font-medium">Salida</th>
                    <th className="text-center px-4 py-3 font-medium">Total</th>
                    <th className="text-center px-4 py-3 font-medium">Nocturnas</th>
                    <th className="text-center px-4 py-3 font-medium">Extra</th>
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtrados.map((f) => {
                    const emp = empleados.find((e) => e.id === f.empleado_id)
                    return (
                      <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 font-medium text-gray-800">{emp?.nombre ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-500">{f.fecha}</td>
                        <td className="px-4 py-3 text-center font-mono text-gray-700">{f.hora_entrada?.slice(0, 5) ?? '—'}</td>
                        <td className="px-4 py-3 text-center font-mono">{f.hora_salida ? <span className="text-gray-700">{f.hora_salida.slice(0, 5)}</span> : <span className="text-emerald-600 font-medium text-xs">En curso</span>}</td>
                        <td className="px-4 py-3 text-center font-semibold text-gray-800">{f.horas_total != null ? `${f.horas_total}h` : '—'}</td>
                        <td className="px-4 py-3 text-center">{(f.horas_nocturnas ?? 0) > 0 ? <span className="text-blue-700 font-medium">{f.horas_nocturnas}h</span> : <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-3 text-center">{(f.horas_extra ?? 0) > 0 ? <span className="text-amber-600 font-medium">{f.horas_extra}h</span> : <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => abrirEditar(f)} className="p-1.5 text-gray-400 hover:text-[#F5B731] transition-colors rounded"><Pencil size={13} /></button>
                            {confirmEliminar === f.id ? (
                              <span className="flex items-center gap-1">
                                <button onClick={() => eliminar(f.id)} className="px-2 py-0.5 bg-rose-500 text-white rounded text-xs font-medium">Sí</button>
                                <button onClick={() => setConfirmEliminar(null)} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium">No</button>
                              </span>
                            ) : (
                              <button onClick={() => setConfirmEliminar(f.id)} className="p-1.5 text-gray-400 hover:text-rose-500 transition-colors rounded"><Trash2 size={13} /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {modal && (
        <Modal titulo={editandoId !== null ? 'Editar fichaje' : 'Registrar fichaje'} onCerrar={cerrar}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Empleado *</label>
              <select className={inputCls} value={form.empleado_id} onChange={(e) => setForm((f) => ({ ...f, empleado_id: e.target.value }))}>
                <option value="">— Seleccionar —</option>
                {empleados.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Fecha *</label>
              <input type="date" className={inputCls} value={form.fecha} onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Hora entrada</label>
                <input type="time" className={inputCls} value={form.hora_entrada} onChange={(e) => setForm((f) => ({ ...f, hora_entrada: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Hora salida</label>
                <input type="time" className={inputCls} value={form.hora_salida} onChange={(e) => setForm((f) => ({ ...f, hora_salida: e.target.value }))} />
              </div>
            </div>
            {autoCalc && (
              <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-2 gap-3 text-xs">
                <div className="text-center"><p className="font-bold text-gray-800 text-base">{autoCalc.total.toFixed(1)}h</p><p className="text-gray-400">Total calculado</p></div>
                <div className="text-center"><p className="font-bold text-blue-700 text-base">{autoCalc.nocturnas.toFixed(1)}h</p><p className="text-gray-400">Nocturnas (22-06h)</p></div>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Horas extra</label>
              <input type="number" className={inputCls} value={form.horas_extra} onChange={(e) => setForm((f) => ({ ...f, horas_extra: e.target.value }))} min="0" step="0.5" />
            </div>
            {error && <p className="text-xs text-rose-500">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={cerrar} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
              <button onClick={guardar} disabled={guardando} className="px-4 py-2 text-sm font-semibold bg-[#F5B731] text-[#1A1A1A] rounded-lg hover:bg-[#e0a820] disabled:opacity-50">
                {guardando ? 'Guardando...' : editandoId !== null ? 'Guardar' : 'Registrar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// ── SHELL — Tab bar + routing ────────────────
// ─────────────────────────────────────────────

type TabId = 'turnos' | 'presencia' | 'fichajes'

const TABS: { id: TabId; label: string; Icono: React.ElementType }[] = [
  { id: 'turnos',    label: 'Turnos',    Icono: CalendarDays },
  { id: 'presencia', label: 'Presencia', Icono: UserCheck },
  { id: 'fichajes',  label: 'Fichajes',  Icono: ClipboardList },
]

function PlanificacionContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [tab, setTab] = useState<TabId>(() => {
    const p = searchParams.get('tab') as TabId
    return TABS.some(t => t.id === p) ? p : 'turnos'
  })

  function cambiarTab(id: TabId) {
    setTab(id)
    router.replace(`/rrhh/planificacion?tab=${id}`, { scroll: false })
  }

  return (
    <div>
      <div className="border-b border-gray-200 bg-white flex sticky top-0 z-10">
        {TABS.map(({ id, label, Icono }) => (
          <button
            key={id}
            onClick={() => cambiarTab(id)}
            className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${
              tab === id ? 'border-[#F5B731] text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icono size={14} />
            {label}
          </button>
        ))}
      </div>
      {tab === 'turnos'    && <TurnosTab />}
      {tab === 'presencia' && <PresenciaTab />}
      {tab === 'fichajes'  && <FichajesTab />}
    </div>
  )
}

export default function PaginaPlanificacion() {
  return (
    <Suspense>
      <PlanificacionContent />
    </Suspense>
  )
}

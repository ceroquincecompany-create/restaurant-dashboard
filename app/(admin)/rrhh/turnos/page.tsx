'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { Empleado, Turno } from '@/lib/supabase'
import { ChevronLeft, ChevronRight, Plus, X, Trash2, RefreshCw, Copy, Undo2 } from 'lucide-react'

// ─────────────────────────────────────────────
// Constantes
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

// ─────────────────────────────────────────────
// Utilidades de fecha
// ─────────────────────────────────────────────

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
function calcHoras(ini: string | null, fin: string | null): number {
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

// ─────────────────────────────────────────────
// Sistema de deshacer (localStorage)
// ─────────────────────────────────────────────

type UndoAntes = {
  tipo_turno: string
  hora_inicio: string | null
  hora_fin: string | null
  notas: string | null
}

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

// ─────────────────────────────────────────────
// Tipos formulario
// ─────────────────────────────────────────────

type FormTurno = { tipo_turno: string; hora_inicio: string; hora_fin: string; notas: string }
const FORM_VACIO: FormTurno = { tipo_turno: 'Mediodía', hora_inicio: '13:00', hora_fin: '16:00', notas: '' }

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white'

// ─────────────────────────────────────────────
// Componente Modal genérico
// ─────────────────────────────────────────────

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
// Página principal
// ─────────────────────────────────────────────

export default function PaginaTurnos() {
  const [semana, setSemana] = useState(() => inicioSemana(new Date()))
  // Solo empleados activos en la tabla
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [loading, setLoading] = useState(true)

  // Modal turno
  const [celda, setCelda] = useState<{ empId: number; fecha: string } | null>(null)
  const [turnoEditar, setTurnoEditar] = useState<Turno | null>(null)
  const [form, setForm] = useState<FormTurno>(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  // Modal copiar semana
  const [modalCopiar, setModalCopiar] = useState(false)
  const [cargandoCopiar, setCargandoCopiar] = useState(false)
  const [turnosPrevSem, setTurnosPrevSem] = useState<Turno[]>([])
  const [empsCopiar, setEmpsCopiar] = useState<Set<number>>(new Set())
  const [modoCopiar, setModoCopiar] = useState<'añadir' | 'reemplazar'>('añadir')
  const [copiando, setCopiando] = useState(false)

  // Deshacer
  const [historial, setHistorial] = useState<AccionDeshacer[]>([])
  const [deshaciendo, setDeshaciendo] = useState(false)

  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => sumarDias(semana, i)), [semana])
  const fechaInicio = toISO(semana)
  const fechaFin    = toISO(sumarDias(semana, 6))

  // ── Carga ───────────────────────────────────
  const cargar = useCallback(async () => {
    setLoading(true)
    const [{ data: emps }, { data: trns }] = await Promise.all([
      // Solo activos
      supabase.from('empleados').select('*').eq('estado', 'activo').order('nombre'),
      supabase.from('turnos').select('*').gte('fecha', fechaInicio).lte('fecha', fechaFin),
    ])
    setEmpleados(emps ?? [])
    setTurnos(trns ?? [])
    setLoading(false)
  }, [fechaInicio, fechaFin])

  useEffect(() => { cargar() }, [cargar])

  // Cargar historial localStorage al montar
  useEffect(() => { setHistorial(cargarHistorial()) }, [])

  // ── Mapa celda → turnos ─────────────────────
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
      .reduce((s, t) => s + calcHoras(t.hora_inicio, t.hora_fin), 0)
  }

  // KPIs — solo empleados activos
  const activos        = empleados.length
  const totalContrato  = empleados.reduce((s, e) => s + Number(e.horas_contrato ?? 0), 0)
  const totalAsignadas = empleados.reduce((s, e) => s + horasEmp(e.id), 0)
  const vacsSemana     = turnos.filter((t) => t.tipo_turno === 'Vacaciones').length

  // ── Helpers historial ───────────────────────
  function pushUndo(accion: AccionDeshacer) {
    setHistorial((h) => {
      const nuevo = [accion, ...h].slice(0, MAX_HISTORIAL)
      guardarHistorial(nuevo)
      return nuevo
    })
  }

  // ── Modal turno ─────────────────────────────
  function abrirCelda(empId: number, fecha: string) {
    setCelda({ empId, fecha }); setTurnoEditar(null); setForm(FORM_VACIO); setError('')
  }
  function abrirEditar(t: Turno, e: React.MouseEvent) {
    e.stopPropagation()
    setCelda({ empId: t.empleado_id, fecha: t.fecha })
    setTurnoEditar(t)
    setForm({ tipo_turno: t.tipo_turno, hora_inicio: t.hora_inicio ?? '13:00', hora_fin: t.hora_fin ?? '16:00', notas: t.notas ?? '' })
    setError('')
  }
  function cerrar() { setCelda(null); setTurnoEditar(null); setForm(FORM_VACIO); setError('') }

  async function guardar() {
    if (!celda) return
    setGuardando(true)
    const payload = {
      empleado_id: celda.empId,
      fecha: celda.fecha,
      tipo_turno: form.tipo_turno,
      hora_inicio: form.hora_inicio || null,
      hora_fin: form.hora_fin || null,
      notas: form.notas || null,
    }
    const emp = empleados.find(e => e.id === celda.empId)
    if (turnoEditar) {
      const { error: err } = await supabase
        .from('turnos')
        .update({ tipo_turno: payload.tipo_turno, hora_inicio: payload.hora_inicio, hora_fin: payload.hora_fin, notas: payload.notas })
        .eq('id', turnoEditar.id)
      if (err) { setError(err.message); setGuardando(false); return }
      pushUndo({
        tipo: 'editar',
        id: turnoEditar.id,
        antes: { tipo_turno: turnoEditar.tipo_turno, hora_inicio: turnoEditar.hora_inicio, hora_fin: turnoEditar.hora_fin, notas: turnoEditar.notas },
        desc: `Editar turno ${turnoEditar.tipo_turno} — ${emp?.nombre.split(' ')[0]} ${turnoEditar.fecha}`,
      })
    } else {
      const { data, error: err } = await supabase.from('turnos').insert(payload).select().single()
      if (err || !data) { setError(err?.message ?? 'Error'); setGuardando(false); return }
      pushUndo({
        tipo: 'crear',
        turno: data as Turno,
        desc: `Crear turno ${form.tipo_turno} — ${emp?.nombre.split(' ')[0]} ${celda.fecha}`,
      })
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

  // ── Deshacer ─────────────────────────────────
  async function deshacer() {
    if (historial.length === 0 || deshaciendo) return
    const [ultima, ...resto] = historial
    setDeshaciendo(true)

    if (ultima.tipo === 'crear') {
      await supabase.from('turnos').delete().eq('id', ultima.turno.id)
    } else if (ultima.tipo === 'eliminar') {
      const { id, ...payload } = ultima.turno
      await supabase.from('turnos').insert(payload)
    } else if (ultima.tipo === 'editar') {
      await supabase.from('turnos').update(ultima.antes).eq('id', ultima.id)
    } else if (ultima.tipo === 'copiar_semana') {
      await supabase.from('turnos').delete().in('id', ultima.ids)
    }

    setHistorial(resto)
    guardarHistorial(resto)
    setDeshaciendo(false)
    cargar()
  }

  // ── Copiar semana anterior ───────────────────
  async function abrirModalCopiar() {
    setModalCopiar(true)
    setCargandoCopiar(true)
    const prevInicio = toISO(sumarDias(semana, -7))
    const prevFin    = toISO(sumarDias(semana, -1))
    const { data } = await supabase
      .from('turnos').select('*')
      .gte('fecha', prevInicio)
      .lte('fecha', prevFin)
    const prevTurnos = data ?? []
    setTurnosPrevSem(prevTurnos)
    // Pre-seleccionar todos los empleados con turnos en semana anterior (solo activos)
    const empIdsActivos = new Set(empleados.map(e => e.id))
    const idsConTurnos = new Set(prevTurnos.filter(t => empIdsActivos.has(t.empleado_id)).map(t => t.empleado_id))
    setEmpsCopiar(idsConTurnos)
    // Si ya hay turnos esta semana, sugerir "añadir"
    setModoCopiar(turnos.length > 0 ? 'añadir' : 'añadir')
    setCargandoCopiar(false)
  }

  function cerrarModalCopiar() {
    setModalCopiar(false)
    setTurnosPrevSem([])
    setEmpsCopiar(new Set())
    setCopiando(false)
  }

  function toggleEmpCopiar(empId: number) {
    setEmpsCopiar(prev => {
      const next = new Set(prev)
      next.has(empId) ? next.delete(empId) : next.add(empId)
      return next
    })
  }

  // Turnos de semana anterior filtrados por empleados seleccionados
  const turnosACopiar = useMemo(
    () => turnosPrevSem.filter(t => empsCopiar.has(t.empleado_id)),
    [turnosPrevSem, empsCopiar]
  )

  async function confirmarCopiar() {
    if (turnosACopiar.length === 0) return
    setCopiando(true)

    // Si "reemplazar": eliminar los turnos actuales de los empleados seleccionados
    if (modoCopiar === 'reemplazar') {
      const idsEmp = Array.from(empsCopiar)
      await supabase
        .from('turnos')
        .delete()
        .in('empleado_id', idsEmp)
        .gte('fecha', fechaInicio)
        .lte('fecha', fechaFin)
    }

    // Mapear a nuevas fechas (+ 7 días)
    const nuevos = turnosACopiar.map(({ id: _id, created_at: _ca, ...resto }) => ({
      ...resto,
      fecha: toISO(sumarDias(new Date(resto.fecha + 'T12:00:00'), 7)),
    }))

    const { data: insertados, error: err } = await supabase.from('turnos').insert(nuevos).select()
    setCopiando(false)

    if (err) { cerrarModalCopiar(); cargar(); return }

    const ids = (insertados ?? []).map((t: Turno) => t.id)
    const nEmps = empsCopiar.size
    pushUndo({
      tipo: 'copiar_semana',
      ids,
      desc: `Copiar semana anterior — ${ids.length} turnos de ${nEmps} empleado${nEmps !== 1 ? 's' : ''}`,
    })
    cerrarModalCopiar()
    cargar()
  }

  // ── Datos para modal copiar ──────────────────
  const empIdsActivos = useMemo(() => new Set(empleados.map(e => e.id)), [empleados])
  const empsConTurnosPrev = useMemo(
    () => empleados.filter(e => turnosPrevSem.some(t => t.empleado_id === e.id)),
    [empleados, turnosPrevSem]
  )
  const turnosSemActualCount = turnos.length

  const empModal = celda ? empleados.find((e) => e.id === celda.empId) : null
  const tituloSemana = `${formatDia(semana)} – ${formatDia(sumarDias(semana, 6))}`

  const ultimaAccion = historial[0]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="animate-spin text-[#F5B731]" size={24} />
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* ── Header ─────────────────────────────── */}
      <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Turnos</h1>
          <p className="text-sm text-gray-400 mt-0.5">Cuadrante semanal</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">

          {/* Botón Deshacer */}
          <button
            onClick={deshacer}
            disabled={historial.length === 0 || deshaciendo}
            title={ultimaAccion ? `Deshacer: ${ultimaAccion.desc}` : 'Sin acciones que deshacer'}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {deshaciendo ? <RefreshCw size={14} className="animate-spin" /> : <Undo2 size={14} />}
            Deshacer
            {historial.length > 0 && (
              <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5 font-mono leading-none">
                {historial.length}
              </span>
            )}
          </button>

          {/* Botón Copiar semana */}
          <button
            onClick={abrirModalCopiar}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Copy size={14} />
            Copiar semana anterior
          </button>

          {/* Navegación semana */}
          <div className="flex items-center gap-1">
            <button onClick={() => setSemana((d) => sumarDias(d, -7))} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => setSemana(inicioSemana(new Date()))} className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              Hoy
            </button>
            <span className="text-sm font-medium text-gray-700 px-1">{tituloSemana}</span>
            <button onClick={() => setSemana((d) => sumarDias(d, 7))} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ── KPIs — solo empleados activos ──────── */}
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

      {/* ── Leyenda ─────────────────────────────── */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {Object.entries(TURNO_STYLE).map(([tipo, s]) => (
          <span key={tipo} className="flex items-center gap-1.5 text-xs font-medium">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: s.bg }} />
            {tipo}
          </span>
        ))}
      </div>

      {/* ── Cuadrante ───────────────────────────── */}
      {empleados.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-sm text-gray-400">
          No hay empleados activos
        </div>
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
                        <span className={`block text-xs mt-0.5 ${esHoy ? 'font-bold' : 'font-normal text-gray-400'}`}>
                          {d.getDate()} {d.toLocaleDateString('es-ES', { month: 'short' })}
                        </span>
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
                        const fecha      = toISO(d)
                        const celdaTurnos = mapa[emp.id]?.[fecha] ?? []
                        return (
                          <td key={i} className="px-1.5 py-2 align-top cursor-pointer group" onClick={() => abrirCelda(emp.id, fecha)}>
                            <div className="min-h-[36px] flex flex-col gap-0.5">
                              {celdaTurnos.map((t) => {
                                const s = TURNO_STYLE[t.tipo_turno] ?? { bg: '#E5E7EB', text: '#374151', abbr: '?' }
                                return (
                                  <div key={t.id} className="relative group/chip w-full">
                                    <button
                                      onClick={(e) => abrirEditar(t, e)}
                                      className="flex flex-col items-center rounded px-1 py-0.5 text-[10px] font-bold leading-tight w-full hover:opacity-80 transition-opacity"
                                      style={{ backgroundColor: s.bg, color: s.text }}
                                    >
                                      <span>{s.abbr}</span>
                                      {t.hora_inicio && t.hora_fin && (
                                        <span className="text-[9px] opacity-70 font-normal">
                                          {t.hora_inicio.slice(0, 5)}-{t.hora_fin.slice(0, 5)}
                                        </span>
                                      )}
                                    </button>
                                    <button
                                      onClick={(e) => eliminarDirecto(t, e)}
                                      className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-black/60 text-white opacity-0 group-hover/chip:opacity-100 transition-opacity flex items-center justify-center"
                                      title="Eliminar turno"
                                    >
                                      <X size={7} />
                                    </button>
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
                        <p className={`text-[10px] font-medium ${desv >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {desv >= 0 ? '+' : ''}{desv.toFixed(1)}
                        </p>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          MODAL — Crear / Editar turno
      ══════════════════════════════════════════ */}
      {celda && (
        <Modal
          titulo={turnoEditar ? 'Editar turno' : `Nuevo turno — ${empModal?.nombre.split(' ')[0] ?? ''} · ${celda.fecha}`}
          onCerrar={cerrar}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">Tipo de turno</label>
              <div className="grid grid-cols-3 gap-1.5">
                {TIPOS_TURNO.map((tipo) => {
                  const s   = TURNO_STYLE[tipo]
                  const sel = form.tipo_turno === tipo
                  return (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, tipo_turno: tipo }))}
                      className={`px-2 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${
                        sel ? 'border-transparent' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                      }`}
                      style={sel ? { backgroundColor: s.bg, color: s.text, borderColor: s.bg } : {}}
                    >
                      {tipo}
                    </button>
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
                Duración: <strong>{calcHoras(form.hora_inicio, form.hora_fin).toFixed(1)}h</strong>
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
                <button
                  onClick={guardar}
                  disabled={guardando}
                  className="px-4 py-2 text-sm font-semibold bg-[#F5B731] text-[#1A1A1A] rounded-lg hover:bg-[#e0a820] transition-colors disabled:opacity-50"
                >
                  {guardando ? '...' : turnoEditar ? 'Guardar' : 'Añadir'}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ══════════════════════════════════════════
          MODAL — Copiar semana anterior
      ══════════════════════════════════════════ */}
      {modalCopiar && (
        <Modal titulo="Copiar semana anterior" onCerrar={cerrarModalCopiar} maxW="max-w-md">
          {cargandoCopiar ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="animate-spin text-[#F5B731]" size={22} />
            </div>
          ) : turnosPrevSem.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-500">No hay turnos en la semana anterior.</p>
              <button onClick={cerrarModalCopiar} className="mt-4 px-4 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cerrar</button>
            </div>
          ) : (
            <div className="space-y-5">

              {/* Aviso si ya hay turnos esta semana */}
              {turnosSemActualCount > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <p className="text-sm font-semibold text-amber-800">
                    Ya existen {turnosSemActualCount} turno{turnosSemActualCount !== 1 ? 's' : ''} esta semana
                  </p>
                  <p className="text-xs text-amber-600 mt-1">¿Qué hacer con los turnos existentes?</p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => setModoCopiar('añadir')}
                      className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg border-2 transition-all ${
                        modoCopiar === 'añadir'
                          ? 'bg-[#F5B731] text-[#1A1A1A] border-[#F5B731]'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      Añadir
                      <span className="block text-[10px] font-normal mt-0.5 opacity-80">Mantener existentes</span>
                    </button>
                    <button
                      onClick={() => setModoCopiar('reemplazar')}
                      className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg border-2 transition-all ${
                        modoCopiar === 'reemplazar'
                          ? 'bg-rose-500 text-white border-rose-500'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      Reemplazar
                      <span className="block text-[10px] font-normal mt-0.5 opacity-80">Borrar y sobreescribir</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Selección de empleados */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Empleados a copiar
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEmpsCopiar(new Set(empsConTurnosPrev.map(e => e.id)))}
                      className="text-xs text-[#F5B731] font-semibold hover:underline"
                    >
                      Todos
                    </button>
                    <span className="text-gray-300">·</span>
                    <button
                      onClick={() => setEmpsCopiar(new Set())}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      Ninguno
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {empsConTurnosPrev.length === 0 && (
                    <p className="text-sm text-gray-400 py-2">Sin empleados activos con turnos la semana anterior</p>
                  )}
                  {empsConTurnosPrev.map((emp) => {
                    const nTurnos = turnosPrevSem.filter(t => t.empleado_id === emp.id).length
                    const sel = empsCopiar.has(emp.id)
                    return (
                      <label key={emp.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${sel ? 'bg-[#F5B731]/10' : 'hover:bg-gray-50'}`}>
                        <input
                          type="checkbox"
                          checked={sel}
                          onChange={() => toggleEmpCopiar(emp.id)}
                          className="w-4 h-4 rounded accent-[#F5B731] flex-shrink-0"
                        />
                        <span className="text-sm font-medium text-gray-800 flex-1">{emp.nombre}</span>
                        <span className="text-xs text-gray-400">{nTurnos} turno{nTurnos !== 1 ? 's' : ''}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Resumen */}
              <div className={`rounded-xl px-4 py-3 ${turnosACopiar.length > 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-50 border border-gray-200'}`}>
                <p className={`text-sm font-semibold ${turnosACopiar.length > 0 ? 'text-emerald-700' : 'text-gray-500'}`}>
                  {turnosACopiar.length > 0
                    ? `Se copiarán ${turnosACopiar.length} turno${turnosACopiar.length !== 1 ? 's' : ''} de ${empsCopiar.size} empleado${empsCopiar.size !== 1 ? 's' : ''}`
                    : 'Selecciona al menos un empleado'
                  }
                </p>
                {modoCopiar === 'reemplazar' && turnosSemActualCount > 0 && turnosACopiar.length > 0 && (
                  <p className="text-xs text-rose-600 mt-1">
                    Se eliminarán los turnos existentes de los empleados seleccionados
                  </p>
                )}
              </div>

              {/* Botones */}
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={cerrarModalCopiar} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
                  Cancelar
                </button>
                <button
                  onClick={confirmarCopiar}
                  disabled={turnosACopiar.length === 0 || copiando}
                  className="px-5 py-2 text-sm font-semibold bg-[#F5B731] text-[#1A1A1A] rounded-lg hover:bg-[#e0a820] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
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

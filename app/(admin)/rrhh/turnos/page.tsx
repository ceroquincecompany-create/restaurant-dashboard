'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { Empleado, Turno } from '@/lib/supabase'
import { ChevronLeft, ChevronRight, Plus, X, Trash2, RefreshCw } from 'lucide-react'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const TIPOS_TURNO = ['Mediodía', 'Noche', 'Medio mediodía', 'Vacaciones', 'Baja']

const TURNO_STYLE: Record<string, { bg: string; text: string; abbr: string }> = {
  'Mediodía':      { bg: '#F5B731', text: '#1A1A1A', abbr: 'MD' },
  'Noche':         { bg: '#2563EB', text: '#fff',    abbr: 'NO' },
  'Medio mediodía':{ bg: '#EC4899', text: '#fff',    abbr: 'MM' },
  'Vacaciones':    { bg: '#16A34A', text: '#fff',    abbr: 'VAC' },
  'Baja':          { bg: '#6B7280', text: '#fff',    abbr: 'BAJA' },
}

function inicioSemana(d: Date): Date {
  const dd = new Date(d)
  dd.setHours(0, 0, 0, 0)
  const dia = dd.getDay()
  dd.setDate(dd.getDate() - (dia === 0 ? 6 : dia - 1))
  return dd
}

function sumarDias(d: Date, n: number): Date {
  const dd = new Date(d)
  dd.setDate(dd.getDate() + n)
  return dd
}

function toISO(d: Date): string {
  return d.toISOString().split('T')[0]
}

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

type FormTurno = { tipo_turno: string; hora_inicio: string; hora_fin: string; notas: string }
const FORM_VACIO: FormTurno = { tipo_turno: 'Mediodía', hora_inicio: '13:00', hora_fin: '16:00', notas: '' }

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white'

function Modal({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">{titulo}</h2>
          <button onClick={onCerrar} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

export default function PaginaTurnos() {
  const [semana, setSemana] = useState(() => inicioSemana(new Date()))
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [loading, setLoading] = useState(true)
  const [celda, setCelda] = useState<{ empId: number; fecha: string } | null>(null)
  const [turnoEditar, setTurnoEditar] = useState<Turno | null>(null)
  const [form, setForm] = useState<FormTurno>(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => sumarDias(semana, i)), [semana])
  const fechaInicio = toISO(semana)
  const fechaFin = toISO(sumarDias(semana, 6))

  const cargar = useCallback(async () => {
    setLoading(true)
    const [{ data: emps }, { data: trns }] = await Promise.all([
      supabase.from('empleados').select('*').order('nombre'),
      supabase.from('turnos').select('*').gte('fecha', fechaInicio).lte('fecha', fechaFin),
    ])
    setEmpleados(emps ?? [])
    setTurnos(trns ?? [])
    setLoading(false)
  }, [fechaInicio, fechaFin])

  useEffect(() => { cargar() }, [cargar])

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

  // KPIs
  const activos = empleados.filter((e) => e.estado === 'activo').length
  const totalContrato = empleados.reduce((s, e) => s + Number(e.horas_contrato), 0)
  const totalAsignadas = empleados.reduce((s, e) => s + horasEmp(e.id), 0)
  const vacsSemana = turnos.filter((t) => t.tipo_turno === 'Vacaciones').length

  function abrirCelda(empId: number, fecha: string) {
    setCelda({ empId, fecha })
    setTurnoEditar(null)
    setForm(FORM_VACIO)
    setError('')
  }

  function abrirEditar(t: Turno, e: React.MouseEvent) {
    e.stopPropagation()
    setCelda({ empId: t.empleado_id, fecha: t.fecha })
    setTurnoEditar(t)
    setForm({ tipo_turno: t.tipo_turno, hora_inicio: t.hora_inicio ?? '13:00', hora_fin: t.hora_fin ?? '16:00', notas: t.notas ?? '' })
    setError('')
  }

  function cerrar() {
    setCelda(null)
    setTurnoEditar(null)
    setForm(FORM_VACIO)
    setError('')
  }

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
    let err
    if (turnoEditar) {
      ;({ error: err } = await supabase.from('turnos').update({ tipo_turno: payload.tipo_turno, hora_inicio: payload.hora_inicio, hora_fin: payload.hora_fin, notas: payload.notas }).eq('id', turnoEditar.id))
    } else {
      ;({ error: err } = await supabase.from('turnos').insert(payload))
    }
    if (err) { setError(err.message); setGuardando(false); return }
    setGuardando(false)
    cerrar()
    cargar()
  }

  async function eliminar() {
    if (!turnoEditar) return
    await supabase.from('turnos').delete().eq('id', turnoEditar.id)
    cerrar()
    cargar()
  }

  async function eliminarDirecto(id: number, e: React.MouseEvent) {
    e.stopPropagation()
    await supabase.from('turnos').delete().eq('id', id)
    cargar()
  }

  const empModal = celda ? empleados.find((e) => e.id === celda.empId) : null

  const tituloSemana = `${formatDia(semana)} – ${formatDia(sumarDias(semana, 6))}`

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="animate-spin text-[#F5B731]" size={24} />
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Turnos</h1>
          <p className="text-sm text-gray-400 mt-0.5">Cuadrante semanal</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSemana((d) => sumarDias(d, -7))}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setSemana(inicioSemana(new Date()))}
            className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Hoy
          </button>
          <span className="text-sm font-medium text-gray-700 px-1">{tituloSemana}</span>
          <button
            onClick={() => setSemana((d) => sumarDias(d, 7))}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Empleados activos', value: activos, sub: '' },
          { label: 'Horas asignadas', value: `${totalAsignadas.toFixed(0)}h`, sub: '' },
          { label: 'Horas contrato', value: `${totalContrato.toFixed(0)}h`, sub: '' },
          { label: 'Vacaciones semana', value: vacsSemana, sub: 'días' },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-2xl font-bold text-gray-900">{k.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {Object.entries(TURNO_STYLE).map(([tipo, s]) => (
          <span
            key={tipo}
            className="flex items-center gap-1.5 text-xs font-medium"
          >
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: s.bg }} />
            {tipo}
          </span>
        ))}
      </div>

      {/* Grid */}
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
                  const desv = horas - Number(emp.horas_contrato)
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
                          <td
                            key={i}
                            className="px-1.5 py-2 align-top cursor-pointer group"
                            onClick={() => abrirCelda(emp.id, fecha)}
                          >
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
                                          {t.hora_inicio.slice(0,5)}-{t.hora_fin.slice(0,5)}
                                        </span>
                                      )}
                                    </button>
                                    <button
                                      onClick={(e) => eliminarDirecto(t.id, e)}
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
                  const s = TURNO_STYLE[tipo]
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
                <input
                  type="time"
                  className={inputCls}
                  value={form.hora_inicio}
                  onChange={(e) => setForm((f) => ({ ...f, hora_inicio: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Hora fin</label>
                <input
                  type="time"
                  className={inputCls}
                  value={form.hora_fin}
                  onChange={(e) => setForm((f) => ({ ...f, hora_fin: e.target.value }))}
                />
              </div>
            </div>

            {form.hora_inicio && form.hora_fin && (
              <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-500 text-center">
                Duración: <strong>{calcHoras(form.hora_inicio, form.hora_fin).toFixed(1)}h</strong>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Notas</label>
              <input
                className={inputCls}
                value={form.notas}
                onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                placeholder="Opcional"
              />
            </div>

            {error && <p className="text-xs text-rose-500">{error}</p>}

            <div className="flex items-center justify-between pt-1">
              <div>
                {turnoEditar && (
                  <button
                    onClick={eliminar}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={13} />
                    Eliminar
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={cerrar} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                  Cancelar
                </button>
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
    </div>
  )
}

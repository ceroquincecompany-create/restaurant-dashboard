'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { Empleado, Fichaje } from '@/lib/supabase'
import { Plus, X, Pencil, Trash2, Download, RefreshCw, ClipboardList, List, LayoutGrid } from 'lucide-react'

function calcHoras(entrada: string, salida: string): { total: number; nocturnas: number } {
  if (!entrada || !salida) return { total: 0, nocturnas: 0 }
  const [h1, m1] = entrada.split(':').map(Number)
  const [h2, m2] = salida.split(':').map(Number)
  const inicioMin = h1 * 60 + m1
  let finMin = h2 * 60 + m2
  if (finMin <= inicioMin) finMin += 24 * 60
  const total = (finMin - inicioMin) / 60
  const NOCHE_INI = 22 * 60, NOCHE_FIN = 30 * 60
  const nocturnas = Math.max(0, Math.min(finMin, NOCHE_FIN) - Math.max(inicioMin, NOCHE_INI)) / 60
  return { total: Math.round(total * 100) / 100, nocturnas: Math.round(nocturnas * 100) / 100 }
}

function descargarCSV(rows: string[][], nombre: string) {
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = nombre; a.click()
  URL.revokeObjectURL(url)
}

type FormFichaje = {
  empleado_id: string
  fecha: string
  hora_entrada: string
  hora_salida: string
  horas_extra: string
}

const FORM_VACIO: FormFichaje = {
  empleado_id: '', fecha: new Date().toISOString().split('T')[0],
  hora_entrada: '', hora_salida: '', horas_extra: '0',
}

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white'

function Modal({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">{titulo}</h2>
          <button onClick={onCerrar} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────
// Tipos para la vista agrupada
// ──────────────────────────────────────────────────────
type FilaDia = {
  empleadoId: number
  empleadoNombre: string
  fecha: string
  fichajes: Fichaje[]
  totalHoras: number
  totalNocturnas: number
  totalExtra: number
}

export default function PaginaFichajes() {
  const [fichajes, setFichajes] = useState<Fichaje[]>([])
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEmp, setFiltroEmp] = useState('')
  const [fechaDesde, setFechaDesde] = useState(() => {
    const d = new Date(); d.setDate(1)
    return d.toISOString().split('T')[0]
  })
  const [fechaHasta, setFechaHasta] = useState(() => new Date().toISOString().split('T')[0])
  const [vista, setVista] = useState<'detalle' | 'agrupada'>('agrupada')
  const [modal, setModal] = useState(false)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [form, setForm] = useState<FormFichaje>(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [confirmEliminar, setConfirmEliminar] = useState<number | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    const [{ data: fichs }, { data: emps }] = await Promise.all([
      supabase
        .from('fichajes')
        .select('*')
        .order('fecha', { ascending: false })
        .order('empleado_id')
        .order('hora_entrada', { ascending: true }),
      supabase.from('empleados').select('*').eq('activo', true).order('nombre'),
    ])
    setFichajes(fichs ?? [])
    setEmpleados(emps ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const filtrados = useMemo(() => {
    return fichajes.filter((f) => {
      const matchEmp = !filtroEmp || String(f.empleado_id) === filtroEmp
      return matchEmp && f.fecha >= fechaDesde && f.fecha <= fechaHasta
    })
  }, [fichajes, filtroEmp, fechaDesde, fechaHasta])

  // Vista agrupada: por empleado + fecha
  const filasDia = useMemo((): FilaDia[] => {
    const mapa = new Map<string, FilaDia>()
    for (const f of filtrados) {
      const emp = empleados.find(e => e.id === f.empleado_id)
      const key = `${f.empleado_id}_${f.fecha}`
      if (!mapa.has(key)) {
        mapa.set(key, {
          empleadoId: f.empleado_id,
          empleadoNombre: emp?.nombre ?? String(f.empleado_id),
          fecha: f.fecha,
          fichajes: [],
          totalHoras: 0,
          totalNocturnas: 0,
          totalExtra: 0,
        })
      }
      const fila = mapa.get(key)!
      fila.fichajes.push(f)
      fila.totalHoras += f.horas_total ?? 0
      fila.totalNocturnas += f.horas_nocturnas ?? 0
      fila.totalExtra += f.horas_extra ?? 0
    }
    // Redondear
    for (const fila of mapa.values()) {
      fila.totalHoras = Math.round(fila.totalHoras * 100) / 100
      fila.totalNocturnas = Math.round(fila.totalNocturnas * 100) / 100
      fila.totalExtra = Math.round(fila.totalExtra * 100) / 100
    }
    return Array.from(mapa.values()).sort((a, b) =>
      b.fecha.localeCompare(a.fecha) || a.empleadoNombre.localeCompare(b.empleadoNombre)
    )
  }, [filtrados, empleados])

  const resumen = useMemo(() => {
    const totalH = filtrados.reduce((s, f) => s + (f.horas_total ?? 0), 0)
    const noctH = filtrados.reduce((s, f) => s + (f.horas_nocturnas ?? 0), 0)
    const extraH = filtrados.reduce((s, f) => s + (f.horas_extra ?? 0), 0)
    return {
      total: Math.round(totalH * 100) / 100,
      nocturnas: Math.round(noctH * 100) / 100,
      extra: Math.round(extraH * 100) / 100,
      normal: Math.round(Math.max(0, totalH - extraH - noctH) * 100) / 100,
    }
  }, [filtrados])

  const autoCalc = useMemo(() => {
    if (!form.hora_entrada || !form.hora_salida) return null
    return calcHoras(form.hora_entrada, form.hora_salida)
  }, [form.hora_entrada, form.hora_salida])

  function abrirCrear() {
    setEditandoId(null)
    setForm({ ...FORM_VACIO, empleado_id: filtroEmp || '' })
    setError(''); setModal(true)
  }

  function abrirEditar(f: Fichaje) {
    setEditandoId(f.id)
    setForm({
      empleado_id: String(f.empleado_id),
      fecha: f.fecha,
      hora_entrada: f.hora_entrada ?? '',
      hora_salida: f.hora_salida ?? '',
      horas_extra: String(f.horas_extra ?? 0),
    })
    setError(''); setModal(true)
  }

  function cerrar() {
    setModal(false); setEditandoId(null); setForm(FORM_VACIO); setError('')
  }

  async function guardar() {
    if (!form.empleado_id) { setError('Selecciona un empleado'); return }
    if (!form.fecha) { setError('La fecha es obligatoria'); return }
    setGuardando(true); setError('')
    const { total, nocturnas } = autoCalc ?? { total: 0, nocturnas: 0 }
    const payload = {
      empleado_id: Number(form.empleado_id),
      fecha: form.fecha,
      hora_entrada: form.hora_entrada || null,
      hora_salida: form.hora_salida || null,
      horas_total: total || null,
      horas_nocturnas: nocturnas || null,
      horas_extra: parseFloat(form.horas_extra) || null,
    }
    let err
    if (editandoId !== null) {
      ;({ error: err } = await supabase.from('fichajes').update(payload).eq('id', editandoId))
    } else {
      ;({ error: err } = await supabase.from('fichajes').insert(payload))
    }
    if (err) { setError(err.message); setGuardando(false); return }
    setGuardando(false); cerrar(); cargar()
  }

  async function eliminar(id: number) {
    await supabase.from('fichajes').delete().eq('id', id)
    setConfirmEliminar(null); cargar()
  }

  function exportarCSV() {
    // Vista de detalle (un fichaje por fila)
    const cabecera = ['Empleado', 'Fecha', 'Entrada', 'Salida', 'Total (h)', 'Nocturnas (h)', 'Extra (h)']
    const filas = filtrados.map((f) => {
      const emp = empleados.find((e) => e.id === f.empleado_id)
      return [
        emp?.nombre ?? String(f.empleado_id),
        f.fecha,
        f.hora_entrada?.slice(0, 5) ?? '',
        f.hora_salida?.slice(0, 5) ?? '',
        String(f.horas_total ?? 0),
        String(f.horas_nocturnas ?? 0),
        String(f.horas_extra ?? 0),
      ]
    })
    descargarCSV([cabecera, ...filas], `fichajes_${fechaDesde}_${fechaHasta}.csv`)
  }

  function exportarAgrupado() {
    // Vista agrupada — un día por fila con total de turnos
    const cabecera = ['Empleado', 'Fecha', 'Turnos', 'Detalle', 'Total (h)', 'Nocturnas (h)', 'Extra (h)']
    const filas = filasDia.map((fila) => {
      const detalle = fila.fichajes
        .map(f => `${f.hora_entrada?.slice(0,5) ?? '?'}-${f.hora_salida?.slice(0,5) ?? '?'}`)
        .join(' | ')
      return [
        fila.empleadoNombre,
        fila.fecha,
        String(fila.fichajes.length),
        detalle,
        String(fila.totalHoras),
        String(fila.totalNocturnas),
        String(fila.totalExtra),
      ]
    })
    descargarCSV([cabecera, ...filas], `fichajes_agrupado_${fechaDesde}_${fechaHasta}.csv`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="animate-spin text-[#F5B731]" size={24} />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Control de Fichajes</h1>
          <p className="text-sm text-gray-400 mt-0.5">Registro de entradas y salidas · múltiples turnos por día</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={vista === 'agrupada' ? exportarAgrupado : exportarCSV}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download size={14} /> Exportar CSV
          </button>
          <button
            onClick={abrirCrear}
            className="flex items-center gap-2 px-4 py-2 bg-[#F5B731] text-[#1A1A1A] text-sm font-semibold rounded-lg hover:bg-[#e0a820] transition-colors"
          >
            <Plus size={15} /> Nuevo fichaje
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Horas normales',  value: resumen.normal.toFixed(1) + 'h',   cls: 'text-gray-800' },
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

      {/* Filtros + toggle vista */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <select
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white"
          value={filtroEmp}
          onChange={(e) => setFiltroEmp(e.target.value)}
        >
          <option value="">Todos los empleados</option>
          {empleados.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <input type="date" className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731]" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
          <span className="text-gray-400 text-sm">—</span>
          <input type="date" className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731]" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
        </div>
        <span className="text-xs text-gray-400 flex-1">{filtrados.length} registros</span>

        {/* Toggle vista */}
        <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-1">
          <button
            onClick={() => setVista('agrupada')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              vista === 'agrupada' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <LayoutGrid size={13} /> Por día
          </button>
          <button
            onClick={() => setVista('detalle')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              vista === 'detalle' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <List size={13} /> Detalle
          </button>
        </div>
      </div>

      {/* ══ VISTA AGRUPADA (por empleado + día) ══════════════ */}
      {vista === 'agrupada' && (
        filasDia.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
            <ClipboardList size={32} className="mx-auto text-gray-200 mb-3" />
            <p className="text-sm text-gray-400">No hay fichajes para este período</p>
          </div>
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
                        <td className="px-4 py-3 text-gray-500">
                          {new Date(fila.fecha + 'T12:00:00').toLocaleDateString('es-ES', {
                            weekday: 'short', day: 'numeric', month: 'short',
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {fila.fichajes.map(f => (
                              <span
                                key={f.id}
                                className={`inline-flex items-center gap-1 text-xs font-mono px-2 py-1 rounded-md ${
                                  !f.hora_salida
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {f.hora_entrada?.slice(0, 5) ?? '?'} → {f.hora_salida?.slice(0, 5) ?? '…'}
                                <button
                                  onClick={() => abrirEditar(f)}
                                  className="ml-0.5 text-gray-400 hover:text-[#F5B731] transition-colors"
                                  title="Editar"
                                >
                                  <Pencil size={10} />
                                </button>
                                {confirmEliminar === f.id ? (
                                  <span className="flex items-center gap-0.5 ml-0.5">
                                    <button onClick={() => eliminar(f.id)} className="text-rose-500 hover:text-rose-700 text-xs font-bold">✓</button>
                                    <button onClick={() => setConfirmEliminar(null)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => setConfirmEliminar(f.id)}
                                    className="ml-0.5 text-gray-400 hover:text-rose-500 transition-colors"
                                    title="Eliminar"
                                  >
                                    <Trash2 size={10} />
                                  </button>
                                )}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {tieneAbierto ? (
                            <span className="text-emerald-600 font-medium text-xs">En curso</span>
                          ) : (
                            <span className="font-semibold text-gray-800">{fila.totalHoras.toFixed(1)}h</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {fila.totalNocturnas > 0 ? (
                            <span className="text-blue-700 font-medium">{fila.totalNocturnas.toFixed(1)}h</span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {fila.totalExtra > 0 ? (
                            <span className="text-amber-600 font-medium">{fila.totalExtra.toFixed(1)}h</span>
                          ) : <span className="text-gray-300">—</span>}
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

      {/* ══ VISTA DETALLE (un fichaje por fila) ══════════════ */}
      {vista === 'detalle' && (
        filtrados.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
            <ClipboardList size={32} className="mx-auto text-gray-200 mb-3" />
            <p className="text-sm text-gray-400">No hay fichajes para este período</p>
          </div>
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
                        <td className="px-4 py-3 text-center font-mono">
                          {f.hora_salida
                            ? <span className="text-gray-700">{f.hora_salida.slice(0, 5)}</span>
                            : <span className="text-emerald-600 font-medium text-xs">En curso</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-gray-800">
                          {f.horas_total != null ? `${f.horas_total}h` : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {(f.horas_nocturnas ?? 0) > 0
                            ? <span className="text-blue-700 font-medium">{f.horas_nocturnas}h</span>
                            : <span className="text-gray-300">—</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-center">
                          {(f.horas_extra ?? 0) > 0
                            ? <span className="text-amber-600 font-medium">{f.horas_extra}h</span>
                            : <span className="text-gray-300">—</span>
                          }
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => abrirEditar(f)} className="p-1.5 text-gray-400 hover:text-[#F5B731] transition-colors rounded">
                              <Pencil size={13} />
                            </button>
                            {confirmEliminar === f.id ? (
                              <span className="flex items-center gap-1">
                                <button onClick={() => eliminar(f.id)} className="px-2 py-0.5 bg-rose-500 text-white rounded text-xs font-medium">Sí</button>
                                <button onClick={() => setConfirmEliminar(null)} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium">No</button>
                              </span>
                            ) : (
                              <button onClick={() => setConfirmEliminar(f.id)} className="p-1.5 text-gray-400 hover:text-rose-500 transition-colors rounded">
                                <Trash2 size={13} />
                              </button>
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

      {/* Modal crear/editar */}
      {modal && (
        <Modal titulo={editandoId !== null ? 'Editar fichaje' : 'Registrar fichaje'} onCerrar={cerrar}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Empleado *</label>
              <select
                className={inputCls}
                value={form.empleado_id}
                onChange={(e) => setForm((f) => ({ ...f, empleado_id: e.target.value }))}
              >
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
                <div className="text-center">
                  <p className="font-bold text-gray-800 text-base">{autoCalc.total.toFixed(1)}h</p>
                  <p className="text-gray-400">Total calculado</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-blue-700 text-base">{autoCalc.nocturnas.toFixed(1)}h</p>
                  <p className="text-gray-400">Nocturnas (22-06h)</p>
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Horas extra</label>
              <input type="number" className={inputCls} value={form.horas_extra} onChange={(e) => setForm((f) => ({ ...f, horas_extra: e.target.value }))} min="0" step="0.5" />
            </div>
            {error && <p className="text-xs text-rose-500">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={cerrar} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
              <button
                onClick={guardar}
                disabled={guardando}
                className="px-4 py-2 text-sm font-semibold bg-[#F5B731] text-[#1A1A1A] rounded-lg hover:bg-[#e0a820] disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : editandoId !== null ? 'Guardar' : 'Registrar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { Limpieza, Local } from '@/lib/supabase'
import { Plus, X, Trash2, RefreshCw, Sparkles, AlertTriangle, Clock } from 'lucide-react'

type Frecuencia = 'diaria' | 'semanal' | 'mensual'

const TAREAS: { label: string; frecuencia: Frecuencia }[] = [
  // Diarias
  { label: 'Utensilios cocina', frecuencia: 'diaria' },
  { label: 'Superficies cocina', frecuencia: 'diaria' },
  { label: 'Superficies horizontales', frecuencia: 'diaria' },
  { label: 'Superficies verticales', frecuencia: 'diaria' },
  { label: 'Baños', frecuencia: 'diaria' },
  // Semanales
  { label: 'Freidora', frecuencia: 'semanal' },
  { label: 'Campana', frecuencia: 'semanal' },
  { label: 'Separador de grasas', frecuencia: 'semanal' },
  { label: 'Tras inmobiliario', frecuencia: 'semanal' },
  { label: 'Cámaras frigoríficas', frecuencia: 'semanal' },
  // Mensuales
  { label: 'Congelador', frecuencia: 'mensual' },
  { label: 'Tuberías gas', frecuencia: 'mensual' },
  { label: 'Zonas difíciles acceso', frecuencia: 'mensual' },
]

const FREC_CFG: Record<Frecuencia, { label: string; cls: string; diasAlerta: number }> = {
  diaria:   { label: 'Diaria',   cls: 'bg-blue-100 text-blue-700',   diasAlerta: 1 },
  semanal:  { label: 'Semanal',  cls: 'bg-purple-100 text-purple-700', diasAlerta: 7 },
  mensual:  { label: 'Mensual',  cls: 'bg-gray-100 text-gray-600',   diasAlerta: 30 },
}

type FormLimpieza = {
  local_id: string
  empleado_nombre: string
  tarea: string
  fecha: string
  notas: string
}

const FORM_VACIO: FormLimpieza = {
  local_id: '', empleado_nombre: '', tarea: '',
  fecha: new Date().toISOString().split('T')[0], notas: '',
}

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white'

function Modal({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">{titulo}</h2>
          <button onClick={onCerrar} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

function diasDesde(fechaStr: string): number {
  const ahora = new Date()
  ahora.setHours(0, 0, 0, 0)
  const fecha = new Date(fechaStr + 'T00:00:00')
  return Math.floor((ahora.getTime() - fecha.getTime()) / (1000 * 60 * 60 * 24))
}

export default function PaginaLimpiezas() {
  const [limpiezas, setLimpiezas] = useState<Limpieza[]>([])
  const [locales, setLocales] = useState<Local[]>([])
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState<'estado' | 'historial'>('estado')
  const [filtroLocal, setFiltroLocal] = useState('')
  const [filtroFrec, setFiltroFrec] = useState<Frecuencia | ''>('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<FormLimpieza>(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [confirmEliminar, setConfirmEliminar] = useState<number | null>(null)

  const cargar = useCallback(async () => {
    const [{ data: l }, { data: loc }] = await Promise.all([
      supabase.from('limpiezas').select('*').order('fecha', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('locales').select('*').eq('activo', true).order('nombre'),
    ])
    setLimpiezas(l ?? [])
    setLocales(loc ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // Estado actual: la limpieza más reciente por tarea (y local si filtrado)
  const estadoActual = useMemo(() => {
    const filtLocal = filtroLocal ? limpiezas.filter(l => String(l.local_id) === filtroLocal) : limpiezas
    const ultimaPorTarea = new Map<string, Limpieza>()
    filtLocal.forEach(l => {
      const key = `${l.local_id ?? 'x'}_${l.tarea}`
      if (!ultimaPorTarea.has(key) || l.fecha > ultimaPorTarea.get(key)!.fecha) {
        ultimaPorTarea.set(key, l)
      }
    })
    return TAREAS.map(t => {
      // Find the best match considering local filter
      let ultima: Limpieza | undefined
      if (filtroLocal) {
        ultima = ultimaPorTarea.get(`${filtroLocal}_${t.label}`)
      } else {
        // Without filter: show most recent across all locals
        let best: Limpieza | undefined
        limpiezas.forEach(l => {
          if (l.tarea === t.label) {
            if (!best || l.fecha > best.fecha) best = l
          }
        })
        ultima = best
      }
      const dias = ultima ? diasDesde(ultima.fecha) : null
      const diasAlerta = FREC_CFG[t.frecuencia].diasAlerta
      const alerta = dias == null ? true : dias >= diasAlerta
      return { ...t, ultima, dias, alerta }
    })
  }, [limpiezas, filtroLocal])

  const alertaCount = useMemo(() => estadoActual.filter(e => e.alerta).length, [estadoActual])

  const historialFiltrado = useMemo(() => {
    return limpiezas.filter(l => {
      const matchLocal = !filtroLocal || String(l.local_id) === filtroLocal
      const matchFrec = !filtroFrec || l.frecuencia === filtroFrec
      return matchLocal && matchFrec
    })
  }, [limpiezas, filtroLocal, filtroFrec])

  function abrirCrear(tareaPreseleccionada?: string) {
    setForm({
      ...FORM_VACIO,
      local_id: filtroLocal || '',
      tarea: tareaPreseleccionada || '',
    })
    setError('')
    setModal(true)
  }

  function cerrar() {
    setModal(false)
    setForm(FORM_VACIO)
    setError('')
  }

  async function guardar() {
    if (!form.empleado_nombre.trim()) { setError('Indica quién realizó la limpieza'); return }
    if (!form.tarea) { setError('Selecciona la tarea realizada'); return }
    setGuardando(true)
    setError('')
    const tareaConfig = TAREAS.find(t => t.label === form.tarea)
    const payload = {
      local_id: form.local_id ? Number(form.local_id) : null,
      empleado_nombre: form.empleado_nombre.trim(),
      tarea: form.tarea,
      frecuencia: tareaConfig?.frecuencia ?? 'diaria',
      fecha: form.fecha,
      notas: form.notas.trim() || null,
    }
    const { error: err } = await supabase.from('limpiezas').insert(payload)
    if (err) { setError(err.message); setGuardando(false); return }
    setGuardando(false)
    cerrar()
    cargar()
  }

  async function eliminar(id: number) {
    await supabase.from('limpiezas').delete().eq('id', id)
    setConfirmEliminar(null)
    cargar()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="animate-spin text-[#F5B731]" size={24} />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Limpiezas</h1>
          <p className="text-sm text-gray-400 mt-0.5">Registro y control de tareas de limpieza APPCC</p>
        </div>
        <button
          onClick={() => abrirCrear()}
          className="flex items-center gap-2 px-4 py-2 bg-[#F5B731] text-[#1A1A1A] text-sm font-semibold rounded-lg hover:bg-[#e0a820] transition-colors"
        >
          <Plus size={15} />
          Registrar limpieza
        </button>
      </div>

      {/* Filtros y vista */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => setVista('estado')}
            className={`px-3 py-2 text-sm font-medium transition-colors ${vista === 'estado' ? 'bg-[#F5B731] text-[#1A1A1A]' : 'bg-white text-gray-500 hover:text-gray-700'}`}
          >
            Estado actual
          </button>
          <button
            onClick={() => setVista('historial')}
            className={`px-3 py-2 text-sm font-medium transition-colors ${vista === 'historial' ? 'bg-[#F5B731] text-[#1A1A1A]' : 'bg-white text-gray-500 hover:text-gray-700'}`}
          >
            Historial
          </button>
        </div>
        <select
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white"
          value={filtroLocal}
          onChange={e => setFiltroLocal(e.target.value)}
        >
          <option value="">Todos los locales</option>
          {locales.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
        </select>
        {vista === 'historial' && (
          <select
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white"
            value={filtroFrec}
            onChange={e => setFiltroFrec(e.target.value as Frecuencia | '')}
          >
            <option value="">Todas las frecuencias</option>
            {(Object.keys(FREC_CFG) as Frecuencia[]).map(f => (
              <option key={f} value={f}>{FREC_CFG[f].label}</option>
            ))}
          </select>
        )}
        {vista === 'estado' && alertaCount > 0 && (
          <span className="flex items-center gap-1 text-xs font-medium text-rose-600 bg-rose-50 px-2 py-1 rounded-full">
            <AlertTriangle size={12} />
            {alertaCount} tarea{alertaCount !== 1 ? 's' : ''} pendiente{alertaCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* VISTA ESTADO ACTUAL */}
      {vista === 'estado' && (
        <div className="space-y-4">
          {(['diaria', 'semanal', 'mensual'] as Frecuencia[]).map(freq => {
            const tareasFreq = estadoActual.filter(t => t.frecuencia === freq)
            return (
              <div key={freq}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  {FREC_CFG[freq].label}s
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {tareasFreq.map(t => (
                    <div
                      key={t.label}
                      className={`bg-white rounded-xl border p-4 flex items-center justify-between gap-3 ${t.alerta ? 'border-rose-200' : 'border-gray-200'}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${t.alerta ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{t.label}</p>
                          {t.ultima ? (
                            <p className={`text-xs mt-0.5 ${t.alerta ? 'text-rose-500' : 'text-gray-400'}`}>
                              <Clock size={10} className="inline mr-1" />
                              {t.dias === 0 ? 'Hoy' : t.dias === 1 ? 'Ayer' : `Hace ${t.dias} días`}
                              {' · '}{t.ultima.empleado_nombre}
                            </p>
                          ) : (
                            <p className="text-xs text-rose-500 mt-0.5">Sin registro</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => abrirCrear(t.label)}
                        className="flex-shrink-0 p-1.5 rounded-lg bg-gray-100 hover:bg-[#F5B731] text-gray-500 hover:text-[#1A1A1A] transition-colors"
                        title="Registrar limpieza"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* VISTA HISTORIAL */}
      {vista === 'historial' && (
        historialFiltrado.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
            <Sparkles size={32} className="mx-auto text-gray-200 mb-3" />
            <p className="text-sm text-gray-400">No hay registros de limpieza</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Fecha</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Local</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Tarea</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Frecuencia</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Realizado por</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {historialFiltrado.map(l => {
                  const local = locales.find(loc => loc.id === l.local_id)
                  const frec = l.frecuencia as Frecuencia
                  return (
                    <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {new Date(l.fecha + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{local?.nombre ?? '—'}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{l.tarea}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${FREC_CFG[frec]?.cls ?? 'bg-gray-100 text-gray-500'}`}>
                          {FREC_CFG[frec]?.label ?? frec}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{l.empleado_nombre}</td>
                      <td className="px-4 py-3 text-right">
                        {confirmEliminar === l.id ? (
                          <span className="flex items-center gap-1 justify-end">
                            <button onClick={() => eliminar(l.id)} className="px-2 py-0.5 bg-rose-500 text-white rounded text-xs font-medium hover:bg-rose-600">Eliminar</button>
                            <button onClick={() => setConfirmEliminar(null)} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium hover:bg-gray-200">No</button>
                          </span>
                        ) : (
                          <button
                            onClick={() => setConfirmEliminar(l.id)}
                            className="p-1.5 text-gray-300 hover:text-rose-500 transition-colors rounded"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-gray-50 text-xs text-gray-400">{historialFiltrado.length} registros</div>
          </div>
        )
      )}

      {modal && (
        <Modal titulo="Registrar limpieza" onCerrar={cerrar}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Local</label>
                <select className={inputCls} value={form.local_id} onChange={e => setForm(f => ({ ...f, local_id: e.target.value }))}>
                  <option value="">— Sin especificar —</option>
                  {locales.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Realizado por *</label>
                <input
                  className={inputCls}
                  placeholder="Nombre del empleado"
                  value={form.empleado_nombre}
                  onChange={e => setForm(f => ({ ...f, empleado_nombre: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tarea realizada *</label>
              <select className={inputCls} value={form.tarea} onChange={e => setForm(f => ({ ...f, tarea: e.target.value }))}>
                <option value="">— Seleccionar tarea —</option>
                {(['diaria', 'semanal', 'mensual'] as Frecuencia[]).map(freq => (
                  <optgroup key={freq} label={`${FREC_CFG[freq].label}s`}>
                    {TAREAS.filter(t => t.frecuencia === freq).map(t => (
                      <option key={t.label} value={t.label}>{t.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Fecha *</label>
              <input type="date" className={inputCls} value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Notas</label>
              <input className={inputCls} value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} placeholder="Observaciones, incidencias..." />
            </div>

            {error && <p className="text-xs text-rose-500">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={cerrar} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">Cancelar</button>
              <button
                onClick={guardar}
                disabled={guardando}
                className="px-4 py-2 text-sm font-semibold bg-[#F5B731] text-[#1A1A1A] rounded-lg hover:bg-[#e0a820] transition-colors disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

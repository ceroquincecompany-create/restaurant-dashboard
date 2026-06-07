'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { VisitaAppcc, ChecklistItem, Local } from '@/lib/supabase'
import { Plus, X, Trash2, RefreshCw, ClipboardCheck, CheckCircle2, XCircle, MinusCircle } from 'lucide-react'

const CHECKLIST_BASE: Omit<ChecklistItem, 'resultado' | 'notas'>[] = [
  { id: 'higiene_personal',       nombre: 'Higiene personal del equipo' },
  { id: 'temperaturas_frio',      nombre: 'Temperaturas equipos frigoríficos' },
  { id: 'limpieza_desinfeccion',  nombre: 'Limpieza y desinfección del local' },
  { id: 'control_plagas',         nombre: 'Control de plagas' },
  { id: 'recepcion_mercancias',   nombre: 'Recepción de mercancías' },
  { id: 'trazabilidad',           nombre: 'Trazabilidad de productos' },
  { id: 'documentacion',          nombre: 'Documentación APPCC actualizada' },
  { id: 'etiquetado_caducidades', nombre: 'Etiquetado y caducidades' },
  { id: 'mantenimiento_equipos',  nombre: 'Estado de equipos y maquinaria' },
  { id: 'almacenamiento',         nombre: 'Correcta segregación y almacenamiento' },
]

const RESULTADO_CFG = {
  conforme:    { label: 'Conforme',     cls: 'bg-emerald-100 text-emerald-700',  dot: 'bg-emerald-500' },
  no_conforme: { label: 'No conforme',  cls: 'bg-rose-100 text-rose-700',        dot: 'bg-rose-500' },
  parcial:     { label: 'Parcial',      cls: 'bg-orange-100 text-orange-700',    dot: 'bg-orange-400' },
} as const

type ResultadoVisita = keyof typeof RESULTADO_CFG

const ITEM_RESULTADO_CFG = {
  conforme:    { icon: CheckCircle2,  cls: 'text-emerald-500', label: 'Conforme' },
  no_conforme: { icon: XCircle,       cls: 'text-rose-500',    label: 'No conforme' },
  na:          { icon: MinusCircle,   cls: 'text-gray-300',    label: 'N/A' },
} as const

type ItemResultado = keyof typeof ITEM_RESULTADO_CFG

type FormVisita = {
  local_id: string
  empleado_nombre: string
  fecha: string
  checklist: ChecklistItem[]
  observaciones: string
  acciones_correctivas: string
}

function crearChecklistVacio(): ChecklistItem[] {
  return CHECKLIST_BASE.map(item => ({ ...item, resultado: 'conforme' as ItemResultado, notas: '' }))
}

const FORM_VACIO: FormVisita = {
  local_id: '', empleado_nombre: '',
  fecha: new Date().toISOString().split('T')[0],
  checklist: crearChecklistVacio(),
  observaciones: '', acciones_correctivas: '',
}

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white'

function calcularResultado(checklist: ChecklistItem[]): ResultadoVisita {
  const noConformes = checklist.filter(i => i.resultado === 'no_conforme').length
  if (noConformes === 0) return 'conforme'
  if (noConformes === checklist.filter(i => i.resultado !== 'na').length) return 'no_conforme'
  return 'parcial'
}

function Modal({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-sm font-semibold text-gray-800">{titulo}</h2>
          <button onClick={onCerrar} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

export default function PaginaAppcc() {
  const [visitas, setVisitas] = useState<VisitaAppcc[]>([])
  const [locales, setLocales] = useState<Local[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroLocal, setFiltroLocal] = useState('')
  const [filtroResultado, setFiltroResultado] = useState('')
  const [modal, setModal] = useState(false)
  const [detalleId, setDetalleId] = useState<number | null>(null)
  const [form, setForm] = useState<FormVisita>(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [confirmEliminar, setConfirmEliminar] = useState<number | null>(null)

  const cargar = useCallback(async () => {
    const [{ data: v }, { data: l }] = await Promise.all([
      supabase.from('visitas_appcc').select('*').order('fecha', { ascending: false }),
      supabase.from('locales').select('*').eq('activo', true).order('nombre'),
    ])
    setVisitas(v ?? [])
    setLocales(l ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const filtradas = useMemo(() => {
    return visitas.filter(v => {
      const matchLocal = !filtroLocal || String(v.local_id) === filtroLocal
      const matchRes = !filtroResultado || v.resultado === filtroResultado
      return matchLocal && matchRes
    })
  }, [visitas, filtroLocal, filtroResultado])

  const kpis = useMemo(() => {
    const conformes = filtradas.filter(v => v.resultado === 'conforme').length
    const noConformes = filtradas.filter(v => v.resultado === 'no_conforme').length
    const parciales = filtradas.filter(v => v.resultado === 'parcial').length
    return { conformes, noConformes, parciales, total: filtradas.length }
  }, [filtradas])

  function updateChecklistItem(idx: number, field: 'resultado' | 'notas', value: string) {
    setForm(f => {
      const cl = [...f.checklist]
      cl[idx] = { ...cl[idx], [field]: value }
      return { ...f, checklist: cl }
    })
  }

  function abrirCrear() {
    setForm({ ...FORM_VACIO, local_id: filtroLocal || '', checklist: crearChecklistVacio() })
    setError('')
    setModal(true)
  }

  function cerrar() {
    setModal(false)
    setDetalleId(null)
    setForm(FORM_VACIO)
    setError('')
  }

  async function guardar() {
    if (!form.empleado_nombre.trim()) { setError('Indica quién realizó la visita'); return }
    setGuardando(true)
    setError('')
    const resultado = calcularResultado(form.checklist)
    const payload = {
      local_id: form.local_id ? Number(form.local_id) : null,
      empleado_nombre: form.empleado_nombre.trim(),
      fecha: form.fecha,
      resultado,
      checklist: form.checklist,
      observaciones: form.observaciones.trim() || null,
      acciones_correctivas: form.acciones_correctivas.trim() || null,
    }
    const { error: err } = await supabase.from('visitas_appcc').insert(payload)
    if (err) { setError(err.message); setGuardando(false); return }
    setGuardando(false)
    cerrar()
    cargar()
  }

  async function eliminar(id: number) {
    await supabase.from('visitas_appcc').delete().eq('id', id)
    setConfirmEliminar(null)
    cargar()
  }

  const visitaDetalle = detalleId != null ? visitas.find(v => v.id === detalleId) : null
  const resultadoPreview = calcularResultado(form.checklist)

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
          <h1 className="text-xl font-bold text-gray-900">Visita APPCC</h1>
          <p className="text-sm text-gray-400 mt-0.5">Registro de inspecciones y checklists de autocontrol</p>
        </div>
        <button
          onClick={abrirCrear}
          className="flex items-center gap-2 px-4 py-2 bg-[#F5B731] text-[#1A1A1A] text-sm font-semibold rounded-lg hover:bg-[#e0a820] transition-colors"
        >
          <Plus size={15} />
          Nueva visita
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 mb-1">Total visitas</p>
          <p className="text-2xl font-bold text-gray-900">{kpis.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-emerald-200 p-4">
          <p className="text-xs text-gray-400 mb-1">Conformes</p>
          <p className={`text-2xl font-bold ${kpis.conformes > 0 ? 'text-emerald-600' : 'text-gray-300'}`}>{kpis.conformes}</p>
        </div>
        <div className="bg-white rounded-xl border border-orange-200 p-4">
          <p className="text-xs text-gray-400 mb-1">Parciales</p>
          <p className={`text-2xl font-bold ${kpis.parciales > 0 ? 'text-orange-500' : 'text-gray-300'}`}>{kpis.parciales}</p>
        </div>
        <div className="bg-white rounded-xl border border-rose-200 p-4">
          <p className="text-xs text-gray-400 mb-1">No conformes</p>
          <p className={`text-2xl font-bold ${kpis.noConformes > 0 ? 'text-rose-600' : 'text-gray-300'}`}>{kpis.noConformes}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <select
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white"
          value={filtroLocal}
          onChange={e => setFiltroLocal(e.target.value)}
        >
          <option value="">Todos los locales</option>
          {locales.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
        </select>
        <select
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white"
          value={filtroResultado}
          onChange={e => setFiltroResultado(e.target.value)}
        >
          <option value="">Todos los resultados</option>
          {(Object.keys(RESULTADO_CFG) as ResultadoVisita[]).map(r => (
            <option key={r} value={r}>{RESULTADO_CFG[r].label}</option>
          ))}
        </select>
        <span className="text-xs text-gray-400">{filtradas.length} visitas</span>
      </div>

      {/* Lista */}
      {filtradas.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <ClipboardCheck size={32} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">No hay visitas APPCC registradas</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtradas.map(v => {
            const local = locales.find(l => l.id === v.local_id)
            const resCfg = RESULTADO_CFG[v.resultado as ResultadoVisita]
            const noConf = (v.checklist as ChecklistItem[]).filter(i => i.resultado === 'no_conforme').length
            return (
              <div key={v.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${resCfg.dot}`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${resCfg.cls}`}>{resCfg.label}</span>
                      <span className="text-sm font-semibold text-gray-800">
                        {new Date(v.fecha + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </span>
                      {local && <span className="text-xs text-gray-400">{local.nombre}</span>}
                      {noConf > 0 && (
                        <span className="text-xs text-rose-500 font-medium">{noConf} incumplimiento{noConf !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Inspeccionado por {v.empleado_nombre}
                      {v.observaciones && ` · ${v.observaciones.slice(0, 60)}${v.observaciones.length > 60 ? '…' : ''}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => setDetalleId(v.id)}
                    className="px-2 py-1 text-xs text-gray-500 hover:text-[#1A1A1A] bg-gray-100 hover:bg-[#F5B731] rounded transition-colors font-medium"
                  >
                    Ver
                  </button>
                  {confirmEliminar === v.id ? (
                    <span className="flex items-center gap-1">
                      <button onClick={() => eliminar(v.id)} className="px-2 py-0.5 bg-rose-500 text-white rounded text-xs font-medium hover:bg-rose-600">Eliminar</button>
                      <button onClick={() => setConfirmEliminar(null)} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium hover:bg-gray-200">No</button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmEliminar(v.id)}
                      className="p-1.5 text-gray-300 hover:text-rose-500 transition-colors rounded"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal nueva visita */}
      {modal && (
        <Modal titulo="Nueva visita APPCC" onCerrar={cerrar}>
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Local</label>
                <select className={inputCls} value={form.local_id} onChange={e => setForm(f => ({ ...f, local_id: e.target.value }))}>
                  <option value="">— Sin especificar —</option>
                  {locales.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Inspeccionado por *</label>
                <input
                  className={inputCls}
                  placeholder="Nombre del responsable"
                  value={form.empleado_nombre}
                  onChange={e => setForm(f => ({ ...f, empleado_nombre: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Fecha *</label>
              <input type="date" className={inputCls} value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
            </div>

            {/* Checklist */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Checklist de puntos de control</p>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${RESULTADO_CFG[resultadoPreview].cls}`}>
                  Resultado previo: {RESULTADO_CFG[resultadoPreview].label}
                </span>
              </div>
              <div className="space-y-2">
                {form.checklist.map((item, idx) => {
                  const resCfg = ITEM_RESULTADO_CFG[item.resultado as ItemResultado]
                  return (
                    <div key={item.id} className="border border-gray-100 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-gray-700 flex-1">{item.nombre}</p>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {(Object.keys(ITEM_RESULTADO_CFG) as ItemResultado[]).map(r => {
                            const cfg = ITEM_RESULTADO_CFG[r]
                            const Ico = cfg.icon
                            return (
                              <button
                                key={r}
                                type="button"
                                onClick={() => updateChecklistItem(idx, 'resultado', r)}
                                title={cfg.label}
                                className={`p-1 rounded transition-colors ${item.resultado === r ? cfg.cls : 'text-gray-200 hover:text-gray-400'}`}
                              >
                                <Ico size={18} />
                              </button>
                            )
                          })}
                        </div>
                      </div>
                      {item.resultado === 'no_conforme' && (
                        <input
                          className="w-full px-2 py-1.5 text-xs border border-rose-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-300 bg-rose-50 placeholder-rose-300"
                          placeholder="Describe la no conformidad..."
                          value={item.notas}
                          onChange={e => updateChecklistItem(idx, 'notas', e.target.value)}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Observaciones generales</label>
              <textarea
                className={`${inputCls} resize-none`}
                rows={2}
                placeholder="Notas generales de la visita..."
                value={form.observaciones}
                onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Acciones correctivas</label>
              <textarea
                className={`${inputCls} resize-none`}
                rows={2}
                placeholder="Medidas a tomar para corregir incumplimientos..."
                value={form.acciones_correctivas}
                onChange={e => setForm(f => ({ ...f, acciones_correctivas: e.target.value }))}
              />
            </div>

            {error && <p className="text-xs text-rose-500">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={cerrar} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">Cancelar</button>
              <button
                onClick={guardar}
                disabled={guardando}
                className="px-4 py-2 text-sm font-semibold bg-[#F5B731] text-[#1A1A1A] rounded-lg hover:bg-[#e0a820] transition-colors disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : 'Guardar visita'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal detalle */}
      {visitaDetalle && (
        <Modal titulo={`Visita ${new Date(visitaDetalle.fecha + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}`} onCerrar={cerrar}>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className={`text-sm font-medium px-3 py-1 rounded-full ${RESULTADO_CFG[visitaDetalle.resultado as ResultadoVisita].cls}`}>
                {RESULTADO_CFG[visitaDetalle.resultado as ResultadoVisita].label}
              </span>
              <span className="text-sm text-gray-500">Inspeccionado por <strong>{visitaDetalle.empleado_nombre}</strong></span>
            </div>

            <div className="space-y-1.5">
              {(visitaDetalle.checklist as ChecklistItem[]).map(item => {
                const resCfg = ITEM_RESULTADO_CFG[item.resultado as ItemResultado]
                const Ico = resCfg.icon
                return (
                  <div key={item.id} className="flex items-start gap-2.5">
                    <Ico size={15} className={`mt-0.5 flex-shrink-0 ${resCfg.cls}`} />
                    <div>
                      <span className="text-sm text-gray-700">{item.nombre}</span>
                      {item.notas && <p className="text-xs text-rose-500 mt-0.5">{item.notas}</p>}
                    </div>
                  </div>
                )
              })}
            </div>

            {visitaDetalle.observaciones && (
              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs font-semibold text-gray-500 mb-1">Observaciones</p>
                <p className="text-sm text-gray-700">{visitaDetalle.observaciones}</p>
              </div>
            )}

            {visitaDetalle.acciones_correctivas && (
              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs font-semibold text-gray-500 mb-1">Acciones correctivas</p>
                <p className="text-sm text-gray-700">{visitaDetalle.acciones_correctivas}</p>
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button onClick={cerrar} className="px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">Cerrar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

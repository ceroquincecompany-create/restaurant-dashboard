'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { Albaran, AlbaranLinea } from '@/lib/supabase'
import {
  RefreshCw, X, FileImage, CheckCircle2, AlertTriangle,
  FileText, ExternalLink, TrendingUp, ChevronDown,
} from 'lucide-react'

// ── Tipos ──────────────────────────────────────────────────────

type AlbaranConLineas = Albaran & { albaran_lineas: AlbaranLinea[] }

type Proveedor = { id: number; nombre: string }
type Local     = { id: number; nombre: string }

const ESTADO_CFG = {
  pendiente:      { label: 'Pendiente revisión', cls: 'bg-amber-100 text-amber-700' },
  revisado:       { label: 'Revisado',           cls: 'bg-blue-100 text-blue-700' },
  contabilizado:  { label: 'Contabilizado',      cls: 'bg-emerald-100 text-emerald-700' },
} as const

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

// ── Componentes ────────────────────────────────────────────────

function Modal({ titulo, onCerrar, maxW = 'max-w-2xl', children }: {
  titulo: string; onCerrar: () => void; maxW?: string; children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-6 pb-6 overflow-y-auto">
      <div className={`bg-white rounded-xl shadow-xl w-full ${maxW} mx-4 my-auto`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-sm font-semibold text-gray-800">{titulo}</h2>
          <button onClick={onCerrar} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

function Badge({ estado }: { estado: string }) {
  const cfg = ESTADO_CFG[estado as keyof typeof ESTADO_CFG] ?? { label: estado, cls: 'bg-gray-100 text-gray-600' }
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>
}

// ── Página principal ───────────────────────────────────────────

export default function PaginaAlbaranes() {
  const [albaranes, setAlbaranes]     = useState<AlbaranConLineas[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [locales, setLocales]         = useState<Local[]>([])
  const [loading, setLoading]         = useState(true)

  // Filtros
  const [filtroProveedor, setFiltroProveedor] = useState('')
  const [filtroMes, setFiltroMes]             = useState('')
  const [filtroAnio, setFiltroAnio]           = useState(String(new Date().getFullYear()))
  const [filtroEstado, setFiltroEstado]       = useState('')

  // Detalle
  const [detalle, setDetalle]     = useState<AlbaranConLineas | null>(null)

  // Contabilizar
  const [modalCont, setModalCont]   = useState<AlbaranConLineas | null>(null)
  const [contabilizando, setContabilizando] = useState(false)
  const [contError, setContError]   = useState('')

  const cargar = useCallback(async () => {
    const [{ data: albs }, { data: provs }, { data: locs }] = await Promise.all([
      supabase
        .from('albaranes')
        .select('*, albaran_lineas(*)')
        .order('created_at', { ascending: false }),
      supabase.from('proveedores').select('id, nombre').eq('activo', true).order('nombre'),
      supabase.from('locales').select('id, nombre').eq('activo', true).order('nombre'),
    ])
    setAlbaranes(albs ?? [])
    setProveedores(provs ?? [])
    setLocales(locs ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // ── Filtrado ─────────────────────────────────────────────────
  const filtrados = useMemo(() => {
    return albaranes.filter(a => {
      const fecha = a.fecha_documento ? new Date(a.fecha_documento + 'T12:00:00') : null
      const matchProv    = !filtroProveedor || String(a.proveedor_id) === filtroProveedor
      const matchMes     = !filtroMes || (fecha && (fecha.getMonth() + 1) === Number(filtroMes))
      const matchAnio    = !filtroAnio || (fecha && fecha.getFullYear() === Number(filtroAnio))
      const matchEstado  = !filtroEstado || a.estado === filtroEstado
      return matchProv && matchMes && matchAnio && matchEstado
    })
  }, [albaranes, filtroProveedor, filtroMes, filtroAnio, filtroEstado])

  // ── KPIs ─────────────────────────────────────────────────────
  const totalFiltrado = useMemo(() => filtrados.reduce((s, a) => s + (a.total ?? 0), 0), [filtrados])
  const pendientes    = useMemo(() => filtrados.filter(a => a.estado === 'pendiente').length, [filtrados])
  const totalPorProv  = useMemo(() => {
    const map: Record<number, number> = {}
    filtrados.forEach(a => {
      if (a.proveedor_id) map[a.proveedor_id] = (map[a.proveedor_id] ?? 0) + (a.total ?? 0)
    })
    return map
  }, [filtrados])

  // ── Cambiar estado ───────────────────────────────────────────
  async function cambiarEstado(id: number, estado: Albaran['estado']) {
    await supabase.from('albaranes').update({ estado }).eq('id', id)
    setAlbaranes(prev => prev.map(a => a.id === id ? { ...a, estado } : a))
    if (detalle?.id === id) setDetalle(d => d ? { ...d, estado } : d)
  }

  // ── Contabilizar ─────────────────────────────────────────────
  async function contabilizar() {
    if (!modalCont) return
    setContabilizando(true); setContError('')

    const fecha = modalCont.fecha_documento ? new Date(modalCont.fecha_documento + 'T12:00:00') : new Date()
    const anio  = fecha.getFullYear()
    const mes   = fecha.getMonth() + 1

    // Buscar fila pl_datos existente para este mes/local/proveedores
    const { data: existing } = await supabase
      .from('pl_datos')
      .select('id, valor_real')
      .eq('local_id', modalCont.local_id ?? '')
      .eq('año', anio)
      .eq('mes', mes)
      .eq('partida', 'proveedores')
      .maybeSingle()

    const nuevoValor = (existing?.valor_real ?? 0) + (modalCont.total ?? 0)

    if (existing) {
      await supabase.from('pl_datos').update({ valor_real: nuevoValor }).eq('id', existing.id)
    } else {
      await supabase.from('pl_datos').insert({
        local_id:         modalCont.local_id,
        año:              anio,
        mes,
        partida:          'proveedores',
        valor_real:       nuevoValor,
        valor_presupuesto: 0,
      })
    }

    // Marcar albarán contabilizado
    await supabase.from('albaranes').update({ estado: 'contabilizado', contabilizado: true }).eq('id', modalCont.id)
    setAlbaranes(prev => prev.map(a => a.id === modalCont.id ? { ...a, estado: 'contabilizado', contabilizado: true } : a))
    if (detalle?.id === modalCont.id) setDetalle(d => d ? { ...d, estado: 'contabilizado', contabilizado: true } : d)

    setContabilizando(false)
    setModalCont(null)
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <RefreshCw className="animate-spin text-[#F5B731]" size={24} />
    </div>
  )

  return (
    <div className="p-6 max-w-6xl">

      {/* ── Header ────────────────────────────────────────── */}
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Albaranes</h1>
          <p className="text-sm text-gray-400 mt-0.5">Recepción de albaranes y facturas de proveedores</p>
        </div>
      </div>

      {/* ── KPIs ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Total filtrado</p>
          <p className="text-2xl font-bold text-rose-600">{totalFiltrado.toFixed(2)} €</p>
          <p className="text-xs text-gray-400 mt-0.5">{filtrados.length} albaranes</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Pendientes revisión</p>
          <p className="text-2xl font-bold text-amber-600">{pendientes}</p>
        </div>
        {locales.slice(0, 2).map(loc => (
          <div key={loc.id} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">{loc.nombre}</p>
            <p className="text-2xl font-bold text-gray-900">
              {filtrados.filter(a => a.local_id === loc.id).reduce((s, a) => s + (a.total ?? 0), 0).toFixed(2)} €
            </p>
          </div>
        ))}
      </div>

      {/* ── Resumen por proveedor ─────────────────────────── */}
      {Object.keys(totalPorProv).length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-5">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <TrendingUp size={14} className="text-gray-400" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Gasto por proveedor (filtrado)</p>
          </div>
          <div className="divide-y divide-gray-50">
            {Object.entries(totalPorProv)
              .sort(([, a], [, b]) => b - a)
              .map(([pid, total]) => {
                const prov = proveedores.find(p => p.id === Number(pid))
                return (
                  <div key={pid} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm text-gray-700">{prov?.nombre ?? `#${pid}`}</span>
                    <span className="text-sm font-semibold text-gray-900">{total.toFixed(2)} €</span>
                  </div>
                )
              })
            }
          </div>
        </div>
      )}

      {/* ── Filtros ───────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <select className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white"
          value={filtroProveedor} onChange={e => setFiltroProveedor(e.target.value)}>
          <option value="">Todos los proveedores</option>
          {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <select className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white"
          value={filtroMes} onChange={e => setFiltroMes(e.target.value)}>
          <option value="">Todos los meses</option>
          {MESES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <select className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white"
          value={filtroAnio} onChange={e => setFiltroAnio(e.target.value)}>
          {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white"
          value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {(Object.keys(ESTADO_CFG) as Array<keyof typeof ESTADO_CFG>).map(e => (
            <option key={e} value={e}>{ESTADO_CFG[e].label}</option>
          ))}
        </select>
      </div>

      {/* ── Tabla ─────────────────────────────────────────── */}
      {filtrados.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <FileText size={32} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">No hay albaranes con los filtros actuales</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Fecha</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Proveedor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Nº albarán</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Total</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Empleado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtrados.map(a => (
                <tr key={a.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setDetalle(a)}>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {a.fecha_documento
                      ? new Date(a.fecha_documento + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800 max-w-[160px] truncate">
                    {a.proveedor_nombre ?? (a.proveedor_id ? proveedores.find(p => p.id === a.proveedor_id)?.nombre : '—') ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{a.numero_albaran ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                    {a.total != null ? `${Number(a.total).toFixed(2)} €` : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{a.empleado_nombre}</td>
                  <td className="px-4 py-3"><Badge estado={a.estado} /></td>
                  <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                    {!a.contabilizado && (
                      <button
                        onClick={() => { setModalCont(a); setContError('') }}
                        className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 whitespace-nowrap px-2 py-1 rounded border border-emerald-200 hover:bg-emerald-50 transition-colors"
                      >
                        Contabilizar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ══ MODAL DETALLE ══════════════════════════════════ */}
      {detalle && (
        <Modal titulo={`Albarán — ${detalle.proveedor_nombre ?? '—'}`} onCerrar={() => setDetalle(null)} maxW="max-w-3xl">
          <div className="space-y-5">

            {/* Imagen */}
            {detalle.imagen_url && (
              <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center min-h-[120px]">
                {detalle.imagen_url.endsWith('.pdf') ? (
                  <a href={detalle.imagen_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm font-semibold text-blue-600 py-6">
                    <FileText size={18} /> Ver PDF <ExternalLink size={13} />
                  </a>
                ) : (
                  <img src={detalle.imagen_url} alt="Albarán" className="max-w-full max-h-64 object-contain" />
                )}
              </div>
            )}

            {/* Datos principales */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Proveedor', value: detalle.proveedor_nombre ?? '—' },
                { label: 'Nº albarán', value: detalle.numero_albaran ?? '—' },
                { label: 'Fecha', value: detalle.fecha_documento ? new Date(detalle.fecha_documento + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' },
                { label: 'Total', value: detalle.total != null ? `${Number(detalle.total).toFixed(2)} €` : '—' },
                { label: 'Empleado', value: detalle.empleado_nombre },
                { label: 'Temperatura', value: detalle.temperatura_recepcion != null ? `${detalle.temperatura_recepcion}°C` : '—' },
                { label: 'Estado', value: ESTADO_CFG[detalle.estado]?.label ?? detalle.estado },
                { label: 'Recibido', value: new Date(detalle.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) },
              ].map(f => (
                <div key={f.label} className="bg-gray-50 rounded-lg px-3 py-2">
                  <p className="text-xs text-gray-400">{f.label}</p>
                  <p className="text-sm font-semibold text-gray-800 truncate">{f.value}</p>
                </div>
              ))}
            </div>

            {/* Notas */}
            {detalle.notas && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <p className="text-xs text-gray-500 mb-0.5">Notas</p>
                <p className="text-sm text-gray-700">{detalle.notas}</p>
              </div>
            )}

            {/* Líneas */}
            {detalle.albaran_lineas.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Productos</p>
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold text-gray-500">Producto</th>
                        <th className="text-right px-3 py-2 font-semibold text-gray-500">Cant.</th>
                        <th className="text-left px-3 py-2 font-semibold text-gray-500">Ud.</th>
                        <th className="text-right px-3 py-2 font-semibold text-gray-500">P.unit</th>
                        <th className="text-right px-3 py-2 font-semibold text-gray-500">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {detalle.albaran_lineas.map(l => (
                        <tr key={l.id}>
                          <td className="px-3 py-2 text-gray-700">{l.nombre_producto}</td>
                          <td className="px-3 py-2 text-right text-gray-600">{l.cantidad ?? '—'}</td>
                          <td className="px-3 py-2 text-gray-500">{l.unidad ?? '—'}</td>
                          <td className="px-3 py-2 text-right text-gray-600">{l.precio_unitario != null ? `${Number(l.precio_unitario).toFixed(2)} €` : '—'}</td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-800">{l.total_linea != null ? `${Number(l.total_linea).toFixed(2)} €` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Acciones */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100">
              {/* Cambiar estado */}
              {detalle.estado === 'pendiente' && (
                <button onClick={() => cambiarEstado(detalle.id, 'revisado')}
                  className="px-3 py-1.5 text-xs font-semibold bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                  Marcar revisado
                </button>
              )}
              {detalle.estado === 'revisado' && (
                <button onClick={() => cambiarEstado(detalle.id, 'pendiente')}
                  className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                  Volver a pendiente
                </button>
              )}
              {!detalle.contabilizado && (
                <button onClick={() => { setModalCont(detalle); setContError('') }}
                  className="px-3 py-1.5 text-xs font-semibold bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors">
                  Contabilizar → P&L
                </button>
              )}
              {detalle.contabilizado && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
                  <CheckCircle2 size={13} /> Contabilizado en P&L
                </span>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* ══ MODAL CONTABILIZAR ═════════════════════════════ */}
      {modalCont && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-800">Contabilizar albarán</p>
              <button onClick={() => setModalCont(null)} className="text-gray-400 hover:text-gray-600"><X size={15} /></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              {/* Info */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                <p className="text-sm font-semibold text-emerald-800">
                  Añadir {Number(modalCont.total ?? 0).toFixed(2)} €
                  {' '}a <strong>Materia Prima (Proveedores)</strong>
                </p>
                {modalCont.fecha_documento && (
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Mes: {MESES[new Date(modalCont.fecha_documento + 'T12:00:00').getMonth()]}
                    {' '}{new Date(modalCont.fecha_documento + 'T12:00:00').getFullYear()}
                  </p>
                )}
                <p className="text-xs text-emerald-600 mt-1">
                  Se sumará al valor actual de Proveedores en pl_datos.
                </p>
              </div>

              {contError && <p className="text-xs text-rose-500">{contError}</p>}

              <div className="flex gap-2">
                <button onClick={() => setModalCont(null)} className="flex-1 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={contabilizar}
                  disabled={contabilizando}
                  className="flex-1 py-2.5 text-sm font-bold bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50"
                >
                  {contabilizando ? <span className="flex items-center justify-center gap-2"><RefreshCw size={13} className="animate-spin" />...</span> : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

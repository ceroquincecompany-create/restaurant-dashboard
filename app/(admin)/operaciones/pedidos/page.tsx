'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { RefreshCw, ShoppingCart, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Package, X } from 'lucide-react'

type Pedido = {
  id: number; local_id: number | null; empleado_nombre: string
  proveedor_id: number | null; estado: string; notas: string | null; created_at: string
  proveedores?: { nombre: string } | null
  pedidos_lineas?: LineaDetalle[]
}
type LineaDetalle = {
  id: number; ingrediente_id: number | null; cantidad_pedida: number
  unidad: string | null; precio_unitario: number | null
  ingredientes?: { nombre_ingrediente: string; unidad_producto: string | null } | null
}
type LineaRecepcion = LineaDetalle & { cantidad_recibida: string; precio_real: string }

const ESTADO_CFG = {
  pendiente:  { label: 'Pendiente',  cls: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-400' },
  confirmado: { label: 'Confirmado', cls: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-500' },
  recibido:   { label: 'Recibido',   cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  cancelado:  { label: 'Cancelado',  cls: 'bg-gray-100 text-gray-500',     dot: 'bg-gray-400' },
}

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white'

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

export default function PaginaAdminPedidos() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [detalleId, setDetalleId] = useState<number | null>(null)
  const [detalleLineas, setDetalleLineas] = useState<LineaDetalle[]>([])
  const [modalRecepcion, setModalRecepcion] = useState<Pedido | null>(null)
  const [lineasRecepcion, setLineasRecepcion] = useState<LineaRecepcion[]>([])
  const [empleadoRecepcion, setEmpleadoRecepcion] = useState('')
  const [notasRecepcion, setNotasRecepcion] = useState('')
  const [guardandoRecepcion, setGuardandoRecepcion] = useState(false)
  const [cambiandoEstado, setCambiandoEstado] = useState<number | null>(null)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from('pedidos_proveedor')
      .select('*, proveedores(nombre)')
      .order('created_at', { ascending: false })
    setPedidos(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const filtrados = useMemo(() => pedidos.filter(p => !filtroEstado || p.estado === filtroEstado), [pedidos, filtroEstado])

  const kpis = useMemo(() => ({
    pendientes: pedidos.filter(p => p.estado === 'pendiente').length,
    confirmados: pedidos.filter(p => p.estado === 'confirmado').length,
    recibidos: pedidos.filter(p => p.estado === 'recibido').length,
  }), [pedidos])

  async function verDetalle(pedidoId: number) {
    if (detalleId === pedidoId) { setDetalleId(null); return }
    setDetalleId(pedidoId)
    const { data } = await supabase
      .from('pedidos_lineas')
      .select('*, ingredientes(nombre_ingrediente, unidad_producto)')
      .eq('pedido_id', pedidoId)
    setDetalleLineas(data ?? [])
  }

  async function cambiarEstado(pedidoId: number, nuevoEstado: string) {
    setCambiandoEstado(pedidoId)
    await supabase.from('pedidos_proveedor').update({ estado: nuevoEstado }).eq('id', pedidoId)
    setCambiandoEstado(null)
    cargar()
  }

  function abrirRecepcion(pedido: Pedido) {
    setModalRecepcion(pedido)
    setLineasRecepcion(detalleLineas.map(l => ({ ...l, cantidad_recibida: String(l.cantidad_pedida), precio_real: l.precio_unitario ? String(l.precio_unitario) : '' })))
    setEmpleadoRecepcion('')
    setNotasRecepcion('')
    setError('')
  }

  async function guardarRecepcion() {
    if (!modalRecepcion || !empleadoRecepcion.trim()) { setError('Indica quién recibe el pedido'); return }
    setGuardandoRecepcion(true); setError('')
    const { data: recepcion, error: errR } = await supabase
      .from('recepciones_pedido')
      .insert({ pedido_id: modalRecepcion.id, empleado_nombre: empleadoRecepcion.trim(), fecha_recepcion: new Date().toISOString().split('T')[0], notas: notasRecepcion.trim() || null })
      .select('id').single()
    if (errR || !recepcion) { setError('Error al guardar la recepción'); setGuardandoRecepcion(false); return }

    const lineasInsert = lineasRecepcion.map(l => ({
      recepcion_id: recepcion.id,
      ingrediente_id: l.ingrediente_id,
      cantidad_pedida: l.cantidad_pedida,
      cantidad_recibida: Number(l.cantidad_recibida) || 0,
      precio_real: l.precio_real !== '' ? Number(l.precio_real) : null,
    }))
    await supabase.from('recepciones_lineas').insert(lineasInsert)
    await supabase.from('pedidos_proveedor').update({ estado: 'recibido' }).eq('id', modalRecepcion.id)
    setGuardandoRecepcion(false); setModalRecepcion(null); cargar()
  }

  // Calcular total estimado del pedido
  function totalPedido(lineas: LineaDetalle[]): string {
    const total = lineas.reduce((s, l) => s + l.cantidad_pedida * (l.precio_unitario ?? 0), 0)
    return total > 0 ? `${total.toFixed(2)} €` : '—'
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><RefreshCw className="animate-spin text-[#F5B731]" size={24} /></div>

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pedidos a Proveedor</h1>
          <p className="text-sm text-gray-400 mt-0.5">Gestión de pedidos enviados por el equipo</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-amber-200 p-4">
          <p className="text-xs text-gray-400 mb-1">Pendientes</p>
          <p className={`text-2xl font-bold ${kpis.pendientes > 0 ? 'text-amber-600' : 'text-gray-300'}`}>{kpis.pendientes}</p>
        </div>
        <div className="bg-white rounded-xl border border-blue-200 p-4">
          <p className="text-xs text-gray-400 mb-1">Confirmados</p>
          <p className={`text-2xl font-bold ${kpis.confirmados > 0 ? 'text-blue-600' : 'text-gray-300'}`}>{kpis.confirmados}</p>
        </div>
        <div className="bg-white rounded-xl border border-emerald-200 p-4">
          <p className="text-xs text-gray-400 mb-1">Recibidos</p>
          <p className={`text-2xl font-bold ${kpis.recibidos > 0 ? 'text-emerald-600' : 'text-gray-300'}`}>{kpis.recibidos}</p>
        </div>
      </div>

      {/* Filtro */}
      <div className="flex items-center gap-3 mb-5">
        <select className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <span className="text-xs text-gray-400">{filtrados.length} pedidos</span>
      </div>

      {/* Lista pedidos */}
      {filtrados.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <ShoppingCart size={32} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">No hay pedidos</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtrados.map(p => {
            const cfg = ESTADO_CFG[p.estado as keyof typeof ESTADO_CFG] ?? ESTADO_CFG.pendiente
            const abierto = detalleId === p.id
            const isLoading = cambiandoEstado === p.id
            return (
              <div key={p.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Cabecera */}
                <div className="px-5 py-4 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${cfg.cls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                      <span className="text-sm font-bold text-gray-800">{p.proveedores?.nombre ?? '—'}</span>
                      <span className="text-xs text-gray-400">#{p.id}</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {new Date(p.created_at).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      {' · '}{p.empleado_nombre}
                    </p>
                  </div>
                  <button onClick={() => verDetalle(p.id)} className="p-1.5 text-gray-400 hover:text-gray-600 flex-shrink-0">
                    {abierto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>

                {/* Detalle expandible */}
                {abierto && (
                  <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
                    {detalleLineas.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-2">Sin líneas de pedido</p>
                    ) : (
                      <>
                        <div className="space-y-1.5 mb-4">
                          <div className="flex text-xs font-semibold text-gray-500 pb-1 border-b border-gray-200">
                            <span className="flex-1">Artículo</span>
                            <span className="w-24 text-right">Cantidad</span>
                            <span className="w-24 text-right">Precio unit.</span>
                            <span className="w-24 text-right">Subtotal</span>
                          </div>
                          {detalleLineas.map(l => (
                            <div key={l.id} className="flex items-center text-sm">
                              <span className="flex-1 text-gray-700">{l.ingredientes?.nombre_ingrediente ?? '—'}</span>
                              <span className="w-24 text-right text-gray-600">{l.cantidad_pedida} {l.unidad ?? ''}</span>
                              <span className="w-24 text-right text-gray-500">{l.precio_unitario != null ? `${l.precio_unitario} €` : '—'}</span>
                              <span className="w-24 text-right font-semibold text-gray-800">
                                {l.precio_unitario != null ? `${(l.cantidad_pedida * l.precio_unitario).toFixed(2)} €` : '—'}
                              </span>
                            </div>
                          ))}
                          <div className="flex items-center justify-between text-sm font-bold text-gray-800 pt-2 border-t border-gray-200 mt-2">
                            <span>Total estimado</span>
                            <span>{totalPedido(detalleLineas)}</span>
                          </div>
                        </div>
                        {p.notas && <p className="text-xs text-gray-400 italic mb-4">{p.notas}</p>}
                      </>
                    )}

                    {/* Acciones */}
                    <div className="flex gap-2 flex-wrap">
                      {p.estado === 'pendiente' && (
                        <button onClick={() => cambiarEstado(p.id, 'confirmado')} disabled={isLoading}
                          className="px-4 py-2 text-sm font-semibold bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 min-h-[36px]">
                          {isLoading ? '...' : 'Confirmar pedido'}
                        </button>
                      )}
                      {(p.estado === 'pendiente' || p.estado === 'confirmado') && (
                        <button onClick={() => abrirRecepcion(p)} disabled={isLoading}
                          className="px-4 py-2 text-sm font-semibold bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 min-h-[36px]">
                          Registrar recepción
                        </button>
                      )}
                      {p.estado !== 'cancelado' && p.estado !== 'recibido' && (
                        <button onClick={() => cambiarEstado(p.id, 'cancelado')} disabled={isLoading}
                          className="px-4 py-2 text-sm font-semibold text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 min-h-[36px]">
                          Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal recepción */}
      {modalRecepcion && (
        <Modal titulo={`Recepción — ${modalRecepcion.proveedores?.nombre ?? ''} #${modalRecepcion.id}`} onCerrar={() => setModalRecepcion(null)}>
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Recibido por *</label>
              <input className={inputCls} placeholder="Nombre del empleado" value={empleadoRecepcion} onChange={e => setEmpleadoRecepcion(e.target.value)} />
            </div>

            {/* Líneas de recepción */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Verificación por artículo</p>
              <div className="space-y-3">
                {lineasRecepcion.map((l, idx) => {
                  const pedida = l.cantidad_pedida
                  const recibida = Number(l.cantidad_recibida) || 0
                  const diff = recibida - pedida
                  const hayDiff = Math.abs(diff) > 0.001
                  return (
                    <div key={l.id} className={`rounded-xl border p-4 ${hayDiff ? 'border-orange-200 bg-orange-50' : 'border-gray-200'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold text-gray-800">{l.ingredientes?.nombre_ingrediente ?? '—'}</p>
                        {hayDiff && (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${diff > 0 ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                            <AlertTriangle size={10} />
                            {diff > 0 ? '+' : ''}{diff.toFixed(2)} {l.unidad ?? ''}
                          </span>
                        )}
                        {!hayDiff && recibida > 0 && (
                          <CheckCircle2 size={16} className="text-emerald-500" />
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Pedido</label>
                          <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm font-semibold text-gray-600 text-center">{pedida} {l.unidad ?? ''}</div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Recibido *</label>
                          <input type="number" step="0.01" className={inputCls} value={l.cantidad_recibida}
                            onChange={e => { const n = [...lineasRecepcion]; n[idx] = { ...n[idx], cantidad_recibida: e.target.value }; setLineasRecepcion(n) }} />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Precio real (€/ud)</label>
                          <input type="number" step="0.0001" className={inputCls} placeholder={l.precio_unitario ? String(l.precio_unitario) : '0.00'} value={l.precio_real}
                            onChange={e => { const n = [...lineasRecepcion]; n[idx] = { ...n[idx], precio_real: e.target.value }; setLineasRecepcion(n) }} />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Subtotal real</label>
                          <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm font-semibold text-gray-700 text-center">
                            {l.precio_real !== '' && Number(l.precio_real) > 0 && recibida > 0
                              ? `${(recibida * Number(l.precio_real)).toFixed(2)} €`
                              : '—'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Total real */}
              {lineasRecepcion.some(l => l.precio_real !== '' && Number(l.precio_real) > 0) && (
                <div className="mt-3 px-4 py-3 bg-gray-900 text-white rounded-xl flex items-center justify-between">
                  <span className="text-sm font-semibold">Total real recibido</span>
                  <span className="text-lg font-bold">
                    {lineasRecepcion.reduce((s, l) => s + ((Number(l.cantidad_recibida) || 0) * (Number(l.precio_real) || 0)), 0).toFixed(2)} €
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Notas de recepción</label>
              <input className={inputCls} placeholder="Incidencias, diferencias, observaciones..." value={notasRecepcion} onChange={e => setNotasRecepcion(e.target.value)} />
            </div>

            {error && <p className="text-xs text-rose-500 flex items-center gap-1"><AlertTriangle size={12} /> {error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setModalRecepcion(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
              <button onClick={guardarRecepcion} disabled={guardandoRecepcion}
                className="px-4 py-2 text-sm font-semibold bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 flex items-center gap-2">
                {guardandoRecepcion ? <><RefreshCw size={14} className="animate-spin" /> Guardando...</> : <><Package size={14} /> Confirmar recepción</>}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

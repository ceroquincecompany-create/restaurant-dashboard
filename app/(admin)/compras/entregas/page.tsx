'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { Plus, X, RefreshCw, Truck, AlertTriangle, CheckCircle2, Download, ChevronDown, ChevronUp } from 'lucide-react'

type Entrega = {
  id: number; pedido_id: number; empleado_nombre: string
  fecha_recepcion: string; numero_albaran: string | null; notas: string | null; created_at: string
  pedidos_proveedor?: { proveedores?: { nombre: string } | null; estado: string } | null
}
type LineaEntrega = {
  id: number; ingrediente_id: number | null; cantidad_pedida: number
  cantidad_recibida: number; precio_real: number | null; diferencia: number | null
  ingredientes?: { nombre_ingrediente: string; unidad_producto: string | null } | null
}
type PedidoPendiente = {
  id: number; empleado_nombre: string; created_at: string; notas: string | null
  proveedores?: { nombre: string } | null
  pedidos_lineas?: { id: number; ingrediente_id: number | null; cantidad_pedida: number; unidad: string | null; precio_unitario: number | null; ingredientes?: { nombre_ingrediente: string } | null }[]
}
type LineaRecForm = { lineaId: number; nombre: string; unidad: string; cantPedida: number; cantRecibida: string; precioReal: string }

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white'

export default function PaginaEntregas() {
  const [entregas, setEntregas] = useState<Entrega[]>([])
  const [loading, setLoading] = useState(true)
  const [detalleId, setDetalleId] = useState<number | null>(null)
  const [detalleLineas, setDetalleLineas] = useState<LineaEntrega[]>([])
  const [modalNueva, setModalNueva] = useState(false)
  const [pedidosPendientes, setPedidosPendientes] = useState<PedidoPendiente[]>([])
  const [pedidoSelId, setPedidoSelId] = useState('')
  const [pedidoSel, setPedidoSel] = useState<PedidoPendiente | null>(null)
  const [albaran, setAlbaran] = useState('')
  const [fechaRec, setFechaRec] = useState(new Date().toISOString().split('T')[0])
  const [empleado, setEmpleado] = useState('')
  const [notas, setNotas] = useState('')
  const [lineasRec, setLineasRec] = useState<LineaRecForm[]>([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from('recepciones_pedido')
      .select('*, pedidos_proveedor(proveedores(nombre), estado)')
      .order('created_at', { ascending: false })
    setEntregas(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function abrirModalNueva() {
    const { data } = await supabase
      .from('pedidos_proveedor')
      .select('*, proveedores(nombre), pedidos_lineas(id, ingrediente_id, cantidad_pedida, unidad, precio_unitario, ingredientes(nombre_ingrediente))')
      .in('estado', ['pendiente', 'confirmado'])
      .order('created_at', { ascending: false })
    setPedidosPendientes(data ?? [])
    setModalNueva(true)
  }

  useEffect(() => {
    if (!pedidoSelId) { setPedidoSel(null); setLineasRec([]); return }
    const p = pedidosPendientes.find(x => String(x.id) === pedidoSelId)
    setPedidoSel(p ?? null)
    setLineasRec((p?.pedidos_lineas ?? []).map(l => ({
      lineaId: l.id,
      nombre: l.ingredientes?.nombre_ingrediente ?? '—',
      unidad: l.unidad ?? '',
      cantPedida: l.cantidad_pedida,
      cantRecibida: String(l.cantidad_pedida),
      precioReal: l.precio_unitario != null ? String(l.precio_unitario) : '',
    })))
  }, [pedidoSelId, pedidosPendientes])

  async function verDetalle(id: number) {
    if (detalleId === id) { setDetalleId(null); return }
    setDetalleId(id)
    const { data } = await supabase
      .from('recepciones_lineas')
      .select('*, ingredientes(nombre_ingrediente, unidad_producto)')
      .eq('recepcion_id', id)
    setDetalleLineas(data ?? [])
  }

  async function guardarEntrega() {
    if (!pedidoSelId) { setError('Selecciona el pedido asociado'); return }
    if (!empleado.trim()) { setError('Indica quién recibe'); return }
    setGuardando(true); setError('')
    const { data: rec, error: err } = await supabase
      .from('recepciones_pedido')
      .insert({ pedido_id: Number(pedidoSelId), empleado_nombre: empleado.trim(), fecha_recepcion: fechaRec, numero_albaran: albaran.trim() || null, notas: notas.trim() || null })
      .select('id').single()
    if (err || !rec) { setError('Error al registrar la entrega'); setGuardando(false); return }
    await supabase.from('recepciones_lineas').insert(
      lineasRec.map(l => ({
        recepcion_id: rec.id,
        ingrediente_id: pedidoSel?.pedidos_lineas?.find(pl => pl.id === l.lineaId)?.ingrediente_id ?? null,
        cantidad_pedida: l.cantPedida,
        cantidad_recibida: Number(l.cantRecibida) || 0,
        precio_real: l.precioReal !== '' ? Number(l.precioReal) : null,
      }))
    )
    await supabase.from('pedidos_proveedor').update({ estado: 'recibido' }).eq('id', Number(pedidoSelId))
    setModalNueva(false); resetForm(); setGuardando(false); cargar()
  }

  function resetForm() {
    setPedidoSelId(''); setPedidoSel(null); setAlbaran(''); setFechaRec(new Date().toISOString().split('T')[0])
    setEmpleado(''); setNotas(''); setLineasRec([]); setError('')
  }

  function exportarExcel(entregaId: number) {
    const entrega = entregas.find(e => e.id === entregaId)
    if (!entrega) return
    const rows = detalleLineas.map(l => ({
      Ingrediente: l.ingredientes?.nombre_ingrediente ?? '',
      Unidad: l.ingredientes?.unidad_producto ?? '',
      'Cant. pedida': l.cantidad_pedida,
      'Cant. recibida': l.cantidad_recibida,
      Diferencia: l.diferencia,
      'Precio real (€/ud)': l.precio_real,
      'Subtotal real (€)': l.precio_real != null ? (l.cantidad_recibida * l.precio_real).toFixed(2) : '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Entrega')
    const prov = entrega.pedidos_proveedor?.proveedores?.nombre ?? ''
    XLSX.writeFile(wb, `entrega_${entregaId}_${entrega.numero_albaran ?? prov}.xlsx`)
  }

  const totalEntrega = (lineas: LineaEntrega[]) =>
    lineas.reduce((s, l) => s + l.cantidad_recibida * (l.precio_real ?? 0), 0)

  const hayDiferencias = (lineas: LineaEntrega[]) =>
    lineas.some(l => l.diferencia != null && Math.abs(l.diferencia) > 0.001)

  if (loading) return <div className="flex items-center justify-center min-h-screen"><RefreshCw className="animate-spin text-[#F5B731]" size={24} /></div>

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Entregas</h1>
          <p className="text-sm text-gray-400 mt-0.5">Recepciones y cotejo de pedidos</p>
        </div>
        <button onClick={abrirModalNueva} className="flex items-center gap-2 px-4 py-2 bg-[#F5B731] text-[#1A1A1A] text-sm font-semibold rounded-lg hover:bg-[#e0a820] transition-colors">
          <Plus size={15} /> Registrar entrega
        </button>
      </div>

      {entregas.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <Truck size={32} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">No hay entregas registradas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entregas.map(e => {
            const abierto = detalleId === e.id
            return (
              <div key={e.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button className="w-full px-5 py-4 flex items-start justify-between gap-3 text-left" onClick={() => verDetalle(e.id)}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-sm font-bold text-gray-800">{e.pedidos_proveedor?.proveedores?.nombre ?? '—'}</span>
                      {e.numero_albaran && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Albarán {e.numero_albaran}</span>}
                    </div>
                    <p className="text-xs text-gray-500">
                      {new Date(e.fecha_recepcion + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {' · '}{e.empleado_nombre}
                      {' · '}<span className="text-gray-400">Pedido #{e.pedido_id}</span>
                    </p>
                  </div>
                  {abierto ? <ChevronUp size={16} className="text-gray-400 mt-1" /> : <ChevronDown size={16} className="text-gray-400 mt-1" />}
                </button>

                {abierto && (
                  <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
                    {detalleLineas.length > 0 && (
                      <>
                        {hayDiferencias(detalleLineas) && (
                          <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 mb-3 text-xs text-orange-700 font-medium">
                            <AlertTriangle size={13} /> Hay diferencias entre lo pedido y lo recibido
                          </div>
                        )}
                        <table className="w-full text-sm mb-4">
                          <thead>
                            <tr className="text-xs text-gray-500 border-b border-gray-200">
                              <th className="text-left pb-2">Ingrediente</th>
                              <th className="text-right pb-2">Pedido</th>
                              <th className="text-right pb-2">Recibido</th>
                              <th className="text-right pb-2">Dif.</th>
                              <th className="text-right pb-2">€/ud real</th>
                              <th className="text-right pb-2">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {detalleLineas.map(l => {
                              const diff = l.diferencia ?? 0
                              return (
                                <tr key={l.id} className={Math.abs(diff) > 0.001 ? 'bg-orange-50' : ''}>
                                  <td className="py-1.5 text-gray-700">{l.ingredientes?.nombre_ingrediente ?? '—'}</td>
                                  <td className="py-1.5 text-right text-gray-500">{l.cantidad_pedida} {l.ingredientes?.unidad_producto ?? ''}</td>
                                  <td className="py-1.5 text-right text-gray-700 font-medium">{l.cantidad_recibida} {l.ingredientes?.unidad_producto ?? ''}</td>
                                  <td className={`py-1.5 text-right font-semibold ${Math.abs(diff) > 0.001 ? (diff > 0 ? 'text-blue-600' : 'text-orange-600') : 'text-emerald-600'}`}>
                                    {Math.abs(diff) > 0.001 ? `${diff > 0 ? '+' : ''}${diff.toFixed(2)}` : '✓'}
                                  </td>
                                  <td className="py-1.5 text-right text-gray-500">{l.precio_real != null ? `${l.precio_real} €` : '—'}</td>
                                  <td className="py-1.5 text-right font-semibold text-gray-800">
                                    {l.precio_real != null ? `${(l.cantidad_recibida * l.precio_real).toFixed(2)} €` : '—'}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-gray-200 font-bold text-gray-900">
                              <td colSpan={5} className="pt-2 text-sm">Total real recibido</td>
                              <td className="pt-2 text-right">{totalEntrega(detalleLineas).toFixed(2)} €</td>
                            </tr>
                          </tfoot>
                        </table>
                        {e.notas && <p className="text-xs text-gray-400 italic mb-3">{e.notas}</p>}
                        <button onClick={() => exportarExcel(e.id)}
                          className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-1 ml-auto">
                          <Download size={12} /> Exportar Excel
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal nueva entrega */}
      {modalNueva && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="text-sm font-semibold text-gray-800">Registrar entrega</h2>
              <button onClick={() => { setModalNueva(false); resetForm() }} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Pedido asociado *</label>
                <select className={inputCls} value={pedidoSelId} onChange={e => setPedidoSelId(e.target.value)}>
                  <option value="">— Seleccionar pedido —</option>
                  {pedidosPendientes.map(p => (
                    <option key={p.id} value={p.id}>
                      #{p.id} · {p.proveedores?.nombre ?? '—'} · {new Date(p.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Recibido por *</label>
                  <input className={inputCls} placeholder="Nombre" value={empleado} onChange={e => setEmpleado(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Fecha recepción *</label>
                  <input type="date" className={inputCls} value={fechaRec} onChange={e => setFechaRec(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Nº albarán</label>
                  <input className={inputCls} placeholder="Ej: ALB-2026-001" value={albaran} onChange={e => setAlbaran(e.target.value)} />
                </div>
              </div>

              {lineasRec.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Verificación artículo por artículo</p>
                  <div className="space-y-2">
                    {lineasRec.map((l, idx) => {
                      const diff = (Number(l.cantRecibida) || 0) - l.cantPedida
                      const hayDiff = Math.abs(diff) > 0.001
                      return (
                        <div key={l.lineaId} className={`rounded-xl border p-3 ${hayDiff ? 'border-orange-200 bg-orange-50' : 'border-gray-200'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-semibold text-gray-800">{l.nombre}</p>
                            {hayDiff && (
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${diff > 0 ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                                <AlertTriangle size={10} /> {diff > 0 ? '+' : ''}{diff.toFixed(2)} {l.unidad}
                              </span>
                            )}
                            {!hayDiff && Number(l.cantRecibida) > 0 && <CheckCircle2 size={15} className="text-emerald-500" />}
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <p className="text-xs text-gray-400 mb-1">Pedido</p>
                              <div className="px-2 py-1.5 bg-gray-100 rounded text-xs text-center text-gray-600 font-semibold">{l.cantPedida} {l.unidad}</div>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400 mb-1">Recibido *</p>
                              <input type="number" step="0.01" className={inputCls + ' text-center'} value={l.cantRecibida}
                                onChange={e => { const n=[...lineasRec]; n[idx]={...n[idx],cantRecibida:e.target.value}; setLineasRec(n) }} />
                            </div>
                            <div>
                              <p className="text-xs text-gray-400 mb-1">Precio real (€/ud)</p>
                              <input type="number" step="0.0001" className={inputCls + ' text-right'} value={l.precioReal}
                                onChange={e => { const n=[...lineasRec]; n[idx]={...n[idx],precioReal:e.target.value}; setLineasRec(n) }} />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {/* Total real */}
                  {lineasRec.some(l => l.precioReal !== '') && (
                    <div className="mt-3 px-4 py-3 bg-gray-900 text-white rounded-xl flex justify-between">
                      <span className="text-sm font-semibold">Total real recibido</span>
                      <span className="text-lg font-bold">
                        {lineasRec.reduce((s,l) => s + (Number(l.cantRecibida)||0)*(Number(l.precioReal)||0), 0).toFixed(2)} €
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Notas</label>
                <input className={inputCls} placeholder="Incidencias, observaciones..." value={notas} onChange={e => setNotas(e.target.value)} />
              </div>

              {error && <p className="text-xs text-rose-500 flex items-center gap-1"><AlertTriangle size={12} /> {error}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => { setModalNueva(false); resetForm() }} className="px-4 py-2 text-sm text-gray-600">Cancelar</button>
                <button onClick={guardarEntrega} disabled={guardando} className="px-4 py-2 text-sm font-semibold bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50">
                  {guardando ? 'Guardando...' : 'Confirmar entrega'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

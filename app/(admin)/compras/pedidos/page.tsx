'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import type { Ingrediente } from '@/lib/supabase'
import {
  Plus, X, RefreshCw, ShoppingCart, ChevronDown, ChevronUp,
  Download, MessageCircle, Copy, Check, AlertTriangle, CheckCircle2, Search,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────
type Proveedor = { id: number; nombre: string; telefono: string | null }
type Local = { id: number; nombre: string }
type LineaForm = { ingrediente: Ingrediente; cantidad: string; precio: string }
type Pedido = {
  id: number; local_id: number | null; empleado_nombre: string
  proveedor_id: number | null; estado: string; notas: string | null; created_at: string
  proveedores?: { nombre: string; telefono: string | null } | null
}
type LineaDetalle = {
  id: number; ingrediente_id: number | null; cantidad_pedida: number
  unidad: string | null; precio_unitario: number | null
  ingredientes?: { nombre_ingrediente: string } | null
}

const ESTADO_CFG = {
  pendiente:  { label: 'Pendiente',  cls: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-400' },
  confirmado: { label: 'Confirmado', cls: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-500' },
  recibido:   { label: 'Recibido',   cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  cancelado:  { label: 'Cancelado',  cls: 'bg-rose-100 text-rose-600',     dot: 'bg-rose-400' },
}

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white'

function construirMensajeWA(lineas: LineaForm[], notas: string): string {
  const fecha = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const items = lineas
    .filter(l => Number(l.cantidad) > 0)
    .map(l => `${l.ingrediente.nombre_ingrediente}: ${l.cantidad}${l.ingrediente.unidad_producto ? ' ' + l.ingrediente.unidad_producto : ''}`)
    .join('\n')
  const extra = notas.trim() ? `\n\nNota: ${notas.trim()}` : ''
  return `*SOFI PINOMONTANO*\n\nPedido realizado el ${fecha}\n\n${items}${extra}\n\nGracias`
}

// ── WhatsApp Modal ───────────────────────────────────────────
function ModalWA({ mensaje, telefono, provNombre, onCerrar }: {
  mensaje: string; telefono: string | null; provNombre: string; onCerrar: () => void
}) {
  const [copiado, setCopiado] = useState(false)
  async function copiar() {
    try { await navigator.clipboard.writeText(mensaje) } catch { /* fallback */ }
    setCopiado(true); setTimeout(() => setCopiado(false), 2500)
  }
  function abrirWA() {
    const tel = (telefono ?? '').replace(/\D/g, '')
    window.open(`https://wa.me/${tel || ''}?text=${encodeURIComponent(mensaje)}`, '_blank', 'noopener')
  }
  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/70">
      <div className="w-full md:max-w-md bg-[#0b141a] md:rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-[#202c33] px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#00a884] flex items-center justify-center">
              <MessageCircle size={18} className="text-white" />
            </div>
            <div>
              <p className="text-base font-bold text-white">{provNombre}</p>
              <p className="text-xs text-[#8696a0]">Mensaje listo para enviar</p>
            </div>
          </div>
          <button onClick={onCerrar} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10">
            <X size={18} className="text-[#8696a0]" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-5 bg-[#0b141a]">
          <div className="flex justify-end">
            <div className="bg-[#005c4b] rounded-2xl rounded-tr-sm px-4 py-3 max-w-[92%] shadow-md">
              <pre className="text-[15px] leading-relaxed text-white whitespace-pre-wrap font-sans">{mensaje}</pre>
              <p className="text-right text-[11px] text-[#8edfcb] mt-1.5">
                {new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} ✓✓
              </p>
            </div>
          </div>
        </div>
        <div className="bg-[#0b141a] border-t border-[#2a3942] px-4 py-4 space-y-3 flex-shrink-0">
          <button onClick={copiar} className={`w-full min-h-[52px] rounded-xl text-base font-bold flex items-center justify-center gap-3 transition-all ${copiado ? 'bg-emerald-600 text-white' : 'bg-[#202c33] text-white hover:bg-[#2a3942]'}`}>
            {copiado ? <><Check size={18} /> Copiado</> : <><Copy size={18} /> Copiar mensaje</>}
          </button>
          <button onClick={abrirWA} className="w-full min-h-[52px] rounded-xl text-base font-bold bg-[#25d366] text-white flex items-center justify-center gap-3 hover:bg-[#20bd5a] transition-all shadow-lg shadow-[#25d366]/20">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Abrir WhatsApp
          </button>
          <button onClick={onCerrar} className="w-full py-3 text-sm text-[#8696a0] hover:text-white hover:bg-[#202c33] rounded-xl transition-colors min-h-[44px]">Cerrar</button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
export default function PaginaComprasPedidos() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [locales, setLocales] = useState<Local[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroProveedor, setFiltroProveedor] = useState('')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')
  const [detalleId, setDetalleId] = useState<number | null>(null)
  const [detalleLineas, setDetalleLineas] = useState<LineaDetalle[]>([])
  const [modalNuevo, setModalNuevo] = useState(false)
  const [modalWA, setModalWA] = useState<{ mensaje: string; telefono: string | null; provNombre: string } | null>(null)
  const [cambiandoEstado, setCambiandoEstado] = useState<number | null>(null)

  // Form nuevo pedido
  const [formLocal, setFormLocal] = useState('')
  const [formEmpleado, setFormEmpleado] = useState('')
  const [formProv, setFormProv] = useState('')
  const [formLineas, setFormLineas] = useState<LineaForm[]>([])
  const [formIngredientes, setFormIngredientes] = useState<Ingrediente[]>([])
  const [formNotas, setFormNotas] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [formError, setFormError] = useState('')

  const cargar = useCallback(async () => {
    const [{ data: p }, { data: l }, { data: pr }] = await Promise.all([
      supabase.from('pedidos_proveedor').select('*, proveedores(nombre, telefono)').order('created_at', { ascending: false }),
      supabase.from('locales').select('id,nombre').eq('activo', true).order('nombre'),
      supabase.from('proveedores').select('id,nombre,telefono').eq('activo', true).order('nombre'),
    ])
    setPedidos(p ?? [])
    setLocales(l ?? [])
    setProveedores(pr ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    if (!formProv) { setFormIngredientes([]); setFormLineas([]); return }
    supabase.from('ingredientes').select('*').eq('proveedor_id', Number(formProv)).order('nombre_ingrediente')
      .then(({ data }) => {
        const ings = data ?? []
        setFormIngredientes(ings)
        setFormLineas(ings.map(i => ({ ingrediente: i, cantidad: '', precio: i.precio_unidad_producto != null ? String(i.precio_unidad_producto) : '' })))
      })
  }, [formProv])

  async function verDetalle(id: number) {
    if (detalleId === id) { setDetalleId(null); return }
    setDetalleId(id)
    const { data } = await supabase.from('pedidos_lineas')
      .select('*, ingredientes(nombre_ingrediente)').eq('pedido_id', id)
    setDetalleLineas(data ?? [])
  }

  const filtrados = useMemo(() => pedidos.filter(p => {
    const fecha = p.created_at.slice(0, 10)
    return (
      (!filtroEstado || p.estado === filtroEstado) &&
      (!filtroProveedor || String(p.proveedor_id) === filtroProveedor) &&
      (!filtroDesde || fecha >= filtroDesde) &&
      (!filtroHasta || fecha <= filtroHasta)
    )
  }), [pedidos, filtroEstado, filtroProveedor, filtroDesde, filtroHasta])

  const lineasConCantidad = useMemo(() => formLineas.filter(l => Number(l.cantidad) > 0), [formLineas])
  const totalFormulario = useMemo(() =>
    lineasConCantidad.reduce((s, l) => s + Number(l.cantidad) * (Number(l.precio) || 0), 0),
    [lineasConCantidad]
  )

  async function guardarPedido() {
    if (!formEmpleado.trim()) { setFormError('Indica quién realiza el pedido'); return }
    if (!formProv) { setFormError('Selecciona un proveedor'); return }
    if (lineasConCantidad.length === 0) { setFormError('Añade al menos un artículo con cantidad'); return }
    setGuardando(true); setFormError('')
    const { data: pedido, error: err } = await supabase.from('pedidos_proveedor')
      .insert({ local_id: formLocal ? Number(formLocal) : null, empleado_nombre: formEmpleado.trim(), proveedor_id: Number(formProv), notas: formNotas.trim() || null })
      .select('id').single()
    if (err || !pedido) { setFormError('Error al crear el pedido'); setGuardando(false); return }
    await supabase.from('pedidos_lineas').insert(
      lineasConCantidad.map(l => ({
        pedido_id: pedido.id,
        ingrediente_id: l.ingrediente.id,
        cantidad_pedida: Number(l.cantidad),
        unidad: l.ingrediente.unidad_producto,
        precio_unitario: Number(l.precio) || null,
      }))
    )
    const prov = proveedores.find(p => String(p.id) === formProv)
    const msg = construirMensajeWA(lineasConCantidad, formNotas)
    setModalWA({ mensaje: msg, telefono: prov?.telefono ?? null, provNombre: prov?.nombre ?? '' })
    setModalNuevo(false)
    setFormProv(''); setFormEmpleado(''); setFormNotas(''); setFormLineas([]); setFormLocal('')
    setGuardando(false); cargar()
  }

  async function cambiarEstado(id: number, estado: string) {
    setCambiandoEstado(id)
    await supabase.from('pedidos_proveedor').update({ estado }).eq('id', id)
    setCambiandoEstado(null); cargar()
    if (detalleId === id) setDetalleId(null)
  }

  function exportarPedidoExcel(pedidoId: number) {
    const pedido = pedidos.find(p => p.id === pedidoId)
    if (!pedido) return
    const rows = detalleLineas.map(l => ({
      Ingrediente: l.ingredientes?.nombre_ingrediente ?? '',
      Cantidad: l.cantidad_pedida,
      Unidad: l.unidad ?? '',
      'Precio unit. (€)': l.precio_unitario,
      'Subtotal (€)': l.precio_unitario != null ? (l.cantidad_pedida * l.precio_unitario).toFixed(2) : '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Pedido')
    XLSX.writeFile(wb, `pedido_${pedidoId}_${pedido.proveedores?.nombre ?? ''}.xlsx`)
  }

  function totalLineas(lineas: LineaDetalle[]) {
    return lineas.reduce((s, l) => s + l.cantidad_pedida * (l.precio_unitario ?? 0), 0)
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><RefreshCw className="animate-spin text-[#F5B731]" size={24} /></div>

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-5 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pedidos a Proveedor</h1>
          <p className="text-sm text-gray-400 mt-0.5">{pedidos.length} pedidos en total</p>
        </div>
        <button onClick={() => setModalNuevo(true)} className="flex items-center gap-2 px-4 py-2 bg-[#F5B731] text-[#1A1A1A] text-sm font-semibold rounded-lg hover:bg-[#e0a820] transition-colors">
          <Plus size={15} /> Nuevo pedido
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {(Object.entries(ESTADO_CFG) as [string, typeof ESTADO_CFG[keyof typeof ESTADO_CFG]][]).map(([k, v]) => {
          const count = pedidos.filter(p => p.estado === k).length
          return (
            <div key={k} className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-400 mb-1">{v.label}</p>
              <p className={`text-2xl font-bold ${count > 0 ? 'text-gray-900' : 'text-gray-300'}`}>{count}</p>
            </div>
          )
        })}
      </div>

      {/* Filtros */}
      <div className="flex gap-3 mb-5 flex-wrap items-center">
        <select className={`${inputCls} w-auto`} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className={`${inputCls} w-auto`} value={filtroProveedor} onChange={e => setFiltroProveedor(e.target.value)}>
          <option value="">Todos los proveedores</option>
          {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <input type="date" className={`${inputCls} w-auto`} value={filtroDesde} onChange={e => setFiltroDesde(e.target.value)} />
        <span className="text-gray-400 text-sm">→</span>
        <input type="date" className={`${inputCls} w-auto`} value={filtroHasta} onChange={e => setFiltroHasta(e.target.value)} />
        <span className="text-xs text-gray-400">{filtrados.length} pedidos</span>
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {filtrados.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
            <ShoppingCart size={32} className="mx-auto text-gray-200 mb-3" />
            <p className="text-sm text-gray-400">No hay pedidos con los filtros actuales</p>
          </div>
        )}
        {filtrados.map(p => {
          const cfg = ESTADO_CFG[p.estado as keyof typeof ESTADO_CFG] ?? ESTADO_CFG.pendiente
          const abierto = detalleId === p.id
          return (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button className="w-full px-5 py-4 flex items-start justify-between gap-3 text-left" onClick={() => verDetalle(p.id)}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${cfg.cls}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />{cfg.label}
                    </span>
                    <span className="text-sm font-bold text-gray-800">{p.proveedores?.nombre ?? '—'}</span>
                    <span className="text-xs text-gray-400">#{p.id}</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {new Date(p.created_at).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                    {' · '}{p.empleado_nombre}
                    {p.notas && <span className="italic"> · {p.notas.slice(0, 40)}{p.notas.length > 40 ? '…' : ''}</span>}
                  </p>
                </div>
                {abierto ? <ChevronUp size={16} className="text-gray-400 mt-1 flex-shrink-0" /> : <ChevronDown size={16} className="text-gray-400 mt-1 flex-shrink-0" />}
              </button>

              {abierto && (
                <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
                  {detalleLineas.length > 0 && (
                    <>
                      <table className="w-full text-sm mb-4">
                        <thead>
                          <tr className="text-xs text-gray-500 border-b border-gray-200">
                            <th className="text-left pb-2">Ingrediente</th>
                            <th className="text-right pb-2">Cantidad</th>
                            <th className="text-right pb-2">Precio/ud</th>
                            <th className="text-right pb-2">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {detalleLineas.map(l => (
                            <tr key={l.id}>
                              <td className="py-1.5 text-gray-700">{l.ingredientes?.nombre_ingrediente ?? '—'}</td>
                              <td className="py-1.5 text-right text-gray-600">{l.cantidad_pedida} {l.unidad ?? ''}</td>
                              <td className="py-1.5 text-right text-gray-500">{l.precio_unitario != null ? `${l.precio_unitario} €` : '—'}</td>
                              <td className="py-1.5 text-right font-semibold text-gray-800">
                                {l.precio_unitario != null ? `${(l.cantidad_pedida * l.precio_unitario).toFixed(2)} €` : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-gray-200 font-bold text-gray-900">
                            <td colSpan={3} className="pt-2 text-sm">Total</td>
                            <td className="pt-2 text-right">{totalLineas(detalleLineas).toFixed(2)} €</td>
                          </tr>
                        </tfoot>
                      </table>
                      <div className="flex gap-2 flex-wrap">
                        {p.estado === 'pendiente' && (
                          <button onClick={() => cambiarEstado(p.id, 'confirmado')} disabled={cambiandoEstado === p.id}
                            className="px-3 py-1.5 text-xs font-semibold bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50">
                            Confirmar
                          </button>
                        )}
                        {(p.estado === 'pendiente' || p.estado === 'confirmado') && (
                          <button onClick={() => cambiarEstado(p.id, 'recibido')} disabled={cambiandoEstado === p.id}
                            className="px-3 py-1.5 text-xs font-semibold bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50">
                            Marcar recibido
                          </button>
                        )}
                        {p.estado !== 'cancelado' && p.estado !== 'recibido' && (
                          <button onClick={() => cambiarEstado(p.id, 'cancelado')} disabled={cambiandoEstado === p.id}
                            className="px-3 py-1.5 text-xs font-semibold border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-100 disabled:opacity-50">
                            Cancelar
                          </button>
                        )}
                        <button onClick={() => exportarPedidoExcel(p.id)}
                          className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-1 ml-auto">
                          <Download size={12} /> Excel
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal nuevo pedido */}
      {modalNuevo && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="text-sm font-semibold text-gray-800">Nuevo pedido a proveedor</h2>
              <button onClick={() => setModalNuevo(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div className="px-6 py-5 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Local</label>
                  <select className={inputCls} value={formLocal} onChange={e => setFormLocal(e.target.value)}>
                    <option value="">— Sin especificar —</option>
                    {locales.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Realizado por *</label>
                  <input className={inputCls} placeholder="Nombre" value={formEmpleado} onChange={e => setFormEmpleado(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Proveedor *</label>
                <select className={inputCls} value={formProv} onChange={e => setFormProv(e.target.value)}>
                  <option value="">— Seleccionar proveedor —</option>
                  {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>

              {formProv && formIngredientes.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-gray-500">Artículos</label>
                    <span className="text-xs text-gray-400">Total: <strong>{totalFormulario.toFixed(2)} €</strong></span>
                  </div>
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {formLineas.map((l, idx) => (
                      <div key={l.ingrediente.id} className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm ${Number(l.cantidad) > 0 ? 'border-[#F5B731] bg-amber-50' : 'border-gray-100 bg-gray-50'}`}>
                        <span className="flex-1 truncate text-gray-700 font-medium">{l.ingrediente.nombre_ingrediente}</span>
                        <span className="text-xs text-gray-400 w-6">{l.ingrediente.unidad_producto}</span>
                        <input type="number" min="0" step="0.1" placeholder="Cant." className="w-20 px-2 py-1 text-sm border border-gray-200 rounded-lg text-center focus:ring-1 focus:ring-[#F5B731] focus:outline-none"
                          value={l.cantidad} onChange={e => { const n=[...formLineas]; n[idx]={...n[idx],cantidad:e.target.value}; setFormLineas(n) }} />
                        <input type="number" min="0" step="0.0001" placeholder="€/ud" className="w-20 px-2 py-1 text-sm border border-gray-200 rounded-lg text-right focus:ring-1 focus:ring-[#F5B731] focus:outline-none"
                          value={l.precio} onChange={e => { const n=[...formLineas]; n[idx]={...n[idx],precio:e.target.value}; setFormLineas(n) }} />
                        <span className="text-xs text-gray-500 w-16 text-right tabular-nums">
                          {Number(l.cantidad) > 0 && Number(l.precio) > 0 ? `${(Number(l.cantidad)*Number(l.precio)).toFixed(2)}€` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Notas / artículos adicionales no listados</label>
                <textarea className={`${inputCls} resize-none`} rows={3}
                  placeholder="Productos no listados, instrucciones especiales..."
                  value={formNotas} onChange={e => setFormNotas(e.target.value)} />
              </div>

              {formError && <p className="text-xs text-rose-500 flex items-center gap-1"><AlertTriangle size={12} /> {formError}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setModalNuevo(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
                <button onClick={guardarPedido} disabled={guardando} className="px-4 py-2 text-sm font-semibold bg-[#F5B731] text-[#1A1A1A] rounded-lg hover:bg-[#e0a820] disabled:opacity-50">
                  {guardando ? 'Guardando...' : 'Crear pedido'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalWA && <ModalWA {...modalWA} onCerrar={() => setModalWA(null)} />}
    </div>
  )
}

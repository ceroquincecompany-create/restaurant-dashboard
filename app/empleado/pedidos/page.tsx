'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { Ingrediente } from '@/lib/supabase'
import { useEmpleadoActual } from '@/lib/useEmpleado'
import {
  RefreshCw, ShoppingCart, ChevronDown, ChevronUp, ChevronRight,
  AlertTriangle, Package, MessageCircle, Copy, Check, X, Plus,
  Search, ArrowLeft, RotateCcw,
} from 'lucide-react'

type Proveedor = { id: number; nombre: string; telefono: string | null; numIngredientes: number }
type LineaPedido  = { ingrediente: Ingrediente; cantidad: string }
type ModalWAData  = { mensaje: string; telefono: string | null; provNombre: string }
type Paso = 1 | 2 | 3

const ESTADO_CFG: Record<string, { label: string; cls: string }> = {
  pendiente:  { label: 'Pendiente',  cls: 'bg-amber-100 text-amber-700' },
  confirmado: { label: 'Confirmado', cls: 'bg-blue-100 text-blue-700' },
  recibido:   { label: 'Recibido',   cls: 'bg-emerald-100 text-emerald-700' },
  cancelado:  { label: 'Cancelado',  cls: 'bg-gray-100 text-gray-500' },
}

function construirMensajeWA(lineas: LineaPedido[], notas: string): string {
  const fecha = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const items = lineas
    .filter(l => Number(l.cantidad) > 0)
    .map(l => `${l.ingrediente.nombre_ingrediente}: ${l.cantidad}${l.ingrediente.unidad_producto ? ' ' + l.ingrediente.unidad_producto : ''}`)
    .join('\n')
  const notasText = notas.trim() ? `\n\n${notas.trim()}` : ''
  return `*SOFI PINOMONTANO*\n\nPedido realizado el ${fecha}\n\n${items}${notasText}\n\nGracias`
}

// ── Modal WhatsApp ────────────────────────────────────────────
function ModalWhatsApp({ data, onCerrar }: { data: ModalWAData; onCerrar: () => void }) {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    try { await navigator.clipboard.writeText(data.mensaje) } catch {
      const el = document.createElement('textarea')
      el.value = data.mensaje; document.body.appendChild(el)
      el.select(); document.execCommand('copy'); document.body.removeChild(el)
    }
    setCopiado(true); setTimeout(() => setCopiado(false), 2500)
  }

  function abrirWA() {
    const tel = (data.telefono ?? '').replace(/\D/g, '')
    const url = tel
      ? `https://wa.me/${tel}?text=${encodeURIComponent(data.mensaje)}`
      : `https://wa.me/?text=${encodeURIComponent(data.mensaje)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/75 px-0 md:px-4">
      <div className="w-full md:max-w-md bg-[#0b141a] md:rounded-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="bg-[#202c33] px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#00a884] flex items-center justify-center">
              <MessageCircle size={18} className="text-white" />
            </div>
            <div>
              <p className="text-base font-bold text-white">{data.provNombre}</p>
              <p className="text-xs text-[#8696a0]">Mensaje listo para enviar</p>
            </div>
          </div>
          <button onClick={onCerrar} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10">
            <X size={18} className="text-[#8696a0]" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-5" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #0d1f17 0%, #0b141a 100%)' }}>
          <div className="flex justify-end">
            <div className="bg-[#005c4b] rounded-2xl rounded-tr-sm px-4 py-3 max-w-[90%] shadow-md">
              <pre className="text-[15px] leading-relaxed text-white whitespace-pre-wrap font-sans">{data.mensaje}</pre>
              <div className="flex justify-end mt-1.5">
                <span className="text-[11px] text-[#8edfcb]">{new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} ✓✓</span>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-[#0b141a] border-t border-[#2a3942] px-4 py-4 space-y-3 flex-shrink-0">
          <button onClick={copiar}
            className={`w-full min-h-[56px] rounded-xl text-base font-bold flex items-center justify-center gap-3 active:scale-[0.98] transition-all ${copiado ? 'bg-emerald-600 text-white' : 'bg-[#202c33] text-white hover:bg-[#2a3942]'}`}>
            {copiado ? <><Check size={20} /> Copiado</> : <><Copy size={20} /> Copiar mensaje</>}
          </button>
          <button onClick={abrirWA}
            className="w-full min-h-[56px] rounded-xl text-base font-bold bg-[#25d366] text-white flex items-center justify-center gap-3 hover:bg-[#20bd5a] active:scale-[0.98] transition-all">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Abrir WhatsApp
            {!data.telefono && <span className="text-xs opacity-70">(sin número)</span>}
          </button>
          <button onClick={onCerrar} className="w-full py-3 rounded-xl text-sm font-medium text-[#8696a0] hover:text-white hover:bg-[#202c33] transition-colors min-h-[44px]">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ════════════════════════════════════════════════════════════
export default function PaginaEmpleadoPedidos() {
  const { empleado, loading: empLoading } = useEmpleadoActual()

  const [proveedores, setProveedores]         = useState<Proveedor[]>([])
  const [historial, setHistorial]             = useState<any[]>([])
  const [cargandoHistorial, setCargandoHistorial] = useState(true)
  const [detalleAbierto, setDetalleAbierto]   = useState<number | null>(null)
  const [detalleLineas, setDetalleLineas]     = useState<Record<number, any[]>>({})
  const [cargandoDetalle, setCargandoDetalle] = useState(false)

  // Modal nuevo pedido
  const [modalNuevo, setModalNuevo]   = useState(false)
  const [paso, setPaso]               = useState<Paso>(1)
  const [provSelId, setProvSelId]     = useState('')
  const [busqProv, setBusqProv]       = useState('')
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([])
  const [lineas, setLineas]           = useState<LineaPedido[]>([])
  const [busqIng, setBusqIng]         = useState('')
  const [notas, setNotas]             = useState('')
  const [enviando, setEnviando]       = useState(false)
  const [errorModal, setErrorModal]   = useState('')
  const [cargandoIngs, setCargandoIngs] = useState(false)

  // Modal WhatsApp
  const [modalWA, setModalWA] = useState<ModalWAData | null>(null)

  // ── Cargar proveedores con ingredientes ──────────────────
  useEffect(() => {
    async function init() {
      const [{ data: provs }, { data: ingProv }] = await Promise.all([
        supabase.from('proveedores').select('id,nombre,telefono').eq('activo', true).order('nombre'),
        supabase.from('ingredientes').select('proveedor_id').not('proveedor_id', 'is', null),
      ])
      const conteo: Record<number, number> = {}
      ;(ingProv ?? []).forEach((i: any) => {
        if (i.proveedor_id) conteo[i.proveedor_id] = (conteo[i.proveedor_id] ?? 0) + 1
      })
      setProveedores(
        (provs ?? [])
          .filter((p: any) => (conteo[p.id] ?? 0) > 0)
          .map((p: any) => ({ ...p, numIngredientes: conteo[p.id] })) as Proveedor[]
      )
    }
    init()
  }, [])

  // ── Cargar historial ────────────────────────────────────
  const cargarHistorial = useCallback(async () => {
    if (!empleado) return
    setCargandoHistorial(true)
    const { data } = await supabase
      .from('pedidos_proveedor')
      .select('id, proveedor_id, notas, estado, created_at, proveedores(nombre)')
      .eq('empleado_nombre', empleado.nombre)
      .order('created_at', { ascending: false })
      .limit(30)
    setHistorial(data ?? [])
    setCargandoHistorial(false)
  }, [empleado])

  useEffect(() => { if (empleado) cargarHistorial() }, [empleado, cargarHistorial])

  // ── Abrir/cerrar detalle de pedido ───────────────────────
  async function toggleDetalle(pedidoId: number) {
    if (detalleAbierto === pedidoId) { setDetalleAbierto(null); return }
    setDetalleAbierto(pedidoId)
    if (detalleLineas[pedidoId]) return // Ya cargado
    setCargandoDetalle(true)
    const { data } = await supabase
      .from('pedidos_lineas')
      .select('*, ingredientes(nombre_ingrediente, unidad_producto)')
      .eq('pedido_id', pedidoId)
    setDetalleLineas(prev => ({ ...prev, [pedidoId]: data ?? [] }))
    setCargandoDetalle(false)
  }

  // ── Cargar ingredientes para el modal ────────────────────
  async function cargarIngredientesProveedor(provId: string, cantidadesPrevias: Record<number, string> = {}) {
    setCargandoIngs(true)
    const { data } = await supabase
      .from('ingredientes').select('*')
      .eq('proveedor_id', Number(provId)).order('nombre_ingrediente')
    const ings = (data ?? []) as Ingrediente[]
    setIngredientes(ings)
    setLineas(ings.map(i => ({ ingrediente: i, cantidad: cantidadesPrevias[i.id] ?? '' })))
    setCargandoIngs(false)
  }

  // ── Repetir pedido ───────────────────────────────────────
  async function repetirPedido(pedido: any) {
    let lineasPedido = detalleLineas[pedido.id] ?? []
    if (lineasPedido.length === 0) {
      const { data } = await supabase
        .from('pedidos_lineas')
        .select('ingrediente_id, cantidad_pedida')
        .eq('pedido_id', pedido.id)
      lineasPedido = data ?? []
    }
    const cantidadesPrevias: Record<number, string> = {}
    lineasPedido.forEach((l: any) => {
      if (l.ingrediente_id && l.cantidad_pedida > 0) {
        cantidadesPrevias[l.ingrediente_id] = String(l.cantidad_pedida)
      }
    })
    const provId = String(pedido.proveedor_id)
    setProvSelId(provId); setBusqProv(''); setBusqIng(''); setNotas(''); setErrorModal('')
    await cargarIngredientesProveedor(provId, cantidadesPrevias)
    setPaso(2)
    setModalNuevo(true)
  }

  // ── Cerrar modal ────────────────────────────────────────
  function cerrarModal() {
    setModalNuevo(false)
    setPaso(1); setProvSelId(''); setBusqProv(''); setBusqIng('')
    setNotas(''); setErrorModal(''); setIngredientes([]); setLineas([])
  }

  // ── Enviar pedido ────────────────────────────────────────
  async function enviarPedido() {
    if (!empleado) return
    setEnviando(true); setErrorModal('')

    const { data: pedido, error: errP } = await supabase
      .from('pedidos_proveedor')
      .insert({
        local_id: empleado.local_id,
        empleado_nombre: empleado.nombre,
        proveedor_id: Number(provSelId),
        notas: notas.trim() || null,
      })
      .select('id').single()

    if (errP || !pedido) { setErrorModal('Error al crear el pedido'); setEnviando(false); return }

    const seleccionadas = lineas.filter(l => l.cantidad !== '' && Number(l.cantidad) > 0)
    if (seleccionadas.length > 0) {
      await supabase.from('pedidos_lineas').insert(
        seleccionadas.map(l => ({
          pedido_id: pedido.id,
          ingrediente_id: l.ingrediente.id,
          cantidad_pedida: Number(l.cantidad),
          unidad: l.ingrediente.unidad_producto,
        }))
      )
    }

    const provObj = proveedores.find(p => String(p.id) === provSelId)
    const mensaje = construirMensajeWA(seleccionadas, notas)
    setModalWA({ mensaje, telefono: provObj?.telefono ?? null, provNombre: provObj?.nombre ?? 'Proveedor' })
    setEnviando(false)
    cerrarModal()
    cargarHistorial()
  }

  // ── Derivados ────────────────────────────────────────────
  const lineasConCantidad = useMemo(
    () => lineas.filter(l => l.cantidad !== '' && Number(l.cantidad) > 0),
    [lineas]
  )

  const proveedoresFiltrados = useMemo(() => {
    const q = busqProv.toLowerCase()
    return q ? proveedores.filter(p => p.nombre.toLowerCase().includes(q)) : proveedores
  }, [proveedores, busqProv])

  const ingredientesFiltrados = useMemo(() => {
    const q = busqIng.toLowerCase()
    return q ? ingredientes.filter(i => i.nombre_ingrediente.toLowerCase().includes(q)) : ingredientes
  }, [ingredientes, busqIng])

  const proveedorSel = proveedores.find(p => String(p.id) === provSelId)
  const puedeVerResumen = lineasConCantidad.length > 0 || notas.trim().length > 0

  if (empLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <RefreshCw className="animate-spin text-[#F5B731]" size={24} />
    </div>
  )

  return (
    <div className="px-4 py-5 md:px-6 max-w-2xl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Pedidos a proveedor</h1>
        <button
          onClick={() => { cerrarModal(); setModalNuevo(true) }}
          className="w-11 h-11 rounded-full bg-[#F5B731] text-[#1A1A1A] flex items-center justify-center shadow-md active:scale-95 transition-transform"
          aria-label="Nuevo pedido"
        >
          <Plus size={22} />
        </button>
      </div>

      {/* ── Historial ── */}
      {cargandoHistorial ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="animate-spin text-[#F5B731]" size={24} />
        </div>
      ) : historial.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
          <ShoppingCart size={36} className="mx-auto text-gray-200 mb-3" />
          <p className="text-base font-semibold text-gray-500">Aún no has realizado pedidos</p>
          <p className="text-sm text-gray-400 mt-1">Toca el botón + para crear tu primer pedido</p>
        </div>
      ) : (
        <div className="space-y-2">
          {historial.map(p => {
            const cfg = ESTADO_CFG[p.estado as string] ?? ESTADO_CFG.pendiente
            const abierto = detalleAbierto === p.id
            const lineasPedido = detalleLineas[p.id] ?? []
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                {/* Cabecera del item */}
                <button
                  className="w-full px-4 py-4 flex items-center gap-3 text-left min-h-[68px] active:bg-gray-50 transition-colors"
                  onClick={() => toggleDetalle(p.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-base font-bold text-gray-900">
                        {(p.proveedores as any)?.nombre ?? '—'}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">
                      {new Date(p.created_at).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  {abierto
                    ? <ChevronUp size={18} className="text-gray-300 flex-shrink-0" />
                    : <ChevronDown size={18} className="text-gray-300 flex-shrink-0" />
                  }
                </button>

                {/* Detalle expandido */}
                {abierto && (
                  <div className="border-t border-gray-100 bg-gray-50/50">
                    {cargandoDetalle && !detalleLineas[p.id] ? (
                      <div className="flex items-center justify-center py-6">
                        <RefreshCw className="animate-spin text-gray-400" size={18} />
                      </div>
                    ) : lineasPedido.length === 0 && !p.notas ? (
                      <div className="px-4 py-4 text-sm text-gray-400 text-center">Sin artículos registrados</div>
                    ) : (
                      <div>
                        {lineasPedido.length > 0 && (
                          <div className="px-4 py-3 divide-y divide-gray-100">
                            {lineasPedido.map((l: any) => (
                              <div key={l.id} className="flex items-center justify-between py-2.5 min-h-[40px]">
                                <span className="text-sm text-gray-700">{l.ingredientes?.nombre_ingrediente ?? '—'}</span>
                                <span className="text-sm font-bold text-gray-900 tabular-nums">
                                  {l.cantidad_pedida} {l.unidad ?? l.ingredientes?.unidad_producto ?? ''}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        {p.notas && (
                          <p className="px-4 py-2 text-xs text-gray-400 italic border-t border-gray-100">{p.notas}</p>
                        )}
                        {/* Botón repetir */}
                        <div className="px-4 pb-4 pt-2">
                          <button
                            onClick={() => repetirPedido(p)}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-[#F5B731] text-[#1A1A1A] font-bold text-sm bg-[#F5B731]/10 hover:bg-[#F5B731]/25 active:scale-[0.98] transition-all min-h-[48px]"
                          >
                            <RotateCcw size={15} />
                            Repetir este pedido
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          MODAL NUEVO PEDIDO — 3 pasos
      ════════════════════════════════════════════════════ */}
      {modalNuevo && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60">
          <div className="w-full md:max-w-lg bg-white md:rounded-2xl rounded-t-2xl overflow-hidden flex flex-col max-h-[92vh]">

            {/* Header modal */}
            <div className="flex items-center gap-2 px-4 py-3.5 border-b border-gray-100 flex-shrink-0">
              {paso > 1 ? (
                <button
                  onClick={() => setPaso(p => (p - 1) as Paso)}
                  className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors flex-shrink-0"
                >
                  <ArrowLeft size={18} className="text-gray-600" />
                </button>
              ) : <div className="w-10 flex-shrink-0" />}

              <div className="flex-1 text-center">
                <p className="text-sm font-bold text-gray-900">
                  {paso === 1 ? 'Seleccionar proveedor' : paso === 2 ? 'Artículos del pedido' : 'Confirmar pedido'}
                </p>
                <div className="flex items-center justify-center gap-1.5 mt-1">
                  {([1, 2, 3] as Paso[]).map(s => (
                    <div key={s} className={`h-1.5 rounded-full transition-all duration-200 ${s === paso ? 'w-5 bg-[#F5B731]' : s < paso ? 'w-1.5 bg-[#F5B731]/50' : 'w-1.5 bg-gray-200'}`} />
                  ))}
                </div>
              </div>

              <button
                onClick={cerrarModal}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors flex-shrink-0"
              >
                <X size={18} className="text-gray-400" />
              </button>
            </div>

            {/* ── PASO 1: Elegir proveedor ── */}
            {paso === 1 && (
              <div className="flex-1 overflow-y-auto">
                <div className="p-4">
                  <div className="relative mb-3">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar proveedor..."
                      value={busqProv}
                      onChange={e => setBusqProv(e.target.value)}
                      className="w-full pl-9 pr-3 py-3 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#F5B731]"
                      autoFocus
                    />
                  </div>

                  {proveedoresFiltrados.length === 0 ? (
                    <div className="text-center py-10">
                      <Package size={28} className="mx-auto text-gray-200 mb-2" />
                      <p className="text-sm text-gray-400">
                        {busqProv ? 'Sin resultados' : 'No hay proveedores con artículos disponibles'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {proveedoresFiltrados.map(p => (
                        <button
                          key={p.id}
                          onClick={async () => {
                            setProvSelId(String(p.id))
                            setBusqIng('')
                            await cargarIngredientesProveedor(String(p.id))
                            setPaso(2)
                          }}
                          className="w-full flex items-center justify-between px-4 py-4 rounded-xl border border-gray-200 text-left bg-white hover:border-[#F5B731] hover:bg-[#F5B731]/5 active:scale-[0.98] transition-all min-h-[64px]"
                        >
                          <div>
                            <p className="text-base font-semibold text-gray-800">{p.nombre}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {p.numIngredientes} artículo{p.numIngredientes !== 1 ? 's' : ''} disponibles
                            </p>
                          </div>
                          <ChevronRight size={18} className="text-gray-300 flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── PASO 2: Ingredientes ── */}
            {paso === 2 && (
              <>
                <div className="flex-1 overflow-y-auto">
                  {/* Banner proveedor */}
                  <div className="px-4 py-3 bg-[#F5B731]/10 border-b border-[#F5B731]/20 flex-shrink-0">
                    <p className="text-xs text-gray-500">Proveedor</p>
                    <p className="text-base font-bold text-[#1A1A1A]">{proveedorSel?.nombre ?? '—'}</p>
                  </div>

                  <div className="p-4 space-y-4">
                    {/* Contador seleccionados */}
                    {lineasConCantidad.length > 0 && (
                      <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="text-sm font-semibold text-emerald-700">
                          {lineasConCantidad.length} artículo{lineasConCantidad.length !== 1 ? 's' : ''} seleccionado{lineasConCantidad.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    )}

                    {/* Buscador */}
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar artículo..."
                        value={busqIng}
                        onChange={e => setBusqIng(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#F5B731]"
                      />
                    </div>

                    {/* Lista ingredientes */}
                    {cargandoIngs ? (
                      <div className="flex items-center justify-center py-8">
                        <RefreshCw className="animate-spin text-[#F5B731]" size={22} />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {ingredientesFiltrados.map(ing => {
                          const linea = lineas.find(l => l.ingrediente.id === ing.id)
                          const val = linea?.cantidad ?? ''
                          const tieneValor = val !== '' && Number(val) > 0
                          return (
                            <div
                              key={ing.id}
                              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${tieneValor ? 'border-[#F5B731] bg-[#F5B731]/5' : 'border-gray-200 bg-white'}`}
                            >
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm leading-snug ${tieneValor ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                                  {ing.nombre_ingrediente}
                                </p>
                                {ing.formato_compra && (
                                  <p className="text-xs text-gray-400 mt-0.5">{ing.formato_compra}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  min="0"
                                  step="0.1"
                                  placeholder="0"
                                  value={val}
                                  onChange={e => {
                                    setLineas(prev => {
                                      const next = [...prev]
                                      const idx = next.findIndex(l => l.ingrediente.id === ing.id)
                                      if (idx >= 0) next[idx] = { ...next[idx], cantidad: e.target.value }
                                      else next.push({ ingrediente: ing, cantidad: e.target.value })
                                      return next
                                    })
                                  }}
                                  className={`w-20 px-2 py-2.5 text-sm text-center border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white transition-colors ${tieneValor ? 'border-[#F5B731] font-bold text-[#1A1A1A]' : 'border-gray-200 text-gray-500'}`}
                                />
                                <span className="text-xs text-gray-400 w-8 leading-tight truncate">
                                  {ing.unidad_producto ?? ''}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Notas adicionales */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
                        Artículos adicionales y notas
                      </label>
                      <textarea
                        className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F5B731] resize-none"
                        rows={3}
                        placeholder="Productos fuera del catálogo, instrucciones de entrega..."
                        value={notas}
                        onChange={e => setNotas(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer paso 2 */}
                <div className="px-4 py-4 border-t border-gray-100 flex-shrink-0">
                  <button
                    onClick={() => setPaso(3)}
                    disabled={!puedeVerResumen}
                    className="w-full min-h-[56px] rounded-xl text-base font-bold bg-[#F5B731] text-[#1A1A1A] hover:bg-[#e0a820] active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    Ver resumen
                    {lineasConCantidad.length > 0 && (
                      <span className="bg-[#1A1A1A]/15 px-2 py-0.5 rounded-full text-xs font-bold">
                        {lineasConCantidad.length}
                      </span>
                    )}
                    <ChevronRight size={18} />
                  </button>
                  {!puedeVerResumen && (
                    <p className="text-xs text-gray-400 text-center mt-2">Añade cantidades o notas para continuar</p>
                  )}
                </div>
              </>
            )}

            {/* ── PASO 3: Confirmar ── */}
            {paso === 3 && (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Proveedor */}
                  <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
                    <p className="text-xs text-gray-400 mb-0.5">Proveedor</p>
                    <p className="text-base font-bold text-gray-900">{proveedorSel?.nombre ?? '—'}</p>
                    {proveedorSel?.telefono && (
                      <p className="text-xs text-gray-400 mt-0.5">{proveedorSel.telefono}</p>
                    )}
                  </div>

                  {/* Lista artículos seleccionados */}
                  {lineasConCantidad.length > 0 ? (
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                          {lineasConCantidad.length} artículo{lineasConCantidad.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {lineasConCantidad.map(l => (
                          <div key={l.ingrediente.id} className="flex items-center justify-between px-4 py-3 min-h-[48px]">
                            <span className="text-sm font-medium text-gray-800">{l.ingrediente.nombre_ingrediente}</span>
                            <span className="text-sm font-bold text-gray-900 tabular-nums">
                              {l.cantidad} {l.ingrediente.unidad_producto ?? ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                      <p className="text-sm text-amber-700">Sin artículos del catálogo — solo se enviará el texto de notas.</p>
                    </div>
                  )}

                  {/* Notas */}
                  {notas.trim() && (
                    <div className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3">
                      <p className="text-xs text-gray-400 mb-1">Notas adicionales</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{notas.trim()}</p>
                    </div>
                  )}

                  {errorModal && (
                    <p className="text-sm text-rose-500 flex items-center gap-1.5">
                      <AlertTriangle size={14} /> {errorModal}
                    </p>
                  )}
                </div>

                {/* Footer paso 3 */}
                <div className="px-4 py-4 border-t border-gray-100 flex-shrink-0">
                  <button
                    onClick={enviarPedido}
                    disabled={enviando}
                    className="w-full min-h-[60px] rounded-xl text-base font-bold bg-[#1A1A1A] text-white hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {enviando
                      ? <><RefreshCw size={18} className="animate-spin" /> Enviando...</>
                      : <><ShoppingCart size={20} /> Enviar pedido</>
                    }
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}

      {/* Modal WhatsApp */}
      {modalWA && <ModalWhatsApp data={modalWA} onCerrar={() => setModalWA(null)} />}
    </div>
  )
}

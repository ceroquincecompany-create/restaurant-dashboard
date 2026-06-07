'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { Ingrediente } from '@/lib/supabase'
import { useEmpleadoActual } from '@/lib/useEmpleado'
import {
  RefreshCw, ShoppingCart, ChevronDown, ChevronUp,
  CheckCircle2, AlertTriangle, Package, MessageCircle, Copy, Check, X,
} from 'lucide-react'

type Proveedor = { id: number; nombre: string; telefono: string | null }
type LineaPedido = { ingrediente: Ingrediente; cantidad: string }
type ModalWAData = { mensaje: string; telefono: string | null; provNombre: string }

const ESTADO_CFG = {
  pendiente:  { label: 'Pendiente',  cls: 'bg-amber-100 text-amber-700' },
  confirmado: { label: 'Confirmado', cls: 'bg-blue-100 text-blue-700' },
  recibido:   { label: 'Recibido',   cls: 'bg-emerald-100 text-emerald-700' },
  cancelado:  { label: 'Cancelado',  cls: 'bg-gray-100 text-gray-500' },
}

// ── Genera el texto del mensaje WhatsApp ─────────────────────
function construirMensajeWA(lineas: LineaPedido[]): string {
  const fecha = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const articulosLineas = lineas
    .filter(l => Number(l.cantidad) > 0)
    .map(l => {
      const unidad = l.ingrediente.unidad_producto ?? ''
      return `${l.ingrediente.nombre_ingrediente}: ${l.cantidad}${unidad ? ' ' + unidad : ''}`
    })
    .join('\n')
  return `*SOFI PINOMONTANO*\n\nPedido realizado el ${fecha}\n\n${articulosLineas}\n\nGracias`
}

// ── Modal WhatsApp ───────────────────────────────────────────
function ModalWhatsApp({ data, onCerrar }: { data: ModalWAData; onCerrar: () => void }) {
  const [copiado, setCopiado] = useState(false)

  async function copiarMensaje() {
    try {
      await navigator.clipboard.writeText(data.mensaje)
    } catch {
      // fallback para navegadores sin clipboard API
      const el = document.createElement('textarea')
      el.value = data.mensaje
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }

  function abrirWhatsApp() {
    const tel = (data.telefono ?? '').replace(/\D/g, '')
    const url = tel
      ? `https://wa.me/${tel}?text=${encodeURIComponent(data.mensaje)}`
      : `https://wa.me/?text=${encodeURIComponent(data.mensaje)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70 px-0 md:px-4">
      {/* Sheet en móvil, modal centrado en desktop */}
      <div className="w-full md:max-w-md bg-[#0b141a] md:rounded-2xl overflow-hidden flex flex-col max-h-[92vh]">

        {/* Header estilo WhatsApp */}
        <div className="bg-[#202c33] px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#00a884] flex items-center justify-center">
              <MessageCircle size={18} className="text-white" />
            </div>
            <div>
              <p className="text-base font-bold text-white leading-tight">{data.provNombre}</p>
              <p className="text-xs text-[#8696a0]">Mensaje listo para enviar</p>
            </div>
          </div>
          <button
            onClick={onCerrar}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
          >
            <X size={18} className="text-[#8696a0]" />
          </button>
        </div>

        {/* Área del mensaje */}
        <div
          className="flex-1 overflow-y-auto px-4 py-5"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #0d1f17 0%, #0b141a 100%)' }}
        >
          {/* Burbuja de mensaje estilo WhatsApp enviado */}
          <div className="flex justify-end">
            <div className="bg-[#005c4b] rounded-2xl rounded-tr-sm px-4 py-3 max-w-[90%] shadow-md">
              <pre className="text-[15px] leading-relaxed text-white whitespace-pre-wrap font-sans">
                {data.mensaje}
              </pre>
              <div className="flex justify-end mt-1.5">
                <span className="text-[11px] text-[#8edfcb]">
                  {new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} ✓✓
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="bg-[#0b141a] border-t border-[#2a3942] px-4 py-4 space-y-3 flex-shrink-0">
          <button
            onClick={copiarMensaje}
            className={`w-full min-h-[56px] rounded-xl text-base font-bold flex items-center justify-center gap-3 transition-all active:scale-[0.98] ${
              copiado
                ? 'bg-emerald-600 text-white'
                : 'bg-[#202c33] text-white hover:bg-[#2a3942]'
            }`}
          >
            {copiado
              ? <><Check size={20} /> Copiado al portapapeles</>
              : <><Copy size={20} /> Copiar mensaje</>
            }
          </button>

          <button
            onClick={abrirWhatsApp}
            className="w-full min-h-[56px] rounded-xl text-base font-bold bg-[#25d366] text-white flex items-center justify-center gap-3 hover:bg-[#20bd5a] active:scale-[0.98] transition-all shadow-lg shadow-[#25d366]/20"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Abrir WhatsApp
            {!data.telefono && <span className="text-xs opacity-70">(sin número)</span>}
          </button>

          <button
            onClick={onCerrar}
            className="w-full py-3 rounded-xl text-sm font-medium text-[#8696a0] hover:text-white hover:bg-[#202c33] transition-colors min-h-[44px]"
          >
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
  const [vista, setVista] = useState<'nuevo' | 'historial'>('nuevo')
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [provSelId, setProvSelId] = useState('')
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([])
  const [lineas, setLineas] = useState<LineaPedido[]>([])
  const [notas, setNotas] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [historial, setHistorial] = useState<any[]>([])
  const [detalleId, setDetalleId] = useState<number | null>(null)
  const [detalleLineas, setDetalleLineas] = useState<any[]>([])
  const [modalWA, setModalWA] = useState<ModalWAData | null>(null)

  useEffect(() => {
    supabase.from('proveedores')
      .select('id,nombre,telefono')
      .eq('activo', true)
      .order('nombre')
      .then(({ data }) => setProveedores((data ?? []) as Proveedor[]))
  }, [])

  useEffect(() => {
    if (!provSelId) { setIngredientes([]); setLineas([]); return }
    supabase.from('ingredientes')
      .select('*')
      .eq('proveedor_id', Number(provSelId))
      .order('nombre_ingrediente')
      .then(({ data }) => {
        const ings = data ?? []
        setIngredientes(ings)
        setLineas(ings.map(i => ({ ingrediente: i, cantidad: '' })))
      })
  }, [provSelId])

  const cargarHistorial = useCallback(async () => {
    if (!empleado) return
    const { data } = await supabase
      .from('pedidos_proveedor')
      .select('*, proveedores(nombre)')
      .eq('empleado_nombre', empleado.nombre)
      .order('created_at', { ascending: false })
      .limit(30)
    setHistorial(data ?? [])
  }, [empleado])

  useEffect(() => { if (vista === 'historial') cargarHistorial() }, [vista, cargarHistorial])

  async function verDetalle(pedidoId: number) {
    if (detalleId === pedidoId) { setDetalleId(null); return }
    setDetalleId(pedidoId)
    const { data } = await supabase
      .from('pedidos_lineas')
      .select('*, ingredientes(nombre_ingrediente, unidad_producto)')
      .eq('pedido_id', pedidoId)
    setDetalleLineas(data ?? [])
  }

  const lineasConCantidad = useMemo(
    () => lineas.filter(l => l.cantidad !== '' && Number(l.cantidad) > 0),
    [lineas]
  )

  const proveedorSel = proveedores.find(p => String(p.id) === provSelId)

  async function enviarPedido() {
    if (!empleado || !provSelId || lineasConCantidad.length === 0) {
      setError('Añade al menos un artículo'); return
    }
    setEnviando(true); setError('')

    const { data: pedido, error: errP } = await supabase
      .from('pedidos_proveedor')
      .insert({
        local_id: empleado.local_id,
        empleado_nombre: empleado.nombre,
        proveedor_id: Number(provSelId),
        notas: notas.trim() || null,
      })
      .select('id').single()

    if (errP || !pedido) { setError('Error al crear el pedido'); setEnviando(false); return }

    await supabase.from('pedidos_lineas').insert(
      lineasConCantidad.map(l => ({
        pedido_id: pedido.id,
        ingrediente_id: l.ingrediente.id,
        cantidad_pedida: Number(l.cantidad),
        unidad: l.ingrediente.unidad_producto,
      }))
    )

    // Construir mensaje WhatsApp y mostrar modal
    const mensaje = construirMensajeWA(lineasConCantidad)
    setModalWA({
      mensaje,
      telefono: proveedorSel?.telefono ?? null,
      provNombre: proveedorSel?.nombre ?? 'Proveedor',
    })

    setProvSelId(''); setLineas([]); setNotas(''); setEnviando(false)
  }

  if (empLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <RefreshCw className="animate-spin text-[#F5B731]" size={24} />
    </div>
  )

  return (
    <div className="px-4 py-5 md:px-6 max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Pedidos a proveedor</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-5">
        {[
          { id: 'nuevo', label: 'Nuevo pedido' },
          { id: 'historial', label: 'Mis pedidos' },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setVista(id as 'nuevo' | 'historial')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold min-h-[40px] transition-colors ${
              vista === id ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-gray-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── NUEVO PEDIDO ── */}
      {vista === 'nuevo' && (
        <div className="space-y-5">
          {/* Seleccionar proveedor */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">Proveedor *</label>
            <div className="grid grid-cols-1 gap-2">
              {proveedores.map(p => (
                <button
                  key={p.id}
                  onClick={() => setProvSelId(String(p.id))}
                  className={`flex items-center justify-between px-4 py-4 rounded-xl border text-left transition-colors min-h-[56px] ${
                    provSelId === String(p.id)
                      ? 'bg-[#F5B731] border-[#F5B731] text-[#1A1A1A]'
                      : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div>
                    <p className="text-base font-semibold">{p.nombre}</p>
                    {p.telefono && (
                      <p className={`text-xs mt-0.5 ${provSelId === String(p.id) ? 'text-[#1A1A1A]/60' : 'text-gray-400'}`}>
                        {p.telefono}
                      </p>
                    )}
                  </div>
                  {provSelId === String(p.id) && <CheckCircle2 size={20} />}
                </button>
              ))}
            </div>
          </div>

          {/* Ingredientes del proveedor */}
          {provSelId && ingredientes.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-600 mb-2">
                Artículos —{' '}
                <span className="font-normal text-gray-400">
                  {lineasConCantidad.length} de {ingredientes.length} con cantidad
                </span>
              </p>
              <div className="space-y-2">
                {lineas.map((linea, idx) => (
                  <div
                    key={linea.ingrediente.id}
                    className={`bg-white rounded-xl border px-4 py-3 flex items-center gap-3 transition-colors ${
                      linea.cantidad && Number(linea.cantidad) > 0
                        ? 'border-[#F5B731]'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-medium text-gray-800 truncate">
                        {linea.ingrediente.nombre_ingrediente}
                      </p>
                      {linea.ingrediente.unidad_producto && (
                        <p className="text-xs text-gray-400">
                          {linea.ingrediente.formato_compra ?? linea.ingrediente.unidad_producto}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.1"
                        className="w-24 px-3 py-2.5 text-base font-bold border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F5B731] text-center"
                        placeholder="0"
                        value={linea.cantidad}
                        onChange={e => {
                          const next = [...lineas]
                          next[idx] = { ...next[idx], cantidad: e.target.value }
                          setLineas(next)
                        }}
                      />
                      <span className="text-sm text-gray-400 w-8 truncate">
                        {linea.ingrediente.unidad_producto ?? ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {provSelId && ingredientes.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
              <Package size={28} className="mx-auto text-gray-200 mb-2" />
              <p className="text-base text-gray-400">Este proveedor no tiene ingredientes asignados</p>
            </div>
          )}

          {/* Notas */}
          {provSelId && ingredientes.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Notas (opcional)</label>
              <input
                className="w-full px-4 py-3 text-base border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F5B731]"
                placeholder="Instrucciones de entrega, urgencia..."
                value={notas}
                onChange={e => setNotas(e.target.value)}
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-rose-500 flex items-center gap-1.5">
              <AlertTriangle size={14} /> {error}
            </p>
          )}

          {provSelId && lineasConCantidad.length > 0 && (
            <button
              onClick={enviarPedido}
              disabled={enviando}
              className="w-full min-h-[60px] rounded-xl text-base font-bold bg-[#F5B731] text-[#1A1A1A] hover:bg-[#e0a820] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {enviando
                ? <><RefreshCw size={18} className="animate-spin" /> Enviando...</>
                : <><ShoppingCart size={20} /> Enviar pedido ({lineasConCantidad.length} artículo{lineasConCantidad.length !== 1 ? 's' : ''})</>
              }
            </button>
          )}
        </div>
      )}

      {/* ── HISTORIAL ── */}
      {vista === 'historial' && (
        <div className="space-y-3">
          {historial.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <ShoppingCart size={28} className="mx-auto text-gray-200 mb-2" />
              <p className="text-base text-gray-400">No tienes pedidos registrados</p>
            </div>
          ) : historial.map(p => {
            const cfg = ESTADO_CFG[p.estado as keyof typeof ESTADO_CFG] ?? ESTADO_CFG.pendiente
            const abierto = detalleId === p.id
            return (
              <div key={p.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button
                  className="w-full px-4 py-4 flex items-center justify-between gap-3 text-left"
                  onClick={() => verDetalle(p.id)}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>
                        {cfg.label}
                      </span>
                      <span className="text-base font-semibold text-gray-800 truncate">
                        {p.proveedores?.nombre ?? '—'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mt-0.5">
                      {new Date(p.created_at).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  {abierto
                    ? <ChevronUp size={18} className="text-gray-400 flex-shrink-0" />
                    : <ChevronDown size={18} className="text-gray-400 flex-shrink-0" />
                  }
                </button>
                {abierto && (
                  <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
                    {detalleLineas.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-2">Sin líneas</p>
                    ) : (
                      <div className="space-y-1.5">
                        {detalleLineas.map((l: any) => (
                          <div key={l.id} className="flex items-center justify-between text-sm">
                            <span className="text-gray-700">{l.ingredientes?.nombre_ingrediente ?? '—'}</span>
                            <span className="font-semibold text-gray-800 tabular-nums">
                              {l.cantidad_pedida} {l.unidad ?? l.ingredientes?.unidad_producto ?? ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {p.notas && <p className="text-xs text-gray-400 mt-2 italic">{p.notas}</p>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal WhatsApp ── */}
      {modalWA && (
        <ModalWhatsApp data={modalWA} onCerrar={() => setModalWA(null)} />
      )}
    </div>
  )
}

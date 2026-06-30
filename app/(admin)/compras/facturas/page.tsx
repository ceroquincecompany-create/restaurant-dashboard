'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import {
  RefreshCw, X, Upload, CheckCircle2, AlertTriangle,
  FileText, ExternalLink, ChevronDown, Receipt,
  Pencil, BookCheck, Clock, CloudUpload, Trash2, Download,
  Copy, AlertCircle,
} from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────
type Proveedor = { id: number; nombre: string; cif: string | null }
type Local     = { id: number; nombre: string }

type FacturaLinea = {
  id: number
  descripcion: string | null
  cantidad: number | null
  unidad: string | null
  precio_unitario: number | null
  importe: number | null
}

type Factura = {
  id: number
  local_id: number | null
  proveedor_id: number | null
  proveedor_nombre: string | null
  proveedor_cif: string | null
  numero_factura: string | null
  fecha_factura: string | null
  base_imponible: number | null
  pct_iva: number | null
  cuota_iva: number | null
  total: number | null
  forma_pago: string | null
  archivo_url: string | null
  metodo_extraccion: string
  estado: 'pendiente' | 'revisada' | 'contabilizada' | 'error'
  contabilizado: boolean
  pl_mes: number | null
  pl_anio: number | null
  pl_contabilizado_at: string | null
  created_at: string
  facturas_lineas: FacturaLinea[]
}

type ItemColaStatus = 'pendiente' | 'procesando' | 'guardado' | 'error' | 'esperando'
type ItemCola = {
  uid: string
  file: File
  status: ItemColaStatus
  error?: string
  duplicado?: boolean
}

type DuplicadoPendiente = {
  item: ItemCola
  datos: Record<string, unknown>
  proveedorId: number | null
  archUrl: string | null
  existente: { id: number; created_at: string; proveedor_nombre: string | null }
}

// ─── Constantes ───────────────────────────────────────────────
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const MESES_LARGOS = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio',
                      'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const ESTADO_CFG = {
  pendiente:     { label: 'Pendiente',     cls: 'bg-amber-100 text-amber-700'      },
  revisada:      { label: 'Revisada',      cls: 'bg-blue-100 text-blue-700'        },
  contabilizada: { label: 'Contabilizada', cls: 'bg-emerald-100 text-emerald-700'  },
  error:         { label: 'Error',         cls: 'bg-rose-100 text-rose-700'        },
} as const

const METODO_CFG = {
  regex:  { label: 'Texto',  cls: 'bg-purple-50 text-purple-600' },
  haiku:  { label: 'IA',     cls: 'bg-blue-50 text-blue-600'    },
  manual: { label: 'Manual', cls: 'bg-gray-100 text-gray-500'   },
} as const

// ─── Utilidades ───────────────────────────────────────────────
function fmt(n: number | null | undefined, d = 2) {
  if (n == null) return '—'
  return n.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' €'
}
function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s + 'T12:00:00').toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric' })
}
function uid() { return Math.random().toString(36).slice(2) }

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ─── Sub-componentes ──────────────────────────────────────────
function Badge({ estado }: { estado: string }) {
  const cfg = ESTADO_CFG[estado as keyof typeof ESTADO_CFG] ?? { label: estado, cls: 'bg-gray-100 text-gray-600' }
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>
}

function MetodoBadge({ metodo }: { metodo: string }) {
  const cfg = METODO_CFG[metodo as keyof typeof METODO_CFG] ?? METODO_CFG.manual
  return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${cfg.cls}`}>{cfg.label}</span>
}

function Modal({ titulo, onCerrar, maxW = 'max-w-2xl', children }: {
  titulo: string; onCerrar: () => void; maxW?: string; children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-6 pb-6 overflow-y-auto">
      <div className={`bg-white rounded-xl shadow-xl w-full ${maxW} mx-4 my-auto`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-xl">
          <h2 className="text-sm font-semibold text-gray-800">{titulo}</h2>
          <button onClick={onCerrar} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

function InfoBox({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={`bg-gray-50 rounded-lg px-3 py-2 ${className}`}>
      <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-gray-800 break-all">{value}</p>
    </div>
  )
}

// ─── Zona de drop ──────────────────────────────────────────────
function ZonaDrop({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [over, setOver] = useState(false)
  const inputRef        = useRef<HTMLInputElement>(null)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setOver(false)
    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.type === 'application/pdf' || f.type.startsWith('image/')
    )
    if (files.length) onFiles(files)
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
        over ? 'border-[#F5B731] bg-[#F5B731]/5' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      <CloudUpload size={32} className={`mx-auto mb-3 ${over ? 'text-[#F5B731]' : 'text-gray-300'}`} />
      <p className="text-sm font-medium text-gray-600">Arrastra facturas aquí o haz clic para seleccionar</p>
      <p className="text-xs text-gray-400 mt-1">PDF e imágenes — varios archivos a la vez</p>
      <input ref={inputRef} type="file" className="hidden" multiple accept=".pdf,image/*"
        onChange={e => { const files = Array.from(e.target.files ?? []); if (files.length) onFiles(files); e.target.value = '' }} />
    </div>
  )
}

// ─── Cola de procesamiento ────────────────────────────────────
function ColaArchivos({ cola }: { cola: ItemCola[] }) {
  if (!cola.length) return null
  const total    = cola.length
  const guardados = cola.filter(i => i.status === 'guardado').length
  const errores   = cola.filter(i => i.status === 'error').length
  const procesando = cola.some(i => i.status === 'procesando')
  const esperando  = cola.some(i => i.status === 'esperando')

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          {procesando && <RefreshCw size={13} className="animate-spin text-[#F5B731]" />}
          {esperando  && <AlertCircle size={13} className="text-amber-500" />}
          <p className="text-xs font-semibold text-gray-600">
            {procesando ? 'Procesando...' : esperando ? 'Esperando confirmación' : 'Cola de subida'}
            {' '}— {guardados}/{total} completados
            {errores > 0 && <span className="text-rose-500 ml-1">({errores} con error)</span>}
          </p>
        </div>
        <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-[#F5B731] rounded-full transition-all"
            style={{ width: `${total > 0 ? (guardados / total) * 100 : 0}%` }} />
        </div>
      </div>
      <ul className="divide-y divide-gray-50 max-h-60 overflow-y-auto">
        {cola.map(item => (
          <li key={item.uid} className="flex items-center gap-3 px-4 py-2.5">
            <div className="flex-shrink-0">
              {item.status === 'guardado'  && <CheckCircle2 size={15} className={item.duplicado ? 'text-amber-400' : 'text-emerald-500'} />}
              {item.status === 'error'     && <AlertTriangle size={15} className="text-rose-500" />}
              {item.status === 'procesando' && <RefreshCw size={15} className="animate-spin text-[#F5B731]" />}
              {item.status === 'pendiente' && <Clock size={15} className="text-gray-300" />}
              {item.status === 'esperando' && <AlertCircle size={15} className="text-amber-500" />}
            </div>
            <span className="flex-1 text-xs text-gray-700 truncate">{item.file.name}</span>
            {item.duplicado && item.status === 'guardado' && (
              <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Duplicado</span>
            )}
            {item.error && <span className="text-xs text-rose-500 truncate max-w-[200px]" title={item.error}>{item.error}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────
export default function PaginaFacturas() {
  const now = new Date()

  const [facturas, setFacturas]       = useState<Factura[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [locales, setLocales]         = useState<Local[]>([])
  const [loading, setLoading]         = useState(true)

  // Upload
  const [cola, setCola]                     = useState<ItemCola[]>([])
  const [procesandoCola, setProcesandoCola] = useState(false)
  const [mostrarSubida, setMostrarSubida]   = useState(false)
  const [localSubida, setLocalSubida]       = useState<number | null>(null)
  const [duplicadoPendiente, setDuplicadoPendiente] = useState<DuplicadoPendiente | null>(null)
  // Ref síncrono para evitar doble invocación en React strict mode
  const procesandoRef = useRef(false)

  // Filtros
  const [filtroProveedor, setFiltroProveedor] = useState('')
  const [filtroMes, setFiltroMes]             = useState('')
  const [filtroAnio, setFiltroAnio]           = useState(String(now.getFullYear()))
  const [filtroEstado, setFiltroEstado]       = useState('')

  // Modales
  const [detalle, setDetalle]     = useState<Factura | null>(null)
  const [editando, setEditando]   = useState<Factura | null>(null)
  const [modalCont, setModalCont] = useState<Factura | null>(null)
  const [eliminando, setEliminando] = useState<Factura | null>(null)

  const [contabilizando, setContabilizando]   = useState(false)
  const [guardandoEdit, setGuardandoEdit]     = useState(false)
  const [realizandoEliminar, setRealizandoEliminar] = useState(false)

  // ── Carga ──────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    const [{ data: facts }, { data: provs }, { data: locs }] = await Promise.all([
      supabase.from('facturas').select('*, facturas_lineas(*)').order('created_at', { ascending: false }),
      supabase.from('proveedores').select('id, nombre, cif').eq('activo', true).order('nombre'),
      supabase.from('locales').select('id, nombre').eq('activo', true).order('nombre'),
    ])
    setFacturas((facts as Factura[]) ?? [])
    setProveedores(provs ?? [])
    setLocales(locs ?? [])
    if (locs?.length && !localSubida) setLocalSubida(locs[0].id)
    setLoading(false)
  }, [localSubida])

  useEffect(() => { cargar() }, [cargar])

  // ── Cola: auto-proceso ──────────────────────────────────────
  useEffect(() => {
    if (procesandoRef.current) return   // lock síncrono — previene doble invocación en strict mode
    if (procesandoCola) return
    if (cola.some(i => i.status === 'esperando')) return
    const siguiente = cola.find(i => i.status === 'pendiente')
    if (!siguiente) return
    procesandoRef.current = true
    procesarItem(siguiente)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cola, procesandoCola])

  async function lookupOrCreateProveedor(nombre: string | null, cif: string | null): Promise<number | null> {
    if (!nombre && !cif) return null
    if (cif) {
      const { data } = await supabase.from('proveedores').select('id').eq('cif', cif).maybeSingle()
      if (data) return data.id
    }
    if (nombre) {
      const { data } = await supabase.from('proveedores').select('id').ilike('nombre', nombre.trim()).maybeSingle()
      if (data) return data.id
      const { data: nuevo } = await supabase.from('proveedores')
        .insert({ nombre: nombre.trim(), cif: cif ?? null }).select('id').single()
      return nuevo?.id ?? null
    }
    return null
  }

  async function insertarFactura(
    datos: Record<string, unknown>,
    proveedorId: number | null,
    archUrl: string | null,
    esDuplicado = false
  ): Promise<number | null> {
    const { data: factura, error: fErr } = await supabase.from('facturas').insert({
      local_id:          localSubida,
      proveedor_id:      proveedorId,
      proveedor_nombre:  datos.supplier_name  ?? null,
      proveedor_cif:     datos.supplier_cif   ?? null,
      numero_factura:    datos.invoice_number ?? null,
      fecha_factura:     datos.date           ?? null,
      base_imponible:    datos.base_amount    ?? null,
      pct_iva:           datos.vat_rate       ?? null,
      cuota_iva:         datos.vat_amount     ?? null,
      total:             datos.total          ?? null,
      forma_pago:        datos.payment_method ?? null,
      archivo_url:       archUrl,
      datos_extraidos:   datos,
      metodo_extraccion: (datos._metodo as string) ?? 'haiku',
      estado:            'pendiente',
    }).select('id').single()
    if (fErr) throw new Error(fErr.message)

    const items: any[] = Array.isArray(datos.items) ? datos.items : []
    if (items.length && factura) {
      await supabase.from('facturas_lineas').insert(
        items.filter(it => it.description || it.amount).map(it => ({
          factura_id:      factura.id,
          descripcion:     it.description  ?? null,
          cantidad:        it.quantity     ?? null,
          unidad:          it.unit         ?? null,
          precio_unitario: it.unit_price   ?? null,
          importe:         it.amount       ?? null,
        }))
      )
    }
    return factura?.id ?? null
  }

  async function procesarItem(item: ItemCola) {
    setProcesandoCola(true)
    setCola(prev => prev.map(i => i.uid === item.uid ? { ...i, status: 'procesando' } : i))

    try {
      const base64   = await fileToBase64(item.file)
      const mimeType = item.file.type || 'application/pdf'

      const res = await fetch('/api/factura/procesar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mimeType }),
      })
      // Capturar texto crudo en caso de que no sea JSON válido
      const rawText = await res.text()
      let datos: any
      try { datos = JSON.parse(rawText) } catch {
        throw new Error(`API error ${res.status}: ${rawText.slice(0, 200)}`)
      }
      if (!res.ok && datos.error) throw new Error(datos.error)
      if (datos.error) throw new Error(datos.error)

      // Storage (no bloquea el flujo)
      let archUrl: string | null = null
      try {
        const ext  = item.file.name.split('.').pop() ?? 'pdf'
        const path = `${new Date().toISOString().split('T')[0]}/${uid()}.${ext}`
        const { data: stored } = await supabase.storage
          .from('facturas-proveedores').upload(path, item.file, { cacheControl: '3600', upsert: false })
        if (stored) {
          archUrl = supabase.storage.from('facturas-proveedores').getPublicUrl(path).data.publicUrl
        }
      } catch { /* bucket no configurado */ }

      const proveedorId = await lookupOrCreateProveedor(
        datos.supplier_name as string | null,
        datos.supplier_cif  as string | null
      )

      // ── Detección de duplicados ──────────────────────────────
      // Usamos .limit(1) para evitar error si hay múltiples entradas previas idénticas
      const cif      = datos.supplier_cif   as string | null
      const nFactura = datos.invoice_number as string | null
      if (cif && nFactura) {
        const { data: existente } = await supabase.from('facturas')
          .select('id, created_at, proveedor_nombre')
          .eq('proveedor_cif', cif).eq('numero_factura', nFactura)
          .limit(1).maybeSingle()
        if (existente) {
          setCola(prev => prev.map(i => i.uid === item.uid ? { ...i, status: 'esperando' } : i))
          setDuplicadoPendiente({ item, datos, proveedorId, archUrl, existente })
          setProcesandoCola(false)
          procesandoRef.current = false
          return
        }
      }

      await insertarFactura(datos, proveedorId, archUrl)
      setCola(prev => prev.map(i => i.uid === item.uid ? { ...i, status: 'guardado' } : i))
      await cargar()

    } catch (err: any) {
      setCola(prev => prev.map(i => i.uid === item.uid ? { ...i, status: 'error', error: err.message } : i))
    } finally {
      procesandoRef.current = false
      setProcesandoCola(false)
    }
  }

  async function confirmarDuplicado() {
    if (!duplicadoPendiente) return
    const { item, datos, proveedorId, archUrl } = duplicadoPendiente
    try {
      await insertarFactura(datos, proveedorId, archUrl, true)
      setCola(prev => prev.map(i => i.uid === item.uid ? { ...i, status: 'guardado', duplicado: true } : i))
      await cargar()
    } catch (err: any) {
      setCola(prev => prev.map(i => i.uid === item.uid ? { ...i, status: 'error', error: err.message } : i))
    }
    setDuplicadoPendiente(null)
    // Reanudar cola tras confirmación de duplicado
    procesandoRef.current = false
  }

  function cancelarDuplicado() {
    if (!duplicadoPendiente) return
    setCola(prev => prev.map(i =>
      i.uid === duplicadoPendiente.item.uid ? { ...i, status: 'error', error: 'Cancelado (duplicado)' } : i
    ))
    setDuplicadoPendiente(null)
    procesandoRef.current = false
  }

  function agregarArchivos(files: File[]) {
    const nuevos: ItemCola[] = files.map(f => ({ uid: uid(), file: f, status: 'pendiente' }))
    setCola(prev => [...prev, ...nuevos])
    setMostrarSubida(true)
  }

  // ── Cambiar estado ──────────────────────────────────────────
  async function cambiarEstado(id: number, estado: Factura['estado']) {
    await supabase.from('facturas').update({ estado }).eq('id', id)
    setFacturas(prev => prev.map(f => f.id === id ? { ...f, estado } : f))
    if (detalle?.id === id) setDetalle(d => d ? { ...d, estado } : d)
  }

  // ── Editar ──────────────────────────────────────────────────
  async function guardarEdicion() {
    if (!editando) return
    setGuardandoEdit(true)
    const { error } = await supabase.from('facturas').update({
      proveedor_nombre:  editando.proveedor_nombre,
      proveedor_cif:     editando.proveedor_cif,
      numero_factura:    editando.numero_factura,
      fecha_factura:     editando.fecha_factura,
      base_imponible:    editando.base_imponible,
      pct_iva:           editando.pct_iva,
      cuota_iva:         editando.cuota_iva,
      total:             editando.total,
      forma_pago:        editando.forma_pago,
      metodo_extraccion: 'manual',
    }).eq('id', editando.id)
    if (!error) {
      setFacturas(prev => prev.map(f => f.id === editando.id ? { ...f, ...editando, metodo_extraccion: 'manual' } : f))
      if (detalle?.id === editando.id) setDetalle({ ...editando, metodo_extraccion: 'manual' })
      setEditando(null)
    }
    setGuardandoEdit(false)
  }

  // ── Contabilizar ────────────────────────────────────────────
  async function contabilizar() {
    if (!modalCont) return
    setContabilizando(true)
    const fecha  = modalCont.fecha_factura ? new Date(modalCont.fecha_factura + 'T12:00:00') : new Date()
    const anio   = fecha.getFullYear()
    const mes    = fecha.getMonth() + 1
    const importe = modalCont.base_imponible ?? modalCont.total ?? 0
    const lid    = modalCont.local_id ?? locales[0]?.id

    const { data: existing } = await supabase.from('pl_datos')
      .select('id, valor_real, estado')
      .eq('local_id', lid).eq('año', anio).eq('mes', mes).eq('partida', 'proveedores')
      .maybeSingle()

    if ((existing as any)?.estado === 'cerrado') {
      alert(`El P&L de ${MESES[mes - 1]} ${anio} está cerrado. No se puede contabilizar.`)
      setContabilizando(false)
      return
    }

    const nuevoValor = (existing?.valor_real ?? 0) + importe
    if (existing) {
      await supabase.from('pl_datos').update({ valor_real: nuevoValor }).eq('id', existing.id)
    } else {
      await supabase.from('pl_datos').insert({
        local_id: lid, año: anio, mes, partida: 'proveedores',
        valor_real: nuevoValor, valor_presupuesto: 0,
      })
    }
    const ts = new Date().toISOString()
    await supabase.from('facturas').update({
      estado: 'contabilizada', contabilizado: true, pl_mes: mes, pl_anio: anio, pl_contabilizado_at: ts,
    }).eq('id', modalCont.id)
    setFacturas(prev => prev.map(f => f.id === modalCont.id
      ? { ...f, estado: 'contabilizada', contabilizado: true, pl_mes: mes, pl_anio: anio, pl_contabilizado_at: ts }
      : f
    ))
    if (detalle?.id === modalCont.id) setDetalle(d => d ? { ...d, estado: 'contabilizada', contabilizado: true } : d)
    setContabilizando(false)
    setModalCont(null)
  }

  // ── Eliminar ────────────────────────────────────────────────
  async function eliminarFactura() {
    if (!eliminando) return
    setRealizandoEliminar(true)
    const f = eliminando

    try {
      // Revertir contabilización si procede
      if (f.contabilizado && f.pl_mes && f.pl_anio) {
        const importe = f.base_imponible ?? f.total ?? 0
        const lid = f.local_id ?? locales[0]?.id
        const { data: pl } = await supabase.from('pl_datos')
          .select('id, valor_real')
          .eq('local_id', lid).eq('año', f.pl_anio).eq('mes', f.pl_mes).eq('partida', 'proveedores')
          .maybeSingle()
        if (pl) {
          await supabase.from('pl_datos')
            .update({ valor_real: Math.max(0, (pl.valor_real ?? 0) - importe) })
            .eq('id', pl.id)
        }
      }
      await supabase.from('facturas').delete().eq('id', f.id)
      setFacturas(prev => prev.filter(x => x.id !== f.id))
      if (detalle?.id === f.id) setDetalle(null)
    } catch (err: any) {
      alert('Error al eliminar: ' + err.message)
    }
    setRealizandoEliminar(false)
    setEliminando(null)
  }

  // ── Exportar Excel ──────────────────────────────────────────
  function exportarExcel() {
    const rows = filtradas.map(f => ({
      'Fecha':           f.fecha_factura ?? '',
      'Proveedor':       f.proveedor_nombre ?? '',
      'CIF':             f.proveedor_cif ?? '',
      'Nº Factura':      f.numero_factura ?? '',
      'Base Imponible':  f.base_imponible ?? '',
      'IVA %':           f.pct_iva ?? '',
      'Cuota IVA':       f.cuota_iva ?? '',
      'Total':           f.total ?? '',
      'Forma Pago':      f.forma_pago ?? '',
      'Estado':          ESTADO_CFG[f.estado]?.label ?? f.estado,
      'Método':          METODO_CFG[f.metodo_extraccion as keyof typeof METODO_CFG]?.label ?? f.metodo_extraccion,
    }))
    // Fila de totales
    rows.push({
      'Fecha': 'TOTAL', 'Proveedor': `${filtradas.length} facturas`, 'CIF': '', 'Nº Factura': '',
      'Base Imponible': kpis.totalBase as any,
      'IVA %': '', 'Cuota IVA': kpis.totalIva as any,
      'Total': kpis.totalFact as any,
      'Forma Pago': '', 'Estado': '' as any, 'Método': '' as any,
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    const periodo = filtroMes ? `${MESES[Number(filtroMes)-1]}_${filtroAnio}` : filtroAnio
    XLSX.utils.book_append_sheet(wb, ws, 'Facturas')
    XLSX.writeFile(wb, `facturas_${periodo}.xlsx`)
  }

  // ── Filtrado y KPIs ─────────────────────────────────────────
  const filtradas = useMemo(() => facturas.filter(f => {
    const fecha = f.fecha_factura ? new Date(f.fecha_factura + 'T12:00:00') : null
    return (
      (!filtroProveedor || String(f.proveedor_id) === filtroProveedor) &&
      // Facturas sin fecha pasan siempre los filtros de fecha (no excluirlas)
      (!filtroMes  || !fecha || (fecha.getMonth() + 1) === Number(filtroMes)) &&
      (!filtroAnio || !fecha || fecha.getFullYear() === Number(filtroAnio)) &&
      (!filtroEstado || f.estado === filtroEstado)
    )
  }), [facturas, filtroProveedor, filtroMes, filtroAnio, filtroEstado])

  const kpis = useMemo(() => ({
    totalBase:  filtradas.reduce((s, f) => s + (f.base_imponible ?? 0), 0),
    totalIva:   filtradas.reduce((s, f) => s + (f.cuota_iva ?? 0), 0),
    totalFact:  filtradas.reduce((s, f) => s + (f.total ?? 0), 0),
    pendientes: filtradas.filter(f => f.estado === 'pendiente').length,
  }), [filtradas])

  const resumenPorProv = useMemo(() => {
    const map: Record<string, { nombre: string; total: number; count: number }> = {}
    filtradas.forEach(f => {
      const key = String(f.proveedor_id ?? f.proveedor_nombre ?? 'Sin proveedor')
      if (!map[key]) map[key] = { nombre: f.proveedor_nombre ?? 'Sin nombre', total: 0, count: 0 }
      map[key].total += f.total ?? 0
      map[key].count++
    })
    return Object.values(map).sort((a, b) => b.total - a.total)
  }, [filtradas])

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <RefreshCw className="animate-spin text-[#F5B731]" size={24} />
    </div>
  )

  const mesActual = filtroMes ? MESES_LARGOS[Number(filtroMes)] : 'período'

  return (
    <div className="p-6 max-w-6xl space-y-5">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Facturas de Proveedores</h1>
          <p className="text-sm text-gray-400 mt-0.5">Subida por lotes, extracción automática con IA</p>
        </div>
        <div className="flex items-center gap-2">
          {filtradas.length > 0 && (
            <button onClick={exportarExcel}
              className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-colors">
              <Download size={14} /> Exportar
            </button>
          )}
          <button onClick={() => setMostrarSubida(v => !v)}
            className="flex items-center gap-2 px-4 py-2 bg-[#1A1A1A] text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-colors">
            <Upload size={15} />
            Subir facturas
            <ChevronDown size={13} className={`transition-transform ${mostrarSubida ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Zona de subida ──────────────────────────────────── */}
      {mostrarSubida && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <select value={localSubida ?? ''} onChange={e => setLocalSubida(Number(e.target.value))}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white">
              {locales.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </select>
            <span className="text-xs text-gray-400">Local al que se asignan las facturas</span>
          </div>
          <ZonaDrop onFiles={agregarArchivos} />
          <ColaArchivos cola={cola} />
        </div>
      )}

      {/* ── KPIs ────────────────────────────────────────────── */}
      {filtradas.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Base imponible', valor: fmt(kpis.totalBase), sub: `${filtradas.length} facturas` },
            { label: 'IVA soportado',  valor: fmt(kpis.totalIva),  sub: 'para declaración trimestral' },
            { label: 'Total facturas', valor: fmt(kpis.totalFact), sub: mesActual },
            { label: 'Sin revisar',    valor: String(kpis.pendientes), sub: 'facturas pendientes' },
          ].map(k => (
            <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">{k.label}</p>
              <p className="text-xl font-bold text-gray-900">{k.valor}</p>
              <p className="text-xs text-gray-400 mt-0.5">{k.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Resumen por proveedor ────────────────────────────── */}
      {resumenPorProv.length > 1 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <p className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
            Gasto por proveedor — {mesActual}
          </p>
          <div className="divide-y divide-gray-50">
            {resumenPorProv.map(p => (
              <div key={p.nombre} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <span className="text-sm text-gray-700">{p.nombre}</span>
                  <span className="text-xs text-gray-400 ml-2">{p.count} fact.</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">{fmt(p.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Filtros ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
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

      {/* ── Tabla ───────────────────────────────────────────── */}
      {filtradas.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Receipt size={32} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">No hay facturas con los filtros actuales</p>
          <p className="text-xs text-gray-300 mt-1">Sube facturas usando el botón "Subir facturas" de arriba</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Fecha</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Proveedor</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 hidden md:table-cell">Nº Factura</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 hidden lg:table-cell">Base imp.</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 hidden lg:table-cell">IVA</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Total</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 hidden sm:table-cell">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtradas.map(f => (
                  <tr key={f.id} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => setDetalle(f)}>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(f.fecha_factura)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800 max-w-[140px] truncate">{f.proveedor_nombre ?? '—'}</div>
                      {f.proveedor_cif && <div className="text-[10px] text-gray-400">{f.proveedor_cif}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{f.numero_factura ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-gray-600 hidden lg:table-cell">{fmt(f.base_imponible)}</td>
                    <td className="px-4 py-3 text-right text-gray-500 hidden lg:table-cell">
                      {f.pct_iva != null ? `${f.pct_iva}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(f.total)}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="flex items-center gap-1.5">
                        <Badge estado={f.estado} />
                        <MetodoBadge metodo={f.metodo_extraccion} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {!f.contabilizado && (
                          <button onClick={() => setModalCont(f)}
                            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 px-2 py-1 rounded border border-emerald-200 hover:bg-emerald-50 transition-colors whitespace-nowrap">
                            Contabilizar
                          </button>
                        )}
                        <button onClick={() => setEliminando(f)}
                          className="p-1.5 text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ MODAL DETALLE ════════════════════════════════════ */}
      {detalle && (
        <Modal titulo={`Factura — ${detalle.proveedor_nombre ?? '—'}`} onCerrar={() => setDetalle(null)} maxW="max-w-3xl">
          <div className="space-y-5">
            {detalle.archivo_url && (
              <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center min-h-[100px]">
                {detalle.archivo_url.endsWith('.pdf') ? (
                  <a href={detalle.archivo_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm font-semibold text-blue-600 py-5">
                    <FileText size={18} /> Ver PDF <ExternalLink size={13} />
                  </a>
                ) : (
                  <img src={detalle.archivo_url} alt="Factura" className="max-w-full max-h-64 object-contain" />
                )}
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <InfoBox label="Proveedor"   value={detalle.proveedor_nombre ?? '—'} />
              <InfoBox label="CIF"         value={detalle.proveedor_cif ?? '—'} />
              <InfoBox label="Nº Factura"  value={detalle.numero_factura ?? '—'} />
              <InfoBox label="Fecha"       value={fmtDate(detalle.fecha_factura)} />
              <InfoBox label="Base impon." value={fmt(detalle.base_imponible)} />
              <InfoBox label="IVA %"       value={detalle.pct_iva != null ? `${detalle.pct_iva}%` : '—'} />
              <InfoBox label="Cuota IVA"   value={fmt(detalle.cuota_iva)} />
              <InfoBox label="TOTAL"       value={fmt(detalle.total)} className="bg-gray-100" />
              {detalle.forma_pago && <InfoBox label="Forma pago" value={detalle.forma_pago} className="col-span-2" />}
            </div>
            <div className="flex items-center gap-2">
              <Badge estado={detalle.estado} />
              <MetodoBadge metodo={detalle.metodo_extraccion} />
              {detalle.contabilizado && detalle.pl_mes && (
                <span className="flex items-center gap-1 text-xs text-emerald-700 font-semibold">
                  <BookCheck size={12} />
                  P&L {MESES[detalle.pl_mes - 1]} {detalle.pl_anio}
                </span>
              )}
            </div>
            {detalle.facturas_lineas.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Líneas</p>
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold text-gray-500">Descripción</th>
                        <th className="text-right px-3 py-2 font-semibold text-gray-500">Cant.</th>
                        <th className="text-left px-3 py-2 font-semibold text-gray-500">Ud.</th>
                        <th className="text-right px-3 py-2 font-semibold text-gray-500">P.unit</th>
                        <th className="text-right px-3 py-2 font-semibold text-gray-500">Importe</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {detalle.facturas_lineas.map(l => (
                        <tr key={l.id}>
                          <td className="px-3 py-2 text-gray-700">{l.descripcion ?? '—'}</td>
                          <td className="px-3 py-2 text-right text-gray-600">{l.cantidad ?? '—'}</td>
                          <td className="px-3 py-2 text-gray-500">{l.unidad ?? '—'}</td>
                          <td className="px-3 py-2 text-right text-gray-600">{l.precio_unitario != null ? `${Number(l.precio_unitario).toFixed(4)} €` : '—'}</td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-800">{fmt(l.importe)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100">
              {detalle.estado === 'pendiente' && (
                <button onClick={() => cambiarEstado(detalle.id, 'revisada')}
                  className="px-3 py-1.5 text-xs font-semibold bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                  Marcar revisada
                </button>
              )}
              {detalle.estado === 'revisada' && (
                <button onClick={() => cambiarEstado(detalle.id, 'pendiente')}
                  className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                  Volver a pendiente
                </button>
              )}
              <button onClick={() => setEditando({ ...detalle })}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                <Pencil size={11} /> Editar datos
              </button>
              {!detalle.contabilizado && (
                <button onClick={() => setModalCont(detalle)}
                  className="px-3 py-1.5 text-xs font-semibold bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors">
                  Contabilizar → P&L
                </button>
              )}
              {detalle.contabilizado && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
                  <CheckCircle2 size={13} /> Contabilizado en P&L
                </span>
              )}
              <button onClick={() => { setEliminando(detalle); setDetalle(null) }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-rose-200 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors ml-auto">
                <Trash2 size={11} /> Eliminar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ══ MODAL EDITAR ═════════════════════════════════════ */}
      {editando && (
        <Modal titulo="Editar factura" onCerrar={() => setEditando(null)} maxW="max-w-lg">
          <div className="space-y-3">
            {[
              { label: 'Proveedor',      key: 'proveedor_nombre', type: 'text'   },
              { label: 'CIF',            key: 'proveedor_cif',    type: 'text'   },
              { label: 'Nº Factura',     key: 'numero_factura',   type: 'text'   },
              { label: 'Fecha factura',  key: 'fecha_factura',    type: 'date'   },
              { label: 'Base imponible', key: 'base_imponible',   type: 'number' },
              { label: 'IVA %',          key: 'pct_iva',          type: 'number' },
              { label: 'Cuota IVA',      key: 'cuota_iva',        type: 'number' },
              { label: 'Total',          key: 'total',            type: 'number' },
              { label: 'Forma de pago',  key: 'forma_pago',       type: 'text'   },
            ].map(({ label, key, type }) => (
              <div key={key}>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">{label}</label>
                <input
                  type={type} step={type === 'number' ? '0.01' : undefined}
                  value={(editando as any)[key] ?? ''}
                  onChange={e => setEditando(prev => prev ? {
                    ...prev,
                    [key]: type === 'number' ? (e.target.value === '' ? null : parseFloat(e.target.value)) : (e.target.value || null)
                  } : prev)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731]"
                />
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditando(null)}
                className="flex-1 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={guardarEdicion} disabled={guardandoEdit}
                className="flex-1 py-2 text-sm font-bold bg-[#1A1A1A] text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2">
                {guardandoEdit ? <><RefreshCw size={13} className="animate-spin" /> Guardando</> : 'Guardar'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ══ MODAL CONTABILIZAR ═══════════════════════════════ */}
      {modalCont && (() => {
        const fecha   = modalCont.fecha_factura ? new Date(modalCont.fecha_factura + 'T12:00:00') : new Date()
        const mes     = fecha.getMonth() + 1
        const anio    = fecha.getFullYear()
        const importe = modalCont.base_imponible ?? modalCont.total ?? 0
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-800">Contabilizar factura</p>
                <button onClick={() => setModalCont(null)} className="text-gray-400 hover:text-gray-600"><X size={15} /></button>
              </div>
              <div className="px-5 py-4 space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                  <p className="text-sm font-semibold text-emerald-800">
                    Añadir {fmt(importe)} a <strong>Materia Prima (Proveedores)</strong>
                  </p>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Mes: {MESES[mes - 1]} {anio}
                    {modalCont.base_imponible != null ? ' — base imponible sin IVA' : ' — total factura'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setModalCont(null)}
                    className="flex-1 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    Cancelar
                  </button>
                  <button onClick={contabilizar} disabled={contabilizando}
                    className="flex-1 py-2.5 text-sm font-bold bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-2">
                    {contabilizando ? <><RefreshCw size={13} className="animate-spin" />...</> : 'Confirmar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ══ MODAL ELIMINAR ═══════════════════════════════════ */}
      {eliminando && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-800">Eliminar factura</p>
              <button onClick={() => setEliminando(null)} className="text-gray-400 hover:text-gray-600"><X size={15} /></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <p className="text-sm text-gray-700">
                ¿Eliminar la factura <strong>{eliminando.numero_factura ?? 'sin número'}</strong> de <strong>{eliminando.proveedor_nombre ?? '—'}</strong>?
              </p>
              {eliminando.contabilizado && eliminando.pl_mes && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                    <AlertTriangle size={13} /> Esta factura está contabilizada en el P&L
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    Se restará <strong>{fmt(eliminando.base_imponible ?? eliminando.total)}</strong> de Proveedores en{' '}
                    {MESES[eliminando.pl_mes - 1]} {eliminando.pl_anio}.
                  </p>
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => setEliminando(null)}
                  className="flex-1 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button onClick={eliminarFactura} disabled={realizandoEliminar}
                  className="flex-1 py-2.5 text-sm font-bold bg-rose-500 text-white rounded-lg hover:bg-rose-600 disabled:opacity-50 flex items-center justify-center gap-2">
                  {realizandoEliminar ? <><RefreshCw size={13} className="animate-spin" />...</> : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL DUPLICADO ══════════════════════════════════ */}
      {duplicadoPendiente && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2 text-amber-600">
                <Copy size={15} />
                <p className="text-sm font-semibold">Posible duplicado</p>
              </div>
              <button onClick={cancelarDuplicado} className="text-gray-400 hover:text-gray-600"><X size={15} /></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-1">
                <p className="text-xs font-semibold text-amber-800">
                  Ya existe una factura con el mismo CIF y número
                </p>
                <p className="text-xs text-amber-700">
                  Proveedor: <strong>{duplicadoPendiente.existente.proveedor_nombre ?? '—'}</strong>
                </p>
                <p className="text-xs text-amber-700">
                  Subida el: {fmtDate(duplicadoPendiente.existente.created_at.split('T')[0])}
                </p>
              </div>
              <p className="text-xs text-gray-500">
                Archivo: <strong>{duplicadoPendiente.item.file.name}</strong>
              </p>
              <div className="flex gap-2">
                <button onClick={cancelarDuplicado}
                  className="flex-1 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button onClick={confirmarDuplicado}
                  className="flex-1 py-2.5 text-sm font-bold bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors">
                  Subir igualmente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

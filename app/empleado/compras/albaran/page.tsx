'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabaseAuth } from '@/lib/supabase-browser'
import { useEmpleadoActual } from '@/lib/useEmpleado'
import {
  Camera, Upload, RefreshCw, Check, AlertTriangle, RotateCcw,
  X, Plus, Trash2, FileImage, ChevronLeft,
} from 'lucide-react'

// ── Tipos ──────────────────────────────────────────────────────

type LineaExtraida = {
  name: string
  quantity: number | null
  unit: string | null
  unit_price: number | null
  total: number | null
}

type DatosExtraidos = {
  supplier_name?: string | null
  invoice_number?: string | null
  date?: string | null
  items?: LineaExtraida[]
  total_amount?: number | null
  error?: string
}

type LineaEditable = {
  nombre: string
  cantidad: string
  unidad: string
  precio_unitario: string
  total_linea: string
}

type Proveedor = { id: number; nombre: string }

type Paso = 'subir' | 'procesando' | 'revision' | 'exito' | 'error_imagen'

// ── Helpers ────────────────────────────────────────────────────

function arrayBufferToBase64(buf: ArrayBuffer): string {
  let binary = ''
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

async function prepararArchivo(file: File): Promise<{ base64: string; mimeType: string }> {
  if (file.type === 'application/pdf') {
    const buf = await file.arrayBuffer()
    return { base64: arrayBufferToBase64(buf), mimeType: 'application/pdf' }
  }
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const MAX = 1200
      const scale = Math.min(1, MAX / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      resolve({
        base64: canvas.toDataURL('image/jpeg', 0.85).split(',')[1],
        mimeType: 'image/jpeg',
      })
    }
    img.src = url
  })
}

const inputCls = 'w-full px-4 py-3 text-base border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white'

// ── Página ─────────────────────────────────────────────────────

export default function PaginaAlbaran() {
  const { empleado, loading: empLoading } = useEmpleadoActual()

  const [paso, setPaso]               = useState<Paso>('subir')
  const [archivo, setArchivo]         = useState<File | null>(null)
  const [previewUrl, setPreviewUrl]   = useState<string | null>(null)
  const [datos, setDatos]             = useState<DatosExtraidos | null>(null)
  const [errorMsg, setErrorMsg]       = useState('')
  const [intentos, setIntentos]       = useState(0)

  // Campos del formulario de revisión
  const [proveedorNombre, setProveedorNombre] = useState('')
  const [proveedorId, setProveedorId]         = useState<number | null>(null)
  const [numeroAlbaran, setNumeroAlbaran]     = useState('')
  const [fechaDocumento, setFechaDocumento]   = useState('')
  const [temperatura, setTemperatura]         = useState('')
  const [notas, setNotas]                     = useState('')
  const [lineas, setLineas]                   = useState<LineaEditable[]>([])

  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [guardando, setGuardando]     = useState(false)

  const inputCamaraRef  = useRef<HTMLInputElement>(null)
  const inputArchivoRef = useRef<HTMLInputElement>(null)

  const localId = empleado?.local_id ?? null

  useEffect(() => {
    supabaseAuth.from('proveedores').select('id, nombre').eq('activo', true).order('nombre')
      .then(({ data }) => setProveedores(data ?? []))
  }, [])

  // Limpiar preview al desmontar
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  // ── Procesar archivo con IA ──────────────────────────────────
  const procesarArchivo = useCallback(async (file: File, retry = false) => {
    setPaso('procesando')
    setErrorMsg('')
    try {
      const { base64, mimeType } = await prepararArchivo(file)
      const res = await fetch('/api/albaran/procesar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mimeType }),
      })
      const json: DatosExtraidos = await res.json()

      if (json.error) {
        if (!retry) {
          // Reintentar una vez
          await procesarArchivo(file, true)
          return
        }
        setPaso('error_imagen')
        setErrorMsg(json.error === 'imagen no legible'
          ? 'La imagen no es clara, por favor repite la foto'
          : json.error)
        return
      }

      // Poblar formulario
      setDatos(json)
      setProveedorNombre(json.supplier_name ?? '')
      setNumeroAlbaran(json.invoice_number ?? '')
      setFechaDocumento(json.date ?? '')

      // Vincular proveedor si coincide
      const matchProv = proveedores.find(p =>
        json.supplier_name &&
        (p.nombre.toLowerCase().includes(json.supplier_name.toLowerCase()) ||
         json.supplier_name.toLowerCase().includes(p.nombre.toLowerCase()))
      )
      setProveedorId(matchProv?.id ?? null)

      // Convertir lineas
      setLineas((json.items ?? []).map(it => ({
        nombre:         it.name ?? '',
        cantidad:       it.quantity != null ? String(it.quantity) : '',
        unidad:         it.unit ?? '',
        precio_unitario: it.unit_price != null ? String(it.unit_price) : '',
        total_linea:    it.total != null ? String(it.total) : '',
      })))

      setPaso('revision')
    } catch (e) {
      if (!retry) {
        await procesarArchivo(file, true)
        return
      }
      setPaso('error_imagen')
      setErrorMsg('No se pudo procesar el documento. Intenta de nuevo.')
    }
  }, [proveedores])

  function onArchivoSeleccionado(file: File | undefined) {
    if (!file) return
    setArchivo(file)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    if (file.type.startsWith('image/')) {
      setPreviewUrl(URL.createObjectURL(file))
    } else {
      setPreviewUrl(null)
    }
    setIntentos(i => i + 1)
    procesarArchivo(file)
  }

  // ── Guardar en BD ───────────────────────────────────────────
  async function confirmarRecepcion() {
    if (!empleado) return
    setGuardando(true)

    // 1. Subir imagen a Storage
    let imagenUrl: string | null = null
    if (archivo) {
      const ext  = archivo.type === 'application/pdf' ? 'pdf' : 'jpg'
      const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error: upErr } = await supabaseAuth.storage
        .from('albaranes')
        .upload(path, archivo, { contentType: archivo.type, upsert: false })
      if (!upErr) {
        const { data: { publicUrl } } = supabaseAuth.storage
          .from('albaranes')
          .getPublicUrl(path)
        imagenUrl = publicUrl
      }
    }

    // 2. Insertar albaran
    const { data: alb, error: albErr } = await supabaseAuth
      .from('albaranes')
      .insert({
        local_id: localId,
        empleado_nombre: empleado.nombre,
        proveedor_id: proveedorId,
        proveedor_nombre: proveedorNombre.trim() || null,
        numero_albaran: numeroAlbaran.trim() || null,
        fecha_documento: fechaDocumento || null,
        total: datos?.total_amount ?? calcTotal(),
        temperatura_recepcion: temperatura ? Number(temperatura) : null,
        notas: notas.trim() || null,
        imagen_url: imagenUrl,
        datos_extraidos: datos,
        estado: 'pendiente',
        contabilizado: false,
      })
      .select('id')
      .single()

    if (albErr || !alb) {
      setErrorMsg('Error al guardar: ' + (albErr?.message ?? 'desconocido'))
      setGuardando(false)
      return
    }

    // 3. Insertar lineas
    const lineasValidas = lineas.filter(l => l.nombre.trim())
    if (lineasValidas.length > 0) {
      await supabaseAuth.from('albaran_lineas').insert(
        lineasValidas.map(l => ({
          albaran_id: alb.id,
          nombre_producto: l.nombre.trim(),
          cantidad: l.cantidad ? Number(l.cantidad) : null,
          unidad: l.unidad.trim() || null,
          precio_unitario: l.precio_unitario ? Number(l.precio_unitario) : null,
          total_linea: l.total_linea ? Number(l.total_linea) : null,
        }))
      )
    }

    setGuardando(false)
    setPaso('exito')
  }

  function calcTotal(): number | null {
    const t = lineas.reduce((s, l) => s + (Number(l.total_linea) || 0), 0)
    return t > 0 ? t : null
  }

  function resetear() {
    setPaso('subir')
    setArchivo(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setDatos(null)
    setErrorMsg('')
    setLineas([])
    setProveedorNombre(''); setProveedorId(null); setNumeroAlbaran('')
    setFechaDocumento(''); setTemperatura(''); setNotas('')
    setIntentos(0)
  }

  function editarLinea(idx: number, campo: keyof LineaEditable, val: string) {
    setLineas(ls => ls.map((l, i) => i === idx ? { ...l, [campo]: val } : l))
  }

  function addLinea() {
    setLineas(ls => [...ls, { nombre: '', cantidad: '', unidad: '', precio_unitario: '', total_linea: '' }])
  }

  function removeLinea(idx: number) {
    setLineas(ls => ls.filter((_, i) => i !== idx))
  }

  if (empLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <RefreshCw className="animate-spin text-[#F5B731]" size={24} />
    </div>
  )

  // ════════════════════════════════════════════════════════
  // PASO: SUBIR
  // ════════════════════════════════════════════════════════
  if (paso === 'subir') return (
    <div className="px-4 py-5 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Subir albarán</h1>
      <p className="text-sm text-gray-400 mb-6">La IA extrae los datos automáticamente</p>

      <div className="space-y-3">
        {/* Cámara */}
        <button
          onClick={() => inputCamaraRef.current?.click()}
          className="w-full flex flex-col items-center justify-center gap-3 py-10 border-2 border-dashed border-[#F5B731] rounded-2xl bg-[#F5B731]/5 hover:bg-[#F5B731]/10 transition-colors active:scale-[0.98]"
        >
          <div className="w-16 h-16 rounded-full bg-[#F5B731] flex items-center justify-center">
            <Camera size={32} className="text-[#1A1A1A]" />
          </div>
          <div className="text-center">
            <p className="text-base font-bold text-gray-900">Fotografiar albarán</p>
            <p className="text-sm text-gray-400 mt-0.5">Abre la cámara</p>
          </div>
        </button>

        {/* Archivo / galería */}
        <button
          onClick={() => inputArchivoRef.current?.click()}
          className="w-full flex items-center justify-center gap-3 py-4 border border-gray-200 rounded-xl bg-white hover:bg-gray-50 transition-colors"
        >
          <Upload size={20} className="text-gray-500" />
          <span className="text-sm font-semibold text-gray-700">Subir PDF o imagen</span>
        </button>
      </div>

      {/* Instrucciones */}
      <div className="mt-5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <p className="text-sm text-amber-800 font-semibold mb-1">Para mejores resultados:</p>
        <ul className="text-xs text-amber-700 space-y-0.5">
          <li>• Ilumina bien el documento</li>
          <li>• Colócalo sobre una superficie plana</li>
          <li>• Asegúrate de que el texto sea legible</li>
          <li>• Incluye todos los datos del albarán</li>
        </ul>
      </div>

      <input
        ref={inputCamaraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => onArchivoSeleccionado(e.target.files?.[0])}
      />
      <input
        ref={inputArchivoRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={e => onArchivoSeleccionado(e.target.files?.[0])}
      />
    </div>
  )

  // ════════════════════════════════════════════════════════
  // PASO: PROCESANDO
  // ════════════════════════════════════════════════════════
  if (paso === 'procesando') return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 gap-5">
      <div className="relative">
        <div className="w-20 h-20 rounded-full border-4 border-[#F5B731]/20 border-t-[#F5B731] animate-spin" />
        <FileImage size={24} className="absolute inset-0 m-auto text-[#F5B731]" />
      </div>
      <div className="text-center">
        <p className="text-base font-bold text-gray-900">Analizando el documento con IA...</p>
        <p className="text-sm text-gray-400 mt-1">Extrayendo datos del albarán</p>
        {intentos > 1 && <p className="text-xs text-amber-500 mt-1">Reintentando...</p>}
      </div>
    </div>
  )

  // ════════════════════════════════════════════════════════
  // PASO: ERROR IMAGEN
  // ════════════════════════════════════════════════════════
  if (paso === 'error_imagen') return (
    <div className="px-4 py-8 max-w-lg mx-auto">
      <div className="flex flex-col items-center gap-4 text-center mb-8">
        <div className="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center">
          <AlertTriangle size={28} className="text-rose-500" />
        </div>
        <div>
          <p className="text-base font-bold text-gray-900">{errorMsg || 'No se pudo leer el documento'}</p>
          <p className="text-sm text-gray-400 mt-1">Comprueba la iluminación e intenta de nuevo</p>
        </div>
      </div>
      <button
        onClick={resetear}
        className="w-full min-h-[56px] rounded-xl text-base font-bold bg-[#F5B731] text-[#1A1A1A] hover:bg-[#e0a820] active:scale-[0.98] transition-all"
      >
        Repetir foto
      </button>
    </div>
  )

  // ════════════════════════════════════════════════════════
  // PASO: ÉXITO
  // ════════════════════════════════════════════════════════
  if (paso === 'exito') return (
    <div className="px-4 py-8 max-w-lg mx-auto">
      <div className="flex flex-col items-center gap-4 text-center mb-8">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
          <Check size={28} className="text-emerald-600" />
        </div>
        <div>
          <p className="text-base font-bold text-gray-900">Albarán registrado</p>
          <p className="text-sm text-gray-400 mt-1">El admin recibirá la notificación para revisarlo</p>
        </div>
        {previewUrl && (
          <img src={previewUrl} alt="Albarán" className="w-full max-h-40 object-contain rounded-xl border border-gray-200" />
        )}
      </div>
      <button
        onClick={resetear}
        className="w-full min-h-[56px] rounded-xl text-base font-bold bg-[#F5B731] text-[#1A1A1A] hover:bg-[#e0a820] active:scale-[0.98] transition-all"
      >
        Registrar otro albarán
      </button>
    </div>
  )

  // ════════════════════════════════════════════════════════
  // PASO: REVISIÓN
  // ════════════════════════════════════════════════════════
  const totalCalculado = lineas.reduce((s, l) => s + (Number(l.total_linea) || 0), 0)

  return (
    <div className="px-4 py-5 max-w-lg mx-auto pb-10">

      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={resetear} className="p-1.5 text-gray-400 hover:text-gray-600">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="text-base font-bold text-gray-900">Revisar datos extraídos</h1>
          <p className="text-xs text-gray-400">Verifica y corrige si es necesario</p>
        </div>
      </div>

      {/* Preview imagen */}
      {previewUrl && (
        <div className="mb-4 rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
          <img src={previewUrl} alt="Albarán" className="w-full max-h-48 object-contain" />
        </div>
      )}
      {!previewUrl && archivo && (
        <div className="mb-4 flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
          <FileImage size={20} className="text-gray-400" />
          <span className="text-sm text-gray-600 truncate">{archivo.name}</span>
        </div>
      )}

      <div className="space-y-4">

        {/* Proveedor */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Proveedor</label>
          <input
            className={inputCls}
            value={proveedorNombre}
            onChange={e => { setProveedorNombre(e.target.value); setProveedorId(null) }}
            placeholder="Nombre del proveedor"
          />
          {/* Vincular a proveedor existente */}
          {proveedores.length > 0 && (
            <div className="mt-2">
              {proveedorId ? (
                <div className="flex items-center gap-2 text-xs text-emerald-700">
                  <Check size={12} />
                  Vinculado: <strong>{proveedores.find(p => p.id === proveedorId)?.nombre}</strong>
                  <button onClick={() => setProveedorId(null)} className="ml-1 text-gray-400">
                    <X size={11} />
                  </button>
                </div>
              ) : (
                <select
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#F5B731]"
                  value=""
                  onChange={e => { setProveedorId(Number(e.target.value)); setProveedorNombre(proveedores.find(p => p.id === Number(e.target.value))?.nombre ?? proveedorNombre) }}
                >
                  <option value="">Vincular a proveedor existente (opcional)</option>
                  {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              )}
            </div>
          )}
        </div>

        {/* Nº albarán + Fecha */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nº albarán</label>
            <input className={inputCls} value={numeroAlbaran} onChange={e => setNumeroAlbaran(e.target.value)} placeholder="ALB-001" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Fecha</label>
            <input type="date" className={inputCls} value={fechaDocumento} onChange={e => setFechaDocumento(e.target.value)} />
          </div>
        </div>

        {/* Tabla de líneas */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold text-gray-700">Productos</label>
            <button onClick={addLinea} className="flex items-center gap-1 text-xs font-semibold text-[#F5B731] hover:text-[#e0a820]">
              <Plus size={13} /> Añadir línea
            </button>
          </div>

          <div className="space-y-2">
            {lineas.map((l, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <input
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] mb-2"
                      placeholder="Producto"
                      value={l.nombre}
                      onChange={e => editarLinea(i, 'nombre', e.target.value)}
                    />
                    <div className="grid grid-cols-4 gap-1.5">
                      <input className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#F5B731] text-center"
                        placeholder="Cant." value={l.cantidad} onChange={e => editarLinea(i, 'cantidad', e.target.value)} type="number" min="0" />
                      <input className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#F5B731]"
                        placeholder="Ud." value={l.unidad} onChange={e => editarLinea(i, 'unidad', e.target.value)} />
                      <input className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#F5B731] text-right"
                        placeholder="P.unit" value={l.precio_unitario} onChange={e => editarLinea(i, 'precio_unitario', e.target.value)} type="number" step="0.01" />
                      <input className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#F5B731] text-right"
                        placeholder="Total" value={l.total_linea} onChange={e => editarLinea(i, 'total_linea', e.target.value)} type="number" step="0.01" />
                    </div>
                  </div>
                  <button onClick={() => removeLinea(i)} className="p-1 text-gray-300 hover:text-rose-500 flex-shrink-0 mt-1">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {lineas.length === 0 && (
            <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl py-5 text-center">
              <p className="text-sm text-gray-400">Sin líneas detectadas</p>
              <button onClick={addLinea} className="mt-2 text-xs font-semibold text-[#F5B731]">+ Añadir manualmente</button>
            </div>
          )}
        </div>

        {/* Total */}
        {totalCalculado > 0 && (
          <div className="flex items-center justify-between bg-[#F5B731]/10 border border-[#F5B731]/30 rounded-xl px-4 py-3">
            <span className="text-sm font-semibold text-gray-700">Total</span>
            <span className="text-lg font-black text-[#1A1A1A]">{totalCalculado.toFixed(2)} €</span>
          </div>
        )}

        {/* Temperatura + Recibido por */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tª recepción (°C)</label>
            <input type="number" step="0.1" className={inputCls} placeholder="—" value={temperatura} onChange={e => setTemperatura(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Recibido por</label>
            <input className={inputCls} value={empleado?.nombre ?? ''} disabled />
          </div>
        </div>

        {/* Notas */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Notas</label>
          <input className={inputCls} placeholder="Observaciones..." value={notas} onChange={e => setNotas(e.target.value)} />
        </div>

        {errorMsg && (
          <p className="text-sm text-rose-500 flex items-center gap-1.5">
            <AlertTriangle size={14} /> {errorMsg}
          </p>
        )}

        {/* Botones */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={resetear}
            className="flex items-center gap-2 px-4 py-3 text-sm font-semibold border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RotateCcw size={14} /> Repetir foto
          </button>
          <button
            onClick={confirmarRecepcion}
            disabled={guardando}
            className="flex-1 min-h-[52px] rounded-xl text-base font-bold bg-[#F5B731] text-[#1A1A1A] hover:bg-[#e0a820] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {guardando ? <><RefreshCw size={18} className="animate-spin" /> Guardando...</> : <><Check size={18} /> Confirmar recepción</>}
          </button>
        </div>

      </div>
    </div>
  )
}

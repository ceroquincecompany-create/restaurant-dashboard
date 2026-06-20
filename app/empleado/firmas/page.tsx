'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useEmpleadoActual } from '@/lib/useEmpleado'
import {
  ArrowLeft, FileSignature, CheckCircle, Clock,
  X, RefreshCw, PenLine, Trash2,
} from 'lucide-react'
import type { DocumentoFirma, FirmaRegistro } from '@/lib/supabase'

type DocConEstado = DocumentoFirma & { firma: FirmaRegistro | null }

function fmtFechaHora(s: string | null | undefined) {
  if (!s) return '—'
  return new Date(s).toLocaleString('es-ES', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── Canvas de firma ─────────────────────────────────────────────
function CanvasFirma({ onChange }: { onChange: (data: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const trazando = useRef(false)
  const [vacio, setVacio] = useState(true)

  function coords(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const sx = canvas.width / rect.width
    const sy = canvas.height / rect.height
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * sx,
        y: (e.touches[0].clientY - rect.top) * sy,
      }
    }
    return {
      x: ((e as React.MouseEvent).clientX - rect.left) * sx,
      y: ((e as React.MouseEvent).clientY - rect.top) * sy,
    }
  }

  function iniciar(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    trazando.current = true
    const ctx = canvasRef.current!.getContext('2d')!
    const p = coords(e)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
  }

  function dibujar(e: React.MouseEvent | React.TouchEvent) {
    if (!trazando.current) return
    e.preventDefault()
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.strokeStyle = '#1A1A1A'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const p = coords(e)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    setVacio(false)
    onChange(canvas.toDataURL('image/png'))
  }

  function parar() { trazando.current = false }

  function limpiar() {
    const canvas = canvasRef.current!
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
    setVacio(true)
    onChange(null)
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={600}
        height={160}
        className="w-full border-2 border-dashed border-gray-300 rounded-xl bg-white cursor-crosshair"
        style={{ touchAction: 'none' }}
        onMouseDown={iniciar}
        onMouseMove={dibujar}
        onMouseUp={parar}
        onMouseLeave={parar}
        onTouchStart={iniciar}
        onTouchMove={dibujar}
        onTouchEnd={parar}
      />
      <div className="flex items-center justify-between mt-1.5">
        <p className="text-xs text-gray-400">
          {vacio ? 'Dibuja tu firma con el dedo o el ratón' : 'Firma capturada ✓'}
        </p>
        {!vacio && (
          <button type="button" onClick={limpiar} className="flex items-center gap-1 text-xs text-gray-400 hover:text-rose-500 transition-colors">
            <Trash2 size={11} /> Borrar
          </button>
        )}
      </div>
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────────
export default function FirmasEmpleado() {
  const { empleado } = useEmpleadoActual()
  const [docs, setDocs] = useState<DocConEstado[]>([])
  const [loading, setLoading] = useState(true)
  const [docAbierto, setDocAbierto] = useState<DocConEstado | null>(null)
  const [firmandoData, setFirmandoData] = useState<string | null>(null)
  const [aceptado, setAceptado] = useState(false)
  const [firmando, setFirmando] = useState(false)
  const [errorFirma, setErrorFirma] = useState('')

  const cargar = useCallback(async () => {
    if (!empleado?.id) return
    const empId = empleado.id

    const [{ data: dDirect }, { data: dTodos }, { data: firmasData }] = await Promise.all([
      supabase.from('documentos_firma').select('*').eq('empleado_id', empId).order('created_at', { ascending: false }),
      supabase.from('documentos_firma').select('*').is('empleado_id', null).order('created_at', { ascending: false }),
      supabase.from('firmas').select('*').eq('empleado_id', empId),
    ])

    const todosDocs: DocumentoFirma[] = [
      ...((dDirect ?? []) as DocumentoFirma[]),
      ...((dTodos ?? []) as DocumentoFirma[]),
    ]

    const firmaMap = new Map<number, FirmaRegistro>()
    ;(firmasData ?? []).forEach((f: FirmaRegistro) => firmaMap.set(f.documento_id, f))

    setDocs(todosDocs.map(d => ({ ...d, firma: firmaMap.get(d.id) ?? null })))
    setLoading(false)
  }, [empleado?.id])

  useEffect(() => { if (empleado) cargar() }, [empleado, cargar])

  async function firmarDocumento() {
    if (!empleado?.id || !docAbierto) return
    if (!aceptado) { setErrorFirma('Debes marcar que has leído y aceptas el documento'); return }

    setFirmando(true); setErrorFirma('')
    const { error: err } = await supabase.from('firmas').upsert({
      documento_id: docAbierto.id,
      empleado_id: empleado.id,
      firmado: true,
      fecha_firma: new Date().toISOString(),
      firma_data: firmandoData ?? `Confirmado por escrito: ${empleado.nombre}`,
      nombre_firmante: empleado.nombre,
    }, { onConflict: 'documento_id,empleado_id' })

    if (err) { setErrorFirma(err.message); setFirmando(false); return }
    setFirmando(false)
    setDocAbierto(null)
    setFirmandoData(null)
    setAceptado(false)
    cargar()
  }

  const pendientes = docs.filter(d => !d.firma?.firmado)
  const firmados = docs.filter(d => d.firma?.firmado)

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><RefreshCw className="animate-spin text-[#F5B731]" size={22} /></div>
  }

  return (
    <>
      <div className="px-4 py-5 max-w-2xl">
        <div className="flex items-center gap-3 mb-5">
          <Link href="/empleado/comunidad" className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Documentos para firmar</h1>
            {pendientes.length > 0 && (
              <p className="text-sm text-rose-500 font-semibold">{pendientes.length} pendiente{pendientes.length !== 1 ? 's' : ''} de firma</p>
            )}
          </div>
        </div>

        {docs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <FileSignature size={36} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm">No tienes documentos para firmar</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Pendientes */}
            {pendientes.length > 0 && (
              <section>
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2.5">Pendientes de firma</h2>
                <div className="space-y-2.5">
                  {pendientes.map(d => (
                    <button
                      key={d.id}
                      onClick={() => { setDocAbierto(d); setAceptado(false); setFirmandoData(null); setErrorFirma('') }}
                      className="w-full text-left bg-white rounded-2xl border-2 border-[#F5B731]/60 p-4 active:scale-[0.98] transition-all shadow-sm"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#F5B731]/10 flex items-center justify-center flex-shrink-0">
                          <PenLine size={18} className="text-[#F5B731]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 leading-snug">{d.titulo}</p>
                          <p className="text-sm text-gray-500 mt-0.5">{d.tipo}</p>
                          {d.fecha_limite && (
                            <p className="text-xs text-rose-500 font-medium mt-1">Límite: {new Date(d.fecha_limite + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'long' })}</p>
                          )}
                        </div>
                        <span className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-bold text-rose-500 bg-rose-50 px-2.5 py-1 rounded-full">
                          <Clock size={10} /> Firmar
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Firmados */}
            {firmados.length > 0 && (
              <section>
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2.5">Ya firmados</h2>
                <div className="space-y-2">
                  {firmados.map(d => (
                    <div key={d.id} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                        <CheckCircle size={18} className="text-emerald-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-700 leading-snug">{d.titulo}</p>
                        <p className="text-xs text-gray-400 mt-0.5">Firmado el {fmtFechaHora(d.firma?.fecha_firma)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {/* ── Modal firma ──────────────────────────────────── */}
      {docAbierto && (
        <div className="fixed inset-0 z-[60] bg-white flex flex-col">
          {/* Header del modal */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 flex-shrink-0 bg-white">
            <button
              onClick={() => setDocAbierto(null)}
              className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors"
            >
              <X size={20} />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{docAbierto.titulo}</p>
              <p className="text-xs text-gray-400">{docAbierto.tipo}</p>
            </div>
          </div>

          {/* Contenido scrollable */}
          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
            {/* Texto del documento */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Documento</p>
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4">
                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{docAbierto.texto}</p>
              </div>
            </div>

            {/* Zona de firma */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Tu firma</p>
              <CanvasFirma onChange={setFirmandoData} />
            </div>

            {/* Checkbox de aceptación */}
            <label className="flex items-start gap-3 cursor-pointer select-none bg-[#F5B731]/5 border border-[#F5B731]/30 rounded-xl px-4 py-3">
              <input
                type="checkbox"
                checked={aceptado}
                onChange={e => setAceptado(e.target.checked)}
                className="w-5 h-5 mt-0.5 rounded accent-[#F5B731] flex-shrink-0"
              />
              <span className="text-sm text-gray-700 leading-snug">
                He leído íntegramente el documento anterior y acepto su contenido de forma voluntaria y consciente.
              </span>
            </label>

            {errorFirma && <p className="text-sm text-rose-500 text-center">{errorFirma}</p>}
          </div>

          {/* Botón firmar fijo abajo */}
          <div className="px-4 py-4 border-t border-gray-200 flex-shrink-0 bg-white">
            <button
              onClick={firmarDocumento}
              disabled={firmando || !aceptado}
              className="w-full py-4 bg-[#F5B731] text-[#1A1A1A] font-bold text-base rounded-2xl active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {firmando ? (
                <><RefreshCw size={18} className="animate-spin" /> Firmando...</>
              ) : (
                <><PenLine size={18} /> Firmar documento</>
              )}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

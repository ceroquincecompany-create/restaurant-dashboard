'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, X, GraduationCap, FileText, Trash2, RefreshCw, ExternalLink, Upload } from 'lucide-react'
import type { DocumentoFormacion } from '@/lib/supabase'

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white'

const CATEGORIAS = ['Manual', 'Formación', 'Protocolo', 'Otro'] as const
type Categoria = typeof CATEGORIAS[number]

const CAT_COLOR: Record<Categoria, string> = {
  'Manual':    'bg-blue-100 text-blue-700',
  'Formación': 'bg-emerald-100 text-emerald-700',
  'Protocolo': 'bg-purple-100 text-purple-700',
  'Otro':      'bg-gray-100 text-gray-600',
}

function fmtFecha(s: string) {
  return new Date(s).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function PaginaFormacionAdmin() {
  const [docs, setDocs] = useState<DocumentoFormacion[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ titulo: '', descripcion: '', categoria: 'Manual' as Categoria })
  const [archivo, setArchivo] = useState<File | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')
  const [filtroCat, setFiltroCat] = useState<string>('')
  const [confirmEliminar, setConfirmEliminar] = useState<number | null>(null)

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from('documentos_formacion')
      .select('*')
      .order('created_at', { ascending: false })
    setDocs(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const docsFiltrados = useMemo(() => {
    if (!filtroCat) return docs
    return docs.filter(d => d.categoria === filtroCat)
  }, [docs, filtroCat])

  async function guardar() {
    if (!form.titulo.trim()) { setError('El título es obligatorio'); return }
    if (!archivo) { setError('Selecciona un archivo'); return }
    setSubiendo(true); setError('')

    const ext = archivo.name.split('.').pop()
    const path = `${Date.now()}-${form.titulo.trim().replace(/\s+/g, '-').toLowerCase()}.${ext}`

    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from('formacion-docs')
      .upload(path, archivo, { upsert: false })

    if (uploadErr) { setError(`Error al subir: ${uploadErr.message}`); setSubiendo(false); return }

    const { data: urlData } = supabase.storage.from('formacion-docs').getPublicUrl(uploadData.path)

    const { error: dbErr } = await supabase.from('documentos_formacion').insert({
      titulo: form.titulo.trim(),
      descripcion: form.descripcion.trim() || null,
      categoria: form.categoria,
      archivo_url: urlData.publicUrl,
    })

    if (dbErr) { setError(dbErr.message); setSubiendo(false); return }

    setSubiendo(false)
    setModal(false)
    setForm({ titulo: '', descripcion: '', categoria: 'Manual' })
    setArchivo(null)
    cargar()
  }

  async function eliminar(id: number) {
    await supabase.from('documentos_formacion').delete().eq('id', id)
    setConfirmEliminar(null)
    cargar()
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><RefreshCw className="animate-spin text-[#F5B731]" size={24} /></div>
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Formación y Manuales</h1>
          <p className="text-sm text-gray-400 mt-0.5">Documentos del equipo</p>
        </div>
        <button
          onClick={() => { setModal(true); setError('') }}
          className="flex items-center gap-2 px-4 py-2 bg-[#F5B731] text-[#1A1A1A] text-sm font-semibold rounded-lg hover:bg-[#e0a820] transition-colors"
        >
          <Plus size={15} /> Subir documento
        </button>
      </div>

      {/* Filtros categoría */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <button
          onClick={() => setFiltroCat('')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${!filtroCat ? 'bg-[#1A1A1A] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          Todos ({docs.length})
        </button>
        {CATEGORIAS.map(cat => {
          const n = docs.filter(d => d.categoria === cat).length
          return (
            <button
              key={cat}
              onClick={() => setFiltroCat(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filtroCat === cat ? 'bg-[#1A1A1A] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {cat} ({n})
            </button>
          )
        })}
      </div>

      {docsFiltrados.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <GraduationCap size={36} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">No hay documentos en esta categoría</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Documento</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Categoría</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Fecha</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {docsFiltrados.map(d => (
                <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <FileText size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-gray-800">{d.titulo}</p>
                        {d.descripcion && <p className="text-xs text-gray-400 mt-0.5">{d.descripcion}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CAT_COLOR[d.categoria as Categoria] ?? 'bg-gray-100 text-gray-600'}`}>
                      {d.categoria}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{fmtFecha(d.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <a
                        href={d.archivo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-gray-400 hover:text-[#F5B731] transition-colors rounded"
                      >
                        <ExternalLink size={14} />
                      </a>
                      {confirmEliminar === d.id ? (
                        <>
                          <button onClick={() => eliminar(d.id)} className="px-2 py-0.5 bg-rose-500 text-white rounded text-xs font-medium hover:bg-rose-600">Eliminar</button>
                          <button onClick={() => setConfirmEliminar(null)} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium">No</button>
                        </>
                      ) : (
                        <button onClick={() => setConfirmEliminar(d.id)} className="p-1.5 text-gray-300 hover:text-rose-500 transition-colors rounded">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal subir documento */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">Subir documento</h2>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Título *</label>
                <input className={inputCls} value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ej: Manual de apertura del local" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Descripción</label>
                <input className={inputCls} value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Descripción breve (opcional)" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Categoría</label>
                <select className={inputCls} value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value as Categoria }))}>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Archivo (PDF o imagen) *</label>
                <label className={`${inputCls} flex items-center gap-2 cursor-pointer hover:bg-gray-50 transition-colors`}>
                  <Upload size={14} className="text-gray-400" />
                  <span className={archivo ? 'text-gray-800' : 'text-gray-400'}>
                    {archivo ? archivo.name : 'Seleccionar archivo...'}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    className="hidden"
                    onChange={e => setArchivo(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
              {error && <p className="text-xs text-rose-500">{error}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => { setModal(false); setArchivo(null) }} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
                <button onClick={guardar} disabled={subiendo} className="px-4 py-2 text-sm font-semibold bg-[#F5B731] text-[#1A1A1A] rounded-lg hover:bg-[#e0a820] disabled:opacity-50 flex items-center gap-2">
                  {subiendo ? <><RefreshCw size={13} className="animate-spin" /> Subiendo...</> : <><Upload size={13} /> Subir</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

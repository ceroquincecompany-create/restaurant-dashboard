'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useEmpleadoActual } from '@/lib/useEmpleado'
import { Plus, X, Megaphone, Pin, Trash2, RefreshCw, Users, CheckCircle } from 'lucide-react'
import type { Anuncio, AnuncioVisto } from '@/lib/supabase'

type AnuncioConVistos = Anuncio & { vistos: AnuncioVisto[] }
type EmpMini = { id: number; nombre: string; activo: boolean }

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white'

function fmtFecha(s: string) {
  return new Date(s).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function PaginaAnunciosAdmin() {
  const { empleado: yo } = useEmpleadoActual()
  const [anuncios, setAnuncios] = useState<AnuncioConVistos[]>([])
  const [empleados, setEmpleados] = useState<EmpMini[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ titulo: '', texto: '', fijado: false })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [expandido, setExpandido] = useState<number | null>(null)
  const [confirmEliminar, setConfirmEliminar] = useState<number | null>(null)

  const cargar = useCallback(async () => {
    const [{ data: anu }, { data: emp }] = await Promise.all([
      supabase.from('anuncios').select('*').order('fijado', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('empleados').select('id,nombre,activo').eq('activo', true).neq('rol', 'admin').order('nombre'),
    ])
    const ids = (anu ?? []).map((a: Anuncio) => a.id)
    let vistos: AnuncioVisto[] = []
    if (ids.length > 0) {
      const { data } = await supabase.from('anuncios_vistos').select('*').in('anuncio_id', ids)
      vistos = data ?? []
    }
    const merged = (anu ?? []).map((a: Anuncio) => ({
      ...a,
      vistos: vistos.filter(v => v.anuncio_id === a.id),
    }))
    setAnuncios(merged)
    setEmpleados(emp ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function guardar() {
    if (!form.titulo.trim()) { setError('El título es obligatorio'); return }
    if (!form.texto.trim()) { setError('El texto es obligatorio'); return }
    setGuardando(true); setError('')
    const { error: err } = await supabase.from('anuncios').insert({
      local_id: yo?.local_id ?? 1,
      titulo: form.titulo.trim(),
      texto: form.texto.trim(),
      fijado: form.fijado,
    })
    if (err) { setError(err.message); setGuardando(false); return }
    setGuardando(false)
    setModal(false)
    setForm({ titulo: '', texto: '', fijado: false })
    cargar()
  }

  async function eliminar(id: number) {
    await supabase.from('anuncios').delete().eq('id', id)
    setConfirmEliminar(null)
    cargar()
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><RefreshCw className="animate-spin text-[#F5B731]" size={24} /></div>
  }

  const empActivos = empleados.filter(e => e.activo)

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Anuncios</h1>
          <p className="text-sm text-gray-400 mt-0.5">Comunicados del equipo</p>
        </div>
        <button
          onClick={() => { setModal(true); setError('') }}
          className="flex items-center gap-2 px-4 py-2 bg-[#F5B731] text-[#1A1A1A] text-sm font-semibold rounded-lg hover:bg-[#e0a820] transition-colors"
        >
          <Plus size={15} /> Nuevo anuncio
        </button>
      </div>

      {anuncios.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Megaphone size={36} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">No hay anuncios publicados aún</p>
        </div>
      ) : (
        <div className="space-y-3">
          {anuncios.map(a => {
            const vistoIds = a.vistos.map(v => v.empleado_id)
            const falta = empActivos.filter(e => !vistoIds.includes(e.id))
            const pct = empActivos.length > 0 ? Math.round((vistoIds.length / empActivos.length) * 100) : 0
            const abierto = expandido === a.id

            return (
              <div key={a.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {a.fijado && <Pin size={13} className="text-[#F5B731] flex-shrink-0" />}
                        <h3 className="font-semibold text-gray-900 truncate">{a.titulo}</h3>
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed">{a.texto}</p>
                      <p className="text-xs text-gray-400 mt-2">{fmtFecha(a.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {confirmEliminar === a.id ? (
                        <>
                          <button onClick={() => eliminar(a.id)} className="px-2 py-1 bg-rose-500 text-white rounded text-xs font-medium hover:bg-rose-600">Eliminar</button>
                          <button onClick={() => setConfirmEliminar(null)} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-medium hover:bg-gray-200">No</button>
                        </>
                      ) : (
                        <button onClick={() => setConfirmEliminar(a.id)} className="p-1.5 text-gray-300 hover:text-rose-500 transition-colors rounded">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Barra de progreso "visto por" */}
                  {empActivos.length > 0 && (
                    <div className="mt-3">
                      <button
                        onClick={() => setExpandido(abierto ? null : a.id)}
                        className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        <Users size={12} />
                        <span>Visto por {a.vistos.length}/{empActivos.length} ({pct}%)</span>
                        <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </button>

                      {abierto && falta.length > 0 && (
                        <div className="mt-2 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                          <p className="text-xs font-semibold text-amber-700 mb-1.5">Pendiente de leer:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {falta.map(e => (
                              <span key={e.id} className="text-xs bg-white border border-amber-200 text-amber-700 px-2 py-0.5 rounded-full">
                                {e.nombre}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {abierto && falta.length === 0 && empActivos.length > 0 && (
                        <div className="mt-2 flex items-center gap-2 text-emerald-600 text-xs">
                          <CheckCircle size={12} />
                          <span>Leído por todo el equipo</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal nuevo anuncio */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">Nuevo anuncio</h2>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Título *</label>
                <input className={inputCls} value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ej: Cambio de horario esta semana" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Mensaje *</label>
                <textarea className={`${inputCls} min-h-[100px] resize-none`} value={form.texto} onChange={e => setForm(f => ({ ...f, texto: e.target.value }))} placeholder="Texto del anuncio..." />
              </div>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input type="checkbox" checked={form.fijado} onChange={e => setForm(f => ({ ...f, fijado: e.target.checked }))} className="w-4 h-4 rounded accent-[#F5B731]" />
                <span className="text-sm text-gray-700 flex items-center gap-1.5"><Pin size={13} className="text-[#F5B731]" /> Fijar arriba</span>
              </label>
              {error && <p className="text-xs text-rose-500">{error}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
                <button onClick={guardar} disabled={guardando} className="px-4 py-2 text-sm font-semibold bg-[#F5B731] text-[#1A1A1A] rounded-lg hover:bg-[#e0a820] disabled:opacity-50">
                  {guardando ? 'Publicando...' : 'Publicar anuncio'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

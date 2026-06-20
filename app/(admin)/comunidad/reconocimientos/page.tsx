'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useEmpleadoActual } from '@/lib/useEmpleado'
import { Plus, X, Star, Trophy, Heart, Cake, RefreshCw, Trash2 } from 'lucide-react'
import type { Reconocimiento } from '@/lib/supabase'
type EmpMini = { id: number; nombre: string; activo: boolean; fecha_nacimiento: string | null }

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white'

const PLANTILLAS = [
  { tipo: 'Empleado del mes', icono: Trophy, color: 'text-amber-500' },
  { tipo: 'Buen trabajo',     icono: Star,   color: 'text-blue-500' },
  { tipo: 'Gracias',          icono: Heart,  color: 'text-rose-500' },
  { tipo: 'Cumpleaños',       icono: Cake,   color: 'text-pink-500' },
]

const TIPO_ICONO: Record<string, { icono: React.ElementType; color: string }> = {
  'Empleado del mes': { icono: Trophy, color: 'text-amber-500' },
  'Buen trabajo':     { icono: Star,   color: 'text-blue-500' },
  'Gracias':          { icono: Heart,  color: 'text-rose-500' },
  'Cumpleaños':       { icono: Cake,   color: 'text-pink-500' },
}

function fmtFecha(s: string) {
  return new Date(s).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
}

function isBirthdayToday(fechaNac: string | null): boolean {
  if (!fechaNac) return false
  const hoy = new Date()
  const d = new Date(fechaNac + 'T12:00:00')
  return d.getDate() === hoy.getDate() && d.getMonth() === hoy.getMonth()
}

export default function PaginaReconocimientosAdmin() {
  const { empleado: yo } = useEmpleadoActual()
  const [recs, setRecs] = useState<Reconocimiento[]>([])
  const [empleados, setEmpleados] = useState<EmpMini[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ empleado_id: '', tipo: 'Buen trabajo', motivo: '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [confirmEliminar, setConfirmEliminar] = useState<number | null>(null)

  const cargar = useCallback(async () => {
    const [{ data: r }, { data: e }] = await Promise.all([
      supabase.from('reconocimientos').select('*').order('created_at', { ascending: false }).limit(30),
      supabase.from('empleados').select('id,nombre,activo,fecha_nacimiento').eq('activo', true).order('nombre'),
    ])
    setRecs(r ?? [])
    setEmpleados(e ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function guardar() {
    if (!form.empleado_id) { setError('Selecciona un empleado'); return }
    if (!form.motivo.trim()) { setError('Escribe el motivo'); return }
    setGuardando(true); setError('')
    const { error: err } = await supabase.from('reconocimientos').insert({
      local_id: yo?.local_id ?? 1,
      empleado_id: Number(form.empleado_id),
      tipo: form.tipo,
      motivo: form.motivo.trim(),
    })
    if (err) { setError(err.message); setGuardando(false); return }
    setGuardando(false)
    setModal(false)
    setForm({ empleado_id: '', tipo: 'Buen trabajo', motivo: '' })
    cargar()
  }

  async function eliminar(id: number) {
    await supabase.from('reconocimientos').delete().eq('id', id)
    setConfirmEliminar(null)
    cargar()
  }

  const cumpleaneros = empleados.filter(e => isBirthdayToday(e.fecha_nacimiento))

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><RefreshCw className="animate-spin text-[#F5B731]" size={24} /></div>
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reconocimientos</h1>
          <p className="text-sm text-gray-400 mt-0.5">Premia y motiva al equipo</p>
        </div>
        <button
          onClick={() => { setModal(true); setError('') }}
          className="flex items-center gap-2 px-4 py-2 bg-[#F5B731] text-[#1A1A1A] text-sm font-semibold rounded-lg hover:bg-[#e0a820] transition-colors"
        >
          <Plus size={15} /> Nuevo reconocimiento
        </button>
      </div>

      {/* Cumpleaños hoy */}
      {cumpleaneros.length > 0 && (
        <div className="mb-5 bg-pink-50 border border-pink-200 rounded-xl px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <Cake size={18} className="text-pink-500" />
            <p className="text-sm font-bold text-pink-700">¡Cumpleaños hoy! 🎉</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {cumpleaneros.map(e => (
              <span key={e.id} className="inline-flex items-center gap-1.5 bg-pink-100 text-pink-700 text-sm font-semibold px-3 py-1 rounded-full">
                <Cake size={12} /> {e.nombre}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Lista reconocimientos */}
      {recs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Star size={36} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">No hay reconocimientos publicados aún</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {recs.map(r => {
            const emp = empleados.find(e => e.id === r.empleado_id)
            const cfg = TIPO_ICONO[r.tipo] ?? { icono: Star, color: 'text-gray-400' }
            const Icono = cfg.icono
            return (
              <div key={r.id} className="bg-white rounded-xl border border-gray-200 px-5 py-4 relative">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#F5B731]/10 flex items-center justify-center flex-shrink-0">
                    <Icono size={20} className={cfg.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{r.tipo}</span>
                    </div>
                    <p className="font-semibold text-gray-900">{emp?.nombre ?? '—'}</p>
                    <p className="text-sm text-gray-500 mt-1 leading-snug">{r.motivo}</p>
                    <p className="text-xs text-gray-400 mt-2">{fmtFecha(r.created_at)}</p>
                  </div>
                  <div className="flex-shrink-0">
                    {confirmEliminar === r.id ? (
                      <div className="flex gap-1">
                        <button onClick={() => eliminar(r.id)} className="px-2 py-0.5 bg-rose-500 text-white rounded text-xs font-medium hover:bg-rose-600">Sí</button>
                        <button onClick={() => setConfirmEliminar(null)} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium">No</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmEliminar(r.id)} className="p-1.5 text-gray-300 hover:text-rose-500 transition-colors rounded">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal nuevo reconocimiento */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">Nuevo reconocimiento</h2>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {/* Plantillas rápidas */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">Tipo</label>
                <div className="grid grid-cols-2 gap-2">
                  {PLANTILLAS.map(p => {
                    const Ic = p.icono
                    return (
                      <button
                        key={p.tipo}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, tipo: p.tipo }))}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          form.tipo === p.tipo ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <Ic size={14} className={form.tipo === p.tipo ? 'text-[#F5B731]' : p.color} /> {p.tipo}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Empleado *</label>
                <select className={inputCls} value={form.empleado_id} onChange={e => setForm(f => ({ ...f, empleado_id: e.target.value }))}>
                  <option value="">— Seleccionar empleado —</option>
                  {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Motivo / mensaje *</label>
                <textarea className={`${inputCls} min-h-[80px] resize-none`} value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))} placeholder="Ej: Por su actitud durante el evento del sábado..." />
              </div>

              {error && <p className="text-xs text-rose-500">{error}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
                <button onClick={guardar} disabled={guardando} className="px-4 py-2 text-sm font-semibold bg-[#F5B731] text-[#1A1A1A] rounded-lg hover:bg-[#e0a820] disabled:opacity-50">
                  {guardando ? 'Publicando...' : 'Publicar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useEmpleadoActual } from '@/lib/useEmpleado'
import { Plus, X, NotebookPen, RefreshCw, Sun, Sunset, Moon } from 'lucide-react'
import type { BitacoraTurno } from '@/lib/supabase'

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white'

const TURNO_CFG = {
  mañana: { label: 'Mañana', icono: Sun,     cls: 'bg-amber-100 text-amber-700' },
  tarde:  { label: 'Tarde',  icono: Sunset,  cls: 'bg-orange-100 text-orange-700' },
  noche:  { label: 'Noche',  icono: Moon,    cls: 'bg-indigo-100 text-indigo-700' },
} as const

function fmtFecha(s: string) {
  return new Date(s).toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function PaginaBitacoraAdmin() {
  const { empleado } = useEmpleadoActual()
  const [notas, setNotas] = useState<BitacoraTurno[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ turno: 'mañana' as 'mañana' | 'tarde' | 'noche', nota: '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from('bitacora_turno')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(40)
    setNotas(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function guardar() {
    if (!form.nota.trim()) { setError('Escribe una nota'); return }
    setGuardando(true); setError('')
    const { error: err } = await supabase.from('bitacora_turno').insert({
      local_id: empleado?.local_id ?? 1,
      empleado_nombre: empleado?.nombre ?? 'Admin',
      turno: form.turno,
      nota: form.nota.trim(),
    })
    if (err) { setError(err.message); setGuardando(false); return }
    setGuardando(false)
    setModal(false)
    setForm({ turno: 'mañana', nota: '' })
    cargar()
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><RefreshCw className="animate-spin text-[#F5B731]" size={24} /></div>
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Bitácora de turno</h1>
          <p className="text-sm text-gray-400 mt-0.5">Notas del equipo entre turnos</p>
        </div>
        <button
          onClick={() => { setModal(true); setError('') }}
          className="flex items-center gap-2 px-4 py-2 bg-[#F5B731] text-[#1A1A1A] text-sm font-semibold rounded-lg hover:bg-[#e0a820] transition-colors"
        >
          <Plus size={15} /> Nueva nota
        </button>
      </div>

      {notas.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <NotebookPen size={36} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">No hay notas en la bitácora</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notas.map(n => {
            const cfg = TURNO_CFG[n.turno]
            const Icono = cfg.icono
            return (
              <div key={n.id} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
                <div className="flex items-start gap-3">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${cfg.cls}`}>
                    <Icono size={11} /> {cfg.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 leading-relaxed">{n.nota}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs font-medium text-gray-500">{n.empleado_nombre}</span>
                      <span className="text-gray-300">·</span>
                      <span className="text-xs text-gray-400">{fmtFecha(n.created_at)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal nueva nota */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">Nueva nota de turno</h2>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">Turno</label>
                <div className="flex gap-2">
                  {(Object.entries(TURNO_CFG) as [string, typeof TURNO_CFG[keyof typeof TURNO_CFG]][]).map(([key, cfg]) => {
                    const Icono = cfg.icono
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, turno: key as 'mañana' | 'tarde' | 'noche' }))}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          form.turno === key ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <Icono size={13} /> {cfg.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nota para el siguiente turno *</label>
                <textarea
                  className={`${inputCls} min-h-[100px] resize-none`}
                  value={form.nota}
                  onChange={e => setForm(f => ({ ...f, nota: e.target.value }))}
                  placeholder="Ej: Falta hielo en la barra, avisar a compras. Cliente VIP mañana a las 21h..."
                />
              </div>
              {error && <p className="text-xs text-rose-500">{error}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
                <button onClick={guardar} disabled={guardando} className="px-4 py-2 text-sm font-semibold bg-[#F5B731] text-[#1A1A1A] rounded-lg hover:bg-[#e0a820] disabled:opacity-50">
                  {guardando ? 'Guardando...' : 'Guardar nota'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

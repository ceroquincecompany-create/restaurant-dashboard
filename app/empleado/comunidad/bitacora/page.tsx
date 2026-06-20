'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useEmpleadoActual } from '@/lib/useEmpleado'
import { ArrowLeft, NotebookPen, Plus, X, Sun, Sunset, Moon, RefreshCw } from 'lucide-react'
import type { BitacoraTurno } from '@/lib/supabase'

const TURNO_CFG = {
  mañana: { label: 'Mañana', icono: Sun,    cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  tarde:  { label: 'Tarde',  icono: Sunset, cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  noche:  { label: 'Noche',  icono: Moon,   cls: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
} as const

function fmtFecha(s: string) {
  const d = new Date(s)
  const hoy = new Date()
  const ayer = new Date(); ayer.setDate(ayer.getDate() - 1)
  if (d.toDateString() === hoy.toDateString()) return 'Hoy · ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === ayer.toDateString()) return 'Ayer · ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' }) + ' · ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

export default function BitacoraEmpleado() {
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
      .limit(30)
    setNotas(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function guardar() {
    if (!form.nota.trim()) { setError('Escribe una nota'); return }
    setGuardando(true); setError('')
    const { error: err } = await supabase.from('bitacora_turno').insert({
      local_id: empleado?.local_id ?? 1,
      empleado_nombre: empleado?.nombre ?? 'Empleado',
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
    return <div className="flex items-center justify-center min-h-[60vh]"><RefreshCw className="animate-spin text-[#F5B731]" size={22} /></div>
  }

  return (
    <div className="px-4 py-5 max-w-2xl">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Link href="/empleado/comunidad" className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Bitácora</h1>
        </div>
        <button
          onClick={() => { setModal(true); setError('') }}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#F5B731] text-[#1A1A1A] text-sm font-bold rounded-xl active:scale-95 transition-all"
        >
          <Plus size={16} /> Nueva nota
        </button>
      </div>

      {notas.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <NotebookPen size={36} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">No hay notas en la bitácora</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notas.map(n => {
            const cfg = TURNO_CFG[n.turno]
            const Icono = cfg.icono
            return (
              <div key={n.id} className="bg-white rounded-2xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-2.5">
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.cls}`}>
                    <Icono size={11} /> {cfg.label}
                  </span>
                  <span className="text-xs text-gray-400">{fmtFecha(n.created_at)}</span>
                </div>
                <p className="text-base text-gray-800 leading-relaxed">{n.nota}</p>
                <p className="text-xs font-medium text-gray-400 mt-2">{n.empleado_nombre}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal nueva nota */}
      {modal && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 px-0">
          <div className="bg-white rounded-t-3xl w-full max-w-lg shadow-2xl pb-safe">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <p className="text-base font-bold text-gray-900">Nueva nota de turno</p>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={20} />
              </button>
            </div>
            <div className="px-5 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Turno</label>
                <div className="flex gap-2">
                  {(Object.entries(TURNO_CFG) as [string, typeof TURNO_CFG[keyof typeof TURNO_CFG]][]).map(([key, cfg]) => {
                    const Icono = cfg.icono
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, turno: key as 'mañana' | 'tarde' | 'noche' }))}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                          form.turno === key ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]' : 'bg-white text-gray-500 border-gray-200'
                        }`}
                      >
                        <Icono size={14} /> {cfg.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Nota *</label>
                <textarea
                  className="w-full px-4 py-3 text-base border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F5B731] resize-none min-h-[100px]"
                  value={form.nota}
                  onChange={e => setForm(f => ({ ...f, nota: e.target.value }))}
                  placeholder="Ej: Falta hielo, avisar a compras. Cliente especial mañana a las 21h..."
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-rose-500">{error}</p>}
              <button
                onClick={guardar}
                disabled={guardando}
                className="w-full py-3.5 bg-[#F5B731] text-[#1A1A1A] font-bold text-base rounded-xl active:scale-[0.98] transition-all disabled:opacity-60"
              >
                {guardando ? 'Guardando...' : 'Guardar nota'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

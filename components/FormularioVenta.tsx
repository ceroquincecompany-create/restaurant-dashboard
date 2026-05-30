'use client'

import { useState } from 'react'
import { supabase, type Local } from '@/lib/supabase'
import { Save, X } from 'lucide-react'

interface Props {
  locales: Local[]
  onSuccess: () => void
}

export default function FormularioVenta({ locales, onSuccess }: Props) {
  const hoy = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    local_id: locales[0]?.id?.toString() ?? '',
    fecha: hoy,
    total_ventas: '',
    coste_alimentos: '',
    coste_personal: '',
    num_clientes: '',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState(false)

  const foodCostPct =
    form.total_ventas && form.coste_alimentos
      ? ((parseFloat(form.coste_alimentos) / parseFloat(form.total_ventas)) * 100).toFixed(1)
      : null

  const personalCostPct =
    form.total_ventas && form.coste_personal
      ? ((parseFloat(form.coste_personal) / parseFloat(form.total_ventas)) * 100).toFixed(1)
      : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError(null)

    const { error } = await supabase.from('ventas').upsert({
      local_id: parseInt(form.local_id),
      fecha: form.fecha,
      total_ventas: parseFloat(form.total_ventas),
      coste_alimentos: parseFloat(form.coste_alimentos),
      coste_personal: parseFloat(form.coste_personal),
      num_clientes: parseInt(form.num_clientes) || 0,
    }, { onConflict: 'local_id,fecha' })

    setGuardando(false)
    if (error) {
      setError(error.message)
    } else {
      setExito(true)
      setTimeout(() => { setExito(false); onSuccess() }, 1500)
    }
  }

  const campo = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300'

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Registrar / Actualizar Venta</h3>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-xs text-gray-500 mb-1">Local</label>
          <select
            className={campo}
            value={form.local_id}
            onChange={(e) => setForm({ ...form, local_id: e.target.value })}
            required
          >
            {locales.map((l) => (
              <option key={l.id} value={l.id}>{l.nombre}</option>
            ))}
          </select>
        </div>

        <div className="col-span-2 sm:col-span-1">
          <label className="block text-xs text-gray-500 mb-1">Fecha</label>
          <input type="date" className={campo} value={form.fecha}
            onChange={(e) => setForm({ ...form, fecha: e.target.value })} required />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Total ventas (€)</label>
          <input type="number" step="0.01" min="0" className={campo} placeholder="2500.00"
            value={form.total_ventas}
            onChange={(e) => setForm({ ...form, total_ventas: e.target.value })} required />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Nº clientes</label>
          <input type="number" min="0" className={campo} placeholder="80"
            value={form.num_clientes}
            onChange={(e) => setForm({ ...form, num_clientes: e.target.value })} />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">
            Coste alimentos (€)
            {foodCostPct && (
              <span className={`ml-2 font-semibold ${parseFloat(foodCostPct) > 35 ? 'text-rose-500' : 'text-emerald-600'}`}>
                → {foodCostPct}%
              </span>
            )}
          </label>
          <input type="number" step="0.01" min="0" className={campo} placeholder="750.00"
            value={form.coste_alimentos}
            onChange={(e) => setForm({ ...form, coste_alimentos: e.target.value })} required />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">
            Coste personal (€)
            {personalCostPct && (
              <span className={`ml-2 font-semibold ${parseFloat(personalCostPct) > 30 ? 'text-rose-500' : 'text-emerald-600'}`}>
                → {personalCostPct}%
              </span>
            )}
          </label>
          <input type="number" step="0.01" min="0" className={campo} placeholder="600.00"
            value={form.coste_personal}
            onChange={(e) => setForm({ ...form, coste_personal: e.target.value })} required />
        </div>
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 text-xs text-rose-600 bg-rose-50 rounded-lg p-3">
          <X size={14} /> {error}
        </div>
      )}

      {exito && (
        <div className="mt-3 text-xs text-emerald-600 bg-emerald-50 rounded-lg p-3 text-center font-medium">
          ✓ Guardado correctamente
        </div>
      )}

      <button
        type="submit"
        disabled={guardando}
        className="mt-4 w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
      >
        <Save size={15} />
        {guardando ? 'Guardando...' : 'Guardar venta'}
      </button>
    </form>
  )
}

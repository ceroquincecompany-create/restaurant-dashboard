'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { Ingrediente, InventarioConteo } from '@/lib/supabase'
import { useEmpleadoActual } from '@/lib/useEmpleado'
import { RefreshCw, Save, Search, Package, CheckCircle2 } from 'lucide-react'

export default function PaginaInventario() {
  const { empleado, loading: empLoading } = useEmpleadoActual()
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([])
  const [conteos, setConteos] = useState<InventarioConteo[]>([])
  const [cantidades, setCantidades] = useState<Record<number, string>>({})
  const [busqueda, setBusqueda] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [loading, setLoading] = useState(true)

  const today = new Date().toISOString().split('T')[0]

  const cargar = useCallback(async () => {
    if (!empleado) return
    try {
      const [{ data: ings }, { data: ctns }] = await Promise.all([
        supabase.from('ingredientes').select('*').order('proveedor').order('nombre_ingrediente'),
        supabase.from('inventario_conteos').select('*').eq('empleado_id', empleado.id).eq('fecha', today),
      ])
      setIngredientes(ings ?? [])
      const init: Record<number, string> = {}
      ;(ctns ?? []).forEach((c) => { init[c.ingrediente_id] = String(c.cantidad) })
      setCantidades(init)
      setConteos(ctns ?? [])
    } finally {
      setLoading(false)
    }
  }, [empleado, today])

  useEffect(() => {
    if (empLoading) return
    if (empleado) cargar()
    else setLoading(false)
  }, [empLoading, empleado, cargar])

  // Group by proveedor
  const agrupados = useMemo(() => {
    const q = busqueda.toLowerCase()
    const filtrados = ingredientes.filter((i) =>
      !q || i.nombre_ingrediente.toLowerCase().includes(q) || (i.proveedor ?? '').toLowerCase().includes(q)
    )
    const grupos: Record<string, Ingrediente[]> = {}
    filtrados.forEach((i) => {
      const grupo = i.proveedor?.trim() || 'Sin proveedor'
      if (!grupos[grupo]) grupos[grupo] = []
      grupos[grupo].push(i)
    })
    return Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b))
  }, [ingredientes, busqueda])

  const conteosCantidad = Object.values(cantidades).filter((v) => v !== '' && v !== undefined).length

  async function guardar() {
    if (!empleado) return
    setGuardando(true)

    const payload = Object.entries(cantidades)
      .filter(([, v]) => v !== '' && v !== undefined)
      .map(([ingId, cant]) => ({
        empleado_id: empleado.id,
        fecha: today,
        local_id: empleado.local_id,
        ingrediente_id: Number(ingId),
        cantidad: parseFloat(cant) || 0,
      }))

    if (payload.length > 0) {
      await supabase
        .from('inventario_conteos')
        .upsert(payload, { onConflict: 'empleado_id,fecha,ingrediente_id' })
    }

    setGuardando(false)
    setGuardado(true)
    setTimeout(() => setGuardado(false), 3000)
    cargar()
  }

  if (empLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="animate-spin text-[#F5B731]" size={24} />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Inventario</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {today} · {conteosCantidad} ingredientes contados
          </p>
        </div>
        <button
          onClick={guardar}
          disabled={guardando || conteosCantidad === 0}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 ${
            guardado
              ? 'bg-emerald-500 text-white'
              : 'bg-[#F5B731] text-[#1A1A1A] hover:bg-[#e0a820]'
          }`}
        >
          {guardado ? <><CheckCircle2 size={15} /> Guardado</> : guardando ? <><RefreshCw size={15} className="animate-spin" /> Guardando...</> : <><Save size={15} /> Guardar conteo</>}
        </button>
      </div>

      {/* Buscador */}
      <div className="relative mb-5">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar ingrediente o proveedor..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#F5B731]"
        />
      </div>

      {agrupados.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <Package size={32} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">
            {busqueda ? 'Sin resultados' : 'No hay ingredientes en la base de datos'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {agrupados.map(([proveedor, ings]) => (
            <div key={proveedor} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{proveedor}</p>
                <p className="text-xs text-gray-400">{ings.length} ingredientes</p>
              </div>
              <div className="divide-y divide-gray-50">
                {ings.map((ing) => {
                  const val = cantidades[ing.id] ?? ''
                  const tieneValor = val !== '' && val !== undefined
                  return (
                    <div key={ing.id} className={`flex items-center gap-4 px-5 py-2.5 ${tieneValor ? 'bg-[#F5B731]/5' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 truncate">{ing.nombre_ingrediente}</p>
                        {ing.formato_compra && (
                          <p className="text-xs text-gray-400">{ing.formato_compra}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          placeholder="0"
                          value={val}
                          onChange={(e) => setCantidades((c) => ({ ...c, [ing.id]: e.target.value }))}
                          className={`w-20 px-2 py-1.5 text-sm text-center border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white transition-colors ${
                            tieneValor ? 'border-[#F5B731] font-semibold' : 'border-gray-200'
                          }`}
                        />
                        <span className="text-xs text-gray-400 w-12">{ing.unidad_compra ?? ing.unidad_producto ?? ''}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

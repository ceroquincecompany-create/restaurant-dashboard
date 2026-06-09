'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { Ingrediente, InventarioConteo } from '@/lib/supabase'
import { useEmpleadoActual } from '@/lib/useEmpleado'
import { RefreshCw, Save, Search, Package, CheckCircle2, Lock, ChevronDown, ChevronUp } from 'lucide-react'

function fechaHoy() {
  return new Date().toISOString().split('T')[0]
}

export default function PaginaInventario() {
  const { empleado, loading: empLoading } = useEmpleadoActual()
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([])
  const [conteos, setConteos] = useState<InventarioConteo[]>([])
  const [cantidades, setCantidades] = useState<Record<number, string>>({})
  const [busqueda, setBusqueda] = useState('')
  const [fecha, setFecha] = useState(fechaHoy())
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [loading, setLoading] = useState(true)
  const [gruposAbiertos, setGruposAbiertos] = useState<Record<string, boolean>>({})

  const cerrado = conteos.length > 0 && conteos[0]?.cerrado === true

  const cargar = useCallback(async () => {
    if (!empleado) return
    setLoading(true)
    const [{ data: ings }, { data: ctns }] = await Promise.all([
      supabase.from('ingredientes').select('*').order('proveedor').order('nombre_ingrediente'),
      supabase.from('inventario_conteos').select('*')
        .eq('empleado_id', empleado.id)
        .eq('fecha', fecha),
    ])
    const ingList = (ings ?? []) as Ingrediente[]
    const ctnList = (ctns ?? []) as InventarioConteo[]
    setIngredientes(ingList)
    setConteos(ctnList)
    const init: Record<number, string> = {}
    ctnList.forEach((c) => { init[c.ingrediente_id] = c.cantidad != null ? String(c.cantidad) : '' })
    setCantidades(init)
    // Abrir todos los grupos por defecto
    const grupos: Record<string, boolean> = {}
    ingList.forEach((i) => {
      const g = i.proveedor?.trim() || 'Sin proveedor'
      grupos[g] = true
    })
    setGruposAbiertos(grupos)
    setLoading(false)
  }, [empleado, fecha])

  useEffect(() => {
    if (empLoading) return
    if (empleado) cargar()
    else setLoading(false)
  }, [empLoading, empleado, cargar])

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

  const totalContados = useMemo(
    () => Object.values(cantidades).filter((v) => v !== '' && Number(v) > 0).length,
    [cantidades]
  )

  function toggleGrupo(nombre: string) {
    setGruposAbiertos((g) => ({ ...g, [nombre]: !g[nombre] }))
  }

  async function guardar() {
    if (!empleado || cerrado) return
    setGuardando(true)

    // Obtener o generar grupo_id
    let grupoId: string | null = conteos[0]?.inventario_grupo_id ?? null
    if (!grupoId) {
      // Generar UUID v4 simple en JS (crypto.randomUUID si disponible)
      grupoId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    }

    const payload = Object.entries(cantidades)
      .filter(([, v]) => v !== '' && v !== undefined)
      .map(([ingId, cant]) => ({
        empleado_id: empleado.id,
        fecha,
        local_id: empleado.local_id,
        ingrediente_id: Number(ingId),
        cantidad: parseFloat(cant) || 0,
        inventario_grupo_id: grupoId,
        cerrado: false,
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

  const esHoy = fecha === fechaHoy()

  return (
    <div className="p-4 max-w-2xl pb-28">
      {/* Cabecera */}
      <div className="mb-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Inventario</h1>
            <p className="text-sm text-gray-400 mt-0.5">{totalContados} ingredientes contados</p>
          </div>
          {cerrado && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 text-gray-500 text-xs font-semibold rounded-full">
              <Lock size={11} /> Cerrado
            </span>
          )}
        </div>

        {/* Selector de fecha */}
        <div className="mt-3 flex items-center gap-2">
          <input
            type="date"
            value={fecha}
            max={fechaHoy()}
            onChange={(e) => { setFecha(e.target.value); setGuardado(false) }}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white"
          />
          {!esHoy && (
            <button
              onClick={() => setFecha(fechaHoy())}
              className="text-xs text-[#F5B731] font-medium hover:underline"
            >
              Volver a hoy
            </button>
          )}
        </div>

        {conteos.length > 0 && !cerrado && (
          <p className="mt-2 text-xs text-emerald-600 font-medium">
            ✓ Ya tienes datos guardados para este día — puedes editarlos
          </p>
        )}
      </div>

      {/* Buscador */}
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar ingrediente o proveedor..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#F5B731]"
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
        <div className="space-y-3">
          {agrupados.map(([proveedor, ings]) => {
            const abierto = gruposAbiertos[proveedor] !== false
            const contadosEnGrupo = ings.filter((i) => {
              const v = cantidades[i.id]
              return v !== '' && v !== undefined && Number(v) > 0
            }).length
            return (
              <div key={proveedor} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100 text-left"
                  onClick={() => toggleGrupo(proveedor)}
                >
                  <div>
                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{proveedor}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {contadosEnGrupo}/{ings.length} contados
                    </p>
                  </div>
                  <span className="text-gray-400">
                    {abierto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </span>
                </button>

                {abierto && (
                  <div className="divide-y divide-gray-50">
                    {ings.map((ing) => {
                      const val = cantidades[ing.id] ?? ''
                      const tieneValor = val !== '' && Number(val) > 0
                      const unidad = ing.unidad_compra ?? ing.unidad_producto ?? ''
                      return (
                        <div
                          key={ing.id}
                          className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                            tieneValor ? 'bg-[#F5B731]/5' : ''
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm leading-snug ${tieneValor ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                              {ing.nombre_ingrediente}
                            </p>
                            {ing.formato_compra && (
                              <p className="text-xs text-gray-400 mt-0.5">{ing.formato_compra}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="0.1"
                              placeholder="0"
                              disabled={cerrado}
                              value={val}
                              onChange={(e) =>
                                setCantidades((c) => ({ ...c, [ing.id]: e.target.value }))
                              }
                              className={`w-20 px-2 py-2 text-sm text-center border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white transition-colors disabled:bg-gray-50 disabled:text-gray-400 ${
                                tieneValor
                                  ? 'border-[#F5B731] font-bold text-[#1A1A1A]'
                                  : 'border-gray-200 text-gray-500'
                              }`}
                            />
                            {unidad && (
                              <span className="text-xs text-gray-400 w-10 leading-tight">{unidad}</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Botón flotante guardar */}
      {!cerrado && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 z-40">
          <button
            onClick={guardar}
            disabled={guardando || totalContados === 0}
            className={`w-full flex items-center justify-center gap-2 py-3.5 text-sm font-bold rounded-xl transition-colors disabled:opacity-40 ${
              guardado
                ? 'bg-emerald-500 text-white'
                : 'bg-[#F5B731] text-[#1A1A1A] hover:bg-[#e0a820]'
            }`}
          >
            {guardado ? (
              <><CheckCircle2 size={16} /> ¡Inventario guardado!</>
            ) : guardando ? (
              <><RefreshCw size={16} className="animate-spin" /> Guardando...</>
            ) : (
              <><Save size={16} /> Guardar inventario ({totalContados} items)</>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

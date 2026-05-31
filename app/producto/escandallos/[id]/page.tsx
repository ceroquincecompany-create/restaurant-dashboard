'use client'

import { use, useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { ArrowLeft, Save, Plus, Trash2, RefreshCw, Check, AlertTriangle, Search } from 'lucide-react'

// ── Tipos ────────────────────────────────────────────────────
type Producto = { id: number; nombre: string; familia: string | null; pvp_sala: number | null; pvp_delivery: number | null }
type Ingrediente = { id: number; nombre_ingrediente: string; unidad_producto: string | null; precio_unidad_producto: number | null }
type LineaReceta = {
  receta_id: number | null
  ingrediente_id: number
  nombre: string
  unidad: string
  precio_unidad: number
  cantidad_bruta: number
  merma_pct: number
  coste: number
}

// ── Helpers ──────────────────────────────────────────────────
const eur = (n: number) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: 4, maximumFractionDigits: 4 }) + ' €'
const eurShort = (n: number) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const pct = (n: number) => n.toFixed(1) + '%'

function calcCoste(cantBruta: number, precio: number) {
  return cantBruta * precio
}

// ── Componente principal ─────────────────────────────────────
export default function DetalleEscandallo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const productoId = parseInt(id)

  const [producto, setProducto] = useState<Producto | null>(null)
  const [lineas, setLineas] = useState<LineaReceta[]>([])
  const [ingredientesDB, setIngredientesDB] = useState<Ingrediente[]>([])
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)

  // Estado del formulario de cabecera
  const [nombre, setNombre] = useState('')
  const [pvpSala, setPvpSala] = useState<string>('')
  const [pvpDelivery, setPvpDelivery] = useState<string>('')

  // Estado para añadir ingrediente
  const [mostrarBuscador, setMostrarBuscador] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [ingSeleccionado, setIngSeleccionado] = useState<number | null>(null)
  const [cantNueva, setCantNueva] = useState('0.1')
  const [mermaNueva, setMermaNueva] = useState('0')

  // ── Carga inicial ────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const [{ data: prod }, { data: recs }, { data: ings }] = await Promise.all([
        supabase.from('productos').select('*').eq('id', productoId).single(),
        supabase
          .from('recetas')
          .select('id, ingrediente_id, cantidad_bruta, cantidad_neta, merma_pct, coste, ingredientes(nombre_ingrediente, unidad_producto, precio_unidad_producto)')
          .eq('producto_id', productoId)
          .order('id'),
        supabase.from('ingredientes').select('id, nombre_ingrediente, unidad_producto, precio_unidad_producto').order('nombre_ingrediente'),
      ])

      if (prod) {
        setProducto(prod)
        setNombre(prod.nombre)
        setPvpSala(prod.pvp_sala?.toString() ?? '')
        setPvpDelivery(prod.pvp_delivery?.toString() ?? '')
      }

      if (recs) {
        setLineas(
          recs.map((r) => {
            const ing = (r as any).ingredientes ?? {}
            const precio = ing.precio_unidad_producto ?? 0
            const cant = r.cantidad_bruta ?? 0
            return {
              receta_id: r.id,
              ingrediente_id: r.ingrediente_id,
              nombre: ing.nombre_ingrediente ?? `ID ${r.ingrediente_id}`,
              unidad: ing.unidad_producto ?? '',
              precio_unidad: precio,
              cantidad_bruta: cant,
              merma_pct: r.merma_pct ?? 0,
              coste: r.coste ?? calcCoste(cant, precio),
            }
          })
        )
      }

      setIngredientesDB(ings ?? [])
      setLoading(false)
    }
    load()
  }, [productoId])

  // ── Cálculos panel derecho ───────────────────────────────────
  const { costeTotal, pvpSalaNum, pvpSinIva, foodCostPct, margenSala, margenDelivery } = useMemo(() => {
    const costeTotal = lineas.reduce((s, l) => s + l.coste, 0)
    const pvpSalaNum = parseFloat(pvpSala) || 0
    const pvpDelNum = parseFloat(pvpDelivery) || 0
    const pvpSinIva = pvpSalaNum / 1.1
    const foodCostPct = pvpSinIva > 0 ? (costeTotal / pvpSinIva) * 100 : 0
    const margenSala = pvpSinIva - costeTotal
    const pvpDelSinIva = pvpDelNum / 1.1
    const margenDelivery = pvpDelNum > 0 ? pvpDelSinIva - costeTotal : null
    return { costeTotal, pvpSalaNum, pvpSinIva, foodCostPct, margenSala, margenDelivery }
  }, [lineas, pvpSala, pvpDelivery])

  // ── Edición de líneas ────────────────────────────────────────
  const actualizarLinea = useCallback((idx: number, campo: 'cantidad_bruta' | 'merma_pct', valor: number) => {
    setLineas((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l
        const updated = { ...l, [campo]: valor }
        updated.coste = calcCoste(updated.cantidad_bruta, updated.precio_unidad)
        return updated
      })
    )
  }, [])

  const eliminarLinea = useCallback((idx: number) => {
    setLineas((prev) => prev.filter((_, i) => i !== idx))
  }, [])

  // ── Añadir ingrediente ───────────────────────────────────────
  const ingredientesFiltrados = useMemo(
    () =>
      busqueda.length < 2
        ? ingredientesDB.slice(0, 20)
        : ingredientesDB.filter((i) => i.nombre_ingrediente.toLowerCase().includes(busqueda.toLowerCase())).slice(0, 30),
    [ingredientesDB, busqueda]
  )

  function añadirIngrediente() {
    if (!ingSeleccionado) return
    const ing = ingredientesDB.find((i) => i.id === ingSeleccionado)
    if (!ing) return
    const cant = parseFloat(cantNueva) || 0
    const merma = parseFloat(mermaNueva) / 100 // input como % → almacenar decimal
    const precio = ing.precio_unidad_producto ?? 0
    const yaExiste = lineas.some((l) => l.ingrediente_id === ingSeleccionado)
    if (yaExiste) { alert('Este ingrediente ya está en la receta'); return }
    setLineas((prev) => [
      ...prev,
      {
        receta_id: null,
        ingrediente_id: ing.id,
        nombre: ing.nombre_ingrediente,
        unidad: ing.unidad_producto ?? '',
        precio_unidad: precio,
        cantidad_bruta: cant,
        merma_pct: merma,
        coste: calcCoste(cant, precio),
      },
    ])
    setMostrarBuscador(false)
    setBusqueda('')
    setIngSeleccionado(null)
    setCantNueva('0.1')
    setMermaNueva('0')
  }

  // ── Guardar ──────────────────────────────────────────────────
  async function guardar() {
    if (!producto) return
    setGuardando(true)

    await supabase.from('productos').update({
      nombre,
      pvp_sala: parseFloat(pvpSala) || null,
      pvp_delivery: parseFloat(pvpDelivery) || null,
    }).eq('id', productoId)

    await supabase.from('recetas').delete().eq('producto_id', productoId)

    if (lineas.length > 0) {
      await supabase.from('recetas').insert(
        lineas.map((l) => ({
          producto_id: productoId,
          ingrediente_id: l.ingrediente_id,
          cantidad_bruta: l.cantidad_bruta,
          cantidad_neta: l.cantidad_bruta * (1 - l.merma_pct),
          merma_pct: l.merma_pct,
          coste: l.coste,
        }))
      )
    }

    setGuardando(false)
    setGuardado(true)
    setTimeout(() => setGuardado(false), 2500)
  }

  // ── Render ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="animate-spin text-[#F5B731]" size={24} />
      </div>
    )
  }

  if (!producto) {
    return (
      <div className="p-6">
        <p className="text-gray-500">Producto no encontrado.</p>
        <Link href="/producto/escandallos" className="text-sm text-[#F5B731] underline mt-2 block">← Volver</Link>
      </div>
    )
  }

  const fcAlerta = foodCostPct > 38
  const fcAtencion = foodCostPct >= 30 && foodCostPct <= 38

  return (
    <div className="p-6 max-w-7xl">
      {/* Back */}
      <Link
        href="/producto/escandallos"
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-4 transition-colors w-fit"
      >
        <ArrowLeft size={15} /> Volver a escandallos
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* ── Columna principal ─────────────────────────────── */}
        <div className="space-y-5">
          {/* Cabecera del producto */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-1">
                <label className="block text-xs text-gray-500 mb-1">Familia</label>
                <p className="text-sm font-semibold text-gray-700 py-1.5">{producto.familia ?? '—'}</p>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Nombre del producto</label>
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F5B731]"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">PVP Sala (€ con IVA)</label>
                <input
                  type="number"
                  step="0.01"
                  value={pvpSala}
                  onChange={(e) => setPvpSala(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5B731]"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">PVP Delivery (€ con IVA)</label>
                <input
                  type="number"
                  step="0.01"
                  value={pvpDelivery}
                  onChange={(e) => setPvpDelivery(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5B731]"
                />
              </div>
            </div>
          </div>

          {/* Tabla de ingredientes */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">
                Ingredientes · {lineas.length} líneas
              </h3>
              <button
                onClick={() => setMostrarBuscador((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#F5B731] text-[#1A1A1A] hover:bg-[#e5a820] transition-colors"
              >
                <Plus size={13} /> Añadir ingrediente
              </button>
            </div>

            {/* Buscador de ingredientes */}
            {mostrarBuscador && (
              <div className="px-5 py-4 border-b border-dashed border-gray-200 bg-gray-50">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Buscar ingrediente</label>
                    <div className="relative">
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        placeholder="Escribe para filtrar…"
                        className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731]"
                      />
                    </div>
                    <select
                      size={5}
                      value={ingSeleccionado ?? ''}
                      onChange={(e) => setIngSeleccionado(Number(e.target.value))}
                      className="mt-1 w-full text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white"
                    >
                      {ingredientesFiltrados.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.nombre_ingrediente} ({i.unidad_producto ?? '—'}) — {i.precio_unidad_producto?.toFixed(4) ?? '—'} €
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Cantidad bruta</label>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={cantNueva}
                      onChange={(e) => setCantNueva(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5B731]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Merma %</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      value={mermaNueva}
                      onChange={(e) => setMermaNueva(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5B731]"
                    />
                    <button
                      onClick={añadirIngrediente}
                      className="mt-2 w-full bg-[#1A1A1A] text-white text-xs font-semibold py-1.5 rounded-lg hover:bg-black transition-colors"
                    >
                      Confirmar
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium">Ingrediente</th>
                    <th className="text-right px-3 py-3 font-medium">Cant. bruta</th>
                    <th className="text-center px-3 py-3 font-medium">Unidad</th>
                    <th className="text-right px-3 py-3 font-medium">Merma %</th>
                    <th className="text-right px-3 py-3 font-medium">Precio/ud</th>
                    <th className="text-right px-3 py-3 font-medium">Coste</th>
                    <th className="px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {lineas.map((l, idx) => (
                    <tr key={`${l.ingrediente_id}-${idx}`} className="hover:bg-gray-50">
                      <td className="px-5 py-2.5 font-medium text-gray-800">{l.nombre}</td>
                      <td className="px-3 py-2.5">
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={l.cantidad_bruta}
                          onChange={(e) => actualizarLinea(idx, 'cantidad_bruta', parseFloat(e.target.value) || 0)}
                          className="w-24 text-right rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#F5B731]"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs text-gray-400">{l.unidad}</td>
                      <td className="px-3 py-2.5">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          max="100"
                          value={(l.merma_pct * 100).toFixed(0)}
                          onChange={(e) => actualizarLinea(idx, 'merma_pct', (parseFloat(e.target.value) || 0) / 100)}
                          className="w-16 text-right rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#F5B731]"
                        />
                        <span className="ml-1 text-xs text-gray-400">%</span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs text-gray-500">
                        {l.precio_unidad.toLocaleString('es-ES', { minimumFractionDigits: 4 })} €
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs font-semibold text-gray-800">
                        {l.coste.toLocaleString('es-ES', { minimumFractionDigits: 4 })} €
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => eliminarLinea(idx)}
                          className="text-gray-300 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {lineas.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-6 text-center text-xs text-gray-400">
                        Sin ingredientes. Usa &ldquo;Añadir ingrediente&rdquo; para construir la receta.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Botón guardar */}
          <button
            onClick={guardar}
            disabled={guardando}
            className="w-full flex items-center justify-center gap-2 bg-[#F5B731] hover:bg-[#e5a820] disabled:opacity-60 text-[#1A1A1A] font-bold text-sm py-3 rounded-xl transition-colors"
          >
            {guardado ? (
              <><Check size={16} /> Cambios guardados</>
            ) : guardando ? (
              <><RefreshCw size={15} className="animate-spin" /> Guardando...</>
            ) : (
              <><Save size={15} /> Guardar cambios</>
            )}
          </button>
        </div>

        {/* ── Panel derecho ─────────────────────────────────── */}
        <div className="space-y-4">
          {/* Resumen económico */}
          <div className="bg-[#1A1A1A] rounded-xl p-5 text-white space-y-4">
            <h3 className="text-sm font-bold tracking-wide uppercase text-white/60">Resumen</h3>

            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-white/60">Coste receta</span>
                <span className="font-bold">{eurShort(costeTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">PVP Sala (s/IVA)</span>
                <span className="font-semibold">{pvpSalaNum > 0 ? eurShort(pvpSinIva) : '—'}</span>
              </div>
              <div className="border-t border-white/10 pt-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-white/60">Food Cost %</span>
                  <span
                    className={`text-lg font-bold px-2 py-0.5 rounded ${
                      fcAlerta
                        ? 'bg-rose-500 text-white'
                        : fcAtencion
                        ? 'bg-amber-400 text-[#1A1A1A]'
                        : 'bg-emerald-500 text-white'
                    }`}
                  >
                    {pvpSinIva > 0 ? pct(foodCostPct) : '—'}
                  </span>
                </div>
                {fcAlerta && (
                  <p className="text-xs text-rose-400 flex items-center gap-1 mt-1">
                    <AlertTriangle size={11} /> Supera el 38% objetivo
                  </p>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Margen Sala</span>
                <span className={`font-semibold ${margenSala < 0 ? 'text-rose-400' : 'text-[#F5B731]'}`}>
                  {pvpSalaNum > 0 ? eurShort(margenSala) : '—'}
                </span>
              </div>
              {margenDelivery !== null && (
                <div className="flex justify-between">
                  <span className="text-white/60">Margen Delivery</span>
                  <span className={`font-semibold ${margenDelivery < 0 ? 'text-rose-400' : 'text-[#F5B731]'}`}>
                    {eurShort(margenDelivery)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Desglose de coste */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
              Desglose ({lineas.length} ingredientes)
            </h3>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {[...lineas]
                .sort((a, b) => b.coste - a.coste)
                .map((l, i) => {
                  const pctTotal = costeTotal > 0 ? (l.coste / costeTotal) * 100 : 0
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="text-gray-600 truncate pr-2">{l.nombre}</span>
                          <span className="text-gray-400 shrink-0">{pctTotal.toFixed(0)}%</span>
                        </div>
                        <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#F5B731] rounded-full"
                            style={{ width: `${Math.min(pctTotal, 100)}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs font-medium text-gray-700 w-16 text-right shrink-0">
                        {l.coste.toFixed(3)} €
                      </span>
                    </div>
                  )
                })}
              {lineas.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-2">Sin ingredientes</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

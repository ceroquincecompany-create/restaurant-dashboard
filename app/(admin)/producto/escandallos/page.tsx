'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { RefreshCw, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react'

type Producto = {
  id: number
  nombre: string
  familia: string | null
  pvp_sala: number | null
  pvp_delivery: number | null
  activo: boolean
}

type CostePorProducto = Record<number, number>

function semaforo(pct: number | null) {
  if (pct === null) return { cls: 'bg-gray-100 text-gray-400', label: '—' }
  if (pct < 30) return { cls: 'bg-emerald-100 text-emerald-700', label: pct.toFixed(1) + '%' }
  if (pct <= 38) return { cls: 'bg-amber-100 text-amber-700', label: pct.toFixed(1) + '%' }
  return { cls: 'bg-rose-100 text-rose-700', label: pct.toFixed(1) + '%' }
}

function eur(n: number | null) {
  if (n === null) return '—'
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

export default function PaginaProductoEscandallos() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [costes, setCostes] = useState<CostePorProducto>({})
  const [loading, setLoading] = useState(true)
  const [familiaFiltro, setFamiliaFiltro] = useState('Todas')

  useEffect(() => {
    async function fetchData() {
      const [{ data: prods }, { data: recs }] = await Promise.all([
        supabase.from('productos').select('*').eq('activo', true).order('familia').order('nombre'),
        supabase.from('recetas').select('producto_id, coste'),
      ])

      setProductos(prods ?? [])

      // Agrupar costes por producto
      const map: CostePorProducto = {}
      ;(recs ?? []).forEach((r) => {
        map[r.producto_id] = (map[r.producto_id] ?? 0) + (r.coste ?? 0)
      })
      setCostes(map)
      setLoading(false)
    }
    fetchData()
  }, [])

  const familias = useMemo(
    () => ['Todas', ...Array.from(new Set(productos.map((p) => p.familia ?? 'Sin familia'))).sort()],
    [productos]
  )

  const filtrados = useMemo(
    () =>
      familiaFiltro === 'Todas'
        ? productos
        : productos.filter((p) => (p.familia ?? 'Sin familia') === familiaFiltro),
    [productos, familiaFiltro]
  )

  const stats = useMemo(() => {
    const con = filtrados.filter((p) => p.pvp_sala)
    const fcPcts = con.map((p) => {
      const pvpSinIva = (p.pvp_sala ?? 0) / 1.1
      return pvpSinIva > 0 ? ((costes[p.id] ?? 0) / pvpSinIva) * 100 : 0
    })
    return {
      verde: fcPcts.filter((x) => x < 30).length,
      amarillo: fcPcts.filter((x) => x >= 30 && x <= 38).length,
      rojo: fcPcts.filter((x) => x > 38).length,
    }
  }, [filtrados, costes])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="animate-spin text-[#F5B731]" size={24} />
      </div>
    )
  }

  if (productos.length === 0) {
    return (
      <div className="p-6 max-w-4xl">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Escandallos de Producto</h1>
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
          Sin productos. Ejecuta{' '}
          <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
            node importar-recetas.js
          </code>{' '}
          para importar el Excel.
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Escandallos de Producto</h1>
        <p className="text-sm text-gray-400 mt-0.5">Food cost por producto con semáforo de rentabilidad</p>
      </div>

      {/* KPI semáforos */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
          <p className="text-xs text-emerald-600 font-medium mb-1">Food Cost &lt; 30%</p>
          <p className="text-2xl font-bold text-emerald-700">{stats.verde}</p>
          <p className="text-xs text-emerald-500 mt-0.5">productos óptimos</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
          <p className="text-xs text-amber-600 font-medium mb-1">Food Cost 30–38%</p>
          <p className="text-2xl font-bold text-amber-700">{stats.amarillo}</p>
          <p className="text-xs text-amber-500 mt-0.5">productos a vigilar</p>
        </div>
        <div className="bg-rose-50 border border-rose-100 rounded-xl p-4">
          <p className="text-xs text-rose-600 font-medium mb-1">Food Cost &gt; 38%</p>
          <p className="text-2xl font-bold text-rose-700">{stats.rojo}</p>
          <p className="text-xs text-rose-500 mt-0.5">productos a revisar</p>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">{filtrados.length} productos</h3>
          <div className="relative">
            <select
              value={familiaFiltro}
              onChange={(e) => setFamiliaFiltro(e.target.value)}
              className="appearance-none pl-3 pr-8 py-1.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F5B731]"
            >
              {familias.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="text-left px-5 py-3 font-medium">Familia</th>
                <th className="text-left px-4 py-3 font-medium">Producto</th>
                <th className="text-right px-4 py-3 font-medium">Coste receta</th>
                <th className="text-right px-4 py-3 font-medium">PVP Sala</th>
                <th className="text-right px-4 py-3 font-medium">PVP Delivery</th>
                <th className="text-right px-4 py-3 font-medium">PVP s/IVA</th>
                <th className="text-center px-4 py-3 font-medium">Food Cost %</th>
                <th className="text-right px-4 py-3 font-medium">Margen sala</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtrados.map((p) => {
                const costeTotal = costes[p.id] ?? 0
                const pvpSinIva = p.pvp_sala ? p.pvp_sala / 1.1 : null
                const foodCost = pvpSinIva && pvpSinIva > 0 ? (costeTotal / pvpSinIva) * 100 : null
                const margen = pvpSinIva !== null ? pvpSinIva - costeTotal : null
                const s = semaforo(foodCost)

                return (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-gray-400 text-xs">{p.familia ?? '—'}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{p.nombre}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{eur(costeTotal)}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-800">{eur(p.pvp_sala)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{eur(p.pvp_delivery)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{eur(pvpSinIva)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${s.cls}`}>
                        {foodCost !== null && foodCost > 38 && <AlertTriangle size={10} />}
                        {s.label}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${margen !== null && margen < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {eur(margen)}
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/producto/escandallos/${p.id}`}
                        className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-[#F5B731] transition-colors font-medium"
                      >
                        <ChevronRight size={14} />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

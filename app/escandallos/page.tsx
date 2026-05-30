'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { RefreshCw, ChevronDown } from 'lucide-react'

type EscandalloDB = {
  id: number
  familia: string | null
  producto: string
  coste: number | null
  pvp_sin_iva: number | null
  pvp_actual: number | null
  margen_euros: number | null
  margen_pct: number | null
  coste_pct: number | null
  unidades_vendidas: number | null
}

function semaforo(coste_pct: number | null): { color: string; label: string } {
  if (coste_pct === null) return { color: 'bg-gray-100 text-gray-500', label: '—' }
  if (coste_pct < 30) return { color: 'bg-emerald-100 text-emerald-700', label: `${coste_pct.toFixed(1)}%` }
  if (coste_pct <= 38) return { color: 'bg-amber-100 text-amber-700', label: `${coste_pct.toFixed(1)}%` }
  return { color: 'bg-rose-100 text-rose-700', label: `${coste_pct.toFixed(1)}%` }
}

function fmt(n: number | null, decimals = 2) {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + '€'
}

export default function PaginaEscandallos() {
  const [filas, setFilas] = useState<EscandalloDB[]>([])
  const [loading, setLoading] = useState(true)
  const [familiaFiltro, setFamiliaFiltro] = useState<string>('Todas')

  useEffect(() => {
    async function fetchData() {
      const { data } = await supabase
        .from('escandallos_resumen')
        .select('*')
        .order('familia', { ascending: true })
        .order('producto', { ascending: true })

      setFilas(data || [])
      setLoading(false)
    }
    fetchData()
  }, [])

  const familias = useMemo(() => {
    const set = new Set(filas.map((f) => f.familia ?? 'Sin familia'))
    return ['Todas', ...Array.from(set).sort()]
  }, [filas])

  const filasFiltradas = useMemo(() => {
    if (familiaFiltro === 'Todas') return filas
    return filas.filter((f) => (f.familia ?? 'Sin familia') === familiaFiltro)
  }, [filas, familiaFiltro])

  const totales = useMemo(() => {
    const con = filasFiltradas.filter((f) => f.coste_pct !== null)
    const verde = con.filter((f) => (f.coste_pct ?? 0) < 30).length
    const amarillo = con.filter((f) => (f.coste_pct ?? 0) >= 30 && (f.coste_pct ?? 0) <= 38).length
    const rojo = con.filter((f) => (f.coste_pct ?? 0) > 38).length
    return { verde, amarillo, rojo }
  }, [filasFiltradas])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="animate-spin text-indigo-500" size={24} />
      </div>
    )
  }

  if (filas.length === 0) {
    return (
      <div className="p-6 max-w-4xl">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Escandallos</h1>
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
          No hay datos. Ejecuta <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">node importar-escandallos.js</code> para importar el Excel.
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Escandallos</h1>
        <p className="text-sm text-gray-400 mt-0.5">Costes y márgenes por producto</p>
      </div>

      {/* KPIs semáforo */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
          <p className="text-xs text-emerald-600 font-medium mb-1">Coste &lt; 30% — Óptimo</p>
          <p className="text-2xl font-bold text-emerald-700">{totales.verde}</p>
          <p className="text-xs text-emerald-500 mt-0.5">productos</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
          <p className="text-xs text-amber-600 font-medium mb-1">Coste 30–38% — Atención</p>
          <p className="text-2xl font-bold text-amber-700">{totales.amarillo}</p>
          <p className="text-xs text-amber-500 mt-0.5">productos</p>
        </div>
        <div className="bg-rose-50 border border-rose-100 rounded-xl p-4">
          <p className="text-xs text-rose-600 font-medium mb-1">Coste &gt; 38% — Revisar</p>
          <p className="text-2xl font-bold text-rose-700">{totales.rojo}</p>
          <p className="text-xs text-rose-500 mt-0.5">productos</p>
        </div>
      </div>

      {/* Filtro por familia */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold text-gray-700">
            {filasFiltradas.length} producto{filasFiltradas.length !== 1 ? 's' : ''}
          </h3>
          <div className="relative">
            <select
              value={familiaFiltro}
              onChange={(e) => setFamiliaFiltro(e.target.value)}
              className="appearance-none pl-3 pr-8 py-1.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              {familias.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="text-left px-5 py-3 font-medium">Familia</th>
                <th className="text-left px-4 py-3 font-medium">Producto</th>
                <th className="text-right px-4 py-3 font-medium">Coste</th>
                <th className="text-right px-4 py-3 font-medium">PVP sin IVA</th>
                <th className="text-right px-4 py-3 font-medium">PVP Actual</th>
                <th className="text-right px-4 py-3 font-medium">Margen €</th>
                <th className="text-right px-4 py-3 font-medium">Margen %</th>
                <th className="text-center px-4 py-3 font-medium">Coste %</th>
                <th className="text-right px-4 py-3 font-medium">Uds. vendidas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filasFiltradas.map((f) => {
                const s = semaforo(f.coste_pct)
                return (
                  <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-gray-500 text-xs">{f.familia ?? '—'}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{f.producto}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmt(f.coste)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmt(f.pvp_sin_iva)}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-800">{fmt(f.pvp_actual)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmt(f.margen_euros)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {f.margen_pct !== null ? `${f.margen_pct.toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${s.color}`}>
                        {s.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {f.unidades_vendidas?.toLocaleString('es-ES') ?? '—'}
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

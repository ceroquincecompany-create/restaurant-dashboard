'use client'

import { useLocales, useVentasTodos30Dias } from '@/lib/hooks'
import { type Venta } from '@/lib/supabase'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { RefreshCw } from 'lucide-react'

export default function PaginaInformes() {
  const { locales, loading: loadLocales } = useLocales()
  const { ventas, loading: loadVentas } = useVentasTodos30Dias()

  if (loadLocales || loadVentas) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="animate-spin text-[#F5B731]" size={24} />
      </div>
    )
  }

  // Agrupar por semana para el gráfico de barras comparativo
  const semanas: Record<string, Record<number, number>> = {}
  ventas.forEach((v: Venta) => {
    const d = new Date(v.fecha + 'T00:00:00')
    const semana = `S${Math.ceil(d.getDate() / 7)} ${d.toLocaleDateString('es-ES', { month: 'short' })}`
    if (!semanas[semana]) semanas[semana] = {}
    semanas[semana][v.local_id] = (semanas[semana][v.local_id] ?? 0) + v.total_ventas
  })

  const dataComparativo = Object.entries(semanas).map(([semana, porLocal]) => ({
    semana,
    ...Object.fromEntries(locales.map((l) => [l.nombre, Math.round(porLocal[l.id] ?? 0)])),
  }))

  // Totales por local (30 días)
  const totalesPorLocal = locales.map((l) => {
    const ventasLocal = ventas.filter((v) => v.local_id === l.id)
    const totalVentas = ventasLocal.reduce((s, v) => s + v.total_ventas, 0)
    const totalFood = ventasLocal.reduce((s, v) => s + v.coste_alimentos, 0)
    const totalPersonal = ventasLocal.reduce((s, v) => s + v.coste_personal, 0)
    const totalClientes = ventasLocal.reduce((s, v) => s + v.num_clientes, 0)
    return {
      local: l,
      totalVentas,
      foodPct: totalVentas > 0 ? (totalFood / totalVentas) * 100 : 0,
      personalPct: totalVentas > 0 ? (totalPersonal / totalVentas) * 100 : 0,
      totalClientes,
      ticket: totalClientes > 0 ? totalVentas / totalClientes : 0,
    }
  })

  const coloresLocales = ['#6366f1', '#f43f5e', '#f59e0b']

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Informes</h1>
        <p className="text-sm text-gray-400 mt-0.5">Análisis comparativo de los últimos 30 días</p>
      </div>

      {/* Tabla resumen 30 días */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Resumen 30 días por local</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="text-left px-5 py-3 font-medium">Local</th>
                <th className="text-right px-4 py-3 font-medium">Total ventas</th>
                <th className="text-right px-4 py-3 font-medium">Promedio/día</th>
                <th className="text-right px-4 py-3 font-medium">Food Cost %</th>
                <th className="text-right px-4 py-3 font-medium">Personal %</th>
                <th className="text-right px-4 py-3 font-medium">Total clientes</th>
                <th className="text-right px-4 py-3 font-medium">Ticket medio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {totalesPorLocal.map(({ local, totalVentas, foodPct, personalPct, totalClientes, ticket }) => (
                <tr key={local.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3.5 font-medium text-gray-800">{local.nombre}</td>
                  <td className="px-4 py-3.5 text-right font-semibold">
                    {totalVentas.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€
                  </td>
                  <td className="px-4 py-3.5 text-right text-gray-600">
                    {(totalVentas / 30).toLocaleString('es-ES', { minimumFractionDigits: 2 })}€
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className={`font-medium ${foodPct > 35 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {foodPct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className={`font-medium ${personalPct > 30 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {personalPct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right text-gray-600">{totalClientes.toLocaleString()}</td>
                  <td className="px-4 py-3.5 text-right text-gray-600">{ticket.toFixed(2)}€</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gráfico comparativo de ventas por semana */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Ventas por semana — comparativa de locales</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={dataComparativo} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="semana" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}€`} />
            <Tooltip
              formatter={(value, name) => [`${Number(value).toLocaleString('es-ES')}€`, String(name)]}
              contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {locales.map((l, i) => (
              <Bar key={l.id} dataKey={l.nombre} fill={coloresLocales[i]} radius={[3, 3, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Gráfico food cost comparativo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {totalesPorLocal.map(({ local, foodPct, personalPct }) => (
          <div key={local.id} className="bg-white rounded-xl border border-gray-200 p-5">
            <h4 className="text-sm font-semibold text-gray-700 mb-4">{local.nombre}</h4>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Food Cost %</span>
                  <span className={foodPct > 35 ? 'text-rose-600 font-semibold' : 'text-emerald-600 font-semibold'}>
                    {foodPct.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${foodPct > 35 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(foodPct, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-0.5">Objetivo: 35%</p>
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Personal %</span>
                  <span className={personalPct > 30 ? 'text-rose-600 font-semibold' : 'text-emerald-600 font-semibold'}>
                    {personalPct.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${personalPct > 30 ? 'bg-rose-500' : 'bg-violet-500'}`}
                    style={{ width: `${Math.min(personalPct, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-0.5">Objetivo: 30%</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

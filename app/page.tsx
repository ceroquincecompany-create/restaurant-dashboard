'use client'

import { useLocales, useVentasHoy, useVentasTodos30Dias } from '@/lib/hooks'
import KPICard from '@/components/KPICard'
import GraficoVentas from '@/components/GraficoVentas'
import GraficoCostes from '@/components/GraficoCostes'
import FormularioVenta from '@/components/FormularioVenta'
import TablaResumen from '@/components/TablaResumen'
import { Euro, Percent, Users, TrendingUp, RefreshCw } from 'lucide-react'
import { useState, useCallback } from 'react'

function useDashboardData() {
  const [refetchKey, setRefetchKey] = useState(0)
  const refetch = useCallback(() => setRefetchKey((k) => k + 1), [])
  return { refetchKey, refetch }
}

export default function Dashboard() {
  const { locales, loading: loadLocales } = useLocales()
  const { refetchKey, refetch } = useDashboardData()

  const local1 = locales[0]
  const local2 = locales[1]
  const local3 = locales[2]

  const { venta: v1 } = useVentasHoy(local1?.id)
  const { venta: v2 } = useVentasHoy(local2?.id)
  const { venta: v3 } = useVentasHoy(local3?.id)

  const { ventas: ventas30 } = useVentasTodos30Dias()

  const ventasHoy = [v1, v2, v3]

  // Totales del día (suma de todos los locales)
  const totalVentas = ventasHoy.reduce((s, v) => s + (v?.total_ventas ?? 0), 0)
  const totalAlimentos = ventasHoy.reduce((s, v) => s + (v?.coste_alimentos ?? 0), 0)
  const totalPersonal = ventasHoy.reduce((s, v) => s + (v?.coste_personal ?? 0), 0)
  const totalClientes = ventasHoy.reduce((s, v) => s + (v?.num_clientes ?? 0), 0)

  const foodCostPct = totalVentas > 0 ? (totalAlimentos / totalVentas) * 100 : 0
  const personalPct = totalVentas > 0 ? (totalPersonal / totalVentas) * 100 : 0
  const primerCostePct = totalVentas > 0 ? ((totalAlimentos + totalPersonal) / totalVentas) * 100 : 0

  const hoy = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  if (loadLocales) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="animate-spin mx-auto text-indigo-500 mb-2" size={24} />
          <p className="text-sm text-gray-500">Cargando dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard General</h1>
          <p className="text-sm text-gray-400 capitalize mt-0.5">{hoy}</p>
        </div>
        <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-3 py-1 font-medium">
          {locales.length} locales activos
        </span>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard
          titulo="Ventas del día"
          valor={totalVentas > 0 ? `${totalVentas.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€` : '—'}
          subtitulo="Suma todos los locales"
          icono={Euro}
          color="azul"
        />
        <KPICard
          titulo="Food Cost %"
          valor={totalVentas > 0 ? `${foodCostPct.toFixed(1)}%` : '—'}
          subtitulo={foodCostPct > 35 ? '⚠ Por encima del objetivo (35%)' : '✓ Dentro del objetivo'}
          icono={Percent}
          color={foodCostPct > 35 ? 'rojo' : 'verde'}
        />
        <KPICard
          titulo="Coste Personal %"
          valor={totalVentas > 0 ? `${personalPct.toFixed(1)}%` : '—'}
          subtitulo={personalPct > 30 ? '⚠ Por encima del objetivo (30%)' : '✓ Dentro del objetivo'}
          icono={Users}
          color={personalPct > 30 ? 'rojo' : 'verde'}
        />
        <KPICard
          titulo="Primer Coste %"
          valor={totalVentas > 0 ? `${primerCostePct.toFixed(1)}%` : '—'}
          subtitulo="Food + Personal"
          icono={TrendingUp}
          color={primerCostePct > 65 ? 'rojo' : primerCostePct > 60 ? 'amarillo' : 'morado'}
        />
      </div>

      {/* Tabla resumen */}
      <div className="mb-6">
        <TablaResumen locales={locales} ventasHoy={ventasHoy} />
      </div>

      {/* Gráficos + Formulario */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 space-y-4">
          <GraficoVentas ventas={ventas30} />
          <GraficoCostes ventas={ventas30} />
        </div>
        <div>
          <FormularioVenta locales={locales} onSuccess={refetch} />
        </div>
      </div>
    </div>
  )
}

'use client'

import { useLocales, useVentasHoy } from '@/lib/hooks'
import Link from 'next/link'
import { MapPin, ArrowRight, RefreshCw, Store } from 'lucide-react'

function LocalCard({ local, venta }: { local: { id: number; nombre: string; direccion?: string | null }, venta: { total_ventas: number; coste_alimentos: number; coste_personal: number; num_clientes: number } | null }) {
  const foodPct = venta && venta.total_ventas > 0 ? (venta.coste_alimentos / venta.total_ventas) * 100 : 0
  const persoPct = venta && venta.total_ventas > 0 ? (venta.coste_personal / venta.total_ventas) * 100 : 0

  return (
    <Link href={`/locales/${local.id}`}>
      <div className="bg-white rounded-xl border border-gray-200 p-5 hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer group">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 rounded-lg">
              <Store size={20} className="text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{local.nombre}</h3>
              {local.direccion && (
                <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                  <MapPin size={11} /> {local.direccion}
                </p>
              )}
            </div>
          </div>
          <ArrowRight size={16} className="text-gray-300 group-hover:text-indigo-400 transition-colors mt-1" />
        </div>

        {venta ? (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-blue-700">
                {venta.total_ventas.toLocaleString('es-ES', { minimumFractionDigits: 0 })}€
              </p>
              <p className="text-xs text-blue-500 mt-0.5">Ventas hoy</p>
            </div>
            <div className={`rounded-lg p-3 text-center ${foodPct > 35 ? 'bg-rose-50' : 'bg-emerald-50'}`}>
              <p className={`text-lg font-bold ${foodPct > 35 ? 'text-rose-700' : 'text-emerald-700'}`}>
                {foodPct.toFixed(1)}%
              </p>
              <p className={`text-xs mt-0.5 ${foodPct > 35 ? 'text-rose-500' : 'text-emerald-500'}`}>Food Cost</p>
            </div>
            <div className={`rounded-lg p-3 text-center ${persoPct > 30 ? 'bg-rose-50' : 'bg-emerald-50'}`}>
              <p className={`text-lg font-bold ${persoPct > 30 ? 'text-rose-700' : 'text-emerald-700'}`}>
                {persoPct.toFixed(1)}%
              </p>
              <p className={`text-xs mt-0.5 ${persoPct > 30 ? 'text-rose-500' : 'text-emerald-500'}`}>Personal</p>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg p-4 text-center text-sm text-gray-400">
            Sin datos registrados hoy
          </div>
        )}
      </div>
    </Link>
  )
}

export default function PaginaLocales() {
  const { locales, loading } = useLocales()
  const { venta: v1 } = useVentasHoy(locales[0]?.id)
  const { venta: v2 } = useVentasHoy(locales[1]?.id)
  const { venta: v3 } = useVentasHoy(locales[2]?.id)

  const ventas = [v1, v2, v3]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="animate-spin text-indigo-500" size={24} />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Locales</h1>
        <p className="text-sm text-gray-400 mt-0.5">Selecciona un local para ver su detalle</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {locales.map((local, i) => (
          <LocalCard key={local.id} local={local} venta={ventas[i] ?? null} />
        ))}
      </div>
    </div>
  )
}

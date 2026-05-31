'use client'

import { useEffect, useState } from 'react'
import { supabase, type Local } from '@/lib/supabase'
import { useVentasHoy } from '@/lib/hooks'
import Link from 'next/link'
import { MapPin, ArrowRight, RefreshCw, Store, Clock } from 'lucide-react'
import type { Venta } from '@/lib/supabase'

function LocalCard({ local, venta }: { local: Local; venta: Venta | null }) {
  const foodPct = venta && venta.total_ventas > 0 ? (venta.coste_alimentos / venta.total_ventas) * 100 : 0
  const persoPct = venta && venta.total_ventas > 0 ? (venta.coste_personal / venta.total_ventas) * 100 : 0

  if (!local.activo) {
    return (
      <div className="bg-gray-50 rounded-xl border border-gray-200 border-dashed p-5 opacity-60">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gray-200 rounded-lg">
              <Clock size={20} className="text-gray-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-500">{local.nombre}</h3>
              {local.direccion && (
                <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                  <MapPin size={11} /> {local.direccion}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="bg-gray-100 rounded-lg p-4 text-center text-sm text-gray-400">
          Próximamente disponible
        </div>
      </div>
    )
  }

  return (
    <Link href={`/locales/${local.id}`}>
      <div className="bg-white rounded-xl border border-gray-200 p-5 hover:border-[#F5B731] hover:shadow-sm transition-all cursor-pointer group">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#F5B731]/10 rounded-lg">
              <Store size={20} className="text-[#F5B731]" />
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
          <ArrowRight size={16} className="text-gray-300 group-hover:text-[#F5B731] transition-colors mt-1" />
        </div>

        {venta ? (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#F5B731]/10 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-[#1A1A1A]">
                {venta.total_ventas.toLocaleString('es-ES', { minimumFractionDigits: 0 })}€
              </p>
              <p className="text-xs text-[#1A1A1A]/60 mt-0.5">Ventas hoy</p>
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
  const [locales, setLocales] = useState<Local[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('locales')
      .select('*')
      .order('id')
      .then(({ data }) => {
        setLocales(data ?? [])
        setLoading(false)
      })
  }, [])

  const { venta: v1 } = useVentasHoy(locales.find((l) => l.activo)?.id)
  const activos = locales.filter((l) => l.activo)
  const { venta: v2 } = useVentasHoy(activos[1]?.id)

  const ventasPorId: Record<number, Venta | null> = {}
  if (activos[0]) ventasPorId[activos[0].id] = v1
  if (activos[1]) ventasPorId[activos[1].id] = v2

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="animate-spin text-[#F5B731]" size={24} />
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
        {locales.map((local) => (
          <LocalCard
            key={local.id}
            local={local}
            venta={ventasPorId[local.id] ?? null}
          />
        ))}
      </div>
    </div>
  )
}

'use client'

import { use, useEffect, useState } from 'react'
import { supabase, type Local } from '@/lib/supabase'
import { useVentas30Dias, useVentasHoy } from '@/lib/hooks'
import KPICard from '@/components/KPICard'
import GraficoVentas from '@/components/GraficoVentas'
import GraficoCostes from '@/components/GraficoCostes'
import FormularioVenta from '@/components/FormularioVenta'
import { Euro, Percent, Users, ArrowLeft, RefreshCw } from 'lucide-react'
import Link from 'next/link'

export default function DetalleLocal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const localId = parseInt(id)

  const [local, setLocal] = useState<Local | null>(null)
  const { venta, loading: loadVenta, refetch } = useVentasHoy(localId)
  const { ventas, loading: loadVentas } = useVentas30Dias(localId)

  useEffect(() => {
    supabase.from('locales').select('*').eq('id', localId).single().then(({ data }) => {
      setLocal(data)
    })
  }, [localId])

  const foodPct = venta && venta.total_ventas > 0 ? (venta.coste_alimentos / venta.total_ventas) * 100 : 0
  const persoPct = venta && venta.total_ventas > 0 ? (venta.coste_personal / venta.total_ventas) * 100 : 0
  const ticket = venta && venta.num_clientes > 0 ? venta.total_ventas / venta.num_clientes : 0

  if (loadVentas) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="animate-spin text-indigo-500" size={24} />
      </div>
    )
  }

  const localesMock = local ? [local] : []

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <Link href="/locales" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-3 transition-colors w-fit">
          <ArrowLeft size={15} /> Volver a locales
        </Link>
        <h1 className="text-xl font-bold text-gray-900">{local?.nombre ?? 'Cargando...'}</h1>
        {local?.direccion && <p className="text-sm text-gray-400 mt-0.5">{local.direccion}</p>}
      </div>

      {/* KPIs del local */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard
          titulo="Ventas hoy"
          valor={venta ? `${venta.total_ventas.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€` : '—'}
          subtitulo="Total del día"
          icono={Euro}
          color="azul"
        />
        <KPICard
          titulo="Food Cost %"
          valor={venta ? `${foodPct.toFixed(1)}%` : '—'}
          subtitulo={foodPct > 35 ? '⚠ Objetivo: 35%' : '✓ Objetivo: 35%'}
          icono={Percent}
          color={foodPct > 35 ? 'rojo' : 'verde'}
        />
        <KPICard
          titulo="Personal %"
          valor={venta ? `${persoPct.toFixed(1)}%` : '—'}
          subtitulo={persoPct > 30 ? '⚠ Objetivo: 30%' : '✓ Objetivo: 30%'}
          icono={Users}
          color={persoPct > 30 ? 'rojo' : 'verde'}
        />
        <KPICard
          titulo="Ticket medio"
          valor={ticket > 0 ? `${ticket.toFixed(2)}€` : '—'}
          subtitulo={venta ? `${venta.num_clientes} clientes` : 'Sin datos'}
          icono={Users}
          color="morado"
        />
      </div>

      {/* Gráficos + formulario */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <GraficoVentas ventas={ventas} />
          <GraficoCostes ventas={ventas} />
        </div>
        <div>
          {localesMock.length > 0 && (
            <FormularioVenta locales={localesMock} onSuccess={refetch} />
          )}
        </div>
      </div>
    </div>
  )
}

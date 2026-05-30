'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { type Venta } from '@/lib/supabase'

interface Props {
  ventas: Venta[]
}

export default function GraficoVentas({ ventas }: Props) {
  const data = ventas.map((v) => ({
    fecha: new Date(v.fecha + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
    ventas: v.total_ventas,
    food: ((v.coste_alimentos / v.total_ventas) * 100).toFixed(1),
    personal: ((v.coste_personal / v.total_ventas) * 100).toFixed(1),
  }))

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Ventas últimos 30 días</h3>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradVentas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="fecha" tick={{ fontSize: 11 }} interval={4} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}€`} />
          <Tooltip
            formatter={(value) => [`${Number(value).toLocaleString('es-ES')}€`, 'Ventas']}
            contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 12 }}
          />
          <Area
            type="monotone"
            dataKey="ventas"
            stroke="#6366f1"
            strokeWidth={2}
            fill="url(#gradVentas)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { type Venta } from '@/lib/supabase'

interface Props {
  ventas: Venta[]
}

export default function GraficoCostes({ ventas }: Props) {
  const data = ventas.map((v) => ({
    fecha: new Date(v.fecha + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
    foodCost: v.total_ventas > 0 ? parseFloat(((v.coste_alimentos / v.total_ventas) * 100).toFixed(1)) : 0,
    personalCost: v.total_ventas > 0 ? parseFloat(((v.coste_personal / v.total_ventas) * 100).toFixed(1)) : 0,
  }))

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">% Costes últimos 30 días</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="fecha" tick={{ fontSize: 11 }} interval={4} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[0, 50]} />
          <Tooltip
            formatter={(value, name) => [
              `${value}%`,
              name === 'foodCost' ? 'Food Cost' : 'Personal',
            ]}
            contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 12 }}
          />
          <Legend
            formatter={(value) => (value === 'foodCost' ? 'Food Cost %' : 'Personal %')}
            wrapperStyle={{ fontSize: 12 }}
          />
          <ReferenceLine y={30} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: '30%', fontSize: 10, fill: '#f59e0b' }} />
          <Line type="monotone" dataKey="foodCost" stroke="#f43f5e" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="personalCost" stroke="#8b5cf6" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

'use client'

import { type Local, type Venta } from '@/lib/supabase'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface Props {
  locales: Local[]
  ventasHoy: (Venta | null)[]
}

function pct(coste: number, ventas: number) {
  if (!ventas) return 0
  return (coste / ventas) * 100
}

function Badge({ valor, umbral }: { valor: number; umbral: number }) {
  const ok = valor <= umbral
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
      {ok ? <TrendingDown size={11} /> : <TrendingUp size={11} />}
      {valor.toFixed(1)}%
    </span>
  )
}

export default function TablaResumen({ locales, ventasHoy }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700">Resumen por local — hoy</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="text-left px-5 py-3 font-medium">Local</th>
              <th className="text-right px-4 py-3 font-medium">Ventas</th>
              <th className="text-right px-4 py-3 font-medium">Food Cost %</th>
              <th className="text-right px-4 py-3 font-medium">Personal %</th>
              <th className="text-right px-4 py-3 font-medium">Clientes</th>
              <th className="text-right px-4 py-3 font-medium">Ticket medio</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {locales.map((local, i) => {
              const v = ventasHoy[i]
              const foodPct = v ? pct(v.coste_alimentos, v.total_ventas) : 0
              const persoPct = v ? pct(v.coste_personal, v.total_ventas) : 0
              const ticket = v && v.num_clientes > 0 ? v.total_ventas / v.num_clientes : 0

              return (
                <tr key={local.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-gray-800">{local.nombre}</td>
                  <td className="px-4 py-3.5 text-right font-semibold text-gray-900">
                    {v ? `${v.total_ventas.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€` : '—'}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    {v ? <Badge valor={foodPct} umbral={35} /> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    {v ? <Badge valor={persoPct} umbral={30} /> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-right text-gray-600">
                    {v ? v.num_clientes : '—'}
                  </td>
                  <td className="px-4 py-3.5 text-right text-gray-600">
                    {v && ticket > 0 ? `${ticket.toFixed(2)}€` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

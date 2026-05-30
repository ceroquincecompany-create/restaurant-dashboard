'use client'

import { type LucideIcon } from 'lucide-react'

interface KPICardProps {
  titulo: string
  valor: string
  subtitulo?: string
  icono: LucideIcon
  color: 'verde' | 'amarillo' | 'rojo' | 'azul' | 'morado'
  tendencia?: { valor: number; label: string }
}

const colores = {
  verde: {
    bg: 'bg-emerald-50',
    icono: 'bg-emerald-100 text-emerald-600',
    titulo: 'text-emerald-700',
    borde: 'border-emerald-200',
  },
  amarillo: {
    bg: 'bg-amber-50',
    icono: 'bg-amber-100 text-amber-600',
    titulo: 'text-amber-700',
    borde: 'border-amber-200',
  },
  rojo: {
    bg: 'bg-rose-50',
    icono: 'bg-rose-100 text-rose-600',
    titulo: 'text-rose-700',
    borde: 'border-rose-200',
  },
  azul: {
    bg: 'bg-blue-50',
    icono: 'bg-blue-100 text-blue-600',
    titulo: 'text-blue-700',
    borde: 'border-blue-200',
  },
  morado: {
    bg: 'bg-violet-50',
    icono: 'bg-violet-100 text-violet-600',
    titulo: 'text-violet-700',
    borde: 'border-violet-200',
  },
}

export default function KPICard({ titulo, valor, subtitulo, icono: Icono, color, tendencia }: KPICardProps) {
  const c = colores[color]
  return (
    <div className={`rounded-xl border ${c.borde} ${c.bg} p-5 flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <span className={`text-sm font-medium ${c.titulo}`}>{titulo}</span>
        <span className={`p-2 rounded-lg ${c.icono}`}>
          <Icono size={18} />
        </span>
      </div>
      <div>
        <p className="text-3xl font-bold text-gray-900">{valor}</p>
        {subtitulo && <p className="text-xs text-gray-500 mt-1">{subtitulo}</p>}
      </div>
      {tendencia && (
        <div className="flex items-center gap-1 text-xs">
          <span className={tendencia.valor >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
            {tendencia.valor >= 0 ? '▲' : '▼'} {Math.abs(tendencia.valor)}%
          </span>
          <span className="text-gray-400">{tendencia.label}</span>
        </div>
      )}
    </div>
  )
}

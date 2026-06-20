'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Star, Trophy, Heart, Cake, RefreshCw } from 'lucide-react'
import type { Reconocimiento } from '@/lib/supabase'
type EmpMini = { id: number; nombre: string; activo: boolean; fecha_nacimiento: string | null }

const TIPO_ICONO: Record<string, { icono: React.ElementType; color: string; bg: string }> = {
  'Empleado del mes': { icono: Trophy, color: 'text-amber-500', bg: 'bg-amber-50' },
  'Buen trabajo':     { icono: Star,   color: 'text-blue-500',  bg: 'bg-blue-50'  },
  'Gracias':          { icono: Heart,  color: 'text-rose-500',  bg: 'bg-rose-50'  },
  'Cumpleaños':       { icono: Cake,   color: 'text-pink-500',  bg: 'bg-pink-50'  },
}

function fmtFecha(s: string) {
  return new Date(s).toLocaleDateString('es-ES', { day: '2-digit', month: 'long' })
}

function isBirthdayToday(fechaNac: string | null): boolean {
  if (!fechaNac) return false
  const hoy = new Date()
  const d = new Date(fechaNac + 'T12:00:00')
  return d.getDate() === hoy.getDate() && d.getMonth() === hoy.getMonth()
}

export default function ReconocimientosEmpleado() {
  const [recs, setRecs] = useState<Reconocimiento[]>([])
  const [empleados, setEmpleados] = useState<EmpMini[]>([])
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    const [{ data: r }, { data: e }] = await Promise.all([
      supabase.from('reconocimientos').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('empleados').select('id,nombre,activo,fecha_nacimiento').eq('activo', true),
    ])
    setRecs(r ?? [])
    setEmpleados(e ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const cumpleaneros = empleados.filter(e => isBirthdayToday(e.fecha_nacimiento))

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><RefreshCw className="animate-spin text-[#F5B731]" size={22} /></div>
  }

  return (
    <div className="px-4 py-5 max-w-2xl">
      <div className="flex items-center gap-3 mb-5">
        <Link href="/empleado/comunidad" className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Reconocimientos</h1>
      </div>

      {/* Cumpleaños hoy */}
      {cumpleaneros.length > 0 && (
        <div className="mb-5 bg-pink-50 border border-pink-200 rounded-2xl px-4 py-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">🎂</span>
            <p className="text-base font-bold text-pink-700">¡Hoy es el cumpleaños de!</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {cumpleaneros.map(e => (
              <span key={e.id} className="inline-flex items-center gap-1.5 bg-pink-100 text-pink-700 text-sm font-bold px-3 py-1.5 rounded-full">
                🎉 {e.nombre.split(' ')[0]}
              </span>
            ))}
          </div>
          <p className="text-xs text-pink-500 mt-2">¡Felicítale cuando lo veas!</p>
        </div>
      )}

      {recs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Star size={36} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">No hay reconocimientos publicados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recs.map(r => {
            const emp = empleados.find(e => e.id === r.empleado_id)
            const cfg = TIPO_ICONO[r.tipo] ?? { icono: Star, color: 'text-gray-400', bg: 'bg-gray-50' }
            const Icono = cfg.icono
            return (
              <div key={r.id} className="bg-white rounded-2xl border border-gray-200 p-4">
                <div className="flex items-start gap-3.5">
                  <div className={`w-12 h-12 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icono size={22} className={cfg.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5">{r.tipo}</p>
                    <p className="text-base font-bold text-gray-900">{emp?.nombre ?? '—'}</p>
                    <p className="text-sm text-gray-600 mt-1 leading-snug">{r.motivo}</p>
                    <p className="text-xs text-gray-400 mt-2">{fmtFecha(r.created_at)}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

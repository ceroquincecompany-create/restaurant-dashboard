'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Turno } from '@/lib/supabase'
import { useEmpleadoActual } from '@/lib/useEmpleado'
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const TURNO_STYLE: Record<string, { bg: string; text: string }> = {
  'Mediodía':       { bg: '#F5B731', text: '#1A1A1A' },
  'Noche':          { bg: '#2563EB', text: '#fff' },
  'Medio mediodía': { bg: '#EC4899', text: '#fff' },
  'Vacaciones':     { bg: '#16A34A', text: '#fff' },
  'Baja':           { bg: '#6B7280', text: '#fff' },
}

function inicioSemana(d: Date): Date {
  const dd = new Date(d); dd.setHours(0,0,0,0)
  const dia = dd.getDay()
  dd.setDate(dd.getDate() - (dia === 0 ? 6 : dia - 1))
  return dd
}
function sumarDias(d: Date, n: number): Date { const dd = new Date(d); dd.setDate(dd.getDate() + n); return dd }
function toISO(d: Date): string { return d.toISOString().split('T')[0] }

export default function PaginaHorario() {
  const { empleado, loading: empLoading } = useEmpleadoActual()
  const [semana, setSemana] = useState(() => inicioSemana(new Date()))
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [loading, setLoading] = useState(true)

  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => sumarDias(semana, i)), [semana])

  const cargar = useCallback(async () => {
    if (!empleado) return
    setLoading(true)
    const inicio = toISO(semana)
    const fin = toISO(sumarDias(semana, 6))
    const { data } = await supabase
      .from('turnos')
      .select('*')
      .eq('empleado_id', empleado.id)
      .gte('fecha', inicio)
      .lte('fecha', fin)
    setTurnos(data ?? [])
    setLoading(false)
  }, [empleado, semana])

  useEffect(() => { if (empleado) cargar() }, [empleado, cargar])

  const porDia = useMemo(() => {
    const m: Record<string, Turno[]> = {}
    turnos.forEach((t) => { if (!m[t.fecha]) m[t.fecha] = []; m[t.fecha].push(t) })
    return m
  }, [turnos])

  const tituloSemana = `${semana.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} – ${sumarDias(semana, 6).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`

  if (empLoading) return <div className="flex items-center justify-center min-h-screen"><RefreshCw className="animate-spin text-[#F5B731]" size={24} /></div>

  return (
    <div className="p-6">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Mi Horario</h1>
          <p className="text-sm text-gray-400 mt-0.5">{tituloSemana}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setSemana((d) => sumarDias(d, -7))} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 bg-white transition-colors"><ChevronLeft size={16} /></button>
          <button onClick={() => setSemana(inicioSemana(new Date()))} className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 bg-white transition-colors">Hoy</button>
          <button onClick={() => setSemana((d) => sumarDias(d, 7))} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 bg-white transition-colors"><ChevronRight size={16} /></button>
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {Object.entries(TURNO_STYLE).map(([tipo, s]) => (
          <span key={tipo} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: s.bg }} />
            {tipo}
          </span>
        ))}
      </div>

      {/* Grid semanal */}
      <div className="grid grid-cols-7 gap-3">
        {dias.map((d, i) => {
          const fecha = toISO(d)
          const esHoy = fecha === toISO(new Date())
          const celdaTurnos = porDia[fecha] ?? []
          return (
            <div key={i} className={`bg-white rounded-xl border p-3 min-h-[120px] ${esHoy ? 'border-[#F5B731] ring-2 ring-[#F5B731]/20' : 'border-gray-200'}`}>
              <div className="text-center mb-2">
                <p className={`text-xs font-semibold ${esHoy ? 'text-[#F5B731]' : 'text-gray-400'}`}>{DIAS[i]}</p>
                <p className={`text-base font-bold ${esHoy ? 'text-[#1A1A1A]' : 'text-gray-700'}`}>{d.getDate()}</p>
              </div>
              <div className="space-y-1">
                {loading ? (
                  <div className="h-6 bg-gray-100 rounded animate-pulse" />
                ) : celdaTurnos.length === 0 ? (
                  <p className="text-xs text-gray-300 text-center mt-2">—</p>
                ) : (
                  celdaTurnos.map((t) => {
                    const s = TURNO_STYLE[t.tipo_turno] ?? { bg: '#E5E7EB', text: '#374151' }
                    return (
                      <div key={t.id} className="rounded px-2 py-1 text-center" style={{ backgroundColor: s.bg, color: s.text }}>
                        <p className="text-xs font-bold leading-none">{t.tipo_turno}</p>
                        {t.hora_inicio && (
                          <p className="text-[10px] opacity-80 mt-0.5">{t.hora_inicio.slice(0,5)}–{t.hora_fin?.slice(0,5)}</p>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>

      {!loading && turnos.length === 0 && (
        <p className="text-center text-sm text-gray-400 mt-6">No tienes turnos asignados esta semana</p>
      )}
    </div>
  )
}

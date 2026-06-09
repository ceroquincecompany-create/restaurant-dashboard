'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Turno } from '@/lib/supabase'
import { useEmpleadoActual } from '@/lib/useEmpleado'
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'

const DIAS_COMPLETO = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const DIAS_CORTO    = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const TURNO_STYLE: Record<string, { bg: string; text: string }> = {
  'Mediodía':       { bg: '#F5B731', text: '#1A1A1A' },
  'Noche':          { bg: '#2563EB', text: '#fff' },
  'Medio mediodía': { bg: '#EC4899', text: '#fff' },
  'Vacaciones':     { bg: '#16A34A', text: '#fff' },
  'Baja':           { bg: '#6B7280', text: '#fff' },
}

function inicioSemana(d: Date): Date {
  const dd = new Date(d); dd.setHours(0, 0, 0, 0)
  const dia = dd.getDay()
  dd.setDate(dd.getDate() - (dia === 0 ? 6 : dia - 1))
  return dd
}
function sumarDias(d: Date, n: number): Date {
  const dd = new Date(d); dd.setDate(dd.getDate() + n); return dd
}
function toISO(d: Date): string { return d.toISOString().split('T')[0] }
function idxSemana(d: Date): number {
  const dia = d.getDay() // 0=Dom
  return dia === 0 ? 6 : dia - 1
}

export default function PaginaHorario() {
  const { empleado, loading: empLoading } = useEmpleadoActual()
  const [vista, setVista] = useState<'dia' | 'semana'>('dia')
  const [diaActual, setDiaActual] = useState<Date>(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d
  })
  const [semana, setSemana] = useState(() => inicioSemana(new Date()))
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [loading, setLoading] = useState(true)

  // En vista DÍA cargamos la semana que contiene diaActual — así navegar días consecutivos
  // dentro de la misma semana no provoca petición extra.
  const { fechaInicio, fechaFin } = useMemo(() => {
    if (vista === 'semana') {
      return { fechaInicio: toISO(semana), fechaFin: toISO(sumarDias(semana, 6)) }
    }
    const lunes = inicioSemana(diaActual)
    return { fechaInicio: toISO(lunes), fechaFin: toISO(sumarDias(lunes, 6)) }
  }, [vista, diaActual, semana])

  const cargar = useCallback(async () => {
    if (!empleado) return
    setLoading(true)
    const { data } = await supabase
      .from('turnos')
      .select('*')
      .eq('empleado_id', empleado.id)
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin)
    setTurnos(data ?? [])
    setLoading(false)
  }, [empleado, fechaInicio, fechaFin])

  useEffect(() => { if (empleado) cargar() }, [empleado, cargar])

  const porDia = useMemo(() => {
    const m: Record<string, Turno[]> = {}
    turnos.forEach(t => { if (!m[t.fecha]) m[t.fecha] = []; m[t.fecha].push(t) })
    return m
  }, [turnos])

  const hoy = toISO(new Date())
  const diasSemana = useMemo(() => Array.from({ length: 7 }, (_, i) => sumarDias(semana, i)), [semana])
  const turnosDia = porDia[toISO(diaActual)] ?? []

  function cambiarVista(v: 'dia' | 'semana') {
    if (v === 'semana') setSemana(inicioSemana(diaActual))
    setVista(v)
  }

  if (empLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <RefreshCw className="animate-spin text-[#F5B731]" size={24} />
    </div>
  )

  return (
    <div className="p-4 md:p-6">

      {/* ── Header con toggle ── */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-gray-900">Mi Horario</h1>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => cambiarVista('dia')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              vista === 'dia' ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Día
          </button>
          <button
            onClick={() => cambiarVista('semana')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              vista === 'semana' ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Semana
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          VISTA DÍA
      ══════════════════════════════════════════ */}
      {vista === 'dia' && (
        <>
          {/* Navegación */}
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={() => setDiaActual(d => sumarDias(d, -1))}
              className="p-3 rounded-xl border border-gray-200 hover:bg-gray-50 bg-white transition-colors active:scale-95"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="text-center">
              <p className="text-lg font-bold text-gray-900 capitalize">
                {DIAS_COMPLETO[idxSemana(diaActual)]}
              </p>
              <p className="text-sm text-gray-400">
                {diaActual.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              {toISO(diaActual) !== hoy && (
                <button
                  onClick={() => { const d = new Date(); d.setHours(0,0,0,0); setDiaActual(d) }}
                  className="mt-1 text-xs font-semibold text-[#F5B731] hover:underline"
                >
                  Volver a hoy
                </button>
              )}
            </div>

            <button
              onClick={() => setDiaActual(d => sumarDias(d, 1))}
              className="p-3 rounded-xl border border-gray-200 hover:bg-gray-50 bg-white transition-colors active:scale-95"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Turnos del día */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
            </div>
          ) : turnosDia.length === 0 ? (
            <div className={`rounded-2xl border p-10 text-center ${
              toISO(diaActual) === hoy ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-gray-200'
            }`}>
              <p className="text-3xl mb-3">{toISO(diaActual) === hoy ? '🎉' : '📅'}</p>
              <p className="text-base font-semibold text-gray-700">
                {toISO(diaActual) === hoy ? '¡Hoy libras!' : 'Sin turnos asignados'}
              </p>
              <p className="text-sm text-gray-400 mt-1">No hay turnos programados para este día</p>
            </div>
          ) : (
            <div className="space-y-3">
              {turnosDia.map(t => {
                const s = TURNO_STYLE[t.tipo_turno] ?? { bg: '#E5E7EB', text: '#374151' }
                return (
                  <div
                    key={t.id}
                    className="rounded-2xl px-6 py-5 flex items-center justify-between shadow-sm"
                    style={{ backgroundColor: s.bg, color: s.text }}
                  >
                    <div>
                      <p className="text-lg font-bold">{t.tipo_turno}</p>
                      {t.hora_inicio && (
                        <p className="text-base font-medium mt-1" style={{ opacity: 0.85 }}>
                          {t.hora_inicio.slice(0, 5)} – {t.hora_fin?.slice(0, 5) ?? '—'}
                        </p>
                      )}
                    </div>
                    {t.notas && (
                      <p className="text-xs max-w-[40%] text-right" style={{ opacity: 0.7 }}>{t.notas}</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════
          VISTA SEMANA
      ══════════════════════════════════════════ */}
      {vista === 'semana' && (
        <>
          {/* Navegación semana */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setSemana(d => sumarDias(d, -7))}
              className="p-3 rounded-xl border border-gray-200 hover:bg-gray-50 bg-white transition-colors active:scale-95"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-700">
                {semana.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                {' – '}
                {sumarDias(semana, 6).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
              {toISO(semana) !== toISO(inicioSemana(new Date())) && (
                <button
                  onClick={() => setSemana(inicioSemana(new Date()))}
                  className="mt-0.5 text-xs font-semibold text-[#F5B731] hover:underline"
                >
                  Esta semana
                </button>
              )}
            </div>
            <button
              onClick={() => setSemana(d => sumarDias(d, 7))}
              className="p-3 rounded-xl border border-gray-200 hover:bg-gray-50 bg-white transition-colors active:scale-95"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Leyenda */}
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            {Object.entries(TURNO_STYLE).map(([tipo, s]) => (
              <span key={tipo} className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: s.bg }} />
                {tipo}
              </span>
            ))}
          </div>

          {/* Grid semanal con scroll horizontal en móvil */}
          <div className="overflow-x-auto -mx-4 md:mx-0 pb-2">
            <div className="flex gap-2 px-4 md:px-0 md:grid md:grid-cols-7">
              {diasSemana.map((d, i) => {
                const fecha = toISO(d)
                const esHoy = fecha === hoy
                const celdaTurnos = porDia[fecha] ?? []
                return (
                  <div
                    key={i}
                    className={`w-[110px] md:w-auto flex-shrink-0 bg-white rounded-xl border p-3 min-h-[120px] ${
                      esHoy ? 'border-[#F5B731] ring-2 ring-[#F5B731]/20' : 'border-gray-200'
                    }`}
                  >
                    <div className="text-center mb-2">
                      <p className={`text-xs font-semibold ${esHoy ? 'text-[#F5B731]' : 'text-gray-400'}`}>
                        {DIAS_CORTO[i]}
                      </p>
                      <p className={`text-lg font-bold leading-tight ${esHoy ? 'text-[#1A1A1A]' : 'text-gray-700'}`}>
                        {d.getDate()}
                      </p>
                    </div>

                    <div className="space-y-1">
                      {loading ? (
                        <div className="h-6 bg-gray-100 rounded animate-pulse" />
                      ) : celdaTurnos.length === 0 ? (
                        <p className="text-xs text-gray-200 text-center mt-2">—</p>
                      ) : (
                        celdaTurnos.map(t => {
                          const s = TURNO_STYLE[t.tipo_turno] ?? { bg: '#E5E7EB', text: '#374151' }
                          return (
                            <div
                              key={t.id}
                              className="rounded-lg px-1.5 py-1 text-center"
                              style={{ backgroundColor: s.bg, color: s.text }}
                            >
                              <p className="text-[10px] font-bold leading-none truncate">{t.tipo_turno}</p>
                              {t.hora_inicio && (
                                <p className="text-[9px] mt-0.5" style={{ opacity: 0.8 }}>
                                  {t.hora_inicio.slice(0, 5)}–{t.hora_fin?.slice(0, 5)}
                                </p>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>

                    {/* Ver día al tocar */}
                    <button
                      className="w-full mt-2 text-[10px] text-gray-300 hover:text-[#F5B731] transition-colors text-center"
                      onClick={() => { setDiaActual(new Date(d)); setVista('dia') }}
                    >
                      ver
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

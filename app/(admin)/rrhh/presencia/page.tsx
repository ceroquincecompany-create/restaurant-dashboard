'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { Turno, Fichaje } from '@/lib/supabase'
import { RefreshCw, CheckCircle2, XCircle, Clock, Users, UserCheck, AlertTriangle } from 'lucide-react'

type EmpSlim = { id: number; nombre: string; puesto: string }

type FilaPresencia = {
  empleado: EmpSlim
  turno: Turno
  fichajeAbierto: Fichaje | null
  fichajesCerrados: Fichaje[]
}

function parseMin(h: string): number {
  const [hh, mm] = h.split(':').map(Number)
  return hh * 60 + mm
}

function esTurnoActivo(turno: Turno, ahoraMin: number): boolean {
  const inicio = turno.hora_inicio ? parseMin(turno.hora_inicio) : null
  const fin    = turno.hora_fin    ? parseMin(turno.hora_fin)    : null
  if (inicio !== null && ahoraMin < inicio) return false  // no ha empezado
  if (fin !== null && ahoraMin > fin + 30)  return false  // terminó hace más de 30 min
  return true
}

function fmtHora(h: string | null) {
  return h ? h.slice(0, 5) : '—'
}

function fmtActualizacion(d: Date) {
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const PALETTE = [
  'bg-blue-100 text-blue-800',
  'bg-emerald-100 text-emerald-800',
  'bg-violet-100 text-violet-800',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-800',
  'bg-cyan-100 text-cyan-800',
]
function avatarColor(id: number) { return PALETTE[id % PALETTE.length] }

export default function PaginaPresencia() {
  const [filas, setFilas] = useState<FilaPresencia[]>([])
  const [sinTurno, setSinTurno] = useState<EmpSlim[]>([])
  const [loading, setLoading] = useState(true)
  const [ultimaActualizacion, setUltimaActualizacion] = useState(new Date())
  const [tick, setTick] = useState(0)

  const cargar = useCallback(async () => {
    const ahora = new Date()
    const today = ahora.toISOString().split('T')[0]
    const ahoraMin = ahora.getHours() * 60 + ahora.getMinutes()

    const [{ data: emps }, { data: turnos }, { data: fichajes }] = await Promise.all([
      supabase.from('empleados').select('id, nombre, puesto').eq('activo', true).order('nombre'),
      supabase.from('turnos').select('*').eq('fecha', today),
      supabase.from('fichajes').select('*').eq('fecha', today),
    ])

    const empLista: EmpSlim[] = (emps ?? []) as EmpSlim[]

    // Index turnos by empleado_id
    const turnosPorEmp = new Map<number, Turno[]>()
    ;(turnos ?? []).forEach((t: Turno) => {
      const arr = turnosPorEmp.get(t.empleado_id) ?? []
      arr.push(t)
      turnosPorEmp.set(t.empleado_id, arr)
    })

    // Index fichajes by empleado_id
    const fichajesPorEmp = new Map<number, Fichaje[]>()
    ;(fichajes ?? []).forEach((f: Fichaje) => {
      const arr = fichajesPorEmp.get(f.empleado_id) ?? []
      arr.push(f)
      fichajesPorEmp.set(f.empleado_id, arr)
    })

    const filasResult: FilaPresencia[] = []
    const sinTurnoResult: EmpSlim[] = []

    empLista.forEach(emp => {
      const turnosEmp = turnosPorEmp.get(emp.id) ?? []
      const turnoActivo = turnosEmp.find(t => esTurnoActivo(t, ahoraMin)) ?? null

      if (!turnoActivo) {
        // Check if they have a fichaje open without active turno
        const fEmp = fichajesPorEmp.get(emp.id) ?? []
        const abierto = fEmp.find(f => f.hora_salida === null) ?? null
        if (abierto) {
          // Working without scheduled shift — show as "sin turno pero fichado"
          sinTurnoResult.push(emp)
        }
        return
      }

      const fichajesEmp = fichajesPorEmp.get(emp.id) ?? []
      const fichajeAbierto = fichajesEmp.find(f => f.hora_salida === null) ?? null
      const fichajesCerrados = fichajesEmp.filter(f => f.hora_salida !== null)

      filasResult.push({ empleado: emp, turno: turnoActivo, fichajeAbierto, fichajesCerrados })
    })

    // Sort: absent first (red), then present (green)
    filasResult.sort((a, b) => {
      const aP = a.fichajeAbierto ? 1 : 0
      const bP = b.fichajeAbierto ? 1 : 0
      return aP - bP
    })

    setFilas(filasResult)
    setSinTurno(sinTurnoResult)
    setUltimaActualizacion(new Date())
    setLoading(false)
  }, [])

  // Initial load + 60s auto-refresh
  useEffect(() => {
    cargar()
    const interval = setInterval(() => { cargar(); setTick(t => t + 1) }, 60000)
    return () => clearInterval(interval)
  }, [cargar])

  const presentes = useMemo(() => filas.filter(f => f.fichajeAbierto !== null), [filas])
  const ausentes  = useMemo(() => filas.filter(f => f.fichajeAbierto === null), [filas])

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <RefreshCw className="animate-spin text-[#F5B731]" size={22} />
    </div>
  )

  return (
    <div className="p-6 max-w-4xl">

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Control de Presencia</h1>
          <p className="text-sm text-gray-400 mt-0.5">Empleados con turno activo ahora mismo</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Actualizado {fmtActualizacion(ultimaActualizacion)}</span>
          <button
            onClick={cargar}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
            title="Actualizar ahora"
          >
            <RefreshCw size={14} className="text-gray-600" />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-3xl font-bold text-gray-900">{filas.length}</p>
          <p className="text-xs text-gray-400 mt-1">Con turno activo</p>
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4 text-center">
          <p className="text-3xl font-bold text-emerald-700">{presentes.length}</p>
          <p className="text-xs text-emerald-500 mt-1">Ficharon entrada</p>
        </div>
        <div className="bg-rose-50 rounded-xl border border-rose-200 p-4 text-center">
          <p className="text-3xl font-bold text-rose-600">{ausentes.length}</p>
          <p className="text-xs text-rose-400 mt-1">Sin fichar</p>
        </div>
      </div>

      {/* Lista principal */}
      {filas.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Users size={36} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm font-semibold text-gray-500">Ningún empleado tiene turno activo ahora mismo</p>
          <p className="text-xs text-gray-400 mt-1">Los turnos se detectan por hora de inicio y fin en la tabla de turnos</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-5">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Turno activo ahora</p>
          </div>
          <div className="divide-y divide-gray-50">
            {filas.map(fila => {
              const presente = fila.fichajeAbierto !== null
              return (
                <div key={fila.empleado.id} className="flex items-center gap-4 px-5 py-4">
                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${avatarColor(fila.empleado.id)}`}>
                    {fila.empleado.nombre.charAt(0).toUpperCase()}
                  </div>

                  {/* Info empleado */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{fila.empleado.nombre}</p>
                    <p className="text-xs text-gray-400">
                      {fila.empleado.puesto}
                      {fila.turno.tipo_turno && ` · ${fila.turno.tipo_turno}`}
                      {fila.turno.hora_inicio && ` · ${fmtHora(fila.turno.hora_inicio)} – ${fmtHora(fila.turno.hora_fin)}`}
                    </p>
                  </div>

                  {/* Fichaje info */}
                  <div className="text-right flex-shrink-0">
                    {presente ? (
                      <div>
                        <p className="text-xs text-emerald-600 font-semibold">
                          Entrada {fmtHora(fila.fichajeAbierto!.hora_entrada)}
                        </p>
                        {fila.fichajesCerrados.length > 0 && (
                          <p className="text-xs text-gray-400">+{fila.fichajesCerrados.length} turno(s) anterior(es)</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-rose-500 font-semibold">No ha fichado</p>
                    )}
                  </div>

                  {/* Estado icono */}
                  <div className="flex-shrink-0">
                    {presente ? (
                      <CheckCircle2 size={22} className="text-emerald-500" />
                    ) : (
                      <XCircle size={22} className="text-rose-500" />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Fichados sin turno */}
      {sinTurno.length > 0 && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-amber-200 flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-600" />
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Fichados sin turno programado</p>
          </div>
          <div className="divide-y divide-amber-100">
            {sinTurno.map(emp => (
              <div key={emp.id} className="flex items-center gap-3 px-5 py-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${avatarColor(emp.id)}`}>
                  {emp.nombre.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{emp.nombre}</p>
                  <p className="text-xs text-gray-500">{emp.puesto}</p>
                </div>
                <div className="ml-auto">
                  <Clock size={16} className="text-amber-500" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Auto-refresh notice */}
      <p className="text-center text-xs text-gray-300 mt-6">
        Actualización automática cada 60 segundos · tick #{tick}
      </p>
    </div>
  )
}

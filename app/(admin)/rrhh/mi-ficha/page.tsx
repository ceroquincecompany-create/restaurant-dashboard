'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Empleado, Local, Fichaje, Sancion } from '@/lib/supabase'
import {
  UserCircle, RefreshCw, Calendar, Clock, CreditCard, Mail,
  FileText, TrendingUp, ShieldAlert,
} from 'lucide-react'

const ESTADO_CFG = {
  activo:     { label: 'Activo',     cls: 'bg-emerald-100 text-emerald-700' },
  baja:       { label: 'Baja',       cls: 'bg-rose-100 text-rose-700' },
  vacaciones: { label: 'Vacaciones', cls: 'bg-amber-100 text-amber-700' },
} as const

const TIPO_SANCION = {
  aviso_verbal:         { label: 'Aviso verbal',          cls: 'bg-amber-100 text-amber-700' },
  amonestacion_escrita: { label: 'Amonestación escrita',  cls: 'bg-orange-100 text-orange-700' },
  sancion_grave:        { label: 'Sanción grave',         cls: 'bg-rose-100 text-rose-700' },
  sancion_muy_grave:    { label: 'Sanción muy grave',     cls: 'bg-red-100 text-red-900' },
} as const

export default function PaginaMiFicha() {
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [locales, setLocales] = useState<Local[]>([])
  const [selId, setSelId] = useState<number | null>(null)
  const [fichajes, setFichajes] = useState<Fichaje[]>([])
  const [sanciones, setSanciones] = useState<Sancion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('empleados').select('*').eq('activo', true).order('nombre'),
      supabase.from('locales').select('*'),
    ]).then(([{ data: emps }, { data: locs }]) => {
      setEmpleados(emps ?? [])
      setLocales(locs ?? [])
      if (emps && emps.length > 0) setSelId(emps[0].id)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!selId) return
    const hoy = new Date()
    const primerDia = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`
    const ultimoDia = hoy.toISOString().split('T')[0]

    Promise.all([
      supabase.from('fichajes').select('*').eq('empleado_id', selId).gte('fecha', primerDia).lte('fecha', ultimoDia).order('fecha', { ascending: false }),
      supabase.from('sanciones').select('*').eq('empleado_id', selId).eq('activo', true).order('fecha', { ascending: false }),
    ]).then(([{ data: fichs }, { data: sancs }]) => {
      setFichajes(fichs ?? [])
      setSanciones(sancs ?? [])
    })
  }, [selId])

  const emp = empleados.find((e) => e.id === selId) ?? null
  const local = locales.find((l) => l.id === emp?.local_id) ?? null

  const costeHora = emp?.salario_bruto
    ? ((emp.salario_bruto * emp.coste_empresa_pct) / (Number(emp.horas_contrato) * 4.33)).toFixed(2)
    : null

  const horasMes = fichajes.reduce((s, f) => s + (f.horas_total ?? 0), 0)
  const extrasMes = fichajes.reduce((s, f) => s + (f.horas_extra ?? 0), 0)
  const nocturnasMes = fichajes.reduce((s, f) => s + (f.horas_nocturnas ?? 0), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="animate-spin text-[#F5B731]" size={24} />
      </div>
    )
  }

  if (empleados.length === 0) {
    return (
      <div className="p-6 max-w-2xl">
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <UserCircle size={40} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">No hay empleados registrados todavía</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Mi Ficha</h1>
        <p className="text-sm text-gray-400 mt-0.5">Consulta tu información laboral</p>
      </div>

      {/* Selector */}
      <div className="mb-5">
        <label className="block text-xs font-medium text-gray-500 mb-1">Selecciona empleado</label>
        <select
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white w-full max-w-xs"
          value={selId ?? ''}
          onChange={(e) => setSelId(Number(e.target.value))}
        >
          {empleados.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
      </div>

      {emp && (
        <div className="space-y-4">
          {/* Cabecera */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-full bg-[#F5B731]/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xl font-bold text-[#1A1A1A]">{emp.nombre.trim().charAt(0).toUpperCase()}</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-lg font-bold text-gray-900">{emp.nombre}</h2>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ESTADO_CFG[emp.estado].cls}`}>
                    {ESTADO_CFG[emp.estado].label}
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  {emp.puesto}{local && <span> · {local.nombre}</span>}
                </p>
              </div>
            </div>
          </div>

          {/* Datos laborales */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Datos laborales</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Clock size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Horas contrato/semana</p>
                  <p className="text-sm font-semibold text-gray-800">{emp.horas_contrato}h</p>
                </div>
              </div>
              {emp.fecha_inicio && (
                <div className="flex items-start gap-3">
                  <Calendar size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">Fecha inicio</p>
                    <p className="text-sm font-semibold text-gray-800">{emp.fecha_inicio}</p>
                  </div>
                </div>
              )}
              {emp.salario_bruto && (
                <div className="flex items-start gap-3">
                  <CreditCard size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">Salario bruto mensual</p>
                    <p className="text-sm font-semibold text-gray-800">{emp.salario_bruto.toLocaleString('es-ES')} €</p>
                  </div>
                </div>
              )}
              {costeHora && (
                <div className="flex items-start gap-3">
                  <TrendingUp size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">Coste/hora estimado</p>
                    <p className="text-sm font-semibold text-gray-800">{costeHora} €/h</p>
                  </div>
                </div>
              )}
              {emp.email_acceso && (
                <div className="flex items-start gap-3 col-span-2">
                  <Mail size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">Email</p>
                    <p className="text-sm font-semibold text-gray-800">{emp.email_acceso}</p>
                  </div>
                </div>
              )}
              {emp.notas && (
                <div className="flex items-start gap-3 col-span-2">
                  <FileText size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">Notas</p>
                    <p className="text-sm text-gray-700">{emp.notas}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Resumen mes actual */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Fichajes este mes ({fichajes.length} registros)
            </h3>
            {fichajes.length === 0 ? (
              <p className="text-sm text-gray-400">Sin fichajes registrados este mes</p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-gray-800">{horasMes.toFixed(1)}h</p>
                  <p className="text-xs text-gray-400 mt-0.5">Total trabajadas</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-amber-700">{extrasMes.toFixed(1)}h</p>
                  <p className="text-xs text-amber-500 mt-0.5">Horas extra</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-blue-700">{nocturnasMes.toFixed(1)}h</p>
                  <p className="text-xs text-blue-500 mt-0.5">Nocturnas</p>
                </div>
              </div>
            )}
          </div>

          {/* Últimas jornadas */}
          {fichajes.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <p className="text-xs font-medium text-gray-500">Últimas jornadas</p>
              </div>
              <div className="divide-y divide-gray-50">
                {fichajes.slice(0, 10).map((f) => (
                  <div key={f.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-700">{f.fecha}</p>
                      <p className="text-xs text-gray-400">
                        {f.hora_entrada?.slice(0, 5) ?? '—'} → {f.hora_salida?.slice(0, 5) ?? '—'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-800">{f.horas_total != null ? `${f.horas_total}h` : '—'}</p>
                      {(f.horas_extra ?? 0) > 0 && (
                        <p className="text-xs text-amber-600">+{f.horas_extra}h extra</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Historial de sanciones */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
              <ShieldAlert size={14} className="text-gray-400" />
              <p className="text-xs font-medium text-gray-500">Historial disciplinario ({sanciones.length})</p>
            </div>
            {sanciones.length === 0 ? (
              <div className="px-5 py-6 text-center">
                <p className="text-sm text-gray-400">Sin sanciones ni avisos registrados</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {sanciones.map((s) => (
                  <div key={s.id} className="px-5 py-3 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TIPO_SANCION[s.tipo].cls}`}>
                          {TIPO_SANCION[s.tipo].label}
                        </span>
                        <span className="text-xs text-gray-400">{s.fecha}</span>
                        {s.firmado && <span className="text-xs text-emerald-600">✓ Firmado</span>}
                      </div>
                      <p className="text-sm text-gray-700 truncate">{s.descripcion}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

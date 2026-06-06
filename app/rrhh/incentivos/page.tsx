'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Empleado, PlanIncentivo, IncentivosEmpleado, Sancion, KPIItem, ClausulaItem } from '@/lib/supabase'
import {
  Trophy, Download, RefreshCw, CheckCircle2, XCircle, AlertCircle,
  Info, Plus, Pencil, Save,
} from 'lucide-react'

// ── Utilidades ──────────────────────────────────────────────

function trimestreRango(q: number, y: number) {
  const mesI = (q - 1) * 3 + 1
  const mesF = q * 3
  const dias = new Date(y, mesF, 0).getDate() - new Date(y, mesI - 1, 1).getDate() +
    Math.round((new Date(y, mesF, 0).getTime() - new Date(y, mesI - 1, 1).getTime()) / 86400000) + 1
  return {
    inicio: `${y}-${String(mesI).padStart(2, '0')}-01`,
    fin: `${y}-${String(mesF).padStart(2, '0')}-${new Date(y, mesF, 0).getDate()}`,
    dias: Math.round((new Date(y, mesF, 0).getTime() - new Date(y, mesI - 1, 1).getTime()) / 86400000) + 1,
  }
}

function cumplKPI(kpi: KPIItem): number {
  if (kpi.valor_real == null) return 0
  if (kpi.tipo === 'menor_igual') return kpi.valor_real <= kpi.objetivo ? 1 : 0
  return Math.min(1, kpi.valor_real / kpi.objetivo)
}

function calcBonoBase(kpis: KPIItem[], importe: number): number {
  return kpis.reduce((s, k) => s + cumplKPI(k) * k.peso * importe, 0)
}

const DEFAULT_CLAUSULAS: ClausulaItem[] = [
  { id: 'ebitda', nombre: 'EBITDA ≥ 90% presupuesto', valor: null },
  { id: 'auditoria', nombre: 'Auditoría interna ≥ 90%', valor: null },
  { id: 'prorrateo', nombre: 'Prorrateo por días efectivos', informativa: true },
  { id: 'confidencialidad', nombre: 'Confidencialidad', informativa: true },
]

const KPI_DEFAULTS: Record<'encargado' | 'staff', KPIItem[]> = {
  encargado: [
    { nombre: 'Reseñas Google',  peso: 0.20, objetivo: 4.3, tipo: 'mayor_igual', unidad: '★', descripcion: 'Nota media Google (mín 30 reseñas/mes)', valor_real: null },
    { nombre: 'Coste Personal',  peso: 0.20, objetivo: 28,  tipo: 'menor_igual', unidad: '%', descripcion: '% coste personal sobre ventas', valor_real: null },
    { nombre: 'Ticket Medio',    peso: 0.30, objetivo: 16,  tipo: 'mayor_igual', unidad: '€', descripcion: 'Ticket medio trimestral', valor_real: null },
    { nombre: 'Coste Producto',  peso: 0.30, objetivo: 30,  tipo: 'menor_igual', unidad: '%', descripcion: '% food cost sobre ventas', valor_real: null },
  ],
  staff: [
    { nombre: 'Reseñas Google',       peso: 0.30, objetivo: 4.3, tipo: 'mayor_igual', unidad: '★',   descripcion: 'Nota media Google (mín 30 reseñas/mes)', valor_real: null },
    { nombre: 'Tiempo Preparación',   peso: 0.20, objetivo: 10,  tipo: 'menor_igual', unidad: 'min', descripcion: 'Tiempo medio de preparación', valor_real: null },
    { nombre: 'Ticket Medio',         peso: 0.30, objetivo: 16,  tipo: 'mayor_igual', unidad: '€',   descripcion: 'Ticket medio trimestral', valor_real: null },
    { nombre: 'Coste Producto',        peso: 0.20, objetivo: 30, tipo: 'menor_igual', unidad: '%',   descripcion: '% food cost sobre ventas', valor_real: null },
  ],
}

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white'
const numCls   = 'w-24 px-2 py-1.5 text-sm text-center border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white'

type Tab = 'encargado' | 'staff'

// ── Componente ───────────────────────────────────────────────

export default function PaginaIncentivos() {
  const [tab, setTab] = useState<Tab>('encargado')
  const [trimestre, setTrimestre] = useState(2)
  const [año, setAño] = useState(2026)

  const [planes, setPlanes] = useState<PlanIncentivo[]>([])
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [asignaciones, setAsignaciones] = useState<IncentivosEmpleado[]>([])
  const [sancionesQ, setSancionesQ] = useState<Sancion[]>([])
  const [ventasQ, setVentasQ] = useState(0)
  const [loading, setLoading] = useState(true)

  // Editable local state for current plan
  const [kpisEdit, setKpisEdit] = useState<KPIItem[]>([])
  const [clausulasEdit, setClausulasEdit] = useState<ClausulaItem[]>([])
  const [guardandoPlan, setGuardandoPlan] = useState(false)
  const [cambiosPendientes, setCambiosPendientes] = useState(false)

  const rango = useMemo(() => trimestreRango(trimestre, año), [trimestre, año])

  const cargar = useCallback(async () => {
    setLoading(true)
    const [{ data: plans }, { data: emps }, { data: asigs }, { data: sancs }, { data: vnts }] = await Promise.all([
      supabase.from('planes_incentivo').select('*').eq('trimestre', trimestre).eq('año', año),
      supabase.from('empleados').select('*').eq('activo', true).order('nombre'),
      supabase.from('incentivos_empleado').select('*').eq('trimestre', trimestre).eq('año', año),
      supabase.from('sanciones').select('*').eq('activo', true).gte('fecha', rango.inicio).lte('fecha', rango.fin),
      supabase.from('ventas').select('total_ventas').gte('fecha', rango.inicio).lte('fecha', rango.fin),
    ])
    setPlanes(plans ?? [])
    setEmpleados(emps ?? [])
    setAsignaciones(asigs ?? [])
    setSancionesQ(sancs ?? [])
    setVentasQ((vnts ?? []).reduce((s, v) => s + (v.total_ventas ?? 0), 0))
    setLoading(false)
  }, [trimestre, año, rango.inicio, rango.fin])

  useEffect(() => { cargar() }, [cargar])

  const planActual = useMemo(() => planes.find((p) => p.tipo === tab) ?? null, [planes, tab])
  const planEncargado = useMemo(() => planes.find((p) => p.tipo === 'encargado') ?? null, [planes])
  const planStaff = useMemo(() => planes.find((p) => p.tipo === 'staff') ?? null, [planes])

  // Sync local editable state when plan/tab changes
  useEffect(() => {
    if (planActual) {
      setKpisEdit(planActual.kpis?.map((k) => ({ ...k })) ?? [])
      setClausulasEdit(planActual.clausulas?.map((c) => ({ ...c })) ?? DEFAULT_CLAUSULAS)
    } else {
      setKpisEdit(KPI_DEFAULTS[tab].map((k) => ({ ...k })))
      setClausulasEdit(DEFAULT_CLAUSULAS.map((c) => ({ ...c })))
    }
    setCambiosPendientes(false)
  }, [planActual, tab])

  // Importe total del plan actual
  const importeTotal = useMemo(() => {
    if (!planActual) return tab === 'encargado' ? 400 : ventasQ * 0.015
    if (planActual.tipo === 'encargado') return planActual.importe_base ?? 400
    return ventasQ * ((planActual.pct_facturacion ?? 1.5) / 100)
  }, [planActual, tab, ventasQ])

  // Bono base con valores editables en pantalla (preview live)
  const bonoPreview = useMemo(() => calcBonoBase(kpisEdit, importeTotal), [kpisEdit, importeTotal])

  // Cumplimiento ponderado
  const cumplPonderado = useMemo(() => {
    if (kpisEdit.length === 0) return 0
    return kpisEdit.reduce((s, k) => s + cumplKPI(k) * k.peso, 0)
  }, [kpisEdit])

  // Clausulas: EBITDA y auditoría son gatillos de plan; amonestaciones es per-empleado
  const clausulaStatus = useMemo(() => {
    const r: Record<string, 'ok' | 'fail' | 'pending' | 'info'> = {}
    clausulasEdit.forEach((c) => {
      if (c.informativa) { r[c.id] = 'info'; return }
      if (c.valor == null) { r[c.id] = 'pending'; return }
      r[c.id] = (c.valor ?? 0) >= 90 ? 'ok' : 'fail'
    })
    return r
  }, [clausulasEdit])

  const planGatillosOK = useMemo(() =>
    ['ebitda', 'auditoria'].every((id) => clausulaStatus[id] !== 'fail'),
    [clausulaStatus]
  )

  // Per-empleado: tiene amonestación escrita este trimestre?
  function empTieneAmonestacion(empId: number) {
    return sancionesQ.some((s) => s.empleado_id === empId && s.tipo === 'amonestacion_escrita')
  }

  // Calcular bono de un empleado (basado en SAVED plan, no preview)
  function calcBonoEmp(asig: IncentivosEmpleado): number {
    const plan = planes.find((p) => p.id === asig.plan_id)
    if (!plan) return 0
    const importe = plan.tipo === 'encargado'
      ? (plan.importe_base ?? 400)
      : ventasQ * ((plan.pct_facturacion ?? 1.5) / 100)
    const base = calcBonoBase(plan.kpis ?? [], importe)
    // Gatillos de plan
    const gOK = ['ebitda', 'auditoria'].every((id) => {
      const c = plan.clausulas?.find((c) => c.id === id)
      if (!c) return true
      return c.valor != null && c.valor >= 90
    })
    if (!gOK) return 0
    if (empTieneAmonestacion(asig.empleado_id)) return 0
    if (asig.dias_efectivos && asig.dias_periodo) return base * (asig.dias_efectivos / asig.dias_periodo)
    return base
  }

  // Guardar cambios del plan
  async function guardarPlan() {
    setGuardandoPlan(true)
    if (planActual) {
      await supabase.from('planes_incentivo').update({ kpis: kpisEdit, clausulas: clausulasEdit }).eq('id', planActual.id)
    } else {
      await supabase.from('planes_incentivo').insert({
        nombre: `Plan ${tab === 'encargado' ? 'Encargado' : 'Staff'} Q${trimestre} ${año}`,
        tipo: tab, trimestre, año,
        importe_base: tab === 'encargado' ? 400 : null,
        pct_facturacion: tab === 'staff' ? 1.5 : null,
        kpis: kpisEdit,
        clausulas: clausulasEdit,
      })
    }
    setGuardandoPlan(false)
    setCambiosPendientes(false)
    cargar()
  }

  // Asignación de empleados
  async function setAsignacion(empId: number, planId: number | null) {
    if (!planId) {
      await supabase.from('incentivos_empleado').delete().eq('empleado_id', empId).eq('trimestre', trimestre).eq('año', año)
    } else {
      await supabase.from('incentivos_empleado').upsert(
        { empleado_id: empId, plan_id: planId, trimestre, año, dias_periodo: rango.dias },
        { onConflict: 'empleado_id,trimestre,año' }
      )
    }
    cargar()
  }

  async function updateDias(asigId: number, dias_efectivos: number | null) {
    await supabase.from('incentivos_empleado').update({ dias_efectivos }).eq('id', asigId)
    cargar()
  }

  async function updateEstado(asigId: number, estado: string) {
    await supabase.from('incentivos_empleado').update({ estado }).eq('id', asigId)
    cargar()
  }

  function exportarCSV() {
    const cab = ['Empleado', 'Plan', 'Días efectivos', 'Días período', 'Bono calculado', 'Estado', 'Amonestaciones']
    const filas = empleados.map((emp) => {
      const asig = asignaciones.find((a) => a.empleado_id === emp.id)
      if (!asig) return [emp.nombre, 'Sin plan', '', '', '', '', '']
      const plan = planes.find((p) => p.id === asig.plan_id)
      return [
        emp.nombre,
        plan?.tipo === 'encargado' ? 'Encargado' : 'Staff',
        String(asig.dias_efectivos ?? ''),
        String(asig.dias_periodo ?? rango.dias),
        calcBonoEmp(asig).toFixed(2),
        asig.estado,
        empTieneAmonestacion(emp.id) ? 'Sí' : 'No',
      ]
    })
    const csv = [cab, ...filas].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `incentivos_Q${trimestre}_${año}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="animate-spin text-[#F5B731]" size={24} />
      </div>
    )
  }

  const etiquetaTab = (t: Tab) => {
    const plan = planes.find((p) => p.tipo === t)
    if (!plan) return t === 'encargado' ? 'Plan Encargado' : 'Plan Staff'
    return t === 'encargado'
      ? `Encargado · ${(plan.importe_base ?? 400).toLocaleString('es-ES')}€/trim`
      : `Staff · ${plan.pct_facturacion ?? 1.5}% factur.`
  }

  return (
    <div className="p-6 max-w-5xl">

      {/* Header */}
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Incentivos</h1>
          <p className="text-sm text-gray-400 mt-0.5">Planes de bonificación por objetivos</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white"
            value={trimestre}
            onChange={(e) => setTrimestre(Number(e.target.value))}
          >
            {[1,2,3,4].map((q) => <option key={q} value={q}>Q{q}</option>)}
          </select>
          <select
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white"
            value={año}
            onChange={(e) => setAño(Number(e.target.value))}
          >
            {[2025,2026,2027].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={exportarCSV}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download size={14} />
            Exportar
          </button>
        </div>
      </div>

      {/* Tabs plan */}
      <div className="flex gap-2 mb-5">
        {(['encargado', 'staff'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              tab === t
                ? 'bg-[#1A1A1A] text-white shadow-sm'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            <Trophy size={15} className={tab === t ? 'text-[#F5B731]' : 'text-gray-400'} />
            {etiquetaTab(t)}
          </button>
        ))}
      </div>

      {/* Vigencia */}
      {planActual?.vigencia_inicio && (
        <div className="mb-4 text-xs text-gray-400 flex items-center gap-1.5">
          <Info size={12} />
          Vigencia: {planActual.vigencia_inicio} → {planActual.vigencia_fin ?? rango.fin}
          {' '}·{' '}
          {planActual.vigencia_inicio && planActual.vigencia_fin
            ? Math.round((new Date(planActual.vigencia_fin).getTime() - new Date(planActual.vigencia_inicio).getTime()) / 86400000) + 1
            : rango.dias} días de período
        </div>
      )}

      {/* ── KPIs ── */}
      <div className="bg-white rounded-xl border border-gray-200 mb-4">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">KPIs del Plan</h2>
            <p className="text-xs text-gray-400 mt-0.5">Introduce los valores reales del trimestre</p>
          </div>
          <div className="text-right text-xs text-gray-400">
            <p>Importe total: <span className="font-semibold text-gray-700">
              {tab === 'staff' && ventasQ > 0
                ? `${((planActual?.pct_facturacion ?? 1.5) / 100 * ventasQ).toLocaleString('es-ES', { maximumFractionDigits: 0 })}€`
                : `${(planActual?.importe_base ?? 400).toLocaleString('es-ES')}€`
              }
            </span></p>
            {tab === 'staff' && <p>Ventas trim.: {ventasQ.toLocaleString('es-ES', { maximumFractionDigits: 0 })}€</p>}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 font-medium">Indicador</th>
                <th className="text-center px-3 py-3 font-medium w-14">Peso</th>
                <th className="text-center px-3 py-3 font-medium w-28">Objetivo</th>
                <th className="text-center px-3 py-3 font-medium w-28">Valor real</th>
                <th className="px-5 py-3 font-medium w-48">Cumplimiento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {kpisEdit.map((kpi, i) => {
                const cumpl = cumplKPI(kpi)
                const pct = Math.round(cumpl * 100)
                const barColor = pct >= 100 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-400' : 'bg-rose-500'
                const txtColor = pct >= 100 ? 'text-emerald-700' : pct >= 60 ? 'text-amber-700' : 'text-rose-600'
                return (
                  <tr key={kpi.nombre} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-800">{kpi.nombre}</p>
                      <p className="text-xs text-gray-400">{kpi.descripcion}</p>
                    </td>
                    <td className="px-3 py-3 text-center font-semibold text-gray-700">
                      {Math.round(kpi.peso * 100)}%
                    </td>
                    <td className="px-3 py-3 text-center text-gray-600">
                      {kpi.tipo === 'menor_igual' ? '≤' : '≥'} {kpi.objetivo}{kpi.unidad}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          className={numCls}
                          value={kpi.valor_real ?? ''}
                          placeholder="—"
                          step="0.1"
                          onChange={(e) => {
                            const val = e.target.value === '' ? null : parseFloat(e.target.value)
                            setKpisEdit((ks) => ks.map((k, j) => j === i ? { ...k, valor_real: val } : k))
                            setCambiosPendientes(true)
                          }}
                        />
                        <span className="text-xs text-gray-400">{kpi.unidad}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                        <span className={`text-xs font-bold w-10 text-right ${txtColor}`}>
                          {kpi.valor_real != null ? `${pct}%` : '—'}
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {/* Bono summary */}
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-500">
              Cumplimiento ponderado: <strong className="text-gray-800">{Math.round(cumplPonderado * 100)}%</strong>
            </span>
            <span className="text-gray-400">·</span>
            <span className="text-gray-500">
              Bono estimado: <strong className="text-[#1A1A1A]">{bonoPreview.toLocaleString('es-ES', { maximumFractionDigits: 0 })}€</strong>
            </span>
          </div>
          {cambiosPendientes && (
            <button
              onClick={guardarPlan}
              disabled={guardandoPlan}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#F5B731] text-[#1A1A1A] rounded-lg hover:bg-[#e0a820] transition-colors disabled:opacity-50"
            >
              <Save size={12} />
              {guardandoPlan ? 'Guardando...' : 'Guardar cambios'}
            </button>
          )}
          {!cambiosPendientes && !planActual && (
            <button
              onClick={guardarPlan}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#1A1A1A] text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              <Plus size={12} />
              Crear plan Q{trimestre} {año}
            </button>
          )}
        </div>
      </div>

      {/* ── Cláusulas gatillo ── */}
      <div className="bg-white rounded-xl border border-gray-200 mb-4">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">Cláusulas Gatillo</h2>
          <p className="text-xs text-gray-400 mt-0.5">Si EBITDA o Auditoría no se cumplen, el bono no se activa para nadie</p>
        </div>
        <div className="divide-y divide-gray-50">
          {clausulasEdit.map((c, i) => {
            const status = clausulaStatus[c.id]
            const IconoStatus = status === 'ok' ? CheckCircle2 : status === 'fail' ? XCircle : status === 'info' ? Info : AlertCircle
            const colorStatus = status === 'ok' ? 'text-emerald-500' : status === 'fail' ? 'text-rose-500' : status === 'info' ? 'text-blue-400' : 'text-gray-300'
            return (
              <div key={c.id} className="px-5 py-3.5 flex items-center gap-4">
                <IconoStatus size={16} className={`flex-shrink-0 ${colorStatus}`} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">{c.nombre}</p>
                  {c.informativa && <p className="text-xs text-gray-400">Cláusula informativa</p>}
                  {c.id === 'amonestaciones_info' && <p className="text-xs text-gray-400">Se verifica por empleado en la tabla inferior</p>}
                </div>
                {!c.informativa && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <input
                      type="number"
                      className={numCls}
                      value={c.valor ?? ''}
                      placeholder="% real"
                      min="0" max="200" step="0.1"
                      onChange={(e) => {
                        const val = e.target.value === '' ? null : parseFloat(e.target.value)
                        setClausulasEdit((cs) => cs.map((cc, j) => j === i ? { ...cc, valor: val } : cc))
                        setCambiosPendientes(true)
                      }}
                    />
                    <span className="text-xs text-gray-400">%</span>
                    {status === 'fail' && <span className="text-xs text-rose-600 font-medium">BLOQUEA BONO</span>}
                    {status === 'ok' && <span className="text-xs text-emerald-600">OK</span>}
                    {status === 'pending' && <span className="text-xs text-gray-400">Pendiente</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {/* Estado bono plan */}
        <div className={`mx-5 mb-4 mt-1 rounded-lg px-4 py-2.5 flex items-center gap-2 text-sm font-medium ${
          planGatillosOK ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
        }`}>
          {planGatillosOK
            ? <><CheckCircle2 size={15} /> Gatillos de plan OK — el bono puede activarse</>
            : <><XCircle size={15} /> Gatillo no cumplido — bono bloqueado para todos</>
          }
        </div>
      </div>

      {/* Aviso amonestaciones */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-5 flex items-center gap-2 text-xs text-amber-700">
        <Info size={13} />
        La cláusula de <strong>sin amonestaciones escritas</strong> se comprueba individualmente por empleado en la tabla inferior.
      </div>

      {/* ── Empleados ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Empleados</h2>
            <p className="text-xs text-gray-400 mt-0.5">Asigna plan, introduce días efectivos y gestiona el estado del bono</p>
          </div>
          <span className="text-xs text-gray-400">{empleados.length} empleados</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 font-medium">Empleado</th>
                <th className="text-center px-3 py-3 font-medium">Plan asignado</th>
                <th className="text-center px-3 py-3 font-medium">Días ef. / período</th>
                <th className="text-center px-3 py-3 font-medium">Amones.</th>
                <th className="text-right px-4 py-3 font-medium">Bono calc.</th>
                <th className="text-center px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {empleados.map((emp) => {
                const asig = asignaciones.find((a) => a.empleado_id === emp.id)
                const planAsig = asig ? planes.find((p) => p.id === asig.plan_id) : null
                const bono = asig ? calcBonoEmp(asig) : null
                const tieneAmonest = empTieneAmonestacion(emp.id)
                const diasPeriodo = planActual?.vigencia_inicio && planActual?.vigencia_fin
                  ? Math.round((new Date(planActual.vigencia_fin).getTime() - new Date(planActual.vigencia_inicio).getTime()) / 86400000) + 1
                  : rango.dias

                return (
                  <tr key={emp.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-800">{emp.nombre}</p>
                      <p className="text-xs text-gray-400">{emp.puesto}</p>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <select
                        className="px-2 py-1 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#F5B731]"
                        value={asig?.plan_id?.toString() ?? ''}
                        onChange={(e) => {
                          const v = e.target.value
                          setAsignacion(emp.id, v ? Number(v) : null)
                        }}
                      >
                        <option value="">Sin plan</option>
                        {planEncargado && <option value={planEncargado.id}>Encargado</option>}
                        {planStaff && <option value={planStaff.id}>Staff</option>}
                      </select>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {asig ? (
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="number"
                            className="w-14 px-2 py-1 text-xs text-center border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#F5B731]"
                            value={asig.dias_efectivos ?? ''}
                            placeholder={String(diasPeriodo)}
                            min="0"
                            max={diasPeriodo}
                            onBlur={(e) => {
                              const v = e.target.value === '' ? null : parseInt(e.target.value)
                              updateDias(asig.id, v)
                            }}
                            onChange={() => {}}
                          />
                          <span className="text-xs text-gray-400">/ {asig.dias_periodo ?? diasPeriodo}</span>
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {tieneAmonest
                        ? <span title="Tiene amonestación escrita este trimestre"><XCircle size={15} className="text-rose-500 mx-auto" /></span>
                        : <span title="Sin amonestaciones escritas"><CheckCircle2 size={15} className="text-emerald-400 mx-auto" /></span>
                      }
                    </td>
                    <td className="px-4 py-3 text-right">
                      {bono !== null ? (
                        <span className={`font-semibold ${bono > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                          {bono > 0 ? `${bono.toLocaleString('es-ES', { maximumFractionDigits: 0 })}€` : '0€'}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {asig ? (
                        <select
                          className={`px-2 py-1 text-xs border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#F5B731] ${
                            asig.estado === 'pagado' ? 'border-emerald-300 text-emerald-700' :
                            asig.estado === 'activado' ? 'border-blue-300 text-blue-700' :
                            'border-gray-200 text-gray-600'
                          }`}
                          value={asig.estado}
                          onChange={(e) => updateEstado(asig.id, e.target.value)}
                        >
                          <option value="pendiente">Pendiente</option>
                          <option value="activado">Activado</option>
                          <option value="pagado">Pagado</option>
                        </select>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {/* Total */}
        {asignaciones.length > 0 && (
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-4 text-sm">
            <span className="text-gray-500">Total bonos calculados:</span>
            <span className="font-bold text-gray-900">
              {asignaciones
                .reduce((s, a) => s + calcBonoEmp(a), 0)
                .toLocaleString('es-ES', { maximumFractionDigits: 0 })}€
            </span>
          </div>
        )}
      </div>

    </div>
  )
}

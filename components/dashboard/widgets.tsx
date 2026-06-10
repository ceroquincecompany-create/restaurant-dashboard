'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { supabaseAuth } from '@/lib/supabase-browser'
import { SECCIONES, MESES } from '@/lib/pl-config'
import {
  RefreshCw, GripVertical, EyeOff,
  TrendingUp, TrendingDown,
  Thermometer, Sparkles, Trash2, Bell, Package, ChevronRight,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
type Local = { id: number; nombre: string }
type FilaPL = { mes: number; partida: string; valor_real: number; valor_presupuesto: number }

// ─────────────────────────────────────────────
// SHARED HELPERS
// ─────────────────────────────────────────────
const MC = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const TAREAS_DIARIAS = ['Utensilios cocina', 'Superficies cocina', 'Superficies horizontales', 'Superficies verticales', 'Baños']

function fmtEur(n: number) {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €'
}
function fmtPct(n: number) { return n.toFixed(1) + '%' }

type Sem = 'ok' | 'warn' | 'bad'
const SEM: Record<Sem, { dot: string; text: string; bg: string; border: string; label: string }> = {
  ok:   { dot: 'bg-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50',  border: 'border-emerald-200', label: 'OK' },
  warn: { dot: 'bg-amber-400',   text: 'text-amber-600',   bg: 'bg-amber-50',    border: 'border-amber-200',   label: 'Atención' },
  bad:  { dot: 'bg-rose-500',    text: 'text-rose-600',    bg: 'bg-rose-50',     border: 'border-rose-200',    label: 'Alerta' },
}
function semC(pct: number, ok: number, warn: number): Sem { return pct <= ok ? 'ok' : pct <= warn ? 'warn' : 'bad' }
function semB(pct: number, ok: number, warn: number): Sem { return pct >= ok ? 'ok' : pct >= warn ? 'warn' : 'bad' }

function calcKPIs(filas: FilaPL[]) {
  const d: Record<string, { real: number; ppto: number }> = {}
  filas.forEach(f => {
    if (!d[f.partida]) d[f.partida] = { real: 0, ppto: 0 }
    d[f.partida].real += f.valor_real ?? 0
    d[f.partida].ppto += f.valor_presupuesto ?? 0
  })
  const g = (k: string, t: 'real' | 'ppto') => d[k]?.[t] ?? 0
  const ss = (secKey: string, t: 'real' | 'ppto') => {
    const sec = SECCIONES.find(x => x.key === secKey)
    return sec ? sec.items.reduce((a, k) => a + g(k, t), 0) : 0
  }
  const calc = (t: 'real' | 'ppto') => {
    const ing = (g('ventas_sala', t) + g('ventas_uber', t)) / 1.1
    const mp = g('proveedores', t) + g('inventario_inicial', t) - g('inventario_final', t) + g('mermas', t)
    const del = ss('delivery', t)
    const mb = ing - mp - del
    const opex = ss('gopex', t) + ss('suministros', t) + ss('mantenimiento', t) + ss('marketing', t)
    const margenOp = mb - opex
    const pers = ss('personal', t)
    const ebitda = margenOp - pers
    return { ing, mp, mb, opex, margenOp, pers, ebitda }
  }
  const r = calc('real'), p = calc('ppto')
  const pct = (v: number, b: number) => b > 0 ? (v / b) * 100 : 0
  return {
    r, p,
    ingR: r.ing, ingP: p.ing,
    costePct: pct(r.mp, r.ing),
    persPct: pct(r.pers, r.ing),
    mbPct: pct(r.mb, r.ing),
    margenOpPct: pct(r.margenOp, r.ing),
    ebitdaPct: pct(r.ebitda, r.ing),
    ebitdaR: r.ebitda, ebitdaP: p.ebitda,
    ebitdaDev: r.ebitda - p.ebitda,
  }
}

function calcPorMes(filas: FilaPL[]) {
  const byM: Record<number, FilaPL[]> = {}
  filas.forEach(f => { (byM[f.mes] = byM[f.mes] ?? []).push(f) })
  return Object.entries(byM)
    .map(([m, rows]) => ({ mes: Number(m), ...calcKPIs(rows) }))
    .sort((a, b) => a.mes - b.mes)
}

// ─────────────────────────────────────────────
// WIDGET SHELL
// ─────────────────────────────────────────────
export type WidgetShellProps = {
  titulo: string
  editMode: boolean
  onHide: () => void
  children: React.ReactNode
  headerRight?: React.ReactNode
  dragHandleProps?: React.HTMLAttributes<HTMLElement>
}

export function WidgetShell({ titulo, editMode, onHide, children, headerRight, dragHandleProps }: WidgetShellProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2">
          {editMode && (
            <span {...dragHandleProps}
              className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-400 touch-none"
            >
              <GripVertical size={16} />
            </span>
          )}
          <h3 className="text-sm font-bold text-gray-800">{titulo}</h3>
        </div>
        <div className="flex items-center gap-2">
          {headerRight}
          {editMode && (
            <button
              onClick={onHide}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-rose-50 hover:text-rose-500 text-gray-300 transition-colors"
              title="Ocultar widget"
            >
              <EyeOff size={13} />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 p-5 overflow-auto">{children}</div>
    </div>
  )
}

// ─────────────────────────────────────────────
// SHARED SELECTOR
// ─────────────────────────────────────────────
function Sel({ value, onChange, children }: { value: string | number; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#F5B731] bg-white"
    >
      {children}
    </select>
  )
}

// ─────────────────────────────────────────────
// WIDGET 1: SALUD FINANCIERA (large)
// ─────────────────────────────────────────────
export function WidgetSaludFinanciera({ editMode, onHide }: { editMode: boolean; onHide: () => void }) {
  const ahora = new Date()
  const [locales, setLocales] = useState<Local[]>([])
  const [localId, setLocalId] = useState<number | null>(null)
  const [año, setAño] = useState(ahora.getFullYear())
  const [mesSel, setMesSel] = useState(ahora.getMonth() + 1)
  const [filas, setFilas] = useState<FilaPL[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('locales').select('id,nombre').eq('activo', true).order('id')
      .then(({ data }) => {
        const ls = (data ?? []) as Local[]
        setLocales(ls)
        if (ls[0]) setLocalId(ls[0].id)
      })
  }, [])

  useEffect(() => {
    if (!localId) return
    setLoading(true)
    supabase.from('pl_datos').select('mes,partida,valor_real,valor_presupuesto')
      .eq('local_id', localId).eq('año', año)
      .then(({ data }) => { setFilas((data ?? []) as FilaPL[]); setLoading(false) })
  }, [localId, año])

  const mesesData = useMemo(() => calcPorMes(filas), [filas])
  const last6 = mesesData.slice(-6)
  const mesDatos = useMemo(
    () => mesesData.find(m => m.mes === mesSel) ?? mesesData[mesesData.length - 1] ?? null,
    [mesesData, mesSel]
  )

  const chartData = last6.map(m => ({
    mes: MC[m.mes],
    'Food Cost': +m.costePct.toFixed(1),
    'Personal': +m.persPct.toFixed(1),
    'EBITDA': +m.ebitdaPct.toFixed(1),
  }))

  const controls = (
    <div className="flex items-center gap-1.5">
      {locales.length > 1 && (
        <Sel value={localId ?? ''} onChange={v => setLocalId(Number(v))}>
          {locales.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
        </Sel>
      )}
      <Sel value={año} onChange={v => setAño(Number(v))}>
        {[2024, 2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
      </Sel>
      <Sel value={mesSel} onChange={v => setMesSel(Number(v))}>
        {MESES.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
      </Sel>
    </div>
  )

  return (
    <WidgetShell titulo="Salud Financiera" editMode={editMode} onHide={onHide} headerRight={controls}>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="animate-spin text-[#F5B731]" size={20} />
        </div>
      ) : !mesDatos ? (
        <p className="text-sm text-gray-400 text-center py-10">Sin datos para {año}</p>
      ) : (
        <div>
          <p className="text-xs font-medium text-gray-400 mb-3">KPIs de {MESES[mesDatos.mes]}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Food Cost %',        val: mesDatos.costePct,    s: semC(mesDatos.costePct, 30, 35) },
              { label: 'Coste Personal %',   val: mesDatos.persPct,     s: semC(mesDatos.persPct, 28, 32) },
              { label: 'Margen Operativo %', val: mesDatos.margenOpPct, s: semB(mesDatos.margenOpPct, 20, 15) },
              { label: 'EBITDA %',           val: mesDatos.ebitdaPct,   s: semB(mesDatos.ebitdaPct, 8, 4) },
            ].map(({ label, val, s }) => {
              const c = SEM[s]
              return (
                <div key={label} className={`rounded-xl border p-4 ${c.bg} ${c.border}`}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
                    <p className="text-xs text-gray-600 leading-tight">{label}</p>
                  </div>
                  <p className={`text-2xl font-bold ${c.text}`}>{fmtPct(val)}</p>
                  <p className={`text-xs mt-0.5 font-semibold ${c.text}`}>{c.label}</p>
                </div>
              )
            })}
          </div>

          {chartData.length > 1 && (
            <div>
              <p className="text-xs text-gray-400 mb-3">Evolución — últimos {last6.length} meses</p>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} unit="%" domain={[0, 'auto']} />
                  <Tooltip formatter={(v) => [`${v}%`]} />
                  <Line type="monotone" dataKey="Food Cost" stroke="#F5B731" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Personal"  stroke="#6366F1" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="EBITDA"    stroke="#10B981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-2 justify-center">
                {[['Food Cost', '#F5B731'], ['Personal', '#6366F1'], ['EBITDA', '#10B981']].map(([lbl, col]) => (
                  <div key={lbl} className="flex items-center gap-1.5">
                    <span className="block w-4 h-0.5 rounded" style={{ backgroundColor: col }} />
                    <span className="text-xs text-gray-400">{lbl}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </WidgetShell>
  )
}

// ─────────────────────────────────────────────
// WIDGET 2: EBITDA
// ─────────────────────────────────────────────
export function WidgetEbitda({ editMode, onHide }: { editMode: boolean; onHide: () => void }) {
  const ahora = new Date()
  const mesActual = ahora.getMonth() + 1
  const añoActual = ahora.getFullYear()

  const [locales, setLocales] = useState<Local[]>([])
  const [localId, setLocalId] = useState<number | null>(null)
  const [filas, setFilas] = useState<FilaPL[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('locales').select('id,nombre').eq('activo', true).order('id')
      .then(({ data }) => {
        const ls = (data ?? []) as Local[]
        setLocales(ls)
        if (ls[0]) setLocalId(ls[0].id)
      })
  }, [])

  useEffect(() => {
    if (!localId) return
    setLoading(true)
    supabase.from('pl_datos').select('mes,partida,valor_real,valor_presupuesto')
      .eq('local_id', localId).eq('año', añoActual)
      .then(({ data }) => { setFilas((data ?? []) as FilaPL[]); setLoading(false) })
  }, [localId, añoActual])

  const mesesData = useMemo(() => calcPorMes(filas), [filas])

  const mesDatos = useMemo(
    () => mesesData.find(m => m.mes === mesActual) ?? mesesData[mesesData.length - 1] ?? null,
    [mesesData, mesActual]
  )

  const ytdR = useMemo(() => {
    const ytdFilas = filas.filter(f => f.mes <= mesActual)
    return ytdFilas.length > 0 ? calcKPIs(ytdFilas) : null
  }, [filas, mesActual])

  const mesLabel = mesDatos ? MESES[mesDatos.mes] : '—'

  return (
    <WidgetShell
      titulo="EBITDA"
      editMode={editMode}
      onHide={onHide}
      headerRight={locales.length > 1
        ? <Sel value={localId ?? ''} onChange={v => setLocalId(Number(v))}>
            {locales.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
          </Sel>
        : undefined
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <RefreshCw className="animate-spin text-[#F5B731]" size={18} />
        </div>
      ) : !mesDatos ? (
        <p className="text-sm text-gray-400 text-center py-8">Sin datos para {añoActual}</p>
      ) : (
        <div className="space-y-4">
          {/* EBITDA mes */}
          <div>
            <p className="text-xs text-gray-400 mb-1.5">EBITDA · {mesLabel}</p>
            <div className="flex items-end justify-between gap-2">
              <span className={`text-3xl font-bold tabular-nums ${semB(mesDatos.ebitdaPct, 8, 4) === 'ok' ? 'text-emerald-600' : semB(mesDatos.ebitdaPct, 8, 4) === 'warn' ? 'text-amber-600' : 'text-rose-600'}`}>
                {fmtPct(mesDatos.ebitdaPct)}
              </span>
              <span className="text-sm text-gray-400 pb-0.5">{fmtEur(mesDatos.ebitdaR)}</span>
            </div>
            {mesDatos.ebitdaP !== 0 && (
              <div className="flex items-center gap-1.5 mt-1.5">
                {mesDatos.ebitdaDev >= 0
                  ? <TrendingUp size={13} className="text-emerald-500 flex-shrink-0" />
                  : <TrendingDown size={13} className="text-rose-500 flex-shrink-0" />
                }
                <span className={`text-xs font-semibold ${mesDatos.ebitdaDev >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {mesDatos.ebitdaDev >= 0 ? '+' : ''}{fmtEur(mesDatos.ebitdaDev)} vs presupuesto
                </span>
              </div>
            )}
          </div>

          <div className="border-t border-gray-100" />

          {/* YTD */}
          {ytdR && ytdR.ingR > 0 && (
            <>
              <div>
                <p className="text-xs text-gray-400 mb-1.5">Acumulado {añoActual}</p>
                <div className="flex items-end justify-between gap-2">
                  <span className={`text-2xl font-bold tabular-nums ${semB(ytdR.ebitdaPct, 8, 4) === 'ok' ? 'text-emerald-600' : semB(ytdR.ebitdaPct, 8, 4) === 'warn' ? 'text-amber-600' : 'text-rose-600'}`}>
                    {fmtPct(ytdR.ebitdaPct)}
                  </span>
                  <span className="text-sm text-gray-400 pb-0.5">{fmtEur(ytdR.ebitdaR)}</span>
                </div>
                {ytdR.ebitdaP !== 0 && (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {ytdR.ebitdaDev >= 0
                      ? <TrendingUp size={13} className="text-emerald-500 flex-shrink-0" />
                      : <TrendingDown size={13} className="text-rose-500 flex-shrink-0" />
                    }
                    <span className={`text-xs font-semibold ${ytdR.ebitdaDev >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {ytdR.ebitdaDev >= 0 ? '+' : ''}{fmtEur(ytdR.ebitdaDev)} vs presupuesto acumulado
                    </span>
                  </div>
                )}
              </div>
              <div className="border-t border-gray-100" />
            </>
          )}

          {/* Quick KPIs */}
          <div className="space-y-2.5">
            {[
              { label: 'Food Cost',        pct: mesDatos.costePct,    s: semC(mesDatos.costePct, 30, 35) },
              { label: 'Personal',         pct: mesDatos.persPct,     s: semC(mesDatos.persPct, 28, 32) },
              { label: 'Margen Operativo', pct: mesDatos.margenOpPct, s: semB(mesDatos.margenOpPct, 20, 15) },
            ].map(({ label, pct, s }) => {
              const c = SEM[s]
              return (
                <div key={label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
                    <span className="text-xs text-gray-600">{label}</span>
                  </div>
                  <span className={`text-sm font-bold ${c.text}`}>{fmtPct(pct)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </WidgetShell>
  )
}

// ─────────────────────────────────────────────
// WIDGET 3: AVISADORES OPERACIONES
// ─────────────────────────────────────────────
export function WidgetOpsAvisadores({ editMode, onHide }: { editMode: boolean; onHide: () => void }) {
  const ahora = new Date()
  const today = ahora.toISOString().split('T')[0]
  const [data, setData] = useState({ limpPend: 0, tempHoy: false, mermasSem: 0, invPend: false, loading: true })

  useEffect(() => {
    async function cargar() {
      const lunesDate = new Date(ahora)
      lunesDate.setDate(ahora.getDate() - ((ahora.getDay() + 6) % 7))
      const lunes = lunesDate.toISOString().split('T')[0]
      const finMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0)
      const diaHoy = ahora.getDate()
      const ultimoDia = finMes.getDate()
      const enUltimos3 = diaHoy >= ultimoDia - 2
      const inicioMes = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-01`

      const [
        { data: limp },
        { count: tempCount },
        { count: mermasCount },
        { count: invCount },
      ] = await Promise.all([
        supabase.from('limpiezas').select('tarea').eq('fecha', today),
        supabase.from('temperaturas').select('id', { count: 'exact', head: true }).eq('fecha', today),
        supabase.from('mermas').select('id', { count: 'exact', head: true }).gte('fecha', lunes).lte('fecha', today),
        enUltimos3
          ? supabase.from('inventario_conteos').select('id', { count: 'exact', head: true })
              .eq('cerrado', true)
              .gte('fecha', inicioMes)
              .lte('fecha', finMes.toISOString().split('T')[0])
          : Promise.resolve({ count: 1, data: null, error: null }),
      ])

      const hechas = new Set((limp ?? []).map((l: any) => l.tarea))
      setData({
        limpPend: TAREAS_DIARIAS.filter(t => !hechas.has(t)).length,
        tempHoy: (tempCount ?? 0) > 0,
        mermasSem: mermasCount ?? 0,
        invPend: enUltimos3 && (invCount ?? 0) === 0,
        loading: false,
      })
    }
    cargar()
  }, [])

  const items = [
    { icon: Sparkles,    label: 'Limpiezas diarias',  val: `${data.limpPend} pendientes`, urgente: data.limpPend > 0, href: '/operaciones/limpiezas' },
    { icon: Thermometer, label: 'Temperatura hoy',     val: data.tempHoy ? 'Registrada ✓' : 'Pendiente', urgente: !data.tempHoy, href: '/operaciones/temperaturas' },
    { icon: Trash2,      label: 'Mermas esta semana',  val: `${data.mermasSem} registros`, urgente: false, href: '/operaciones/mermas' },
    { icon: Package,     label: 'Inventario mensual',  val: data.invPend ? '⚠ Pendiente' : 'Sin urgencia', urgente: data.invPend, href: '/empleado/inventario' },
  ]

  return (
    <WidgetShell titulo="Avisadores Operaciones" editMode={editMode} onHide={onHide}>
      {data.loading ? (
        <div className="flex items-center justify-center py-10">
          <RefreshCw className="animate-spin text-[#F5B731]" size={18} />
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map(({ icon: Icon, label, val, urgente, href }) => (
            <Link key={label} href={href}
              className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 transition-colors group"
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${urgente ? 'bg-rose-100' : 'bg-gray-100'}`}>
                <Icon size={16} className={urgente ? 'text-rose-500' : 'text-gray-400'} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400">{label}</p>
                <p className={`text-sm font-semibold ${urgente ? 'text-rose-600' : 'text-gray-700'}`}>{val}</p>
              </div>
              <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-400 flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </WidgetShell>
  )
}

// ─────────────────────────────────────────────
// WIDGET 4: MERMAS DEL MES
// ─────────────────────────────────────────────
export function WidgetMermasMes({ editMode, onHide }: { editMode: boolean; onHide: () => void }) {
  const ahora = new Date()
  const inicioMes = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-01`
  const hoy = ahora.toISOString().split('T')[0]
  const inicioMesAnt = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1).toISOString().split('T')[0]
  const finMesAnt = new Date(ahora.getFullYear(), ahora.getMonth(), 0).toISOString().split('T')[0]
  const mesNombre = ahora.toLocaleDateString('es-ES', { month: 'long' })

  const [data, setData] = useState({ costeMes: 0, costeMesAnt: 0, top3: [] as { nombre: string; coste: number }[], loading: true })

  useEffect(() => {
    async function cargar() {
      const [{ data: mes }, { data: ant }] = await Promise.all([
        supabaseAuth.from('mermas')
          .select('coste, ingrediente_id, ingredientes(nombre_ingrediente)')
          .gte('fecha', inicioMes).lte('fecha', hoy),
        supabaseAuth.from('mermas').select('coste')
          .gte('fecha', inicioMesAnt).lte('fecha', finMesAnt),
      ])

      const costeMes = (mes ?? []).reduce((s: number, m: any) => s + (m.coste ?? 0), 0)
      const costeMesAnt = (ant ?? []).reduce((s: number, m: any) => s + (m.coste ?? 0), 0)

      const byIng: Record<string, { nombre: string; coste: number }> = {}
      ;(mes ?? []).forEach((m: any) => {
        const key = String(m.ingrediente_id ?? 'x')
        const nombre = (m.ingredientes as any)?.nombre_ingrediente ?? 'Sin especificar'
        byIng[key] = { nombre, coste: (byIng[key]?.coste ?? 0) + (m.coste ?? 0) }
      })
      const top3 = Object.values(byIng).sort((a, b) => b.coste - a.coste).slice(0, 3)

      setData({ costeMes, costeMesAnt, top3, loading: false })
    }
    cargar()
  }, [])

  const diff = data.costeMes - data.costeMesAnt
  const diffPct = data.costeMesAnt > 0 ? (diff / data.costeMesAnt) * 100 : null

  return (
    <WidgetShell titulo="Mermas del Mes" editMode={editMode} onHide={onHide}>
      {data.loading ? (
        <div className="flex items-center justify-center py-10">
          <RefreshCw className="animate-spin text-[#F5B731]" size={18} />
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-xs text-gray-400 mb-1.5">Coste mermas · {mesNombre}</p>
            <p className="text-3xl font-bold text-gray-900">{fmtEur(data.costeMes)}</p>
            {data.costeMesAnt > 0 && diffPct !== null && (
              <div className="flex items-center gap-1.5 mt-1.5">
                {diff <= 0
                  ? <TrendingDown size={13} className="text-emerald-500 flex-shrink-0" />
                  : <TrendingUp size={13} className="text-rose-500 flex-shrink-0" />
                }
                <span className={`text-xs font-semibold ${diff <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {diff >= 0 ? '+' : ''}{fmtEur(diff)} ({diff >= 0 ? '+' : ''}{diffPct.toFixed(1)}%) vs mes anterior
                </span>
              </div>
            )}
          </div>

          {data.top3.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-2">Top 3 ingredientes</p>
              <div className="space-y-2">
                {data.top3.map((ing, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-gray-300 w-4">{i + 1}.</span>
                      <span className="text-sm text-gray-700 truncate">{ing.nombre}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-800 flex-shrink-0">{fmtEur(ing.coste)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.costeMes === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">Sin mermas registradas este mes</p>
          )}
        </div>
      )}
    </WidgetShell>
  )
}

// ─────────────────────────────────────────────
// WIDGET 5: AVISOS ACTIVOS
// ─────────────────────────────────────────────
export function WidgetAvisosActivos({ editMode, onHide }: { editMode: boolean; onHide: () => void }) {
  const today = new Date().toISOString().split('T')[0]
  const [data, setData] = useState({
    total: 0, tempAlertas: 0, limpPend: 0,
    ultimos3: [] as { descripcion: string; empleado_nombre: string; categoria: string }[],
    loading: true,
  })

  useEffect(() => {
    async function cargar() {
      const [
        { count: totalCount },
        { data: tempHoy },
        { data: limp },
        { data: av3 },
      ] = await Promise.all([
        supabase.from('avisos_equipo').select('id', { count: 'exact', head: true }).eq('activo', true),
        supabase.from('temperaturas').select('mesa_fria_1,mesa_fria_2,mesa_fria_3,congelador_4,mesa_fria_5,nevera_6').eq('fecha', today),
        supabase.from('limpiezas').select('tarea').eq('fecha', today),
        supabase.from('avisos_equipo').select('descripcion,empleado_nombre,categoria').eq('activo', true)
          .order('created_at', { ascending: false }).limit(3),
      ])

      let alertas = 0
      ;(tempHoy ?? []).forEach((r: any) => {
        if ((r.mesa_fria_1 ?? 0) > 8)  alertas++
        if ((r.mesa_fria_2 ?? 0) > 8)  alertas++
        if ((r.mesa_fria_3 ?? 0) > 8)  alertas++
        if ((r.congelador_4 ?? -20) > -10) alertas++
        if ((r.mesa_fria_5 ?? 0) > 8)  alertas++
        if ((r.nevera_6 ?? 0) > 8)     alertas++
      })

      const hechas = new Set((limp ?? []).map((l: any) => l.tarea))
      setData({
        total: totalCount ?? 0,
        tempAlertas: alertas,
        limpPend: TAREAS_DIARIAS.filter(t => !hechas.has(t)).length,
        ultimos3: (av3 ?? []) as any[],
        loading: false,
      })
    }
    cargar()
  }, [])

  return (
    <WidgetShell
      titulo="Avisos Activos"
      editMode={editMode}
      onHide={onHide}
      headerRight={
        <Link href="/operaciones/avisos" className="text-xs font-semibold text-[#F5B731] hover:underline">
          Ver todos
        </Link>
      }
    >
      {data.loading ? (
        <div className="flex items-center justify-center py-10">
          <RefreshCw className="animate-spin text-[#F5B731]" size={18} />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: Bell,        label: 'Avisos',      val: data.total,       urgente: data.total > 0 },
              { icon: Thermometer, label: 'Temp. alerta', val: data.tempAlertas, urgente: data.tempAlertas > 0 },
              { icon: Sparkles,    label: 'Limp. pend.',  val: data.limpPend,    urgente: data.limpPend > 0 },
            ].map(({ icon: Icon, label, val, urgente }) => (
              <div key={label} className={`rounded-xl border text-center p-3 ${urgente ? 'bg-rose-50 border-rose-100' : 'bg-gray-50 border-gray-100'}`}>
                <Icon size={13} className={`mx-auto mb-1.5 ${urgente ? 'text-rose-400' : 'text-gray-300'}`} />
                <p className={`text-2xl font-bold ${urgente ? 'text-rose-600' : 'text-gray-300'}`}>{val}</p>
                <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {data.ultimos3.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-2">Últimos avisos del equipo</p>
              <div className="space-y-1.5">
                {data.ultimos3.map((a, i) => (
                  <div key={i} className="flex items-start gap-2 p-2.5 bg-gray-50 rounded-xl">
                    <Bell size={12} className="text-[#F5B731] mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-800 leading-snug line-clamp-2">{a.descripcion}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{a.empleado_nombre} · {a.categoria}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.total === 0 && data.ultimos3.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-2">Sin avisos activos</p>
          )}
        </div>
      )}
    </WidgetShell>
  )
}

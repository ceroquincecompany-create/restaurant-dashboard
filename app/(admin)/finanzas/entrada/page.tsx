'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { supabaseAuth } from '@/lib/supabase-browser'
import { MESES, LABELS } from '@/lib/pl-config'
import {
  Save, RefreshCw, ChevronLeft, ChevronRight, ChevronDown,
  Check, Lock, Unlock, AlertTriangle, Zap, Info,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────
// Partidas por sección (orden del P&L)
// ─────────────────────────────────────────────────────────
const INGRESOS      = ['ventas_sala', 'ventas_uber']           as const
const MP            = ['proveedores', 'inventario_inicial', 'inventario_final', 'mermas'] as const
const DELIVERY      = ['comision_plataforma', 'promociones', 'envio_gratis', 'ads_uber', 'devoluciones'] as const
const GOPEX         = ['alquiler', 'comunidad', 'basura', 'seguro_local', 'extintores', 'desinsectacion', 'alarma', 'otros_gopex'] as const
const SUMINISTROS   = ['luz', 'agua', 'gas', 'telefonia', 'tpv_kds', 'otros_suministros'] as const
const MANTENIMIENTO = ['reparaciones', 'compras_arreglos', 'uniformes', 'menaje_maquinaria', 'otros_mantenimiento'] as const
const MARKETING     = ['foodies', 'carteleria', 'merchandising', 'accion_especial', 'otros_marketing'] as const
const PERSONAL      = ['sueldos', 'seguros_sociales', 'incentivos'] as const
const TODAS_PARTIDAS = [...INGRESOS, ...MP, ...DELIVERY, ...GOPEX, ...SUMINISTROS, ...MANTENIMIENTO, ...MARKETING, ...PERSONAL]
const PARTIDA_CERRADO = '_cerrado'

// ─────────────────────────────────────────────────────────
// Helpers numéricos
// ─────────────────────────────────────────────────────────
type Vals = Record<string, number>

const g = (v: Vals, k: string) => v[k] ?? 0
const sumKeys = (v: Vals, keys: readonly string[]) => keys.reduce((s, k) => s + g(v, k), 0)
const eur = (n: number) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

function calcPL(v: Vals) {
  const ingBruto = g(v, 'ventas_sala') + g(v, 'ventas_uber')
  const ing      = ingBruto / 1.10

  const mp       = g(v, 'proveedores') + g(v, 'inventario_inicial') - g(v, 'inventario_final') + g(v, 'mermas')
  const foodPct  = ing > 0 ? (mp / ing) * 100 : 0

  const delivery = sumKeys(v, DELIVERY)
  const mb       = ing - mp - delivery

  const gopex    = sumKeys(v, GOPEX)
  const sumi     = sumKeys(v, SUMINISTROS)
  const mant     = sumKeys(v, MANTENIMIENTO)
  const mkt      = sumKeys(v, MARKETING)

  const ebitdaLocal = mb - gopex - sumi - mant - mkt

  const personal  = sumKeys(v, PERSONAL)
  const persPct   = ing > 0 ? (personal / ing) * 100 : 0

  const ebitda    = ebitdaLocal - personal
  const ebitdaPct = ing > 0 ? (ebitda / ing) * 100 : 0

  return { ing, ingBruto, mp, foodPct, delivery, mb, gopex, sumi, mant, mkt, ebitdaLocal, personal, persPct, ebitda, ebitdaPct }
}

function semEbitda(pct: number) {
  if (pct >= 8) return { color: 'bg-emerald-100 text-emerald-700', label: 'Bueno' }
  if (pct >= 4) return { color: 'bg-amber-100 text-amber-700',   label: 'Ajustado' }
  return               { color: 'bg-rose-100 text-rose-700',     label: 'Bajo' }
}

// ─────────────────────────────────────────────────────────
// Micro-componentes
// ─────────────────────────────────────────────────────────
type LocalT = { id: number; nombre: string; activo: boolean }

function Sel({ value, onChange, children }: { value: string | number; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="appearance-none pl-3 pr-7 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#F5B731]"
      >{children}</select>
      <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  )
}

function Campo({ partida, vals, onChange, disabled, autoFilled }: {
  partida: string; vals: Vals; onChange: (p: string, v: number) => void; disabled: boolean; autoFilled?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      {autoFilled && (
        <span title="Completado automáticamente" className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 cursor-default select-none">
          AUTO
        </span>
      )}
      <input
        type="number" step="0.01" min="0"
        value={vals[partida] || ''}
        onChange={e => onChange(partida, parseFloat(e.target.value) || 0)}
        disabled={disabled}
        placeholder="0,00"
        className={[
          'w-36 text-right rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5B731] tabular-nums',
          disabled       ? 'bg-gray-50 text-gray-400 border-gray-100 cursor-not-allowed' :
          autoFilled     ? 'border-blue-200 bg-blue-50/30 text-gray-800' :
                           'bg-white border-gray-200 text-gray-800',
        ].join(' ')}
      />
      <span className="text-xs text-gray-400 w-3 flex-shrink-0">€</span>
    </div>
  )
}

function FilaPartida({ partida, vals, onChange, disabled, autoFilled }: {
  partida: string; vals: Vals; onChange: (p: string, v: number) => void; disabled: boolean; autoFilled?: boolean
}) {
  return (
    <div className="flex items-center justify-between px-5 py-2.5 min-h-[52px] border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-700 flex-1 mr-4">{LABELS[partida]}</span>
      <Campo partida={partida} vals={vals} onChange={onChange} disabled={disabled} autoFilled={autoFilled} />
    </div>
  )
}

function FilaTotal({ label, valor, badge, alerta }: { label: string; valor: number; badge?: string; alerta?: boolean }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-t border-gray-200">
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-gray-800">{label}</span>
        {badge && (
          <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${alerta ? 'bg-rose-100 text-rose-700' : 'bg-gray-200 text-gray-600'}`}>
            {badge}
            {alerta && <AlertTriangle size={10} />}
          </span>
        )}
      </div>
      <span className="text-sm font-bold text-gray-900 tabular-nums">{eur(valor)}</span>
    </div>
  )
}

function FilaCalc({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="flex items-center justify-between px-5 py-2 border-t border-gray-100 bg-gray-50/50">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-semibold text-gray-700 tabular-nums">{eur(valor)}</span>
    </div>
  )
}

function SeccionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
        <p className="text-xs font-bold tracking-wider text-gray-600 uppercase">{title}</p>
      </div>
      {children}
    </div>
  )
}

function ResultadoCard({ label, valor, pctStr, sem, nota }: {
  label: string; valor: number; pctStr: string; sem: { color: string; label: string }; nota?: string
}) {
  return (
    <div className={`rounded-xl border-2 px-5 py-4 flex items-center justify-between ${
      valor >= 0 ? 'bg-[#F5B731]/10 border-[#F5B731]/40' : 'bg-rose-50 border-rose-200'
    }`}>
      <div>
        <p className="text-sm font-bold text-gray-800">{label}</p>
        {nota && <p className="text-xs text-gray-400 mt-0.5">{nota}</p>}
      </div>
      <div className="text-right">
        <p className={`text-xl font-black tabular-nums ${valor >= 0 ? 'text-[#1A1A1A]' : 'text-rose-600'}`}>{eur(valor)}</p>
        <div className="flex items-center justify-end gap-2 mt-1">
          <span className="text-xs text-gray-500 tabular-nums">{pctStr} s/ ventas</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sem.color}`}>{sem.label}</span>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────
export default function PaginaEntrada() {
  const ahora = new Date()

  const [locales, setLocales]     = useState<LocalT[]>([])
  const [localId, setLocalId]     = useState<number | null>(null)
  const [mes, setMes]             = useState(ahora.getMonth() + 1)
  const [año, setAño]             = useState(ahora.getFullYear())

  const [vals, setVals]           = useState<Vals>({})
  const [cerrado, setCerrado]     = useState(false)
  const [cargando, setCargando]   = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [cerrando, setCerrando]   = useState(false)
  const [savedAt, setSavedAt]     = useState<Date | null>(null)
  const [isDirty, setIsDirty]     = useState(false)
  const [errCierre, setErrCierre] = useState('')

  // Qué campos fueron auto-completados
  const [autoFields, setAutoFields] = useState<Set<string>>(new Set())

  // Refs para autosave (evitar stale closures)
  const valsRef    = useRef(vals)
  const dirtyRef   = useRef(isDirty)
  const cerradoRef = useRef(cerrado)
  useEffect(() => { valsRef.current = vals },    [vals])
  useEffect(() => { dirtyRef.current = isDirty }, [isDirty])
  useEffect(() => { cerradoRef.current = cerrado }, [cerrado])

  // ── Carga de locales ──────────────────────────
  useEffect(() => {
    supabase.from('locales').select('*').eq('activo', true).order('id').then(({ data }) => {
      const ls = data ?? []
      setLocales(ls)
      if (ls[0]) setLocalId(ls[0].id)
    })
  }, [])

  // ── Carga de datos del P&L ───────────────────
  const cargar = useCallback(async () => {
    if (!localId) return
    setCargando(true)
    setErrCierre('')

    const [{ data: filas }, mermasRes, invPrevRes] = await Promise.all([
      // Datos P&L (incluye _cerrado si existe)
      supabase.from('pl_datos').select('*').eq('local_id', localId).eq('año', año).eq('mes', mes),
      // Mermas del mes (requiere auth por RLS)
      supabaseAuth.from('mermas')
        .select('coste')
        .eq('local_id', localId)
        .gte('fecha', `${año}-${String(mes).padStart(2,'0')}-01`)
        .lte('fecha', `${año}-${String(mes).padStart(2,'0')}-31`),
      // Inventario final del mes anterior
      (function() {
        const prevMes = mes === 1 ? 12 : mes - 1
        const prevAño = mes === 1 ? año - 1 : año
        return supabase.from('pl_datos').select('valor_real')
          .eq('local_id', localId).eq('año', prevAño).eq('mes', prevMes)
          .eq('partida', 'inventario_final').maybeSingle()
      })(),
    ])

    const nuevos: Vals = {}
    const autofilled = new Set<string>()
    let esCerrado = false

    ;(filas ?? []).forEach(f => {
      if (f.partida === PARTIDA_CERRADO) {
        esCerrado = f.valor_real === 1
      } else {
        nuevos[f.partida] = f.valor_real ?? 0
      }
    })

    // Auto-completar mermas si no hay valor ya guardado
    const totalMermas = (mermasRes.data ?? []).reduce((s: number, r: { coste: number | null }) => s + (r.coste ?? 0), 0)
    if (totalMermas > 0 && !nuevos['mermas']) {
      nuevos['mermas'] = Math.round(totalMermas * 100) / 100
      autofilled.add('mermas')
    }

    // Auto-completar inventario_inicial con inventario_final del mes anterior
    const invPrev = invPrevRes.data?.valor_real
    if (invPrev && !nuevos['inventario_inicial']) {
      nuevos['inventario_inicial'] = invPrev
      autofilled.add('inventario_inicial')
    }

    setVals(nuevos)
    setCerrado(esCerrado)
    setAutoFields(autofilled)
    setIsDirty(false)
    setCargando(false)
  }, [localId, mes, año])

  useEffect(() => { if (localId) cargar() }, [localId, mes, año, cargar])

  // ── Autosave cada 30 segundos ─────────────────
  useEffect(() => {
    if (!localId) return
    const interval = setInterval(async () => {
      if (!dirtyRef.current || cerradoRef.current) return
      await guardarCore(valsRef.current, localId, mes, año)
      setSavedAt(new Date())
      setIsDirty(false)
    }, 30000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localId, mes, año])

  // ── Helpers de guardado ──────────────────────
  async function guardarCore(v: Vals, lId: number, m: number, a: number) {
    const rows = TODAS_PARTIDAS.map(partida => ({
      local_id: lId, año: a, mes: m, partida,
      valor_real: v[partida] ?? 0,
      valor_presupuesto: 0,
    }))
    await supabase.from('pl_datos').upsert(rows, { onConflict: 'local_id,año,mes,partida' })
  }

  async function guardarBorrador() {
    if (!localId) return
    setGuardando(true)
    await guardarCore(vals, localId, mes, año)
    setGuardando(false)
    setSavedAt(new Date())
    setIsDirty(false)
  }

  async function cerrarMes() {
    if (!localId) return
    // Validar que hay ingresos
    const ingBruto = (vals['ventas_sala'] ?? 0) + (vals['ventas_uber'] ?? 0)
    if (ingBruto === 0) {
      setErrCierre('Debes introducir al menos las ventas del mes antes de cerrar.')
      return
    }
    setErrCierre('')
    setCerrando(true)
    await guardarCore(vals, localId, mes, año)
    // Marcar como cerrado
    await supabase.from('pl_datos').upsert(
      { local_id: localId, año, mes, partida: PARTIDA_CERRADO, valor_real: 1, valor_presupuesto: 0 },
      { onConflict: 'local_id,año,mes,partida' }
    )
    setCerrado(true)
    setSavedAt(new Date())
    setIsDirty(false)
    setCerrando(false)
  }

  async function reabrirMes() {
    if (!localId) return
    await supabase.from('pl_datos')
      .delete()
      .eq('local_id', localId).eq('año', año).eq('mes', mes).eq('partida', PARTIDA_CERRADO)
    setCerrado(false)
  }

  // ── Cambio de campo ──────────────────────────
  function onChange(partida: string, valor: number) {
    setVals(prev => ({ ...prev, [partida]: valor }))
    setIsDirty(true)
    // Si el usuario edita un campo auto-completado, quitar la marca
    if (autoFields.has(partida)) {
      setAutoFields(prev => { const n = new Set(prev); n.delete(partida); return n })
    }
  }

  // ── Navegación entre meses ───────────────────
  function mesAnterior() {
    if (mes === 1) { setMes(12); setAño(a => a - 1) } else setMes(m => m - 1)
  }
  function mesSiguiente() {
    if (mes === 12) { setMes(1); setAño(a => a + 1) } else setMes(m => m + 1)
  }

  // ── KPIs calculados ──────────────────────────
  const kpi = useMemo(() => calcPL(vals), [vals])

  const ebitdaLocalSem = semEbitda(kpi.ing > 0 ? (kpi.ebitdaLocal / kpi.ing) * 100 : 0)
  const ebitdaSem      = semEbitda(kpi.ebitdaPct)

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <div className="p-6 max-w-2xl">

      {/* ── Header ──────────────────────────────── */}
      <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Entrada de Datos P&L</h1>
          <p className="text-sm text-gray-400 mt-0.5">Introduce los valores reales del mes</p>
        </div>
        {/* Estado */}
        <div className="flex items-center gap-2">
          {cerrado ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-[#1A1A1A] text-white">
              <Lock size={11} /> Cerrado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
              <Zap size={11} /> Borrador
            </span>
          )}
          {savedAt && !isDirty && (
            <span className="text-xs text-gray-400">
              Guardado {savedAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {isDirty && <span className="text-xs text-amber-500">Sin guardar</span>}
        </div>
      </div>

      {/* ── Selectores + navegación ──────────────── */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <Sel value={localId ?? ''} onChange={v => setLocalId(Number(v))}>
          {locales.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
        </Sel>

        <div className="flex items-center gap-1">
          <button onClick={mesAnterior} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
            <ChevronLeft size={15} />
          </button>
          <div className="flex items-center gap-1.5">
            <Sel value={mes} onChange={v => setMes(Number(v))}>
              {MESES.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </Sel>
            <Sel value={año} onChange={v => setAño(Number(v))}>
              {[2024, 2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
            </Sel>
          </div>
          <button onClick={mesSiguiente} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* ── KPI bar en tiempo real ────────────────── */}
      {kpi.ing > 0 && (
        <div className="grid grid-cols-4 gap-2 mb-5">
          {[
            { label: 'Ingresos s/IVA', value: eur(kpi.ing), cls: 'text-gray-900' },
            {
              label: 'Food Cost',
              value: kpi.foodPct.toFixed(1) + '%',
              cls: kpi.foodPct > 33 ? 'text-rose-600' : 'text-emerald-600',
              alert: kpi.foodPct > 33,
            },
            {
              label: 'Coste Personal',
              value: kpi.persPct.toFixed(1) + '%',
              cls: kpi.persPct > 30 ? 'text-rose-600' : 'text-emerald-600',
              alert: kpi.persPct > 30,
            },
            {
              label: 'EBITDA',
              value: kpi.ebitdaPct.toFixed(1) + '%',
              cls: kpi.ebitdaPct >= 8 ? 'text-emerald-600' : kpi.ebitdaPct >= 4 ? 'text-amber-600' : 'text-rose-600',
            },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-xl border border-gray-200 px-4 py-3 text-center">
              <p className={`text-lg font-black tabular-nums ${k.cls}`}>{k.value}</p>
              <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wide">{k.label}</p>
            </div>
          ))}
        </div>
      )}

      {cargando ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="animate-spin text-[#F5B731]" size={24} />
        </div>
      ) : (
        <div className="space-y-4">

          {/* ── INGRESOS ───────────────────────────── */}
          <SeccionCard title="Ingresos">
            {INGRESOS.map(p => (
              <FilaPartida key={p} partida={p} vals={vals} onChange={onChange} disabled={cerrado} />
            ))}
            <FilaCalc label="Total sin IVA (÷ 1,10)" valor={kpi.ing} />
            <FilaTotal label="Total Ingresos (con IVA)" valor={kpi.ingBruto} />
          </SeccionCard>

          {/* ── MATERIA PRIMA ──────────────────────── */}
          <SeccionCard title="Materia Prima">
            {MP.map(p => (
              <FilaPartida
                key={p} partida={p} vals={vals} onChange={onChange} disabled={cerrado}
                autoFilled={autoFields.has(p)}
              />
            ))}
            <FilaTotal
              label="Total Materia Prima"
              valor={kpi.mp}
              badge={kpi.ing > 0 ? kpi.foodPct.toFixed(1) + '%' : undefined}
              alerta={kpi.foodPct > 33}
            />
          </SeccionCard>

          {/* ── DELIVERY ───────────────────────────── */}
          <SeccionCard title="Delivery">
            {DELIVERY.map(p => (
              <FilaPartida key={p} partida={p} vals={vals} onChange={onChange} disabled={cerrado} />
            ))}
            <FilaTotal label="Total Delivery" valor={kpi.delivery} />
          </SeccionCard>

          {/* ── GOPEX ──────────────────────────────── */}
          <SeccionCard title="Gastos Operativos (GOPEX)">
            {GOPEX.map(p => (
              <FilaPartida key={p} partida={p} vals={vals} onChange={onChange} disabled={cerrado} />
            ))}
            <FilaTotal label="Total GOPEX" valor={kpi.gopex} />
          </SeccionCard>

          {/* ── SUMINISTROS ────────────────────────── */}
          <SeccionCard title="Suministros">
            {SUMINISTROS.map(p => (
              <FilaPartida key={p} partida={p} vals={vals} onChange={onChange} disabled={cerrado} />
            ))}
            <FilaTotal label="Total Suministros" valor={kpi.sumi} />
          </SeccionCard>

          {/* ── MANTENIMIENTO ──────────────────────── */}
          <SeccionCard title="Mantenimiento">
            {MANTENIMIENTO.map(p => (
              <FilaPartida key={p} partida={p} vals={vals} onChange={onChange} disabled={cerrado} />
            ))}
            <FilaTotal label="Total Mantenimiento" valor={kpi.mant} />
          </SeccionCard>

          {/* ── MARKETING ──────────────────────────── */}
          <SeccionCard title="Marketing Local">
            {MARKETING.map(p => (
              <FilaPartida key={p} partida={p} vals={vals} onChange={onChange} disabled={cerrado} />
            ))}
            <FilaTotal label="Total Marketing" valor={kpi.mkt} />
          </SeccionCard>

          {/* ── EBITDA LOCAL ────────────────────────── */}
          <ResultadoCard
            label="EBITDA Local"
            valor={kpi.ebitdaLocal}
            pctStr={kpi.ing > 0 ? ((kpi.ebitdaLocal / kpi.ing) * 100).toFixed(1) + '%' : '—'}
            sem={ebitdaLocalSem}
            nota="MB − GOPEX − Suministros − Mantenimiento − Marketing"
          />

          {/* ── PERSONAL ───────────────────────────── */}
          <SeccionCard title="Personal">
            {PERSONAL.map(p => (
              <FilaPartida key={p} partida={p} vals={vals} onChange={onChange} disabled={cerrado} />
            ))}
            <FilaTotal
              label="Total Personal"
              valor={kpi.personal}
              badge={kpi.ing > 0 ? kpi.persPct.toFixed(1) + '%' : undefined}
              alerta={kpi.persPct > 30}
            />
          </SeccionCard>

          {/* ── EBITDA CON ESTRUCTURA ──────────────── */}
          <ResultadoCard
            label="EBITDA con Estructura"
            valor={kpi.ebitda}
            pctStr={kpi.ebitdaPct.toFixed(1) + '%'}
            sem={ebitdaSem}
            nota="EBITDA Local − Personal"
          />

          {/* ── Info autocomplete ──────────────────── */}
          {autoFields.size > 0 && (
            <div className="flex items-start gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
              <Info size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">
                <strong>AUTO</strong> indica campos completados automáticamente: mermas desde la tabla de mermas del mes, inventario inicial desde el inventario final del mes anterior. Puedes modificarlos manualmente.
              </p>
            </div>
          )}

          {/* ── Errores de cierre ──────────────────── */}
          {errCierre && (
            <div className="flex items-center gap-2 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl">
              <AlertTriangle size={14} className="text-rose-500 flex-shrink-0" />
              <p className="text-sm text-rose-700">{errCierre}</p>
            </div>
          )}

          {/* ── Botones de acción ──────────────────── */}
          {cerrado ? (
            <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-5 py-4">
              <div className="flex items-center gap-2">
                <Lock size={16} className="text-gray-400" />
                <p className="text-sm text-gray-600 font-medium">
                  Mes cerrado · datos definitivos
                </p>
              </div>
              <button
                onClick={reabrirMes}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Unlock size={14} /> Reabrir mes
              </button>
            </div>
          ) : (
            <div className="flex items-stretch gap-3">
              <button
                onClick={guardarBorrador}
                disabled={guardando || !isDirty}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {guardando ? (
                  <><RefreshCw size={15} className="animate-spin" /> Guardando...</>
                ) : isDirty ? (
                  <><Save size={15} /> Guardar borrador</>
                ) : (
                  <><Check size={15} className="text-emerald-500" /> Guardado</>
                )}
              </button>
              <button
                onClick={cerrarMes}
                disabled={cerrando}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold bg-[#1A1A1A] text-white rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {cerrando ? (
                  <><RefreshCw size={15} className="animate-spin" /> Cerrando...</>
                ) : (
                  <><Lock size={14} /> Cerrar mes</>
                )}
              </button>
            </div>
          )}

        </div>
      )}
    </div>
  )
}

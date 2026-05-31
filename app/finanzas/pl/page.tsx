'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { MESES, LABELS, SECCIONES } from '@/lib/pl-config'
import { RefreshCw, AlertTriangle, ChevronDown } from 'lucide-react'

type Fila = { partida: string; valor_real: number; valor_presupuesto: number }
type Datos = Record<string, { real: number; ppto: number }>
type Local = { id: number; nombre: string; activo: boolean }

// ── Utilidades ───────────────────────────────────────────────
const e = (n: number) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const p = (v: number, base: number) => (base > 0 ? ((v / base) * 100).toFixed(1) + '%' : '—')
const sum = (keys: readonly string[], datos: Datos, t: 'real' | 'ppto') =>
  keys.reduce((s, k) => s + (datos[k]?.[t] ?? 0), 0)
const v = (datos: Datos, key: string, t: 'real' | 'ppto') => datos[key]?.[t] ?? 0

// ── Componentes de fila ──────────────────────────────────────
function Cabecera({ label, bg }: { label: string; bg: string }) {
  return (
    <tr>
      <td colSpan={5} className={`px-4 py-2 text-xs font-bold tracking-widest uppercase ${bg}`}>
        {label}
      </td>
    </tr>
  )
}

function Item({
  label,
  real,
  ppto,
  base,
  esGasto = false,
}: {
  label: string
  real: number
  ppto: number
  base: number
  esGasto?: boolean
}) {
  const desv = real - ppto
  const ok = esGasto ? desv <= 0 : desv >= 0
  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/50">
      <td className="px-4 py-2 pl-9 text-sm text-gray-600">{label}</td>
      <td className="px-4 py-2 text-right text-sm text-gray-400">{e(ppto)}</td>
      <td className="px-4 py-2 text-right text-sm font-medium text-gray-800">{e(real)}</td>
      <td className="px-4 py-2 text-right text-xs text-gray-400">{p(real, base)}</td>
      <td className={`px-4 py-2 text-right text-sm font-medium ${ok ? 'text-emerald-600' : 'text-rose-600'}`}>
        {desv >= 0 ? '+' : ''}{e(desv)}
      </td>
    </tr>
  )
}

function Total({
  label,
  real,
  ppto,
  base,
  esGasto = false,
  alerta = false,
  pctLabel,
}: {
  label: string
  real: number
  ppto: number
  base: number
  esGasto?: boolean
  alerta?: boolean
  pctLabel?: string
}) {
  const desv = real - ppto
  const ok = esGasto ? desv <= 0 : desv >= 0
  return (
    <tr className="bg-gray-50 border-t border-gray-200">
      <td className="px-4 py-2.5 pl-4 text-sm font-bold text-gray-800">
        <span className="flex items-center gap-2">
          {label}
          {pctLabel && (
            <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${alerta ? 'bg-rose-100 text-rose-700' : 'bg-gray-100 text-gray-500'}`}>
              {pctLabel}
            </span>
          )}
          {alerta && <AlertTriangle size={13} className="text-rose-500" />}
        </span>
      </td>
      <td className="px-4 py-2.5 text-right text-sm font-semibold text-gray-500">{e(ppto)}</td>
      <td className="px-4 py-2.5 text-right text-sm font-bold text-gray-900">{e(real)}</td>
      <td className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500">{p(real, base)}</td>
      <td className={`px-4 py-2.5 text-right text-sm font-bold ${ok ? 'text-emerald-600' : 'text-rose-600'}`}>
        {desv >= 0 ? '+' : ''}{e(desv)}
      </td>
    </tr>
  )
}

function Resultado({
  label,
  real,
  ppto,
  base,
  alerta = false,
}: {
  label: string
  real: number
  ppto: number
  base: number
  alerta?: boolean
}) {
  const desv = real - ppto
  const pctR = base > 0 ? (real / base) * 100 : 0
  return (
    <tr className="border-t-2 border-[#1A1A1A]">
      <td className="px-4 py-3 pl-4 text-sm font-bold text-[#1A1A1A] bg-[#F5B731]/15">
        <span className="flex items-center gap-2">
          {label}
          {alerta && <AlertTriangle size={13} className="text-rose-500" />}
        </span>
      </td>
      <td className="px-4 py-3 text-right text-sm font-bold text-gray-600 bg-[#F5B731]/15">{e(ppto)}</td>
      <td className="px-4 py-3 text-right text-sm font-bold text-[#1A1A1A] bg-[#F5B731]/15">{e(real)}</td>
      <td className={`px-4 py-3 text-right text-sm font-bold bg-[#F5B731]/15 ${alerta ? 'text-rose-600' : 'text-gray-700'}`}>
        {pctR.toFixed(1)}%
      </td>
      <td className={`px-4 py-3 text-right text-sm font-bold bg-[#F5B731]/15 ${desv >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
        {desv >= 0 ? '+' : ''}{e(desv)}
      </td>
    </tr>
  )
}

function Espacio() {
  return <tr><td colSpan={5} className="h-3" /></tr>
}

// ── Selector estilo pill ─────────────────────────────────────
function Select({
  value, onChange, children, className = '',
}: {
  value: string | number
  onChange: (v: string) => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none pl-3 pr-7 py-1.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F5B731] cursor-pointer"
      >
        {children}
      </select>
      <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────
export default function PaginaPL() {
  const ahora = new Date()
  const [locales, setLocales] = useState<Local[]>([])
  const [vista, setVista] = useState<'local' | 'consolidado'>('local')
  const [localId, setLocalId] = useState<number | null>(null)
  const [mes, setMes] = useState(ahora.getMonth() + 1)
  const [año, setAño] = useState(ahora.getFullYear())
  const [filas, setFilas] = useState<Fila[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('locales').select('*').order('id').then(({ data }) => {
      const ls = data ?? []
      setLocales(ls)
      const primero = ls.find((l) => l.activo)
      if (primero) setLocalId(primero.id)
    })
  }, [])

  useEffect(() => {
    if (vista === 'local' && !localId) return
    setLoading(true)
    let query = supabase.from('pl_datos').select('*').eq('año', año).eq('mes', mes)
    if (vista === 'local') query = query.eq('local_id', localId!)
    query.then(({ data }) => {
      setFilas(data ?? [])
      setLoading(false)
    })
  }, [vista, localId, mes, año])

  const datos: Datos = useMemo(() => {
    const d: Datos = {}
    filas.forEach((f) => {
      if (!d[f.partida]) d[f.partida] = { real: 0, ppto: 0 }
      d[f.partida].real += f.valor_real ?? 0
      d[f.partida].ppto += f.valor_presupuesto ?? 0
    })
    return d
  }, [filas])

  // ── Cálculos P&L ──────────────────────────────────────────
  const { kpi, calc } = useMemo(() => {
    const ingConIvaR = v(datos, 'ventas_sala', 'real') + v(datos, 'ventas_uber', 'real')
    const ingConIvaP = v(datos, 'ventas_sala', 'ppto') + v(datos, 'ventas_uber', 'ppto')
    const ingR = ingConIvaR / 1.1
    const ingP = ingConIvaP / 1.1

    const mpItems = SECCIONES.find((s) => s.key === 'materia_prima')!.items
    const mpR = v(datos, 'proveedores', 'real') + v(datos, 'inventario_inicial', 'real')
      - v(datos, 'inventario_final', 'real') + v(datos, 'mermas', 'real')
    const mpP = v(datos, 'proveedores', 'ppto') + v(datos, 'inventario_inicial', 'ppto')
      - v(datos, 'inventario_final', 'ppto') + v(datos, 'mermas', 'ppto')
    const costePctR = ingR > 0 ? (mpR / ingR) * 100 : 0

    const delivItems = SECCIONES.find((s) => s.key === 'delivery')!.items
    const delivR = sum(delivItems, datos, 'real')
    const delivP = sum(delivItems, datos, 'ppto')

    const mbR = ingR - mpR - delivR
    const mbP = ingP - mpP - delivP

    const gopexItems = SECCIONES.find((s) => s.key === 'gopex')!.items
    const gopexR = sum(gopexItems, datos, 'real')
    const gopexP = sum(gopexItems, datos, 'ppto')

    const sumiItems = SECCIONES.find((s) => s.key === 'suministros')!.items
    const sumiR = sum(sumiItems, datos, 'real')
    const sumiP = sum(sumiItems, datos, 'ppto')

    const mantItems = SECCIONES.find((s) => s.key === 'mantenimiento')!.items
    const mantR = sum(mantItems, datos, 'real')
    const mantP = sum(mantItems, datos, 'ppto')

    const mktItems = SECCIONES.find((s) => s.key === 'marketing')!.items
    const mktR = sum(mktItems, datos, 'real')
    const mktP = sum(mktItems, datos, 'ppto')

    const ebitdaLocR = mbR - gopexR - sumiR - mantR - mktR
    const ebitdaLocP = mbP - gopexP - sumiP - mantP - mktP

    const persItems = SECCIONES.find((s) => s.key === 'personal')!.items
    const persR = sum(persItems, datos, 'real')
    const persP = sum(persItems, datos, 'ppto')
    const persPctR = ingR > 0 ? (persR / ingR) * 100 : 0

    const ebitdaR = ebitdaLocR - persR
    const ebitdaP = ebitdaLocP - persP
    const ebitdaPctR = ingR > 0 ? (ebitdaR / ingR) * 100 : 0

    return {
      kpi: { ingR, costePctR, persPctR, ebitdaPctR },
      calc: {
        ingR, ingP, ingConIvaR, ingConIvaP,
        mpR, mpP, costePctR,
        delivR, delivP,
        mbR, mbP,
        gopexR, gopexP,
        sumiR, sumiP,
        mantR, mantP,
        mktR, mktP,
        ebitdaLocR, ebitdaLocP,
        persR, persP, persPctR,
        ebitdaR, ebitdaP, ebitdaPctR,
        delivItems, gopexItems, sumiItems, mantItems, mktItems, persItems,
      },
    }
  }, [datos])

  const { ingR } = calc

  if (loading && filas.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="animate-spin text-[#F5B731]" size={24} />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Cuenta de Resultados (P&L)</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {MESES[mes]} {año} · {vista === 'consolidado' ? 'Consolidado' : locales.find((l) => l.id === localId)?.nombre ?? ''}
          </p>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Toggle local / consolidado */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {(['local', 'consolidado'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setVista(t)}
                className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  vista === t ? 'bg-[#F5B731] text-[#1A1A1A]' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {t === 'local' ? 'Por Local' : 'Consolidado'}
              </button>
            ))}
          </div>

          {vista === 'local' && (
            <Select value={localId ?? ''} onChange={(val) => setLocalId(Number(val))}>
              {locales.filter((l) => l.activo).map((l) => (
                <option key={l.id} value={l.id}>{l.nombre}</option>
              ))}
            </Select>
          )}

          <Select value={mes} onChange={(val) => setMes(Number(val))}>
            {MESES.slice(1).map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </Select>

          <Select value={año} onChange={(val) => setAño(Number(val))}>
            {[2024, 2025, 2026, 2027].map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </Select>
        </div>
      </div>

      {/* KPI banners */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Ingresos sin IVA', val: e(kpi.ingR), ok: true },
          {
            label: 'Coste Materia Prima',
            val: kpi.costePctR.toFixed(1) + '%',
            ok: kpi.costePctR <= 33,
            limite: '> 33%',
          },
          {
            label: 'Personal',
            val: kpi.persPctR.toFixed(1) + '%',
            ok: kpi.persPctR <= 30,
            limite: '> 30%',
          },
          {
            label: 'EBITDA',
            val: kpi.ebitdaPctR.toFixed(1) + '%',
            ok: kpi.ebitdaPctR >= 8,
            limite: '< 8%',
          },
        ].map(({ label, val, ok, limite }) => (
          <div
            key={label}
            className={`rounded-xl border p-4 ${ok ? 'bg-white border-gray-200' : 'bg-rose-50 border-rose-200'}`}
          >
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className={`text-xl font-bold ${ok ? 'text-gray-900' : 'text-rose-700'}`}>{val}</p>
            {!ok && <p className="text-xs text-rose-500 mt-0.5 flex items-center gap-1"><AlertTriangle size={11} /> Alerta {limite}</p>}
          </div>
        ))}
      </div>

      {/* Tabla P&L */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead className="bg-[#1A1A1A] text-white text-xs">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">PARTIDA</th>
                <th className="text-right px-4 py-3 font-semibold">PRESUPUESTO</th>
                <th className="text-right px-4 py-3 font-semibold">REAL</th>
                <th className="text-right px-4 py-3 font-semibold">% VENTAS</th>
                <th className="text-right px-4 py-3 font-semibold">DESVIACIÓN</th>
              </tr>
            </thead>
            <tbody>
              {/* ── INGRESOS ── */}
              <Cabecera label="INGRESOS" bg="bg-[#F5B731]/10 text-[#1A1A1A]" />
              <Item label="Ventas Sala (con IVA)" real={v(datos,'ventas_sala','real')} ppto={v(datos,'ventas_sala','ppto')} base={ingR} />
              <Item label="Ventas Uber (con IVA)" real={v(datos,'ventas_uber','real')} ppto={v(datos,'ventas_uber','ppto')} base={ingR} />
              <Total label="TOTAL INGRESOS (sin IVA)" real={calc.ingR} ppto={calc.ingP} base={ingR} />
              <Espacio />

              {/* ── MATERIA PRIMA ── */}
              <Cabecera label="MATERIA PRIMA" bg="bg-orange-50 text-orange-800" />
              {(['proveedores','inventario_inicial','inventario_final','mermas'] as const).map((k) => (
                <Item key={k} label={LABELS[k]} real={v(datos,k,'real')} ppto={v(datos,k,'ppto')} base={ingR} esGasto />
              ))}
              <Total
                label="TOTAL MATERIA PRIMA"
                real={calc.mpR} ppto={calc.mpP} base={ingR} esGasto
                alerta={calc.costePctR > 33}
                pctLabel={calc.costePctR.toFixed(1) + '%'}
              />
              <Espacio />

              {/* ── DELIVERY ── */}
              <Cabecera label="DELIVERY" bg="bg-blue-50 text-blue-800" />
              {calc.delivItems.map((k) => (
                <Item key={k} label={LABELS[k]} real={v(datos,k,'real')} ppto={v(datos,k,'ppto')} base={ingR} esGasto />
              ))}
              <Total label="TOTAL DELIVERY" real={calc.delivR} ppto={calc.delivP} base={ingR} esGasto />
              <Espacio />

              {/* ── MARGEN BRUTO ── */}
              <Resultado label="MARGEN BRUTO" real={calc.mbR} ppto={calc.mbP} base={ingR} />
              <Espacio />

              {/* ── GOPEX ── */}
              <Cabecera label="GASTOS OPERATIVOS (GOPEX)" bg="bg-purple-50 text-purple-800" />
              {calc.gopexItems.map((k) => (
                <Item key={k} label={LABELS[k]} real={v(datos,k,'real')} ppto={v(datos,k,'ppto')} base={ingR} esGasto />
              ))}
              <Total label="TOTAL GOPEX" real={calc.gopexR} ppto={calc.gopexP} base={ingR} esGasto />
              <Espacio />

              {/* ── SUMINISTROS ── */}
              <Cabecera label="SUMINISTROS" bg="bg-teal-50 text-teal-800" />
              {calc.sumiItems.map((k) => (
                <Item key={k} label={LABELS[k]} real={v(datos,k,'real')} ppto={v(datos,k,'ppto')} base={ingR} esGasto />
              ))}
              <Total label="TOTAL SUMINISTROS" real={calc.sumiR} ppto={calc.sumiP} base={ingR} esGasto />
              <Espacio />

              {/* ── MANTENIMIENTO ── */}
              <Cabecera label="MANTENIMIENTO" bg="bg-yellow-50 text-yellow-800" />
              {calc.mantItems.map((k) => (
                <Item key={k} label={LABELS[k]} real={v(datos,k,'real')} ppto={v(datos,k,'ppto')} base={ingR} esGasto />
              ))}
              <Total label="TOTAL MANTENIMIENTO" real={calc.mantR} ppto={calc.mantP} base={ingR} esGasto />
              <Espacio />

              {/* ── MARKETING ── */}
              <Cabecera label="MARKETING LOCAL" bg="bg-pink-50 text-pink-800" />
              {calc.mktItems.map((k) => (
                <Item key={k} label={LABELS[k]} real={v(datos,k,'real')} ppto={v(datos,k,'ppto')} base={ingR} esGasto />
              ))}
              <Total label="TOTAL MARKETING" real={calc.mktR} ppto={calc.mktP} base={ingR} esGasto />
              <Espacio />

              {/* ── EBITDA LOCAL ── */}
              <Resultado
                label="EBITDA LOCAL"
                real={calc.ebitdaLocR} ppto={calc.ebitdaLocP} base={ingR}
              />
              <Espacio />

              {/* ── PERSONAL ── */}
              <Cabecera label="PERSONAL" bg="bg-indigo-50 text-indigo-800" />
              {calc.persItems.map((k) => (
                <Item key={k} label={LABELS[k]} real={v(datos,k,'real')} ppto={v(datos,k,'ppto')} base={ingR} esGasto />
              ))}
              <Total
                label="TOTAL PERSONAL"
                real={calc.persR} ppto={calc.persP} base={ingR} esGasto
                alerta={calc.persPctR > 30}
                pctLabel={calc.persPctR.toFixed(1) + '%'}
              />
              <Espacio />

              {/* ── EBITDA CON ESTRUCTURA ── */}
              <Resultado
                label="EBITDA CON ESTRUCTURA"
                real={calc.ebitdaR} ppto={calc.ebitdaP} base={ingR}
                alerta={calc.ebitdaPctR < 8}
              />
            </tbody>
          </table>
        </div>
      </div>

      {filas.length === 0 && !loading && (
        <p className="text-center text-sm text-gray-400 mt-6">
          Sin datos para {MESES[mes]} {año}. Ve a <strong>Entrada de Datos</strong> para registrarlos.
        </p>
      )}
    </div>
  )
}

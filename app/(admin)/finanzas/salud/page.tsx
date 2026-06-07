'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { MESES, SECCIONES } from '@/lib/pl-config'
import { RefreshCw, CheckCircle, AlertTriangle, XCircle, ChevronDown } from 'lucide-react'

type Local = { id: number; nombre: string; activo: boolean }
type Fila = { mes: number; partida: string; valor_real: number; valor_presupuesto: number }

function semaforo(ok: boolean, warn: boolean) {
  if (ok) return { icono: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', label: 'OK' }
  if (warn) return { icono: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50 border-amber-200', label: 'Atención' }
  return { icono: XCircle, color: 'text-rose-600', bg: 'bg-rose-50 border-rose-200', label: 'Alerta' }
}

function KPIBox({ label, val, pctLabel, ok, warn }: { label: string; val: string; pctLabel?: string; ok: boolean; warn: boolean }) {
  const s = semaforo(ok, warn)
  const Icono = s.icono
  return (
    <div className={`rounded-xl border p-5 ${s.bg}`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <Icono size={18} className={s.color} />
      </div>
      <p className="text-2xl font-bold text-gray-900 mb-0.5">{val}</p>
      {pctLabel && <p className="text-xs text-gray-500">{pctLabel}</p>}
      <span className={`mt-2 inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${s.color} bg-white/60`}>
        {s.label}
      </span>
    </div>
  )
}

function Sel({ value, onChange, children }: { value: string | number; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none pl-3 pr-7 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#F5B731]"
      >
        {children}
      </select>
      <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  )
}

export default function PaginaSalud() {
  const ahora = new Date()
  const [locales, setLocales] = useState<Local[]>([])
  const [localId, setLocalId] = useState<number | null>(null)
  const [año, setAño] = useState(ahora.getFullYear())
  const [filas, setFilas] = useState<Fila[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('locales').select('*').eq('activo', true).order('id').then(({ data }) => {
      const ls = data ?? []
      setLocales(ls)
      if (ls[0]) setLocalId(ls[0].id)
    })
  }, [])

  useEffect(() => {
    if (!localId) return
    setLoading(true)
    supabase
      .from('pl_datos')
      .select('mes, partida, valor_real, valor_presupuesto')
      .eq('local_id', localId)
      .eq('año', año)
      .then(({ data }) => {
        setFilas(data ?? [])
        setLoading(false)
      })
  }, [localId, año])

  // Agrupar por mes → calcular KPIs
  const mesesConDatos = useMemo(() => {
    const porMes: Record<number, Record<string, { real: number; ppto: number }>> = {}
    filas.forEach((f) => {
      if (!porMes[f.mes]) porMes[f.mes] = {}
      if (!porMes[f.mes][f.partida]) porMes[f.mes][f.partida] = { real: 0, ppto: 0 }
      porMes[f.mes][f.partida].real += f.valor_real ?? 0
      porMes[f.mes][f.partida].ppto += f.valor_presupuesto ?? 0
    })

    return Object.entries(porMes)
      .map(([mesStr, d]) => {
        const mes = Number(mesStr)
        const get = (k: string, t: 'real' | 'ppto') => d[k]?.[t] ?? 0
        const sumItems = (keys: readonly string[], t: 'real' | 'ppto') =>
          keys.reduce((s, k) => s + get(k, t), 0)

        const ingR = (get('ventas_sala', 'real') + get('ventas_uber', 'real')) / 1.1
        const mpR = get('proveedores', 'real') + get('inventario_inicial', 'real')
          - get('inventario_final', 'real') + get('mermas', 'real')
        const delivR = sumItems(SECCIONES.find((s) => s.key === 'delivery')!.items, 'real')
        const gopexR = sumItems(SECCIONES.find((s) => s.key === 'gopex')!.items, 'real')
        const sumiR = sumItems(SECCIONES.find((s) => s.key === 'suministros')!.items, 'real')
        const mantR = sumItems(SECCIONES.find((s) => s.key === 'mantenimiento')!.items, 'real')
        const mktR = sumItems(SECCIONES.find((s) => s.key === 'marketing')!.items, 'real')
        const persR = sumItems(SECCIONES.find((s) => s.key === 'personal')!.items, 'real')

        const mbR = ingR - mpR - delivR
        const ebitdaLocR = mbR - gopexR - sumiR - mantR - mktR
        const ebitdaR = ebitdaLocR - persR

        const costePct = ingR > 0 ? (mpR / ingR) * 100 : 0
        const persPct = ingR > 0 ? (persR / ingR) * 100 : 0
        const ebitdaPct = ingR > 0 ? (ebitdaR / ingR) * 100 : 0
        const mbPct = ingR > 0 ? (mbR / ingR) * 100 : 0

        return { mes, ingR, costePct, persPct, ebitdaPct, mbPct }
      })
      .sort((a, b) => a.mes - b.mes)
  }, [filas])

  // KPIs del mes más reciente con datos
  const ultimoMes = mesesConDatos[mesesConDatos.length - 1]

  const fmt = (n: number) =>
    n.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €'

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="animate-spin text-[#F5B731]" size={24} />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Salud Financiera</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {locales.find((l) => l.id === localId)?.nombre ?? ''} · {año}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Sel value={localId ?? ''} onChange={(v) => setLocalId(Number(v))}>
            {locales.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
          </Sel>
          <Sel value={año} onChange={(v) => setAño(Number(v))}>
            {[2024, 2025, 2026, 2027].map((a) => <option key={a} value={a}>{a}</option>)}
          </Sel>
        </div>
      </div>

      {!ultimoMes ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400 text-sm">
          Sin datos para {año}. Registra ventas desde <strong>Entrada de Datos</strong>.
        </div>
      ) : (
        <>
          {/* KPIs del último mes */}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Último mes con datos — {MESES[ultimoMes.mes]}
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <KPIBox
              label="Ingresos sin IVA"
              val={fmt(ultimoMes.ingR)}
              ok={ultimoMes.ingR > 0}
              warn={false}
            />
            <KPIBox
              label="Coste Materia Prima"
              val={ultimoMes.costePct.toFixed(1) + '%'}
              pctLabel="Límite: 33%"
              ok={ultimoMes.costePct <= 33}
              warn={ultimoMes.costePct > 33 && ultimoMes.costePct <= 36}
            />
            <KPIBox
              label="Personal"
              val={ultimoMes.persPct.toFixed(1) + '%'}
              pctLabel="Límite: 30%"
              ok={ultimoMes.persPct <= 30}
              warn={ultimoMes.persPct > 30 && ultimoMes.persPct <= 33}
            />
            <KPIBox
              label="EBITDA"
              val={ultimoMes.ebitdaPct.toFixed(1) + '%'}
              pctLabel="Mínimo: 8%"
              ok={ultimoMes.ebitdaPct >= 8}
              warn={ultimoMes.ebitdaPct >= 5 && ultimoMes.ebitdaPct < 8}
            />
          </div>

          {/* Evolución mensual */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">Evolución mensual {año}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium">Mes</th>
                    <th className="text-right px-4 py-3 font-medium">Ingresos</th>
                    <th className="text-right px-4 py-3 font-medium">Margen Bruto %</th>
                    <th className="text-right px-4 py-3 font-medium">Coste MP %</th>
                    <th className="text-right px-4 py-3 font-medium">Personal %</th>
                    <th className="text-right px-4 py-3 font-medium">EBITDA %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {mesesConDatos.map(({ mes, ingR, costePct, persPct, ebitdaPct, mbPct }) => (
                    <tr key={mes} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-800">{MESES[mes]}</td>
                      <td className="px-4 py-3 text-right text-gray-700 font-semibold">{fmt(ingR)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-medium text-gray-700">{mbPct.toFixed(1)}%</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-semibold ${costePct > 33 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {costePct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-semibold ${persPct > 30 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {persPct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-semibold ${ebitdaPct < 8 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {ebitdaPct.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Semáforo de límites */}
          <div className="mt-5 bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Umbrales de alerta</h3>
            <div className="grid grid-cols-3 gap-3 text-xs text-gray-600">
              {[
                { label: 'Coste Materia Prima', limite: '≤ 33%', color: 'text-emerald-600' },
                { label: 'Personal', limite: '≤ 30%', color: 'text-emerald-600' },
                { label: 'EBITDA mínimo', limite: '≥ 8%', color: 'text-emerald-600' },
              ].map(({ label, limite, color }) => (
                <div key={label} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                  <span>{label}</span>
                  <span className={`font-bold ${color}`}>{limite}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

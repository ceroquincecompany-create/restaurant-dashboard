'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'
import {
  RefreshCw, ReceiptText, Download, X, ChevronRight,
  Banknote, CreditCard, Car, Package, MapPin,
} from 'lucide-react'

type CierreCaja = {
  id: number
  fecha_inicio: string | null
  fecha_fin: string | null
  abierto_por: string | null
  cerrado_por: string | null
  numero_sesion: string | null
  ventas_efectivo: number | null
  ventas_tarjeta: number | null
  ventas_uber: number | null
  ventas_total: number | null
  operaciones_efectivo: number | null
  operaciones_tarjeta: number | null
  operaciones_uber: number | null
  ventas_pickup: number | null
  ventas_delivery: number | null
  ventas_self_service: number | null
  ventas_por_categoria: Record<string, number>
  desajuste_caja: number | null
  created_at: string
}

const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
               'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function fmt(n: number | null | undefined, digits = 2) {
  if (n == null) return '—'
  return n.toLocaleString('es-ES', { minimumFractionDigits: digits, maximumFractionDigits: digits }) + ' €'
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function CierresCajaPage() {
  const now = new Date()
  const [mes, setMes]       = useState(now.getMonth() + 1)
  const [anio, setAnio]     = useState(now.getFullYear())
  const [cierres, setCierres] = useState<CierreCaja[]>([])
  const [cargando, setCargando] = useState(true)
  const [detalle, setDetalle]   = useState<CierreCaja | null>(null)

  useEffect(() => {
    async function cargar() {
      setCargando(true)
      const desde = `${anio}-${String(mes).padStart(2, '0')}-01T00:00:00`
      const hasta = mes === 12
        ? `${anio + 1}-01-01T00:00:00`
        : `${anio}-${String(mes + 1).padStart(2, '0')}-01T00:00:00`

      const { data } = await supabase
        .from('cierres_caja')
        .select('*')
        .gte('created_at', desde)
        .lt('created_at', hasta)
        .order('created_at', { ascending: false })

      setCierres((data as CierreCaja[]) ?? [])
      setCargando(false)
    }
    cargar()
  }, [mes, anio])

  const totales = useMemo(() => ({
    total:    cierres.reduce((s, c) => s + (c.ventas_total ?? 0), 0),
    efectivo: cierres.reduce((s, c) => s + (c.ventas_efectivo ?? 0), 0),
    tarjeta:  cierres.reduce((s, c) => s + (c.ventas_tarjeta ?? 0), 0),
    uber:     cierres.reduce((s, c) => s + (c.ventas_uber ?? 0), 0),
  }), [cierres])

  function exportarExcel() {
    const rows = cierres.map(c => ({
      'Fecha cierre':   c.fecha_fin ? new Date(c.fecha_fin).toLocaleString('es-ES') : '',
      'Sesión':         c.numero_sesion ?? '',
      'Total':          c.ventas_total ?? 0,
      'Efectivo':       c.ventas_efectivo ?? 0,
      'Tarjeta':        c.ventas_tarjeta ?? 0,
      'Uber':           c.ventas_uber ?? 0,
      'Pickup':         c.ventas_pickup ?? 0,
      'Delivery':       c.ventas_delivery ?? 0,
      'Self service':   c.ventas_self_service ?? 0,
      'Desajuste':      c.desajuste_caja ?? 0,
      'Cerrado por':    c.cerrado_por ?? '',
      'Abierto por':    c.abierto_por ?? '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Cierres')
    XLSX.writeFile(wb, `cierres-caja-${anio}-${String(mes).padStart(2, '0')}.xlsx`)
  }

  const anios = [now.getFullYear() - 1, now.getFullYear()]

  return (
    <div className="p-6 max-w-7xl">

      {/* ── Header ── */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Cierres de Caja</h1>
          <p className="text-sm text-gray-400 mt-0.5">Registros recibidos vía email de Qamarero</p>
        </div>
        <button
          onClick={exportarExcel}
          disabled={cierres.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-[#1A1A1A] text-white text-sm font-semibold rounded-xl hover:bg-gray-800 disabled:opacity-40 transition-colors"
        >
          <Download size={15} />
          Exportar Excel
        </button>
      </div>

      {/* ── Filtros ── */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <select
          value={mes}
          onChange={e => setMes(Number(e.target.value))}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#F5B731]/40"
        >
          {MESES.slice(1).map((m, i) => (
            <option key={i + 1} value={i + 1}>{m}</option>
          ))}
        </select>
        <select
          value={anio}
          onChange={e => setAnio(Number(e.target.value))}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#F5B731]/40"
        >
          {anios.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <span className="text-sm text-gray-400">{cierres.length} cierre{cierres.length !== 1 ? 's' : ''}</span>
      </div>

      {/* ── KPIs del mes ── */}
      {cierres.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total ventas', value: fmt(totales.total), color: 'bg-gray-50 border-gray-200' },
            { label: 'Efectivo', value: fmt(totales.efectivo), color: 'bg-emerald-50 border-emerald-200' },
            { label: 'Tarjeta', value: fmt(totales.tarjeta), color: 'bg-blue-50 border-blue-200' },
            { label: 'Uber', value: fmt(totales.uber), color: 'bg-gray-50 border-gray-200' },
          ].map(k => (
            <div key={k.label} className={`rounded-xl border p-4 ${k.color}`}>
              <p className="text-xs text-gray-500 mb-1">{k.label}</p>
              <p className="text-xl font-bold text-gray-900">{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Tabla ── */}
      {cargando ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={20} className="animate-spin text-gray-300" />
        </div>
      ) : cierres.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-16 flex flex-col items-center text-center gap-3">
          <ReceiptText size={40} className="text-gray-200" />
          <p className="text-sm font-medium text-gray-400">Sin cierres en {MESES[mes]} {anio}</p>
          <p className="text-xs text-gray-300 max-w-xs">Los cierres de caja llegan automáticamente cuando Qamarero envía el email a cierres@cierres.lasofi.es</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha cierre</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Sesión</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Efectivo</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Tarjeta</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Uber</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Cerrado por</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cierres.map(c => (
                  <tr
                    key={c.id}
                    onClick={() => setDetalle(c)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {fmtDate(c.fecha_fin ?? c.created_at)}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {c.numero_sesion ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">
                      {fmt(c.ventas_total)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 hidden sm:table-cell">
                      {fmt(c.ventas_efectivo)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 hidden sm:table-cell">
                      {fmt(c.ventas_tarjeta)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 hidden md:table-cell">
                      {fmt(c.ventas_uber)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">
                      {c.cerrado_por ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      <ChevronRight size={15} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal detalle ── */}
      {detalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div>
                <p className="text-base font-bold text-gray-900">
                  Cierre {detalle.numero_sesion ?? 'sin sesión'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{fmtDate(detalle.fecha_fin ?? detalle.created_at)}</p>
              </div>
              <button
                onClick={() => setDetalle(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">

              {/* Resumen ventas */}
              <section>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Ventas</p>
                <div className="grid grid-cols-2 gap-2">
                  <InfoRow label="Total" value={fmt(detalle.ventas_total)} bold />
                  <InfoRow label="Desajuste" value={fmt(detalle.desajuste_caja)}
                    valueClass={detalle.desajuste_caja && Math.abs(detalle.desajuste_caja) > 5 ? 'text-rose-600 font-semibold' : ''} />
                </div>
              </section>

              {/* Por método de pago */}
              <section>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Por método de pago</p>
                <div className="space-y-2">
                  <MetodoPago icono={Banknote} label="Efectivo" ventas={detalle.ventas_efectivo} ops={detalle.operaciones_efectivo} color="emerald" />
                  <MetodoPago icono={CreditCard} label="Tarjeta" ventas={detalle.ventas_tarjeta} ops={detalle.operaciones_tarjeta} color="blue" />
                  <MetodoPago icono={Car} label="Uber Eats" ventas={detalle.ventas_uber} ops={detalle.operaciones_uber} color="gray" />
                </div>
              </section>

              {/* Por canal */}
              {(detalle.ventas_pickup != null || detalle.ventas_delivery != null || detalle.ventas_self_service != null) && (
                <section>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Por canal</p>
                  <div className="grid grid-cols-3 gap-2">
                    <CanalBox label="Pickup" value={detalle.ventas_pickup} icon={<MapPin size={12} />} />
                    <CanalBox label="Delivery" value={detalle.ventas_delivery} icon={<Car size={12} />} />
                    <CanalBox label="Self service" value={detalle.ventas_self_service} icon={<Package size={12} />} />
                  </div>
                </section>
              )}

              {/* Categorías */}
              {Object.keys(detalle.ventas_por_categoria ?? {}).length > 0 && (
                <section>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Por categoría</p>
                  <div className="bg-gray-50 rounded-xl divide-y divide-gray-100 overflow-hidden">
                    {Object.entries(detalle.ventas_por_categoria)
                      .sort(([, a], [, b]) => b - a)
                      .map(([nombre, importe]) => (
                        <div key={nombre} className="flex items-center justify-between px-3 py-2">
                          <span className="text-sm text-gray-700">{nombre}</span>
                          <span className="text-sm font-semibold text-gray-900">{fmt(importe)}</span>
                        </div>
                      ))}
                  </div>
                </section>
              )}

              {/* Sesión info */}
              <section>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Sesión</p>
                <div className="grid grid-cols-2 gap-2">
                  <InfoRow label="Número" value={detalle.numero_sesion ?? '—'} />
                  <InfoRow label="Abierto por" value={detalle.abierto_por ?? '—'} />
                  <InfoRow label="Apertura" value={fmtDate(detalle.fecha_inicio)} />
                  <InfoRow label="Cerrado por" value={detalle.cerrado_por ?? '—'} />
                  <InfoRow label="Cierre" value={fmtDate(detalle.fecha_fin)} />
                </div>
              </section>

            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0">
              <button
                onClick={() => setDetalle(null)}
                className="w-full py-2.5 text-sm font-semibold border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────

function InfoRow({
  label, value, bold = false, valueClass = '',
}: {
  label: string; value: string; bold?: boolean; valueClass?: string
}) {
  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2">
      <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
      <p className={`text-sm text-gray-800 ${bold ? 'font-bold' : ''} ${valueClass}`}>{value}</p>
    </div>
  )
}

function MetodoPago({
  icono: Icono, label, ventas, ops, color,
}: {
  icono: React.ElementType
  label: string
  ventas: number | null
  ops: number | null
  color: 'emerald' | 'blue' | 'gray'
}) {
  const cls = {
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-500', label: 'text-emerald-700', val: 'text-emerald-800' },
    blue:    { bg: 'bg-blue-50',    icon: 'text-blue-500',    label: 'text-blue-700',    val: 'text-blue-800' },
    gray:    { bg: 'bg-gray-50',    icon: 'text-gray-400',    label: 'text-gray-600',    val: 'text-gray-800' },
  }[color]

  return (
    <div className={`flex items-center justify-between rounded-xl p-3 ${cls.bg}`}>
      <div className="flex items-center gap-2">
        <Icono size={15} className={cls.icon} />
        <div>
          <p className={`text-xs font-semibold ${cls.label}`}>{label}</p>
          {ops != null && <p className="text-[10px] text-gray-400">{ops} operaciones</p>}
        </div>
      </div>
      <p className={`text-sm font-bold ${cls.val}`}>
        {ventas != null ? ventas.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €' : '—'}
      </p>
    </div>
  )
}

function CanalBox({
  label, value, icon,
}: {
  label: string; value: number | null; icon: React.ReactNode
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-2.5 text-center">
      <div className="flex items-center justify-center gap-1 mb-1 text-gray-400">{icon}</div>
      <p className="text-[10px] text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm font-bold text-gray-800">
        {value != null ? value.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €' : '—'}
      </p>
    </div>
  )
}

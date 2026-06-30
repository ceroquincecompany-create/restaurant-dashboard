'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { RefreshCw, Download, TrendingUp, TrendingDown, Minus, Receipt, ShoppingCart } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Cell,
} from 'recharts'

const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const COLORES = ['#F5B731','#1A1A1A','#10b981','#3b82f6','#8b5cf6','#ef4444','#f97316','#06b6d4']

type Resumen = {
  proveedor_id: number | string
  nombre: string
  totalPedidos: number
  gastoPedidos: number
  totalFacturas: number
  gastoFacturas: number
  totalGasto: number
}
type Mensual = { mes: string; gasto: number }
type TopIng  = { nombre: string; cantidad: number; gasto: number }

export default function PaginaTotalCompras() {
  const hoy = new Date()
  const [mes, setMes]   = useState(hoy.getMonth() + 1)
  const [año, setAño]   = useState(hoy.getFullYear())
  const [loading, setLoading] = useState(true)
  const [resumenProveedores, setResumenProveedores] = useState<Resumen[]>([])
  const [evolucionMensual,   setEvolucionMensual]   = useState<Mensual[]>([])
  const [topIngredientes,    setTopIngredientes]    = useState<TopIng[]>([])
  const [presupuesto, setPresupuesto] = useState<number | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    const primerDia = `${año}-${String(mes).padStart(2,'0')}-01`
    const ultimoDia = new Date(año, mes, 0).toISOString().split('T')[0]

    // ── Pedidos del mes ───────────────────────────────────────────
    const { data: pedidos } = await supabase
      .from('pedidos_proveedor')
      .select('id, proveedor_id, proveedores(nombre), pedidos_lineas(cantidad_pedida, precio_unitario, ingredientes(nombre_ingrediente))')
      .gte('created_at', primerDia + 'T00:00:00')
      .lte('created_at', ultimoDia + 'T23:59:59')
      .neq('estado', 'cancelado')

    // ── Facturas del mes (por fecha_factura, excluidas las erróneas) ──
    const { data: facturas } = await supabase
      .from('facturas')
      .select('proveedor_id, proveedor_nombre, proveedor_cif, base_imponible, total')
      .gte('fecha_factura', primerDia)
      .lte('fecha_factura', ultimoDia)
      .neq('estado', 'error')

    // ── Combinar por proveedor ─────────────────────────────────────
    const mapaProvs: Record<string, Resumen> = {}

    ;(pedidos ?? []).forEach((p: any) => {
      const id    = String(p.proveedor_id)
      const nombre = p.proveedores?.nombre ?? '—'
      if (!mapaProvs[id]) mapaProvs[id] = { proveedor_id: p.proveedor_id, nombre, totalPedidos: 0, gastoPedidos: 0, totalFacturas: 0, gastoFacturas: 0, totalGasto: 0 }
      mapaProvs[id].totalPedidos += 1
      ;(p.pedidos_lineas ?? []).forEach((l: any) => {
        mapaProvs[id].gastoPedidos += (l.cantidad_pedida ?? 0) * (l.precio_unitario ?? 0)
      })
    })

    ;(facturas ?? []).forEach((f: any) => {
      const importe = f.base_imponible ?? f.total ?? 0
      if (f.proveedor_id) {
        const id = String(f.proveedor_id)
        if (!mapaProvs[id]) mapaProvs[id] = { proveedor_id: f.proveedor_id, nombre: f.proveedor_nombre ?? '—', totalPedidos: 0, gastoPedidos: 0, totalFacturas: 0, gastoFacturas: 0, totalGasto: 0 }
        mapaProvs[id].totalFacturas += 1
        mapaProvs[id].gastoFacturas += importe
      } else {
        // Sin proveedor_id — agrupar por nombre
        const key = 'nombre:' + (f.proveedor_nombre ?? f.proveedor_cif ?? 'sin-proveedor')
        if (!mapaProvs[key]) mapaProvs[key] = { proveedor_id: key, nombre: f.proveedor_nombre ?? f.proveedor_cif ?? 'Sin proveedor', totalPedidos: 0, gastoPedidos: 0, totalFacturas: 0, gastoFacturas: 0, totalGasto: 0 }
        mapaProvs[key].totalFacturas += 1
        mapaProvs[key].gastoFacturas += importe
      }
    })

    // totalGasto = pedidos + facturas
    const resumen = Object.values(mapaProvs).map(p => ({
      ...p,
      gastoPedidos:  Math.round(p.gastoPedidos  * 100) / 100,
      gastoFacturas: Math.round(p.gastoFacturas * 100) / 100,
      totalGasto:    Math.round((p.gastoPedidos + p.gastoFacturas) * 100) / 100,
    })).sort((a, b) => b.totalGasto - a.totalGasto)

    setResumenProveedores(resumen)

    // ── Top 10 ingredientes (solo de pedidos) ─────────────────────
    const ingMap: Record<string, TopIng> = {}
    ;(pedidos ?? []).forEach((p: any) => {
      ;(p.pedidos_lineas ?? []).forEach((l: any) => {
        const nombre = l.ingredientes?.nombre_ingrediente ?? 'Sin nombre'
        if (!ingMap[nombre]) ingMap[nombre] = { nombre, cantidad: 0, gasto: 0 }
        ingMap[nombre].cantidad += l.cantidad_pedida ?? 0
        ingMap[nombre].gasto   += (l.cantidad_pedida ?? 0) * (l.precio_unitario ?? 0)
      })
    })
    setTopIngredientes(Object.values(ingMap).sort((a, b) => b.gasto - a.gasto).slice(0, 10))

    // ── Evolución 12 meses ────────────────────────────────────────
    const evolPromises = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(año, mes - 1 - 11 + i, 1)
      const y = d.getFullYear(), m = d.getMonth() + 1
      const ini = `${y}-${String(m).padStart(2,'0')}-01`
      const fin = new Date(y, m, 0).toISOString().split('T')[0]
      return Promise.all([
        supabase.from('pedidos_proveedor')
          .select('pedidos_lineas(cantidad_pedida, precio_unitario)')
          .gte('created_at', ini + 'T00:00:00').lte('created_at', fin + 'T23:59:59').neq('estado','cancelado'),
        supabase.from('facturas')
          .select('base_imponible, total')
          .gte('fecha_factura', ini).lte('fecha_factura', fin).neq('estado','error'),
      ]).then(([{ data: peds }, { data: facts }]) => {
        const gastoPeds = (peds ?? []).reduce((s: number, p: any) =>
          s + (p.pedidos_lineas ?? []).reduce((ss: number, l: any) => ss + (l.cantidad_pedida ?? 0) * (l.precio_unitario ?? 0), 0), 0)
        const gastoFacts = (facts ?? []).reduce((s: number, f: any) => s + (f.base_imponible ?? f.total ?? 0), 0)
        return { mes: MESES_CORTOS[m - 1], gasto: Math.round((gastoPeds + gastoFacts) * 100) / 100 }
      })
    })
    setEvolucionMensual(await Promise.all(evolPromises))

    // ── Presupuesto P&L ───────────────────────────────────────────
    const { data: pl } = await supabase.from('pl_datos').select('valor_presupuesto')
      .eq('mes', mes).eq('año', año).eq('partida', 'proveedores').maybeSingle()
    setPresupuesto(pl?.valor_presupuesto ?? null)

    setLoading(false)
  }, [mes, año])

  useEffect(() => { cargar() }, [cargar])

  const totalMes        = useMemo(() => resumenProveedores.reduce((s, p) => s + p.totalGasto, 0), [resumenProveedores])
  const totalPedidosMes = useMemo(() => resumenProveedores.reduce((s, p) => s + p.gastoPedidos, 0), [resumenProveedores])
  const totalFactsMes   = useMemo(() => resumenProveedores.reduce((s, p) => s + p.gastoFacturas, 0), [resumenProveedores])
  const desviacion      = presupuesto != null ? totalMes - presupuesto : null

  function exportarExcel() {
    const rows = resumenProveedores.map(p => ({
      Proveedor:            p.nombre,
      'Pedidos (€)':        p.gastoPedidos.toFixed(2),
      'Nº pedidos':         p.totalPedidos,
      'Facturas (€)':       p.gastoFacturas.toFixed(2),
      'Nº facturas':        p.totalFacturas,
      'Total gastado (€)':  p.totalGasto.toFixed(2),
      '% del total':        totalMes > 0 ? ((p.totalGasto / totalMes) * 100).toFixed(1) + '%' : '0%',
    }))
    rows.push({
      Proveedor:           'TOTAL',
      'Pedidos (€)':       totalPedidosMes.toFixed(2),
      'Nº pedidos':        resumenProveedores.reduce((s,p) => s + p.totalPedidos, 0) as any,
      'Facturas (€)':      totalFactsMes.toFixed(2),
      'Nº facturas':       resumenProveedores.reduce((s,p) => s + p.totalFacturas, 0) as any,
      'Total gastado (€)': totalMes.toFixed(2),
      '% del total':       '100%',
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Compras')
    XLSX.writeFile(wb, `compras_${año}_${String(mes).padStart(2,'0')}.xlsx`)
  }

  const tooltipStyle = { backgroundColor: '#1A1A1A', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <RefreshCw className="animate-spin text-[#F5B731]" size={24} />
    </div>
  )

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Total Compras</h1>
          <p className="text-sm text-gray-400 mt-0.5">Pedidos + facturas por mes y proveedor</p>
        </div>
        <div className="flex items-center gap-3">
          <select className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white"
            value={mes} onChange={e => setMes(Number(e.target.value))}>
            {MESES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
          <select className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white"
            value={año} onChange={e => setAño(Number(e.target.value))}>
            {[2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={exportarExcel}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors">
            <Download size={15} /> Exportar Excel
          </button>
        </div>
      </div>

      {/* ── KPIs principales ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-400 mb-1">Gasto total {MESES[mes-1]}</p>
          <p className="text-3xl font-black text-gray-900">{totalMes.toFixed(2)} €</p>
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <ShoppingCart size={11} className="text-gray-400" />
              Pedidos: <span className="font-semibold">{totalPedidosMes.toFixed(2)} €</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Receipt size={11} className="text-gray-400" />
              Facturas: <span className="font-semibold">{totalFactsMes.toFixed(2)} €</span>
            </div>
          </div>
        </div>
        <div className={`rounded-xl border p-5 ${
          presupuesto != null
            ? (desviacion! > 0 ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200')
            : 'bg-gray-50 border-gray-200'
        }`}>
          <p className="text-xs text-gray-400 mb-1">Presupuesto P&L</p>
          <p className="text-3xl font-black text-gray-900">{presupuesto != null ? `${presupuesto.toFixed(2)} €` : '—'}</p>
          {desviacion != null && (
            <div className="flex items-center gap-1 mt-1">
              {desviacion > 0
                ? <TrendingUp  size={12} className="text-rose-600" />
                : desviacion < 0
                ? <TrendingDown size={12} className="text-emerald-600" />
                : <Minus size={12} className="text-gray-400" />}
              <span className={`text-xs font-semibold ${desviacion > 0 ? 'text-rose-600' : desviacion < 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                {desviacion > 0 ? '+' : ''}{desviacion.toFixed(2)} € vs presupuesto
              </span>
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-400 mb-1">Top proveedor</p>
          <p className="text-lg font-bold text-gray-900 truncate">{resumenProveedores[0]?.nombre ?? '—'}</p>
          <p className="text-xs text-gray-400 mt-1">
            {resumenProveedores[0]
              ? `${resumenProveedores[0].totalGasto.toFixed(2)} € · ${totalMes > 0 ? ((resumenProveedores[0].totalGasto/totalMes)*100).toFixed(0) : 0}% del total`
              : 'Sin datos'}
          </p>
        </div>
      </div>

      {/* ── Gráfico barras por proveedor ──────────────────────────── */}
      {resumenProveedores.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Gasto por proveedor — {MESES[mes-1]} {año}</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={resumenProveedores.slice(0,8)} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="nombre" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                tickFormatter={v => v.length > 12 ? v.slice(0,12)+'…' : v} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}€`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`${Number(v).toFixed(2)} €`, 'Gasto']} />
              <Bar dataKey="gastoPedidos" stackId="a" radius={[0, 0, 0, 0]} fill="#e5e7eb" name="Pedidos" />
              <Bar dataKey="gastoFacturas" stackId="a" radius={[6, 6, 0, 0]} name="Facturas">
                {resumenProveedores.slice(0,8).map((_, i) => (
                  <Cell key={i} fill={i === 0 ? '#F5B731' : '#a78bfa'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2 justify-center">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <div className="w-3 h-3 rounded-sm bg-gray-200" /> Pedidos/albaranes
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <div className="w-3 h-3 rounded-sm bg-violet-400" /> Facturas
            </div>
          </div>
        </div>
      )}

      {/* ── Evolución mensual ────────────────────────────────────── */}
      {evolucionMensual.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Evolución mensual — últimos 12 meses (pedidos + facturas)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={evolucionMensual} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}€`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`${Number(v).toFixed(2)} €`, 'Gasto total']} />
              <Line type="monotone" dataKey="gasto" stroke="#F5B731" strokeWidth={3}
                dot={{ fill: '#F5B731', r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Tabla detallada proveedores + desglose ────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Top proveedores — desglose</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {resumenProveedores.slice(0, 6).map((p, i) => (
              <div key={String(p.proveedor_id)} className="px-5 py-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${i === 0 ? 'bg-[#F5B731] text-[#1A1A1A]' : 'bg-gray-100 text-gray-600'}`}>{i+1}</span>
                    <span className="text-sm text-gray-700 font-medium truncate max-w-[140px]">{p.nombre}</span>
                  </div>
                  <p className="text-sm font-bold text-gray-900">{p.totalGasto.toFixed(2)} €</p>
                </div>
                {(p.gastoPedidos > 0 || p.gastoFacturas > 0) && (
                  <div className="ml-9 flex items-center gap-3">
                    {p.gastoPedidos > 0 && (
                      <span className="flex items-center gap-1 text-[10px] text-gray-400">
                        <ShoppingCart size={9} /> {p.gastoPedidos.toFixed(2)} € ({p.totalPedidos} ped.)
                      </span>
                    )}
                    {p.gastoFacturas > 0 && (
                      <span className="flex items-center gap-1 text-[10px] text-violet-500">
                        <Receipt size={9} /> {p.gastoFacturas.toFixed(2)} € ({p.totalFacturas} fact.)
                      </span>
                    )}
                    <span className="text-[10px] text-gray-400 ml-auto">
                      {totalMes > 0 ? ((p.totalGasto/totalMes)*100).toFixed(1) : 0}%
                    </span>
                  </div>
                )}
              </div>
            ))}
            {resumenProveedores.length === 0 && (
              <p className="px-5 py-6 text-sm text-gray-400 text-center">Sin datos para este mes</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Top 10 ingredientes más comprados</h2>
          </div>
          <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
            {topIngredientes.map((ing, i) => (
              <div key={ing.nombre} className="px-5 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-gray-400 w-5 text-right flex-shrink-0">{i+1}</span>
                  <span className="text-sm text-gray-700 truncate">{ing.nombre}</span>
                </div>
                <span className="text-sm font-bold text-gray-900 flex-shrink-0 ml-2">{ing.gasto.toFixed(2)} €</span>
              </div>
            ))}
            {topIngredientes.length === 0 && (
              <p className="px-5 py-6 text-sm text-gray-400 text-center">Sin datos para este mes</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

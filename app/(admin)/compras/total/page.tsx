'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { RefreshCw, Download, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Cell,
} from 'recharts'

const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const COLORES = ['#F5B731','#1A1A1A','#10b981','#3b82f6','#8b5cf6','#ef4444','#f97316','#06b6d4']

type Resumen = { proveedor_id: number; nombre: string; totalPedidos: number; totalGasto: number }
type Mensual = { mes: string; gasto: number }
type TopIng = { nombre: string; cantidad: number; gasto: number }

export default function PaginaTotalCompras() {
  const hoy = new Date()
  const [mes, setMes] = useState(hoy.getMonth() + 1)
  const [año, setAño] = useState(hoy.getFullYear())
  const [loading, setLoading] = useState(true)
  const [resumenProveedores, setResumenProveedores] = useState<Resumen[]>([])
  const [evolucionMensual, setEvolucionMensual] = useState<Mensual[]>([])
  const [topIngredientes, setTopIngredientes] = useState<TopIng[]>([])
  const [presupuesto, setPresupuesto] = useState<number | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    const primerDia = `${año}-${String(mes).padStart(2,'0')}-01`
    const ultimoDia = new Date(año, mes, 0).toISOString().split('T')[0]

    // Pedidos del mes con líneas
    const { data: pedidos } = await supabase
      .from('pedidos_proveedor')
      .select('id, proveedor_id, proveedores(nombre), pedidos_lineas(cantidad_pedida, precio_unitario, ingredientes(nombre_ingrediente))')
      .gte('created_at', primerDia + 'T00:00:00')
      .lte('created_at', ultimoDia + 'T23:59:59')
      .neq('estado', 'cancelado')

    // Agrupar por proveedor
    const mapaProvs: Record<number, Resumen> = {}
    ;(pedidos ?? []).forEach((p: any) => {
      const id = p.proveedor_id
      if (!mapaProvs[id]) mapaProvs[id] = { proveedor_id: id, nombre: p.proveedores?.nombre ?? '—', totalPedidos: 0, totalGasto: 0 }
      mapaProvs[id].totalPedidos += 1
      ;(p.pedidos_lineas ?? []).forEach((l: any) => {
        mapaProvs[id].totalGasto += (l.cantidad_pedida ?? 0) * (l.precio_unitario ?? 0)
      })
    })
    setResumenProveedores(Object.values(mapaProvs).sort((a, b) => b.totalGasto - a.totalGasto))

    // Top 10 ingredientes más comprados
    const ingMap: Record<string, { nombre: string; cantidad: number; gasto: number }> = {}
    ;(pedidos ?? []).forEach((p: any) => {
      ;(p.pedidos_lineas ?? []).forEach((l: any) => {
        const nombre = l.ingredientes?.nombre_ingrediente ?? 'Sin nombre'
        if (!ingMap[nombre]) ingMap[nombre] = { nombre, cantidad: 0, gasto: 0 }
        ingMap[nombre].cantidad += l.cantidad_pedida ?? 0
        ingMap[nombre].gasto += (l.cantidad_pedida ?? 0) * (l.precio_unitario ?? 0)
      })
    })
    setTopIngredientes(Object.values(ingMap).sort((a, b) => b.gasto - a.gasto).slice(0, 10))

    // Evolución 12 meses
    const evolPromises = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(año, mes - 1 - 11 + i, 1)
      const y = d.getFullYear(), m = d.getMonth() + 1
      const ini = `${y}-${String(m).padStart(2,'0')}-01`
      const fin = new Date(y, m, 0).toISOString().split('T')[0]
      return supabase.from('pedidos_proveedor')
        .select('pedidos_lineas(cantidad_pedida, precio_unitario)')
        .gte('created_at', ini + 'T00:00:00').lte('created_at', fin + 'T23:59:59').neq('estado','cancelado')
        .then(({ data }) => {
          const total = (data ?? []).reduce((s: number, p: any) =>
            s + (p.pedidos_lineas ?? []).reduce((ss: number, l: any) => ss + (l.cantidad_pedida ?? 0) * (l.precio_unitario ?? 0), 0), 0)
          return { mes: MESES_CORTOS[m - 1], gasto: Math.round(total * 100) / 100 }
        })
    })
    setEvolucionMensual(await Promise.all(evolPromises))

    // Presupuesto desde P&L
    const { data: pl } = await supabase.from('pl_datos').select('valor_presupuesto')
      .eq('mes', mes).eq('año', año).eq('partida', 'proveedores').maybeSingle()
    setPresupuesto(pl?.valor_presupuesto ?? null)

    setLoading(false)
  }, [mes, año])

  useEffect(() => { cargar() }, [cargar])

  const totalMes = useMemo(() => resumenProveedores.reduce((s, p) => s + p.totalGasto, 0), [resumenProveedores])
  const desviacion = presupuesto != null ? totalMes - presupuesto : null

  function exportarExcel() {
    const rows = resumenProveedores.map(p => ({
      Proveedor: p.nombre,
      'Nº pedidos': p.totalPedidos,
      'Total gastado (€)': p.totalGasto.toFixed(2),
      '% del total': totalMes > 0 ? ((p.totalGasto / totalMes) * 100).toFixed(1) + '%' : '0%',
    }))
    rows.push({ Proveedor: 'TOTAL', 'Nº pedidos': resumenProveedores.reduce((s,p)=>s+p.totalPedidos,0) as any, 'Total gastado (€)': totalMes.toFixed(2), '% del total': '100%' })
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Compras')
    XLSX.writeFile(wb, `compras_${año}_${String(mes).padStart(2,'0')}.xlsx`)
  }

  const tooltipStyle = { backgroundColor: '#1A1A1A', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><RefreshCw className="animate-spin text-[#F5B731]" size={24} /></div>

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Total Compras</h1>
          <p className="text-sm text-gray-400 mt-0.5">Resumen de gasto en compras por mes</p>
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
          <button onClick={exportarExcel} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors">
            <Download size={15} /> Exportar Excel
          </button>
        </div>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-400 mb-1">Gasto total {MESES[mes-1]}</p>
          <p className="text-3xl font-black text-gray-900">{totalMes.toFixed(2)} €</p>
          <p className="text-xs text-gray-400 mt-1">{resumenProveedores.reduce((s,p)=>s+p.totalPedidos,0)} pedidos · {resumenProveedores.length} proveedores</p>
        </div>
        <div className={`rounded-xl border p-5 ${presupuesto != null ? (desviacion! > 0 ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200') : 'bg-gray-50 border-gray-200'}`}>
          <p className="text-xs text-gray-400 mb-1">Presupuesto P&L</p>
          <p className="text-3xl font-black text-gray-900">{presupuesto != null ? `${presupuesto.toFixed(2)} €` : '—'}</p>
          {desviacion != null && (
            <div className="flex items-center gap-1 mt-1">
              {desviacion > 0 ? <TrendingUp size={12} className="text-rose-600" /> : desviacion < 0 ? <TrendingDown size={12} className="text-emerald-600" /> : <Minus size={12} className="text-gray-400" />}
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
            {resumenProveedores[0] ? `${resumenProveedores[0].totalGasto.toFixed(2)} € · ${totalMes > 0 ? ((resumenProveedores[0].totalGasto/totalMes)*100).toFixed(0) : 0}% del total` : 'Sin datos'}
          </p>
        </div>
      </div>

      {/* Gráfico barras por proveedor */}
      {resumenProveedores.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Gasto por proveedor — {MESES[mes-1]} {año}</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={resumenProveedores.slice(0,8)} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="nombre" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                tickFormatter={v => v.length > 12 ? v.slice(0,12)+'…' : v} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                tickFormatter={v => `${v}€`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`${Number(v).toFixed(2)} €`, 'Gasto']} />
              <Bar dataKey="totalGasto" radius={[6, 6, 0, 0]}>
                {resumenProveedores.slice(0,8).map((_, i) => (
                  <Cell key={i} fill={i === 0 ? '#F5B731' : '#e5e7eb'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Gráfico evolución mensual */}
      {evolucionMensual.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Evolución mensual — últimos 12 meses</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={evolucionMensual} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}€`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`${Number(v).toFixed(2)} €`, 'Gasto']} />
              <Line type="monotone" dataKey="gasto" stroke="#F5B731" strokeWidth={3} dot={{ fill: '#F5B731', r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabla proveedores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Top 5 proveedores por gasto</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {resumenProveedores.slice(0, 5).map((p, i) => (
              <div key={p.proveedor_id} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${i === 0 ? 'bg-[#F5B731] text-[#1A1A1A]' : 'bg-gray-100 text-gray-600'}`}>{i+1}</span>
                  <span className="text-sm text-gray-700 font-medium">{p.nombre}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">{p.totalGasto.toFixed(2)} €</p>
                  <p className="text-xs text-gray-400">{totalMes > 0 ? ((p.totalGasto/totalMes)*100).toFixed(1) : 0}% · {p.totalPedidos} pedido{p.totalPedidos !== 1 ? 's' : ''}</p>
                </div>
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

'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { Empleado, Fichaje } from '@/lib/supabase'
import { AlertTriangle, RefreshCw, TrendingUp } from 'lucide-react'

function mesActual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function diasMes(mes: string): number {
  const [y, m] = mes.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

function labelMes(mes: string): string {
  const [y, m] = mes.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
}

export default function PaginaCostes() {
  const [mes, setMes] = useState(mesActual)
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [fichajes, setFichajes] = useState<Fichaje[]>([])
  const [ventasMes, setVentasMes] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargar() {
      setLoading(true)
      const primerDia = `${mes}-01`
      const ultimoDia = `${mes}-${String(diasMes(mes)).padStart(2, '0')}`

      const [{ data: emps }, { data: fichs }, { data: ventas }] = await Promise.all([
        supabase.from('empleados').select('*').eq('activo', true).order('nombre'),
        supabase.from('fichajes').select('*').gte('fecha', primerDia).lte('fecha', ultimoDia),
        supabase.from('ventas').select('total_ventas').gte('fecha', primerDia).lte('fecha', ultimoDia),
      ])

      setEmpleados(emps ?? [])
      setFichajes(fichs ?? [])
      setVentasMes((ventas ?? []).reduce((s, v) => s + (v.total_ventas ?? 0), 0))
      setLoading(false)
    }
    cargar()
  }, [mes])

  const filas = useMemo(() => {
    return empleados.map((emp) => {
      const fichajesEmp = fichajes.filter((f) => f.empleado_id === emp.id)
      const horasReales = fichajesEmp.reduce((s, f) => s + (f.horas_total ?? 0), 0)
      const horasExtra = fichajesEmp.reduce((s, f) => s + (f.horas_extra ?? 0), 0)
      const horasNocturnas = fichajesEmp.reduce((s, f) => s + (f.horas_nocturnas ?? 0), 0)
      const horasContrato = Number(emp.horas_contrato) * 4.33
      const tieneFichajes = fichajesEmp.length > 0

      let costeEstimado: number | null = null
      if (emp.salario_bruto) {
        if (tieneFichajes) {
          const costeHora = (emp.salario_bruto * emp.coste_empresa_pct) / horasContrato
          costeEstimado = horasReales * costeHora
        } else {
          costeEstimado = emp.salario_bruto * emp.coste_empresa_pct
        }
      }

      return {
        emp,
        horasReales,
        horasExtra,
        horasNocturnas,
        horasContrato,
        tieneFichajes,
        costeEstimado,
      }
    })
  }, [empleados, fichajes])

  const totalCoste = filas.reduce((s, r) => s + (r.costeEstimado ?? 0), 0)
  const pctVentas = ventasMes > 0 ? (totalCoste / ventasMes) * 100 : null
  const alertaCostes = pctVentas !== null && pctVentas > 30

  // Opciones de meses (últimos 12)
  const mesesOpciones = useMemo(() => {
    const opts = []
    const hoy = new Date()
    for (let i = 0; i < 12; i++) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      opts.push({ val, label: labelMes(val) })
    }
    return opts
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="animate-spin text-[#F5B731]" size={24} />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Costes de Personal</h1>
          <p className="text-sm text-gray-400 mt-0.5">Estimación mensual por empleado</p>
        </div>
        <select
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white capitalize"
          value={mes}
          onChange={(e) => setMes(e.target.value)}
        >
          {mesesOpciones.map((o) => (
            <option key={o.val} value={o.val} className="capitalize">{o.label}</option>
          ))}
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-2xl font-bold text-gray-900">
            {totalCoste > 0 ? totalCoste.toLocaleString('es-ES', { minimumFractionDigits: 0 }) + ' €' : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Coste total estimado</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-2xl font-bold text-gray-900">
            {ventasMes > 0 ? ventasMes.toLocaleString('es-ES', { minimumFractionDigits: 0 }) + ' €' : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Ventas del mes</p>
        </div>
        <div className={`rounded-xl border p-4 ${alertaCostes ? 'bg-rose-50 border-rose-200' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-2">
            <p className={`text-2xl font-bold ${alertaCostes ? 'text-rose-700' : 'text-gray-900'}`}>
              {pctVentas !== null ? pctVentas.toFixed(1) + '%' : '—'}
            </p>
            {alertaCostes && <AlertTriangle size={18} className="text-rose-500" />}
          </div>
          <p className={`text-xs mt-0.5 ${alertaCostes ? 'text-rose-500' : 'text-gray-400'}`}>
            {alertaCostes ? '¡Coste personal supera el 30% de ventas!' : '% sobre ventas'}
          </p>
        </div>
      </div>

      {alertaCostes && (
        <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 mb-5">
          <AlertTriangle size={16} className="text-rose-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-rose-700">
            El coste estimado de personal ({pctVentas!.toFixed(1)}% sobre ventas) supera el umbral recomendado del 30%.
            Revisa las horas asignadas o los salarios.
          </p>
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-400">{empleados.length} empleados · {labelMes(mes)}</span>
          <div className="flex items-center gap-1.5">
            <TrendingUp size={13} className="text-gray-400" />
            <span className="text-xs text-gray-400">Coste empresa = salario × {(empleados[0]?.coste_empresa_pct ?? 1.31).toFixed(2)}</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 font-medium">Empleado</th>
                <th className="text-right px-4 py-3 font-medium">Salario bruto</th>
                <th className="text-right px-4 py-3 font-medium">H. contrato/mes</th>
                <th className="text-right px-4 py-3 font-medium">H. trabajadas</th>
                <th className="text-right px-4 py-3 font-medium">H. extra</th>
                <th className="text-right px-4 py-3 font-medium">H. nocturnas</th>
                <th className="text-right px-5 py-3 font-medium">Coste estimado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filas.map(({ emp, horasReales, horasExtra, horasNocturnas, horasContrato, tieneFichajes, costeEstimado }) => (
                <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-800">{emp.nombre}</p>
                    <p className="text-xs text-gray-400">{emp.puesto} · {emp.horas_contrato}h/sem</p>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {emp.salario_bruto ? `${emp.salario_bruto.toLocaleString('es-ES')} €` : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{horasContrato.toFixed(0)}h</td>
                  <td className="px-4 py-3 text-right">
                    {tieneFichajes ? (
                      <span className={horasReales < horasContrato * 0.8 ? 'text-amber-600 font-medium' : 'text-gray-700'}>
                        {horasReales.toFixed(1)}h
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400 italic">estimado</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {horasExtra > 0 ? <span className="text-amber-600 font-medium">{horasExtra.toFixed(1)}h</span> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {horasNocturnas > 0 ? <span className="text-blue-600 font-medium">{horasNocturnas.toFixed(1)}h</span> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {costeEstimado !== null ? (
                      <span className="font-semibold text-gray-800">
                        {costeEstimado.toLocaleString('es-ES', { minimumFractionDigits: 0 })} €
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400 italic">sin salario</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {totalCoste > 0 && (
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td colSpan={6} className="px-5 py-3 text-sm font-semibold text-gray-700 text-right">
                    Total coste estimado
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-gray-900 text-base">
                    {totalCoste.toLocaleString('es-ES', { minimumFractionDigits: 0 })} €
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-3">
        * El coste estimado usa horas reales del período cuando hay fichajes registrados; de lo contrario usa el salario bruto × multiplicador.
      </p>
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import {
  RefreshCw, Archive, Lock, Download, ChevronRight, ArrowLeft,
  Save, AlertTriangle, TrendingUp, TrendingDown, Minus,
} from 'lucide-react'

// ── Tipos ────────────────────────────────────────────────────────────────────

type ConteoFull = {
  id: number
  empleado_id: number
  fecha: string
  local_id: number | null
  ingrediente_id: number
  cantidad: number
  cerrado: boolean
  inventario_grupo_id: string | null
  created_at: string
  empleados: { nombre: string } | null
  locales:   { nombre: string } | null
  ingredientes: {
    nombre_ingrediente: string
    precio_unidad_producto: number | null
    proveedor: string | null
    unidad_compra: string | null
    unidad_producto: string | null
  } | null
}

type GrupoInventario = {
  key: string
  grupo_id: string | null
  empleado_id: number
  empleado_nombre: string
  local_id: number | null
  local_nombre: string | null
  fecha: string
  num_items: number
  coste_total: number
  cerrado: boolean
  rows: ConteoFull[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function groupKey(r: ConteoFull) {
  return `${r.empleado_id}|${r.local_id ?? 'null'}|${r.fecha}`
}

function formatEur(n: number) {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function formatFecha(f: string) {
  return new Date(f + 'T12:00:00').toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function costeConteo(r: ConteoFull) {
  return (r.cantidad ?? 0) * (r.ingredientes?.precio_unidad_producto ?? 0)
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function PaginaInventarioAdmin() {
  const [conteos, setConteos] = useState<ConteoFull[]>([])
  const [loading, setLoading] = useState(true)
  const [grupo, setGrupo] = useState<GrupoInventario | null>(null)
  // edición en detalle: mapa id→cantEdit
  const [edits, setEdits] = useState<Record<number, string>>({})
  const [guardando, setGuardando] = useState(false)
  const [cerrando, setCerrando] = useState(false)
  const [confirmCerrar, setConfirmCerrar] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('inventario_conteos')
      .select(`
        *,
        empleados(nombre),
        locales(nombre),
        ingredientes(nombre_ingrediente, precio_unidad_producto, proveedor, unidad_compra, unidad_producto)
      `)
      .order('fecha', { ascending: false })
      .order('empleado_id')
    setConteos((data as ConteoFull[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // ── Agrupación ───────────────────────────────────────────────────────────

  const grupos = useMemo<GrupoInventario[]>(() => {
    const map = new Map<string, GrupoInventario>()
    conteos.forEach((r) => {
      const k = groupKey(r)
      if (!map.has(k)) {
        map.set(k, {
          key: k,
          grupo_id: r.inventario_grupo_id,
          empleado_id: r.empleado_id,
          empleado_nombre: r.empleados?.nombre ?? `Empleado ${r.empleado_id}`,
          local_id: r.local_id,
          local_nombre: r.locales?.nombre ?? null,
          fecha: r.fecha,
          num_items: 0,
          coste_total: 0,
          cerrado: r.cerrado,
          rows: [],
        })
      }
      const g = map.get(k)!
      g.rows.push(r)
      g.num_items++
      g.coste_total += costeConteo(r)
      if (!r.cerrado) g.cerrado = false // si alguno está abierto, el grupo está abierto
    })
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
    )
  }, [conteos])

  // ── Abrir grupo ──────────────────────────────────────────────────────────

  function abrirGrupo(g: GrupoInventario) {
    setGrupo(g)
    const initEdits: Record<number, string> = {}
    g.rows.forEach((r) => { initEdits[r.id] = r.cantidad != null ? String(r.cantidad) : '' })
    setEdits(initEdits)
    setConfirmCerrar(false)
  }

  function cerrarVista() {
    setGrupo(null)
    setEdits({})
    setConfirmCerrar(false)
  }

  // ── Inventario anterior (misma persona y local, fecha más reciente anterior) ──

  const inventarioAnterior = useMemo<GrupoInventario | null>(() => {
    if (!grupo) return null
    const candidatos = grupos.filter(
      (g) =>
        g.empleado_id === grupo.empleado_id &&
        g.local_id === grupo.local_id &&
        g.fecha < grupo.fecha
    )
    return candidatos[0] ?? null // ya está ordenado desc por fecha
  }, [grupo, grupos])

  // ── Guardar ediciones ────────────────────────────────────────────────────

  async function guardarEdiciones() {
    if (!grupo) return
    setGuardando(true)
    const updates = Object.entries(edits).map(([idStr, cantStr]) =>
      supabase
        .from('inventario_conteos')
        .update({ cantidad: parseFloat(cantStr) || 0 })
        .eq('id', Number(idStr))
    )
    await Promise.all(updates)
    setGuardando(false)
    await cargar()
    // Refrescar el grupo activo
    setGrupo((prev) => {
      if (!prev) return null
      const rows = prev.rows.map((r) => ({
        ...r,
        cantidad: parseFloat(edits[r.id] ?? String(r.cantidad)) || 0,
      }))
      const coste_total = rows.reduce((s, r) => s + costeConteo(r), 0)
      return { ...prev, rows, coste_total }
    })
  }

  // ── Cerrar inventario ────────────────────────────────────────────────────

  async function cerrarInventario() {
    if (!grupo) return
    setCerrando(true)
    // Guardar ediciones y marcar cerrado en cada fila
    await Promise.all(
      Object.entries(edits).map(([idStr, cantStr]) =>
        supabase.from('inventario_conteos')
          .update({ cantidad: parseFloat(cantStr) || 0, cerrado: true })
          .eq('id', Number(idStr))
      )
    )
    // Cerrar también cualquier fila del mismo grupo que no estuviera en edits
    if (grupo.grupo_id) {
      await supabase.from('inventario_conteos')
        .update({ cerrado: true })
        .eq('inventario_grupo_id', grupo.grupo_id)
    } else {
      let q = supabase.from('inventario_conteos')
        .update({ cerrado: true })
        .eq('empleado_id', grupo.empleado_id)
        .eq('fecha', grupo.fecha)
      if (grupo.local_id !== null) q = q.eq('local_id', grupo.local_id)
      else q = q.is('local_id', null)
      await q
    }
    setCerrando(false)
    setConfirmCerrar(false)
    setGrupo((prev) => prev ? { ...prev, cerrado: true } : null)
    cargar()
  }

  // ── Excel ────────────────────────────────────────────────────────────────

  function exportarExcel() {
    if (!grupo) return
    const agrupado = agruparPorProveedor(grupo.rows)
    const rows: Record<string, string | number>[] = []

    agrupado.forEach(([prov, items]) => {
      rows.push({ Proveedor: `── ${prov} ──`, Ingrediente: '', Unidad: '', Cantidad: '', 'Precio/ud (€)': '', 'Total (€)': '', 'Anterior': '', 'Variación': '' })
      items.forEach((r) => {
        const prev = inventarioAnterior?.rows.find((p) => p.ingrediente_id === r.ingrediente_id)
        const cant = parseFloat(edits[r.id] ?? String(r.cantidad)) || 0
        const precio = r.ingredientes?.precio_unidad_producto ?? 0
        const total = cant * precio
        const cantPrev = prev?.cantidad ?? null
        const varPct = cantPrev != null && cantPrev > 0
          ? ((cant - cantPrev) / cantPrev * 100).toFixed(1) + '%'
          : cantPrev === 0 && cant > 0 ? 'Nuevo' : '—'
        rows.push({
          Proveedor: prov,
          Ingrediente: r.ingredientes?.nombre_ingrediente ?? `#${r.ingrediente_id}`,
          Unidad: r.ingredientes?.unidad_compra ?? r.ingredientes?.unidad_producto ?? '',
          Cantidad: cant,
          'Precio/ud (€)': precio || '',
          'Total (€)': total > 0 ? Number(total.toFixed(4)) : '',
          Anterior: cantPrev ?? '',
          Variación: varPct,
        })
      })
      const subtotal = items.reduce((s, r) => {
        const cant = parseFloat(edits[r.id] ?? String(r.cantidad)) || 0
        return s + cant * (r.ingredientes?.precio_unidad_producto ?? 0)
      }, 0)
      rows.push({ Proveedor: '', Ingrediente: `Subtotal ${prov}`, Unidad: '', Cantidad: '', 'Precio/ud (€)': '', 'Total (€)': Number(subtotal.toFixed(2)), Anterior: '', Variación: '' })
    })

    rows.push({ Proveedor: '', Ingrediente: 'TOTAL INVENTARIO', Unidad: '', Cantidad: '', 'Precio/ud (€)': '', 'Total (€)': Number(grupo.coste_total.toFixed(2)), Anterior: '', Variación: '' })

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Inventario')
    XLSX.writeFile(wb, `inventario_${grupo.empleado_nombre}_${grupo.fecha}.xlsx`)
  }

  // ── Agrupar por proveedor ────────────────────────────────────────────────

  function agruparPorProveedor(rows: ConteoFull[]) {
    const map = new Map<string, ConteoFull[]>()
    rows.forEach((r) => {
      const p = r.ingredientes?.proveedor?.trim() || 'Sin proveedor'
      if (!map.has(p)) map.set(p, [])
      map.get(p)!.push(r)
    })
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="animate-spin text-[#F5B731]" size={24} />
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VISTA DETALLE INVENTARIO
  // ══════════════════════════════════════════════════════════════════════════

  if (grupo) {
    const esCerrado = grupo.cerrado
    const agrupado = agruparPorProveedor(grupo.rows)
    const totalEdicion = grupo.rows.reduce((s, r) => {
      const cant = parseFloat(edits[r.id] ?? String(r.cantidad)) || 0
      return s + cant * (r.ingredientes?.precio_unidad_producto ?? 0)
    }, 0)
    const totalAnterior = inventarioAnterior?.coste_total ?? 0
    const variacion = totalAnterior > 0 ? ((totalEdicion - totalAnterior) / totalAnterior * 100) : null

    return (
      <div className="p-6 max-w-6xl">
        {/* Cabecera */}
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={cerrarVista} className="text-gray-400 hover:text-gray-700 transition-colors">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Inventario del {formatFecha(grupo.fecha)}
              </h1>
              <p className="text-sm text-gray-400 mt-0.5">
                {grupo.empleado_nombre}
                {grupo.local_nombre && <span> · {grupo.local_nombre}</span>}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${
              esCerrado ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {esCerrado ? <><Lock size={11} /> Cerrado</> : '✏️ Abierto'}
            </span>
            <button
              onClick={exportarExcel}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-[#1A1A1A] text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              <Download size={13} /> Excel
            </button>
            {!esCerrado && (
              <>
                <button
                  onClick={guardarEdiciones}
                  disabled={guardando}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-[#F5B731] text-[#1A1A1A] rounded-lg hover:bg-[#e0a820] disabled:opacity-50 transition-colors"
                >
                  {guardando ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                  {guardando ? 'Guardando...' : 'Guardar cambios'}
                </button>
                <button
                  onClick={() => setConfirmCerrar(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors"
                >
                  <Lock size={13} /> Cerrar inventario
                </button>
              </>
            )}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-400 mb-1">Total inventario</p>
            <p className="text-2xl font-bold text-gray-900">{formatEur(totalEdicion)}</p>
            <p className="text-xs text-gray-400 mt-1">{grupo.num_items} ingredientes</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-400 mb-1">Inventario anterior</p>
            {inventarioAnterior ? (
              <>
                <p className="text-2xl font-bold text-gray-700">{formatEur(totalAnterior)}</p>
                <p className="text-xs text-gray-400 mt-1">{formatFecha(inventarioAnterior.fecha)}</p>
              </>
            ) : (
              <p className="text-2xl font-bold text-gray-200">—</p>
            )}
          </div>
          <div className={`rounded-xl border p-4 ${
            variacion == null ? 'bg-gray-50 border-gray-200'
            : variacion > 0 ? 'bg-rose-50 border-rose-200'
            : variacion < 0 ? 'bg-emerald-50 border-emerald-200'
            : 'bg-gray-50 border-gray-200'
          }`}>
            <p className="text-xs text-gray-400 mb-1">Variación vs anterior</p>
            <p className={`text-2xl font-bold flex items-center gap-1 ${
              variacion == null ? 'text-gray-300'
              : variacion > 0 ? 'text-rose-600'
              : variacion < 0 ? 'text-emerald-600'
              : 'text-gray-500'
            }`}>
              {variacion == null ? '—' : (
                <>
                  {variacion > 0 ? <TrendingUp size={22} /> : variacion < 0 ? <TrendingDown size={22} /> : <Minus size={22} />}
                  {variacion > 0 ? '+' : ''}{variacion.toFixed(1)}%
                </>
              )}
            </p>
            {variacion != null && (
              <p className={`text-xs mt-1 ${variacion > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                {variacion > 0 ? '+' : ''}{formatEur(totalEdicion - totalAnterior)}
              </p>
            )}
          </div>
        </div>

        {/* Tabla por proveedor */}
        <div className="space-y-4">
          {agrupado.map(([proveedor, items]) => {
            const subtotal = items.reduce((s, r) => {
              const cant = parseFloat(edits[r.id] ?? String(r.cantidad)) || 0
              return s + cant * (r.ingredientes?.precio_unidad_producto ?? 0)
            }, 0)
            return (
              <div key={proveedor} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">{proveedor}</p>
                  <p className="text-xs font-semibold text-gray-500">{formatEur(subtotal)}</p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-50">
                      <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400">Ingrediente</th>
                      <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-400">Unidad</th>
                      <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-400">Cantidad</th>
                      <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-400">€/ud</th>
                      <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-400">Total</th>
                      {inventarioAnterior && (
                        <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-400">Anterior / Var.</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {items.map((r) => {
                      const precio = r.ingredientes?.precio_unidad_producto ?? 0
                      const cantEdit = edits[r.id] ?? String(r.cantidad)
                      const cant = parseFloat(cantEdit) || 0
                      const total = cant * precio
                      const prev = inventarioAnterior?.rows.find(
                        (p) => p.ingrediente_id === r.ingrediente_id
                      )
                      const cantPrev = prev?.cantidad ?? null
                      const diff = cantPrev != null ? cant - cantPrev : null

                      return (
                        <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-5 py-2.5 font-medium text-gray-800">
                            {r.ingredientes?.nombre_ingrediente ?? `Ingrediente #${r.ingrediente_id}`}
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs text-gray-400">
                            {r.ingredientes?.unidad_compra ?? r.ingredientes?.unidad_producto ?? '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            {esCerrado ? (
                              <span className="font-semibold text-gray-800 tabular-nums">{r.cantidad}</span>
                            ) : (
                              <input
                                type="number"
                                min="0"
                                step="0.001"
                                value={cantEdit}
                                onChange={(e) => setEdits((prev) => ({ ...prev, [r.id]: e.target.value }))}
                                className="w-24 px-2 py-1 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#F5B731] bg-white tabular-nums"
                              />
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right text-sm text-gray-500 tabular-nums">
                            {precio > 0 ? `${precio} €` : '—'}
                          </td>
                          <td className={`px-5 py-2.5 text-right font-semibold tabular-nums ${
                            total > 0 ? 'text-gray-900' : 'text-gray-200'
                          }`}>
                            {total > 0 ? formatEur(total) : '—'}
                          </td>
                          {inventarioAnterior && (
                            <td className="px-5 py-2.5 text-right text-xs tabular-nums">
                              {cantPrev != null ? (
                                <span className={
                                  diff != null && Math.abs(diff) > 0.001
                                    ? diff > 0 ? 'text-rose-600 font-medium' : 'text-emerald-600 font-medium'
                                    : 'text-gray-400'
                                }>
                                  {cantPrev}
                                  {diff != null && Math.abs(diff) > 0.001 && (
                                    <span className="ml-1">({diff > 0 ? '+' : ''}{diff.toFixed(1)})</span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-gray-300">Nuevo</span>
                              )}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 border-t border-gray-100">
                      <td colSpan={inventarioAnterior ? 4 : 4} className="px-5 py-2.5 text-xs font-semibold text-gray-500">
                        Subtotal {proveedor}
                      </td>
                      <td className="px-5 py-2.5 text-right text-sm font-bold text-gray-700 tabular-nums">
                        {formatEur(subtotal)}
                      </td>
                      {inventarioAnterior && <td />}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )
          })}

          {/* Total general */}
          <div className="bg-[#1A1A1A] text-white rounded-xl px-6 py-4 flex items-center justify-between">
            <p className="text-sm font-bold">TOTAL INVENTARIO</p>
            <p className="text-2xl font-bold tabular-nums">{formatEur(totalEdicion)}</p>
          </div>
        </div>

        {/* Modal confirmar cierre */}
        {confirmCerrar && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm mx-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                  <Lock size={18} className="text-gray-700" />
                </div>
                <p className="text-base font-bold text-gray-900">¿Cerrar inventario?</p>
              </div>
              <p className="text-sm text-gray-500 mb-2">
                Una vez cerrado no podrá editarse. Se guardará con un total de{' '}
                <strong>{formatEur(totalEdicion)}</strong>.
              </p>
              <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-5">
                <AlertTriangle size={13} className="text-amber-600 flex-shrink-0" />
                <p className="text-xs text-amber-700">Esta acción no se puede deshacer.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmCerrar(false)}
                  className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={cerrarInventario}
                  disabled={cerrando}
                  className="flex-1 py-2.5 text-sm font-bold bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  {cerrando ? 'Cerrando...' : 'Cerrar inventario'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LISTA DE INVENTARIOS
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Inventario Local</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {grupos.length} inventario{grupos.length !== 1 ? 's' : ''} registrados
        </p>
      </div>

      {grupos.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <Archive size={36} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">No hay inventarios registrados</p>
          <p className="text-xs text-gray-300 mt-1">Los empleados guardan inventarios desde su portal</p>
        </div>
      ) : (
        <div className="space-y-2">
          {grupos.map((g) => {
            const varText = (() => {
              const ant = grupos.find(
                (x) =>
                  x.empleado_id === g.empleado_id &&
                  x.local_id === g.local_id &&
                  x.fecha < g.fecha
              )
              if (!ant || ant.coste_total === 0) return null
              const pct = ((g.coste_total - ant.coste_total) / ant.coste_total * 100)
              return pct
            })()

            return (
              <button
                key={g.key}
                onClick={() => abrirGrupo(g)}
                className="w-full bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center justify-between gap-3 hover:border-[#F5B731] hover:shadow-sm transition-all text-left group"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="text-sm font-bold text-gray-800">{formatFecha(g.fecha)}</p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      g.cerrado
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {g.cerrado ? '🔒 Cerrado' : '✏️ Abierto'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    {g.empleado_nombre}
                    {g.local_nombre && <span> · {g.local_nombre}</span>}
                    <span className="ml-1">· {g.num_items} ingredientes</span>
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900 tabular-nums">
                      {g.coste_total > 0 ? formatEur(g.coste_total) : '—'}
                    </p>
                    {varText != null && (
                      <p className={`text-xs tabular-nums ${varText > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                        {varText > 0 ? '+' : ''}{varText.toFixed(1)}%
                      </p>
                    )}
                  </div>
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-[#F5B731] transition-colors" />
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

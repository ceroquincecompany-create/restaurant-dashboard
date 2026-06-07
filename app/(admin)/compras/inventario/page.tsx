'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import type { Ingrediente } from '@/lib/supabase'
import { Plus, X, RefreshCw, Archive, Lock, Download, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'

type Local = { id: number; nombre: string }
type Inventario = {
  id: number; local_id: number | null; empleado_nombre: string
  mes: number; año: number; estado: 'borrador' | 'cerrado'
  notas: string | null; total_coste: number | null; created_at: string; cerrado_at: string | null
  locales?: { nombre: string } | null
}
type Linea = {
  id: number; inventario_id: number; ingrediente_id: number | null
  nombre_ingrediente: string; unidad: string | null
  cantidad: number | null; precio_coste: number | null
}
type LineaEdit = Linea & { cantEdit: string; precioEdit: string }

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white'

export default function PaginaInventario() {
  const [inventarios, setInventarios] = useState<Inventario[]>([])
  const [locales, setLocales] = useState<Local[]>([])
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([])
  const [loading, setLoading] = useState(true)
  const [vistaId, setVistaId] = useState<number | null>(null)
  const [lineas, setLineas] = useState<LineaEdit[]>([])
  const [inventarioAbierto, setInventarioAbierto] = useState<Inventario | null>(null)
  const [inventarioAnterior, setInventarioAnterior] = useState<Linea[]>([])
  const [modalNuevo, setModalNuevo] = useState(false)
  const [fLocal, setFLocal] = useState('')
  const [fMes, setFMes] = useState(String(new Date().getMonth() + 1))
  const [fAño, setFAño] = useState(String(new Date().getFullYear()))
  const [fEmpleado, setFEmpleado] = useState('')
  const [fNotas, setFNotas] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [guardandoLineas, setGuardandoLineas] = useState(false)
  const [cerrando, setCerrando] = useState(false)
  const [fError, setFError] = useState('')
  const [confirmCerrar, setConfirmCerrar] = useState(false)

  const cargar = useCallback(async () => {
    const [{ data: inv }, { data: loc }, { data: ing }] = await Promise.all([
      supabase.from('inventarios').select('*, locales(nombre)').order('año', { ascending: false }).order('mes', { ascending: false }),
      supabase.from('locales').select('id,nombre').eq('activo', true).order('nombre'),
      supabase.from('ingredientes').select('*').order('nombre_ingrediente'),
    ])
    setInventarios(inv ?? [])
    setLocales(loc ?? [])
    setIngredientes(ing ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function abrirInventario(inv: Inventario) {
    setVistaId(inv.id)
    setInventarioAbierto(inv)
    const { data } = await supabase.from('inventarios_lineas').select('*').eq('inventario_id', inv.id).order('nombre_ingrediente')
    const ls: LineaEdit[] = (data ?? []).map(l => ({
      ...l,
      cantEdit: l.cantidad != null ? String(l.cantidad) : '',
      precioEdit: l.precio_coste != null ? String(l.precio_coste) : '',
    }))
    setLineas(ls)
    // Inventario del mes anterior para comparativa
    const [mesAnt, añoAnt] = inv.mes === 1 ? [12, inv.año - 1] : [inv.mes - 1, inv.año]
    const { data: prevInv } = await supabase.from('inventarios').select('id')
      .eq('local_id', inv.local_id ?? 0).eq('mes', mesAnt).eq('año', añoAnt).maybeSingle()
    if (prevInv) {
      const { data: prevLineas } = await supabase.from('inventarios_lineas').select('*').eq('inventario_id', prevInv.id)
      setInventarioAnterior(prevLineas ?? [])
    } else {
      setInventarioAnterior([])
    }
  }

  function cerrarVista() { setVistaId(null); setInventarioAbierto(null); setLineas([]); setInventarioAnterior([]) }

  async function crearInventario() {
    if (!fEmpleado.trim()) { setFError('Indica el responsable'); return }
    setGuardando(true); setFError('')
    const { data, error: err } = await supabase.from('inventarios')
      .insert({ local_id: fLocal ? Number(fLocal) : null, empleado_nombre: fEmpleado.trim(), mes: Number(fMes), año: Number(fAño), notas: fNotas.trim() || null })
      .select('id').single()
    if (err) { setFError(err.message.includes('unique') ? 'Ya existe un inventario para este local y mes' : err.message); setGuardando(false); return }
    // Precargar líneas con todos los ingredientes
    await supabase.from('inventarios_lineas').insert(
      ingredientes.map(i => ({ inventario_id: data.id, ingrediente_id: i.id, nombre_ingrediente: i.nombre_ingrediente, unidad: i.unidad_producto, cantidad: null, precio_coste: i.precio_unidad_producto ?? null }))
    )
    setModalNuevo(false); setFEmpleado(''); setFNotas(''); setGuardando(false); cargar()
  }

  async function guardarLineas() {
    if (!inventarioAbierto) return
    setGuardandoLineas(true)
    const updates = lineas.map(l => supabase.from('inventarios_lineas').update({
      cantidad: l.cantEdit !== '' ? Number(l.cantEdit) : null,
      precio_coste: l.precioEdit !== '' ? Number(l.precioEdit) : null,
    }).eq('id', l.id))
    await Promise.all(updates)
    // Recalcular total
    const total = lineas.reduce((s, l) => s + (Number(l.cantEdit) || 0) * (Number(l.precioEdit) || 0), 0)
    await supabase.from('inventarios').update({ total_coste: total }).eq('id', inventarioAbierto.id)
    setGuardandoLineas(false)
    cargar()
  }

  async function cerrarInventario() {
    if (!inventarioAbierto) return
    setCerrando(true)
    const total = lineas.reduce((s, l) => s + (Number(l.cantEdit) || 0) * (Number(l.precioEdit) || 0), 0)
    await supabase.from('inventarios').update({ estado: 'cerrado', total_coste: total, cerrado_at: new Date().toISOString() }).eq('id', inventarioAbierto.id)
    setCerrando(false); setConfirmCerrar(false)
    setInventarioAbierto(prev => prev ? { ...prev, estado: 'cerrado' } : null)
    cargar()
  }

  function exportarExcel() {
    if (!inventarioAbierto) return
    const rows = lineasConValor.map(l => {
      const prev = inventarioAnterior.find(p => p.ingrediente_id === l.ingrediente_id)
      const cantActual = Number(l.cantEdit) || 0
      const cantPrev = prev?.cantidad ?? null
      const diff = cantPrev != null ? ((cantActual - cantPrev) / cantPrev * 100).toFixed(1) + '%' : '—'
      return {
        Ingrediente: l.nombre_ingrediente,
        Unidad: l.unidad ?? '',
        'Cantidad contada': cantActual,
        'Precio coste (€/ud)': Number(l.precioEdit) || '',
        'Total coste (€)': ((Number(l.cantEdit)||0) * (Number(l.precioEdit)||0)).toFixed(2),
        'Mes anterior': cantPrev ?? '',
        'Variación %': diff,
      }
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Inventario')
    XLSX.writeFile(wb, `inventario_${inventarioAbierto.año}_${String(inventarioAbierto.mes).padStart(2,'0')}.xlsx`)
  }

  const lineasConValor = useMemo(() => lineas.filter(l => Number(l.cantEdit) > 0 || Number(l.precioEdit) > 0), [lineas])
  const totalActual = useMemo(() => lineas.reduce((s, l) => s + (Number(l.cantEdit)||0) * (Number(l.precioEdit)||0), 0), [lineas])
  const totalPrev = useMemo(() => inventarioAnterior.reduce((s, l) => s + (l.cantidad||0) * (l.precio_coste||0), 0), [inventarioAnterior])
  const variacionPct = totalPrev > 0 ? ((totalActual - totalPrev) / totalPrev * 100) : null

  if (loading) return <div className="flex items-center justify-center min-h-screen"><RefreshCw className="animate-spin text-[#F5B731]" size={24} /></div>

  // ── Vista detalle inventario ──────────────────────────────
  if (vistaId && inventarioAbierto) {
    const esCerrado = inventarioAbierto.estado === 'cerrado'
    return (
      <div className="p-6 max-w-5xl">
        <div className="mb-5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <button onClick={cerrarVista} className="text-gray-400 hover:text-gray-700 transition-colors">
              <ChevronRight size={18} className="rotate-180" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Inventario {MESES[inventarioAbierto.mes - 1]} {inventarioAbierto.año}
              </h1>
              <p className="text-sm text-gray-400">{inventarioAbierto.locales?.nombre ?? '—'} · {inventarioAbierto.empleado_nombre}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${esCerrado ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {esCerrado ? '🔒 Cerrado' : '✏️ Borrador'}
            </span>
            <button onClick={exportarExcel} className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-1">
              <Download size={12} /> Excel
            </button>
            {!esCerrado && (
              <button onClick={guardarLineas} disabled={guardandoLineas} className="px-3 py-1.5 text-xs font-semibold bg-[#F5B731] text-[#1A1A1A] rounded-lg hover:bg-[#e0a820] disabled:opacity-50">
                {guardandoLineas ? 'Guardando...' : 'Guardar cambios'}
              </button>
            )}
            {!esCerrado && (
              <button onClick={() => setConfirmCerrar(true)} className="px-3 py-1.5 text-xs font-semibold bg-gray-800 text-white rounded-lg hover:bg-gray-900 flex items-center gap-1">
                <Lock size={12} /> Cerrar inventario
              </button>
            )}
          </div>
        </div>

        {/* KPIs comparativa */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-400 mb-1">Total coste actual</p>
            <p className="text-2xl font-bold text-gray-900">{totalActual.toFixed(2)} €</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-400 mb-1">Mes anterior</p>
            <p className={`text-2xl font-bold ${totalPrev > 0 ? 'text-gray-700' : 'text-gray-300'}`}>{totalPrev > 0 ? `${totalPrev.toFixed(2)} €` : '—'}</p>
          </div>
          <div className={`rounded-xl border p-4 ${variacionPct != null ? (variacionPct > 0 ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200') : 'bg-gray-50 border-gray-200'}`}>
            <p className="text-xs text-gray-400 mb-1">Variación</p>
            <p className={`text-2xl font-bold ${variacionPct != null ? (variacionPct > 0 ? 'text-rose-600' : 'text-emerald-600') : 'text-gray-300'}`}>
              {variacionPct != null ? `${variacionPct > 0 ? '+' : ''}${variacionPct.toFixed(1)}%` : '—'}
            </p>
          </div>
        </div>

        {/* Tabla de líneas */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Ingrediente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Unidad</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Cantidad</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">€/ud</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Total</th>
                {inventarioAnterior.length > 0 && <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Ant. / Var.</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {lineas.map((l, idx) => {
                const prev = inventarioAnterior.find(p => p.ingrediente_id === l.ingrediente_id)
                const cantActual = Number(l.cantEdit) || 0
                const cantPrev = prev?.cantidad ?? null
                const total = cantActual * (Number(l.precioEdit) || 0)
                const diff = cantPrev != null ? cantActual - cantPrev : null
                return (
                  <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 text-gray-800 font-medium">{l.nombre_ingrediente}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{l.unidad}</td>
                    <td className="px-4 py-2.5 text-right">
                      {esCerrado ? (
                        <span className="text-gray-700 font-medium">{l.cantidad ?? '—'}</span>
                      ) : (
                        <input type="number" min="0" step="0.001" className="w-24 px-2 py-1 text-sm border border-gray-200 rounded-lg text-right focus:ring-1 focus:ring-[#F5B731] focus:outline-none"
                          value={l.cantEdit} onChange={e => { const n=[...lineas]; n[idx]={...n[idx],cantEdit:e.target.value}; setLineas(n) }} />
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {esCerrado ? (
                        <span className="text-gray-700">{l.precio_coste ? `${l.precio_coste} €` : '—'}</span>
                      ) : (
                        <input type="number" min="0" step="0.0001" className="w-24 px-2 py-1 text-sm border border-gray-200 rounded-lg text-right focus:ring-1 focus:ring-[#F5B731] focus:outline-none"
                          value={l.precioEdit} onChange={e => { const n=[...lineas]; n[idx]={...n[idx],precioEdit:e.target.value}; setLineas(n) }} />
                      )}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${total > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                      {total > 0 ? `${total.toFixed(2)} €` : '—'}
                    </td>
                    {inventarioAnterior.length > 0 && (
                      <td className="px-4 py-2.5 text-right text-xs">
                        {cantPrev != null ? (
                          <span className={diff != null && Math.abs(diff) > 0.001 ? (diff! > 0 ? 'text-blue-600 font-medium' : 'text-orange-600 font-medium') : 'text-gray-400'}>
                            {cantPrev} {diff != null && Math.abs(diff) > 0.001 ? `(${diff! > 0 ? '+' : ''}${diff!.toFixed(1)})` : ''}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t border-gray-200 font-bold text-gray-900">
                <td colSpan={inventarioAnterior.length > 0 ? 4 : 4} className="px-4 py-3 text-sm">Total inventario</td>
                <td className="px-4 py-3 text-right">{totalActual.toFixed(2)} €</td>
                {inventarioAnterior.length > 0 && <td />}
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Confirmar cierre */}
        {confirmCerrar && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm mx-4">
              <div className="flex items-center gap-3 mb-4">
                <Lock size={22} className="text-gray-700" />
                <p className="text-base font-bold text-gray-900">¿Cerrar inventario?</p>
              </div>
              <p className="text-sm text-gray-500 mb-5">Una vez cerrado no se podrá editar. Se guardará el total actual de {totalActual.toFixed(2)} €.</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmCerrar(false)} className="flex-1 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
                <button onClick={cerrarInventario} disabled={cerrando} className="flex-1 py-2 text-sm font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50">
                  {cerrando ? 'Cerrando...' : 'Cerrar inventario'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Vista lista inventarios ──────────────────────────────
  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Inventario Local</h1>
          <p className="text-sm text-gray-400 mt-0.5">Inventarios mensuales por local</p>
        </div>
        <button onClick={() => setModalNuevo(true)} className="flex items-center gap-2 px-4 py-2 bg-[#F5B731] text-[#1A1A1A] text-sm font-semibold rounded-lg hover:bg-[#e0a820] transition-colors">
          <Plus size={15} /> Nuevo inventario
        </button>
      </div>

      {inventarios.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <Archive size={32} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">No hay inventarios registrados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {inventarios.map(inv => (
            <button key={inv.id} onClick={() => abrirInventario(inv)}
              className="w-full bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center justify-between gap-3 hover:border-[#F5B731] hover:shadow-sm transition-all text-left group">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-bold text-gray-800">{MESES[inv.mes - 1]} {inv.año}</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${inv.estado === 'cerrado' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {inv.estado === 'cerrado' ? '🔒 Cerrado' : '✏️ Borrador'}
                  </span>
                </div>
                <p className="text-xs text-gray-400">{inv.locales?.nombre ?? '—'} · {inv.empleado_nombre}</p>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
                {inv.total_coste != null && (
                  <p className="text-sm font-bold text-gray-900">{inv.total_coste.toFixed(2)} €</p>
                )}
                <ChevronDown size={16} className="text-gray-300 group-hover:text-[#F5B731] rotate-[-90deg] transition-colors" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Modal nuevo inventario */}
      {modalNuevo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">Nuevo inventario mensual</h2>
              <button onClick={() => setModalNuevo(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Mes *</label>
                  <select className={inputCls} value={fMes} onChange={e => setFMes(e.target.value)}>
                    {MESES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Año *</label>
                  <select className={inputCls} value={fAño} onChange={e => setFAño(e.target.value)}>
                    {[2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Local</label>
                  <select className={inputCls} value={fLocal} onChange={e => setFLocal(e.target.value)}>
                    <option value="">— Todos —</option>
                    {locales.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Responsable *</label>
                <input className={inputCls} placeholder="Nombre del empleado" value={fEmpleado} onChange={e => setFEmpleado(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Notas</label>
                <input className={inputCls} value={fNotas} onChange={e => setFNotas(e.target.value)} placeholder="Observaciones..." />
              </div>
              <p className="text-xs text-gray-400">Se precargará con todos los ingredientes de la base de datos.</p>
              {fError && <p className="text-xs text-rose-500 flex items-center gap-1"><AlertTriangle size={12} /> {fError}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setModalNuevo(false)} className="px-4 py-2 text-sm text-gray-600">Cancelar</button>
                <button onClick={crearInventario} disabled={guardando} className="px-4 py-2 text-sm font-semibold bg-[#F5B731] text-[#1A1A1A] rounded-lg hover:bg-[#e0a820] disabled:opacity-50">
                  {guardando ? 'Creando...' : 'Crear inventario'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

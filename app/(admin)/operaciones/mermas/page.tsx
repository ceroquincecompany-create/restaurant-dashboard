'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { supabaseAuth as supabase } from '@/lib/supabase-browser'
import type { Merma, Ingrediente, Local } from '@/lib/supabase'
import { Plus, X, Trash2, RefreshCw, AlertTriangle, Leaf, UtensilsCrossed } from 'lucide-react'

// ── Tipos locales ──────────────────────────────────────────────

type Producto = { id: number; nombre: string; familia: string | null }

const TIPO_MOTIVO_CFG = {
  consumo_interno: { label: 'Consumo interno', cls: 'bg-blue-100 text-blue-700' },
  desperdicio:     { label: 'Desperdicio',      cls: 'bg-orange-100 text-orange-700' },
} as const
type TipoMotivo = keyof typeof TIPO_MOTIVO_CFG

const TIPO_MERMA_CFG = {
  ingrediente: { label: 'Ingrediente',    cls: 'bg-gray-100 text-gray-600' },
  plato:       { label: 'Plato completo', cls: 'bg-violet-100 text-violet-700' },
} as const
type TipoMerma = keyof typeof TIPO_MERMA_CFG

type FormMerma = {
  local_id: string
  empleado_nombre: string
  tipo: TipoMotivo
  tipo_merma: TipoMerma
  ingrediente_id: string
  producto_id: string
  cantidad: string
  coste: string
  fecha: string
  notas: string
}

const FORM_VACIO: FormMerma = {
  local_id: '', empleado_nombre: '', tipo: 'desperdicio',
  tipo_merma: 'ingrediente',
  ingrediente_id: '', producto_id: '',
  cantidad: '', coste: '',
  fecha: new Date().toISOString().split('T')[0], notas: '',
}

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white'

// ── Componentes auxiliares ─────────────────────────────────────

function Modal({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-sm font-semibold text-gray-800">{titulo}</h2>
          <button onClick={onCerrar} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

function KPI({ titulo, valor, sub, color }: { titulo: string; valor: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-400 mb-1">{titulo}</p>
      <p className={`text-2xl font-bold ${color ?? 'text-gray-900'}`}>{valor}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────

export default function PaginaMermas() {
  const [mermas, setMermas]           = useState<Merma[]>([])
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([])
  const [productos, setProductos]     = useState<Producto[]>([])
  const [costePorProducto, setCostePorProducto] = useState<Record<number, number>>({})
  const [locales, setLocales]         = useState<Local[]>([])
  const [loading, setLoading]         = useState(true)
  const [filtroLocal, setFiltroLocal] = useState('')
  const [filtroTipo, setFiltroTipo]   = useState('')
  const [filtroMes, setFiltroMes]     = useState('')
  const [filtroAnio, setFiltroAnio]   = useState(String(new Date().getFullYear()))
  const [modal, setModal]             = useState(false)
  const [form, setForm]               = useState<FormMerma>(FORM_VACIO)
  const [guardando, setGuardando]     = useState(false)
  const [error, setError]             = useState('')
  const [confirmEliminar, setConfirmEliminar] = useState<number | null>(null)

  // Ingrediente search
  const [busqIng, setBusqIng]         = useState('')
  const [dropIng, setDropIng]         = useState(false)
  const dropIngRef                    = useRef<HTMLDivElement>(null)

  // Producto search
  const [busqProd, setBusqProd]       = useState('')
  const [dropProd, setDropProd]       = useState(false)
  const dropProdRef                   = useRef<HTMLDivElement>(null)

  const cargar = useCallback(async () => {
    const [{ data: m }, { data: i }, { data: l }, { data: prods }, { data: recs }] = await Promise.all([
      supabase.from('mermas').select('*').order('fecha', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('ingredientes').select('*').order('nombre_ingrediente'),
      supabase.from('locales').select('*').eq('activo', true).order('nombre'),
      supabase.from('productos').select('id, nombre, familia').eq('activo', true).order('familia').order('nombre'),
      supabase.from('recetas').select('producto_id, cantidad_bruta, ingredientes(precio_unidad_producto)'),
    ])

    // Calcular coste escandallo por producto
    const costes: Record<number, number> = {}
    ;(recs ?? []).forEach((r: any) => {
      const pid = r.producto_id as number
      const precio = r.ingredientes?.precio_unidad_producto ?? 0
      const cant = r.cantidad_bruta ?? 0
      costes[pid] = (costes[pid] ?? 0) + cant * precio
    })

    setMermas(m ?? [])
    setIngredientes(i ?? [])
    setLocales(l ?? [])
    setProductos(prods ?? [])
    setCostePorProducto(costes)
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // Cerrar dropdowns al click fuera
  useEffect(() => {
    function h(e: MouseEvent) {
      if (dropIngRef.current && !dropIngRef.current.contains(e.target as Node)) setDropIng(false)
      if (dropProdRef.current && !dropProdRef.current.contains(e.target as Node)) setDropProd(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // Filtros de búsqueda
  const ingFiltrados  = useMemo(() =>
    ingredientes.filter(i => i.nombre_ingrediente.toLowerCase().includes(busqIng.toLowerCase())).slice(0, 12),
    [ingredientes, busqIng]
  )
  const prodFiltrados = useMemo(() =>
    productos.filter(p => p.nombre.toLowerCase().includes(busqProd.toLowerCase())).slice(0, 12),
    [productos, busqProd]
  )

  const filtradas = useMemo(() => {
    return mermas.filter((m) => {
      const fecha = new Date(m.fecha)
      const matchLocal = !filtroLocal || String(m.local_id) === filtroLocal
      const matchTipo  = !filtroTipo  || m.tipo === filtroTipo
      const matchAnio  = !filtroAnio  || fecha.getFullYear() === Number(filtroAnio)
      const matchMes   = !filtroMes   || (fecha.getMonth() + 1) === Number(filtroMes)
      return matchLocal && matchTipo && matchAnio && matchMes
    })
  }, [mermas, filtroLocal, filtroTipo, filtroMes, filtroAnio])

  const kpisPorLocal = useMemo(() => {
    const map: Record<string, number> = {}
    filtradas.forEach((m) => {
      const key = m.local_id ? String(m.local_id) : 'sin_local'
      map[key] = (map[key] ?? 0) + (m.coste ?? 0)
    })
    return map
  }, [filtradas])

  const costeTotal = useMemo(() => filtradas.reduce((s, m) => s + (m.coste ?? 0), 0), [filtradas])

  // ── Seleccionar ingrediente ──────────────────────────────────
  function seleccionarIng(ing: Ingrediente) {
    const cant = Number(form.cantidad) || 0
    const coste = cant > 0 && ing.precio_unidad_producto ? cant * ing.precio_unidad_producto : 0
    setForm(f => ({
      ...f,
      ingrediente_id: String(ing.id),
      coste: coste > 0 ? coste.toFixed(4) : '',
    }))
    setBusqIng(ing.nombre_ingrediente)
    setDropIng(false)
  }

  function onCantidadIngChange(val: string) {
    const cant = Number(val) || 0
    const ing  = ingredientes.find(i => String(i.id) === form.ingrediente_id)
    const coste = cant > 0 && ing?.precio_unidad_producto ? cant * ing.precio_unidad_producto : 0
    setForm(f => ({ ...f, cantidad: val, coste: coste > 0 ? coste.toFixed(4) : '' }))
  }

  // ── Seleccionar producto ─────────────────────────────────────
  function seleccionarProd(prod: Producto) {
    const cant  = Number(form.cantidad) || 1
    const coste = (costePorProducto[prod.id] ?? 0) * cant
    setForm(f => ({
      ...f,
      producto_id: String(prod.id),
      cantidad:    f.cantidad || '1',
      coste:       coste > 0 ? coste.toFixed(4) : '',
    }))
    setBusqProd(prod.nombre)
    setDropProd(false)
  }

  function onCantidadProdChange(val: string) {
    const cant  = Number(val) || 0
    const pid   = Number(form.producto_id)
    const coste = cant > 0 && pid ? (costePorProducto[pid] ?? 0) * cant : 0
    setForm(f => ({ ...f, cantidad: val, coste: coste > 0 ? coste.toFixed(4) : '' }))
  }

  // ── Abrir / cerrar modal ─────────────────────────────────────
  function abrirCrear() {
    setForm({ ...FORM_VACIO, local_id: filtroLocal || '' })
    setBusqIng(''); setBusqProd('')
    setError(''); setModal(true)
  }

  function cerrar() {
    setModal(false)
    setForm(FORM_VACIO)
    setBusqIng(''); setBusqProd('')
    setError('')
  }

  function cambiarTipoMerma(t: TipoMerma) {
    setForm(f => ({ ...f, tipo_merma: t, ingrediente_id: '', producto_id: '', cantidad: '', coste: '' }))
    setBusqIng(''); setBusqProd('')
  }

  // ── Guardar ──────────────────────────────────────────────────
  async function guardar() {
    if (!form.empleado_nombre.trim()) { setError('Indica quién registra la merma'); return }
    if (!form.fecha) { setError('Fecha obligatoria'); return }

    let payload: Record<string, unknown>

    if (form.tipo_merma === 'ingrediente') {
      if (!form.ingrediente_id) { setError('Selecciona un ingrediente'); return }
      if (!form.cantidad || Number(form.cantidad) <= 0) { setError('La cantidad debe ser mayor que 0'); return }
      payload = {
        local_id:     form.local_id ? Number(form.local_id) : null,
        empleado_nombre: form.empleado_nombre.trim(),
        tipo:         form.tipo,
        tipo_merma:   'ingrediente',
        ingrediente_id: Number(form.ingrediente_id),
        producto_id:  null,
        cantidad:     Number(form.cantidad),
        coste:        form.coste ? Number(form.coste) : null,
        fecha:        form.fecha,
        notas:        form.notas.trim() || null,
      }
    } else {
      if (!form.producto_id) { setError('Selecciona un plato'); return }
      const cant   = Number(form.cantidad) || 1
      const costeEsc = costePorProducto[Number(form.producto_id)] ?? 0
      const coste  = costeEsc * cant
      payload = {
        local_id:     form.local_id ? Number(form.local_id) : null,
        empleado_nombre: form.empleado_nombre.trim(),
        tipo:         form.tipo,
        tipo_merma:   'plato',
        producto_id:  Number(form.producto_id),
        ingrediente_id: null,
        cantidad:     cant,
        coste:        coste > 0 ? coste : null,
        fecha:        form.fecha,
        notas:        form.notas.trim() || null,
      }
    }

    setGuardando(true); setError('')
    const { error: err } = await supabase.from('mermas').insert(payload)
    if (err) { setError(err.message); setGuardando(false); return }
    setGuardando(false)
    cerrar(); cargar()
  }

  async function eliminar(id: number) {
    await supabase.from('mermas').delete().eq('id', id)
    setConfirmEliminar(null)
    cargar()
  }

  const ingSeleccionado  = ingredientes.find(i => String(i.id) === form.ingrediente_id)
  const prodSeleccionado = productos.find(p => String(p.id) === form.producto_id)
  const costeEscandallo  = prodSeleccionado ? (costePorProducto[prodSeleccionado.id] ?? 0) : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="animate-spin text-[#F5B731]" size={24} />
      </div>
    )
  }

  const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

  return (
    <div className="p-6 max-w-5xl">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Mermas</h1>
          <p className="text-sm text-gray-400 mt-0.5">Control de consumo interno y desperdicios</p>
        </div>
        <button
          onClick={abrirCrear}
          className="flex items-center gap-2 px-4 py-2 bg-[#F5B731] text-[#1A1A1A] text-sm font-semibold rounded-lg hover:bg-[#e0a820] transition-colors"
        >
          <Plus size={15} /> Registrar merma
        </button>
      </div>

      {/* ── KPIs ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <KPI titulo="Coste total filtrado" valor={`${costeTotal.toFixed(2)} €`} sub={`${filtradas.length} registros`} color="text-rose-600" />
        {locales.map(loc => (
          <KPI key={loc.id} titulo={loc.nombre} valor={`${(kpisPorLocal[String(loc.id)] ?? 0).toFixed(2)} €`} sub="mermas" />
        ))}
      </div>

      {/* ── Filtros ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <select className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white" value={filtroLocal} onChange={e => setFiltroLocal(e.target.value)}>
          <option value="">Todos los locales</option>
          {locales.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
        </select>
        <select className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
          <option value="">Todos los motivos</option>
          {(Object.keys(TIPO_MOTIVO_CFG) as TipoMotivo[]).map(t => (
            <option key={t} value={t}>{TIPO_MOTIVO_CFG[t].label}</option>
          ))}
        </select>
        <select className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white" value={filtroMes} onChange={e => setFiltroMes(e.target.value)}>
          <option value="">Todos los meses</option>
          {MESES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <select className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white" value={filtroAnio} onChange={e => setFiltroAnio(e.target.value)}>
          {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <span className="text-xs text-gray-400">{filtradas.length} registros</span>
      </div>

      {/* ── Tabla ───────────────────────────────────────────── */}
      {filtradas.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <AlertTriangle size={32} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">No hay mermas registradas con los filtros actuales</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Fecha</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Local</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Artículo</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Cantidad</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Motivo</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Coste</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Por</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtradas.map(m => {
                const tipoMerma = m.tipo_merma ?? (m.ingrediente_id ? 'ingrediente' : 'plato')
                const ing  = tipoMerma === 'ingrediente' ? ingredientes.find(i => i.id === m.ingrediente_id) : null
                const prod = tipoMerma === 'plato'       ? productos.find(p => p.id === m.producto_id)      : null
                const local = locales.find(l => l.id === m.local_id)
                const nombre = ing?.nombre_ingrediente ?? prod?.nombre ?? `#${m.ingrediente_id ?? m.producto_id}`
                const unidad = ing?.unidad_producto ?? (tipoMerma === 'plato' ? 'platos' : '')
                return (
                  <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {new Date(m.fecha + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{local?.nombre ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${TIPO_MERMA_CFG[tipoMerma as TipoMerma]?.cls ?? 'bg-gray-100 text-gray-600'}`}>
                        {tipoMerma === 'plato' ? <UtensilsCrossed size={10} /> : <Leaf size={10} />}
                        {TIPO_MERMA_CFG[tipoMerma as TipoMerma]?.label ?? tipoMerma}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">{nombre}</td>
                    <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                      {m.cantidad} {unidad}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TIPO_MOTIVO_CFG[m.tipo as TipoMotivo]?.cls ?? 'bg-gray-100 text-gray-600'}`}>
                        {TIPO_MOTIVO_CFG[m.tipo as TipoMotivo]?.label ?? m.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-rose-600 whitespace-nowrap">
                      {m.coste != null ? `${Number(m.coste).toFixed(2)} €` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{m.empleado_nombre}</td>
                    <td className="px-4 py-3 text-right">
                      {confirmEliminar === m.id ? (
                        <span className="flex items-center gap-1 justify-end">
                          <button onClick={() => eliminar(m.id)} className="px-2 py-0.5 bg-rose-500 text-white rounded text-xs font-medium hover:bg-rose-600">Eliminar</button>
                          <button onClick={() => setConfirmEliminar(null)} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium hover:bg-gray-200">No</button>
                        </span>
                      ) : (
                        <button onClick={() => setConfirmEliminar(m.id)} className="p-1.5 text-gray-300 hover:text-rose-500 transition-colors rounded">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ══ MODAL REGISTRAR MERMA ═══════════════════════════ */}
      {modal && (
        <Modal titulo="Registrar merma" onCerrar={cerrar}>
          <div className="space-y-4">

            {/* Local + Quién */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Local</label>
                <select className={inputCls} value={form.local_id} onChange={e => setForm(f => ({ ...f, local_id: e.target.value }))}>
                  <option value="">— Sin especificar —</option>
                  {locales.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Registrado por *</label>
                <input className={inputCls} placeholder="Nombre del empleado" value={form.empleado_nombre} onChange={e => setForm(f => ({ ...f, empleado_nombre: e.target.value }))} />
              </div>
            </div>

            {/* Motivo + Fecha */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Motivo *</label>
                <select className={inputCls} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoMotivo }))}>
                  {(Object.keys(TIPO_MOTIVO_CFG) as TipoMotivo[]).map(t => (
                    <option key={t} value={t}>{TIPO_MOTIVO_CFG[t].label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Fecha *</label>
                <input type="date" className={inputCls} value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
              </div>
            </div>

            {/* ── Selector tipo de merma ─────────────────────── */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">Tipo de merma *</label>
              <div className="flex gap-2">
                <button
                  onClick={() => cambiarTipoMerma('ingrediente')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold border transition-colors ${
                    form.tipo_merma === 'ingrediente'
                      ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                      : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Leaf size={14} /> Ingrediente
                </button>
                <button
                  onClick={() => cambiarTipoMerma('plato')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold border transition-colors ${
                    form.tipo_merma === 'plato'
                      ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                      : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <UtensilsCrossed size={14} /> Plato completo
                </button>
              </div>
            </div>

            {/* ── Picker según tipo ──────────────────────────── */}
            {form.tipo_merma === 'ingrediente' ? (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Ingrediente *</label>
                  <div className="relative" ref={dropIngRef}>
                    <input
                      className={inputCls}
                      placeholder="Buscar ingrediente..."
                      value={busqIng}
                      onChange={e => { setBusqIng(e.target.value); setDropIng(true); if (!e.target.value) setForm(f => ({ ...f, ingrediente_id: '', coste: '' })) }}
                      onFocus={() => setDropIng(true)}
                      autoComplete="off"
                    />
                    {dropIng && ingFiltrados.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {ingFiltrados.map(ing => (
                          <button key={ing.id} type="button" onMouseDown={() => seleccionarIng(ing)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-[#F5B731]/10 flex items-center justify-between">
                            <span className="font-medium text-gray-800">{ing.nombre_ingrediente}</span>
                            <span className="text-xs text-gray-400 ml-2 whitespace-nowrap">
                              {ing.precio_unidad_producto != null ? `${ing.precio_unidad_producto} €/${ing.unidad_producto}` : ing.unidad_producto ?? ''}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {ingSeleccionado && (
                    <p className="text-xs text-gray-400 mt-1">
                      Unidad: <strong>{ingSeleccionado.unidad_producto}</strong>
                      {ingSeleccionado.precio_unidad_producto != null && ` · ${ingSeleccionado.precio_unidad_producto} €/ud`}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Cantidad * {ingSeleccionado?.unidad_producto ? `(${ingSeleccionado.unidad_producto})` : ''}
                    </label>
                    <input
                      type="number" min="0" step="0.001" className={inputCls}
                      value={form.cantidad} onChange={e => onCantidadIngChange(e.target.value)} placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Coste (€)</label>
                    <input
                      type="number" min="0" step="0.0001" className={`${inputCls} bg-gray-50`}
                      value={form.coste} onChange={e => setForm(f => ({ ...f, coste: e.target.value }))} placeholder="Auto"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Plato / Producto *</label>
                  <div className="relative" ref={dropProdRef}>
                    <input
                      className={inputCls}
                      placeholder="Buscar plato..."
                      value={busqProd}
                      onChange={e => { setBusqProd(e.target.value); setDropProd(true); if (!e.target.value) setForm(f => ({ ...f, producto_id: '', coste: '' })) }}
                      onFocus={() => setDropProd(true)}
                      autoComplete="off"
                    />
                    {dropProd && prodFiltrados.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {prodFiltrados.map(prod => (
                          <button key={prod.id} type="button" onMouseDown={() => seleccionarProd(prod)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-[#F5B731]/10 flex items-center justify-between">
                            <span className="font-medium text-gray-800">{prod.nombre}</span>
                            {prod.familia && <span className="text-xs text-gray-400 ml-2">{prod.familia}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {prodSeleccionado && (
                    <div className="mt-2 bg-[#F5B731]/10 border border-[#F5B731]/30 rounded-lg px-3 py-2 flex items-center justify-between">
                      <span className="text-xs text-gray-600">Coste del escandallo</span>
                      <span className="text-sm font-bold text-[#1A1A1A]">
                        {costeEscandallo > 0 ? `${costeEscandallo.toFixed(2)} €/plato` : 'Sin escandallo'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Cantidad (platos) *</label>
                    <input
                      type="number" min="1" step="1" className={inputCls}
                      value={form.cantidad} onChange={e => onCantidadProdChange(e.target.value)} placeholder="1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Coste total (€)</label>
                    <div className="relative">
                      <input
                        type="number" min="0" step="0.0001" className={`${inputCls} bg-gray-50`}
                        value={form.coste} onChange={e => setForm(f => ({ ...f, coste: e.target.value }))} placeholder="Auto"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Notas</label>
              <input className={inputCls} value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} placeholder="Motivo, observaciones..." />
            </div>

            {error && <p className="text-xs text-rose-500">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={cerrar} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">Cancelar</button>
              <button
                onClick={guardar} disabled={guardando}
                className="px-4 py-2 text-sm font-semibold bg-[#F5B731] text-[#1A1A1A] rounded-lg hover:bg-[#e0a820] transition-colors disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : 'Registrar merma'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

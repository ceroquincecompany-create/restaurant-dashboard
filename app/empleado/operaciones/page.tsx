'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Ingrediente, AvisoEquipo } from '@/lib/supabase'
import { useEmpleadoActual } from '@/lib/useEmpleado'
import { Thermometer, Sparkles, Trash2, Bell, RefreshCw, CheckCircle2, Circle, Plus, X, AlertTriangle, Package, Search, Save, ChevronDown, ChevronUp, Lock } from 'lucide-react'
import type { InventarioConteo } from '@/lib/supabase'

// ── Tipos de temperatura ───────────────────────────────────────
type Estado = 'ok' | 'aviso' | 'alerta' | 'muy_frio' | 'sin_dato'

function estadoNevera(val: string): Estado {
  if (!val || isNaN(Number(val))) return 'sin_dato'
  const n = Number(val)
  if (n < -2)  return 'muy_frio'
  if (n <= 4)  return 'ok'
  if (n <= 7)  return 'aviso'
  return 'alerta'
}
function estadoCongelador(val: string): Estado {
  if (!val || isNaN(Number(val))) return 'sin_dato'
  const n = Number(val)
  if (n < -18) return 'muy_frio'
  if (n <= -15) return 'ok'
  if (n <= -10) return 'aviso'
  return 'alerta'
}

const ESTADO_BADGE: Record<Estado, { cls: string; label: string }> = {
  ok:       { cls: 'bg-emerald-100 text-emerald-700 border border-emerald-200', label: '✅ Correcto' },
  aviso:    { cls: 'bg-orange-100 text-orange-700 border border-orange-200',   label: '⚠️ Atención' },
  alerta:   { cls: 'bg-rose-100 text-rose-700 border border-rose-200',         label: '🔴 Alerta' },
  muy_frio: { cls: 'bg-blue-100 text-blue-700 border border-blue-200',         label: '🔵 Muy frío' },
  sin_dato: { cls: 'bg-gray-100 text-gray-400 border border-gray-200',         label: '—' },
}

const EQUIPOS = [
  { key: 'mesa_fria_1', label: 'Mesa fría 1', desc: 'Bebidas / Tarros salsa / Leche',              tipo: 'nevera' },
  { key: 'mesa_fria_2', label: 'Mesa fría 2', desc: 'Bajo plancha — Fiambres, Quesos, Entrantes',  tipo: 'nevera' },
  { key: 'mesa_fria_3', label: 'Mesa fría 3', desc: 'Queso / Jamón / Salsas / Lechuga',            tipo: 'nevera' },
  { key: 'congelador_4', label: 'Congelador 4', desc: 'Entrantes / Empanados / Patatas / Helado',  tipo: 'congelador' },
  { key: 'mesa_fria_5', label: 'Mesa fría 5', desc: 'Montaje plancha',                             tipo: 'nevera' },
  { key: 'nevera_6',    label: 'Nevera 6',    desc: 'Uso general',                                 tipo: 'nevera' },
]

// ── Tareas de limpieza ────────────────────────────────────────
const TAREAS_LIMPIEZA = [
  { label: 'Utensilios cocina',         frecuencia: 'diaria' },
  { label: 'Superficies cocina',        frecuencia: 'diaria' },
  { label: 'Superficies horizontales',  frecuencia: 'diaria' },
  { label: 'Superficies verticales',    frecuencia: 'diaria' },
  { label: 'Baños',                     frecuencia: 'diaria' },
  { label: 'Freidora',                  frecuencia: 'semanal' },
  { label: 'Campana',                   frecuencia: 'semanal' },
  { label: 'Separador de grasas',       frecuencia: 'semanal' },
  { label: 'Tras inmobiliario',         frecuencia: 'semanal' },
  { label: 'Cámaras frigoríficas',      frecuencia: 'semanal' },
  { label: 'Congelador',                frecuencia: 'mensual' },
  { label: 'Tuberías gas',              frecuencia: 'mensual' },
  { label: 'Zonas difíciles acceso',    frecuencia: 'mensual' },
]

const CATEGORIAS_AVISO = ['Equipamiento', 'Seguridad', 'Suministros', 'Limpieza', 'Urgente', 'General']

type Tab = 'temperaturas' | 'limpiezas' | 'mermas' | 'avisos' | 'inventario'

export default function PaginaEmpleadoOperaciones() {
  const { empleado, loading: empLoading } = useEmpleadoActual()
  const [tab, setTab] = useState<Tab>('temperaturas')
  const today = new Date().toISOString().split('T')[0]
  const localId = empleado?.local_id ?? null

  if (empLoading) return <div className="flex items-center justify-center min-h-screen"><RefreshCw className="animate-spin text-[#F5B731]" size={24} /></div>

  return (
    <div className="px-4 py-5 md:px-6 max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Operaciones</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-5 overflow-x-auto">
        {([
          { id: 'temperaturas', label: 'Temp.',     icon: Thermometer },
          { id: 'limpiezas',    label: 'Limpieza',  icon: Sparkles },
          { id: 'mermas',       label: 'Mermas',    icon: Trash2 },
          { id: 'avisos',       label: 'Avisos',    icon: Bell },
          { id: 'inventario',   label: 'Inventario', icon: Package },
        ] as { id: Tab; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors flex-1 justify-center min-h-[40px] ${
              tab === id ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'temperaturas' && (
        <TabTemperaturas empleado={empleado} localId={localId} today={today} />
      )}
      {tab === 'limpiezas' && (
        <TabLimpiezas empleado={empleado} localId={localId} today={today} />
      )}
      {tab === 'mermas' && (
        <TabMermas empleado={empleado} localId={localId} today={today} />
      )}
      {tab === 'avisos' && (
        <TabAvisos empleado={empleado} localId={localId} />
      )}
      {tab === 'inventario' && (
        <TabInventario empleado={empleado} />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// TAB: TEMPERATURAS
// ══════════════════════════════════════════════════════════════
function TabTemperaturas({ empleado, localId, today }: { empleado: any; localId: number | null; today: string }) {
  const [turno, setTurno] = useState<'mañana' | 'noche'>(() => {
    const h = new Date().getHours()
    return h >= 14 ? 'noche' : 'mañana'
  })
  const [vals, setVals] = useState<Record<string, string>>({})
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [exito, setExito] = useState(false)
  const [historial, setHistorial] = useState<any[]>([])

  const cargarHistorial = useCallback(async () => {
    const desde = new Date()
    desde.setDate(desde.getDate() - 7)
    const { data } = await supabase
      .from('temperaturas')
      .select('*')
      .eq('local_id', localId ?? 1)
      .gte('fecha', desde.toISOString())
      .order('fecha', { ascending: false })
    setHistorial(data ?? [])
  }, [localId])

  useEffect(() => { cargarHistorial() }, [cargarHistorial])

  async function guardar() {
    if (!empleado) return
    setGuardando(true)
    const payload: Record<string, any> = {
      local_id: localId,
      empleado_nombre: empleado.nombre,
      fecha: new Date().toISOString(),
      turno,
      notas: notas.trim() || null,
    }
    EQUIPOS.forEach(eq => {
      payload[eq.key] = vals[eq.key] !== '' && vals[eq.key] !== undefined ? Number(vals[eq.key]) : null
    })
    await supabase.from('temperaturas').insert(payload)
    setVals({}); setNotas(''); setGuardando(false); setExito(true)
    setTimeout(() => setExito(false), 3000)
    cargarHistorial()
  }

  const hayAlgunValor = EQUIPOS.some(eq => vals[eq.key] !== '' && vals[eq.key] !== undefined)

  return (
    <div className="space-y-5">
      {/* Selector turno */}
      <div className="flex gap-2">
        {(['mañana', 'noche'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTurno(t)}
            className={`flex-1 py-3 rounded-xl text-base font-semibold transition-colors min-h-[48px] ${
              turno === t ? 'bg-[#F5B731] text-[#1A1A1A]' : 'bg-white border border-gray-200 text-gray-500'
            }`}
          >
            {t === 'mañana' ? '🌅 Mañana' : '🌙 Noche'}
          </button>
        ))}
      </div>

      {/* Equipos */}
      <div className="space-y-3">
        {EQUIPOS.map(eq => {
          const v = vals[eq.key] ?? ''
          const estado = eq.tipo === 'congelador' ? estadoCongelador(v) : estadoNevera(v)
          const badge = ESTADO_BADGE[estado]
          return (
            <div key={eq.key} className={`bg-white rounded-xl border p-4 transition-colors ${
              estado === 'alerta' ? 'border-rose-300 bg-rose-50' :
              estado === 'aviso' ? 'border-orange-300 bg-orange-50' :
              estado === 'muy_frio' ? 'border-blue-300 bg-blue-50' :
              estado === 'ok' ? 'border-emerald-300' : 'border-gray-200'
            }`}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className="text-base font-semibold text-gray-800">{eq.label}</p>
                  <p className="text-xs text-gray-400">{eq.desc}</p>
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded-lg ${badge.cls} whitespace-nowrap`}>
                  {badge.label}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  className="flex-1 px-4 py-3 text-xl font-bold border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white text-center"
                  placeholder="—"
                  value={v}
                  onChange={e => setVals(prev => ({ ...prev, [eq.key]: e.target.value }))}
                />
                <span className="text-lg font-bold text-gray-400">°C</span>
              </div>
            </div>
          )
        })}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">Notas (opcional)</label>
        <input
          className="w-full px-4 py-3 text-base border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F5B731]"
          placeholder="Incidencias, observaciones..."
          value={notas}
          onChange={e => setNotas(e.target.value)}
        />
      </div>

      {exito && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <CheckCircle2 size={20} className="text-emerald-600" />
          <p className="text-base font-semibold text-emerald-700">Temperaturas registradas correctamente</p>
        </div>
      )}

      <button
        onClick={guardar}
        disabled={!hayAlgunValor || guardando}
        className="w-full min-h-[56px] rounded-xl text-base font-bold bg-[#F5B731] text-[#1A1A1A] hover:bg-[#e0a820] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {guardando ? <span className="flex items-center justify-center gap-2"><RefreshCw size={18} className="animate-spin" /> Guardando...</span> : 'Guardar temperaturas'}
      </button>

      {/* Historial 7 días */}
      {historial.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-500 mb-2">Últimos 7 días</p>
          <div className="space-y-2">
            {historial.slice(0, 10).map(r => (
              <div key={r.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-gray-700">
                    {new Date(r.fecha).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                    {' '}
                    <span className="font-normal text-gray-400">{new Date(r.fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                  </p>
                  {r.turno && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.turno === 'mañana' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                      {r.turno}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {EQUIPOS.map(eq => {
                    const v = r[eq.key]
                    if (v == null) return null
                    const estado = eq.tipo === 'congelador' ? estadoCongelador(String(v)) : estadoNevera(String(v))
                    const cfg = ESTADO_BADGE[estado]
                    return (
                      <span key={eq.key} className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.cls}`}>
                        {eq.label.replace('Mesa fría ', 'MF').replace('Congelador ', 'C').replace('Nevera ', 'N')}: {v}°C
                      </span>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// TAB: LIMPIEZAS
// ══════════════════════════════════════════════════════════════
function TabLimpiezas({ empleado, localId, today }: { empleado: any; localId: number | null; today: string }) {
  const [hechasHoy, setHechasHoy] = useState<Set<string>>(new Set())
  const [guardando, setGuardando] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from('limpiezas')
      .select('tarea')
      .eq('fecha', today)
      .eq('local_id', localId ?? 1)
    setHechasHoy(new Set((data ?? []).map((r: any) => r.tarea)))
  }, [today, localId])

  useEffect(() => { cargar() }, [cargar])

  async function registrar(tarea: string, frecuencia: string) {
    if (!empleado || hechasHoy.has(tarea)) return
    setGuardando(tarea)
    await supabase.from('limpiezas').insert({
      local_id: localId,
      empleado_nombre: empleado.nombre,
      tarea,
      frecuencia,
      fecha: today,
    })
    setHechasHoy(prev => new Set([...prev, tarea]))
    setGuardando(null)
  }

  const frecuencias = ['diaria', 'semanal', 'mensual'] as const
  const labels = { diaria: 'Diarias', semanal: 'Semanales', mensual: 'Mensuales' }

  return (
    <div className="space-y-5">
      {frecuencias.map(frec => (
        <div key={frec}>
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">{labels[frec]}</p>
          <div className="space-y-2">
            {TAREAS_LIMPIEZA.filter(t => t.frecuencia === frec).map(t => {
              const hecha = hechasHoy.has(t.label)
              const cargando = guardando === t.label
              return (
                <button
                  key={t.label}
                  onClick={() => registrar(t.label, t.frecuencia)}
                  disabled={hecha || !!guardando}
                  className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl border text-left transition-all min-h-[60px] ${
                    hecha ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200 active:scale-[0.98]'
                  }`}
                >
                  {cargando ? (
                    <RefreshCw size={22} className="animate-spin text-gray-400 flex-shrink-0" />
                  ) : hecha ? (
                    <CheckCircle2 size={22} className="text-emerald-500 flex-shrink-0" />
                  ) : (
                    <Circle size={22} className="text-gray-300 flex-shrink-0" />
                  )}
                  <span className={`text-base font-medium ${hecha ? 'text-emerald-700 line-through' : 'text-gray-800'}`}>
                    {t.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// TAB: MERMAS
// ══════════════════════════════════════════════════════════════
type ProductoSimple = { id: number; nombre: string; familia: string | null }

function TabMermas({ empleado, localId, today }: { empleado: any; localId: number | null; today: string }) {
  const [tipoMerma, setTipoMerma] = useState<'ingrediente' | 'plato'>('ingrediente')
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([])
  const [productos, setProductos]       = useState<ProductoSimple[]>([])
  const [costePorProducto, setCostePorProducto] = useState<Record<number, number>>({})

  // Ingrediente picker
  const [busqIng, setBusqIng]   = useState('')
  const [dropIng, setDropIng]   = useState(false)
  const [selIngId, setSelIngId] = useState('')
  const dropIngRef              = useRef<HTMLDivElement>(null)

  // Producto picker
  const [busqProd, setBusqProd]   = useState('')
  const [dropProd, setDropProd]   = useState(false)
  const [selProdId, setSelProdId] = useState('')
  const dropProdRef               = useRef<HTMLDivElement>(null)

  const [cantidad, setCantidad]   = useState('')
  const [tipo, setTipo]           = useState<'desperdicio' | 'consumo_interno'>('desperdicio')
  const [notas, setNotas]         = useState('')
  const [guardando, setGuardando] = useState(false)
  const [exito, setExito]         = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('ingredientes').select('*').order('nombre_ingrediente'),
      supabase.from('productos').select('id, nombre, familia').eq('activo', true).order('nombre'),
      supabase.from('recetas').select('producto_id, cantidad_bruta, ingredientes(precio_unidad_producto)'),
    ]).then(([{ data: ings }, { data: prods }, { data: recs }]) => {
      setIngredientes(ings ?? [])
      setProductos(prods ?? [])
      const costes: Record<number, number> = {}
      ;(recs ?? []).forEach((r: any) => {
        const precio = r.ingredientes?.precio_unidad_producto ?? 0
        costes[r.producto_id] = (costes[r.producto_id] ?? 0) + (r.cantidad_bruta ?? 0) * precio
      })
      setCostePorProducto(costes)
    })
  }, [])

  useEffect(() => {
    function fn(e: MouseEvent) {
      if (dropIngRef.current && !dropIngRef.current.contains(e.target as Node)) setDropIng(false)
      if (dropProdRef.current && !dropProdRef.current.contains(e.target as Node)) setDropProd(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  const ingFiltrados  = useMemo(() => ingredientes.filter(i => i.nombre_ingrediente.toLowerCase().includes(busqIng.toLowerCase())).slice(0, 8), [ingredientes, busqIng])
  const prodFiltrados = useMemo(() => productos.filter(p => p.nombre.toLowerCase().includes(busqProd.toLowerCase())).slice(0, 8), [productos, busqProd])
  const ingSel  = ingredientes.find(i => String(i.id) === selIngId)
  const prodSel = productos.find(p => String(p.id) === selProdId)

  function cambiarTipo(t: 'ingrediente' | 'plato') {
    setTipoMerma(t); setSelIngId(''); setSelProdId('')
    setBusqIng(''); setBusqProd(''); setCantidad('')
  }

  async function guardar() {
    setError('')
    let payload: Record<string, unknown> = {
      local_id: localId, empleado_nombre: empleado?.nombre ?? '',
      tipo, fecha: today, notas: notas.trim() || null,
    }

    if (tipoMerma === 'ingrediente') {
      if (!selIngId) { setError('Selecciona un ingrediente'); return }
      if (!cantidad || Number(cantidad) <= 0) { setError('Introduce una cantidad válida'); return }
      const coste = ingSel?.precio_unidad_producto ? Number(cantidad) * ingSel.precio_unidad_producto : null
      payload = { ...payload, tipo_merma: 'ingrediente', ingrediente_id: Number(selIngId), producto_id: null, cantidad: Number(cantidad), coste }
    } else {
      if (!selProdId) { setError('Selecciona un plato'); return }
      const cant = Number(cantidad) || 1
      const coste = (costePorProducto[Number(selProdId)] ?? 0) * cant
      payload = { ...payload, tipo_merma: 'plato', producto_id: Number(selProdId), ingrediente_id: null, cantidad: cant, coste: coste || null }
    }

    setGuardando(true)
    await supabase.from('mermas').insert(payload)
    setBusqIng(''); setSelIngId(''); setBusqProd(''); setSelProdId('')
    setCantidad(''); setNotas(''); setGuardando(false)
    setExito(true); setTimeout(() => setExito(false), 3000)
  }

  const puedeGuardar = tipoMerma === 'ingrediente' ? (!!selIngId && !!cantidad) : !!selProdId

  return (
    <div className="space-y-4">

      {/* Selector Ingrediente / Plato */}
      <div className="flex gap-2">
        <button onClick={() => cambiarTipo('ingrediente')}
          className={`flex-1 py-3 rounded-xl text-sm font-semibold border transition-colors ${tipoMerma === 'ingrediente' ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]' : 'bg-white text-gray-500 border-gray-200'}`}>
          Ingrediente
        </button>
        <button onClick={() => cambiarTipo('plato')}
          className={`flex-1 py-3 rounded-xl text-sm font-semibold border transition-colors ${tipoMerma === 'plato' ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]' : 'bg-white text-gray-500 border-gray-200'}`}>
          Plato completo
        </button>
      </div>

      {/* Picker ingrediente */}
      {tipoMerma === 'ingrediente' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Ingrediente *</label>
            <div className="relative" ref={dropIngRef}>
              <input className="w-full px-4 py-3 text-base border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F5B731]"
                placeholder="Buscar ingrediente..." value={busqIng}
                onChange={e => { setBusqIng(e.target.value); setDropIng(true); if (!e.target.value) setSelIngId('') }}
                onFocus={() => setDropIng(true)} autoComplete="off" />
              {dropIng && ingFiltrados.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                  {ingFiltrados.map(ing => (
                    <button key={ing.id} type="button" onMouseDown={() => { setSelIngId(String(ing.id)); setBusqIng(ing.nombre_ingrediente); setDropIng(false) }}
                      className="w-full text-left px-4 py-3 text-base hover:bg-[#F5B731]/10 flex items-center justify-between min-h-[48px]">
                      <span className="font-medium text-gray-800">{ing.nombre_ingrediente}</span>
                      {ing.unidad_producto && <span className="text-sm text-gray-400">{ing.unidad_producto}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {ingSel && <p className="text-sm text-gray-400 mt-1">Unidad: <strong>{ingSel.unidad_producto}</strong></p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Cantidad *</label>
              <input type="number" inputMode="decimal" min="0" step="0.001"
                className="w-full px-4 py-3 text-xl font-bold border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F5B731] text-center"
                placeholder="0" value={cantidad} onChange={e => setCantidad(e.target.value)} />
              {ingSel?.unidad_producto && <p className="text-xs text-gray-400 mt-1 text-center">{ingSel.unidad_producto}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Tipo</label>
              <div className="flex flex-col gap-2">
                {(['desperdicio', 'consumo_interno'] as const).map(t => (
                  <button key={t} onClick={() => setTipo(t)}
                    className={`py-2.5 rounded-xl text-sm font-semibold border transition-colors ${tipo === t ? 'bg-[#F5B731] text-[#1A1A1A] border-[#F5B731]' : 'bg-white text-gray-500 border-gray-200'}`}>
                    {t === 'desperdicio' ? 'Desperdicio' : 'Consumo'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Picker plato */}
      {tipoMerma === 'plato' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Plato / Producto *</label>
            <div className="relative" ref={dropProdRef}>
              <input className="w-full px-4 py-3 text-base border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F5B731]"
                placeholder="Buscar plato..." value={busqProd}
                onChange={e => { setBusqProd(e.target.value); setDropProd(true); if (!e.target.value) setSelProdId('') }}
                onFocus={() => setDropProd(true)} autoComplete="off" />
              {dropProd && prodFiltrados.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                  {prodFiltrados.map(prod => (
                    <button key={prod.id} type="button" onMouseDown={() => { setSelProdId(String(prod.id)); setBusqProd(prod.nombre); setDropProd(false); if (!cantidad) setCantidad('1') }}
                      className="w-full text-left px-4 py-3 text-base hover:bg-[#F5B731]/10 flex items-center justify-between min-h-[48px]">
                      <span className="font-medium text-gray-800">{prod.nombre}</span>
                      {prod.familia && <span className="text-sm text-gray-400">{prod.familia}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {selProdId && (
            <div className="flex items-center gap-3 bg-violet-50 border border-violet-200 rounded-xl px-4 py-3">
              <div className="flex-1">
                <p className="text-sm font-semibold text-violet-800">
                  Se registrará como {Number(cantidad) > 1 ? `${cantidad} platos completos tirados` : '1 plato completo tirado'}
                </p>
                <p className="text-xs text-violet-600 mt-0.5">{prodSel?.nombre}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Cantidad (platos) *</label>
              <input type="number" inputMode="numeric" min="1" step="1"
                className="w-full px-4 py-3 text-xl font-bold border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F5B731] text-center"
                placeholder="1" value={cantidad} onChange={e => setCantidad(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Tipo</label>
              <div className="flex flex-col gap-2">
                {(['desperdicio', 'consumo_interno'] as const).map(t => (
                  <button key={t} onClick={() => setTipo(t)}
                    className={`py-2.5 rounded-xl text-sm font-semibold border transition-colors ${tipo === t ? 'bg-[#F5B731] text-[#1A1A1A] border-[#F5B731]' : 'bg-white text-gray-500 border-gray-200'}`}>
                    {t === 'desperdicio' ? 'Desperdicio' : 'Consumo'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">Notas</label>
        <input className="w-full px-4 py-3 text-base border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F5B731]"
          placeholder="Motivo, observaciones..." value={notas} onChange={e => setNotas(e.target.value)} />
      </div>

      {error && <p className="text-sm text-rose-500 flex items-center gap-1.5"><AlertTriangle size={14} /> {error}</p>}
      {exito && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <CheckCircle2 size={20} className="text-emerald-600" />
          <p className="text-base font-semibold text-emerald-700">Merma registrada</p>
        </div>
      )}

      <button onClick={guardar} disabled={guardando || !puedeGuardar}
        className="w-full min-h-[56px] rounded-xl text-base font-bold bg-[#F5B731] text-[#1A1A1A] hover:bg-[#e0a820] active:scale-[0.98] transition-all disabled:opacity-40">
        {guardando ? <span className="flex items-center justify-center gap-2"><RefreshCw size={18} className="animate-spin" /> Guardando...</span> : 'Registrar merma'}
      </button>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// TAB: AVISOS
// ══════════════════════════════════════════════════════════════
function TabAvisos({ empleado, localId }: { empleado: any; localId: number | null }) {
  const [avisos, setAvisos] = useState<AvisoEquipo[]>([])
  const [categoria, setCategoria] = useState('General')
  const [descripcion, setDescripcion] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [resolviendo, setResolviendo] = useState<number | null>(null)

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('avisos_equipo').select('*')
      .eq('activo', true).eq('local_id', localId ?? 1).order('created_at', { ascending: false })
    setAvisos(data ?? [])
  }, [localId])

  useEffect(() => { cargar() }, [cargar])

  async function crear() {
    if (!descripcion.trim() || !empleado) return
    setGuardando(true)
    await supabase.from('avisos_equipo').insert({ local_id: localId, empleado_nombre: empleado.nombre, categoria, descripcion: descripcion.trim() })
    setDescripcion(''); setGuardando(false); cargar()
  }

  async function resolver(id: number) {
    if (!empleado) return
    setResolviendo(id)
    await supabase.from('avisos_equipo').update({ activo: false, resuelto_por: empleado.nombre, fecha_resolucion: new Date().toISOString() }).eq('id', id)
    setResolviendo(null); cargar()
  }

  const CAT_COLOR: Record<string, string> = {
    Urgente: 'bg-rose-100 text-rose-700',
    Seguridad: 'bg-orange-100 text-orange-700',
    Equipamiento: 'bg-blue-100 text-blue-700',
    Suministros: 'bg-purple-100 text-purple-700',
    Limpieza: 'bg-teal-100 text-teal-700',
    General: 'bg-gray-100 text-gray-600',
  }

  return (
    <div className="space-y-5">
      {/* Lista avisos activos */}
      {avisos.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-500">{avisos.length} aviso{avisos.length !== 1 ? 's' : ''} activo{avisos.length !== 1 ? 's' : ''}</p>
          {avisos.map(a => (
            <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CAT_COLOR[a.categoria] ?? 'bg-gray-100 text-gray-600'}`}>{a.categoria}</span>
                <span className="text-xs text-gray-400">{new Date(a.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
              </div>
              <p className="text-base text-gray-800 mb-1">{a.descripcion}</p>
              <p className="text-xs text-gray-400 mb-3">Por {a.empleado_nombre}</p>
              <button onClick={() => resolver(a.id)} disabled={resolviendo === a.id}
                className="w-full py-2.5 rounded-lg text-sm font-semibold border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 active:scale-[0.98] transition-all min-h-[44px]">
                {resolviendo === a.id ? 'Marcando...' : '✓ Marcar como resuelto'}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <Bell size={28} className="mx-auto text-gray-200 mb-2" />
          <p className="text-base text-gray-400">No hay avisos activos</p>
        </div>
      )}

      {/* Crear aviso */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Plus size={16} /> Nuevo aviso</p>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Categoría</label>
          <select className="w-full px-4 py-3 text-base border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white"
            value={categoria} onChange={e => setCategoria(e.target.value)}>
            {CATEGORIAS_AVISO.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Descripción *</label>
          <textarea
            className="w-full px-4 py-3 text-base border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F5B731] resize-none"
            rows={3} placeholder="Describe el aviso o incidencia..."
            value={descripcion} onChange={e => setDescripcion(e.target.value)} />
        </div>
        <button onClick={crear} disabled={!descripcion.trim() || guardando}
          className="w-full min-h-[52px] rounded-xl text-base font-bold bg-[#1A1A1A] text-white hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-40">
          {guardando ? 'Enviando...' : 'Enviar aviso'}
        </button>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// TAB: INVENTARIO
// ══════════════════════════════════════════════════════════════
function fechaHoy() { return new Date().toISOString().split('T')[0] }

function TabInventario({ empleado }: { empleado: any }) {
  const [ingredientes, setIngredientes]     = useState<Ingrediente[]>([])
  const [cantidades, setCantidades]         = useState<Record<number, string>>({})
  const [busqueda, setBusqueda]             = useState('')
  const [fecha, setFecha]                   = useState(fechaHoy)
  const [loading, setLoading]               = useState(true)
  const [guardando, setGuardando]           = useState(false)
  const [guardado, setGuardado]             = useState(false)
  const [cerrado, setCerrado]               = useState(false)
  const [gruposAbiertos, setGruposAbiertos] = useState<Record<string, boolean>>({})

  const cargar = useCallback(async () => {
    if (!empleado) return
    setLoading(true)
    const [{ data: ings }, { data: ctns }] = await Promise.all([
      supabase
        .from('ingredientes')
        .select('id, nombre_ingrediente, proveedor, formato_compra, unidad_compra, unidad_producto')
        .order('proveedor')
        .order('nombre_ingrediente'),
      supabase
        .from('inventario_conteos')
        .select('ingrediente_id, cantidad, cerrado')
        .eq('empleado_id', empleado.id)
        .eq('fecha', fecha),
    ])

    const ingList = (ings ?? []) as Ingrediente[]
    const ctnList = (ctns ?? []) as Pick<InventarioConteo, 'ingrediente_id' | 'cantidad' | 'cerrado'>[]

    setIngredientes(ingList)
    setCerrado(ctnList.length > 0 && ctnList.every((c) => c.cerrado))

    const init: Record<number, string> = {}
    ctnList.forEach((c) => { init[c.ingrediente_id] = c.cantidad != null ? String(c.cantidad) : '' })
    setCantidades(init)

    // Abrir todos los grupos por defecto
    const grupos: Record<string, boolean> = {}
    ingList.forEach((i) => { grupos[i.proveedor?.trim() || 'Sin proveedor'] = true })
    setGruposAbiertos(grupos)
    setLoading(false)
  }, [empleado, fecha])

  useEffect(() => { cargar() }, [cargar])

  const agrupados = useMemo(() => {
    const q = busqueda.toLowerCase()
    const filtrados = ingredientes.filter((i) =>
      !q || i.nombre_ingrediente.toLowerCase().includes(q) || (i.proveedor ?? '').toLowerCase().includes(q)
    )
    const grupos: Record<string, Ingrediente[]> = {}
    filtrados.forEach((i) => {
      const g = i.proveedor?.trim() || 'Sin proveedor'
      if (!grupos[g]) grupos[g] = []
      grupos[g].push(i)
    })
    return Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b))
  }, [ingredientes, busqueda])

  const totalContados = useMemo(
    () => Object.values(cantidades).filter((v) => v !== '' && Number(v) > 0).length,
    [cantidades]
  )

  async function guardar() {
    if (!empleado || cerrado) return
    setGuardando(true)

    let grupoId: string | null = null
    // Intentar recuperar grupo_id existente
    const { data: existentes } = await supabase
      .from('inventario_conteos')
      .select('inventario_grupo_id')
      .eq('empleado_id', empleado.id)
      .eq('fecha', fecha)
      .limit(1)
      .maybeSingle()
    grupoId = (existentes as any)?.inventario_grupo_id ?? (
      typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`
    )

    const payload = Object.entries(cantidades)
      .filter(([, v]) => v !== '' && v !== undefined)
      .map(([ingId, cant]) => ({
        empleado_id: empleado.id,
        fecha,
        local_id: empleado.local_id ?? null,
        ingrediente_id: Number(ingId),
        cantidad: parseFloat(cant) || 0,
        inventario_grupo_id: grupoId,
        cerrado: false,
      }))

    if (payload.length > 0) {
      await supabase
        .from('inventario_conteos')
        .upsert(payload, { onConflict: 'empleado_id,fecha,ingrediente_id' })
    }

    setGuardando(false)
    setGuardado(true)
    setTimeout(() => setGuardado(false), 3000)
    cargar()
  }

  const esHoy = fecha === fechaHoy()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="animate-spin text-[#F5B731]" size={24} />
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-32">
      {/* Cabecera */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-gray-700">
            {totalContados} ingrediente{totalContados !== 1 ? 's' : ''} contado{totalContados !== 1 ? 's' : ''}
          </p>
          {conteos_yaGuardados(cantidades) && !cerrado && (
            <p className="text-xs text-emerald-600 mt-0.5">✓ Datos guardados para este día — editables</p>
          )}
        </div>
        {cerrado && (
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 text-gray-500 text-xs font-semibold rounded-full">
            <Lock size={11} /> Cerrado por admin
          </span>
        )}
      </div>

      {/* Selector fecha */}
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={fecha}
          max={fechaHoy()}
          onChange={(e) => { setFecha(e.target.value); setGuardado(false) }}
          className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white"
        />
        {!esHoy && (
          <button onClick={() => setFecha(fechaHoy())} className="text-xs text-[#F5B731] font-semibold hover:underline">
            Hoy
          </button>
        )}
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar ingrediente o proveedor..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full pl-9 pr-3 py-3 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#F5B731]"
        />
      </div>

      {/* Grupos */}
      {agrupados.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <Package size={32} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">
            {busqueda ? 'Sin resultados' : 'No hay ingredientes en la base de datos'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {agrupados.map(([proveedor, ings]) => {
            const abierto = gruposAbiertos[proveedor] !== false
            const contadosEnGrupo = ings.filter((i) => {
              const v = cantidades[i.id]
              return v !== '' && v !== undefined && Number(v) > 0
            }).length
            return (
              <div key={proveedor} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100 text-left"
                  onClick={() => setGruposAbiertos((g) => ({ ...g, [proveedor]: !abierto }))}
                >
                  <div>
                    <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">{proveedor}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{contadosEnGrupo}/{ings.length} contados</p>
                  </div>
                  <span className="text-gray-400 flex-shrink-0">
                    {abierto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </span>
                </button>

                {abierto && (
                  <div className="divide-y divide-gray-50">
                    {ings.map((ing) => {
                      const val = cantidades[ing.id] ?? ''
                      const tieneValor = val !== '' && Number(val) > 0
                      const unidad = ing.unidad_compra ?? ing.unidad_producto ?? ''
                      return (
                        <div
                          key={ing.id}
                          className={`flex items-center gap-3 px-4 py-3 transition-colors ${tieneValor ? 'bg-[#F5B731]/5' : ''}`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm leading-snug ${tieneValor ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                              {ing.nombre_ingrediente}
                            </p>
                            {ing.formato_compra && (
                              <p className="text-xs text-gray-400 mt-0.5">{ing.formato_compra}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="0.1"
                              placeholder="0"
                              disabled={cerrado}
                              value={val}
                              onChange={(e) => setCantidades((c) => ({ ...c, [ing.id]: e.target.value }))}
                              className={`w-20 px-2 py-2.5 text-sm text-center border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white transition-colors disabled:bg-gray-50 disabled:text-gray-400 ${
                                tieneValor ? 'border-[#F5B731] font-bold text-[#1A1A1A]' : 'border-gray-200 text-gray-500'
                              }`}
                            />
                            {unidad && (
                              <span className="text-xs text-gray-400 w-10 leading-tight">{unidad}</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Botón guardar flotante */}
      {!cerrado && (
        <div className="fixed bottom-16 md:bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 z-40 md:ml-56">
          <button
            onClick={guardar}
            disabled={guardando || totalContados === 0}
            className={`w-full flex items-center justify-center gap-2 py-4 text-sm font-bold rounded-xl transition-colors disabled:opacity-40 ${
              guardado ? 'bg-emerald-500 text-white' : 'bg-[#F5B731] text-[#1A1A1A] hover:bg-[#e0a820]'
            }`}
          >
            {guardado ? (
              <><CheckCircle2 size={18} /> ¡Inventario guardado!</>
            ) : guardando ? (
              <><RefreshCw size={18} className="animate-spin" /> Guardando...</>
            ) : (
              <><Save size={18} /> Guardar inventario{totalContados > 0 ? ` (${totalContados})` : ''}</>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

function conteos_yaGuardados(cantidades: Record<number, string>) {
  return Object.keys(cantidades).length > 0
}

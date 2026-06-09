'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Ingrediente, AvisoEquipo } from '@/lib/supabase'
import { useEmpleadoActual } from '@/lib/useEmpleado'
import {
  Thermometer, Sparkles, Trash2, Bell, RefreshCw, CheckCircle2, Circle,
  Plus, AlertTriangle, Package, Lock, ChevronRight,
} from 'lucide-react'

// ── Tipos temperatura ──────────────────────────────────────────
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
  if (n < -18)  return 'muy_frio'
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
  { key: 'mesa_fria_1',  label: 'Mesa fría 1',    desc: 'Bebidas / Tarros salsa / Leche',              tipo: 'nevera' },
  { key: 'mesa_fria_2',  label: 'Mesa fría 2',    desc: 'Bajo plancha — Fiambres, Quesos, Entrantes',  tipo: 'nevera' },
  { key: 'mesa_fria_3',  label: 'Mesa fría 3',    desc: 'Queso / Jamón / Salsas / Lechuga',            tipo: 'nevera' },
  { key: 'congelador_4', label: 'Congelador 4',   desc: 'Entrantes / Empanados / Patatas / Helado',    tipo: 'congelador' },
  { key: 'mesa_fria_5',  label: 'Mesa fría 5',    desc: 'Montaje plancha',                             tipo: 'nevera' },
  { key: 'nevera_6',     label: 'Nevera 6',       desc: 'Uso general',                                 tipo: 'nevera' },
]

const TAREAS_LIMPIEZA = [
  { label: 'Utensilios cocina',        frecuencia: 'diaria' },
  { label: 'Superficies cocina',       frecuencia: 'diaria' },
  { label: 'Superficies horizontales', frecuencia: 'diaria' },
  { label: 'Superficies verticales',   frecuencia: 'diaria' },
  { label: 'Baños',                    frecuencia: 'diaria' },
  { label: 'Freidora',                 frecuencia: 'semanal' },
  { label: 'Campana',                  frecuencia: 'semanal' },
  { label: 'Separador de grasas',      frecuencia: 'semanal' },
  { label: 'Tras inmobiliario',        frecuencia: 'semanal' },
  { label: 'Cámaras frigoríficas',     frecuencia: 'semanal' },
  { label: 'Congelador',               frecuencia: 'mensual' },
  { label: 'Tuberías gas',             frecuencia: 'mensual' },
  { label: 'Zonas difíciles acceso',   frecuencia: 'mensual' },
]

const CATEGORIAS_AVISO = ['Equipamiento', 'Seguridad', 'Suministros', 'Limpieza', 'Urgente', 'General']

type Tab = 'temperaturas' | 'limpiezas' | 'mermas' | 'avisos' | 'inventario'

export default function PaginaEmpleadoOps() {
  const { empleado, loading: empLoading } = useEmpleadoActual()
  const [tab, setTab] = useState<Tab>('temperaturas')
  const today = new Date().toISOString().split('T')[0]
  const localId = empleado?.local_id ?? null

  if (empLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <RefreshCw className="animate-spin text-[#F5B731]" size={24} />
    </div>
  )

  return (
    <div className="px-4 py-5 md:px-6 max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Operaciones</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-5 overflow-x-auto">
        {([
          { id: 'temperaturas', label: 'Temp.',      icon: Thermometer },
          { id: 'limpiezas',    label: 'Limpieza',   icon: Sparkles },
          { id: 'mermas',       label: 'Mermas',     icon: Trash2 },
          { id: 'avisos',       label: 'Avisos',     icon: Bell },
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

      {tab === 'temperaturas' && <TabTemperaturas empleado={empleado} localId={localId} today={today} />}
      {tab === 'limpiezas'    && <TabLimpiezas    empleado={empleado} localId={localId} today={today} />}
      {tab === 'mermas'       && <TabMermas       empleado={empleado} localId={localId} today={today} />}
      {tab === 'avisos'       && <TabAvisos       empleado={empleado} localId={localId} />}
      {tab === 'inventario'   && <TabInventarioCard empleado={empleado} />}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// TAB: TEMPERATURAS
// ══════════════════════════════════════════════════════════════
function TabTemperaturas({ empleado, localId, today }: { empleado: any; localId: number | null; today: string }) {
  const [turno, setTurno] = useState<'mañana' | 'noche'>(() => new Date().getHours() >= 14 ? 'noche' : 'mañana')
  const [vals, setVals] = useState<Record<string, string>>({})
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [exito, setExito] = useState(false)
  const [historial, setHistorial] = useState<any[]>([])

  const cargarHistorial = useCallback(async () => {
    const desde = new Date(); desde.setDate(desde.getDate() - 7)
    const { data } = await supabase.from('temperaturas').select('*').eq('local_id', localId ?? 1)
      .gte('fecha', desde.toISOString()).order('fecha', { ascending: false })
    setHistorial(data ?? [])
  }, [localId])

  useEffect(() => { cargarHistorial() }, [cargarHistorial])

  async function guardar() {
    if (!empleado) return
    setGuardando(true)
    const payload: Record<string, any> = { local_id: localId, empleado_nombre: empleado.nombre, fecha: new Date().toISOString(), turno, notas: notas.trim() || null }
    EQUIPOS.forEach(eq => { payload[eq.key] = vals[eq.key] !== '' && vals[eq.key] !== undefined ? Number(vals[eq.key]) : null })
    await supabase.from('temperaturas').insert(payload)
    setVals({}); setNotas(''); setGuardando(false); setExito(true)
    setTimeout(() => setExito(false), 3000); cargarHistorial()
  }

  const hayAlgunValor = EQUIPOS.some(eq => vals[eq.key] !== '' && vals[eq.key] !== undefined)

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        {(['mañana', 'noche'] as const).map(t => (
          <button key={t} onClick={() => setTurno(t)}
            className={`flex-1 py-3 rounded-xl text-base font-semibold transition-colors min-h-[48px] ${turno === t ? 'bg-[#F5B731] text-[#1A1A1A]' : 'bg-white border border-gray-200 text-gray-500'}`}>
            {t === 'mañana' ? '🌅 Mañana' : '🌙 Noche'}
          </button>
        ))}
      </div>

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
                <span className={`text-xs font-bold px-2 py-1 rounded-lg ${badge.cls} whitespace-nowrap`}>{badge.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <input type="number" step="0.1" inputMode="decimal"
                  className="flex-1 px-4 py-3 text-xl font-bold border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white text-center"
                  placeholder="—" value={v} onChange={e => setVals(prev => ({ ...prev, [eq.key]: e.target.value }))} />
                <span className="text-lg font-bold text-gray-400">°C</span>
              </div>
            </div>
          )
        })}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">Notas (opcional)</label>
        <input className="w-full px-4 py-3 text-base border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F5B731]"
          placeholder="Incidencias, observaciones..." value={notas} onChange={e => setNotas(e.target.value)} />
      </div>

      {exito && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <CheckCircle2 size={20} className="text-emerald-600" />
          <p className="text-base font-semibold text-emerald-700">Temperaturas registradas correctamente</p>
        </div>
      )}

      <button onClick={guardar} disabled={!hayAlgunValor || guardando}
        className="w-full min-h-[56px] rounded-xl text-base font-bold bg-[#F5B731] text-[#1A1A1A] hover:bg-[#e0a820] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed">
        {guardando ? <span className="flex items-center justify-center gap-2"><RefreshCw size={18} className="animate-spin" /> Guardando...</span> : 'Guardar temperaturas'}
      </button>

      {historial.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-500 mb-2">Últimos 7 días</p>
          <div className="space-y-2">
            {historial.slice(0, 10).map(r => (
              <div key={r.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-gray-700">
                    {new Date(r.fecha).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                    {' '}<span className="font-normal text-gray-400">{new Date(r.fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                  </p>
                  {r.turno && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.turno === 'mañana' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>{r.turno}</span>
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
    const { data } = await supabase.from('limpiezas').select('tarea').eq('fecha', today).eq('local_id', localId ?? 1)
    setHechasHoy(new Set((data ?? []).map((r: any) => r.tarea)))
  }, [today, localId])

  useEffect(() => { cargar() }, [cargar])

  async function registrar(tarea: string, frecuencia: string) {
    if (!empleado || hechasHoy.has(tarea)) return
    setGuardando(tarea)
    await supabase.from('limpiezas').insert({ local_id: localId, empleado_nombre: empleado.nombre, tarea, frecuencia, fecha: today })
    setHechasHoy(prev => new Set([...prev, tarea])); setGuardando(null)
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
                <button key={t.label} onClick={() => registrar(t.label, t.frecuencia)} disabled={hecha || !!guardando}
                  className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl border text-left transition-all min-h-[60px] ${hecha ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200 active:scale-[0.98]'}`}>
                  {cargando ? <RefreshCw size={22} className="animate-spin text-gray-400 flex-shrink-0" />
                    : hecha ? <CheckCircle2 size={22} className="text-emerald-500 flex-shrink-0" />
                    : <Circle size={22} className="text-gray-300 flex-shrink-0" />}
                  <span className={`text-base font-medium ${hecha ? 'text-emerald-700 line-through' : 'text-gray-800'}`}>{t.label}</span>
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
function TabMermas({ empleado, localId, today }: { empleado: any; localId: number | null; today: string }) {
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([])
  const [busq, setBusq] = useState('')
  const [dropOpen, setDropOpen] = useState(false)
  const [selId, setSelId] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [tipo, setTipo] = useState<'desperdicio' | 'consumo_interno'>('desperdicio')
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [exito, setExito] = useState(false)
  const [error, setError] = useState('')
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.from('ingredientes').select('*').order('nombre_ingrediente').then(({ data }) => setIngredientes(data ?? []))
  }, [])

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  const ingFiltrados = useMemo(() =>
    ingredientes.filter(i => i.nombre_ingrediente.toLowerCase().includes(busq.toLowerCase())).slice(0, 8),
    [ingredientes, busq]
  )
  const ingSel = ingredientes.find(i => String(i.id) === selId)

  function seleccionar(ing: Ingrediente) {
    setSelId(String(ing.id)); setBusq(ing.nombre_ingrediente); setDropOpen(false)
  }

  async function guardar() {
    if (!selId) { setError('Selecciona un ingrediente'); return }
    if (!cantidad || Number(cantidad) <= 0) { setError('Introduce una cantidad válida'); return }
    setGuardando(true); setError('')
    const coste = ingSel?.precio_unidad_producto ? Number(cantidad) * ingSel.precio_unidad_producto : null
    await supabase.from('mermas').insert({
      local_id: localId, empleado_nombre: empleado?.nombre ?? '',
      tipo, ingrediente_id: Number(selId), cantidad: Number(cantidad), coste,
      fecha: today, notas: notas.trim() || null,
    })
    setBusq(''); setSelId(''); setCantidad(''); setNotas(''); setGuardando(false)
    setExito(true); setTimeout(() => setExito(false), 3000)
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">Ingrediente *</label>
        <div className="relative" ref={dropRef}>
          <input className="w-full px-4 py-3 text-base border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F5B731]"
            placeholder="Buscar ingrediente..." value={busq}
            onChange={e => { setBusq(e.target.value); setDropOpen(true); if (!e.target.value) setSelId('') }}
            onFocus={() => setDropOpen(true)} autoComplete="off" />
          {dropOpen && ingFiltrados.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
              {ingFiltrados.map(ing => (
                <button key={ing.id} type="button" onMouseDown={() => seleccionar(ing)}
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

      <button onClick={guardar} disabled={guardando || !selId || !cantidad}
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
    Urgente: 'bg-rose-100 text-rose-700', Seguridad: 'bg-orange-100 text-orange-700',
    Equipamiento: 'bg-blue-100 text-blue-700', Suministros: 'bg-purple-100 text-purple-700',
    Limpieza: 'bg-teal-100 text-teal-700', General: 'bg-gray-100 text-gray-600',
  }

  return (
    <div className="space-y-5">
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
          <textarea className="w-full px-4 py-3 text-base border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F5B731] resize-none"
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
// TAB: INVENTARIO — tarjeta de estado + link a la página completa
// ══════════════════════════════════════════════════════════════
type EstadoInventario = 'cargando' | 'sin_iniciar' | 'borrador' | 'confirmado' | 'bloqueado'

function TabInventarioCard({ empleado }: { empleado: any }) {
  const [estado, setEstado] = useState<EstadoInventario>('cargando')
  const [totalContados, setTotalContados] = useState(0)

  useEffect(() => {
    if (!empleado) return
    const ahora = new Date()
    const y = ahora.getFullYear()
    const m = ahora.getMonth() + 1
    const inicioMes = `${y}-${String(m).padStart(2, '0')}-01`
    const finMes = new Date(y, m, 0).toISOString().split('T')[0]

    Promise.all([
      supabase.from('inventario_conteos')
        .select('cerrado, cantidad')
        .eq('empleado_id', empleado.id)
        .gte('fecha', inicioMes)
        .lte('fecha', finMes),
      supabase.from('inventario_conteos')
        .select('id', { count: 'exact', head: true })
        .eq('cerrado', false)
        .gte('fecha', inicioMes)
        .lte('fecha', finMes)
        .neq('empleado_id', empleado.id),
    ]).then(([{ data: propios }, { count: otrosCount }]) => {
      const rows = propios ?? []
      if (rows.length === 0) {
        setEstado((otrosCount ?? 0) > 0 ? 'bloqueado' : 'sin_iniciar')
      } else if (rows.every(r => r.cerrado)) {
        setEstado('confirmado')
        setTotalContados(rows.filter(r => (r.cantidad ?? 0) > 0).length)
      } else {
        setEstado('borrador')
        setTotalContados(rows.filter(r => (r.cantidad ?? 0) > 0).length)
      }
    })
  }, [empleado])

  const mesNombre = new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })

  const cfgs: Record<EstadoInventario, { bg: string; border: string; badge: string; badgeCls: string; titulo: string; desc: string; btnLabel: string; btnCls: string }> = {
    cargando:    { bg: 'bg-white',       border: 'border-gray-200',   badge: '', badgeCls: '', titulo: 'Comprobando...', desc: '', btnLabel: '', btnCls: '' },
    sin_iniciar: { bg: 'bg-white',       border: 'border-gray-200',   badge: 'Sin iniciar', badgeCls: 'bg-gray-100 text-gray-500', titulo: 'Inventario mensual', desc: 'El inventario de este mes no ha sido realizado todavía.', btnLabel: 'Iniciar inventario', btnCls: 'bg-[#F5B731] text-[#1A1A1A]' },
    borrador:    { bg: 'bg-amber-50',    border: 'border-amber-200',  badge: 'Borrador', badgeCls: 'bg-amber-100 text-amber-700', titulo: 'En progreso', desc: `${totalContados} ingrediente${totalContados !== 1 ? 's' : ''} contado${totalContados !== 1 ? 's' : ''}. Recuerda confirmar el inventario.`, btnLabel: 'Continuar inventario', btnCls: 'bg-[#F5B731] text-[#1A1A1A]' },
    confirmado:  { bg: 'bg-emerald-50',  border: 'border-emerald-200', badge: 'Confirmado', badgeCls: 'bg-emerald-100 text-emerald-700', titulo: '¡Inventario enviado!', desc: `${totalContados} ingrediente${totalContados !== 1 ? 's' : ''} registrado${totalContados !== 1 ? 's' : ''}. El admin ya puede verlo.`, btnLabel: 'Ver inventario', btnCls: 'bg-white border border-emerald-200 text-emerald-700' },
    bloqueado:   { bg: 'bg-rose-50',     border: 'border-rose-200',   badge: 'Bloqueado', badgeCls: 'bg-rose-100 text-rose-700', titulo: 'Inventario en uso', desc: 'Otro compañero tiene el inventario abierto. Espera a que lo confirme.', btnLabel: '', btnCls: '' },
  }

  const cfg = cfgs[estado]

  return (
    <div className={`rounded-2xl border p-6 ${cfg.bg} ${cfg.border}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide capitalize mb-1">{mesNombre}</p>
          {estado === 'cargando' ? (
            <div className="flex items-center gap-2 text-gray-400">
              <RefreshCw size={16} className="animate-spin" />
              <span className="text-sm">Comprobando estado...</span>
            </div>
          ) : (
            <p className="text-lg font-bold text-gray-900">{cfg.titulo}</p>
          )}
        </div>
        {cfg.badge && (
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cfg.badgeCls}`}>{cfg.badge}</span>
        )}
      </div>

      {estado !== 'cargando' && (
        <>
          <p className="text-sm text-gray-500 mb-5">{cfg.desc}</p>
          {cfg.btnLabel ? (
            <Link href="/empleado/inventario"
              className={`flex items-center justify-center gap-2 w-full min-h-[52px] font-bold rounded-xl text-base active:scale-[0.98] transition-transform ${cfg.btnCls}`}>
              {cfg.btnLabel}
              <ChevronRight size={18} />
            </Link>
          ) : estado === 'bloqueado' ? (
            <div className="flex items-center gap-2 text-rose-600">
              <Lock size={18} />
              <span className="text-sm font-medium">Vuelve más tarde</span>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

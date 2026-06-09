'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { Ingrediente, InventarioConteo } from '@/lib/supabase'
import { useEmpleadoActual } from '@/lib/useEmpleado'
import {
  RefreshCw, Save, Search, Package, CheckCircle2, Lock,
  ChevronDown, ChevronUp, Send, AlertTriangle,
} from 'lucide-react'

function fechaHoy() { return new Date().toISOString().split('T')[0] }

function getMesActual() {
  const ahora = new Date()
  const y = ahora.getFullYear()
  const m = ahora.getMonth() + 1
  return {
    inicioMes: `${y}-${String(m).padStart(2, '0')}-01`,
    finMes:    new Date(y, m, 0).toISOString().split('T')[0],
    nombre:    ahora.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
  }
}

type EstadoInventario = 'cargando' | 'sin_iniciar' | 'borrador' | 'confirmado' | 'bloqueado'

export default function PaginaInventario() {
  const { empleado, loading: empLoading } = useEmpleadoActual()
  const [estado, setEstado] = useState<EstadoInventario>('cargando')
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([])
  const [cantidades, setCantidades] = useState<Record<number, string>>({})
  const [busqueda, setBusqueda] = useState('')
  const [fechaSession, setFechaSession] = useState(fechaHoy())
  const [grupoId, setGrupoId] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [mensajeExito, setMensajeExito] = useState('')
  const [gruposAbiertos, setGruposAbiertos] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

  const { inicioMes, finMes, nombre: mesNombre } = getMesActual()

  const cargar = useCallback(async () => {
    if (!empleado) return
    setLoading(true)

    const [{ data: ings }, { data: propios }, { count: otrosCount }] = await Promise.all([
      supabase.from('ingredientes')
        .select('id, nombre_ingrediente, proveedor, formato_compra, unidad_compra, unidad_producto')
        .order('proveedor').order('nombre_ingrediente'),
      supabase.from('inventario_conteos')
        .select('*')
        .eq('empleado_id', empleado.id)
        .gte('fecha', inicioMes)
        .lte('fecha', finMes),
      supabase.from('inventario_conteos')
        .select('id', { count: 'exact', head: true })
        .eq('cerrado', false)
        .gte('fecha', inicioMes)
        .lte('fecha', finMes)
        .neq('empleado_id', empleado.id),
    ])

    const ingList = (ings ?? []) as Ingrediente[]
    const rows = (propios ?? []) as InventarioConteo[]

    setIngredientes(ingList)

    // Inicializar grupos abiertos
    const gAbiertos: Record<string, boolean> = {}
    ingList.forEach(i => { gAbiertos[i.proveedor?.trim() || 'Sin proveedor'] = true })
    setGruposAbiertos(gAbiertos)

    if (rows.length === 0) {
      // Sin datos propios
      setEstado((otrosCount ?? 0) > 0 ? 'bloqueado' : 'sin_iniciar')
      setCantidades({})
      setFechaSession(fechaHoy())
      setGrupoId(null)
    } else if (rows.every(r => r.cerrado)) {
      setEstado('confirmado')
      const init: Record<number, string> = {}
      rows.forEach(c => { init[c.ingrediente_id] = c.cantidad != null ? String(c.cantidad) : '' })
      setCantidades(init)
      setFechaSession(rows[0].fecha)
      setGrupoId(rows[0].inventario_grupo_id ?? null)
    } else {
      setEstado('borrador')
      const init: Record<number, string> = {}
      rows.forEach(c => { init[c.ingrediente_id] = c.cantidad != null ? String(c.cantidad) : '' })
      setCantidades(init)
      setFechaSession(rows[0].fecha)
      setGrupoId(rows[0].inventario_grupo_id ?? null)
    }

    setLoading(false)
  }, [empleado, inicioMes, finMes])

  useEffect(() => { if (!empLoading && empleado) cargar(); else if (!empLoading) setLoading(false) }, [empLoading, empleado, cargar])

  const agrupados = useMemo(() => {
    const q = busqueda.toLowerCase()
    const filtrados = ingredientes.filter(i =>
      !q || i.nombre_ingrediente.toLowerCase().includes(q) || (i.proveedor ?? '').toLowerCase().includes(q)
    )
    const grupos: Record<string, Ingrediente[]> = {}
    filtrados.forEach(i => {
      const g = i.proveedor?.trim() || 'Sin proveedor'
      if (!grupos[g]) grupos[g] = []
      grupos[g].push(i)
    })
    return Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b))
  }, [ingredientes, busqueda])

  const totalContados = useMemo(
    () => Object.values(cantidades).filter(v => v !== '' && Number(v) > 0).length,
    [cantidades]
  )

  async function guardarBorrador() {
    if (!empleado || estado === 'confirmado' || estado === 'bloqueado') return
    setGuardando(true)

    let gId = grupoId
    if (!gId) {
      gId = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
      setGrupoId(gId)
    }

    const payload = Object.entries(cantidades)
      .filter(([, v]) => v !== '' && v !== undefined)
      .map(([ingId, cant]) => ({
        empleado_id: empleado.id,
        fecha: fechaSession,
        local_id: empleado.local_id ?? null,
        ingrediente_id: Number(ingId),
        cantidad: parseFloat(cant) || 0,
        inventario_grupo_id: gId,
        cerrado: false,
      }))

    if (payload.length > 0) {
      await supabase.from('inventario_conteos')
        .upsert(payload, { onConflict: 'empleado_id,fecha,ingrediente_id' })
    }

    setGuardando(false)
    setEstado('borrador')
    setMensajeExito('borrador')
    setTimeout(() => setMensajeExito(''), 3000)
  }

  async function confirmarInventario() {
    if (!empleado || totalContados === 0) return
    setConfirmando(true)

    // Primero guardar con los valores actuales
    let gId = grupoId
    if (!gId) {
      gId = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
      setGrupoId(gId)
    }

    const payload = Object.entries(cantidades)
      .filter(([, v]) => v !== '' && v !== undefined)
      .map(([ingId, cant]) => ({
        empleado_id: empleado.id,
        fecha: fechaSession,
        local_id: empleado.local_id ?? null,
        ingrediente_id: Number(ingId),
        cantidad: parseFloat(cant) || 0,
        inventario_grupo_id: gId,
        cerrado: true,
      }))

    if (payload.length > 0) {
      await supabase.from('inventario_conteos')
        .upsert(payload, { onConflict: 'empleado_id,fecha,ingrediente_id' })
    }

    // Cerrar cualquier fila restante del grupo que no esté en el payload
    if (gId) {
      await supabase.from('inventario_conteos')
        .update({ cerrado: true })
        .eq('inventario_grupo_id', gId)
    }

    setConfirmando(false)
    setEstado('confirmado')
    setMensajeExito('confirmado')
    setTimeout(() => setMensajeExito(''), 5000)
  }

  if (empLoading || loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <RefreshCw className="animate-spin text-[#F5B731]" size={24} />
    </div>
  )

  const esEditable = estado === 'sin_iniciar' || estado === 'borrador'

  // ── Estado: BLOQUEADO ──────────────────────────────────────
  if (estado === 'bloqueado') {
    return (
      <div className="p-4 max-w-2xl">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900">Inventario</h1>
          <p className="text-sm text-gray-400 capitalize mt-0.5">{mesNombre}</p>
        </div>
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center">
          <Lock size={36} className="mx-auto text-rose-400 mb-4" />
          <p className="text-lg font-bold text-rose-700 mb-2">Inventario bloqueado</p>
          <p className="text-sm text-rose-600">
            Un compañero tiene el inventario abierto en este momento.
            Espera a que lo confirme para poder editar.
          </p>
        </div>
      </div>
    )
  }

  // ── Estado: CONFIRMADO (read-only) ─────────────────────────
  if (estado === 'confirmado') {
    return (
      <div className="p-4 max-w-2xl pb-10">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Inventario</h1>
            <p className="text-sm text-gray-400 capitalize mt-0.5">{mesNombre}</p>
          </div>
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
            <CheckCircle2 size={12} /> Confirmado
          </span>
        </div>

        {mensajeExito === 'confirmado' && (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-4">
            <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0" />
            <div>
              <p className="text-base font-bold text-emerald-700">¡Inventario confirmado!</p>
              <p className="text-sm text-emerald-600">El administrador ya puede verlo en el panel.</p>
            </div>
          </div>
        )}

        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-5">
          <p className="text-sm text-emerald-700 font-medium">
            {totalContados} ingrediente{totalContados !== 1 ? 's' : ''} registrado{totalContados !== 1 ? 's' : ''}
            · Enviado al administrador
          </p>
        </div>

        <div className="space-y-3">
          {agrupados.map(([proveedor, ings]) => (
            <div key={proveedor} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">{proveedor}</p>
              </div>
              <div className="divide-y divide-gray-50">
                {ings.map(ing => {
                  const val = cantidades[ing.id] ?? ''
                  if (!val || Number(val) === 0) return null
                  return (
                    <div key={ing.id} className="flex items-center justify-between px-4 py-3">
                      <p className="text-sm text-gray-700">{ing.nombre_ingrediente}</p>
                      <span className="text-sm font-bold text-gray-900 tabular-nums">
                        {val} {ing.unidad_compra ?? ing.unidad_producto ?? ''}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Estados: SIN_INICIAR / BORRADOR (editable) ─────────────
  return (
    <div className="p-4 max-w-2xl pb-44">
      {/* Cabecera */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Inventario</h1>
          <p className="text-sm text-gray-400 capitalize mt-0.5">{mesNombre}</p>
        </div>
        {estado === 'borrador' && (
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Borrador
          </span>
        )}
      </div>

      {/* Progreso */}
      <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          <span className="font-bold text-gray-900">{totalContados}</span> de {ingredientes.length} ingredientes contados
        </p>
        {estado === 'borrador' && (
          <p className="text-xs text-amber-600 font-medium">En progreso</p>
        )}
      </div>

      {mensajeExito === 'borrador' && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-4">
          <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
          <p className="text-sm font-semibold text-emerald-700">Borrador guardado — puedes continuar más tarde</p>
        </div>
      )}

      {/* Buscador */}
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar ingrediente o proveedor..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#F5B731]"
        />
      </div>

      {/* Lista de ingredientes por proveedor */}
      {agrupados.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <Package size={32} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">{busqueda ? 'Sin resultados' : 'No hay ingredientes en la base de datos'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {agrupados.map(([proveedor, ings]) => {
            const abierto = gruposAbiertos[proveedor] !== false
            const contadosEnGrupo = ings.filter(i => { const v = cantidades[i.id]; return v !== '' && v !== undefined && Number(v) > 0 }).length
            return (
              <div key={proveedor} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100 text-left"
                  onClick={() => setGruposAbiertos(g => ({ ...g, [proveedor]: !abierto }))}
                >
                  <div>
                    <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">{proveedor}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {contadosEnGrupo}/{ings.length} contados
                      {contadosEnGrupo === ings.length && contadosEnGrupo > 0 && (
                        <span className="ml-1.5 text-emerald-500 font-semibold">✓</span>
                      )}
                    </p>
                  </div>
                  <span className="text-gray-400 flex-shrink-0">
                    {abierto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </span>
                </button>

                {abierto && (
                  <div className="divide-y divide-gray-50">
                    {ings.map(ing => {
                      const val = cantidades[ing.id] ?? ''
                      const tieneValor = val !== '' && Number(val) > 0
                      const unidad = ing.unidad_compra ?? ing.unidad_producto ?? ''
                      return (
                        <div key={ing.id} className={`flex items-center gap-3 px-4 py-3 transition-colors ${tieneValor ? 'bg-[#F5B731]/5' : ''}`}>
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
                              disabled={!esEditable}
                              value={val}
                              onChange={e => setCantidades(c => ({ ...c, [ing.id]: e.target.value }))}
                              className={`w-20 px-2 py-2 text-sm text-center border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white transition-colors disabled:bg-gray-50 disabled:text-gray-400 ${
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

      {/* Botones flotantes */}
      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-40 md:ml-56">
        {totalContados === 0 && (
          <p className="text-xs text-gray-400 text-center mb-2 flex items-center justify-center gap-1">
            <AlertTriangle size={12} /> Rellena al menos un ingrediente para guardar
          </p>
        )}
        <div className="flex gap-3">
          <button
            onClick={guardarBorrador}
            disabled={guardando || confirmando || totalContados === 0}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-bold rounded-xl border-2 border-[#F5B731] text-[#1A1A1A] bg-white hover:bg-[#F5B731]/10 active:scale-[0.98] transition-all disabled:opacity-40"
          >
            {guardando
              ? <><RefreshCw size={16} className="animate-spin" /> Guardando...</>
              : <><Save size={16} /> Guardar borrador</>
            }
          </button>
          <button
            onClick={confirmarInventario}
            disabled={guardando || confirmando || totalContados === 0}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-bold rounded-xl bg-[#1A1A1A] text-white hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-40"
          >
            {confirmando
              ? <><RefreshCw size={16} className="animate-spin" /> Confirmando...</>
              : <><Send size={16} /> Confirmar y enviar</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

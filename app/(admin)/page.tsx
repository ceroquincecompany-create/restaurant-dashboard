'use client'

import { useLocales, useVentasHoy, useVentasTodos30Dias } from '@/lib/hooks'
import KPICard from '@/components/KPICard'
import GraficoVentas from '@/components/GraficoVentas'
import GraficoCostes from '@/components/GraficoCostes'
import FormularioVenta from '@/components/FormularioVenta'
import TablaResumen from '@/components/TablaResumen'
import {
  WidgetSaludFinanciera,
  WidgetEbitda,
  WidgetOpsAvisadores,
  WidgetMermasMes,
  WidgetAvisosActivos,
} from '@/components/dashboard/widgets'
import { Euro, Percent, Users, TrendingUp, RefreshCw, Settings2, Eye, Check } from 'lucide-react'
import { useState, useCallback, useEffect, useRef } from 'react'

// ─────────────────────────────────────────────
// WIDGET SYSTEM
// ─────────────────────────────────────────────

type WidgetId = 'salud_financiera' | 'ebitda' | 'ops_avisadores' | 'mermas_mes' | 'avisos_activos'
type WidgetCfg = { id: WidgetId; visible: boolean }

const STORAGE_KEY = 'sofi_dashboard_widgets_v1'

const WIDGET_META: Record<WidgetId, { label: string; large: boolean }> = {
  salud_financiera: { label: 'Salud Financiera',        large: true  },
  ebitda:           { label: 'EBITDA',                   large: false },
  ops_avisadores:   { label: 'Avisadores Operaciones',   large: false },
  mermas_mes:       { label: 'Mermas del Mes',           large: false },
  avisos_activos:   { label: 'Avisos Activos',           large: false },
}

const DEFAULTS: WidgetCfg[] = [
  { id: 'salud_financiera', visible: true },
  { id: 'ebitda',           visible: true },
  { id: 'ops_avisadores',   visible: true },
  { id: 'mermas_mes',       visible: true },
  { id: 'avisos_activos',   visible: true },
]

function useDashboardData() {
  const [refetchKey, setRefetchKey] = useState(0)
  const refetch = useCallback(() => setRefetchKey((k) => k + 1), [])
  return { refetchKey, refetch }
}

export default function Dashboard() {
  const { locales, loading: loadLocales } = useLocales()
  const { refetchKey, refetch } = useDashboardData()

  const local1 = locales[0]
  const local2 = locales[1]
  const local3 = locales[2]

  const { venta: v1 } = useVentasHoy(local1?.id)
  const { venta: v2 } = useVentasHoy(local2?.id)
  const { venta: v3 } = useVentasHoy(local3?.id)

  const { ventas: ventas30 } = useVentasTodos30Dias()

  const ventasHoy = [v1, v2, v3]

  const totalVentas    = ventasHoy.reduce((s, v) => s + (v?.total_ventas ?? 0), 0)
  const totalAlimentos = ventasHoy.reduce((s, v) => s + (v?.coste_alimentos ?? 0), 0)
  const totalPersonal  = ventasHoy.reduce((s, v) => s + (v?.coste_personal ?? 0), 0)
  const totalClientes  = ventasHoy.reduce((s, v) => s + (v?.num_clientes ?? 0), 0)

  const foodCostPct    = totalVentas > 0 ? (totalAlimentos / totalVentas) * 100 : 0
  const personalPct    = totalVentas > 0 ? (totalPersonal / totalVentas) * 100 : 0
  const primerCostePct = totalVentas > 0 ? ((totalAlimentos + totalPersonal) / totalVentas) * 100 : 0

  const hoy = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  // ── Widget config (persisted in localStorage) ─────────────
  const [widgets, setWidgets] = useState<WidgetCfg[]>(DEFAULTS)
  const [editMode, setEditMode] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as WidgetCfg[]
        // Merge: preserve order from saved, append new defaults not in saved
        const knownIds = parsed.map(p => p.id)
        const merged = [
          ...parsed.filter(p => DEFAULTS.some(d => d.id === p.id)),
          ...DEFAULTS.filter(d => !knownIds.includes(d.id)),
        ]
        setWidgets(merged)
      }
    } catch {}
  }, [])

  function guardarDisposicion() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets))
    setEditMode(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function cancelarEdicion() {
    // Revert unsaved changes
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setWidgets(JSON.parse(raw))
      else setWidgets(DEFAULTS)
    } catch { setWidgets(DEFAULTS) }
    setEditMode(false)
  }

  function hideWidget(id: WidgetId) {
    setWidgets(prev => prev.map(w => w.id === id ? { ...w, visible: false } : w))
  }
  function showWidget(id: WidgetId) {
    setWidgets(prev => prev.map(w => w.id === id ? { ...w, visible: true } : w))
  }

  // ── Drag and drop ──────────────────────────────────────────
  const draggedId = useRef<WidgetId | null>(null)
  const [dragOverId, setDragOverId] = useState<WidgetId | null>(null)

  function handleDragStart(id: WidgetId) { draggedId.current = id }
  function handleDragEnd() { draggedId.current = null; setDragOverId(null) }
  function handleDragOver(e: React.DragEvent, id: WidgetId) {
    e.preventDefault()
    if (draggedId.current && draggedId.current !== id) setDragOverId(id)
  }
  function handleDrop(targetId: WidgetId) {
    const fromId = draggedId.current
    if (!fromId || fromId === targetId) return
    setWidgets(prev => {
      const next = [...prev]
      const fromIdx = next.findIndex(w => w.id === fromId)
      const toIdx = next.findIndex(w => w.id === targetId)
      const [item] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, item)
      return next
    })
    draggedId.current = null
    setDragOverId(null)
  }

  const visibleWidgets = widgets.filter(w => w.visible)
  const hiddenWidgets  = widgets.filter(w => !w.visible)

  // ── Widget renderer ────────────────────────────────────────
  function renderWidget(w: WidgetCfg) {
    const props = { editMode, onHide: () => hideWidget(w.id) }
    switch (w.id) {
      case 'salud_financiera': return <WidgetSaludFinanciera key={w.id} {...props} />
      case 'ebitda':           return <WidgetEbitda key={w.id} {...props} />
      case 'ops_avisadores':   return <WidgetOpsAvisadores key={w.id} {...props} />
      case 'mermas_mes':       return <WidgetMermasMes key={w.id} {...props} />
      case 'avisos_activos':   return <WidgetAvisosActivos key={w.id} {...props} />
    }
  }

  if (loadLocales) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="animate-spin mx-auto text-[#F5B731] mb-2" size={24} />
          <p className="text-sm text-gray-500">Cargando dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl">
      {/* ── Header ── */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard General</h1>
          <p className="text-sm text-gray-400 capitalize mt-0.5">{hoy}</p>
        </div>
        <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-3 py-1 font-medium">
          {locales.length} locales activos
        </span>
      </div>

      {/* ── KPIs del día ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard
          titulo="Ventas del día"
          valor={totalVentas > 0 ? `${totalVentas.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€` : '—'}
          subtitulo="Suma todos los locales"
          icono={Euro}
          color="azul"
        />
        <KPICard
          titulo="Food Cost %"
          valor={totalVentas > 0 ? `${foodCostPct.toFixed(1)}%` : '—'}
          subtitulo={foodCostPct > 35 ? '⚠ Por encima del objetivo (35%)' : '✓ Dentro del objetivo'}
          icono={Percent}
          color={foodCostPct > 35 ? 'rojo' : 'verde'}
        />
        <KPICard
          titulo="Coste Personal %"
          valor={totalVentas > 0 ? `${personalPct.toFixed(1)}%` : '—'}
          subtitulo={personalPct > 30 ? '⚠ Por encima del objetivo (30%)' : '✓ Dentro del objetivo'}
          icono={Users}
          color={personalPct > 30 ? 'rojo' : 'verde'}
        />
        <KPICard
          titulo="Primer Coste %"
          valor={totalVentas > 0 ? `${primerCostePct.toFixed(1)}%` : '—'}
          subtitulo="Food + Personal"
          icono={TrendingUp}
          color={primerCostePct > 65 ? 'rojo' : primerCostePct > 60 ? 'amarillo' : 'morado'}
        />
      </div>

      {/* ── Tabla resumen ── */}
      <div className="mb-6">
        <TablaResumen locales={locales} ventasHoy={ventasHoy} />
      </div>

      {/* ── Gráficos + Formulario ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-10">
        <div className="lg:col-span-2 space-y-4">
          <GraficoVentas ventas={ventas30} />
          <GraficoCostes ventas={ventas30} />
        </div>
        <div>
          <FormularioVenta locales={locales} onSuccess={refetch} />
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          WIDGETS CONFIGURABLES
      ══════════════════════════════════════════════ */}
      <div>
        {/* Barra de edición */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-gray-800">Panel de análisis</h2>
            {saved && (
              <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                <Check size={13} /> Guardado
              </span>
            )}
          </div>
          {editMode ? (
            <div className="flex items-center gap-2">
              <button
                onClick={cancelarEdicion}
                className="px-3 py-1.5 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={guardarDisposicion}
                className="px-4 py-1.5 text-sm font-bold bg-[#1A1A1A] text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                Guardar disposición
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditMode(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:border-[#F5B731] hover:text-[#1A1A1A] transition-colors"
            >
              <Settings2 size={14} />
              Personalizar
            </button>
          )}
        </div>

        {/* Edit mode hint */}
        {editMode && (
          <div className="mb-4 px-4 py-3 bg-[#F5B731]/10 border border-[#F5B731]/30 rounded-xl text-xs text-gray-600 flex items-center gap-2">
            <span className="font-semibold text-[#1A1A1A]">Modo edición activo</span>
            — Arrastra los widgets para reordenarlos · Toca <EyeOff16 /> para ocultar un widget
          </div>
        )}

        {/* Widget grid */}
        {visibleWidgets.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {visibleWidgets.map(w => (
              <div
                key={w.id}
                className={[
                  WIDGET_META[w.id].large ? 'lg:col-span-2' : '',
                  editMode ? 'cursor-grab active:cursor-grabbing' : '',
                  dragOverId === w.id ? 'ring-2 ring-[#F5B731] ring-offset-2 rounded-2xl' : '',
                  'transition-shadow',
                ].filter(Boolean).join(' ')}
                draggable={editMode}
                onDragStart={() => handleDragStart(w.id)}
                onDragEnd={handleDragEnd}
                onDragOver={e => handleDragOver(e, w.id)}
                onDrop={() => handleDrop(w.id)}
              >
                {renderWidget(w)}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
            <p className="text-sm text-gray-400">Todos los widgets están ocultos.</p>
            <p className="text-xs text-gray-300 mt-1">Actívalos desde el panel de abajo.</p>
          </div>
        )}

        {/* Widgets ocultos (solo en edit mode) */}
        {editMode && hiddenWidgets.length > 0 && (
          <div className="mt-4 border border-dashed border-gray-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">
              Widgets ocultos — toca para mostrar
            </p>
            <div className="flex flex-wrap gap-2">
              {hiddenWidgets.map(w => (
                <button
                  key={w.id}
                  onClick={() => showWidget(w.id)}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-medium bg-white border border-gray-200 rounded-lg hover:border-[#F5B731] hover:text-[#1A1A1A] transition-colors"
                >
                  <Eye size={12} />
                  {WIDGET_META[w.id].label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Inline icon for the edit hint
function EyeOff16() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block align-middle mx-0.5">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

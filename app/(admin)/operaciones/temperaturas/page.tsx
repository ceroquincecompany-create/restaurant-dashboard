'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import type { Temperatura, Local } from '@/lib/supabase'
import { Plus, X, Trash2, RefreshCw, Thermometer, Download } from 'lucide-react'

// ── Lógica de colores SOFI ─────────────────────────────────────
type Estado = 'ok' | 'aviso' | 'alerta' | 'muy_frio' | 'sin_dato'

function estadoNevera(t: number | null): Estado {
  if (t == null) return 'sin_dato'
  if (t < -2)  return 'muy_frio'
  if (t <= 4)  return 'ok'
  if (t <= 7)  return 'aviso'
  return 'alerta'
}

function estadoCongelador(t: number | null): Estado {
  if (t == null) return 'sin_dato'
  if (t < -18) return 'muy_frio'
  if (t <= -15) return 'ok'
  if (t <= -10) return 'aviso'
  return 'alerta'
}

const ESTADO_CFG: Record<Estado, { cls: string; dot: string; label: string }> = {
  ok:        { cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500',  label: 'Correcto' },
  aviso:     { cls: 'bg-orange-100 text-orange-700',   dot: 'bg-orange-400',   label: 'Atención' },
  alerta:    { cls: 'bg-rose-100 text-rose-700',       dot: 'bg-rose-500',     label: 'Alerta' },
  muy_frio:  { cls: 'bg-blue-100 text-blue-700',       dot: 'bg-blue-500',     label: 'Muy frío' },
  sin_dato:  { cls: 'bg-gray-100 text-gray-400',       dot: 'bg-gray-300',     label: '—' },
}

const EQUIPOS = [
  { key: 'mesa_fria_1' as const, label: 'Mesa fría 1', desc: 'Bebidas / Tarros salsa / Leche', tipo: 'nevera' },
  { key: 'mesa_fria_2' as const, label: 'Mesa fría 2', desc: 'Bajo plancha — Fiambres, Quesos, Entrantes, Carnes', tipo: 'nevera' },
  { key: 'mesa_fria_3' as const, label: 'Mesa fría 3', desc: 'Queso / Jamón / Salsas / Lechuga', tipo: 'nevera' },
  { key: 'congelador_4' as const, label: 'Congelador 4', desc: 'Entrantes / Empanados / Patatas / Pulled pork / Bacon / Helado', tipo: 'congelador' },
  { key: 'mesa_fria_5' as const, label: 'Mesa fría 5', desc: 'Montaje plancha', tipo: 'nevera' },
  { key: 'nevera_6' as const, label: 'Nevera 6', desc: 'Uso general', tipo: 'nevera' },
]

type TempKey = typeof EQUIPOS[number]['key']

type FormTemp = {
  local_id: string; empleado_nombre: string; fecha: string; turno: string
  mesa_fria_1: string; mesa_fria_2: string; mesa_fria_3: string
  congelador_4: string; mesa_fria_5: string; nevera_6: string; notas: string
}

const ahora = () => new Date().toISOString().slice(0, 16)
const FORM_VACIO: FormTemp = {
  local_id: '', empleado_nombre: '', fecha: ahora(), turno: 'mañana',
  mesa_fria_1: '', mesa_fria_2: '', mesa_fria_3: '',
  congelador_4: '', mesa_fria_5: '', nevera_6: '', notas: '',
}

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white'

function Modal({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-sm font-semibold text-gray-800">{titulo}</h2>
          <button onClick={onCerrar} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

function TempBadge({ valor, tipo }: { valor: number | null; tipo: string }) {
  const estado = tipo === 'congelador' ? estadoCongelador(valor) : estadoNevera(valor)
  const cfg = ESTADO_CFG[estado]
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {valor != null ? `${valor}°C` : '—'}
    </span>
  )
}

function estadoLabel(e: Estado) { return ESTADO_CFG[e].label }

export default function PaginaTemperaturas() {
  const [registros, setRegistros] = useState<Temperatura[]>([])
  const [locales, setLocales] = useState<Local[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroLocal, setFiltroLocal] = useState('')
  const [filtroMes, setFiltroMes] = useState('')
  const [filtroAnio, setFiltroAnio] = useState(String(new Date().getFullYear()))
  const [filtroTurno, setFiltroTurno] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<FormTemp>(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [confirmEliminar, setConfirmEliminar] = useState<number | null>(null)

  const cargar = useCallback(async () => {
    const [{ data: t }, { data: l }] = await Promise.all([
      supabase.from('temperaturas').select('*').order('fecha', { ascending: false }),
      supabase.from('locales').select('*').eq('activo', true).order('nombre'),
    ])
    setRegistros(t ?? [])
    setLocales(l ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const filtrados = useMemo(() => registros.filter(r => {
    const fecha = new Date(r.fecha)
    return (
      (!filtroLocal || String(r.local_id) === filtroLocal) &&
      (!filtroTurno || r.turno === filtroTurno) &&
      (!filtroAnio || fecha.getFullYear() === Number(filtroAnio)) &&
      (!filtroMes || (fecha.getMonth() + 1) === Number(filtroMes))
    )
  }), [registros, filtroLocal, filtroTurno, filtroAnio, filtroMes])

  const kpis = useMemo(() => {
    let alertas = 0, avisos = 0, ok = 0
    filtrados.forEach(r => {
      const estados = EQUIPOS.map(eq => eq.tipo === 'congelador' ? estadoCongelador(r[eq.key as TempKey]) : estadoNevera(r[eq.key as TempKey]))
      if (estados.some(e => e === 'alerta')) alertas++
      else if (estados.some(e => e === 'aviso' || e === 'muy_frio')) avisos++
      else ok++
    })
    return { alertas, avisos, ok }
  }, [filtrados])

  function exportarExcel() {
    const rows = filtrados.map(r => {
      const local = locales.find(l => l.id === r.local_id)?.nombre ?? ''
      const fechaObj = new Date(r.fecha)
      const row: Record<string, string | number | null> = {
        Fecha: fechaObj.toLocaleDateString('es-ES'),
        Hora: fechaObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        Turno: r.turno ?? '',
        Empleado: r.empleado_nombre,
        Local: local,
      }
      EQUIPOS.forEach(eq => {
        const val = r[eq.key as TempKey]
        const estado = eq.tipo === 'congelador' ? estadoCongelador(val) : estadoNevera(val)
        row[`${eq.label} (°C)`] = val
        row[`Estado ${eq.label}`] = estadoLabel(estado)
      })
      row['Notas'] = r.notas ?? ''
      return row
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Temperaturas')
    const mes = filtroMes ? `-${filtroMes.padStart(2, '0')}` : ''
    XLSX.writeFile(wb, `temperaturas_sofi_${filtroAnio}${mes}.xlsx`)
  }

  async function guardar() {
    if (!form.empleado_nombre.trim()) { setError('Indica quién registra'); return }
    const hayAlMenos = EQUIPOS.some(eq => form[eq.key as keyof FormTemp] !== '')
    if (!hayAlMenos) { setError('Introduce al menos una temperatura'); return }
    setGuardando(true); setError('')
    const payload = {
      local_id: form.local_id ? Number(form.local_id) : null,
      empleado_nombre: form.empleado_nombre.trim(),
      fecha: form.fecha,
      turno: form.turno || null,
      mesa_fria_1: form.mesa_fria_1 !== '' ? Number(form.mesa_fria_1) : null,
      mesa_fria_2: form.mesa_fria_2 !== '' ? Number(form.mesa_fria_2) : null,
      mesa_fria_3: form.mesa_fria_3 !== '' ? Number(form.mesa_fria_3) : null,
      congelador_4: form.congelador_4 !== '' ? Number(form.congelador_4) : null,
      mesa_fria_5: form.mesa_fria_5 !== '' ? Number(form.mesa_fria_5) : null,
      nevera_6: form.nevera_6 !== '' ? Number(form.nevera_6) : null,
      notas: form.notas.trim() || null,
    }
    const { error: err } = await supabase.from('temperaturas').insert(payload)
    if (err) { setError(err.message); setGuardando(false); return }
    setGuardando(false); setModal(false); setForm(FORM_VACIO); cargar()
  }

  async function eliminar(id: number) {
    await supabase.from('temperaturas').delete().eq('id', id)
    setConfirmEliminar(null); cargar()
  }

  const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

  if (loading) return <div className="flex items-center justify-center min-h-screen"><RefreshCw className="animate-spin text-[#F5B731]" size={24} /></div>

  return (
    <div className="p-6 max-w-7xl">
      <div className="mb-5 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Temperaturas</h1>
          <p className="text-sm text-gray-400 mt-0.5">Control APPCC de equipos frigoríficos — SOFI Pinomonotano</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportarExcel} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors">
            <Download size={15} /> Exportar Excel
          </button>
          <button onClick={() => { setForm({ ...FORM_VACIO, local_id: filtroLocal || '' }); setModal(true) }} className="flex items-center gap-2 px-4 py-2 bg-[#F5B731] text-[#1A1A1A] text-sm font-semibold rounded-lg hover:bg-[#e0a820] transition-colors">
            <Plus size={15} /> Añadir registro
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-rose-200 p-4">
          <p className="text-xs text-gray-400 mb-1">Alertas críticas</p>
          <p className={`text-2xl font-bold ${kpis.alertas > 0 ? 'text-rose-600' : 'text-gray-300'}`}>{kpis.alertas}</p>
        </div>
        <div className="bg-white rounded-xl border border-orange-200 p-4">
          <p className="text-xs text-gray-400 mb-1">Avisos / Muy frío</p>
          <p className={`text-2xl font-bold ${kpis.avisos > 0 ? 'text-orange-500' : 'text-gray-300'}`}>{kpis.avisos}</p>
        </div>
        <div className="bg-white rounded-xl border border-emerald-200 p-4">
          <p className="text-xs text-gray-400 mb-1">Registros OK</p>
          <p className={`text-2xl font-bold ${kpis.ok > 0 ? 'text-emerald-600' : 'text-gray-300'}`}>{kpis.ok}</p>
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex gap-x-5 gap-y-1 mb-4 flex-wrap text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" /> Muy frío (nevera &lt;-2°C · congelador &lt;-18°C)</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Correcto (nevera -2–4°C · congelador -18–-15°C)</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-400" /> Atención (nevera 4–7°C · congelador -15–-10°C)</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500" /> Alerta (nevera &gt;7°C · congelador &gt;-10°C)</span>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <select className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white" value={filtroLocal} onChange={e => setFiltroLocal(e.target.value)}>
          <option value="">Todos los locales</option>
          {locales.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
        </select>
        <select className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white" value={filtroTurno} onChange={e => setFiltroTurno(e.target.value)}>
          <option value="">Todos los turnos</option>
          <option value="mañana">Mañana</option>
          <option value="noche">Noche</option>
        </select>
        <select className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white" value={filtroMes} onChange={e => setFiltroMes(e.target.value)}>
          <option value="">Todos los meses</option>
          {MESES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <select className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white" value={filtroAnio} onChange={e => setFiltroAnio(e.target.value)}>
          {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <span className="text-xs text-gray-400">{filtrados.length} registros</span>
      </div>

      {/* Tabla */}
      {filtrados.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <Thermometer size={32} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">No hay registros con los filtros actuales</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Fecha / Hora</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">Turno</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Empleado</th>
                {EQUIPOS.map(eq => (
                  <th key={eq.key} className="text-center px-2 py-3 text-xs font-semibold text-gray-500">{eq.label}</th>
                ))}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtrados.map(r => {
                const hayAlerta = EQUIPOS.some(eq => {
                  const v = r[eq.key as TempKey]
                  const e = eq.tipo === 'congelador' ? estadoCongelador(v) : estadoNevera(v)
                  return e === 'alerta'
                })
                return (
                  <tr key={r.id} className={`transition-colors ${hayAlerta ? 'bg-rose-50 hover:bg-rose-100/50' : 'hover:bg-gray-50'}`}>
                    <td className="px-4 py-2.5 text-gray-600">
                      <p>{new Date(r.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</p>
                      <p className="text-xs text-gray-400">{new Date(r.fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      {r.turno && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.turno === 'mañana' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                          {r.turno}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 text-xs">{r.empleado_nombre}</td>
                    {EQUIPOS.map(eq => (
                      <td key={eq.key} className="px-2 py-2.5 text-center">
                        <TempBadge valor={r[eq.key as TempKey]} tipo={eq.tipo} />
                      </td>
                    ))}
                    <td className="px-4 py-2.5 text-right">
                      {confirmEliminar === r.id ? (
                        <span className="flex items-center gap-1 justify-end">
                          <button onClick={() => eliminar(r.id)} className="px-2 py-0.5 bg-rose-500 text-white rounded text-xs font-medium">Eliminar</button>
                          <button onClick={() => setConfirmEliminar(null)} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium">No</button>
                        </span>
                      ) : (
                        <button onClick={() => setConfirmEliminar(r.id)} className="p-1.5 text-gray-300 hover:text-rose-500 transition-colors rounded">
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

      {modal && (
        <Modal titulo="Registrar temperaturas" onCerrar={() => { setModal(false); setForm(FORM_VACIO); setError('') }}>
          <div className="space-y-4">
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
                <input className={inputCls} placeholder="Nombre" value={form.empleado_nombre} onChange={e => setForm(f => ({ ...f, empleado_nombre: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Fecha y hora *</label>
                <input type="datetime-local" className={inputCls} value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Turno</label>
                <select className={inputCls} value={form.turno} onChange={e => setForm(f => ({ ...f, turno: e.target.value }))}>
                  <option value="mañana">Mañana</option>
                  <option value="noche">Noche</option>
                </select>
              </div>
            </div>
            <div className="border border-gray-100 rounded-lg bg-gray-50 p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">NEVERAS</p>
              {EQUIPOS.filter(eq => eq.tipo === 'nevera').map(eq => (
                <div key={eq.key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{eq.label} <span className="font-normal text-gray-400">— {eq.desc}</span></label>
                  <input type="number" step="0.1" className={inputCls} placeholder="°C" value={form[eq.key as keyof FormTemp]} onChange={e => setForm(f => ({ ...f, [eq.key]: e.target.value }))} />
                </div>
              ))}
            </div>
            <div className="border border-gray-100 rounded-lg bg-gray-50 p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">CONGELADOR</p>
              {EQUIPOS.filter(eq => eq.tipo === 'congelador').map(eq => (
                <div key={eq.key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{eq.label} <span className="font-normal text-gray-400">— {eq.desc}</span></label>
                  <input type="number" step="0.1" className={inputCls} placeholder="°C" value={form[eq.key as keyof FormTemp]} onChange={e => setForm(f => ({ ...f, [eq.key]: e.target.value }))} />
                </div>
              ))}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Notas</label>
              <input className={inputCls} value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} placeholder="Incidencias..." />
            </div>
            {error && <p className="text-xs text-rose-500">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => { setModal(false); setForm(FORM_VACIO); setError('') }} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
              <button onClick={guardar} disabled={guardando} className="px-4 py-2 text-sm font-semibold bg-[#F5B731] text-[#1A1A1A] rounded-lg hover:bg-[#e0a820] disabled:opacity-50">
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

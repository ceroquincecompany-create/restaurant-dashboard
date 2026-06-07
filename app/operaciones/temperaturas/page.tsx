'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { Temperatura, Local } from '@/lib/supabase'
import { Plus, X, Trash2, RefreshCw, Thermometer, AlertTriangle } from 'lucide-react'

// Rangos de alerta según normativa APPCC
function estadoNevera(t: number | null): 'ok' | 'aviso' | 'alerta' | 'sin_dato' {
  if (t == null) return 'sin_dato'
  if (t <= 4) return 'ok'
  if (t <= 7) return 'aviso'
  return 'alerta'
}

function estadoCongelador(t: number | null): 'ok' | 'aviso' | 'alerta' | 'sin_dato' {
  if (t == null) return 'sin_dato'
  if (t <= -5) return 'ok'
  if (t <= -3) return 'aviso'
  return 'alerta'
}

const ESTADO_CFG = {
  ok:       { cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', label: 'Correcto' },
  aviso:    { cls: 'bg-orange-100 text-orange-700',   dot: 'bg-orange-400',  label: 'Atención' },
  alerta:   { cls: 'bg-rose-100 text-rose-700',       dot: 'bg-rose-500',    label: 'Alerta' },
  sin_dato: { cls: 'bg-gray-100 text-gray-400',       dot: 'bg-gray-300',    label: '—' },
} as const

type EstadoTemp = keyof typeof ESTADO_CFG

const EQUIPOS = [
  { key: 'mesa_fria_1' as const, label: 'Mesa fría 1', desc: 'Bebidas / Tarros salsa / Leche', tipo: 'nevera' },
  { key: 'mesa_fria_2' as const, label: 'Mesa fría 2', desc: 'Carne / Quesos / Entrantes / Bacon / Pulled pork', tipo: 'nevera' },
  { key: 'mesa_fria_3' as const, label: 'Mesa fría 3', desc: 'Queso / Jamón / Atún / Salsas / Huevo / Lechuga', tipo: 'nevera' },
  { key: 'congelador_4' as const, label: 'Congelador 4', desc: 'Entrantes / Empanados / Patatas / Pulled pork / Helado', tipo: 'congelador' },
]

type FormTemp = {
  local_id: string
  empleado_nombre: string
  fecha: string
  mesa_fria_1: string
  mesa_fria_2: string
  mesa_fria_3: string
  congelador_4: string
  notas: string
}

const ahora = () => {
  const n = new Date()
  return n.toISOString().slice(0, 16)
}

const FORM_VACIO: FormTemp = {
  local_id: '', empleado_nombre: '', fecha: ahora(),
  mesa_fria_1: '', mesa_fria_2: '', mesa_fria_3: '', congelador_4: '', notas: '',
}

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white'

function Modal({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-sm font-semibold text-gray-800">{titulo}</h2>
          <button onClick={onCerrar} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

function TempBadge({ valor, tipo }: { valor: number | null; tipo: 'nevera' | 'congelador' }) {
  const estado: EstadoTemp = tipo === 'nevera' ? estadoNevera(valor) : estadoCongelador(valor)
  const cfg = ESTADO_CFG[estado]
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {valor != null ? `${valor} °C` : '—'}
    </span>
  )
}

export default function PaginaTemperaturas() {
  const [registros, setRegistros] = useState<Temperatura[]>([])
  const [locales, setLocales] = useState<Local[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroLocal, setFiltroLocal] = useState('')
  const [filtroMes, setFiltroMes] = useState('')
  const [filtroAnio, setFiltroAnio] = useState(String(new Date().getFullYear()))
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

  const filtrados = useMemo(() => {
    return registros.filter(r => {
      const fecha = new Date(r.fecha)
      const matchLocal = !filtroLocal || String(r.local_id) === filtroLocal
      const matchAnio = !filtroAnio || fecha.getFullYear() === Number(filtroAnio)
      const matchMes = !filtroMes || (fecha.getMonth() + 1) === Number(filtroMes)
      return matchLocal && matchAnio && matchMes
    })
  }, [registros, filtroLocal, filtroMes, filtroAnio])

  const kpis = useMemo(() => {
    let alertas = 0, avisos = 0, ok = 0
    filtrados.forEach(r => {
      const estados = [
        estadoNevera(r.mesa_fria_1),
        estadoNevera(r.mesa_fria_2),
        estadoNevera(r.mesa_fria_3),
        estadoCongelador(r.congelador_4),
      ]
      const tieneAlerta = estados.some(e => e === 'alerta')
      const tieneAviso = estados.some(e => e === 'aviso')
      if (tieneAlerta) alertas++
      else if (tieneAviso) avisos++
      else ok++
    })
    return { alertas, avisos, ok }
  }, [filtrados])

  function abrirCrear() {
    setForm({ ...FORM_VACIO, local_id: filtroLocal || '', fecha: ahora() })
    setError('')
    setModal(true)
  }

  function cerrar() {
    setModal(false)
    setForm(FORM_VACIO)
    setError('')
  }

  async function guardar() {
    if (!form.empleado_nombre.trim()) { setError('Indica quién registra las temperaturas'); return }
    const hayAlMenosUno = form.mesa_fria_1 || form.mesa_fria_2 || form.mesa_fria_3 || form.congelador_4
    if (!hayAlMenosUno) { setError('Introduce al menos una temperatura'); return }
    setGuardando(true)
    setError('')
    const payload = {
      local_id: form.local_id ? Number(form.local_id) : null,
      empleado_nombre: form.empleado_nombre.trim(),
      fecha: form.fecha,
      mesa_fria_1: form.mesa_fria_1 !== '' ? Number(form.mesa_fria_1) : null,
      mesa_fria_2: form.mesa_fria_2 !== '' ? Number(form.mesa_fria_2) : null,
      mesa_fria_3: form.mesa_fria_3 !== '' ? Number(form.mesa_fria_3) : null,
      congelador_4: form.congelador_4 !== '' ? Number(form.congelador_4) : null,
      notas: form.notas.trim() || null,
    }
    const { error: err } = await supabase.from('temperaturas').insert(payload)
    if (err) { setError(err.message); setGuardando(false); return }
    setGuardando(false)
    cerrar()
    cargar()
  }

  async function eliminar(id: number) {
    await supabase.from('temperaturas').delete().eq('id', id)
    setConfirmEliminar(null)
    cargar()
  }

  const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="animate-spin text-[#F5B731]" size={24} />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Temperaturas</h1>
          <p className="text-sm text-gray-400 mt-0.5">Control APPCC de equipos frigoríficos</p>
        </div>
        <button
          onClick={abrirCrear}
          className="flex items-center gap-2 px-4 py-2 bg-[#F5B731] text-[#1A1A1A] text-sm font-semibold rounded-lg hover:bg-[#e0a820] transition-colors"
        >
          <Plus size={15} />
          Añadir temperatura
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-rose-200 p-4">
          <p className="text-xs text-gray-400 mb-1">Alertas críticas</p>
          <p className={`text-2xl font-bold ${kpis.alertas > 0 ? 'text-rose-600' : 'text-gray-300'}`}>{kpis.alertas}</p>
          <p className="text-xs text-gray-400 mt-0.5">Registros &gt;7°C / &gt;-3°C</p>
        </div>
        <div className="bg-white rounded-xl border border-orange-200 p-4">
          <p className="text-xs text-gray-400 mb-1">Avisos</p>
          <p className={`text-2xl font-bold ${kpis.avisos > 0 ? 'text-orange-500' : 'text-gray-300'}`}>{kpis.avisos}</p>
          <p className="text-xs text-gray-400 mt-0.5">Registros en zona de atención</p>
        </div>
        <div className="bg-white rounded-xl border border-emerald-200 p-4">
          <p className="text-xs text-gray-400 mb-1">Registros OK</p>
          <p className={`text-2xl font-bold ${kpis.ok > 0 ? 'text-emerald-600' : 'text-gray-300'}`}>{kpis.ok}</p>
          <p className="text-xs text-gray-400 mt-0.5">Todos los equipos en rango</p>
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex gap-4 mb-5 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          Neveras ≤4°C · Congelador ≤-5°C
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="w-2 h-2 rounded-full bg-orange-400" />
          Neveras 4-7°C · Congelador -5 a -3°C
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="w-2 h-2 rounded-full bg-rose-500" />
          Neveras &gt;7°C · Congelador &gt;-3°C
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <select
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white"
          value={filtroLocal}
          onChange={e => setFiltroLocal(e.target.value)}
        >
          <option value="">Todos los locales</option>
          {locales.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
        </select>
        <select
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white"
          value={filtroMes}
          onChange={e => setFiltroMes(e.target.value)}
        >
          <option value="">Todos los meses</option>
          {MESES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <select
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white"
          value={filtroAnio}
          onChange={e => setFiltroAnio(e.target.value)}
        >
          {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <span className="text-xs text-gray-400">{filtrados.length} registros</span>
      </div>

      {/* Tabla */}
      {filtrados.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <Thermometer size={32} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">No hay registros de temperaturas</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Fecha</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Local</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500">Mesa fría 1</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500">Mesa fría 2</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500">Mesa fría 3</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500">Congelador 4</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Por</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtrados.map(r => {
                const local = locales.find(l => l.id === r.local_id)
                const hayAlerta = [estadoNevera(r.mesa_fria_1), estadoNevera(r.mesa_fria_2), estadoNevera(r.mesa_fria_3), estadoCongelador(r.congelador_4)].some(e => e === 'alerta')
                return (
                  <tr key={r.id} className={`transition-colors ${hayAlerta ? 'bg-rose-50 hover:bg-rose-100/50' : 'hover:bg-gray-50'}`}>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {new Date(r.fecha).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{local?.nombre ?? '—'}</td>
                    <td className="px-3 py-3 text-center"><TempBadge valor={r.mesa_fria_1} tipo="nevera" /></td>
                    <td className="px-3 py-3 text-center"><TempBadge valor={r.mesa_fria_2} tipo="nevera" /></td>
                    <td className="px-3 py-3 text-center"><TempBadge valor={r.mesa_fria_3} tipo="nevera" /></td>
                    <td className="px-3 py-3 text-center"><TempBadge valor={r.congelador_4} tipo="congelador" /></td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{r.empleado_nombre}</td>
                    <td className="px-4 py-3 text-right">
                      {confirmEliminar === r.id ? (
                        <span className="flex items-center gap-1 justify-end">
                          <button onClick={() => eliminar(r.id)} className="px-2 py-0.5 bg-rose-500 text-white rounded text-xs font-medium hover:bg-rose-600">Eliminar</button>
                          <button onClick={() => setConfirmEliminar(null)} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium hover:bg-gray-200">No</button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmEliminar(r.id)}
                          className="p-1.5 text-gray-300 hover:text-rose-500 transition-colors rounded"
                        >
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
        <Modal titulo="Registrar temperaturas" onCerrar={cerrar}>
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
                <input
                  className={inputCls}
                  placeholder="Nombre del empleado"
                  value={form.empleado_nombre}
                  onChange={e => setForm(f => ({ ...f, empleado_nombre: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Fecha y hora *</label>
              <input type="datetime-local" className={inputCls} value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
            </div>

            <div className="border border-gray-100 rounded-lg p-4 space-y-3 bg-gray-50">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">NEVERAS (máx 4°C)</p>
              {EQUIPOS.filter(e => e.tipo === 'nevera').map(eq => (
                <div key={eq.key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {eq.label} <span className="font-normal text-gray-400">— {eq.desc}</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    className={inputCls}
                    placeholder="Temperatura (°C)"
                    value={form[eq.key]}
                    onChange={e => setForm(f => ({ ...f, [eq.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>

            <div className="border border-gray-100 rounded-lg p-4 space-y-3 bg-gray-50">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">CONGELADOR (máx -5°C)</p>
              {EQUIPOS.filter(e => e.tipo === 'congelador').map(eq => (
                <div key={eq.key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {eq.label} <span className="font-normal text-gray-400">— {eq.desc}</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    className={inputCls}
                    placeholder="Temperatura (°C)"
                    value={form[eq.key]}
                    onChange={e => setForm(f => ({ ...f, [eq.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Notas</label>
              <input className={inputCls} value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} placeholder="Observaciones, incidencias..." />
            </div>

            {error && <p className="text-xs text-rose-500">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={cerrar} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">Cancelar</button>
              <button
                onClick={guardar}
                disabled={guardando}
                className="px-4 py-2 text-sm font-semibold bg-[#F5B731] text-[#1A1A1A] rounded-lg hover:bg-[#e0a820] transition-colors disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : 'Guardar registro'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

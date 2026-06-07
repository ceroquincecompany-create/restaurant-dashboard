'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { Empleado, Sancion } from '@/lib/supabase'
import { Plus, X, Pencil, Trash2, ShieldAlert, RefreshCw, Search } from 'lucide-react'

const TIPO_CFG = {
  aviso_verbal:        { label: 'Aviso verbal',          cls: 'bg-amber-100 text-amber-700' },
  amonestacion_escrita:{ label: 'Amonestación escrita',  cls: 'bg-orange-100 text-orange-700' },
  sancion_grave:       { label: 'Sanción grave',         cls: 'bg-rose-100 text-rose-700' },
  sancion_muy_grave:   { label: 'Sanción muy grave',     cls: 'bg-red-100 text-red-900 font-semibold' },
} as const

type TipoSancion = keyof typeof TIPO_CFG

type FormSancion = {
  empleado_id: string
  tipo: TipoSancion
  fecha: string
  descripcion: string
  firmado: boolean
  notas: string
}

const FORM_VACIO: FormSancion = {
  empleado_id: '', tipo: 'aviso_verbal',
  fecha: new Date().toISOString().split('T')[0],
  descripcion: '', firmado: false, notas: '',
}

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white'

function Modal({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">{titulo}</h2>
          <button onClick={onCerrar} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

export default function PaginaSanciones() {
  const [sanciones, setSanciones] = useState<Sancion[]>([])
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEmp, setFiltroEmp] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [modal, setModal] = useState(false)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [form, setForm] = useState<FormSancion>(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [confirmEliminar, setConfirmEliminar] = useState<number | null>(null)

  const cargar = useCallback(async () => {
    const [{ data: sancs }, { data: emps }] = await Promise.all([
      supabase.from('sanciones').select('*').eq('activo', true).order('fecha', { ascending: false }),
      supabase.from('empleados').select('*').eq('activo', true).order('nombre'),
    ])
    setSanciones(sancs ?? [])
    setEmpleados(emps ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const filtradas = useMemo(() => {
    const q = busqueda.toLowerCase()
    return sanciones.filter((s) => {
      const emp = empleados.find((e) => e.id === s.empleado_id)
      const matchQ = !q || (emp?.nombre ?? '').toLowerCase().includes(q) || s.descripcion.toLowerCase().includes(q)
      const matchEmp = !filtroEmp || String(s.empleado_id) === filtroEmp
      const matchTipo = !filtroTipo || s.tipo === filtroTipo
      return matchQ && matchEmp && matchTipo
    })
  }, [sanciones, empleados, busqueda, filtroEmp, filtroTipo])

  // Resumen por tipo
  const resumen = useMemo(() => {
    const counts: Record<string, number> = {}
    Object.keys(TIPO_CFG).forEach((k) => { counts[k] = sanciones.filter((s) => s.tipo === k).length })
    return counts
  }, [sanciones])

  function abrirCrear() {
    setEditandoId(null)
    setForm({ ...FORM_VACIO, empleado_id: filtroEmp || '' })
    setError('')
    setModal(true)
  }

  function abrirEditar(s: Sancion) {
    setEditandoId(s.id)
    setForm({
      empleado_id: String(s.empleado_id),
      tipo: s.tipo,
      fecha: s.fecha,
      descripcion: s.descripcion,
      firmado: s.firmado,
      notas: s.notas ?? '',
    })
    setError('')
    setModal(true)
  }

  function cerrar() {
    setModal(false)
    setEditandoId(null)
    setForm(FORM_VACIO)
    setError('')
  }

  async function guardar() {
    if (!form.empleado_id) { setError('Selecciona un empleado'); return }
    if (!form.descripcion.trim()) { setError('La descripción es obligatoria'); return }
    setGuardando(true)
    setError('')
    const payload = {
      empleado_id: Number(form.empleado_id),
      tipo: form.tipo,
      fecha: form.fecha,
      descripcion: form.descripcion.trim(),
      firmado: form.firmado,
      notas: form.notas.trim() || null,
    }
    let err
    if (editandoId !== null) {
      ;({ error: err } = await supabase.from('sanciones').update(payload).eq('id', editandoId))
    } else {
      ;({ error: err } = await supabase.from('sanciones').insert(payload))
    }
    if (err) { setError(err.message); setGuardando(false); return }
    setGuardando(false)
    cerrar()
    cargar()
  }

  async function archivar(id: number) {
    await supabase.from('sanciones').update({ activo: false }).eq('id', id)
    setConfirmEliminar(null)
    cargar()
  }

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
          <h1 className="text-xl font-bold text-gray-900">Sanciones y Avisos</h1>
          <p className="text-sm text-gray-400 mt-0.5">Historial disciplinario del equipo</p>
        </div>
        <button
          onClick={abrirCrear}
          className="flex items-center gap-2 px-4 py-2 bg-[#F5B731] text-[#1A1A1A] text-sm font-semibold rounded-lg hover:bg-[#e0a820] transition-colors"
        >
          <Plus size={15} />
          Nueva sanción
        </button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {(Object.keys(TIPO_CFG) as TipoSancion[]).map((tipo) => (
          <div key={tipo} className={`rounded-xl border p-4 ${resumen[tipo] > 0 ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'}`}>
            <p className={`text-2xl font-bold ${resumen[tipo] > 0 ? 'text-gray-900' : 'text-gray-300'}`}>{resumen[tipo]}</p>
            <span className={`mt-1 inline-block text-xs font-medium px-2 py-0.5 rounded-full ${TIPO_CFG[tipo].cls}`}>
              {TIPO_CFG[tipo].label}
            </span>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative max-w-xs flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731]"
          />
        </div>
        <select
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white"
          value={filtroEmp}
          onChange={(e) => setFiltroEmp(e.target.value)}
        >
          <option value="">Todos los empleados</option>
          {empleados.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
        <select
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white"
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
        >
          <option value="">Todos los tipos</option>
          {(Object.keys(TIPO_CFG) as TipoSancion[]).map((t) => (
            <option key={t} value={t}>{TIPO_CFG[t].label}</option>
          ))}
        </select>
        <span className="text-xs text-gray-400">{filtradas.length} registros</span>
      </div>

      {/* Lista */}
      {filtradas.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <ShieldAlert size={32} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">
            {busqueda || filtroEmp || filtroTipo ? 'Sin resultados para los filtros aplicados' : 'No hay sanciones registradas'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtradas.map((s) => {
            const emp = empleados.find((e) => e.id === s.empleado_id)
            return (
              <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TIPO_CFG[s.tipo].cls}`}>
                        {TIPO_CFG[s.tipo].label}
                      </span>
                      <span className="text-sm font-semibold text-gray-800">{emp?.nombre ?? '—'}</span>
                      <span className="text-xs text-gray-400">{s.fecha}</span>
                      {s.firmado && (
                        <span className="text-xs text-emerald-600 font-medium">✓ Firmado</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 mb-1">{s.descripcion}</p>
                    {s.notas && (
                      <p className="text-xs text-gray-400 italic">{s.notas}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => abrirEditar(s)}
                      className="p-1.5 text-gray-400 hover:text-[#F5B731] transition-colors rounded"
                      title="Editar"
                    >
                      <Pencil size={13} />
                    </button>
                    {confirmEliminar === s.id ? (
                      <span className="flex items-center gap-1">
                        <button onClick={() => archivar(s.id)} className="px-2 py-0.5 bg-rose-500 text-white rounded text-xs font-medium hover:bg-rose-600">Archivar</button>
                        <button onClick={() => setConfirmEliminar(null)} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium hover:bg-gray-200">No</button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmEliminar(s.id)}
                        className="p-1.5 text-gray-400 hover:text-rose-500 transition-colors rounded"
                        title="Archivar"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal && (
        <Modal titulo={editandoId !== null ? 'Editar sanción' : 'Nueva sanción / aviso'} onCerrar={cerrar}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Empleado *</label>
              <select className={inputCls} value={form.empleado_id} onChange={(e) => setForm((f) => ({ ...f, empleado_id: e.target.value }))}>
                <option value="">— Seleccionar —</option>
                {empleados.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Tipo</label>
                <select className={inputCls} value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as TipoSancion }))}>
                  {(Object.keys(TIPO_CFG) as TipoSancion[]).map((t) => (
                    <option key={t} value={t}>{TIPO_CFG[t].label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Fecha *</label>
                <input type="date" className={inputCls} value={form.fecha} onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Descripción del motivo *</label>
              <textarea
                className={`${inputCls} resize-none`}
                rows={3}
                value={form.descripcion}
                onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                placeholder="Describe el motivo de la sanción..."
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Notas adicionales</label>
              <input
                className={inputCls}
                value={form.notas}
                onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                placeholder="Observaciones, contexto..."
              />
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.firmado}
                onChange={(e) => setForm((f) => ({ ...f, firmado: e.target.checked }))}
                className="w-4 h-4 rounded accent-[#F5B731]"
              />
              <span className="text-sm text-gray-700">Firmado por el empleado</span>
            </label>

            {error && <p className="text-xs text-rose-500">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={cerrar} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">Cancelar</button>
              <button
                onClick={guardar}
                disabled={guardando}
                className="px-4 py-2 text-sm font-semibold bg-[#F5B731] text-[#1A1A1A] rounded-lg hover:bg-[#e0a820] transition-colors disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : editandoId !== null ? 'Guardar cambios' : 'Registrar sanción'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

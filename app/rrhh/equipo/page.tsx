'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { Empleado, Local } from '@/lib/supabase'
import { Plus, RefreshCw, Pencil, Trash2, X, Search, Users, Umbrella, Check, Ban } from 'lucide-react'

type SolicitudConEmpleado = {
  id: number
  empleado_id: number
  fecha_inicio: string
  fecha_fin: string
  dias: number
  estado: 'pendiente' | 'aprobada' | 'rechazada'
  notas: string | null
  created_at: string
  empleados: { nombre: string }
}

type FormEmp = {
  nombre: string
  puesto: string
  local_id: string
  horas_contrato: string
  salario_bruto: string
  coste_empresa_pct: string
  fecha_inicio: string
  estado: 'activo' | 'baja' | 'vacaciones'
  iban: string
  nss: string
  email_acceso: string
  notas: string
}

const FORM_VACIO: FormEmp = {
  nombre: '', puesto: 'Sala', local_id: '', horas_contrato: '40',
  salario_bruto: '', coste_empresa_pct: '1.31', fecha_inicio: '',
  estado: 'activo', iban: '', nss: '', email_acceso: '', notas: '',
}

const PUESTOS = ['Encargado', 'Cocina', 'Sala', 'Ayudante cocina', 'Otro']

const ESTADO_CFG = {
  activo:     { label: 'Activo',     cls: 'bg-emerald-100 text-emerald-700' },
  baja:       { label: 'Baja',       cls: 'bg-rose-100 text-rose-700' },
  vacaciones: { label: 'Vacaciones', cls: 'bg-amber-100 text-amber-700' },
} as const

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white'

function Modal({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-8 pb-8 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">{titulo}</h2>
          <button onClick={onCerrar} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={16} /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  )
}

function Avatar({ nombre }: { nombre: string }) {
  const inicial = nombre.trim().charAt(0).toUpperCase()
  const colores = ['bg-blue-100 text-blue-700', 'bg-purple-100 text-purple-700', 'bg-orange-100 text-orange-700', 'bg-teal-100 text-teal-700']
  const idx = nombre.charCodeAt(0) % colores.length
  return (
    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${colores[idx]}`}>
      {inicial}
    </div>
  )
}

export default function PaginaEquipo() {
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [locales, setLocales] = useState<Local[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<string>('todos')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [form, setForm] = useState<FormEmp>(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [confirmEliminar, setConfirmEliminar] = useState<number | null>(null)
  const [solicitudes, setSolicitudes] = useState<SolicitudConEmpleado[]>([])
  const [procesando, setProcesando] = useState<number | null>(null)

  const cargarSolicitudes = useCallback(async () => {
    const { data } = await supabase
      .from('solicitudes_vacaciones')
      .select('*, empleados(nombre)')
      .eq('estado', 'pendiente')
      .order('created_at')
    setSolicitudes((data as SolicitudConEmpleado[]) ?? [])
  }, [])

  const cargar = useCallback(async () => {
    const [{ data: emps }, { data: locs }] = await Promise.all([
      supabase.from('empleados').select('*').order('nombre'),
      supabase.from('locales').select('*').order('nombre'),
    ])
    setEmpleados(emps ?? [])
    setLocales(locs ?? [])
    setLoading(false)
    cargarSolicitudes()
  }, [cargarSolicitudes])

  async function resolverSolicitud(id: number, estado: 'aprobada' | 'rechazada') {
    setProcesando(id)
    await supabase.from('solicitudes_vacaciones').update({ estado }).eq('id', id)
    setProcesando(null)
    cargarSolicitudes()
  }

  useEffect(() => { cargar() }, [cargar])

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase()
    return empleados.filter((e) => {
      const matchQ = e.nombre.toLowerCase().includes(q) || e.puesto.toLowerCase().includes(q)
      const matchE = filtroEstado === 'todos' || e.estado === filtroEstado
      return matchQ && matchE
    })
  }, [empleados, busqueda, filtroEstado])

  const costeHora = (f: FormEmp) => {
    const sal = parseFloat(f.salario_bruto)
    const h = parseFloat(f.horas_contrato)
    const pct = parseFloat(f.coste_empresa_pct)
    if (!sal || !h || !pct) return null
    return (sal * pct) / (h * 4.33)
  }

  function abrirCrear() {
    setEditandoId(null)
    setForm(FORM_VACIO)
    setError('')
    setModalAbierto(true)
  }

  function abrirEditar(e: Empleado) {
    setEditandoId(e.id)
    setForm({
      nombre: e.nombre,
      puesto: e.puesto,
      local_id: e.local_id ? String(e.local_id) : '',
      horas_contrato: String(e.horas_contrato),
      salario_bruto: e.salario_bruto ? String(e.salario_bruto) : '',
      coste_empresa_pct: String(e.coste_empresa_pct),
      fecha_inicio: e.fecha_inicio ?? '',
      estado: e.estado,
      iban: e.iban ?? '',
      nss: e.nss ?? '',
      email_acceso: e.email_acceso ?? '',
      notas: e.notas ?? '',
    })
    setError('')
    setModalAbierto(true)
  }

  function cerrarModal() {
    setModalAbierto(false)
    setEditandoId(null)
    setForm(FORM_VACIO)
    setError('')
  }

  async function guardar() {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
    setGuardando(true)
    setError('')
    const payload = {
      nombre: form.nombre.trim(),
      puesto: form.puesto,
      local_id: form.local_id ? Number(form.local_id) : null,
      horas_contrato: parseFloat(form.horas_contrato) || 40,
      salario_bruto: form.salario_bruto ? parseFloat(form.salario_bruto) : null,
      coste_empresa_pct: parseFloat(form.coste_empresa_pct) || 1.31,
      fecha_inicio: form.fecha_inicio || null,
      estado: form.estado,
      iban: form.iban.trim() || null,
      nss: form.nss.trim() || null,
      email_acceso: form.email_acceso.trim() || null,
      notas: form.notas.trim() || null,
    }
    let err
    if (editandoId !== null) {
      ;({ error: err } = await supabase.from('empleados').update(payload).eq('id', editandoId))
    } else {
      ;({ error: err } = await supabase.from('empleados').insert(payload))
    }
    if (err) { setError(err.message); setGuardando(false); return }
    setGuardando(false)
    cerrarModal()
    cargar()
  }

  async function eliminar(id: number) {
    await supabase.from('empleados').update({ activo: false }).eq('id', id)
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

  const resumen = {
    activos: empleados.filter((e) => e.estado === 'activo').length,
    bajas: empleados.filter((e) => e.estado === 'baja').length,
    vacaciones: empleados.filter((e) => e.estado === 'vacaciones').length,
  }

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">Gestión de Equipo</h1>
            {solicitudes.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-500 text-white text-xs font-bold rounded-full">
                <Umbrella size={10} />
                {solicitudes.length} pendiente{solicitudes.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400 mt-0.5">Empleados y datos laborales</p>
        </div>
        <button
          onClick={abrirCrear}
          className="flex items-center gap-2 px-4 py-2 bg-[#F5B731] text-[#1A1A1A] text-sm font-semibold rounded-lg hover:bg-[#e0a820] transition-colors"
        >
          <Plus size={15} />
          Nuevo empleado
        </button>
      </div>

      {/* Solicitudes de vacaciones pendientes */}
      {solicitudes.length > 0 && (
        <div className="mb-5 bg-white rounded-xl border border-orange-200 overflow-hidden">
          <div className="px-5 py-3 bg-orange-50 border-b border-orange-200 flex items-center gap-2">
            <Umbrella size={15} className="text-orange-500" />
            <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Solicitudes de vacaciones pendientes</p>
            <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-orange-500 text-white text-[10px] font-bold">
              {solicitudes.length}
            </span>
          </div>
          <div className="divide-y divide-gray-50">
            {solicitudes.map((s) => (
              <div key={s.id} className="px-5 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{s.empleados.nombre}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(s.fecha_inicio + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                    {' → '}
                    {new Date(s.fecha_fin + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {' · '}<strong>{s.dias} días</strong>
                  </p>
                  {s.notas && <p className="text-xs text-gray-400 mt-0.5 italic">{s.notas}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => resolverSolicitud(s.id, 'aprobada')}
                    disabled={procesando === s.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white text-xs font-semibold rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50"
                  >
                    <Check size={12} /> Aprobar
                  </button>
                  <button
                    onClick={() => resolverSolicitud(s.id, 'rechazada')}
                    disabled={procesando === s.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500 text-white text-xs font-semibold rounded-lg hover:bg-rose-600 transition-colors disabled:opacity-50"
                  >
                    <Ban size={12} /> Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Activos', value: resumen.activos, cls: 'text-emerald-600' },
          { label: 'En baja', value: resumen.bajas, cls: 'text-rose-600' },
          { label: 'Vacaciones', value: resumen.vacaciones, cls: 'text-amber-600' },
        ].map((k) => (
          <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${k.cls}`}>{k.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar empleado..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731]"
          />
        </div>
        <div className="flex gap-1">
          {(['todos', 'activo', 'baja', 'vacaciones'] as const).map((e) => (
            <button
              key={e}
              onClick={() => setFiltroEstado(e)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize ${
                filtroEstado === e
                  ? 'bg-[#1A1A1A] text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {e === 'todos' ? 'Todos' : ESTADO_CFG[e].label}
            </button>
          ))}
        </div>
      </div>

      {filtrados.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <Users size={32} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">
            {busqueda || filtroEstado !== 'todos' ? 'Sin resultados' : 'No hay empleados. Añade el primero.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <span className="text-xs text-gray-400">{filtrados.length} empleados</span>
          </div>
          <div className="divide-y divide-gray-50">
            {filtrados.map((emp) => {
              const local = locales.find((l) => l.id === emp.local_id)
              const ch = emp.salario_bruto
                ? ((emp.salario_bruto * emp.coste_empresa_pct) / (emp.horas_contrato * 4.33)).toFixed(2)
                : null
              return (
                <div key={emp.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                  <Avatar nombre={emp.nombre} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 truncate">{emp.nombre}</p>
                      <span className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${ESTADO_CFG[emp.estado].cls}`}>
                        {ESTADO_CFG[emp.estado].label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {emp.puesto}
                      {local && <span> · {local.nombre}</span>}
                      <span> · {emp.horas_contrato}h/semana</span>
                      {ch && <span> · {ch}€/h estimado</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => abrirEditar(emp)}
                      className="p-1.5 text-gray-400 hover:text-[#F5B731] transition-colors rounded"
                      title="Editar"
                    >
                      <Pencil size={13} />
                    </button>
                    {confirmEliminar === emp.id ? (
                      <span className="flex items-center gap-1">
                        <button
                          onClick={() => eliminar(emp.id)}
                          className="px-2 py-0.5 bg-rose-500 text-white rounded text-xs font-medium hover:bg-rose-600"
                        >Sí</button>
                        <button
                          onClick={() => setConfirmEliminar(null)}
                          className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium hover:bg-gray-200"
                        >No</button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmEliminar(emp.id)}
                        className="p-1.5 text-gray-400 hover:text-rose-500 transition-colors rounded"
                        title="Dar de baja"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {modalAbierto && (
        <Modal titulo={editandoId !== null ? 'Editar empleado' : 'Nuevo empleado'} onCerrar={cerrarModal}>
          <div className="space-y-4">
            <Campo label="Nombre completo *">
              <input
                className={inputCls}
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Nombre y apellidos"
              />
            </Campo>

            <div className="grid grid-cols-2 gap-3">
              <Campo label="Puesto">
                <select
                  className={inputCls}
                  value={form.puesto}
                  onChange={(e) => setForm((f) => ({ ...f, puesto: e.target.value }))}
                >
                  {PUESTOS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Campo>
              <Campo label="Local principal">
                <select
                  className={inputCls}
                  value={form.local_id}
                  onChange={(e) => setForm((f) => ({ ...f, local_id: e.target.value }))}
                >
                  <option value="">— Sin asignar —</option>
                  {locales.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                </select>
              </Campo>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Campo label="Horas/semana">
                <input
                  type="number"
                  className={inputCls}
                  value={form.horas_contrato}
                  onChange={(e) => setForm((f) => ({ ...f, horas_contrato: e.target.value }))}
                  placeholder="40"
                  min="1" max="40"
                />
              </Campo>
              <Campo label="Salario bruto €/mes">
                <input
                  type="number"
                  className={inputCls}
                  value={form.salario_bruto}
                  onChange={(e) => setForm((f) => ({ ...f, salario_bruto: e.target.value }))}
                  placeholder="1400"
                  min="0"
                />
              </Campo>
              <Campo label="% Coste empresa">
                <input
                  type="number"
                  className={inputCls}
                  value={form.coste_empresa_pct}
                  onChange={(e) => setForm((f) => ({ ...f, coste_empresa_pct: e.target.value }))}
                  placeholder="1.31"
                  step="0.01" min="1"
                />
              </Campo>
            </div>

            {costeHora(form) !== null && (
              <div className="bg-[#F5B731]/10 rounded-lg px-4 py-2.5 flex items-center justify-between">
                <span className="text-xs text-gray-600">Coste/hora estimado</span>
                <span className="text-sm font-bold text-[#1A1A1A]">{costeHora(form)!.toFixed(2)} €/h</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Campo label="Fecha inicio">
                <input
                  type="date"
                  className={inputCls}
                  value={form.fecha_inicio}
                  onChange={(e) => setForm((f) => ({ ...f, fecha_inicio: e.target.value }))}
                />
              </Campo>
              <Campo label="Estado">
                <select
                  className={inputCls}
                  value={form.estado}
                  onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value as FormEmp['estado'] }))}
                >
                  <option value="activo">Activo</option>
                  <option value="baja">Baja</option>
                  <option value="vacaciones">Vacaciones</option>
                </select>
              </Campo>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Campo label="IBAN">
                <input
                  className={inputCls}
                  value={form.iban}
                  onChange={(e) => setForm((f) => ({ ...f, iban: e.target.value }))}
                  placeholder="ES00 0000 0000..."
                />
              </Campo>
              <Campo label="Nº Seguridad Social">
                <input
                  className={inputCls}
                  value={form.nss}
                  onChange={(e) => setForm((f) => ({ ...f, nss: e.target.value }))}
                  placeholder="28/1234567/89"
                />
              </Campo>
            </div>

            <Campo label="Email acceso (opcional)">
              <input
                type="email"
                className={inputCls}
                value={form.email_acceso}
                onChange={(e) => setForm((f) => ({ ...f, email_acceso: e.target.value }))}
                placeholder="empleado@ejemplo.com"
              />
            </Campo>

            <Campo label="Notas">
              <textarea
                className={`${inputCls} resize-none`}
                rows={2}
                value={form.notas}
                onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                placeholder="Observaciones..."
              />
            </Campo>

            {error && <p className="text-xs text-rose-500">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={cerrarModal} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={guardando}
                className="px-4 py-2 text-sm font-semibold bg-[#F5B731] text-[#1A1A1A] rounded-lg hover:bg-[#e0a820] transition-colors disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : editandoId !== null ? 'Guardar cambios' : 'Crear empleado'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

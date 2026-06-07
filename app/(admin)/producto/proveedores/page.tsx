'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, RefreshCw, Pencil, Trash2, X, Search, Truck } from 'lucide-react'

type Proveedor = {
  id: number
  nombre: string
  cif: string | null
  direccion: string | null
  contacto: string | null
  telefono: string | null
  email: string | null
  dias_entrega: string[]
  canal_aviso: string | null
  forma_pago: string | null
  iban: string | null
  notas: string | null
  activo: boolean
}

type FormProv = Omit<Proveedor, 'id' | 'activo'>

const FORM_VACIO: FormProv = {
  nombre: '',
  cif: '',
  direccion: '',
  contacto: '',
  telefono: '',
  email: '',
  dias_entrega: [],
  canal_aviso: '',
  forma_pago: '',
  iban: '',
  notas: '',
}

const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const CANALES = ['WhatsApp', 'Email', 'Teléfono', 'App propia']
const FORMAS_PAGO = ['Contado', '15 días', '30 días', '60 días', 'Débito directo']

function Modal({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-10 pb-10 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl mx-4 my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">{titulo}</h2>
          <button onClick={onCerrar} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

function campo(label: string, children: React.ReactNode) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white'

export default function PaginaProveedores() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [ingCount, setIngCount] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [form, setForm] = useState<FormProv>(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [confirmEliminar, setConfirmEliminar] = useState<number | null>(null)

  const cargar = useCallback(async () => {
    const [{ data: provs }, { data: ings }] = await Promise.all([
      supabase.from('proveedores').select('*').order('nombre'),
      supabase.from('ingredientes').select('proveedor_id').not('proveedor_id', 'is', null),
    ])

    setProveedores(provs ?? [])

    const counts: Record<number, number> = {}
    ;(ings ?? []).forEach((i) => {
      if (i.proveedor_id) counts[i.proveedor_id] = (counts[i.proveedor_id] ?? 0) + 1
    })
    setIngCount(counts)
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const filtrados = useMemo(
    () =>
      proveedores.filter((p) => {
        const q = busqueda.toLowerCase()
        return (
          p.nombre.toLowerCase().includes(q) ||
          (p.contacto ?? '').toLowerCase().includes(q) ||
          (p.email ?? '').toLowerCase().includes(q)
        )
      }),
    [proveedores, busqueda]
  )

  function abrirCrear() {
    setEditandoId(null)
    setForm(FORM_VACIO)
    setError('')
    setModalAbierto(true)
  }

  function abrirEditar(p: Proveedor) {
    setEditandoId(p.id)
    setForm({
      nombre: p.nombre,
      cif: p.cif ?? '',
      direccion: p.direccion ?? '',
      contacto: p.contacto ?? '',
      telefono: p.telefono ?? '',
      email: p.email ?? '',
      dias_entrega: p.dias_entrega ?? [],
      canal_aviso: p.canal_aviso ?? '',
      forma_pago: p.forma_pago ?? '',
      iban: p.iban ?? '',
      notas: p.notas ?? '',
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

  function toggleDia(dia: string) {
    setForm((f) => ({
      ...f,
      dias_entrega: f.dias_entrega.includes(dia)
        ? f.dias_entrega.filter((d) => d !== dia)
        : [...f.dias_entrega, dia],
    }))
  }

  async function guardar() {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
    setGuardando(true)
    setError('')

    const payload = {
      nombre: form.nombre.trim(),
      cif: form.cif?.trim() || null,
      direccion: form.direccion?.trim() || null,
      contacto: form.contacto?.trim() || null,
      telefono: form.telefono?.trim() || null,
      email: form.email?.trim() || null,
      dias_entrega: form.dias_entrega,
      canal_aviso: form.canal_aviso || null,
      forma_pago: form.forma_pago || null,
      iban: form.iban?.trim() || null,
      notas: form.notas?.trim() || null,
    }

    let err
    if (editandoId !== null) {
      ;({ error: err } = await supabase.from('proveedores').update(payload).eq('id', editandoId))
    } else {
      ;({ error: err } = await supabase.from('proveedores').insert(payload))
    }

    if (err) { setError(err.message); setGuardando(false); return }
    setGuardando(false)
    cerrarModal()
    cargar()
  }

  async function eliminar(id: number) {
    await supabase.from('proveedores').delete().eq('id', id)
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
    <div className="p-6 max-w-6xl">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Proveedores</h1>
          <p className="text-sm text-gray-400 mt-0.5">Gestión de proveedores y sus ingredientes asociados</p>
        </div>
        <button
          onClick={abrirCrear}
          className="flex items-center gap-2 px-4 py-2 bg-[#F5B731] text-[#1A1A1A] text-sm font-semibold rounded-lg hover:bg-[#e0a820] transition-colors"
        >
          <Plus size={15} />
          Añadir proveedor
        </button>
      </div>

      {/* Buscador */}
      <div className="relative mb-5 max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar proveedor..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731]"
        />
      </div>

      {filtrados.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <Truck size={32} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">
            {busqueda ? 'Sin resultados para esa búsqueda' : 'No hay proveedores. Añade el primero.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <span className="text-xs text-gray-400">{filtrados.length} proveedores</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Nombre</th>
                  <th className="text-left px-4 py-3 font-medium">CIF</th>
                  <th className="text-left px-4 py-3 font-medium">Contacto</th>
                  <th className="text-left px-4 py-3 font-medium">Teléfono</th>
                  <th className="text-left px-4 py-3 font-medium">Días entrega</th>
                  <th className="text-left px-4 py-3 font-medium">Forma pago</th>
                  <th className="text-center px-4 py-3 font-medium">Ingredientes</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtrados.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-800">{p.nombre}</p>
                      {p.email && <p className="text-xs text-gray-400 mt-0.5">{p.email}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{p.cif ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{p.contacto ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{p.telefono ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-0.5 flex-wrap">
                        {DIAS.map((d) => (
                          <span
                            key={d}
                            className={`inline-block w-5 h-5 rounded text-xs font-bold text-center leading-5 ${
                              (p.dias_entrega ?? []).includes(d)
                                ? 'bg-[#F5B731] text-[#1A1A1A]'
                                : 'bg-gray-100 text-gray-300'
                            }`}
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{p.forma_pago ?? '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full text-xs font-semibold ${
                        (ingCount[p.id] ?? 0) > 0
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-400'
                      }`}>
                        {ingCount[p.id] ?? 0}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => abrirEditar(p)}
                          className="p-1.5 text-gray-400 hover:text-[#F5B731] transition-colors rounded"
                          title="Editar"
                        >
                          <Pencil size={13} />
                        </button>
                        {confirmEliminar === p.id ? (
                          <span className="flex items-center gap-1 text-xs">
                            <button
                              onClick={() => eliminar(p.id)}
                              className="px-2 py-0.5 bg-rose-500 text-white rounded text-xs font-medium hover:bg-rose-600"
                            >
                              Sí
                            </button>
                            <button
                              onClick={() => setConfirmEliminar(null)}
                              className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium hover:bg-gray-200"
                            >
                              No
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() => setConfirmEliminar(p.id)}
                            className="p-1.5 text-gray-400 hover:text-rose-500 transition-colors rounded"
                            title="Eliminar"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalAbierto && (
        <Modal titulo={editandoId !== null ? 'Editar proveedor' : 'Nuevo proveedor'} onCerrar={cerrarModal}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {campo('Nombre comercial *',
                <input
                  className={inputCls}
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  placeholder="Nombre del proveedor"
                />
              )}
              {campo('CIF',
                <input
                  className={inputCls}
                  value={form.cif ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, cif: e.target.value }))}
                  placeholder="B12345678"
                />
              )}
            </div>

            {campo('Dirección',
              <input
                className={inputCls}
                value={form.direccion ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))}
                placeholder="Calle, número, ciudad"
              />
            )}

            <div className="grid grid-cols-2 gap-3">
              {campo('Persona de contacto',
                <input
                  className={inputCls}
                  value={form.contacto ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, contacto: e.target.value }))}
                  placeholder="Nombre del contacto"
                />
              )}
              {campo('Teléfono',
                <input
                  className={inputCls}
                  value={form.telefono ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                  placeholder="+34 600 000 000"
                />
              )}
            </div>

            {campo('Email',
              <input
                type="email"
                className={inputCls}
                value={form.email ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="proveedor@ejemplo.com"
              />
            )}

            {campo('Días de entrega',
              <div className="flex gap-2 mt-1">
                {DIAS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDia(d)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                      form.dias_entrega.includes(d)
                        ? 'bg-[#F5B731] text-[#1A1A1A]'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {campo('Canal de aviso',
                <select
                  className={inputCls}
                  value={form.canal_aviso ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, canal_aviso: e.target.value }))}
                >
                  <option value="">— Seleccionar —</option>
                  {CANALES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
              {campo('Forma de pago',
                <select
                  className={inputCls}
                  value={form.forma_pago ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, forma_pago: e.target.value }))}
                >
                  <option value="">— Seleccionar —</option>
                  {FORMAS_PAGO.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              )}
            </div>

            {campo('IBAN / Nº cuenta',
              <input
                className={inputCls}
                value={form.iban ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, iban: e.target.value }))}
                placeholder="ES00 0000 0000 0000 0000 0000"
              />
            )}

            {campo('Notas',
              <textarea
                className={`${inputCls} resize-none`}
                rows={3}
                value={form.notas ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                placeholder="Observaciones, condiciones especiales..."
              />
            )}

            {error && <p className="text-xs text-rose-500">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={cerrarModal}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={guardando}
                className="px-4 py-2 text-sm font-semibold bg-[#F5B731] text-[#1A1A1A] rounded-lg hover:bg-[#e0a820] transition-colors disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : editandoId !== null ? 'Guardar cambios' : 'Crear proveedor'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

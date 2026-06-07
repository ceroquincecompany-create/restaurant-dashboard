'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { RefreshCw, Search, Plus, Pencil, Trash2, X, Check, ChevronDown } from 'lucide-react'

// ── Tipos ────────────────────────────────────────────────────
type Proveedor = { id: number; nombre: string }
type Ingrediente = {
  id: number
  nombre_ingrediente: string
  formato_compra: string | null
  unidad_compra: string | null
  precio_formato_compra: number | null
  unidad_producto: string | null
  precio_unidad_producto: number | null
  proveedor_id: number | null
  proveedor: string | null
}

type FormIng = {
  nombre_ingrediente: string
  formato_compra: string
  unidad_compra: string
  precio_formato_compra: string
  unidad_producto: string
  precio_unidad_producto: string
  proveedor_id: string
}

const FORM_VACIO: FormIng = {
  nombre_ingrediente: '',
  formato_compra: '',
  unidad_compra: '',
  precio_formato_compra: '',
  unidad_producto: '',
  precio_unidad_producto: '',
  proveedor_id: '',
}

// ── Helpers ──────────────────────────────────────────────────
const eur = (n: number | null) =>
  n == null
    ? '—'
    : n.toLocaleString('es-ES', { minimumFractionDigits: 4, maximumFractionDigits: 4 }) + ' €'

function Campo({
  label, children, full,
}: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5B731]'

// ── Modal ────────────────────────────────────────────────────
function Modal({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-sm font-bold text-gray-900">{titulo}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={17} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

// ── Página ───────────────────────────────────────────────────
export default function PaginaIngredientes() {
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroProveedor, setFiltroProveedor] = useState('')
  const [modal, setModal] = useState<'crear' | 'editar' | null>(null)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [form, setForm] = useState<FormIng>(FORM_VACIO)
  const [confirmEliminar, setConfirmEliminar] = useState<number | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    const [{ data: ings }, { data: provs }] = await Promise.all([
      supabase.from('ingredientes').select('*').order('nombre_ingrediente'),
      supabase.from('proveedores').select('id, nombre').order('nombre'),
    ])
    setIngredientes(ings ?? [])
    setProveedores(provs ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // Mapa proveedor_id → nombre para mostrar en tabla
  const provMap = useMemo(
    () => Object.fromEntries(proveedores.map((p) => [p.id, p.nombre])),
    [proveedores]
  )

  const filtrados = useMemo(() => {
    let lista = ingredientes
    if (busqueda.length >= 2) {
      const q = busqueda.toLowerCase()
      lista = lista.filter(
        (i) =>
          i.nombre_ingrediente.toLowerCase().includes(q) ||
          (i.proveedor ?? '').toLowerCase().includes(q) ||
          (provMap[i.proveedor_id ?? 0] ?? '').toLowerCase().includes(q)
      )
    }
    if (filtroProveedor === '__sin__') {
      lista = lista.filter((i) => !i.proveedor_id)
    } else if (filtroProveedor) {
      lista = lista.filter((i) => String(i.proveedor_id) === filtroProveedor)
    }
    return lista
  }, [ingredientes, busqueda, filtroProveedor, provMap])

  function abrirCrear() {
    setForm(FORM_VACIO)
    setError(null)
    setModal('crear')
  }

  function abrirEditar(ing: Ingrediente) {
    setForm({
      nombre_ingrediente: ing.nombre_ingrediente,
      formato_compra: ing.formato_compra ?? '',
      unidad_compra: ing.unidad_compra ?? '',
      precio_formato_compra: ing.precio_formato_compra?.toString() ?? '',
      unidad_producto: ing.unidad_producto ?? '',
      precio_unidad_producto: ing.precio_unidad_producto?.toString() ?? '',
      proveedor_id: ing.proveedor_id?.toString() ?? '',
    })
    setEditandoId(ing.id)
    setError(null)
    setModal('editar')
  }

  function cerrarModal() {
    setModal(null)
    setEditandoId(null)
    setError(null)
  }

  async function guardar() {
    if (!form.nombre_ingrediente.trim()) { setError('El nombre es obligatorio'); return }
    setGuardando(true)
    setError(null)

    const payload: Record<string, unknown> = {
      nombre_ingrediente: form.nombre_ingrediente.trim(),
      formato_compra: form.formato_compra || null,
      unidad_compra: form.unidad_compra || null,
      precio_formato_compra: form.precio_formato_compra ? parseFloat(form.precio_formato_compra) : null,
      unidad_producto: form.unidad_producto || null,
      precio_unidad_producto: form.precio_unidad_producto ? parseFloat(form.precio_unidad_producto) : null,
      proveedor_id: form.proveedor_id ? parseInt(form.proveedor_id) : null,
    }

    let err: { message: string } | null = null

    if (modal === 'crear') {
      const { error: e } = await supabase.from('ingredientes').insert(payload)
      err = e
    } else {
      const { error: e } = await supabase.from('ingredientes').update(payload).eq('id', editandoId!)
      err = e
    }

    setGuardando(false)
    if (err) { setError(err.message); return }
    cerrarModal()
    cargar()
  }

  async function eliminar(id: number) {
    await supabase.from('ingredientes').delete().eq('id', id)
    setConfirmEliminar(null)
    cargar()
  }

  const f = (key: keyof FormIng, val: string) => setForm((p) => ({ ...p, [key]: val }))

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="animate-spin text-[#F5B731]" size={24} />
      </div>
    )
  }

  return (
    <>
      <div className="p-6 max-w-6xl">
        {/* Header */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Ingredientes</h1>
            <p className="text-sm text-gray-400 mt-0.5">{ingredientes.length} ingredientes en base de datos</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Buscador */}
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre…"
                className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] w-52"
              />
            </div>
            {/* Filtro proveedor */}
            <div className="relative">
              <select
                value={filtroProveedor}
                onChange={(e) => setFiltroProveedor(e.target.value)}
                className="appearance-none pl-3 pr-7 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#F5B731]"
              >
                <option value="">Todos los proveedores</option>
                <option value="__sin__">Sin proveedor</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            {/* Añadir */}
            <button
              onClick={abrirCrear}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F5B731] hover:bg-[#e5a820] text-[#1A1A1A] text-sm font-bold rounded-lg transition-colors"
            >
              <Plus size={14} /> Añadir ingrediente
            </button>
          </div>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="text-left px-4 py-3 font-medium w-10">ID</th>
                  <th className="text-left px-4 py-3 font-medium">Ingrediente</th>
                  <th className="text-left px-4 py-3 font-medium">Proveedor</th>
                  <th className="text-left px-4 py-3 font-medium">Formato compra</th>
                  <th className="text-center px-3 py-3 font-medium">Ud. compra</th>
                  <th className="text-right px-3 py-3 font-medium">Precio fmt.</th>
                  <th className="text-center px-3 py-3 font-medium">Ud. producto</th>
                  <th className="text-right px-3 py-3 font-medium">Precio/ud</th>
                  <th className="px-3 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtrados.map((ing) => {
                  const provNombre = ing.proveedor_id
                    ? (provMap[ing.proveedor_id] ?? ing.proveedor ?? '—')
                    : (ing.proveedor ?? '—')
                  return (
                    <tr key={ing.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5 text-xs text-gray-400">{ing.id}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-800">{ing.nombre_ingrediente}</td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">{provNombre}</td>
                      <td className="px-4 py-2.5 text-gray-500">{ing.formato_compra ?? '—'}</td>
                      <td className="px-3 py-2.5 text-center text-xs text-gray-400">{ing.unidad_compra ?? '—'}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600">{eur(ing.precio_formato_compra)}</td>
                      <td className="px-3 py-2.5 text-center text-xs text-gray-400">{ing.unidad_producto ?? '—'}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-gray-800">{eur(ing.precio_unidad_producto)}</td>
                      <td className="px-3 py-2.5">
                        {confirmEliminar === ing.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => eliminar(ing.id)}
                              className="text-xs bg-rose-500 text-white px-2 py-0.5 rounded font-semibold hover:bg-rose-600 transition-colors"
                            >
                              Sí
                            </button>
                            <button
                              onClick={() => setConfirmEliminar(null)}
                              className="text-xs text-gray-400 hover:text-gray-600 px-1"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => abrirEditar(ing)}
                              className="text-gray-300 hover:text-[#F5B731] transition-colors"
                              title="Editar"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => setConfirmEliminar(ing.id)}
                              className="text-gray-300 hover:text-rose-500 transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-400">
                      Sin resultados. Prueba otro filtro o{' '}
                      <button onClick={abrirCrear} className="text-[#F5B731] font-semibold underline">
                        añade un ingrediente
                      </button>
                      .
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal crear / editar */}
      {modal && (
        <Modal
          titulo={modal === 'crear' ? 'Añadir ingrediente' : 'Editar ingrediente'}
          onClose={cerrarModal}
        >
          <div className="grid grid-cols-2 gap-4">
            <Campo label="Nombre del ingrediente *" full>
              <input
                value={form.nombre_ingrediente}
                onChange={(e) => f('nombre_ingrediente', e.target.value)}
                className={inputCls}
                placeholder="CARNE PICADA"
                autoFocus
              />
            </Campo>

            <Campo label="Formato de compra">
              <input
                value={form.formato_compra}
                onChange={(e) => f('formato_compra', e.target.value)}
                className={inputCls}
                placeholder="Caja 5 Kg"
              />
            </Campo>

            <Campo label="Unidad de compra">
              <input
                value={form.unidad_compra}
                onChange={(e) => f('unidad_compra', e.target.value)}
                className={inputCls}
                placeholder="Kg"
              />
            </Campo>

            <Campo label="Precio formato compra (€)">
              <input
                type="number"
                step="0.0001"
                min="0"
                value={form.precio_formato_compra}
                onChange={(e) => f('precio_formato_compra', e.target.value)}
                className={inputCls}
                placeholder="0.0000"
              />
            </Campo>

            <Campo label="Unidad de producto">
              <input
                value={form.unidad_producto}
                onChange={(e) => f('unidad_producto', e.target.value)}
                className={inputCls}
                placeholder="Kg"
              />
            </Campo>

            <Campo label="Precio por unidad de producto (€)">
              <input
                type="number"
                step="0.0001"
                min="0"
                value={form.precio_unidad_producto}
                onChange={(e) => f('precio_unidad_producto', e.target.value)}
                className={inputCls}
                placeholder="0.0000"
              />
            </Campo>

            <Campo label="Proveedor" full>
              <div className="relative">
                <select
                  value={form.proveedor_id}
                  onChange={(e) => f('proveedor_id', e.target.value)}
                  className={inputCls}
                >
                  <option value="">Sin proveedor</option>
                  {proveedores.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              </div>
            </Campo>
          </div>

          {error && (
            <p className="mt-3 text-xs text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="mt-5 flex gap-3">
            <button
              onClick={guardar}
              disabled={guardando}
              className="flex-1 flex items-center justify-center gap-2 bg-[#F5B731] hover:bg-[#e5a820] disabled:opacity-60 text-[#1A1A1A] font-bold text-sm py-2.5 rounded-xl transition-colors"
            >
              {guardando ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
              {modal === 'crear' ? 'Añadir' : 'Guardar cambios'}
            </button>
            <button
              onClick={cerrarModal}
              className="px-5 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

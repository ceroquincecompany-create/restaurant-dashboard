'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabaseAuth as supabase } from '@/lib/supabase-browser'
import type { OfertaTrabajo, Candidatura } from '@/lib/supabase'
import { QRCodeSVG } from 'qrcode.react'
import * as XLSX from 'xlsx'
import {
  Plus, Pencil, Trash2, X, Copy, Check, Search, ChevronDown,
  Briefcase, Users, Star, Download, RefreshCw, Eye, ArrowLeft,
} from 'lucide-react'

const URL_PUBLICA = 'https://gestion.lasofi.es/trabajo'

// ── Tipos auxiliares ──────────────────────────────────────────────────────────

type Tab = 'ofertas' | 'candidaturas' | 'base'

type FormOferta = {
  puesto: string
  descripcion: string
  horario: string
  salario: string
  fecha_inicio: string
  estado: 'activa' | 'pausada' | 'cerrada'
}

const OFERTA_VACIA: FormOferta = {
  puesto: '', descripcion: '', horario: '', salario: 'Según convenio',
  fecha_inicio: '', estado: 'activa',
}

type CandidaturaConOferta = Candidatura & { ofertas_trabajo?: { puesto: string } | null }

const ESTADO_CANDIDATURA = {
  recibido:    { label: 'Recibido',    cls: 'bg-gray-100 text-gray-600',    dot: 'bg-gray-400' },
  contactado:  { label: 'Contactado',  cls: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500' },
  entrevista:  { label: 'Entrevista',  cls: 'bg-amber-100 text-amber-700',  dot: 'bg-[#F5B731]' },
  contratado:  { label: 'Contratado',  cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  descartado:  { label: 'Descartado',  cls: 'bg-rose-100 text-rose-700',    dot: 'bg-rose-500' },
} as const

const ESTADO_ORDEN: Array<keyof typeof ESTADO_CANDIDATURA> = [
  'recibido', 'contactado', 'entrevista', 'contratado', 'descartado',
]

const EXPERIENCIA_LABEL: Record<string, string> = {
  sin_experiencia: 'Sin experiencia',
  menos_1_año: 'Menos de 1 año',
  '1_3_años': '1-3 años',
  mas_3_años: 'Más de 3 años',
}

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white'

// ── Componentes pequeños ──────────────────────────────────────────────────────

function Modal({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-8 pb-8 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 my-auto">
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

function EstadoBadge({ estado }: { estado: keyof typeof ESTADO_CANDIDATURA }) {
  const cfg = ESTADO_CANDIDATURA[estado]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function PaginaBolsaTrabajo() {
  const [tab, setTab] = useState<Tab>('ofertas')
  const [ofertas, setOfertas] = useState<OfertaTrabajo[]>([])
  const [candidaturas, setCandidaturas] = useState<CandidaturaConOferta[]>([])
  const [loading, setLoading] = useState(true)
  const [copiado, setCopiado] = useState(false)

  // Ofertas
  const [modalOferta, setModalOferta] = useState(false)
  const [editandoOferta, setEditandoOferta] = useState<number | null>(null)
  const [formOferta, setFormOferta] = useState<FormOferta>(OFERTA_VACIA)
  const [guardandoOferta, setGuardandoOferta] = useState(false)
  const [confirmEliminar, setConfirmEliminar] = useState<number | null>(null)

  // Candidaturas
  const [candidaturaAbierta, setCandidaturaAbierta] = useState<CandidaturaConOferta | null>(null)
  const [filtroCandPuesto, setFiltroCandPuesto] = useState('')
  const [filtroCandEstado, setFiltroCandEstado] = useState('')
  const [busquedaCand, setBusquedaCand] = useState('')
  const [cambiandoEstado, setCambiandoEstado] = useState(false)
  const [nuevoEstado, setNuevoEstado] = useState<keyof typeof ESTADO_CANDIDATURA>('recibido')
  const [notaEstado, setNotaEstado] = useState('')

  // Base de datos
  const [busquedaBase, setBusquedaBase] = useState('')
  const [filtroBaseDisp, setFiltroBaseDisp] = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    const [{ data: of }, { data: cand }] = await Promise.all([
      supabase.from('ofertas_trabajo').select('*').order('created_at', { ascending: false }),
      supabase
        .from('candidaturas')
        .select('*, ofertas_trabajo(puesto)')
        .order('created_at', { ascending: false }),
    ])
    setOfertas((of as OfertaTrabajo[]) ?? [])
    setCandidaturas((cand as CandidaturaConOferta[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // ── Copiar link ─────────────────────────────────────────────────────────────
  async function copiarLink() {
    await navigator.clipboard.writeText(URL_PUBLICA)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  // ── CRUD Ofertas ────────────────────────────────────────────────────────────
  function abrirCrearOferta() {
    setEditandoOferta(null)
    setFormOferta(OFERTA_VACIA)
    setModalOferta(true)
  }

  function abrirEditarOferta(o: OfertaTrabajo) {
    setEditandoOferta(o.id)
    setFormOferta({
      puesto: o.puesto,
      descripcion: o.descripcion,
      horario: o.horario,
      salario: o.salario ?? 'Según convenio',
      fecha_inicio: o.fecha_inicio ?? '',
      estado: o.estado,
    })
    setModalOferta(true)
  }

  async function guardarOferta() {
    if (!formOferta.puesto.trim() || !formOferta.descripcion.trim() || !formOferta.horario.trim()) return
    setGuardandoOferta(true)
    const payload = {
      puesto: formOferta.puesto.trim(),
      descripcion: formOferta.descripcion.trim(),
      horario: formOferta.horario.trim(),
      salario: formOferta.salario.trim() || null,
      fecha_inicio: formOferta.fecha_inicio || null,
      estado: formOferta.estado,
    }
    if (editandoOferta !== null) {
      await supabase.from('ofertas_trabajo').update(payload).eq('id', editandoOferta)
    } else {
      await supabase.from('ofertas_trabajo').insert(payload)
    }
    setGuardandoOferta(false)
    setModalOferta(false)
    cargar()
  }

  async function eliminarOferta(id: number) {
    await supabase.from('ofertas_trabajo').delete().eq('id', id)
    setConfirmEliminar(null)
    cargar()
  }

  // ── Candidaturas ────────────────────────────────────────────────────────────
  const candidaturasFiltradas = useMemo(() => {
    const q = busquedaCand.toLowerCase()
    return candidaturas.filter((c) => {
      const matchQ = !q || c.nombre.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
      const matchPuesto = !filtroCandPuesto || String(c.oferta_id) === filtroCandPuesto
      const matchEstado = !filtroCandEstado || c.estado === filtroCandEstado
      return matchQ && matchPuesto && matchEstado
    })
  }, [candidaturas, busquedaCand, filtroCandPuesto, filtroCandEstado])

  async function cambiarEstado() {
    if (!candidaturaAbierta) return
    await supabase
      .from('candidaturas')
      .update({
        estado: nuevoEstado,
        notas_proceso: notaEstado.trim() || null,
      })
      .eq('id', candidaturaAbierta.id)
    setCambiandoEstado(false)
    setNotaEstado('')
    await cargar()
    // Refrescar la candidatura abierta
    const { data } = await supabase
      .from('candidaturas')
      .select('*, ofertas_trabajo(puesto)')
      .eq('id', candidaturaAbierta.id)
      .single()
    if (data) setCandidaturaAbierta(data as CandidaturaConOferta)
  }

  async function toggleInteresante(c: CandidaturaConOferta) {
    await supabase.from('candidaturas').update({ interesante: !c.interesante }).eq('id', c.id)
    cargar()
    if (candidaturaAbierta?.id === c.id) {
      setCandidaturaAbierta({ ...candidaturaAbierta, interesante: !c.interesante })
    }
  }

  // ── Base de datos ────────────────────────────────────────────────────────────
  const candidatosBase = useMemo(() => {
    const q = busquedaBase.toLowerCase()
    return candidaturas.filter((c) => {
      const matchQ = !q || c.nombre.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
      const matchDisp = !filtroBaseDisp || c.disponibilidad.includes(filtroBaseDisp)
      return matchQ && matchDisp
    })
  }, [candidaturas, busquedaBase, filtroBaseDisp])

  function exportarExcel() {
    const rows = candidatosBase.map((c) => ({
      Nombre: c.nombre,
      Teléfono: c.telefono,
      Email: c.email,
      Puesto: c.ofertas_trabajo?.puesto ?? 'Candidatura espontánea',
      Experiencia: EXPERIENCIA_LABEL[c.experiencia] ?? c.experiencia,
      Disponibilidad: c.disponibilidad.join(', '),
      Vehículo: c.tiene_vehiculo ? 'Sí' : 'No',
      Estado: ESTADO_CANDIDATURA[c.estado as keyof typeof ESTADO_CANDIDATURA]?.label ?? c.estado,
      Interesante: c.interesante ? 'Sí' : '',
      Fecha: new Date(c.created_at).toLocaleDateString('es-ES'),
      Notas: c.descripcion ?? '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Candidatos')
    XLSX.writeFile(wb, `candidatos-sofi-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  // ── Conteo candidaturas por oferta ──────────────────────────────────────────
  function countCandidaturas(ofertaId: number) {
    return candidaturas.filter((c) => c.oferta_id === ofertaId).length
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="animate-spin text-[#F5B731]" size={24} />
      </div>
    )
  }

  // ── VISTA: ficha candidatura ────────────────────────────────────────────────
  if (candidaturaAbierta) {
    const cand = candidaturaAbierta
    return (
      <div className="p-6 max-w-2xl">
        <button
          onClick={() => setCandidaturaAbierta(null)}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors mb-5"
        >
          <ArrowLeft size={15} /> Volver a candidaturas
        </button>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">{cand.nombre}</h2>
              <p className="text-sm text-gray-400 mt-0.5">
                {cand.ofertas_trabajo?.puesto ?? 'Candidatura espontánea'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleInteresante(cand)}
                className={`p-1.5 rounded-lg transition-colors ${
                  cand.interesante ? 'text-[#F5B731] bg-[#F5B731]/10' : 'text-gray-300 hover:text-[#F5B731]'
                }`}
                title="Marcar como interesante"
              >
                <Star size={18} fill={cand.interesante ? 'currentColor' : 'none'} />
              </button>
              <EstadoBadge estado={cand.estado as keyof typeof ESTADO_CANDIDATURA} />
            </div>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Teléfono</p>
                <a href={`tel:${cand.telefono}`} className="text-sm font-medium text-[#1A1A1A] hover:underline">{cand.telefono}</a>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Email</p>
                <a href={`mailto:${cand.email}`} className="text-sm font-medium text-[#1A1A1A] hover:underline truncate block">{cand.email}</a>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Experiencia</p>
                <p className="text-sm font-medium text-gray-800">{EXPERIENCIA_LABEL[cand.experiencia] ?? cand.experiencia}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Vehículo propio</p>
                <p className="text-sm font-medium text-gray-800">{cand.tiene_vehiculo ? 'Sí' : 'No'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-400 mb-0.5">Disponibilidad</p>
                <div className="flex flex-wrap gap-1.5">
                  {cand.disponibilidad.map((d) => (
                    <span key={d} className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">{d}</span>
                  ))}
                </div>
              </div>
              {cand.descripcion && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-400 mb-0.5">Sobre el candidato</p>
                  <p className="text-sm text-gray-700 whitespace-pre-line">{cand.descripcion}</p>
                </div>
              )}
              {cand.notas_proceso && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-400 mb-0.5">Notas del proceso</p>
                  <p className="text-sm text-gray-700 whitespace-pre-line">{cand.notas_proceso}</p>
                </div>
              )}
              <div className="col-span-2">
                <p className="text-xs text-gray-400">Recibida el {new Date(cand.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
            {cambiandoEstado ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Nuevo estado</label>
                  <div className="flex flex-wrap gap-2">
                    {ESTADO_ORDEN.map((e) => (
                      <button
                        key={e}
                        onClick={() => setNuevoEstado(e)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                          nuevoEstado === e
                            ? 'border-[#F5B731] bg-[#F5B731]/10 text-[#1A1A1A]'
                            : 'border-gray-200 text-gray-500 bg-white hover:border-gray-300'
                        }`}
                      >
                        {ESTADO_CANDIDATURA[e].label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Nota (opcional)</label>
                  <textarea
                    className={`${inputCls} resize-none`}
                    rows={2}
                    placeholder="Observaciones del proceso..."
                    value={notaEstado}
                    onChange={(e) => setNotaEstado(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setCambiandoEstado(false)} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors">Cancelar</button>
                  <button onClick={cambiarEstado} className="px-4 py-1.5 bg-[#F5B731] text-[#1A1A1A] text-xs font-semibold rounded-lg hover:bg-[#e0a820] transition-colors">
                    Guardar
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => { setNuevoEstado(cand.estado as keyof typeof ESTADO_CANDIDATURA); setCambiandoEstado(true) }}
                className="flex items-center gap-1.5 text-sm font-medium text-[#1A1A1A] hover:text-[#F5B731] transition-colors"
              >
                <ChevronDown size={15} /> Cambiar estado
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── VISTA PRINCIPAL ────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-6xl">
      {/* Cabecera */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Bolsa de Trabajo</h1>
          <p className="text-sm text-gray-400 mt-0.5">Gestión de ofertas y candidaturas</p>
        </div>

        {/* Link compartir */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 hidden sm:block">{URL_PUBLICA}</span>
          <button
            onClick={copiarLink}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              copiado ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {copiado ? <Check size={13} /> : <Copy size={13} />}
            {copiado ? 'Copiado' : 'Copiar link'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {([
          { id: 'ofertas', label: 'Ofertas', icon: Briefcase },
          { id: 'candidaturas', label: `Candidaturas${candidaturas.filter(c => c.estado === 'recibido').length ? ` (${candidaturas.filter(c => c.estado === 'recibido').length})` : ''}`, icon: Users },
          { id: 'base', label: 'Base candidatos', icon: Star },
        ] as const).map(({ id, label, icon: Icono }) => (
          <button
            key={id}
            onClick={() => setTab(id as Tab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === id ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icono size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB OFERTAS ─────────────────────────────────────────────────────── */}
      {tab === 'ofertas' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-400">{ofertas.length} oferta{ofertas.length !== 1 ? 's' : ''}</p>
            <button
              onClick={abrirCrearOferta}
              className="flex items-center gap-2 px-4 py-2 bg-[#F5B731] text-[#1A1A1A] text-sm font-semibold rounded-lg hover:bg-[#e0a820] transition-colors"
            >
              <Plus size={15} /> Nueva oferta
            </button>
          </div>

          {ofertas.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
              <Briefcase size={32} className="mx-auto text-gray-200 mb-3" />
              <p className="text-sm text-gray-400">No hay ofertas. Crea la primera.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="divide-y divide-gray-50">
                {ofertas.map((o) => {
                  const estadoCfg = {
                    activa:  { cls: 'bg-emerald-100 text-emerald-700', label: 'Activa' },
                    pausada: { cls: 'bg-amber-100 text-amber-700',     label: 'Pausada' },
                    cerrada: { cls: 'bg-gray-100 text-gray-500',       label: 'Cerrada' },
                  }[o.estado]
                  return (
                    <div key={o.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-900">{o.puesto}</p>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${estadoCfg.cls}`}>
                            {estadoCfg.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {o.horario}
                          {o.salario && <span> · {o.salario}</span>}
                          {o.fecha_inicio && <span> · Desde {new Date(o.fecha_inicio + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>}
                          <span className="ml-2 font-medium text-gray-500">{countCandidaturas(o.id)} candidatura{countCandidaturas(o.id) !== 1 ? 's' : ''}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => abrirEditarOferta(o)} className="p-1.5 text-gray-400 hover:text-[#F5B731] transition-colors rounded" title="Editar">
                          <Pencil size={13} />
                        </button>
                        {confirmEliminar === o.id ? (
                          <span className="flex items-center gap-1">
                            <button onClick={() => eliminarOferta(o.id)} className="px-2 py-0.5 bg-rose-500 text-white rounded text-xs font-medium hover:bg-rose-600">Sí</button>
                            <button onClick={() => setConfirmEliminar(null)} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium hover:bg-gray-200">No</button>
                          </span>
                        ) : (
                          <button onClick={() => setConfirmEliminar(o.id)} className="p-1.5 text-gray-400 hover:text-rose-500 transition-colors rounded" title="Eliminar">
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

          {/* QR + Link */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col sm:flex-row items-center gap-6">
            <div className="flex-shrink-0 p-3 bg-white border border-gray-200 rounded-xl">
              <QRCodeSVG value={URL_PUBLICA} size={96} bgColor="#ffffff" fgColor="#1A1A1A" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800 mb-1">Comparte la oferta</p>
              <p className="text-xs text-gray-400 mb-3">
                Imprime el QR o comparte el enlace en redes sociales y WhatsApp para recibir candidaturas.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={copiarLink}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    copiado ? 'bg-emerald-100 text-emerald-700' : 'bg-[#F5B731] text-[#1A1A1A] hover:bg-[#e0a820]'
                  }`}
                >
                  {copiado ? <Check size={13} /> : <Copy size={13} />}
                  {copiado ? '¡Copiado!' : 'Copiar link'}
                </button>
                <a
                  href={URL_PUBLICA}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  <Eye size={13} /> Ver página pública
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB CANDIDATURAS ────────────────────────────────────────────────── */}
      {tab === 'candidaturas' && (
        <div className="space-y-4">
          {/* Filtros */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar candidato..."
                value={busquedaCand}
                onChange={(e) => setBusquedaCand(e.target.value)}
                className="pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] w-48"
              />
            </div>
            <select
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white"
              value={filtroCandPuesto}
              onChange={(e) => setFiltroCandPuesto(e.target.value)}
            >
              <option value="">Todos los puestos</option>
              {ofertas.map((o) => <option key={o.id} value={o.id}>{o.puesto}</option>)}
            </select>
            <select
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white"
              value={filtroCandEstado}
              onChange={(e) => setFiltroCandEstado(e.target.value)}
            >
              <option value="">Todos los estados</option>
              {ESTADO_ORDEN.map((e) => (
                <option key={e} value={e}>{ESTADO_CANDIDATURA[e].label}</option>
              ))}
            </select>
            <span className="ml-auto text-xs text-gray-400">{candidaturasFiltradas.length} candidatura{candidaturasFiltradas.length !== 1 ? 's' : ''}</span>
          </div>

          {candidaturasFiltradas.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
              <Users size={32} className="mx-auto text-gray-200 mb-3" />
              <p className="text-sm text-gray-400">No hay candidaturas.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="divide-y divide-gray-50">
                {candidaturasFiltradas.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => {
                      setNuevoEstado(c.estado as keyof typeof ESTADO_CANDIDATURA)
                      setCandidaturaAbierta(c)
                      setCambiandoEstado(false)
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900">{c.nombre}</p>
                        {c.interesante && <Star size={12} className="text-[#F5B731]" fill="currentColor" />}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {c.ofertas_trabajo?.puesto ?? 'Candidatura espontánea'}
                        {' · '}{c.telefono}
                        {' · '}{new Date(c.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <EstadoBadge estado={c.estado as keyof typeof ESTADO_CANDIDATURA} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB BASE DE CANDIDATOS ──────────────────────────────────────────── */}
      {tab === 'base' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre o email..."
                value={busquedaBase}
                onChange={(e) => setBusquedaBase(e.target.value)}
                className="pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] w-56"
              />
            </div>
            <select
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white"
              value={filtroBaseDisp}
              onChange={(e) => setFiltroBaseDisp(e.target.value)}
            >
              <option value="">Cualquier disponibilidad</option>
              {['Mañanas', 'Tardes', 'Noches', 'Fines de semana'].map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <button
              onClick={exportarExcel}
              className="ml-auto flex items-center gap-1.5 px-3 py-2 bg-[#1A1A1A] text-white text-xs font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              <Download size={13} /> Exportar Excel
            </button>
          </div>

          <p className="text-xs text-gray-400">{candidatosBase.length} candidato{candidatosBase.length !== 1 ? 's' : ''} en base de datos</p>

          {candidatosBase.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
              <Users size={32} className="mx-auto text-gray-200 mb-3" />
              <p className="text-sm text-gray-400">No hay candidatos en la base de datos.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="divide-y divide-gray-50">
                {candidatosBase.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => {
                      setNuevoEstado(c.estado as keyof typeof ESTADO_CANDIDATURA)
                      setCandidaturaAbierta(c)
                      setCambiandoEstado(false)
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">{c.nombre}</p>
                        {c.interesante && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 bg-[#F5B731]/10 text-[#F5B731] rounded text-xs font-medium">
                            <Star size={10} fill="currentColor" /> Interesante
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {c.ofertas_trabajo?.puesto ?? 'Candidatura espontánea'}
                        {' · '}{EXPERIENCIA_LABEL[c.experiencia]}
                        {' · '}{c.disponibilidad.join(', ')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <EstadoBadge estado={c.estado as keyof typeof ESTADO_CANDIDATURA} />
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleInteresante(c) }}
                        className={`p-1 rounded transition-colors ${
                          c.interesante ? 'text-[#F5B731]' : 'text-gray-300 hover:text-[#F5B731]'
                        }`}
                        title={c.interesante ? 'Quitar marca' : 'Marcar como interesante'}
                      >
                        <Star size={15} fill={c.interesante ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MODAL OFERTA ─────────────────────────────────────────────────────── */}
      {modalOferta && (
        <Modal
          titulo={editandoOferta !== null ? 'Editar oferta' : 'Nueva oferta'}
          onCerrar={() => setModalOferta(false)}
        >
          <div className="space-y-4">
            <Campo label="Puesto *">
              <input
                className={inputCls}
                placeholder="Ej: Camarero/a de sala"
                value={formOferta.puesto}
                onChange={(e) => setFormOferta((f) => ({ ...f, puesto: e.target.value }))}
              />
            </Campo>
            <Campo label="Descripción *">
              <textarea
                className={`${inputCls} resize-none`}
                rows={4}
                placeholder="Describe las funciones, requisitos y condiciones del puesto..."
                value={formOferta.descripcion}
                onChange={(e) => setFormOferta((f) => ({ ...f, descripcion: e.target.value }))}
              />
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Horario *">
                <input
                  className={inputCls}
                  placeholder="Ej: Turno partido, L-D"
                  value={formOferta.horario}
                  onChange={(e) => setFormOferta((f) => ({ ...f, horario: e.target.value }))}
                />
              </Campo>
              <Campo label="Salario">
                <input
                  className={inputCls}
                  placeholder="Según convenio"
                  value={formOferta.salario}
                  onChange={(e) => setFormOferta((f) => ({ ...f, salario: e.target.value }))}
                />
              </Campo>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Fecha inicio">
                <input
                  type="date"
                  className={inputCls}
                  value={formOferta.fecha_inicio}
                  onChange={(e) => setFormOferta((f) => ({ ...f, fecha_inicio: e.target.value }))}
                />
              </Campo>
              <Campo label="Estado">
                <select
                  className={inputCls}
                  value={formOferta.estado}
                  onChange={(e) => setFormOferta((f) => ({ ...f, estado: e.target.value as FormOferta['estado'] }))}
                >
                  <option value="activa">Activa</option>
                  <option value="pausada">Pausada</option>
                  <option value="cerrada">Cerrada</option>
                </select>
              </Campo>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setModalOferta(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">
                Cancelar
              </button>
              <button
                onClick={guardarOferta}
                disabled={guardandoOferta || !formOferta.puesto.trim() || !formOferta.descripcion.trim() || !formOferta.horario.trim()}
                className="px-4 py-2 text-sm font-semibold bg-[#F5B731] text-[#1A1A1A] rounded-lg hover:bg-[#e0a820] transition-colors disabled:opacity-50"
              >
                {guardandoOferta ? 'Guardando...' : editandoOferta !== null ? 'Guardar cambios' : 'Crear oferta'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

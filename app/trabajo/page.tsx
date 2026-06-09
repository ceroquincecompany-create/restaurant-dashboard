'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { OfertaTrabajo } from '@/lib/supabase'
import { MapPin, Clock, Euro, Check, ChevronDown, ChevronUp, X } from 'lucide-react'

type FormData = {
  nombre: string
  telefono: string
  email: string
  oferta_id: string
  experiencia: string
  disponibilidad: string[]
  tiene_vehiculo: string
  descripcion: string
}

const FORM_VACIO: FormData = {
  nombre: '',
  telefono: '',
  email: '',
  oferta_id: '',
  experiencia: '',
  disponibilidad: [],
  tiene_vehiculo: '',
  descripcion: '',
}

const EXPERIENCIA_OPTS = [
  { value: 'sin_experiencia', label: 'Sin experiencia' },
  { value: 'menos_1_año', label: 'Menos de 1 año' },
  { value: '1_3_años', label: '1-3 años' },
  { value: 'mas_3_años', label: 'Más de 3 años' },
]

const DISPONIBILIDAD_OPTS = ['Mañanas', 'Tardes', 'Noches', 'Fines de semana']

const inputCls = 'w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white'

function Modal({ onCerrar, children }: { onCerrar: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div className="bg-white w-full sm:rounded-2xl sm:max-w-lg max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-base font-bold text-[#1A1A1A]">Enviar candidatura</h2>
          <button onClick={onCerrar} className="text-gray-400 hover:text-gray-700 transition-colors p-1">
            <X size={20} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

export default function PaginaTrabajo() {
  const [ofertas, setOfertas] = useState<OfertaTrabajo[]>([])
  const [loading, setLoading] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [ofertaSeleccionada, setOfertaSeleccionada] = useState<OfertaTrabajo | null>(null)
  const [ofertaExpandida, setOfertaExpandida] = useState<number | null>(null)
  const [form, setForm] = useState<FormData>(FORM_VACIO)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [errores, setErrores] = useState<Partial<FormData>>({})

  useEffect(() => {
    supabase
      .from('ofertas_trabajo')
      .select('*')
      .eq('estado', 'activa')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setOfertas((data as OfertaTrabajo[]) ?? [])
        setLoading(false)
      })
  }, [])

  function abrirFormulario(oferta?: OfertaTrabajo) {
    setForm({ ...FORM_VACIO, oferta_id: oferta ? String(oferta.id) : '' })
    setOfertaSeleccionada(oferta ?? null)
    setErrores({})
    setEnviado(false)
    setModalAbierto(true)
  }

  function toggleDisponibilidad(valor: string) {
    setForm((f) => ({
      ...f,
      disponibilidad: f.disponibilidad.includes(valor)
        ? f.disponibilidad.filter((d) => d !== valor)
        : [...f.disponibilidad, valor],
    }))
  }

  function validar(): boolean {
    const e: Partial<FormData> = {}
    if (!form.nombre.trim()) e.nombre = 'Obligatorio'
    if (!form.telefono.trim()) e.telefono = 'Obligatorio'
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Email inválido'
    if (!form.experiencia) e.experiencia = 'Selecciona una opción'
    if (form.disponibilidad.length === 0) e.disponibilidad = ['Selecciona al menos una']
    if (!form.tiene_vehiculo) e.tiene_vehiculo = 'Selecciona una opción'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  async function enviar() {
    if (!validar()) return
    setEnviando(true)
    const { error } = await supabase.from('candidaturas').insert({
      oferta_id: form.oferta_id ? Number(form.oferta_id) : null,
      nombre: form.nombre.trim(),
      telefono: form.telefono.trim(),
      email: form.email.trim(),
      experiencia: form.experiencia,
      disponibilidad: form.disponibilidad,
      tiene_vehiculo: form.tiene_vehiculo === 'si',
      descripcion: form.descripcion.trim() || null,
      estado: 'recibido',
    })
    setEnviando(false)
    if (!error) {
      setEnviado(true)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-[#1A1A1A] text-white">
        <div className="max-w-3xl mx-auto px-5 py-6 flex items-center gap-4">
          <img src="/favicon.png" alt="SOFI" className="h-12 w-12 rounded-xl object-contain bg-white p-1" />
          <div>
            <h1 className="text-xl font-bold tracking-wide">SOFI Pinomonotano</h1>
            <p className="text-sm text-white/60">Bolsa de empleo</p>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-[#F5B731]">
        <div className="max-w-3xl mx-auto px-5 py-10">
          <h2 className="text-2xl font-extrabold text-[#1A1A1A] leading-tight">
            Únete a nuestro equipo
          </h2>
          <p className="text-[#1A1A1A]/70 mt-2 text-base">
            Buscamos personas con ganas, actitud y pasión por la hostelería. Sevilla.
          </p>
          <button
            onClick={() => abrirFormulario()}
            className="mt-5 inline-flex items-center gap-2 px-6 py-3 bg-[#1A1A1A] text-white text-sm font-bold rounded-xl hover:bg-black transition-colors"
          >
            Quiero trabajar aquí
          </button>
        </div>
      </div>

      {/* Ofertas */}
      <div className="max-w-3xl mx-auto px-5 py-8">
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="bg-gray-100 animate-pulse rounded-2xl h-24" />
            ))}
          </div>
        ) : ofertas.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-base">No hay ofertas activas en este momento.</p>
            <p className="text-gray-400 text-sm mt-1">Envíanos tu candidatura de todas formas.</p>
            <button
              onClick={() => abrirFormulario()}
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-[#F5B731] text-[#1A1A1A] text-sm font-bold rounded-xl hover:bg-[#e0a820] transition-colors"
            >
              Enviar candidatura espontánea
            </button>
          </div>
        ) : (
          <>
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              {ofertas.length} {ofertas.length === 1 ? 'oferta disponible' : 'ofertas disponibles'}
            </h3>
            <div className="space-y-3">
              {ofertas.map((oferta) => {
                const expandida = ofertaExpandida === oferta.id
                return (
                  <div
                    key={oferta.id}
                    className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                  >
                    <button
                      className="w-full text-left px-6 py-5 flex items-start justify-between gap-4"
                      onClick={() => setOfertaExpandida(expandida ? null : oferta.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className="text-base font-bold text-[#1A1A1A]">{oferta.puesto}</h4>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <MapPin size={12} /> Sevilla
                          </span>
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Clock size={12} /> {oferta.horario}
                          </span>
                          {oferta.salario && (
                            <span className="flex items-center gap-1 text-xs text-gray-400">
                              <Euro size={12} /> {oferta.salario}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="flex-shrink-0 text-gray-400 mt-1">
                        {expandida ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </span>
                    </button>

                    {expandida && (
                      <div className="px-6 pb-6 border-t border-gray-100 pt-4">
                        <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                          {oferta.descripcion}
                        </p>
                        <button
                          onClick={() => abrirFormulario(oferta)}
                          className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-[#F5B731] text-[#1A1A1A] text-sm font-bold rounded-xl hover:bg-[#e0a820] transition-colors"
                        >
                          Quiero trabajar aquí
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-100 mt-12 py-6 text-center text-xs text-gray-400">
        SOFI Pinomonotano · Sevilla
      </footer>

      {/* Modal formulario */}
      {modalAbierto && (
        <Modal onCerrar={() => setModalAbierto(false)}>
          {enviado ? (
            <div className="py-8 text-center">
              <div className="w-16 h-16 bg-[#F5B731] rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={32} className="text-[#1A1A1A]" />
              </div>
              <h3 className="text-lg font-bold text-[#1A1A1A]">¡Gracias!</h3>
              <p className="text-gray-500 mt-2 text-sm">
                Hemos recibido tu candidatura. Nos pondremos en contacto contigo pronto.
              </p>
              <button
                onClick={() => setModalAbierto(false)}
                className="mt-6 px-6 py-2.5 bg-[#F5B731] text-[#1A1A1A] text-sm font-bold rounded-xl hover:bg-[#e0a820] transition-colors"
              >
                Cerrar
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Nombre */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre completo *</label>
                <input
                  className={inputCls}
                  placeholder="Tu nombre y apellidos"
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                />
                {errores.nombre && <p className="text-xs text-rose-500 mt-1">{errores.nombre}</p>}
              </div>

              {/* Teléfono */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Teléfono *</label>
                <input
                  type="tel"
                  className={inputCls}
                  placeholder="600 000 000"
                  value={form.telefono}
                  onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                />
                {errores.telefono && <p className="text-xs text-rose-500 mt-1">{errores.telefono}</p>}
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Email *</label>
                <input
                  type="email"
                  className={inputCls}
                  placeholder="tucorreo@ejemplo.com"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
                {errores.email && <p className="text-xs text-rose-500 mt-1">{errores.email}</p>}
              </div>

              {/* Puesto */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Puesto al que aplicas</label>
                <select
                  className={inputCls}
                  value={form.oferta_id}
                  onChange={(e) => setForm((f) => ({ ...f, oferta_id: e.target.value }))}
                >
                  <option value="">— Candidatura espontánea —</option>
                  {ofertas.map((o) => (
                    <option key={o.id} value={o.id}>{o.puesto}</option>
                  ))}
                </select>
              </div>

              {/* Experiencia */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Experiencia en hostelería *</label>
                <select
                  className={inputCls}
                  value={form.experiencia}
                  onChange={(e) => setForm((f) => ({ ...f, experiencia: e.target.value }))}
                >
                  <option value="">— Selecciona —</option>
                  {EXPERIENCIA_OPTS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {errores.experiencia && <p className="text-xs text-rose-500 mt-1">{errores.experiencia}</p>}
              </div>

              {/* Disponibilidad */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Disponibilidad *</label>
                <div className="grid grid-cols-2 gap-2">
                  {DISPONIBILIDAD_OPTS.map((d) => {
                    const activo = form.disponibilidad.includes(d)
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleDisponibilidad(d)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                          activo
                            ? 'border-[#F5B731] bg-[#F5B731]/10 text-[#1A1A1A]'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${
                          activo ? 'bg-[#F5B731]' : 'border border-gray-300 bg-white'
                        }`}>
                          {activo && <Check size={10} className="text-[#1A1A1A]" />}
                        </div>
                        {d}
                      </button>
                    )
                  })}
                </div>
                {errores.disponibilidad && <p className="text-xs text-rose-500 mt-1">{errores.disponibilidad[0]}</p>}
              </div>

              {/* Vehículo */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">¿Tienes vehículo propio? *</label>
                <div className="flex gap-2">
                  {[{ value: 'si', label: 'Sí' }, { value: 'no', label: 'No' }].map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, tiene_vehiculo: value }))}
                      className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                        form.tiene_vehiculo === value
                          ? 'border-[#F5B731] bg-[#F5B731]/10 text-[#1A1A1A]'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {errores.tiene_vehiculo && <p className="text-xs text-rose-500 mt-1">{errores.tiene_vehiculo}</p>}
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Cuéntanos algo sobre ti (opcional)</label>
                <textarea
                  className={`${inputCls} resize-none`}
                  rows={3}
                  placeholder="Motivación, experiencia destacable, cualquier cosa que quieras compartir..."
                  value={form.descripcion}
                  onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                />
              </div>

              <button
                onClick={enviar}
                disabled={enviando}
                className="w-full py-3.5 bg-[#F5B731] text-[#1A1A1A] text-sm font-bold rounded-xl hover:bg-[#e0a820] transition-colors disabled:opacity-60"
              >
                {enviando ? 'Enviando...' : 'Enviar candidatura'}
              </button>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

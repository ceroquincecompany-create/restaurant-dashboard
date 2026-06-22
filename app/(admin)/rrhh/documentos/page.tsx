'use client'

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { DocumentoFirma, FirmaRegistro } from '@/lib/supabase'
import {
  FileSignature, FileText,
  Plus, X, RefreshCw, CheckCircle, Clock,
  ChevronDown, ChevronUp, Trash2, Eye, Calendar,
} from 'lucide-react'

// ─────────────────────────────────────────────
// Shared
// ─────────────────────────────────────────────

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white'

type EmpMini = { id: number; nombre: string; activo: boolean }
type DocConFirmas = DocumentoFirma & { firmas: FirmaRegistro[] }

const TIPOS = ['Vacaciones aceptadas', 'RGPD-LOPD', 'Confidencialidad', 'Otro'] as const
const PLANTILLAS: Record<string, { tipo: string; titulo: string; texto: string }> = {
  vacaciones: { tipo: 'Vacaciones aceptadas', titulo: 'Aceptación de período vacacional', texto: `Yo, el/la empleado/a abajo firmante, declaro haber recibido la comunicación relativa al período vacacional asignado y doy mi conformidad expresa con las fechas indicadas en el calendario laboral acordado.\n\nConfirmo que he sido informado/a con la antelación legalmente establecida y acepto voluntariamente el período de vacaciones asignado, sin perjuicio de los derechos que me correspondan según el Convenio Colectivo aplicable.` },
  rgpd: { tipo: 'RGPD-LOPD', titulo: 'Consentimiento de Protección de Datos (RGPD/LOPDGDD)', texto: `De conformidad con el Reglamento (UE) 2016/679 General de Protección de Datos (RGPD) y la Ley Orgánica 3/2018 de Protección de Datos Personales y garantía de los derechos digitales (LOPDGDD), presto mi consentimiento expreso para que la empresa trate mis datos personales con las siguientes finalidades:\n\n• Gestión de la relación laboral y de recursos humanos.\n• Elaboración de nóminas y cumplimiento de obligaciones tributarias y de Seguridad Social.\n• Prevención de riesgos laborales.\n• Cualquier otra finalidad derivada de obligaciones legales aplicables.\n\nLos datos no serán cedidos a terceros salvo obligación legal.` },
  confidencialidad: { tipo: 'Confidencialidad', titulo: 'Acuerdo de Confidencialidad', texto: `El/la empleado/a se compromete a mantener estricta confidencialidad sobre toda la información relacionada con la empresa, sus clientes, proveedores, procesos, métodos de trabajo, datos económicos, recetas, fórmulas, precios y cualquier otra información de carácter confidencial a la que tenga acceso en el ejercicio de sus funciones.\n\nEsta obligación de confidencialidad es de carácter indefinido y se extiende durante la vigencia del contrato laboral y durante los dos (2) años posteriores a su extinción, cualquiera que sea la causa.` },
}

function fmtFecha(s: string | null | undefined) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtFechaHora(s: string | null | undefined) {
  if (!s) return '—'
  return new Date(s).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─────────────────────────────────────────────
// ── TAB: FIRMAS ──────────────────────────────
// ─────────────────────────────────────────────

function FirmasTab() {
  const [docs, setDocs] = useState<DocConFirmas[]>([])
  const [empleados, setEmpleados] = useState<EmpMini[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [expandido, setExpandido] = useState<number | null>(null)
  const [verFirma, setVerFirma] = useState<FirmaRegistro | null>(null)
  const [confirmEliminar, setConfirmEliminar] = useState<number | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ tipo: 'Confidencialidad', titulo: '', texto: '', empleado_id: 'todos', fecha_limite: '' })

  const cargar = useCallback(async () => {
    const [{ data: d }, { data: e }] = await Promise.all([
      supabase.from('documentos_firma').select('*').order('created_at', { ascending: false }),
      supabase.from('empleados').select('id,nombre,activo').eq('activo', true).order('nombre'),
    ])
    const ids = (d ?? []).map((x: DocumentoFirma) => x.id)
    let firmasData: FirmaRegistro[] = []
    if (ids.length > 0) {
      const { data: f } = await supabase.from('firmas').select('*').in('documento_id', ids)
      firmasData = f ?? []
    }
    setDocs((d ?? []).map((x: DocumentoFirma) => ({ ...x, firmas: firmasData.filter(f => f.documento_id === x.id) })))
    setEmpleados(e ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  function aplicarPlantilla(key: string) {
    const p = PLANTILLAS[key]
    setForm(f => ({ ...f, tipo: p.tipo, titulo: p.titulo, texto: p.texto }))
  }

  async function guardar() {
    if (!form.titulo.trim()) { setError('El título es obligatorio'); return }
    if (!form.texto.trim()) { setError('El texto es obligatorio'); return }
    setGuardando(true); setError('')
    const { error: err } = await supabase.from('documentos_firma').insert({
      tipo: form.tipo, titulo: form.titulo.trim(), texto: form.texto.trim(),
      empleado_id: form.empleado_id === 'todos' ? null : Number(form.empleado_id),
      fecha_limite: form.fecha_limite || null,
    })
    if (err) { setError(err.message); setGuardando(false); return }
    setGuardando(false); setModal(false)
    setForm({ tipo: 'Confidencialidad', titulo: '', texto: '', empleado_id: 'todos', fecha_limite: '' })
    cargar()
  }

  async function eliminar(id: number) {
    await supabase.from('documentos_firma').delete().eq('id', id)
    setConfirmEliminar(null); cargar()
  }

  const empActivos = empleados.filter(e => e.activo)

  const stats = useMemo(() => docs.map(d => {
    const total = d.empleado_id === null ? empActivos.length : 1
    const firmados = d.firmas.filter(f => f.firmado).length
    return { id: d.id, total, firmados }
  }), [docs, empActivos])

  if (loading) return <div className="flex items-center justify-center h-64"><RefreshCw className="animate-spin text-[#F5B731]" size={24} /></div>

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Firmas digitales</h1>
          <p className="text-sm text-gray-400 mt-0.5">Documentos legales que requieren consentimiento del empleado</p>
        </div>
        <button onClick={() => { setModal(true); setError('') }} className="flex items-center gap-2 px-4 py-2 bg-[#F5B731] text-[#1A1A1A] text-sm font-semibold rounded-lg hover:bg-[#e0a820] transition-colors">
          <Plus size={15} /> Nuevo documento
        </button>
      </div>

      {docs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FileSignature size={36} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">No hay documentos de firma creados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map(d => {
            const st = stats.find(s => s.id === d.id) ?? { total: 1, firmados: 0 }
            const todosHanFirmado = st.firmados >= st.total && st.total > 0
            const abierto = expandido === d.id
            const emp = d.empleado_id ? empleados.find(e => e.id === d.empleado_id) : null
            const firmadas = d.firmas.filter(f => f.firmado)
            const faltanFirmar = d.empleado_id === null
              ? empActivos.filter(e => !d.firmas.find(f => f.empleado_id === e.id && f.firmado))
              : []

            return (
              <div key={d.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50 transition-colors select-none" onClick={() => setExpandido(abierto ? null : d.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-semibold text-gray-900">{d.titulo}</span>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{d.tipo}</span>
                      {todosHanFirmado ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"><CheckCircle size={11} /> Completado</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600"><Clock size={11} /> Pendiente</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-gray-400">{d.empleado_id === null ? 'Todos los empleados' : (emp?.nombre ?? '—')}</span>
                      <span className="text-gray-200">·</span>
                      <span className="text-xs font-semibold text-gray-600">{st.firmados}/{st.total} firmado{st.total !== 1 ? 's' : ''}</span>
                      {d.fecha_limite && (
                        <><span className="text-gray-200">·</span><span className="text-xs text-gray-400 flex items-center gap-1"><Calendar size={10} /> Límite: {fmtFecha(d.fecha_limite)}</span></>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {confirmEliminar === d.id ? (
                      <span className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={() => eliminar(d.id)} className="px-2 py-1 bg-rose-500 text-white rounded text-xs font-medium">Eliminar</button>
                        <button onClick={() => setConfirmEliminar(null)} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-medium">No</button>
                      </span>
                    ) : (
                      <button onClick={e => { e.stopPropagation(); setConfirmEliminar(d.id) }} className="p-1.5 text-gray-300 hover:text-rose-500 transition-colors rounded"><Trash2 size={14} /></button>
                    )}
                    {abierto ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </div>

                {abierto && (
                  <div className="border-t border-gray-100 px-5 py-4 space-y-4 bg-gray-50/50">
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Texto del documento</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-white border border-gray-100 rounded-lg px-4 py-3">{d.texto}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {firmadas.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-emerald-600 mb-2 flex items-center gap-1"><CheckCircle size={11} /> Firmados ({firmadas.length})</p>
                          <div className="space-y-1.5">
                            {firmadas.map(f => {
                              const empF = empleados.find(e => e.id === f.empleado_id)
                              return (
                                <div key={f.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-lg px-3 py-2">
                                  <div>
                                    <p className="text-xs font-medium text-gray-800">{empF?.nombre ?? f.nombre_firmante ?? '—'}</p>
                                    <p className="text-[10px] text-gray-400">{fmtFechaHora(f.fecha_firma)}</p>
                                  </div>
                                  {f.firma_data && (
                                    <button onClick={() => setVerFirma(f)} className="p-1.5 text-gray-400 hover:text-[#F5B731] transition-colors rounded"><Eye size={14} /></button>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                      {faltanFirmar.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-amber-600 mb-2 flex items-center gap-1"><Clock size={11} /> Pendientes ({faltanFirmar.length})</p>
                          <div className="flex flex-wrap gap-1.5">
                            {faltanFirmar.map(e => <span key={e.id} className="text-xs bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded-full">{e.nombre}</span>)}
                          </div>
                        </div>
                      )}
                      {d.empleado_id !== null && firmadas.length === 0 && (
                        <p className="text-xs text-gray-400 italic col-span-2">El empleado aún no ha firmado</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {verFirma && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">Firma de {verFirma.nombre_firmante}</h2>
              <button onClick={() => setVerFirma(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-gray-400">Firmado el {fmtFechaHora(verFirma.fecha_firma)}</p>
              {verFirma.firma_data?.startsWith('data:image') ? (
                <img src={verFirma.firma_data} alt="Firma" className="w-full border border-gray-200 rounded-lg bg-gray-50" />
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                  <p className="text-sm text-gray-700 italic">"{verFirma.firma_data}"</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-sm font-semibold text-gray-800">Nuevo documento para firmar</h2>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">Plantilla rápida</label>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(PLANTILLAS).map(([key, p]) => (
                    <button key={key} type="button" onClick={() => aplicarPlantilla(key)} className="px-3 py-1.5 text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-[#F5B731] hover:text-[#1A1A1A] rounded-lg transition-colors">{p.tipo}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Tipo</label>
                  <select className={inputCls} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                    {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Fecha límite (opcional)</label>
                  <input type="date" className={inputCls} value={form.fecha_limite} onChange={e => setForm(f => ({ ...f, fecha_limite: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Título *</label>
                <input className={inputCls} value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ej: Acuerdo de confidencialidad 2026" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Texto del documento *</label>
                <textarea className={`${inputCls} min-h-[180px] resize-y`} value={form.texto} onChange={e => setForm(f => ({ ...f, texto: e.target.value }))} placeholder="Texto completo del documento..." />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Destinatario</label>
                <select className={inputCls} value={form.empleado_id} onChange={e => setForm(f => ({ ...f, empleado_id: e.target.value }))}>
                  <option value="todos">Todos los empleados</option>
                  {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </div>
              {error && <p className="text-xs text-rose-500">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 flex-shrink-0">
              <button onClick={() => setModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
              <button onClick={guardar} disabled={guardando} className="px-4 py-2 text-sm font-semibold bg-[#F5B731] text-[#1A1A1A] rounded-lg hover:bg-[#e0a820] disabled:opacity-50">
                {guardando ? 'Creando...' : 'Crear documento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// ── TAB: CONTRATOS ───────────────────────────
// ─────────────────────────────────────────────

function ContratosTab() {
  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Contratos</h1>
        <p className="text-sm text-gray-400 mt-0.5">Gestión de contratos laborales del equipo</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <FileText size={36} className="mx-auto text-gray-200 mb-3" />
        <p className="text-sm font-semibold text-gray-500">Sección en preparación</p>
        <p className="text-xs text-gray-400 mt-1.5 max-w-xs mx-auto">
          Próximamente podrás subir y gestionar los contratos de cada empleado directamente desde aquí.
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// ── SHELL — Tab bar ───────────────────────────
// ─────────────────────────────────────────────

type TabId = 'firmas' | 'contratos'

const TABS: { id: TabId; label: string; Icono: React.ElementType }[] = [
  { id: 'firmas',    label: 'Firmas digitales', Icono: FileSignature },
  { id: 'contratos', label: 'Contratos',         Icono: FileText },
]

function DocumentosContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [tab, setTab] = useState<TabId>(() => {
    const p = searchParams.get('tab') as TabId
    return TABS.some(t => t.id === p) ? p : 'firmas'
  })

  function cambiarTab(id: TabId) {
    setTab(id)
    router.replace(`/rrhh/documentos?tab=${id}`, { scroll: false })
  }

  return (
    <div>
      <div className="border-b border-gray-200 bg-white flex sticky top-0 z-10">
        {TABS.map(({ id, label, Icono }) => (
          <button
            key={id}
            onClick={() => cambiarTab(id)}
            className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${
              tab === id ? 'border-[#F5B731] text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icono size={14} />
            {label}
          </button>
        ))}
      </div>
      {tab === 'firmas'    && <FirmasTab />}
      {tab === 'contratos' && <ContratosTab />}
    </div>
  )
}

export default function PaginaDocumentos() {
  return (
    <Suspense>
      <DocumentosContent />
    </Suspense>
  )
}

'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { Empleado, Local } from '@/lib/supabase'
import {
  Plus, RefreshCw, Pencil, Trash2, X, Search, Users, Umbrella,
  Check, Ban, KeyRound, Mail, ShieldCheck, ShieldOff, Copy, ExternalLink,
  Eye, EyeOff, AlertTriangle,
} from 'lucide-react'

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

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

type TabFicha = 'general' | 'vacaciones' | 'sanciones' | 'fichajes'

type SancionFicha = { id: number; tipo: string; fecha: string; descripcion: string | null }
type VacaFicha    = { id: number; fecha_inicio: string; fecha_fin: string; dias: number; estado: 'pendiente' | 'aprobada' | 'rechazada'; notas: string | null }
type FichajeFicha = { id: number; fecha: string; hora_entrada: string | null; hora_salida: string | null; horas_total: number | null }

const TIPOS_SANCION: Record<string, string> = {
  aviso_verbal: 'Aviso verbal', amonestacion_escrita: 'Amonestación escrita',
  sancion_grave: 'Sanción grave', sancion_muy_grave: 'Sanción muy grave',
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

// ─────────────────────────────────────────────
// Llamadas a la API de admin auth
// ─────────────────────────────────────────────

type AccesoResult =
  | { ok: true; password: string }
  | { ok: true; changed: true }
  | { ok: false; error: string; manual?: boolean }

async function llamarAuthAPI(body: Record<string, string>): Promise<AccesoResult> {
  try {
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, error: data.error ?? 'Error desconocido', manual: data.manual }
    if (data.password) return { ok: true, password: data.password }
    if (data.ok) return { ok: true, changed: true } as { ok: true; changed: true }
    return { ok: false, error: 'Respuesta inesperada' }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

// ─────────────────────────────────────────────
// Componentes auxiliares
// ─────────────────────────────────────────────

function Modal({ titulo, onCerrar, maxW = 'max-w-2xl', children }: {
  titulo: string; onCerrar: () => void; maxW?: string; children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-8 pb-8 overflow-y-auto">
      <div className={`bg-white rounded-xl shadow-xl w-full ${maxW} mx-4 my-auto`}>
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

// Badge de acceso en la lista
function AccesoBadge({ email }: { email: string | null }) {
  if (email) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 whitespace-nowrap">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
        Con acceso
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-500 whitespace-nowrap">
      <ShieldOff size={11} />
      Sin acceso
    </span>
  )
}

// Cuadro de contraseña temporal (se muestra una sola vez)
function CuadroPasswordTemporal({ password, onCerrar }: { password: string; onCerrar: () => void }) {
  const [visible, setVisible] = useState(true)
  const [copiado, setCopiado] = useState(false)

  function copiar() {
    navigator.clipboard.writeText(password).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    })
  }

  return (
    <div className="mt-4 rounded-xl border-2 border-[#F5B731] bg-[#F5B731]/10 p-4">
      <div className="flex items-center gap-2 mb-2">
        <KeyRound size={15} className="text-[#1A1A1A]" />
        <p className="text-xs font-bold text-[#1A1A1A] uppercase tracking-wide">Contraseña temporal</p>
        <span className="ml-auto text-[10px] text-rose-600 font-semibold">Solo visible ahora</span>
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-lg font-mono font-black tracking-widest text-[#1A1A1A] bg-white rounded-lg px-4 py-2 border border-[#F5B731]/40">
          {visible ? password : '••••••••••'}
        </code>
        <button
          onClick={() => setVisible(v => !v)}
          className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
          title={visible ? 'Ocultar' : 'Mostrar'}
        >
          {visible ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
        <button
          onClick={copiar}
          className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
          title="Copiar"
        >
          {copiado ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
        </button>
      </div>
      <p className="text-xs text-gray-600 mt-2">
        Comparte esta contraseña con el empleado. Podrá cambiarla desde su perfil.
      </p>
      <button
        onClick={onCerrar}
        className="mt-3 w-full px-3 py-2 text-xs font-semibold bg-[#1A1A1A] text-white rounded-lg hover:bg-gray-800 transition-colors"
      >
        He anotado la contraseña · Cerrar
      </button>
    </div>
  )
}

// Instrucciones manuales cuando no hay service_role key
function InstruccionesManuales({ email, accion }: { email: string; accion: 'reset' | 'crear' }) {
  return (
    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-2 mb-3">
        <AlertTriangle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs font-semibold text-amber-800">SUPABASE_SERVICE_ROLE_KEY no configurada</p>
      </div>
      <p className="text-xs text-amber-700 mb-3">
        Para gestionar accesos automáticamente, añade <code className="bg-amber-100 px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> a <code className="bg-amber-100 px-1 rounded">.env.local</code>.
      </p>
      <p className="text-xs font-semibold text-amber-800 mb-2">Instrucciones manuales:</p>
      <ol className="text-xs text-amber-700 space-y-1.5 list-decimal list-inside">
        <li>Ve a <strong>Supabase Dashboard → Authentication → Users</strong></li>
        {accion === 'crear' ? (
          <>
            <li>Pulsa <strong>Add user → Create new user</strong></li>
            <li>Email: <code className="bg-amber-100 px-1 rounded">{email}</code> · Auto Confirm: ✓</li>
            <li>Introduce una contraseña temporal y compártela con el empleado</li>
          </>
        ) : (
          <>
            <li>Busca al usuario: <code className="bg-amber-100 px-1 rounded">{email}</code></li>
            <li>Pulsa los <strong>tres puntos (⋯) → Send password recovery</strong></li>
            <li>O pulsa <strong>Edit → Password</strong> para establecer una contraseña directa</li>
          </>
        )}
      </ol>
      <a
        href="https://supabase.com/dashboard"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold text-amber-800 underline underline-offset-2"
      >
        <ExternalLink size={11} /> Abrir Supabase Dashboard
      </a>
    </div>
  )
}

// ─────────────────────────────────────────────
// Sección "Acceso a la app" dentro del modal de edición
// ─────────────────────────────────────────────

function SeccionAcceso({ empleado, emailForm, onEmailChange }: {
  empleado: Empleado | null   // null si es creación
  emailForm: string
  onEmailChange: (v: string) => void
}) {
  const [reseteando, setReseteando]             = useState(false)
  const [tempPassword, setTempPassword]         = useState<string | null>(null)
  const [accesoError, setAccesoError]           = useState('')
  const [accesoManual, setAccesoManual]         = useState(false)
  const [accionManual, setAccionManual]         = useState<'reset' | 'crear'>('reset')

  // Sub-modal cambiar email
  const [modalCambiarEmail, setModalCambiarEmail]   = useState(false)
  const [nuevoEmail, setNuevoEmail]                 = useState('')
  const [cambiandoEmail, setCambiandoEmail]         = useState(false)
  const [emailCambiado, setEmailCambiado]           = useState(false)

  const emailActual = empleado?.email_acceso ?? null
  const tieneAcceso = !!emailActual

  async function resetearContrasena() {
    if (!emailActual) return
    setReseteando(true)
    setTempPassword(null)
    setAccesoError('')
    setAccesoManual(false)
    const res = await llamarAuthAPI({ action: 'reset_password', email: emailActual })
    if (res.ok && 'password' in res) {
      setTempPassword(res.password)
    } else if (!res.ok) {
      if (res.manual) { setAccesoManual(true); setAccionManual('reset') }
      else setAccesoError(res.error)
    }
    setReseteando(false)
  }

  async function cambiarEmail() {
    if (!emailActual || !nuevoEmail.trim()) return
    setCambiandoEmail(true)
    setAccesoError('')
    const res = await llamarAuthAPI({ action: 'change_email', email: emailActual, newEmail: nuevoEmail.trim() })
    if (res.ok) {
      // Actualizar empleado en Supabase
      if (empleado) {
        await supabase.from('empleados').update({ email_acceso: nuevoEmail.trim() }).eq('id', empleado.id)
      }
      onEmailChange(nuevoEmail.trim())
      setEmailCambiado(true)
      setModalCambiarEmail(false)
    } else if (!res.ok) {
      if (res.manual) { setAccesoManual(true); setAccionManual('reset') }
      else setAccesoError(res.error)
    }
    setCambiandoEmail(false)
  }

  // Para nuevos empleados o sin email: solo mostrar el campo email del form
  if (!empleado) return null

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
        <ShieldCheck size={14} className={tieneAcceso ? 'text-emerald-600' : 'text-gray-400'} />
        <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">Acceso a la app</p>
        <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${
          tieneAcceso ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
        }`}>
          {tieneAcceso ? 'Activo' : 'Sin acceso'}
        </span>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Email actual */}
        {tieneAcceso ? (
          <div className="flex items-center gap-3">
            <Mail size={14} className="text-gray-400 flex-shrink-0" />
            <span className="text-sm text-gray-700 flex-1 truncate">{emailActual}</span>
            {emailCambiado && <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1"><Check size={11} /> Actualizado</span>}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Este empleado no tiene acceso a la app.</p>
        )}

        {/* Contraseña temporal resultado */}
        {tempPassword && (
          <CuadroPasswordTemporal password={tempPassword} onCerrar={() => setTempPassword(null)} />
        )}

        {/* Error */}
        {accesoError && (
          <p className="text-xs text-rose-600 flex items-center gap-1.5">
            <AlertTriangle size={12} /> {accesoError}
          </p>
        )}

        {/* Instrucciones manuales */}
        {accesoManual && (
          <InstruccionesManuales email={emailActual ?? emailForm} accion={accionManual} />
        )}

        {/* Botones de acción */}
        {!tempPassword && !accesoManual && (
          <div className="flex items-center gap-2 flex-wrap">
            {tieneAcceso ? (
              <>
                <button
                  onClick={resetearContrasena}
                  disabled={reseteando}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-[#1A1A1A] text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {reseteando ? <RefreshCw size={12} className="animate-spin" /> : <KeyRound size={12} />}
                  {reseteando ? 'Generando...' : 'Resetear contraseña'}
                </button>
                <button
                  onClick={() => { setModalCambiarEmail(true); setNuevoEmail('') }}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Mail size={12} /> Cambiar email
                </button>
              </>
            ) : (
              <p className="text-xs text-gray-400">
                Introduce un email en el campo "Email acceso" y guarda para dar acceso.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Sub-modal cambiar email */}
      {modalCambiarEmail && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-800">Cambiar email de acceso</p>
              <button onClick={() => setModalCambiarEmail(false)} className="text-gray-400 hover:text-gray-600"><X size={15} /></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Email actual</p>
                <p className="text-sm font-medium text-gray-700">{emailActual}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nuevo email *</label>
                <input
                  type="email"
                  className={inputCls}
                  value={nuevoEmail}
                  onChange={e => setNuevoEmail(e.target.value)}
                  placeholder="nuevo@email.com"
                  autoFocus
                />
              </div>
              <p className="text-xs text-amber-600">
                Esto actualizará el email en Supabase Auth y en la ficha del empleado.
              </p>
              {accesoError && <p className="text-xs text-rose-600">{accesoError}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setModalCambiarEmail(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
                <button
                  onClick={cambiarEmail}
                  disabled={cambiandoEmail || !nuevoEmail.trim()}
                  className="px-4 py-2 text-sm font-semibold bg-[#F5B731] text-[#1A1A1A] rounded-lg hover:bg-[#e0a820] transition-colors disabled:opacity-50"
                >
                  {cambiandoEmail ? <span className="flex items-center gap-1.5"><RefreshCw size={13} className="animate-spin" /> Cambiando...</span> : 'Cambiar email'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Modal "Dar acceso" rápido desde la lista
// ─────────────────────────────────────────────

function ModalDarAcceso({ empleado, onCerrar, onExito }: {
  empleado: Empleado
  onCerrar: () => void
  onExito: (email: string) => void
}) {
  const [email, setEmail]                   = useState('')
  const [cargando, setCargando]             = useState(false)
  const [tempPassword, setTempPassword]     = useState<string | null>(null)
  const [error, setError]                   = useState('')
  const [manual, setManual]                 = useState(false)

  async function darAcceso() {
    if (!email.trim()) return
    setCargando(true)
    setError('')
    setManual(false)

    const res = await llamarAuthAPI({ action: 'create_user', email: email.trim() })
    if (res.ok && 'password' in res) {
      // Actualizar email_acceso en empleados
      await supabase.from('empleados').update({ email_acceso: email.trim() }).eq('id', empleado.id)
      setTempPassword(res.password)
      onExito(email.trim())
    } else if (!res.ok) {
      if (res.manual) setManual(true)
      else setError(res.error)
    }
    setCargando(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-800">Dar acceso — {empleado.nombre.split(' ')[0]}</p>
          <button onClick={onCerrar} className="text-gray-400 hover:text-gray-600"><X size={15} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {!tempPassword && !manual ? (
            <>
              <p className="text-sm text-gray-600">Introduce el email que usará este empleado para acceder a la app.</p>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Email de acceso *</label>
                <input
                  type="email"
                  className={inputCls}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="empleado@sofi.com"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && darAcceso()}
                />
              </div>
              {error && <p className="text-xs text-rose-600 flex items-center gap-1.5"><AlertTriangle size={12} />{error}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={onCerrar} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
                <button
                  onClick={darAcceso}
                  disabled={cargando || !email.trim()}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-[#F5B731] text-[#1A1A1A] rounded-lg hover:bg-[#e0a820] transition-colors disabled:opacity-50"
                >
                  {cargando ? <><RefreshCw size={13} className="animate-spin" /> Creando...</> : <><ShieldCheck size={13} /> Dar acceso</>}
                </button>
              </div>
            </>
          ) : manual ? (
            <>
              <InstruccionesManuales email={email} accion="crear" />
              <button onClick={onCerrar} className="w-full px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cerrar</button>
            </>
          ) : (
            <>
              <p className="text-sm text-emerald-700 font-medium flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-600" /> Acceso creado correctamente
              </p>
              <p className="text-xs text-gray-500">Email: <strong>{email}</strong></p>
              <CuadroPasswordTemporal password={tempPassword!} onCerrar={onCerrar} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────

export default function PaginaEquipo() {
  const [empleados, setEmpleados]         = useState<Empleado[]>([])
  const [locales, setLocales]             = useState<Local[]>([])
  const [loading, setLoading]             = useState(true)
  const [busqueda, setBusqueda]           = useState('')
  const [filtroEstado, setFiltroEstado]   = useState<string>('todos')
  const [modalAbierto, setModalAbierto]   = useState(false)
  const [editandoEmp, setEditandoEmp]     = useState<Empleado | null>(null)
  const [form, setForm]                   = useState<FormEmp>(FORM_VACIO)
  const [guardando, setGuardando]         = useState(false)
  const [error, setError]                 = useState('')
  const [modalEliminar, setModalEliminar] = useState<Empleado | null>(null)
  const [errorEliminar, setErrorEliminar] = useState('')
  const [eliminando, setEliminando]       = useState(false)
  const [solicitudes, setSolicitudes]     = useState<SolicitudConEmpleado[]>([])
  const [procesando, setProcesando]       = useState<number | null>(null)
  const [modalDarAcceso, setModalDarAcceso] = useState<Empleado | null>(null)
  const [tabFicha, setTabFicha]           = useState<TabFicha>('general')
  const [fichaLoading, setFichaLoading]   = useState(false)
  const [fichaVacaciones, setFichaVacaciones] = useState<VacaFicha[]>([])
  const [fichaSanciones, setFichaSanciones]   = useState<SancionFicha[]>([])
  const [fichaFichajes, setFichaFichajes]     = useState<FichajeFicha[]>([])

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

  async function cargarFichaData(empId: number) {
    setFichaLoading(true)
    const hace60 = new Date(); hace60.setDate(hace60.getDate() - 60)
    const from60 = hace60.toISOString().split('T')[0]
    const [{ data: vacas }, { data: sancio }, { data: fichs }] = await Promise.all([
      supabase.from('solicitudes_vacaciones').select('id,fecha_inicio,fecha_fin,dias,estado,notas').eq('empleado_id', empId).order('created_at', { ascending: false }),
      supabase.from('sanciones').select('id,tipo,fecha,descripcion').eq('empleado_id', empId).order('fecha', { ascending: false }),
      supabase.from('fichajes').select('id,fecha,hora_entrada,hora_salida,horas_total').eq('empleado_id', empId).gte('fecha', from60).order('fecha', { ascending: false }),
    ])
    setFichaVacaciones((vacas ?? []) as VacaFicha[])
    setFichaSanciones((sancio ?? []) as SancionFicha[])
    setFichaFichajes((fichs ?? []) as FichajeFicha[])
    setFichaLoading(false)
  }

  async function resolverSolicitud(id: number, estado: 'aprobada' | 'rechazada') {
    setProcesando(id)
    await supabase.from('solicitudes_vacaciones').update({ estado }).eq('id', id)
    setProcesando(null)
    cargarSolicitudes()
  }

  async function resolverEnFicha(id: number, estado: 'aprobada' | 'rechazada') {
    await supabase.from('solicitudes_vacaciones').update({ estado }).eq('id', id)
    if (editandoEmp) cargarFichaData(editandoEmp.id)
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
    setEditandoEmp(null)
    setForm(FORM_VACIO)
    setError('')
    setModalAbierto(true)
  }

  function abrirEditar(emp: Empleado) {
    setEditandoEmp(emp)
    setForm({
      nombre: emp.nombre,
      puesto: emp.puesto,
      local_id: emp.local_id ? String(emp.local_id) : '',
      horas_contrato: String(emp.horas_contrato),
      salario_bruto: emp.salario_bruto ? String(emp.salario_bruto) : '',
      coste_empresa_pct: String(emp.coste_empresa_pct),
      fecha_inicio: emp.fecha_inicio ?? '',
      estado: emp.estado,
      iban: emp.iban ?? '',
      nss: emp.nss ?? '',
      email_acceso: emp.email_acceso ?? '',
      notas: emp.notas ?? '',
    })
    setTabFicha('general')
    setError('')
    setModalAbierto(true)
    cargarFichaData(emp.id)
  }

  function cerrarModal() {
    setModalAbierto(false)
    setEditandoEmp(null)
    setForm(FORM_VACIO)
    setError('')
    cargar() // Refrescar por si el acceso cambió
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
    if (editandoEmp !== null) {
      ;({ error: err } = await supabase.from('empleados').update(payload).eq('id', editandoEmp.id))
    } else {
      ;({ error: err } = await supabase.from('empleados').insert(payload))
    }
    if (err) { setError(err.message); setGuardando(false); return }
    setGuardando(false)
    cerrarModal()
  }

  async function eliminar() {
    if (!modalEliminar) return
    setEliminando(true)
    setErrorEliminar('')
    const { error: err } = await supabase.from('empleados').delete().eq('id', modalEliminar.id)
    if (err) {
      setErrorEliminar('No se pudo eliminar: ' + err.message)
      setEliminando(false)
      return
    }
    setEliminando(false)
    setModalEliminar(null)
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
    activos:    empleados.filter((e) => e.estado === 'activo').length,
    bajas:      empleados.filter((e) => e.estado === 'baja').length,
    vacaciones: empleados.filter((e) => e.estado === 'vacaciones').length,
    conAcceso:  empleados.filter((e) => !!e.email_acceso).length,
  }

  return (
    <div className="p-6 max-w-6xl">

      {/* ── Header ─────────────────────────────── */}
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
          <p className="text-sm text-gray-400 mt-0.5">Empleados, datos laborales y accesos a la app</p>
        </div>
        <button
          onClick={abrirCrear}
          className="flex items-center gap-2 px-4 py-2 bg-[#F5B731] text-[#1A1A1A] text-sm font-semibold rounded-lg hover:bg-[#e0a820] transition-colors"
        >
          <Plus size={15} /> Nuevo empleado
        </button>
      </div>

      {/* ── Solicitudes vacaciones pendientes ──── */}
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

      {/* ── Resumen KPIs ─────────────────────────── */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Activos',     value: resumen.activos,    cls: 'text-emerald-600' },
          { label: 'En baja',     value: resumen.bajas,      cls: 'text-rose-600' },
          { label: 'Vacaciones',  value: resumen.vacaciones, cls: 'text-amber-600' },
          { label: 'Con acceso app', value: resumen.conAcceso, cls: 'text-blue-600' },
        ].map((k) => (
          <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${k.cls}`}>{k.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* ── Filtros ──────────────────────────────── */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
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
                filtroEstado === e ? 'bg-[#1A1A1A] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {e === 'todos' ? 'Todos' : ESTADO_CFG[e].label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Lista de empleados ───────────────────── */}
      {filtrados.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <Users size={32} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">
            {busqueda || filtroEstado !== 'todos' ? 'Sin resultados' : 'No hay empleados. Añade el primero.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">{filtrados.length} empleados</span>
            <span className="text-xs text-gray-400">
              {filtrados.filter(e => e.email_acceso).length} con acceso ·{' '}
              {filtrados.filter(e => !e.email_acceso).length} sin acceso
            </span>
          </div>
          <div className="divide-y divide-gray-50">
            {filtrados.map((emp) => {
              const local = locales.find((l) => l.id === emp.local_id)
              const ch = emp.salario_bruto
                ? ((emp.salario_bruto * emp.coste_empresa_pct) / (emp.horas_contrato * 4.33)).toFixed(2)
                : null
              return (
                <div key={emp.id} className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors">
                  <Avatar nombre={emp.nombre} />

                  {/* Info empleado */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900 truncate">{emp.nombre}</p>
                      <span className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${ESTADO_CFG[emp.estado].cls}`}>
                        {ESTADO_CFG[emp.estado].label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {emp.puesto}
                      {local && <span> · {local.nombre}</span>}
                      <span> · {emp.horas_contrato}h/sem</span>
                      {ch && <span> · {ch}€/h</span>}
                    </p>
                  </div>

                  {/* Columna Acceso */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <AccesoBadge email={emp.email_acceso} />
                    {!emp.email_acceso && (
                      <button
                        onClick={() => setModalDarAcceso(emp)}
                        className="flex items-center gap-1 text-xs font-semibold text-[#F5B731] hover:text-[#e0a820] transition-colors whitespace-nowrap"
                        title="Dar acceso a la app"
                      >
                        <Plus size={11} /> Dar acceso
                      </button>
                    )}
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => abrirEditar(emp)}
                      className="p-1.5 text-gray-400 hover:text-[#F5B731] transition-colors rounded"
                      title="Editar"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => { setModalEliminar(emp); setErrorEliminar('') }}
                      className="p-1.5 text-gray-400 hover:text-rose-500 transition-colors rounded"
                      title="Eliminar empleado"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ══ MODAL EDITAR/CREAR EMPLEADO ════════════════════════ */}
      {modalAbierto && (
        <Modal titulo={editandoEmp ? editandoEmp.nombre : 'Nuevo empleado'} onCerrar={cerrarModal}>
          {/* Tab bar — solo al editar */}
          {editandoEmp && (
            <div className="flex border-b border-gray-100 -mx-6 px-6 mb-5 -mt-1">
              {(['general', 'vacaciones', 'sanciones', 'fichajes'] as const).map((t) => {
                const labels: Record<TabFicha, string> = { general: 'General', vacaciones: 'Vacaciones', sanciones: 'Sanciones', fichajes: 'Fichajes' }
                const counts: Record<TabFicha, number | null> = {
                  general: null,
                  vacaciones: fichaVacaciones.filter(v => v.estado === 'pendiente').length || null,
                  sanciones: fichaSanciones.length || null,
                  fichajes: null,
                }
                return (
                  <button
                    key={t}
                    onClick={() => setTabFicha(t)}
                    className={`relative px-4 py-2.5 text-xs font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5 ${
                      tabFicha === t ? 'border-[#F5B731] text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    {labels[t]}
                    {counts[t] !== null && (
                      <span className={`inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold leading-none ${t === 'vacaciones' ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-600'}`}>{counts[t]}</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* ── General ── */}
          {(!editandoEmp || tabFicha === 'general') && (
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
                <select className={inputCls} value={form.puesto} onChange={(e) => setForm((f) => ({ ...f, puesto: e.target.value }))}>
                  {PUESTOS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Campo>
              <Campo label="Local principal">
                <select className={inputCls} value={form.local_id} onChange={(e) => setForm((f) => ({ ...f, local_id: e.target.value }))}>
                  <option value="">— Sin asignar —</option>
                  {locales.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                </select>
              </Campo>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Campo label="Horas/semana">
                <input type="number" className={inputCls} value={form.horas_contrato} onChange={(e) => setForm((f) => ({ ...f, horas_contrato: e.target.value }))} placeholder="40" min="1" max="40" />
              </Campo>
              <Campo label="Salario bruto €/mes">
                <input type="number" className={inputCls} value={form.salario_bruto} onChange={(e) => setForm((f) => ({ ...f, salario_bruto: e.target.value }))} placeholder="1400" min="0" />
              </Campo>
              <Campo label="% Coste empresa">
                <input type="number" className={inputCls} value={form.coste_empresa_pct} onChange={(e) => setForm((f) => ({ ...f, coste_empresa_pct: e.target.value }))} placeholder="1.31" step="0.01" min="1" />
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
                <input type="date" className={inputCls} value={form.fecha_inicio} onChange={(e) => setForm((f) => ({ ...f, fecha_inicio: e.target.value }))} />
              </Campo>
              <Campo label="Estado">
                <select className={inputCls} value={form.estado} onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value as FormEmp['estado'] }))}>
                  <option value="activo">Activo</option>
                  <option value="baja">Baja</option>
                  <option value="vacaciones">Vacaciones</option>
                </select>
              </Campo>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Campo label="IBAN">
                <input className={inputCls} value={form.iban} onChange={(e) => setForm((f) => ({ ...f, iban: e.target.value }))} placeholder="ES00 0000 0000..." />
              </Campo>
              <Campo label="Nº Seguridad Social">
                <input className={inputCls} value={form.nss} onChange={(e) => setForm((f) => ({ ...f, nss: e.target.value }))} placeholder="28/1234567/89" />
              </Campo>
            </div>

            {/* Email acceso (campo del formulario) */}
            <Campo label={editandoEmp ? 'Email acceso (cambiar requiere actualizar arriba)' : 'Email acceso (opcional)'}>
              <input
                type="email"
                className={inputCls}
                value={form.email_acceso}
                onChange={(e) => setForm((f) => ({ ...f, email_acceso: e.target.value }))}
                placeholder="empleado@ejemplo.com"
              />
            </Campo>

            {/* Sección gestión acceso (solo al editar) */}
            <SeccionAcceso
              empleado={editandoEmp}
              emailForm={form.email_acceso}
              onEmailChange={(newEmail) => {
                setForm(f => ({ ...f, email_acceso: newEmail }))
                if (editandoEmp) setEditandoEmp({ ...editandoEmp, email_acceso: newEmail })
              }}
            />

            <Campo label="Notas">
              <textarea className={`${inputCls} resize-none`} rows={2} value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} placeholder="Observaciones..." />
            </Campo>

            {error && <p className="text-xs text-rose-500">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={cerrarModal} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">Cancelar</button>
              <button
                onClick={guardar}
                disabled={guardando}
                className="px-4 py-2 text-sm font-semibold bg-[#F5B731] text-[#1A1A1A] rounded-lg hover:bg-[#e0a820] transition-colors disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : editandoEmp ? 'Guardar cambios' : 'Crear empleado'}
              </button>
            </div>
          </div>
          )}

          {/* ── Vacaciones ── */}
          {editandoEmp && tabFicha === 'vacaciones' && (
            <div>
              {fichaLoading ? (
                <div className="flex items-center justify-center py-8"><RefreshCw size={18} className="animate-spin text-[#F5B731]" /></div>
              ) : fichaVacaciones.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-400">Sin solicitudes de vacaciones</div>
              ) : (
                <div className="space-y-2">
                  {fichaVacaciones.map((v) => (
                    <div key={v.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">
                          {new Date(v.fecha_inicio + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                          {' → '}
                          {new Date(v.fecha_fin + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                        <p className="text-xs text-gray-500">{v.dias} días{v.notas ? ` · ${v.notas}` : ''}</p>
                      </div>
                      {v.estado === 'pendiente' ? (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button onClick={() => resolverEnFicha(v.id, 'aprobada')} className="px-2.5 py-1 bg-emerald-500 text-white text-xs font-semibold rounded-lg hover:bg-emerald-600 transition-colors">Aprobar</button>
                          <button onClick={() => resolverEnFicha(v.id, 'rechazada')} className="px-2.5 py-1 bg-rose-500 text-white text-xs font-semibold rounded-lg hover:bg-rose-600 transition-colors">Rechazar</button>
                        </div>
                      ) : (
                        <span className={`flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${v.estado === 'aprobada' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {v.estado === 'aprobada' ? 'Aprobada' : 'Rechazada'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Sanciones ── */}
          {editandoEmp && tabFicha === 'sanciones' && (
            <div>
              {fichaLoading ? (
                <div className="flex items-center justify-center py-8"><RefreshCw size={18} className="animate-spin text-[#F5B731]" /></div>
              ) : fichaSanciones.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-400">Sin sanciones registradas</div>
              ) : (
                <div className="space-y-2">
                  {fichaSanciones.map((s) => (
                    <div key={s.id} className="p-3 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-gray-800">{TIPOS_SANCION[s.tipo] ?? s.tipo}</span>
                        <span className="text-xs text-gray-400">· {new Date(s.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                      {s.descripcion && <p className="text-xs text-gray-600 leading-relaxed">{s.descripcion}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Fichajes ── */}
          {editandoEmp && tabFicha === 'fichajes' && (
            <div>
              {fichaLoading ? (
                <div className="flex items-center justify-center py-8"><RefreshCw size={18} className="animate-spin text-[#F5B731]" /></div>
              ) : fichaFichajes.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-400">Sin fichajes en los últimos 60 días</div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-gray-200">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-gray-500">Fecha</th>
                        <th className="text-center px-3 py-2 font-medium text-gray-500">Entrada</th>
                        <th className="text-center px-3 py-2 font-medium text-gray-500">Salida</th>
                        <th className="text-center px-3 py-2 font-medium text-gray-500">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {fichaFichajes.map((f) => (
                        <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-3 py-2 text-gray-700">{new Date(f.fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                          <td className="px-3 py-2 text-center font-mono">{f.hora_entrada?.slice(0, 5) ?? '—'}</td>
                          <td className="px-3 py-2 text-center font-mono">
                            {f.hora_salida ? f.hora_salida.slice(0, 5) : <span className="text-emerald-600 font-semibold">•</span>}
                          </td>
                          <td className="px-3 py-2 text-center font-semibold text-gray-800">{f.horas_total != null ? `${f.horas_total}h` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}

      {/* ══ MODAL CONFIRMAR ELIMINAR ═══════════════════════════ */}
      {modalEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-800">Eliminar empleado</p>
              <button onClick={() => setModalEliminar(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div className="px-5 py-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                  <Trash2 size={18} className="text-rose-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">¿Eliminar a {modalEliminar.nombre}?</p>
                  <p className="text-xs text-gray-500 mt-0.5">Esta acción no se puede deshacer.</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                Se eliminarán todos los datos asociados: turnos, fichajes, solicitudes de vacaciones y registros de firma. Esta operación es permanente.
              </p>
              {errorEliminar && (
                <p className="text-xs text-rose-600 mb-3 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                  {errorEliminar}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setModalEliminar(null)}
                  disabled={eliminando}
                  className="flex-1 py-2.5 text-sm font-medium border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={eliminar}
                  disabled={eliminando}
                  className="flex-1 py-2.5 text-sm font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {eliminando ? <><RefreshCw size={13} className="animate-spin" /> Eliminando...</> : <><Trash2 size={13} /> Eliminar</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL DAR ACCESO RÁPIDO ════════════════════════════ */}
      {modalDarAcceso && (
        <ModalDarAcceso
          empleado={modalDarAcceso}
          onCerrar={() => { setModalDarAcceso(null); cargar() }}
          onExito={() => cargar()}
        />
      )}
    </div>
  )
}

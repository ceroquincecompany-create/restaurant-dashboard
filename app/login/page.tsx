'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabaseAuth } from '@/lib/supabase-browser'
import { supabase } from '@/lib/supabase'
import { ShieldAlert, ArrowLeft, CheckCircle } from 'lucide-react'

const inputCls = 'w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5B731] focus:border-transparent'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const ipRestringida = searchParams.get('error') === 'ip_restringida'

  const [vista, setVista] = useState<'login' | 'recuperar'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailRecuperar, setEmailRecuperar] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailEnviado, setEmailEnviado] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error: authError } = await supabaseAuth.auth.signInWithPassword({ email, password })

    if (authError || !data.user) {
      setError('Email o contraseña incorrectos')
      setLoading(false)
      return
    }

    const { data: emp } = await supabase
      .from('empleados')
      .select('rol')
      .eq('email_acceso', data.user.email ?? '')
      .single()

    const rol = emp?.rol ?? 'admin'

    document.cookie = `user_rol=${rol}; path=/; max-age=2592000; SameSite=Lax`

    router.push(rol === 'empleado' ? '/empleado/inicio' : '/')
  }

  async function handleRecuperar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: recErr } = await supabaseAuth.auth.resetPasswordForEmail(emailRecuperar.trim(), {
      redirectTo: `${window.location.origin}/login`,
    })

    if (recErr) {
      setError(recErr.message)
    } else {
      setEmailEnviado(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src="/favicon.png" alt="SOFI" className="h-20 w-20 rounded-2xl object-contain bg-white p-1.5 mb-4" />
          <h1 className="text-2xl font-bold text-white tracking-wide">SOFI</h1>
          <p className="text-sm text-white/40 mt-1">Panel de gestión</p>
        </div>

        {/* Alerta IP */}
        {ipRestringida && (
          <div className="mb-5 flex items-start gap-3 bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3">
            <ShieldAlert size={18} className="text-rose-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-rose-400">Acceso restringido</p>
              <p className="text-xs text-rose-400/80 mt-0.5">Acceso restringido a dispositivo autorizado</p>
            </div>
          </div>
        )}

        {/* ── Vista: Login ─────────────────────────────── */}
        {vista === 'login' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                autoComplete="email"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className={inputCls}
              />
            </div>

            {error && <p className="text-xs text-rose-400 text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#F5B731] text-[#1A1A1A] font-bold text-sm rounded-xl hover:bg-[#e0a820] transition-colors disabled:opacity-60 mt-2"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>

            <button
              type="button"
              onClick={() => { setVista('recuperar'); setError(''); setEmailRecuperar(email) }}
              className="w-full text-center text-xs text-white/30 hover:text-white/60 transition-colors pt-1 pb-0.5"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </form>
        )}

        {/* ── Vista: Recuperar contraseña ───────────────── */}
        {vista === 'recuperar' && (
          <div>
            {!emailEnviado ? (
              <form onSubmit={handleRecuperar} className="space-y-4">
                <div className="mb-2">
                  <p className="text-sm font-semibold text-white mb-1">Recuperar contraseña</p>
                  <p className="text-xs text-white/40">Recibirás un email con un enlace para establecer una nueva contraseña.</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={emailRecuperar}
                    onChange={(e) => setEmailRecuperar(e.target.value)}
                    placeholder="tu@email.com"
                    required
                    autoFocus
                    className={inputCls}
                  />
                </div>

                {error && <p className="text-xs text-rose-400 text-center">{error}</p>}

                <button
                  type="submit"
                  disabled={loading || !emailRecuperar.trim()}
                  className="w-full py-3 bg-[#F5B731] text-[#1A1A1A] font-bold text-sm rounded-xl hover:bg-[#e0a820] transition-colors disabled:opacity-60"
                >
                  {loading ? 'Enviando...' : 'Enviar email de recuperación'}
                </button>

                <button
                  type="button"
                  onClick={() => { setVista('login'); setError('') }}
                  className="w-full flex items-center justify-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors pt-1"
                >
                  <ArrowLeft size={12} /> Volver al inicio de sesión
                </button>
              </form>
            ) : (
              <div className="text-center space-y-4">
                <CheckCircle size={48} className="mx-auto text-[#F5B731]" />
                <div>
                  <p className="text-sm font-semibold text-white">Email enviado</p>
                  <p className="text-xs text-white/40 mt-1.5">
                    Revisa tu bandeja de entrada en <strong className="text-white/60">{emailRecuperar}</strong>.<br />
                    El enlace caduca en 1 hora.
                  </p>
                </div>
                <button
                  onClick={() => { setVista('login'); setEmailEnviado(false); setError('') }}
                  className="w-full flex items-center justify-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors pt-2"
                >
                  <ArrowLeft size={12} /> Volver al inicio de sesión
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

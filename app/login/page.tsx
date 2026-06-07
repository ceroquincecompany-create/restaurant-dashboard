'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabaseAuth } from '@/lib/supabase-browser'
import { supabase } from '@/lib/supabase'
import { ShieldAlert } from 'lucide-react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const ipRestringida = searchParams.get('error') === 'ip_restringida'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.jpg" alt="SOFI" className="h-20 w-20 rounded-2xl object-contain bg-white p-1.5 mb-4" />
          <h1 className="text-2xl font-bold text-white tracking-wide">SOFI</h1>
          <p className="text-sm text-white/40 mt-1">Panel de gestión</p>
        </div>

        {ipRestringida && (
          <div className="mb-5 flex items-start gap-3 bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3">
            <ShieldAlert size={18} className="text-rose-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-rose-400">Acceso restringido</p>
              <p className="text-xs text-rose-400/80 mt-0.5">Acceso restringido a dispositivo autorizado</p>
            </div>
          </div>
        )}

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
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5B731] focus:border-transparent"
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
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5B731] focus:border-transparent"
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
        </form>
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

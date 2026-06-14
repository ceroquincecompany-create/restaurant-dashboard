'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { Home, CalendarDays, Clock, Umbrella, Package, Wrench, ShoppingCart, LogOut, X } from 'lucide-react'
import { supabaseAuth } from '@/lib/supabase-browser'

const navMovil = [
  { href: '/empleado/inicio',  icono: Home,          label: 'Inicio' },
  { href: '/empleado/ops',     icono: Wrench,        label: 'Ops' },
  { href: '/empleado/pedidos', icono: ShoppingCart,  label: 'Compras' },
  { href: '/empleado/horario', icono: CalendarDays,  label: 'Horario' },
]

export default function EmpleadoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [modalLogout, setModalLogout] = useState(false)

  async function cerrarSesion() {
    await supabaseAuth.auth.signOut()
    document.cookie = 'user_rol=; path=/; max-age=0'
    router.push('/login')
  }

  return (
    <div className="flex min-h-screen flex-col">

      {/* ── Header fijo superior ─────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 h-12 bg-[#1A1A1A] flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <img src="/favicon.png" alt="SOFI" className="h-7 w-7 rounded-md object-contain bg-white p-0.5" />
          <span className="text-sm font-bold text-white tracking-wide">SOFI</span>
        </div>
        <button
          onClick={() => setModalLogout(true)}
          className="flex items-center gap-1.5 text-white/40 hover:text-white transition-colors py-1.5 px-2 rounded-lg hover:bg-white/10"
          aria-label="Cerrar sesión"
        >
          <LogOut size={17} />
        </button>
      </header>

      {/* ── Contenido principal ──────────────────────────── */}
      <main className="flex-1 min-w-0 min-h-screen bg-gray-50 pt-12 pb-20 overflow-x-hidden">
        {children}
      </main>

      {/* ── Bottom navigation ────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
        <div className="flex items-stretch justify-around h-16">
          {navMovil.map(({ href, icono: Icono, label }) => {
            const activo = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center justify-center gap-1 flex-1 min-h-[44px] transition-colors ${
                  activo ? 'text-[#F5B731]' : 'text-gray-400 active:text-gray-600'
                }`}
              >
                <Icono size={22} strokeWidth={activo ? 2.5 : 1.8} />
                <span className={`text-[10px] font-semibold leading-none ${activo ? 'text-[#F5B731]' : 'text-gray-400'}`}>
                  {label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* ── Modal confirmación cerrar sesión ─────────────── */}
      {modalLogout && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <p className="text-sm font-bold text-gray-900">¿Cerrar sesión?</p>
              <button onClick={() => setModalLogout(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-gray-500 mb-5">Se cerrará tu sesión y tendrás que volver a iniciar sesión con tu email y contraseña.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setModalLogout(false)}
                  className="flex-1 py-2.5 text-sm font-semibold border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={cerrarSesion}
                  className="flex-1 py-2.5 text-sm font-bold bg-[#1A1A1A] text-white rounded-xl hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                >
                  <LogOut size={14} /> Cerrar sesión
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

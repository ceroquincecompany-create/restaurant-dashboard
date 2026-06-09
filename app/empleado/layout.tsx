'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, CalendarDays, Clock, Umbrella, Package, LogOut, Wrench, ShoppingCart } from 'lucide-react'
import { supabaseAuth } from '@/lib/supabase-browser'
import { useEmpleadoActual } from '@/lib/useEmpleado'

const navCompleto = [
  { href: '/empleado/inicio',      icono: Home,          label: 'Inicio' },
  { href: '/empleado/horario',     icono: CalendarDays,   label: 'Horario' },
  { href: '/empleado/fichaje',     icono: Clock,          label: 'Fichaje' },
  { href: '/empleado/operaciones', icono: Wrench,         label: 'Operaciones' },
  { href: '/empleado/pedidos',     icono: ShoppingCart,   label: 'Pedidos' },
  { href: '/empleado/vacaciones',  icono: Umbrella,       label: 'Vacaciones' },
  { href: '/empleado/inventario',  icono: Package,        label: 'Inventario' },
]

// Los 5 más usados en la bottom nav móvil
const navMovil = [
  { href: '/empleado/inicio',      icono: Home,          label: 'Inicio' },
  { href: '/empleado/fichaje',     icono: Clock,         label: 'Fichaje' },
  { href: '/empleado/operaciones', icono: Wrench,        label: 'Ops' },
  { href: '/empleado/inventario',  icono: Package,       label: 'Inventario' },
  { href: '/empleado/horario',     icono: CalendarDays,  label: 'Horario' },
]

export default function EmpleadoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { empleado } = useEmpleadoActual()

  async function cerrarSesion() {
    await supabaseAuth.auth.signOut()
    document.cookie = 'user_rol=; path=/; max-age=0'
    router.push('/login')
  }

  return (
    <div className="flex min-h-screen">

      {/* ── Sidebar desktop (md+) ─────────────────────────── */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-56 bg-[#1A1A1A] flex-col z-40">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <img src="/logo.jpg" alt="SOFI" className="h-10 w-10 rounded-lg object-contain bg-white p-0.5" />
            <div>
              <p className="text-sm font-bold text-white tracking-wide">SOFI</p>
              <p className="text-xs text-white/40 truncate max-w-[90px]">
                {empleado ? empleado.nombre.split(' ')[0] : 'Empleado'}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navCompleto.map(({ href, icono: Icono, label }) => {
            const activo = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activo ? 'bg-[#F5B731] text-[#1A1A1A]' : 'text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icono size={17} />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="px-3 py-3 border-t border-white/10">
          {empleado && (
            <p className="text-xs text-white/30 px-2 pb-1 truncate">{empleado.nombre}</p>
          )}
          <button
            onClick={cerrarSesion}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/40 hover:bg-white/10 hover:text-white transition-colors"
          >
            <LogOut size={15} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Contenido principal ──────────────────────────── */}
      <main className="flex-1 min-w-0 md:ml-56 min-h-screen bg-gray-50 pb-20 md:pb-0 overflow-x-hidden">
        {children}
      </main>

      {/* ── Bottom navigation móvil (<md) ────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
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

    </div>
  )
}

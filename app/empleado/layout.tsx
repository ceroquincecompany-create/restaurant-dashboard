'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, CalendarDays, Clock, Umbrella, Package, LogOut, Wrench, ShoppingCart } from 'lucide-react'
import { supabaseAuth } from '@/lib/supabase-browser'
import { useEmpleadoActual } from '@/lib/useEmpleado'

const navCompleto = [
  { href: '/empleado/inicio',      icono: Home,          label: 'Inicio' },
  { href: '/empleado/ops',         icono: Wrench,        label: 'Operaciones' },
  { href: '/empleado/pedidos',     icono: ShoppingCart,  label: 'Compras' },
  { href: '/empleado/horario',     icono: CalendarDays,  label: 'Horario' },
  { href: '/empleado/vacaciones',  icono: Umbrella,      label: 'Vacaciones' },
  { href: '/empleado/inventario',  icono: Package,       label: 'Inventario' },
  { href: '/empleado/fichaje',     icono: Clock,         label: 'Fichaje' },
]

// 4 secciones en el bottom nav móvil — fichaje e inventario quedan en Inicio/Ops
const navMovil = [
  { href: '/empleado/inicio',  icono: Home,          label: 'Inicio' },
  { href: '/empleado/ops',     icono: Wrench,        label: 'Ops' },
  { href: '/empleado/pedidos', icono: ShoppingCart,  label: 'Compras' },
  { href: '/empleado/horario', icono: CalendarDays,  label: 'Horario' },
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

      {/* ── Contenido principal ──────────────────────────── */}
      <main className="flex-1 min-w-0 min-h-screen bg-gray-50 pb-20 overflow-x-hidden">
        {children}
      </main>

      {/* ── Bottom navigation — siempre visible ──────────── */}
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

    </div>
  )
}

'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, CalendarDays, Clock, Umbrella, Package, LogOut } from 'lucide-react'
import { supabaseAuth } from '@/lib/supabase-browser'
import { useEmpleadoActual } from '@/lib/useEmpleado'

const nav = [
  { href: '/empleado/inicio',      icono: Home,        label: 'Inicio' },
  { href: '/empleado/horario',     icono: CalendarDays, label: 'Mi Horario' },
  { href: '/empleado/fichaje',     icono: Clock,        label: 'Fichaje' },
  { href: '/empleado/vacaciones',  icono: Umbrella,     label: 'Vacaciones' },
  { href: '/empleado/inventario',  icono: Package,      label: 'Inventario' },
]

export default function EmpleadoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { empleado } = useEmpleadoActual()

  async function cerrarSesion() {
    await supabaseAuth.auth.signOut()
    document.cookie = 'user_rol=; path=/; max-age=0'
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="flex">
      <aside className="fixed left-0 top-0 h-screen w-56 bg-[#1A1A1A] flex flex-col">
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

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {nav.map(({ href, icono: Icono, label }) => {
            const activo = pathname === href
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

      <main className="flex-1 ml-56 min-h-screen bg-gray-50">
        {children}
      </main>
    </div>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Store, BarChart3, UtensilsCrossed, ClipboardList } from 'lucide-react'

const nav = [
  { href: '/', icono: LayoutDashboard, label: 'Dashboard' },
  { href: '/locales', icono: Store, label: 'Locales' },
  { href: '/informes', icono: BarChart3, label: 'Informes' },
  { href: '/escandallos', icono: ClipboardList, label: 'Escandallos' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-white border-r border-gray-200 flex flex-col">
      <div className="px-5 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-indigo-600 rounded-lg">
            <UtensilsCrossed size={18} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">RestaurantPro</p>
            <p className="text-xs text-gray-400">Panel de gestión</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(({ href, icono: Icono, label }) => {
          const activo = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activo
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icono size={17} />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="px-5 py-4 border-t border-gray-100">
        <p className="text-xs text-gray-400">3 locales activos</p>
      </div>
    </aside>
  )
}

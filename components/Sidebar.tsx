'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, Store, BarChart3, ClipboardList,
  TrendingUp, ChevronDown, FileText, PlusSquare, Target, Heart,
  Package, BookOpen, Layers, Truck,
} from 'lucide-react'

const navPrincipal = [
  { href: '/', icono: LayoutDashboard, label: 'Dashboard' },
  { href: '/locales', icono: Store, label: 'Locales' },
  { href: '/informes', icono: BarChart3, label: 'Informes' },
  { href: '/escandallos', icono: ClipboardList, label: 'Escandallos' },
]

const productoItems = [
  { href: '/producto/escandallos', icono: BookOpen, label: 'Escandallos' },
  { href: '/producto/ingredientes', icono: Layers, label: 'Ingredientes' },
  { href: '/producto/proveedores', icono: Truck, label: 'Proveedores' },
]

const finanzasItems = [
  { href: '/finanzas/pl', icono: FileText, label: 'P&L' },
  { href: '/finanzas/entrada', icono: PlusSquare, label: 'Entrada de Datos' },
  { href: '/finanzas/presupuesto', icono: Target, label: 'Presupuesto' },
  { href: '/finanzas/salud', icono: Heart, label: 'Salud Financiera' },
]

function SeccionColapsable({
  icono: Icono,
  label,
  items,
  prefijo,
}: {
  icono: React.ElementType
  label: string
  items: { href: string; icono: React.ElementType; label: string }[]
  prefijo: string
}) {
  const pathname = usePathname()
  const activo = pathname.startsWith(prefijo)
  const [abierto, setAbierto] = useState(activo)

  useEffect(() => { if (activo) setAbierto(true) }, [activo])

  return (
    <div>
      <button
        onClick={() => setAbierto((o) => !o)}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          activo ? 'bg-[#F5B731] text-[#1A1A1A]' : 'text-white/60 hover:bg-white/10 hover:text-white'
        }`}
      >
        <span className="flex items-center gap-3">
          <Icono size={17} />
          {label}
        </span>
        <ChevronDown
          size={13}
          className={`transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`}
        />
      </button>

      {abierto && (
        <div className="ml-6 mt-1 space-y-0.5 border-l border-white/10 pl-3">
          {items.map(({ href, icono: ItemIcono, label: itemLabel }) => {
            const itemActivo = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                  itemActivo ? 'text-[#F5B731]' : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
              >
                <ItemIcono size={13} />
                {itemLabel}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-[#1A1A1A] flex flex-col">
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <img src="/logo.jpg" alt="SOFI" className="h-10 w-10 rounded-lg object-contain bg-white p-0.5" />
          <div>
            <p className="text-sm font-bold text-white tracking-wide">SOFI</p>
            <p className="text-xs text-white/40">Panel de gestión</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navPrincipal.map(({ href, icono: Icono, label }) => {
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

        <SeccionColapsable
          icono={Package}
          label="Producto"
          items={productoItems}
          prefijo="/producto"
        />

        <SeccionColapsable
          icono={TrendingUp}
          label="Finanzas"
          items={finanzasItems}
          prefijo="/finanzas"
        />
      </nav>

      <div className="px-5 py-4 border-t border-white/10">
        <p className="text-xs text-white/30">SOFI Pinomonotano</p>
      </div>
    </aside>
  )
}

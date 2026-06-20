'use client'

import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Cierra el drawer en cada cambio de ruta
  useEffect(() => { setSidebarOpen(false) }, [pathname])

  const isAdmin = pathname !== '/login'
    && !pathname.startsWith('/empleado')
    && !pathname.startsWith('/trabajo')

  if (!isAdmin) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen">

      {/* ── Header móvil (solo <768px) ──────────────────── */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-30 h-12 bg-[#1A1A1A] flex items-center gap-3 px-4">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Abrir menú"
        >
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2">
          <img src="/favicon.png" alt="SOFI" className="h-7 w-7 rounded-md object-contain bg-white p-0.5" />
          <span className="text-sm font-bold text-white tracking-wide">SOFI</span>
        </div>
      </header>

      {/* ── Backdrop oscuro (móvil, sidebar abierto) ────── */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────── */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* ── Contenido principal ─────────────────────────── */}
      <main className="flex-1 min-w-0 min-h-screen ml-0 md:ml-60 pt-12 md:pt-0">
        {children}
      </main>

    </div>
  )
}

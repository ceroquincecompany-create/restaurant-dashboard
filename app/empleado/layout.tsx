'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Home, CalendarDays, Wrench, ShoppingCart, LogOut, X, MessagesSquare } from 'lucide-react'
import { supabaseAuth } from '@/lib/supabase-browser'
import { supabase } from '@/lib/supabase'
import { useEmpleadoActual } from '@/lib/useEmpleado'

export default function EmpleadoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { empleado } = useEmpleadoActual()
  const [modalLogout, setModalLogout] = useState(false)
  const [anunciosSinLeer, setAnunciosSinLeer] = useState(0)

  useEffect(() => {
    if (!empleado?.id) return
    const empId = empleado.id

    async function contarPendientes() {
      // Anuncios sin leer
      const { data: vistos } = await supabase
        .from('anuncios_vistos')
        .select('anuncio_id')
        .eq('empleado_id', empId)
      const vistosIds = (vistos ?? []).map((v: any) => v.anuncio_id as number)
      let qAnu = supabase.from('anuncios').select('id', { count: 'exact', head: true })
      if (vistosIds.length > 0) qAnu = qAnu.not('id', 'in', `(${vistosIds.join(',')})`)
      const { count: noLeidos } = await qAnu

      // Firmas pendientes (docs propios + todos, menos los ya firmados)
      const [{ data: dDirect }, { data: dTodos }, { data: firmadas }] = await Promise.all([
        supabase.from('documentos_firma').select('id').eq('empleado_id', empId),
        supabase.from('documentos_firma').select('id').is('empleado_id', null),
        supabase.from('firmas').select('documento_id').eq('empleado_id', empId).eq('firmado', true),
      ])
      const allDocIds = [...(dDirect ?? []), ...(dTodos ?? [])].map((d: any) => d.id as number)
      const firmadasIds = new Set((firmadas ?? []).map((f: any) => f.documento_id as number))
      const firmasPendientes = allDocIds.filter(id => !firmadasIds.has(id)).length

      setAnunciosSinLeer((noLeidos ?? 0) + firmasPendientes)
    }

    contarPendientes()
    const interval = setInterval(contarPendientes, 30000)
    return () => clearInterval(interval)
  }, [empleado?.id])

  const navMovil = [
    { href: '/empleado/inicio',     icono: Home,          label: 'Inicio' },
    { href: '/empleado/ops',        icono: Wrench,        label: 'Ops' },
    { href: '/empleado/pedidos',    icono: ShoppingCart,  label: 'Compras' },
    { href: '/empleado/horario',    icono: CalendarDays,  label: 'Horario' },
    { href: '/empleado/comunidad',  icono: MessagesSquare, label: 'Comunidad', badge: anunciosSinLeer },
  ]

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
          {navMovil.map(({ href, icono: Icono, label, badge }) => {
            const activo = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center justify-center gap-1 flex-1 min-h-[44px] transition-colors relative ${
                  activo ? 'text-[#F5B731]' : 'text-gray-400 active:text-gray-600'
                }`}
              >
                <div className="relative">
                  <Icono size={22} strokeWidth={activo ? 2.5 : 1.8} />
                  {(badge ?? 0) > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                      {(badge ?? 0) > 9 ? '9+' : badge}
                    </span>
                  )}
                </div>
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

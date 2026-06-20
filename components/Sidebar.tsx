'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, Store, BarChart3,
  TrendingUp, ChevronDown, FileText, PlusSquare, Target, Heart,
  Package, BookOpen, Layers, Truck, LogOut,
  Users2, Users, CalendarDays, ClipboardList, UserCircle, Wallet,
  ShieldAlert, Trophy, Wrench, Trash2, Thermometer, Sparkles, ClipboardCheck, ShoppingCart,
  ShoppingBag, Archive, ReceiptText, Link2, Briefcase,
  MessagesSquare, Megaphone, NotebookPen, Star, GraduationCap, FileSignature,
} from 'lucide-react'
import { supabaseAuth } from '@/lib/supabase-browser'
import { supabase } from '@/lib/supabase'

const navPrincipal = [
  { href: '/', icono: LayoutDashboard, label: 'Dashboard' },
  { href: '/locales', icono: Store, label: 'Locales' },
  { href: '/informes', icono: BarChart3, label: 'Informes' },
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

const comprasItems = [
  { href: '/compras/pedidos',    icono: ShoppingCart,  label: 'Pedidos Proveedor' },
  { href: '/compras/albaranes',  icono: FileText,      label: 'Albaranes IA' },
  { href: '/compras/entregas',   icono: Truck,         label: 'Entregas' },
  { href: '/compras/inventario', icono: Archive,       label: 'Inventario Local' },
  { href: '/compras/total',      icono: ReceiptText,   label: 'Total Compras' },
  { href: '/compras/vincular',   icono: Link2,         label: 'Vincular Proveedores' },
]

const operacionesItems = [
  { href: '/operaciones/temperaturas', icono: Thermometer, label: 'Temperaturas' },
  { href: '/operaciones/limpiezas', icono: Sparkles, label: 'Limpiezas' },
  { href: '/operaciones/mermas', icono: Trash2, label: 'Mermas' },
  { href: '/operaciones/appcc', icono: ClipboardCheck, label: 'Visita APPCC' },
  { href: '/operaciones/pedidos', icono: ShoppingCart, label: 'Pedidos' },
]

const comunidadItems = [
  { href: '/comunidad/general',         icono: MessagesSquare, label: 'Chat de equipo' },
  { href: '/comunidad/anuncios',        icono: Megaphone,      label: 'Anuncios' },
  { href: '/comunidad/bitacora',        icono: NotebookPen,    label: 'Bitácora' },
  { href: '/comunidad/reconocimientos', icono: Star,           label: 'Reconocimientos' },
  { href: '/comunidad/formacion',       icono: GraduationCap,  label: 'Formación' },
]

const rrhhItems = [
  { href: '/rrhh/equipo', icono: Users, label: 'Gestión Equipo' },
  { href: '/rrhh/turnos', icono: CalendarDays, label: 'Turnos' },
  { href: '/rrhh/fichajes', icono: ClipboardList, label: 'Control Fichajes' },
  { href: '/rrhh/mi-ficha', icono: UserCircle, label: 'Mi Ficha' },
  { href: '/rrhh/costes', icono: Wallet, label: 'Costes Personal' },
  { href: '/rrhh/sanciones', icono: ShieldAlert, label: 'Sanciones' },
  { href: '/rrhh/incentivos', icono: Trophy, label: 'Incentivos' },
  { href: '/rrhh/bolsa-trabajo',  icono: Briefcase,      label: 'Bolsa de Trabajo' },
  { href: '/rrhh/firmas',        icono: FileSignature,  label: 'Firmas digitales' },
]

function SeccionColapsable({
  icono: Icono,
  label,
  items,
  prefijo,
  onClose,
  badgeRojo,
  badgeAmarillo,
  badgeNaranja,
}: {
  icono: React.ElementType
  label: string
  items: { href: string; icono: React.ElementType; label: string }[]
  prefijo: string
  onClose?: () => void
  badgeRojo?: number
  badgeAmarillo?: number
  badgeNaranja?: number
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
          {(badgeRojo ?? 0) > 0 && (
            <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold leading-none">
              {badgeRojo}
            </span>
          )}
          {(badgeAmarillo ?? 0) > 0 && (
            <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-amber-400 text-[#1A1A1A] text-[10px] font-bold leading-none">
              {badgeAmarillo}
            </span>
          )}
          {(badgeNaranja ?? 0) > 0 && (
            <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold leading-none">
              {badgeNaranja}
            </span>
          )}
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
                onClick={onClose}
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

export default function Sidebar({ isOpen = false, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const [bajas, setBajas] = useState(0)
  const [vacaciones, setVacaciones] = useState(0)
  const [sancionesActivas, setSancionesActivas] = useState(0)
  const [vacPendientes, setVacPendientes] = useState(0)

  useEffect(() => {
    supabase
      .from('empleados')
      .select('estado')
      .eq('activo', true)
      .then(({ data }) => {
        if (!data) return
        setBajas(data.filter((e) => e.estado === 'baja').length)
        setVacaciones(data.filter((e) => e.estado === 'vacaciones').length)
      })

    const hoy = new Date()
    const mes = hoy.getMonth() + 1
    const q = Math.ceil(mes / 3)
    const y = hoy.getFullYear()
    const mesI = (q - 1) * 3 + 1
    const mesF = q * 3
    const lastDay = new Date(y, mesF, 0).getDate()
    const inicio = `${y}-${String(mesI).padStart(2, '0')}-01`
    const fin = `${y}-${String(mesF).padStart(2, '0')}-${lastDay}`
    supabase
      .from('sanciones')
      .select('id', { count: 'exact', head: true })
      .eq('activo', true)
      .gte('fecha', inicio)
      .lte('fecha', fin)
      .then(({ count }) => setSancionesActivas(count ?? 0))

    supabase
      .from('solicitudes_vacaciones')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'pendiente')
      .then(({ count }) => setVacPendientes(count ?? 0))
  }, [])

  async function cerrarSesion() {
    await supabaseAuth.auth.signOut()
    document.cookie = 'user_rol=; path=/; max-age=0'
    router.push('/login')
    router.refresh()
  }

  return (
    <aside
      className={`
        fixed left-0 top-0 h-screen w-60 bg-[#1A1A1A] flex flex-col z-50
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}
    >
      {/* Logo — solo visible en desktop (en móvil lo muestra el header de AppShell) */}
      <div className="px-5 py-5 border-b border-white/10 hidden md:flex items-center gap-3">
        <img src="/favicon.png" alt="SOFI" className="h-10 w-10 rounded-lg object-contain bg-white p-0.5" />
        <div>
          <p className="text-sm font-bold text-white tracking-wide">SOFI</p>
          <p className="text-xs text-white/40">Panel de gestión</p>
        </div>
      </div>

      {/* Logo en móvil — dentro del drawer ocupa el mismo espacio que el header */}
      <div className="md:hidden h-12 px-5 flex items-center border-b border-white/10 gap-3">
        <img src="/favicon.png" alt="SOFI" className="h-7 w-7 rounded-md object-contain bg-white p-0.5" />
        <div>
          <p className="text-sm font-bold text-white tracking-wide">SOFI</p>
          <p className="text-xs text-white/40">Panel de gestión</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navPrincipal.map(({ href, icono: Icono, label }) => {
          const activo = pathname === href
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activo ? 'bg-[#F5B731] text-[#1A1A1A]' : 'text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icono size={17} />
              {label}
            </Link>
          )
        })}

        <SeccionColapsable icono={Package}    label="Producto"    items={productoItems}    prefijo="/producto"    onClose={onClose} />
        <SeccionColapsable icono={TrendingUp} label="Finanzas"    items={finanzasItems}    prefijo="/finanzas"    onClose={onClose} />
        <SeccionColapsable icono={ShoppingBag} label="Compras"   items={comprasItems}     prefijo="/compras"     onClose={onClose} />
        <SeccionColapsable icono={Wrench}     label="Operaciones" items={operacionesItems} prefijo="/operaciones" onClose={onClose} />
        <SeccionColapsable
          icono={Users2}
          label="RRHH"
          items={rrhhItems}
          prefijo="/rrhh"
          onClose={onClose}
          badgeRojo={bajas}
          badgeAmarillo={vacaciones}
          badgeNaranja={sancionesActivas + vacPendientes}
        />
        <SeccionColapsable icono={MessagesSquare} label="Comunidad" items={comunidadItems} prefijo="/comunidad" onClose={onClose} />
      </nav>

      <div className="px-3 py-3 border-t border-white/10 space-y-0.5">
        <p className="text-xs text-white/30 px-2 pb-1">SOFI Pinomonotano</p>
        <button
          onClick={cerrarSesion}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/40 hover:bg-white/10 hover:text-white transition-colors"
        >
          <LogOut size={15} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}

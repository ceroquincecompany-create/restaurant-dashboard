'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useEmpleadoActual } from '@/lib/useEmpleado'
import { MessageCircle, Megaphone, NotebookPen, Star, GraduationCap, FileSignature, ChevronRight } from 'lucide-react'

const secciones = [
  {
    href: '/empleado/comunidad/general',
    icono: MessageCircle,
    label: 'Chat de equipo',
    desc: 'Habla con el resto del equipo',
    color: 'bg-blue-50 border-blue-100',
    iconColor: 'text-blue-500',
    badgeKey: null as null | 'anuncios' | 'firmas',
  },
  {
    href: '/empleado/comunidad/anuncios',
    icono: Megaphone,
    label: 'Anuncios',
    desc: 'Comunicados del local',
    color: 'bg-amber-50 border-amber-100',
    iconColor: 'text-amber-500',
    badgeKey: 'anuncios' as const,
  },
  {
    href: '/empleado/comunidad/bitacora',
    icono: NotebookPen,
    label: 'Bitácora de turno',
    desc: 'Notas entre turnos',
    color: 'bg-emerald-50 border-emerald-100',
    iconColor: 'text-emerald-500',
    badgeKey: null as null | 'anuncios' | 'firmas',
  },
  {
    href: '/empleado/comunidad/reconocimientos',
    icono: Star,
    label: 'Reconocimientos',
    desc: 'Logros y felicitaciones del equipo',
    color: 'bg-rose-50 border-rose-100',
    iconColor: 'text-rose-500',
    badgeKey: null as null | 'anuncios' | 'firmas',
  },
  {
    href: '/empleado/comunidad/formacion',
    icono: GraduationCap,
    label: 'Formación y Manuales',
    desc: 'Documentos y protocolos',
    color: 'bg-violet-50 border-violet-100',
    iconColor: 'text-violet-500',
    badgeKey: null as null | 'anuncios' | 'firmas',
  },
  {
    href: '/empleado/firmas',
    icono: FileSignature,
    label: 'Firmas digitales',
    desc: 'Documentos que requieren tu firma',
    color: 'bg-orange-50 border-orange-100',
    iconColor: 'text-orange-500',
    badgeKey: 'firmas' as const,
  },
]

export default function HubComunidad() {
  const { empleado } = useEmpleadoActual()
  const [anunciosSinLeer, setAnunciosSinLeer] = useState(0)
  const [firmasPendientes, setFirmasPendientes] = useState(0)

  useEffect(() => {
    if (!empleado?.id) return
    const empId = empleado.id

    async function cargar() {
      // Anuncios sin leer
      const { data: vistos } = await supabase
        .from('anuncios_vistos')
        .select('anuncio_id')
        .eq('empleado_id', empId)
      const vistosIds = (vistos ?? []).map((v: any) => v.anuncio_id as number)
      let q = supabase.from('anuncios').select('id', { count: 'exact', head: true })
      if (vistosIds.length > 0) q = q.not('id', 'in', `(${vistosIds.join(',')})`)
      const { count: noLeidos } = await q
      setAnunciosSinLeer(noLeidos ?? 0)

      // Firmas pendientes
      const [{ data: dDirect }, { data: dTodos }, { data: firmadas }] = await Promise.all([
        supabase.from('documentos_firma').select('id').eq('empleado_id', empId),
        supabase.from('documentos_firma').select('id').is('empleado_id', null),
        supabase.from('firmas').select('documento_id').eq('empleado_id', empId).eq('firmado', true),
      ])
      const allIds = [...(dDirect ?? []), ...(dTodos ?? [])].map((d: any) => d.id as number)
      const firmadasIds = new Set((firmadas ?? []).map((f: any) => f.documento_id as number))
      setFirmasPendientes(allIds.filter(id => !firmadasIds.has(id)).length)
    }

    cargar()
  }, [empleado?.id])

  function getBadge(key: 'anuncios' | 'firmas' | null): number {
    if (key === 'anuncios') return anunciosSinLeer
    if (key === 'firmas') return firmasPendientes
    return 0
  }

  return (
    <div className="px-4 py-5 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Comunidad</h1>
        <p className="text-sm text-gray-500 mt-1">Tu espacio con el equipo</p>
      </div>

      <div className="space-y-3">
        {secciones.map(s => {
          const Icono = s.icono
          const badge = getBadge(s.badgeKey)
          return (
            <Link
              key={s.href}
              href={s.href}
              className="flex items-center gap-4 p-4 rounded-2xl border bg-white active:scale-[0.98] transition-all shadow-sm"
            >
              <div className={`w-12 h-12 rounded-xl ${s.color} border flex items-center justify-center flex-shrink-0`}>
                <Icono size={22} className={s.iconColor} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{s.label}</span>
                  {badge > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] bg-rose-500 text-white text-[10px] font-bold rounded-full px-1 leading-none">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 truncate">{s.desc}</p>
              </div>
              <ChevronRight size={18} className="text-gray-300 flex-shrink-0" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}

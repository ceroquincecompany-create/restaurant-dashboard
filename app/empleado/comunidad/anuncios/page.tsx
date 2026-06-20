'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useEmpleadoActual } from '@/lib/useEmpleado'
import { ArrowLeft, Megaphone, Pin, CheckCircle, RefreshCw } from 'lucide-react'
import type { Anuncio } from '@/lib/supabase'

type AnuncioConLeido = Anuncio & { leido: boolean }

function fmtFecha(s: string) {
  return new Date(s).toLocaleDateString('es-ES', { day: '2-digit', month: 'long' })
}

export default function AnunciosEmpleado() {
  const { empleado } = useEmpleadoActual()
  const [anuncios, setAnuncios] = useState<AnuncioConLeido[]>([])
  const [loading, setLoading] = useState(true)
  const [marcando, setMarcando] = useState<number | null>(null)

  const cargar = useCallback(async () => {
    if (!empleado?.id) return
    const [{ data: anu }, { data: vistos }] = await Promise.all([
      supabase.from('anuncios').select('*').order('fijado', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('anuncios_vistos').select('anuncio_id').eq('empleado_id', empleado.id),
    ])
    const vistosIds = new Set((vistos ?? []).map((v: any) => v.anuncio_id as number))
    setAnuncios((anu ?? []).map((a: Anuncio) => ({ ...a, leido: vistosIds.has(a.id) })))
    setLoading(false)
  }, [empleado?.id])

  useEffect(() => { if (empleado) cargar() }, [empleado, cargar])

  async function marcarLeido(anuncioId: number) {
    if (!empleado?.id) return
    setMarcando(anuncioId)
    await supabase.from('anuncios_vistos').upsert(
      { anuncio_id: anuncioId, empleado_id: empleado.id },
      { onConflict: 'anuncio_id,empleado_id' }
    )
    setAnuncios(prev => prev.map(a => a.id === anuncioId ? { ...a, leido: true } : a))
    setMarcando(null)
  }

  const sinLeer = anuncios.filter(a => !a.leido).length

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><RefreshCw className="animate-spin text-[#F5B731]" size={22} /></div>
  }

  return (
    <div className="px-4 py-5 max-w-2xl">
      <div className="flex items-center gap-3 mb-5">
        <Link href="/empleado/comunidad" className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Anuncios</h1>
          {sinLeer > 0 && (
            <p className="text-sm text-rose-500 font-medium">{sinLeer} sin leer</p>
          )}
        </div>
      </div>

      {anuncios.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Megaphone size={36} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">No hay anuncios publicados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {anuncios.map(a => (
            <div
              key={a.id}
              className={`rounded-2xl border p-4 transition-all ${
                !a.leido
                  ? 'bg-white border-[#F5B731]/50 shadow-sm'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-start gap-2 mb-2">
                {a.fijado && <Pin size={13} className="text-[#F5B731] flex-shrink-0 mt-0.5" />}
                <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
                  <h3 className={`font-bold text-base leading-snug ${a.leido ? 'text-gray-500' : 'text-gray-900'}`}>
                    {a.titulo}
                  </h3>
                  {!a.leido && (
                    <span className="w-2 h-2 bg-rose-500 rounded-full flex-shrink-0 mt-1.5" />
                  )}
                </div>
              </div>

              <p className={`text-sm leading-relaxed mb-3 ${a.leido ? 'text-gray-400' : 'text-gray-700'}`}>
                {a.texto}
              </p>

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{fmtFecha(a.created_at)}</span>
                {a.leido ? (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                    <CheckCircle size={13} /> Leído
                  </span>
                ) : (
                  <button
                    onClick={() => marcarLeido(a.id)}
                    disabled={marcando === a.id}
                    className="flex items-center gap-1.5 text-xs font-semibold text-[#1A1A1A] bg-[#F5B731] px-3 py-1.5 rounded-full active:scale-95 transition-all disabled:opacity-60"
                  >
                    <CheckCircle size={12} />
                    {marcando === a.id ? 'Marcando...' : 'Marcar como leído'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

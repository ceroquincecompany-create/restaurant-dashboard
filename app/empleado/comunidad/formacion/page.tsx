'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, GraduationCap, FileText, ExternalLink, Search, RefreshCw } from 'lucide-react'
import type { DocumentoFormacion } from '@/lib/supabase'

const CATEGORIAS = ['Manual', 'Formación', 'Protocolo', 'Otro'] as const
type Categoria = typeof CATEGORIAS[number]

const CAT_COLOR: Record<Categoria, string> = {
  'Manual':    'bg-blue-100 text-blue-700',
  'Formación': 'bg-emerald-100 text-emerald-700',
  'Protocolo': 'bg-purple-100 text-purple-700',
  'Otro':      'bg-gray-100 text-gray-600',
}

export default function FormacionEmpleado() {
  const [docs, setDocs] = useState<DocumentoFormacion[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroCat, setFiltroCat] = useState<string>('')

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from('documentos_formacion')
      .select('*')
      .order('categoria')
      .order('titulo')
    setDocs(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const docsFiltrados = useMemo(() => {
    return docs.filter(d => {
      const matchBusq = !busqueda || d.titulo.toLowerCase().includes(busqueda.toLowerCase())
      const matchCat = !filtroCat || d.categoria === filtroCat
      return matchBusq && matchCat
    })
  }, [docs, busqueda, filtroCat])

  const porCategoria = useMemo(() => {
    const mapa: Record<string, DocumentoFormacion[]> = {}
    docsFiltrados.forEach(d => {
      if (!mapa[d.categoria]) mapa[d.categoria] = []
      mapa[d.categoria].push(d)
    })
    return mapa
  }, [docsFiltrados])

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><RefreshCw className="animate-spin text-[#F5B731]" size={22} /></div>
  }

  return (
    <div className="px-4 py-5 max-w-2xl">
      <div className="flex items-center gap-3 mb-5">
        <Link href="/empleado/comunidad" className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Formación y Manuales</h1>
      </div>

      {/* Buscador */}
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar documento..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 text-base border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F5B731] bg-white"
        />
      </div>

      {/* Filtros categoría */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1 -mx-4 px-4">
        <button
          onClick={() => setFiltroCat('')}
          className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${!filtroCat ? 'bg-[#1A1A1A] text-white' : 'bg-gray-100 text-gray-600'}`}
        >
          Todos
        </button>
        {CATEGORIAS.map(cat => (
          <button
            key={cat}
            onClick={() => setFiltroCat(cat === filtroCat ? '' : cat)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${filtroCat === cat ? 'bg-[#1A1A1A] text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {docsFiltrados.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <GraduationCap size={36} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">No hay documentos{busqueda ? ' con esa búsqueda' : ''}</p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(porCategoria).map(([cat, lista]) => (
            <div key={cat}>
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2.5">{cat}</h2>
              <div className="space-y-2.5">
                {lista.map(d => (
                  <div key={d.id} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
                      <FileText size={18} className="text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 leading-snug">{d.titulo}</p>
                      {d.descripcion && <p className="text-sm text-gray-500 mt-0.5 leading-snug">{d.descripcion}</p>}
                      <span className={`inline-block mt-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${CAT_COLOR[d.categoria as Categoria] ?? 'bg-gray-100 text-gray-600'}`}>
                        {d.categoria}
                      </span>
                    </div>
                    <a
                      href={d.archivo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold text-[#1A1A1A] bg-[#F5B731] px-3 py-2 rounded-xl active:scale-95 transition-all"
                    >
                      <ExternalLink size={12} /> Ver
                    </a>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

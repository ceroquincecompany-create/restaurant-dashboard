'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { RefreshCw, CheckCircle2, PlusCircle, AlertTriangle, Link2, Play, RotateCcw } from 'lucide-react'

type Proveedor = { id: number; nombre: string }
type Ingrediente = { id: number; nombre_ingrediente: string; proveedor: string | null; proveedor_id: number | null }

type GrupoProveedor = {
  nombre: string           // nombre texto del proveedor en ingredientes
  ingredientes: Ingrediente[]
  matchId: number | null   // id del proveedor existente que encaja
  matchNombre: string | null
  accion: 'vincular' | 'crear'
}

type Resultado = { nombre: string; accion: 'vinculado' | 'creado'; count: number }

// Normaliza cadena para comparación
function norm(s: string): string {
  return s.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ')
}

// Busca el mejor match en la lista de proveedores
function buscarMatch(nombre: string, proveedores: Proveedor[]): Proveedor | null {
  const n = norm(nombre)
  // 1. Coincidencia exacta
  let m = proveedores.find(p => norm(p.nombre) === n)
  if (m) return m
  // 2. Uno contiene al otro
  m = proveedores.find(p => {
    const pn = norm(p.nombre)
    return pn.includes(n) || n.includes(pn)
  })
  return m ?? null
}

export default function PaginaVincularProveedores() {
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [grupos, setGrupos] = useState<GrupoProveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [ejecutando, setEjecutando] = useState(false)
  const [resultados, setResultados] = useState<Resultado[] | null>(null)
  const [fase, setFase] = useState<'preview' | 'done'>('preview')

  const cargar = useCallback(async () => {
    setLoading(true)
    const [{ data: ings }, { data: provs }] = await Promise.all([
      supabase.from('ingredientes').select('id, nombre_ingrediente, proveedor, proveedor_id').order('proveedor'),
      supabase.from('proveedores').select('id, nombre').order('nombre'),
    ])
    const ingsSinId = (ings ?? []).filter(i => i.proveedor && i.proveedor.trim() !== '' && !i.proveedor_id)
    setIngredientes(ingsSinId)
    setProveedores(provs ?? [])

    // Agrupar por nombre de proveedor
    const mapa: Record<string, GrupoProveedor> = {}
    ingsSinId.forEach(ing => {
      const nombre = ing.proveedor!.trim()
      if (!mapa[nombre]) {
        const match = buscarMatch(nombre, provs ?? [])
        mapa[nombre] = {
          nombre,
          ingredientes: [],
          matchId: match?.id ?? null,
          matchNombre: match?.nombre ?? null,
          accion: match ? 'vincular' : 'crear',
        }
      }
      mapa[nombre].ingredientes.push(ing)
    })
    setGrupos(Object.values(mapa).sort((a, b) => b.ingredientes.length - a.ingredientes.length))
    setFase('preview')
    setResultados(null)
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function ejecutar() {
    setEjecutando(true)
    const resultadosList: Resultado[] = []

    // Procesar grupo a grupo
    let provsActualizados = [...proveedores]

    for (const grupo of grupos) {
      let provId: number | null = grupo.matchId

      // Si no hay match, crear nuevo proveedor
      if (grupo.accion === 'crear' || !provId) {
        const { data: nuevoProv } = await supabase
          .from('proveedores')
          .insert({ nombre: grupo.nombre, activo: true })
          .select('id, nombre')
          .single()
        if (nuevoProv) {
          provId = nuevoProv.id
          provsActualizados = [...provsActualizados, nuevoProv]
        }
        resultadosList.push({ nombre: grupo.nombre, accion: 'creado', count: grupo.ingredientes.length })
      } else {
        resultadosList.push({ nombre: grupo.matchNombre ?? grupo.nombre, accion: 'vinculado', count: grupo.ingredientes.length })
      }

      // Actualizar todos los ingredientes del grupo
      if (provId) {
        const ids = grupo.ingredientes.map(i => i.id)
        await supabase.from('ingredientes').update({ proveedor_id: provId }).in('id', ids)
      }
    }

    setResultados(resultadosList)
    setFase('done')
    setEjecutando(false)
    // Recargar datos para reflejar el nuevo estado
    cargar()
  }

  const totalSinVincular = ingredientes.length
  const totalGrupos = grupos.length
  const gruposVincular = grupos.filter(g => g.accion === 'vincular').length
  const gruposCrear = grupos.filter(g => g.accion === 'crear').length
  const totalIngredientesVinculados = ingredientes.filter(i => i.proveedor_id).length

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <RefreshCw className="animate-spin text-[#F5B731]" size={24} />
    </div>
  )

  // Vista "ya todo está vinculado"
  if (totalSinVincular === 0 && fase !== 'done') {
    return (
      <div className="p-6 max-w-3xl">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Vincular Proveedores</h1>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 text-center mt-8">
          <CheckCircle2 size={40} className="mx-auto text-emerald-500 mb-3" />
          <p className="text-lg font-bold text-emerald-700">¡Todo vinculado correctamente!</p>
          <p className="text-sm text-emerald-600 mt-1">
            Todos los ingredientes con proveedor ya tienen <code className="bg-emerald-100 px-1 rounded">proveedor_id</code> asignado.
          </p>
          <button onClick={cargar} className="mt-4 flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors mx-auto">
            <RotateCcw size={14} /> Recargar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Vincular Proveedores a Ingredientes</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Asigna <code className="bg-gray-100 px-1 rounded text-xs">proveedor_id</code> a los ingredientes que solo tienen el nombre en texto
          </p>
        </div>
        <button onClick={cargar} className="p-2 text-gray-400 hover:text-gray-600 transition-colors" title="Recargar">
          <RotateCcw size={16} />
        </button>
      </div>

      {/* Resultados tras ejecución */}
      {fase === 'done' && resultados && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 size={20} className="text-emerald-600" />
            <p className="text-base font-bold text-emerald-700">Vinculación completada</p>
          </div>
          <div className="space-y-1.5">
            {resultados.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                {r.accion === 'creado'
                  ? <PlusCircle size={14} className="text-blue-500 flex-shrink-0" />
                  : <Link2 size={14} className="text-emerald-500 flex-shrink-0" />
                }
                <span className="text-gray-700">
                  <strong>{r.nombre}</strong>
                  {r.accion === 'creado' ? ' — creado nuevo proveedor' : ' — vinculado al proveedor existente'}
                  {' · '}<span className="text-gray-400">{r.count} ingrediente{r.count !== 1 ? 's' : ''} actualizados</span>
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-emerald-600 mt-3">
            Ya puedes volver a <a href="/compras/pedidos" className="underline font-semibold">Pedidos</a> y los ingredientes aparecerán al seleccionar proveedor.
          </p>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 mb-1">Sin vincular</p>
          <p className={`text-2xl font-bold ${totalSinVincular > 0 ? 'text-amber-600' : 'text-gray-300'}`}>{totalSinVincular}</p>
          <p className="text-xs text-gray-400 mt-0.5">ingredientes</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 mb-1">Grupos únicos</p>
          <p className="text-2xl font-bold text-gray-900">{totalGrupos}</p>
          <p className="text-xs text-gray-400 mt-0.5">nombres distintos</p>
        </div>
        <div className="bg-white rounded-xl border border-emerald-200 p-4">
          <p className="text-xs text-gray-400 mb-1">Match encontrado</p>
          <p className={`text-2xl font-bold ${gruposVincular > 0 ? 'text-emerald-600' : 'text-gray-300'}`}>{gruposVincular}</p>
          <p className="text-xs text-gray-400 mt-0.5">proveedor existente</p>
        </div>
        <div className="bg-white rounded-xl border border-blue-200 p-4">
          <p className="text-xs text-gray-400 mb-1">Nuevos a crear</p>
          <p className={`text-2xl font-bold ${gruposCrear > 0 ? 'text-blue-600' : 'text-gray-300'}`}>{gruposCrear}</p>
          <p className="text-xs text-gray-400 mt-0.5">proveedores nuevos</p>
        </div>
      </div>

      {/* Tabla preview */}
      {grupos.length > 0 && (
        <>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-5">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Preview — qué se va a hacer</p>
              <p className="text-xs text-gray-400">{grupos.length} grupos</p>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Nombre en ingredientes</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Ingredientes</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Acción</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {grupos.map(g => (
                  <tr key={g.nombre} className={`hover:bg-gray-50 transition-colors ${g.accion === 'crear' ? 'bg-blue-50/30' : ''}`}>
                    <td className="px-4 py-3 font-medium text-gray-800">{g.nombre}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs font-semibold bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{g.ingredientes.length}</span>
                    </td>
                    <td className="px-4 py-3">
                      {g.accion === 'vincular' ? (
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                          <Link2 size={12} /> Vincular
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-blue-700">
                          <PlusCircle size={12} /> Crear nuevo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {g.accion === 'vincular' ? (
                        <>→ <span className="font-medium text-gray-700">{g.matchNombre}</span> <span className="text-gray-400">(id: {g.matchId})</span></>
                      ) : (
                        <span className="text-blue-600">Nuevo proveedor: <strong>{g.nombre}</strong></span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Leyenda */}
          <div className="flex gap-4 mb-5 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><Link2 size={12} className="text-emerald-500" /> Vincular al proveedor existente</span>
            <span className="flex items-center gap-1.5"><PlusCircle size={12} className="text-blue-500" /> Crear nuevo proveedor en BD</span>
          </div>

          {/* Advertencia si hay nuevos */}
          {gruposCrear > 0 && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5">
              <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700">
                Se crearán <strong>{gruposCrear} proveedores nuevos</strong>. Revisa la lista antes de continuar. Puedes completar sus datos (teléfono, CIF, etc.) en <a href="/producto/proveedores" className="underline font-semibold">Producto → Proveedores</a> después.
              </p>
            </div>
          )}

          {/* Botón ejecutar */}
          <button
            onClick={ejecutar}
            disabled={ejecutando || grupos.length === 0}
            className="flex items-center gap-3 px-6 py-3.5 bg-[#1A1A1A] text-white text-base font-bold rounded-xl hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-gray-200"
          >
            {ejecutando
              ? <><RefreshCw size={18} className="animate-spin" /> Ejecutando vinculación...</>
              : <><Play size={18} /> Ejecutar vinculación ({totalSinVincular} ingredientes)</>
            }
          </button>
        </>
      )}

      {grupos.length === 0 && fase !== 'done' && (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <CheckCircle2 size={32} className="mx-auto text-emerald-400 mb-3" />
          <p className="text-sm text-gray-500">No hay ingredientes pendientes de vincular</p>
        </div>
      )}
    </div>
  )
}

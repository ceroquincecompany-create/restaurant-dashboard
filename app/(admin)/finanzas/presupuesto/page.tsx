'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { MESES, LABELS, SECCIONES, TODAS_PARTIDAS } from '@/lib/pl-config'
import { Save, RefreshCw, ChevronDown, Check } from 'lucide-react'

type Local = { id: number; nombre: string; activo: boolean }
type Valores = Record<string, number>

function Sel({ value, onChange, children }: { value: string | number; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none pl-3 pr-7 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#F5B731]"
      >
        {children}
      </select>
      <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  )
}

export default function PaginaPresupuesto() {
  const ahora = new Date()
  const [locales, setLocales] = useState<Local[]>([])
  const [localId, setLocalId] = useState<number | null>(null)
  const [mes, setMes] = useState(ahora.getMonth() + 1)
  const [año, setAño] = useState(ahora.getFullYear())
  const [ppto, setPpto] = useState<Valores>({})
  const [real, setReal] = useState<Valores>({})
  const [guardando, setGuardando] = useState(false)
  const [exito, setExito] = useState(false)
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    supabase.from('locales').select('*').eq('activo', true).order('id').then(({ data }) => {
      const ls = data ?? []
      setLocales(ls)
      if (ls[0]) setLocalId(ls[0].id)
    })
  }, [])

  useEffect(() => {
    if (!localId) return
    setCargando(true)
    supabase
      .from('pl_datos')
      .select('*')
      .eq('local_id', localId)
      .eq('año', año)
      .eq('mes', mes)
      .then(({ data }) => {
        const p: Valores = {}
        const r: Valores = {}
        ;(data ?? []).forEach((f) => {
          p[f.partida] = f.valor_presupuesto ?? 0
          r[f.partida] = f.valor_real ?? 0
        })
        setPpto(p)
        setReal(r)
        setCargando(false)
      })
  }, [localId, mes, año])

  async function guardar() {
    if (!localId) return
    setGuardando(true)
    const rows = TODAS_PARTIDAS.map((partida) => ({
      local_id: localId,
      año,
      mes,
      partida,
      valor_real: real[partida] ?? 0,
      valor_presupuesto: ppto[partida] ?? 0,
    }))
    await supabase
      .from('pl_datos')
      .upsert(rows, { onConflict: 'local_id,año,mes,partida' })
    setGuardando(false)
    setExito(true)
    setTimeout(() => setExito(false), 2500)
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Presupuesto</h1>
          <p className="text-sm text-gray-400 mt-0.5">Definir valores presupuestados por local y período</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Sel value={localId ?? ''} onChange={(v) => setLocalId(Number(v))}>
            {locales.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
          </Sel>
          <Sel value={mes} onChange={(v) => setMes(Number(v))}>
            {MESES.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </Sel>
          <Sel value={año} onChange={(v) => setAño(Number(v))}>
            {[2024, 2025, 2026, 2027].map((a) => <option key={a} value={a}>{a}</option>)}
          </Sel>
        </div>
      </div>

      {cargando ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="animate-spin text-[#F5B731]" size={22} />
        </div>
      ) : (
        <div className="space-y-4">
          {SECCIONES.map((seccion) => (
            <div key={seccion.key} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                <h3 className="text-xs font-bold tracking-wider text-gray-600 uppercase">{seccion.label}</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {seccion.items.map((partida) => (
                  <div key={partida} className="flex items-center gap-4 px-4 py-2.5">
                    <label className="flex-1 text-sm text-gray-700">{LABELS[partida]}</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={ppto[partida] ?? ''}
                      onChange={(e) =>
                        setPpto((prev) => ({ ...prev, [partida]: parseFloat(e.target.value) || 0 }))
                      }
                      className="w-36 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#F5B731]"
                      placeholder="0,00"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          <button
            onClick={guardar}
            disabled={guardando}
            className="w-full flex items-center justify-center gap-2 bg-[#1A1A1A] hover:bg-black disabled:opacity-60 text-white font-bold text-sm py-3 rounded-xl transition-colors"
          >
            {exito ? (
              <><Check size={16} /> Guardado</>
            ) : guardando ? (
              <><RefreshCw size={15} className="animate-spin" /> Guardando...</>
            ) : (
              <><Save size={15} /> Guardar presupuesto</>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

import { useEffect, useState, useCallback } from 'react'
import { supabase, type Local, type Venta } from './supabase'

export function useLocales() {
  const [locales, setLocales] = useState<Local[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchLocales() {
      const { data, error } = await supabase
        .from('locales')
        .select('*')
        .eq('activo', true)
        .order('id')

      if (error) setError(error.message)
      else setLocales(data || [])
      setLoading(false)
    }
    fetchLocales()
  }, [])

  return { locales, loading, error }
}

export function useVentasHoy(localId?: number) {
  const [venta, setVenta] = useState<Venta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hoy = new Date().toISOString().split('T')[0]

  const fetch = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('ventas').select('*').eq('fecha', hoy)
    if (localId) query = query.eq('local_id', localId)

    const { data, error } = await query.maybeSingle()
    if (error) setError(error.message)
    else setVenta(data)
    setLoading(false)
  }, [localId, hoy])

  useEffect(() => { fetch() }, [fetch])
  return { venta, loading, error, refetch: fetch }
}

export function useVentas30Dias(localId: number) {
  const [ventas, setVentas] = useState<Venta[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      const hace30 = new Date()
      hace30.setDate(hace30.getDate() - 29)
      const { data } = await supabase
        .from('ventas')
        .select('*')
        .eq('local_id', localId)
        .gte('fecha', hace30.toISOString().split('T')[0])
        .order('fecha', { ascending: true })

      setVentas(data || [])
      setLoading(false)
    }
    fetch()
  }, [localId])

  return { ventas, loading }
}

export function useVentasTodos30Dias() {
  const [ventas, setVentas] = useState<Venta[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      const hace30 = new Date()
      hace30.setDate(hace30.getDate() - 29)
      const { data } = await supabase
        .from('ventas')
        .select('*')
        .gte('fecha', hace30.toISOString().split('T')[0])
        .order('fecha', { ascending: true })

      setVentas(data || [])
      setLoading(false)
    }
    fetch()
  }, [])

  return { ventas, loading }
}

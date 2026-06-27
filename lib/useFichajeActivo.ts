import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'

export function useFichajeActivo() {
  const [fichajeActivo, setFichajeActivoState] = useState<boolean | null>(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from('configuracion_app')
      .select('valor')
      .eq('clave', 'fichaje_activo')
      .maybeSingle()
    setFichajeActivoState(data ? data.valor === 'true' : true)
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function setFichajeActivo(valor: boolean) {
    setGuardando(true)
    setFichajeActivoState(valor) // optimistic
    const { error } = await supabase
      .from('configuracion_app')
      .update({ valor: valor ? 'true' : 'false', updated_at: new Date().toISOString() })
      .eq('clave', 'fichaje_activo')
    if (error) {
      // revert on failure
      setFichajeActivoState(!valor)
    }
    setGuardando(false)
  }

  return { fichajeActivo, cargando, guardando, setFichajeActivo }
}

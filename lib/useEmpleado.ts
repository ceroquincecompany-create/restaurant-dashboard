'use client'

import { useEffect, useState } from 'react'
import { supabaseAuth } from './supabase-browser'
import { supabase } from './supabase'
import type { Empleado } from './supabase'

export function useEmpleadoActual() {
  const [empleado, setEmpleado] = useState<Empleado | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabaseAuth.auth.getUser()
      .then(async ({ data: { user } }) => {
        if (!user?.email) { setLoading(false); return }
        const { data, error } = await supabase
          .from('empleados')
          .select('*')
          .eq('email_acceso', user.email)
          .maybeSingle()
        if (error) console.error('[useEmpleado] Error buscando empleado:', error.message, '| email auth:', user.email)
        if (!data) console.warn('[useEmpleado] No se encontró empleado con email_acceso =', user.email)
        setEmpleado(data ?? null)
        setLoading(false)
      })
      .catch((err) => { console.error('[useEmpleado] Error de autenticación:', err); setLoading(false) })
  }, [])

  return { empleado, loading }
}

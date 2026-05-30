import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Local = {
  id: number
  nombre: string
  direccion: string
  activo: boolean
}

export type Venta = {
  id: number
  local_id: number
  fecha: string
  total_ventas: number
  coste_alimentos: number
  coste_personal: number
  num_clientes: number
  created_at: string
}

export type VentaConLocal = Venta & {
  locales: Local
}

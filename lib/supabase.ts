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

export type Empleado = {
  id: number
  nombre: string
  puesto: string
  local_id: number | null
  horas_contrato: number
  salario_bruto: number | null
  coste_empresa_pct: number
  fecha_inicio: string | null
  estado: 'activo' | 'baja' | 'vacaciones'
  rol: 'admin' | 'empleado'
  iban: string | null
  nss: string | null
  email_acceso: string | null
  notas: string | null
  activo: boolean
  created_at: string
}

export type Turno = {
  id: number
  empleado_id: number
  fecha: string
  tipo_turno: string
  hora_inicio: string | null
  hora_fin: string | null
  notas: string | null
  created_at: string
}

export type Fichaje = {
  id: number
  empleado_id: number
  fecha: string
  hora_entrada: string | null
  hora_salida: string | null
  horas_total: number | null
  horas_nocturnas: number | null
  horas_extra: number | null
  created_at: string
}

export type Sancion = {
  id: number
  empleado_id: number
  tipo: 'aviso_verbal' | 'amonestacion_escrita' | 'sancion_grave' | 'sancion_muy_grave'
  fecha: string
  descripcion: string
  firmado: boolean
  notas: string | null
  activo: boolean
  created_at: string
}

export interface KPIItem {
  nombre: string
  peso: number
  objetivo: number
  tipo: 'mayor_igual' | 'menor_igual'
  unidad: string
  descripcion: string
  valor_real?: number | null
}

export interface ClausulaItem {
  id: string
  nombre: string
  valor?: number | null
  informativa?: boolean
}

export type PlanIncentivo = {
  id: number
  nombre: string
  tipo: 'encargado' | 'staff'
  local_id: number | null
  trimestre: number
  año: number
  vigencia_inicio: string | null
  vigencia_fin: string | null
  importe_base: number | null
  pct_facturacion: number | null
  kpis: KPIItem[]
  clausulas: ClausulaItem[]
  activo: boolean
  created_at: string
}

export type Ingrediente = {
  id: number
  proveedor: string | null
  proveedor_id: number | null
  nombre_ingrediente: string
  formato_compra: string | null
  unidad_compra: string | null
  precio_unidad_producto: number | null
  unidad_producto: string | null
  created_at: string
}

export type SolicitudVacaciones = {
  id: number
  empleado_id: number
  fecha_inicio: string
  fecha_fin: string
  dias: number
  estado: 'pendiente' | 'aprobada' | 'rechazada'
  notas: string | null
  created_at: string
}

export type Merma = {
  id: number
  local_id: number | null
  empleado_nombre: string
  tipo: 'consumo_interno' | 'desperdicio'
  ingrediente_id: number | null
  cantidad: number
  coste: number | null
  fecha: string
  notas: string | null
  created_at: string
}

export type Temperatura = {
  id: number
  local_id: number | null
  empleado_nombre: string
  fecha: string
  mesa_fria_1: number | null
  mesa_fria_2: number | null
  mesa_fria_3: number | null
  congelador_4: number | null
  notas: string | null
  created_at: string
}

export type Limpieza = {
  id: number
  local_id: number | null
  empleado_nombre: string
  tarea: string
  frecuencia: 'diaria' | 'semanal' | 'mensual'
  fecha: string
  notas: string | null
  created_at: string
}

export type ChecklistItem = {
  id: string
  nombre: string
  resultado: 'conforme' | 'no_conforme' | 'na'
  notas: string
}

export type VisitaAppcc = {
  id: number
  local_id: number | null
  empleado_nombre: string
  fecha: string
  resultado: 'conforme' | 'no_conforme' | 'parcial'
  checklist: ChecklistItem[]
  observaciones: string | null
  acciones_correctivas: string | null
  created_at: string
}

export type InventarioConteo = {
  id: number
  empleado_id: number
  fecha: string
  local_id: number | null
  ingrediente_id: number
  cantidad: number
  notas: string | null
  created_at: string
}

export type IncentivosEmpleado = {
  id: number
  empleado_id: number
  plan_id: number
  trimestre: number
  año: number
  dias_efectivos: number | null
  dias_periodo: number | null
  bono_calculado: number | null
  estado: 'pendiente' | 'activado' | 'pagado'
  created_at: string
}

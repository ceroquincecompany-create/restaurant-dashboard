export const MESES = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio',
  'Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export const LABELS: Record<string, string> = {
  ventas_sala: 'Ventas Sala (con IVA)',
  ventas_uber: 'Ventas Uber (con IVA)',
  proveedores: 'Proveedores',
  inventario_inicial: 'Inventario Inicial',
  inventario_final: 'Inventario Final (−)',
  mermas: 'Mermas',
  comision_plataforma: 'Comisión Plataforma',
  promociones: 'Promociones',
  envio_gratis: 'Envío Gratis',
  ads_uber: 'Ads Uber',
  devoluciones: 'Devoluciones',
  alquiler: 'Alquiler',
  comunidad: 'Comunidad',
  basura: 'Basura',
  seguro_local: 'Seguro Local',
  extintores: 'Extintores',
  desinsectacion: 'Desinsectación',
  alarma: 'Alarma',
  otros_gopex: 'Otros Gopex',
  luz: 'Luz',
  agua: 'Agua',
  gas: 'Gas',
  telefonia: 'Telefonía / Internet',
  tpv_kds: 'TPV – KDS',
  otros_suministros: 'Otros Suministros',
  reparaciones: 'Reparaciones',
  compras_arreglos: 'Compras / Arreglos',
  uniformes: 'Uniformes',
  menaje_maquinaria: 'Menaje / Maquinaria',
  otros_mantenimiento: 'Otros',
  foodies: 'Foodies',
  carteleria: 'Cartelería / Flyers',
  merchandising: 'Merchandising',
  accion_especial: 'Acción Especial',
  otros_marketing: 'Otros Marketing',
  sueldos: 'Sueldos y Salarios',
  seguros_sociales: 'Seguros Sociales',
  incentivos: 'Incentivos',
}

export const SECCIONES = [
  {
    key: 'ingresos',
    label: 'INGRESOS',
    items: ['ventas_sala', 'ventas_uber'],
  },
  {
    key: 'materia_prima',
    label: 'MATERIA PRIMA',
    items: ['proveedores', 'inventario_inicial', 'inventario_final', 'mermas'],
  },
  {
    key: 'delivery',
    label: 'DELIVERY',
    items: ['comision_plataforma', 'promociones', 'envio_gratis', 'ads_uber', 'devoluciones'],
  },
  {
    key: 'gopex',
    label: 'GASTOS OPERATIVOS (GOPEX)',
    items: ['alquiler', 'comunidad', 'basura', 'seguro_local', 'extintores', 'desinsectacion', 'alarma', 'otros_gopex'],
  },
  {
    key: 'suministros',
    label: 'SUMINISTROS',
    items: ['luz', 'agua', 'gas', 'telefonia', 'tpv_kds', 'otros_suministros'],
  },
  {
    key: 'mantenimiento',
    label: 'MANTENIMIENTO',
    items: ['reparaciones', 'compras_arreglos', 'uniformes', 'menaje_maquinaria', 'otros_mantenimiento'],
  },
  {
    key: 'marketing',
    label: 'MARKETING LOCAL',
    items: ['foodies', 'carteleria', 'merchandising', 'accion_especial', 'otros_marketing'],
  },
  {
    key: 'personal',
    label: 'PERSONAL',
    items: ['sueldos', 'seguros_sociales', 'incentivos'],
  },
] as const

export type SeccionKey = typeof SECCIONES[number]['key']

export const TODAS_PARTIDAS = SECCIONES.flatMap((s) => s.items)

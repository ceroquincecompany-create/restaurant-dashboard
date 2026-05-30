#!/usr/bin/env node
/**
 * Importa las hojas "Base de datos" y "RESUMEN DE COSTES" del Excel de escandallos
 * a las tablas `ingredientes` y `escandallos_resumen` en Supabase.
 *
 * Uso:
 *   node importar-escandallos.js
 *
 * Requiere:
 *   npm install xlsx @supabase/supabase-js
 */

const XLSX = require('xlsx')
const { createClient } = require('@supabase/supabase-js')
const path = require('path')

const SUPABASE_URL = 'https://ravxmbqaplobtfhfhfij.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhdnhtYnFhcGxvYnRmaGZoZmlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1NjIzMDEsImV4cCI6MjA5NTEzODMwMX0.yQXBIIhdNeLyb5X7U-oICWOEUXsR6hl1iQdQkkx-JhQ'

const EXCEL_PATH = path.join(
  __dirname,
  '2.2.4.C. Herramienta de Escandallos con Elaboraciones y Base de Datos_EXCEL.xlsx'
)

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

function num(val) {
  if (val === undefined || val === null || val === '') return null
  const n = parseFloat(String(val).replace(',', '.'))
  return isNaN(n) ? null : n
}

function int(val) {
  if (val === undefined || val === null || val === '') return null
  const n = parseInt(String(val), 10)
  return isNaN(n) ? null : n
}

function str(val) {
  if (val === undefined || val === null) return null
  return String(val).trim() || null
}

async function importarIngredientes(workbook) {
  const sheet = workbook.Sheets['Base de datos']
  if (!sheet) throw new Error('Hoja "Base de datos" no encontrada en el Excel')

  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null })

  const ingredientes = rows
    .filter((r) => r['ID'] !== null && r['ID'] !== undefined)
    .map((r) => ({
      id: int(r['ID']),
      proveedor: str(r['Proveedor']),
      nombre_ingrediente: str(r['Nombre ingrediente']),
      formato_compra: str(r['Formato compra']),
      unidad_compra: str(r['Unidad de compra']),
      precio_formato_compra: num(r['Precio formato compra']),
      unidad_producto: str(r['Unidad Producto']),
      precio_unidad_producto: num(r['Precio Unidad Producto']),
    }))
    .filter((r) => r.id !== null && r.nombre_ingrediente)

  console.log(`  → ${ingredientes.length} ingredientes encontrados`)

  // Borrar e insertar (upsert por id)
  const { error } = await supabase
    .from('ingredientes')
    .upsert(ingredientes, { onConflict: 'id' })

  if (error) throw new Error(`Error insertando ingredientes: ${error.message}`)
  console.log(`  ✓ Ingredientes importados correctamente`)
}

async function importarResumen(workbook) {
  const sheet = workbook.Sheets['RESUMEN DE COSTES']
  if (!sheet) throw new Error('Hoja "RESUMEN DE COSTES" no encontrada en el Excel')

  // range: 1 → salta la fila 1 (vacía) y usa la fila 2 como cabecera
  const rows = XLSX.utils.sheet_to_json(sheet, { range: 1, defval: null })

  const resumen = rows
    .filter((r) => r['Producto'] !== null && r['Producto'] !== undefined)
    .map((r) => ({
      familia: str(r['Familia']),
      producto: str(r['Producto']),
      coste: num(r['Coste €']),
      pvp_sin_iva: num(r['PVP sin IVA']),
      pvp_actual: num(r['PVP Actual']),
      margen_euros: num(r['Margen €']),
      margen_pct: num(r['Margen %']),
      coste_pct: num(r['Coste %']),
      unidades_vendidas: int(r['Unidades Vendidas']),
    }))
    .filter((r) => r.producto)

  console.log(`  → ${resumen.length} productos encontrados`)

  // Limpiar tabla antes de insertar para evitar duplicados en re-ejecuciones
  const { error: delError } = await supabase
    .from('escandallos_resumen')
    .delete()
    .neq('id', 0)

  if (delError) throw new Error(`Error limpiando tabla: ${delError.message}`)

  const { error } = await supabase.from('escandallos_resumen').insert(resumen)
  if (error) throw new Error(`Error insertando resumen: ${error.message}`)
  console.log(`  ✓ Resumen de costes importado correctamente`)
}

async function main() {
  console.log('Leyendo Excel:', EXCEL_PATH)

  let workbook
  try {
    workbook = XLSX.readFile(EXCEL_PATH)
  } catch (e) {
    console.error('No se pudo abrir el archivo Excel:', e.message)
    process.exit(1)
  }

  console.log('Hojas disponibles:', workbook.SheetNames.join(', '))

  console.log('\n[1/2] Importando ingredientes...')
  await importarIngredientes(workbook)

  console.log('\n[2/2] Importando resumen de costes...')
  await importarResumen(workbook)

  console.log('\n✅ Importación completada.')
}

main().catch((e) => {
  console.error('Error:', e.message)
  process.exit(1)
})

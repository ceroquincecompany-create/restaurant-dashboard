#!/usr/bin/env node
/**
 * Importa productos y recetas desde las hojas del Excel a Supabase.
 * Uso: node importar-recetas.js
 * Requiere: npm install xlsx @supabase/supabase-js
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

const HOJAS = ['BURGERS', 'BOCATAS', 'SERRANOS', 'BRIOCH-SUBS', 'ENTRANTES', 'POSTRES']
const FAMILIA_MAP = {
  BURGERS: 'Burgers',
  BOCATAS: 'Bocadillos',
  SERRANOS: 'Serranos',
  'BRIOCH-SUBS': 'Briochs & Subs',
  ENTRANTES: 'Entrantes',
  POSTRES: 'Postres',
}

function isValidId(val) {
  if (val === null || val === undefined) return false
  const s = String(val)
  if (s.includes('#') || s.trim() === '' || s.trim() === '0') return false
  const n = parseInt(s)
  return !isNaN(n) && n > 0
}

function num(val) {
  if (val === null || val === undefined) return 0
  const n = parseFloat(String(val))
  return isNaN(n) ? 0 : n
}

function parseSheet(wb, sheetName) {
  const sheet = wb.Sheets[sheetName]
  if (!sheet) { console.warn(`  ⚠ Hoja "${sheetName}" no encontrada`); return [] }

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: true })
  const familia = FAMILIA_MAP[sheetName]
  const productos = []
  let current = null
  let inUber = false
  const seen = new Set() // ingrediente_ids vistos en el producto actual

  for (const row of rows) {
    // ── Nueva ficha de producto ──────────────────────────────
    if (row[1] === 'PRODUCTO' && row[2]) {
      if (current) productos.push(current)
      current = {
        nombre: String(row[2]).trim(),
        familia,
        pvp_sala: null,
        pvp_delivery: null,
        ingredientes: [],
      }
      inUber = false
      seen.clear()
      continue
    }

    if (!current) continue

    // ── Detector sección UBER ────────────────────────────────
    if (row[9] != null && String(row[9]).toUpperCase().includes('INDICE UBER')) {
      inUber = true
    }

    // ── PVP sala / delivery ──────────────────────────────────
    if (String(row[9] || '') === 'PVP' && typeof row[10] === 'number' && !isNaN(row[10])) {
      if (!inUber && current.pvp_sala === null) current.pvp_sala = row[10]
      else if (inUber && current.pvp_delivery === null) current.pvp_delivery = row[10]
    }

    // ── Fila de ingrediente ──────────────────────────────────
    if (!isValidId(row[0])) continue
    if (!row[1] || String(row[1]).includes('#')) continue
    const col1 = String(row[1]).trim()
    if (['ID', 'Notas de elaboración', 'Margen Bruto'].includes(col1)) continue

    const ingId = parseInt(String(row[0]))
    if (seen.has(ingId)) continue // evitar duplicados
    seen.add(ingId)

    const cantBruta = num(row[4])
    const cantNeta = row[5] != null ? num(row[5]) : cantBruta
    const mermaPct = num(row[6]) === 1 ? 0 : num(row[6]) // valor 1 = elaboración, se trata como sin merma
    const coste = num(row[7])

    if (cantBruta > 0) {
      current.ingredientes.push({ ingrediente_id: ingId, cantidad_bruta: cantBruta, cantidad_neta: cantNeta, merma_pct: mermaPct, coste })
    }
  }

  if (current) productos.push(current)
  return productos
}

async function main() {
  console.log('Leyendo Excel:', EXCEL_PATH)
  let wb
  try { wb = XLSX.readFile(EXCEL_PATH) } catch (e) { console.error('No se pudo abrir el Excel:', e.message); process.exit(1) }

  // Cargar IDs de ingredientes válidos para validar FK
  const { data: ingsDB } = await supabase.from('ingredientes').select('id')
  const idsValidos = new Set((ingsDB ?? []).map((i) => i.id))
  console.log(`  ${idsValidos.size} ingredientes en base de datos`)

  let totalProductos = 0
  let totalRecetas = 0

  for (const hoja of HOJAS) {
    console.log(`\n[${hoja}] Parseando...`)
    const productos = parseSheet(wb, hoja)
    console.log(`  → ${productos.length} productos encontrados`)

    for (const p of productos) {
      // Upsert producto
      const { data: prodData, error: prodErr } = await supabase
        .from('productos')
        .upsert(
          { nombre: p.nombre, familia: p.familia, pvp_sala: p.pvp_sala, pvp_delivery: p.pvp_delivery, activo: true },
          { onConflict: 'nombre,familia' }
        )
        .select('id')
        .single()

      if (prodErr || !prodData) {
        console.warn(`  ⚠ Error al insertar "${p.nombre}":`, prodErr?.message)
        continue
      }

      const productoId = prodData.id

      // Borrar receta existente
      await supabase.from('recetas').delete().eq('producto_id', productoId)

      // Filtrar ingredientes con ID válido en BD
      const lineas = p.ingredientes.filter((i) => {
        if (!idsValidos.has(i.ingrediente_id)) {
          console.warn(`    ⚠ ID ${i.ingrediente_id} no existe en ingredientes → omitido`)
          return false
        }
        return true
      })

      if (lineas.length > 0) {
        const { error: recErr } = await supabase.from('recetas').insert(
          lineas.map((i) => ({ producto_id: productoId, ...i }))
        )
        if (recErr) console.warn(`  ⚠ Error recetas "${p.nombre}":`, recErr.message)
        else totalRecetas += lineas.length
      }

      console.log(`  ✓ ${p.nombre} (pvp_sala=${p.pvp_sala}, delivery=${p.pvp_delivery}, ${lineas.length} ingredientes)`)
      totalProductos++
    }
  }

  console.log(`\n✅ Importación completada: ${totalProductos} productos, ${totalRecetas} líneas de receta`)
}

main().catch((e) => { console.error('Error:', e.message); process.exit(1) })

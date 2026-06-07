#!/usr/bin/env node
/**
 * Vincula proveedor_id en la tabla ingredientes.
 *
 * Los ingredientes tienen el nombre del proveedor en la columna "proveedor" (texto)
 * pero proveedor_id está a NULL. Este script:
 *   1. Lee todos los ingredientes con proveedor en texto y sin proveedor_id
 *   2. Para cada nombre único de proveedor:
 *      - Busca en tabla proveedores (coincidencia exacta o aproximada, sin distinción de mayúsculas)
 *      - Si existe  → actualiza proveedor_id en los ingredientes correspondientes
 *      - Si no existe → crea el proveedor y luego actualiza proveedor_id
 *   3. Muestra resumen
 *
 * Uso:
 *   node vincular-proveedores.js
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://ravxmbqaplobtfhfhfij.supabase.co'
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhdnhtYnFhcGxvYnRmaGZoZmlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1NjIzMDEsImV4cCI6MjA5NTEzODMwMX0.' +
  'yQXBIIhdNeLyb5X7U-oICWOEUXsR6hl1iQdQkkx-JhQ'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Normaliza un nombre para comparación: minúsculas, sin acentos, trim
function normalizar(s) {
  return s
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
}

// Busca el mejor match en la lista de proveedores existentes
function buscarMatch(nombre, proveedores) {
  const n = normalizar(nombre)

  // 1. Coincidencia exacta tras normalización
  let match = proveedores.find(p => normalizar(p.nombre) === n)
  if (match) return { prov: match, tipo: 'exacto' }

  // 2. Uno contiene al otro (captura "makro" → "Makro", "La Sirena SL" → "La Sirena")
  match = proveedores.find(p => {
    const pn = normalizar(p.nombre)
    return pn.includes(n) || n.includes(pn)
  })
  if (match) return { prov: match, tipo: 'aproximado' }

  return null
}

async function main() {
  console.log('\n══════════════════════════════════════════')
  console.log('  VINCULAR PROVEEDORES → INGREDIENTES')
  console.log('══════════════════════════════════════════\n')

  // ── 1. Cargar ingredientes sin proveedor_id ──────────────
  console.log('Cargando ingredientes...')
  const { data: todosIngredientes, error: errIng } = await supabase
    .from('ingredientes')
    .select('id, nombre_ingrediente, proveedor, proveedor_id')
    .not('proveedor', 'is', null)

  if (errIng) {
    console.error('✗ Error cargando ingredientes:', errIng.message)
    process.exit(1)
  }

  const sinId = (todosIngredientes ?? []).filter(
    i => i.proveedor && i.proveedor.trim() !== '' && i.proveedor_id === null
  )

  if (sinId.length === 0) {
    console.log('✓ Nada que hacer. Todos los ingredientes ya tienen proveedor_id asignado.\n')
    return
  }

  console.log(`→ ${sinId.length} ingredientes con proveedor en texto pero sin proveedor_id\n`)

  // ── 2. Cargar proveedores existentes ─────────────────────
  console.log('Cargando proveedores existentes...')
  const { data: proveedoresExistentes, error: errProv } = await supabase
    .from('proveedores')
    .select('id, nombre')

  if (errProv) {
    console.error('✗ Error cargando proveedores:', errProv.message)
    process.exit(1)
  }

  const proveedores = [...(proveedoresExistentes ?? [])]
  console.log(`→ ${proveedores.length} proveedores en BD\n`)

  // ── 3. Agrupar ingredientes por nombre de proveedor ──────
  const grupos = {}
  sinId.forEach(ing => {
    const nombre = ing.proveedor.trim()
    if (!grupos[nombre]) grupos[nombre] = []
    grupos[nombre].push(ing)
  })

  const nombresUnicos = Object.keys(grupos)
  console.log(`→ ${nombresUnicos.length} nombres únicos de proveedor a procesar\n`)
  console.log('─'.repeat(55))

  // ── 4. Procesar cada grupo ───────────────────────────────
  let totalVinculados = 0
  let totalCreados = 0
  let totalErrores = 0

  for (const [nombre, ings] of Object.entries(grupos)) {
    const match = buscarMatch(nombre, proveedores)
    let provId = null

    if (match) {
      // Proveedor existente encontrado
      provId = match.prov.id
      const tipoStr = match.tipo === 'exacto' ? '(exacto)' : '(aproximado → "' + match.prov.nombre + '")'
      process.stdout.write(`  🔗  "${nombre}"  →  id ${provId}  ${tipoStr}`)
    } else {
      // Crear nuevo proveedor
      const { data: nuevo, error: errNuevo } = await supabase
        .from('proveedores')
        .insert({ nombre: nombre.trim(), activo: true })
        .select('id, nombre')
        .single()

      if (errNuevo || !nuevo) {
        console.log(`\n  ✗ Error creando proveedor "${nombre}": ${errNuevo?.message ?? 'sin respuesta'}`)
        totalErrores += ings.length
        continue
      }

      provId = nuevo.id
      proveedores.push(nuevo) // añadir a la lista para matches posteriores
      totalCreados++
      process.stdout.write(`  ✚  "${nombre}"  →  creado con id ${provId}`)
    }

    // Actualizar proveedor_id en todos los ingredientes del grupo
    const ids = ings.map(i => i.id)
    const { error: errUpd } = await supabase
      .from('ingredientes')
      .update({ proveedor_id: provId })
      .in('id', ids)

    if (errUpd) {
      console.log(`  → ✗ Error actualizando ingredientes: ${errUpd.message}`)
      totalErrores += ids.length
    } else {
      console.log(`  → ✓ ${ids.length} ingrediente${ids.length !== 1 ? 's' : ''} actualizados`)
      totalVinculados += ids.length
    }
  }

  // ── 5. Resumen final ─────────────────────────────────────
  console.log('\n' + '═'.repeat(55))
  console.log('RESUMEN')
  console.log('═'.repeat(55))
  console.log(`  ✓ ${totalVinculados} ingredientes vinculados a proveedor`)
  console.log(`  ✚ ${totalCreados} proveedores nuevos creados en BD`)
  if (totalErrores > 0) {
    console.log(`  ✗ ${totalErrores} errores — revisar mensajes anteriores`)
  }
  console.log('═'.repeat(55))

  if (totalCreados > 0) {
    console.log('\n  ℹ  Puedes completar los datos de los proveedores nuevos')
    console.log('     (teléfono, CIF, email...) en Producto → Proveedores\n')
  } else {
    console.log()
  }
}

main().catch(err => {
  console.error('\n✗ Error inesperado:', err.message ?? err)
  process.exit(1)
})

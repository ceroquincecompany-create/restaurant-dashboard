-- ──────────────────────────────────────────────────────────────
-- VINCULAR PROVEEDOR_ID EN INGREDIENTES
-- Ejecutar en Supabase SQL Editor (en este orden exacto)
-- ──────────────────────────────────────────────────────────────

-- PASO 1: Ver qué nombres únicos de proveedor hay en ingredientes sin ID
-- (ejecutar primero para revisar antes de aplicar cambios)
SELECT
  TRIM(proveedor) AS nombre_proveedor,
  COUNT(*)        AS num_ingredientes,
  p.id            AS proveedor_id_encontrado,
  p.nombre        AS proveedor_nombre_en_bd
FROM ingredientes i
LEFT JOIN proveedores p
  ON LOWER(TRIM(p.nombre)) = LOWER(TRIM(i.proveedor))
WHERE i.proveedor IS NOT NULL
  AND TRIM(i.proveedor) != ''
  AND i.proveedor_id IS NULL
GROUP BY TRIM(i.proveedor), p.id, p.nombre
ORDER BY num_ingredientes DESC;

-- ──────────────────────────────────────────────────────────────
-- PASO 2: Vincular ingredientes a proveedores existentes (match exacto, insensible a mayúsculas)
UPDATE ingredientes i
SET proveedor_id = p.id
FROM proveedores p
WHERE i.proveedor IS NOT NULL
  AND TRIM(i.proveedor) != ''
  AND i.proveedor_id IS NULL
  AND LOWER(TRIM(i.proveedor)) = LOWER(TRIM(p.nombre));

-- Resultado parcial tras el paso 2
SELECT COUNT(*) AS vinculados_con_proveedor_existente
FROM ingredientes
WHERE proveedor_id IS NOT NULL;

-- ──────────────────────────────────────────────────────────────
-- PASO 3: Crear proveedores nuevos para los nombres que NO tienen coincidencia
INSERT INTO proveedores (nombre, activo)
SELECT DISTINCT TRIM(i.proveedor), true
FROM ingredientes i
WHERE i.proveedor IS NOT NULL
  AND TRIM(i.proveedor) != ''
  AND i.proveedor_id IS NULL
ON CONFLICT DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- PASO 4: Vincular los que quedaron sin ID (ahora sí existen en proveedores)
UPDATE ingredientes i
SET proveedor_id = p.id
FROM proveedores p
WHERE i.proveedor IS NOT NULL
  AND TRIM(i.proveedor) != ''
  AND i.proveedor_id IS NULL
  AND LOWER(TRIM(i.proveedor)) = LOWER(TRIM(p.nombre));

-- ──────────────────────────────────────────────────────────────
-- RESUMEN FINAL
SELECT
  (SELECT COUNT(*) FROM ingredientes WHERE proveedor_id IS NOT NULL)  AS ingredientes_vinculados,
  (SELECT COUNT(*) FROM ingredientes WHERE proveedor IS NOT NULL AND TRIM(proveedor) != '' AND proveedor_id IS NULL) AS pendientes_sin_vincular,
  (SELECT COUNT(*) FROM proveedores)                                   AS total_proveedores;

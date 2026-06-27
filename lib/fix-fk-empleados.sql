-- ══════════════════════════════════════════════════════════════════════════
-- FIX FK empleados → ON DELETE CASCADE / SET NULL
-- Ejecutar completo en Supabase Dashboard → SQL Editor → New query
-- ══════════════════════════════════════════════════════════════════════════
--
-- Por qué es necesario:
--   presencia-sql.sql cambió sanciones a SET NULL, pero empleado_id es NOT NULL
--   → al eliminar un empleado con sanciones, Postgres lanza FK violation.
--   Este script normaliza TODAS las tablas que referencian empleados(id).
--
-- Regla aplicada:
--   · columna NOT NULL  → ON DELETE CASCADE  (se eliminan los registros)
--   · columna nullable  → ON DELETE SET NULL (se conservan sin empleado)
-- ══════════════════════════════════════════════════════════════════════════

-- ── turnos (NOT NULL → CASCADE) ──────────────────────────────────────────
ALTER TABLE turnos DROP CONSTRAINT IF EXISTS turnos_empleado_id_fkey;
ALTER TABLE turnos ADD CONSTRAINT turnos_empleado_id_fkey
  FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE CASCADE;

-- ── fichajes (NOT NULL → CASCADE) ────────────────────────────────────────
ALTER TABLE fichajes DROP CONSTRAINT IF EXISTS fichajes_empleado_id_fkey;
ALTER TABLE fichajes ADD CONSTRAINT fichajes_empleado_id_fkey
  FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE CASCADE;

-- ── sanciones (NOT NULL → CASCADE) ───────────────────────────────────────
-- CORRECCIÓN: presencia-sql.sql lo puso en SET NULL sobre columna NOT NULL.
-- Restauramos CASCADE que era el original y es el correcto.
ALTER TABLE sanciones DROP CONSTRAINT IF EXISTS sanciones_empleado_id_fkey;
ALTER TABLE sanciones ADD CONSTRAINT sanciones_empleado_id_fkey
  FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE CASCADE;

-- ── incentivos_empleado (NOT NULL → CASCADE) ──────────────────────────────
ALTER TABLE incentivos_empleado DROP CONSTRAINT IF EXISTS incentivos_empleado_empleado_id_fkey;
ALTER TABLE incentivos_empleado ADD CONSTRAINT incentivos_empleado_empleado_id_fkey
  FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE CASCADE;

-- ── solicitudes_vacaciones (NOT NULL → CASCADE) ───────────────────────────
ALTER TABLE solicitudes_vacaciones DROP CONSTRAINT IF EXISTS solicitudes_vacaciones_empleado_id_fkey;
ALTER TABLE solicitudes_vacaciones ADD CONSTRAINT solicitudes_vacaciones_empleado_id_fkey
  FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE CASCADE;

-- ── vacaciones_historial (NOT NULL → CASCADE) ─────────────────────────────
ALTER TABLE vacaciones_historial DROP CONSTRAINT IF EXISTS vacaciones_historial_empleado_id_fkey;
ALTER TABLE vacaciones_historial ADD CONSTRAINT vacaciones_historial_empleado_id_fkey
  FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE CASCADE;

-- ── anuncios_vistos (NOT NULL → CASCADE) ──────────────────────────────────
ALTER TABLE anuncios_vistos DROP CONSTRAINT IF EXISTS anuncios_vistos_empleado_id_fkey;
ALTER TABLE anuncios_vistos ADD CONSTRAINT anuncios_vistos_empleado_id_fkey
  FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE CASCADE;

-- ── firmas (NOT NULL → CASCADE) ───────────────────────────────────────────
ALTER TABLE firmas DROP CONSTRAINT IF EXISTS firmas_empleado_id_fkey;
ALTER TABLE firmas ADD CONSTRAINT firmas_empleado_id_fkey
  FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE CASCADE;

-- ── documentos_firma (nullable → SET NULL) ────────────────────────────────
ALTER TABLE documentos_firma DROP CONSTRAINT IF EXISTS documentos_firma_empleado_id_fkey;
ALTER TABLE documentos_firma ADD CONSTRAINT documentos_firma_empleado_id_fkey
  FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE SET NULL;

-- ── reconocimientos (nullable → SET NULL) ────────────────────────────────
ALTER TABLE reconocimientos DROP CONSTRAINT IF EXISTS reconocimientos_empleado_id_fkey;
ALTER TABLE reconocimientos ADD CONSTRAINT reconocimientos_empleado_id_fkey
  FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE SET NULL;

-- ── inventario_conteos (nullable → SET NULL) ──────────────────────────────
ALTER TABLE inventario_conteos DROP CONSTRAINT IF EXISTS inventario_conteos_empleado_id_fkey;
ALTER TABLE inventario_conteos ADD CONSTRAINT inventario_conteos_empleado_id_fkey
  FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE SET NULL;

-- ══════════════════════════════════════════════════════════════════════════
-- Verificación: muestra todas las FK que referencian empleados tras el fix
-- ══════════════════════════════════════════════════════════════════════════
SELECT
  tc.table_name,
  kcu.column_name,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
JOIN information_schema.key_column_usage ccu
  ON rc.unique_constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'empleados'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name;

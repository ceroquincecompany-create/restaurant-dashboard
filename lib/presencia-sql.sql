-- ══════════════════════════════════════════════════════════════════
-- FK CASCADE — Permitir eliminar empleados sin violar restricciones
-- Ejecutar en Supabase SQL Editor ANTES de eliminar empleados
-- ══════════════════════════════════════════════════════════════════

-- turnos → CASCADE: si se elimina el empleado, se eliminan sus turnos
ALTER TABLE turnos DROP CONSTRAINT IF EXISTS turnos_empleado_id_fkey;
ALTER TABLE turnos ADD CONSTRAINT turnos_empleado_id_fkey
  FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE CASCADE;

-- fichajes → CASCADE: se eliminan sus fichajes
ALTER TABLE fichajes DROP CONSTRAINT IF EXISTS fichajes_empleado_id_fkey;
ALTER TABLE fichajes ADD CONSTRAINT fichajes_empleado_id_fkey
  FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE CASCADE;

-- solicitudes_vacaciones → CASCADE: se eliminan sus solicitudes
ALTER TABLE solicitudes_vacaciones DROP CONSTRAINT IF EXISTS solicitudes_vacaciones_empleado_id_fkey;
ALTER TABLE solicitudes_vacaciones ADD CONSTRAINT solicitudes_vacaciones_empleado_id_fkey
  FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE CASCADE;

-- sanciones → SET NULL: se conserva el registro de sanción pero sin empleado
ALTER TABLE sanciones DROP CONSTRAINT IF EXISTS sanciones_empleado_id_fkey;
ALTER TABLE sanciones ADD CONSTRAINT sanciones_empleado_id_fkey
  FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE SET NULL;

-- inventario_conteos → SET NULL: se conserva el inventario
ALTER TABLE inventario_conteos DROP CONSTRAINT IF EXISTS inventario_conteos_empleado_id_fkey;
ALTER TABLE inventario_conteos ADD CONSTRAINT inventario_conteos_empleado_id_fkey
  FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE SET NULL;

-- incentivos_empleado → CASCADE
ALTER TABLE incentivos_empleado DROP CONSTRAINT IF EXISTS incentivos_empleado_empleado_id_fkey;
ALTER TABLE incentivos_empleado ADD CONSTRAINT incentivos_empleado_empleado_id_fkey
  FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE CASCADE;

-- anuncios_vistos → CASCADE (ya tiene ON DELETE CASCADE por diseño)
-- firmas → CASCADE (ya tiene ON DELETE CASCADE por diseño)
-- documentos_firma → SET NULL (ya tiene ON DELETE SET NULL por diseño)
-- reconocimientos → SET NULL (ya tiene ON DELETE SET NULL por diseño)

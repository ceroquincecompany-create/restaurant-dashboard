-- =============================================
-- INVENTARIO MEJORA — SOFI
-- =============================================

-- 1. Añadir columnas nuevas a inventario_conteos
ALTER TABLE inventario_conteos
  ADD COLUMN IF NOT EXISTS cerrado           BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS inventario_grupo_id UUID;

-- 2. Asignar UUIDs de grupo a registros existentes (mismo empleado + local + fecha → mismo UUID)
DO $$
DECLARE
  r   RECORD;
  gid UUID;
BEGIN
  FOR r IN
    SELECT DISTINCT empleado_id, local_id, fecha
    FROM inventario_conteos
    WHERE inventario_grupo_id IS NULL
  LOOP
    gid := gen_random_uuid();
    UPDATE inventario_conteos
    SET inventario_grupo_id = gid
    WHERE empleado_id = r.empleado_id
      AND local_id IS NOT DISTINCT FROM r.local_id
      AND fecha    = r.fecha
      AND inventario_grupo_id IS NULL;
  END LOOP;
END $$;

-- 3. Constraint única si aún no existe (necesaria para el upsert del empleado)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inventario_conteos_empleado_fecha_ing_key'
  ) THEN
    ALTER TABLE inventario_conteos
      ADD CONSTRAINT inventario_conteos_empleado_fecha_ing_key
      UNIQUE (empleado_id, fecha, ingrediente_id);
  END IF;
END $$;

-- 4. Índices de rendimiento
CREATE INDEX IF NOT EXISTS inventario_conteos_grupo_idx   ON inventario_conteos(inventario_grupo_id);
CREATE INDEX IF NOT EXISTS inventario_conteos_fecha_idx   ON inventario_conteos(fecha DESC);
CREATE INDEX IF NOT EXISTS inventario_conteos_cerrado_idx ON inventario_conteos(cerrado);

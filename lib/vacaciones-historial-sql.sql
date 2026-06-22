-- Tabla de historial de vacaciones por empleado y año
-- Ejecutar en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS vacaciones_historial (
  id                    BIGSERIAL PRIMARY KEY,
  empleado_id           BIGINT NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  año                   INTEGER NOT NULL,
  dias_totales          INTEGER NOT NULL DEFAULT 23,
  dias_usados_historico INTEGER NOT NULL DEFAULT 0,
  notas                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (empleado_id, año)
);

-- Índice para búsquedas por empleado
CREATE INDEX IF NOT EXISTS idx_vacaciones_historial_empleado_año
  ON vacaciones_historial (empleado_id, año);

-- RLS
ALTER TABLE vacaciones_historial ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vacaciones_historial_all" ON vacaciones_historial;
CREATE POLICY "vacaciones_historial_all"
  ON vacaciones_historial
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

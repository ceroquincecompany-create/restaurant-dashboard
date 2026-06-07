-- ──────────────────────────────────────────────────────────────
-- MÓDULO COMPRAS — Ejecutar en Supabase SQL Editor
-- ──────────────────────────────────────────────────────────────

-- Añadir número de albarán a entregas
ALTER TABLE recepciones_pedido ADD COLUMN IF NOT EXISTS numero_albaran TEXT;

-- Inventarios mensuales (cabecera)
CREATE TABLE IF NOT EXISTS inventarios (
  id              BIGSERIAL PRIMARY KEY,
  local_id        INTEGER REFERENCES locales(id) ON DELETE SET NULL,
  empleado_nombre TEXT NOT NULL,
  mes             INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  año             INTEGER NOT NULL,
  estado          TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador','cerrado')),
  notas           TEXT,
  total_coste     NUMERIC(12,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cerrado_at      TIMESTAMPTZ,
  UNIQUE(local_id, mes, año)
);

-- Líneas de inventario (detalle por ingrediente)
CREATE TABLE IF NOT EXISTS inventarios_lineas (
  id                  BIGSERIAL PRIMARY KEY,
  inventario_id       BIGINT NOT NULL REFERENCES inventarios(id) ON DELETE CASCADE,
  ingrediente_id      INTEGER REFERENCES ingredientes(id) ON DELETE SET NULL,
  nombre_ingrediente  TEXT NOT NULL,
  unidad              TEXT,
  cantidad            NUMERIC(12,4),
  precio_coste        NUMERIC(12,4),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE inventarios       ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventarios_lineas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura pública inventarios"          ON inventarios        FOR SELECT USING (true);
CREATE POLICY "Inserción inventarios"                ON inventarios        FOR INSERT WITH CHECK (true);
CREATE POLICY "Actualización inventarios"            ON inventarios        FOR UPDATE USING (true);
CREATE POLICY "Eliminación inventarios"              ON inventarios        FOR DELETE USING (true);

CREATE POLICY "Lectura pública inventarios_lineas"   ON inventarios_lineas FOR SELECT USING (true);
CREATE POLICY "Inserción inventarios_lineas"         ON inventarios_lineas FOR INSERT WITH CHECK (true);
CREATE POLICY "Actualización inventarios_lineas"     ON inventarios_lineas FOR UPDATE USING (true);
CREATE POLICY "Eliminación inventarios_lineas"       ON inventarios_lineas FOR DELETE USING (true);

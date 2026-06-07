-- ──────────────────────────────────────────────────────────────
-- OPERACIONES — Mermas, Temperaturas, Limpiezas, Visitas APPCC
-- Ejecutar en Supabase SQL Editor
-- ──────────────────────────────────────────────────────────────

-- MERMAS
CREATE TABLE IF NOT EXISTS mermas (
  id BIGSERIAL PRIMARY KEY,
  local_id INTEGER REFERENCES locales(id) ON DELETE SET NULL,
  empleado_nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('consumo_interno', 'desperdicio')),
  ingrediente_id INTEGER REFERENCES ingredientes(id) ON DELETE SET NULL,
  cantidad NUMERIC(12, 4) NOT NULL,
  coste NUMERIC(12, 4),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE mermas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lectura pública mermas"    ON mermas FOR SELECT USING (true);
CREATE POLICY "Inserción mermas"          ON mermas FOR INSERT WITH CHECK (true);
CREATE POLICY "Actualización mermas"      ON mermas FOR UPDATE USING (true);
CREATE POLICY "Eliminación mermas"        ON mermas FOR DELETE USING (true);

-- TEMPERATURAS
CREATE TABLE IF NOT EXISTS temperaturas (
  id BIGSERIAL PRIMARY KEY,
  local_id INTEGER REFERENCES locales(id) ON DELETE SET NULL,
  empleado_nombre TEXT NOT NULL,
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  mesa_fria_1 NUMERIC(5, 1),
  mesa_fria_2 NUMERIC(5, 1),
  mesa_fria_3 NUMERIC(5, 1),
  congelador_4 NUMERIC(5, 1),
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE temperaturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lectura pública temperaturas"  ON temperaturas FOR SELECT USING (true);
CREATE POLICY "Inserción temperaturas"        ON temperaturas FOR INSERT WITH CHECK (true);
CREATE POLICY "Actualización temperaturas"    ON temperaturas FOR UPDATE USING (true);
CREATE POLICY "Eliminación temperaturas"      ON temperaturas FOR DELETE USING (true);

-- LIMPIEZAS
CREATE TABLE IF NOT EXISTS limpiezas (
  id BIGSERIAL PRIMARY KEY,
  local_id INTEGER REFERENCES locales(id) ON DELETE SET NULL,
  empleado_nombre TEXT NOT NULL,
  tarea TEXT NOT NULL,
  frecuencia TEXT NOT NULL CHECK (frecuencia IN ('diaria', 'semanal', 'mensual')),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE limpiezas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lectura pública limpiezas"  ON limpiezas FOR SELECT USING (true);
CREATE POLICY "Inserción limpiezas"        ON limpiezas FOR INSERT WITH CHECK (true);
CREATE POLICY "Actualización limpiezas"    ON limpiezas FOR UPDATE USING (true);
CREATE POLICY "Eliminación limpiezas"      ON limpiezas FOR DELETE USING (true);

-- VISITAS APPCC
CREATE TABLE IF NOT EXISTS visitas_appcc (
  id BIGSERIAL PRIMARY KEY,
  local_id INTEGER REFERENCES locales(id) ON DELETE SET NULL,
  empleado_nombre TEXT NOT NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  resultado TEXT NOT NULL CHECK (resultado IN ('conforme', 'no_conforme', 'parcial')),
  checklist JSONB NOT NULL DEFAULT '[]',
  observaciones TEXT,
  acciones_correctivas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE visitas_appcc ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lectura pública visitas_appcc"  ON visitas_appcc FOR SELECT USING (true);
CREATE POLICY "Inserción visitas_appcc"        ON visitas_appcc FOR INSERT WITH CHECK (true);
CREATE POLICY "Actualización visitas_appcc"    ON visitas_appcc FOR UPDATE USING (true);
CREATE POLICY "Eliminación visitas_appcc"      ON visitas_appcc FOR DELETE USING (true);

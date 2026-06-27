-- ══════════════════════════════════════════════════════════
-- MÓDULO CONFIGURACIÓN APP — SOFI Dashboard
-- Ejecutar en Supabase Dashboard → SQL Editor → New query
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS configuracion_app (
  id         BIGSERIAL PRIMARY KEY,
  clave      TEXT NOT NULL UNIQUE,
  valor      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Valor inicial: fichaje activado
INSERT INTO configuracion_app (clave, valor)
VALUES ('fichaje_activo', 'true')
ON CONFLICT (clave) DO NOTHING;

-- RLS
ALTER TABLE configuracion_app ENABLE ROW LEVEL SECURITY;

-- Lectura: cualquier usuario autenticado
CREATE POLICY "config_select"
  ON configuracion_app FOR SELECT
  TO authenticated
  USING (true);

-- Escritura: cualquier usuario autenticado (el control de acceso es por UI)
CREATE POLICY "config_update"
  ON configuracion_app FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "config_insert"
  ON configuracion_app FOR INSERT
  TO authenticated
  WITH CHECK (true);

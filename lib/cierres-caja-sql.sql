-- ══════════════════════════════════════════════════════════════
-- CIERRES DE CAJA — SOFI Dashboard
-- Ejecutar en Supabase Dashboard → SQL Editor → New query
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cierres_caja (
  id                    BIGSERIAL PRIMARY KEY,
  local_id              BIGINT REFERENCES locales(id) ON DELETE SET NULL,
  fecha_inicio          TIMESTAMPTZ,
  fecha_fin             TIMESTAMPTZ,
  abierto_por           TEXT,
  cerrado_por           TEXT,
  numero_sesion         TEXT UNIQUE,          -- evita duplicados si el webhook llega 2 veces
  ventas_efectivo       NUMERIC(10, 2),
  ventas_tarjeta        NUMERIC(10, 2),
  ventas_uber           NUMERIC(10, 2),
  ventas_total          NUMERIC(10, 2),
  operaciones_efectivo  INTEGER,
  operaciones_tarjeta   INTEGER,
  operaciones_uber      INTEGER,
  ventas_pickup         NUMERIC(10, 2),
  ventas_delivery       NUMERIC(10, 2),
  ventas_self_service   NUMERIC(10, 2),
  ventas_por_categoria  JSONB     NOT NULL DEFAULT '{}',
  desajuste_caja        NUMERIC(10, 2),
  raw_email             TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para búsquedas rápidas por fecha de cierre
CREATE INDEX IF NOT EXISTS idx_cierres_caja_fecha_fin
  ON cierres_caja (fecha_fin DESC);

CREATE INDEX IF NOT EXISTS idx_cierres_caja_local_fecha
  ON cierres_caja (local_id, fecha_fin DESC);

-- RLS
ALTER TABLE cierres_caja ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cierres_select"
  ON cierres_caja FOR SELECT
  TO authenticated
  USING (true);

-- El webhook usa service_role, que bypasea RLS automáticamente

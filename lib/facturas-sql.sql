-- ══════════════════════════════════════════════════════════════
-- FACTURAS DE PROVEEDORES — SOFI Dashboard
-- Ejecutar en Supabase Dashboard → SQL Editor → New query
-- ══════════════════════════════════════════════════════════════

-- ── Tabla principal ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS facturas (
  id                  BIGSERIAL   PRIMARY KEY,
  local_id            BIGINT      REFERENCES locales(id) ON DELETE SET NULL,
  proveedor_id        BIGINT      REFERENCES proveedores(id) ON DELETE SET NULL,
  proveedor_nombre    TEXT,
  proveedor_cif       TEXT,
  numero_factura      TEXT,
  fecha_factura       DATE,
  base_imponible      NUMERIC(10, 2),
  pct_iva             NUMERIC(5,  2),
  cuota_iva           NUMERIC(10, 2),
  total               NUMERIC(10, 2),
  forma_pago          TEXT,
  archivo_url         TEXT,
  datos_extraidos     JSONB       NOT NULL DEFAULT '{}',
  metodo_extraccion   TEXT        NOT NULL DEFAULT 'haiku'
                                  CHECK (metodo_extraccion IN ('regex','haiku','manual')),
  estado              TEXT        NOT NULL DEFAULT 'pendiente'
                                  CHECK (estado IN ('pendiente','revisada','contabilizada','error')),
  contabilizado       BOOLEAN     NOT NULL DEFAULT false,
  pl_mes              INTEGER,
  pl_anio             INTEGER,
  pl_contabilizado_at TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_facturas_fecha
  ON facturas (fecha_factura DESC);
CREATE INDEX IF NOT EXISTS idx_facturas_proveedor
  ON facturas (proveedor_id, fecha_factura DESC);
CREATE INDEX IF NOT EXISTS idx_facturas_estado
  ON facturas (estado);

-- ── Líneas de factura ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS facturas_lineas (
  id              BIGSERIAL   PRIMARY KEY,
  factura_id      BIGINT      NOT NULL REFERENCES facturas(id) ON DELETE CASCADE,
  descripcion     TEXT,
  cantidad        NUMERIC(10, 3),
  unidad          TEXT,
  precio_unitario NUMERIC(10, 4),
  importe         NUMERIC(10, 2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_facturas_lineas_factura
  ON facturas_lineas (factura_id);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE facturas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturas_lineas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "facturas_select"
  ON facturas FOR SELECT TO authenticated USING (true);
CREATE POLICY "facturas_insert"
  ON facturas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "facturas_update"
  ON facturas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "facturas_delete"
  ON facturas FOR DELETE TO authenticated USING (true);

CREATE POLICY "facturas_lineas_select"
  ON facturas_lineas FOR SELECT TO authenticated USING (true);
CREATE POLICY "facturas_lineas_insert"
  ON facturas_lineas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "facturas_lineas_update"
  ON facturas_lineas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "facturas_lineas_delete"
  ON facturas_lineas FOR DELETE TO authenticated USING (true);

-- ── Storage bucket (crear en Supabase Dashboard → Storage) ────
-- Nombre:   facturas-proveedores
-- Tipo:     Private (solo autenticados)
-- Políticas en Dashboard:
--   INSERT: authenticated | SELECT: authenticated

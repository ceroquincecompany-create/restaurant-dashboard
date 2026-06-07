-- ──────────────────────────────────────────────────────────────
-- OPERACIONES v2 — Ejecutar en Supabase SQL Editor
-- ──────────────────────────────────────────────────────────────

-- Ampliar tabla temperaturas con turno + 2 equipos nuevos
ALTER TABLE temperaturas ADD COLUMN IF NOT EXISTS turno TEXT CHECK (turno IN ('mañana','noche'));
ALTER TABLE temperaturas ADD COLUMN IF NOT EXISTS mesa_fria_5 NUMERIC(5,1);
ALTER TABLE temperaturas ADD COLUMN IF NOT EXISTS nevera_6    NUMERIC(5,1);

-- Avisos de equipo (visibles por todos los empleados del local)
CREATE TABLE IF NOT EXISTS avisos_equipo (
  id               BIGSERIAL PRIMARY KEY,
  local_id         INTEGER REFERENCES locales(id) ON DELETE SET NULL,
  empleado_nombre  TEXT NOT NULL,
  categoria        TEXT NOT NULL,
  descripcion      TEXT NOT NULL,
  activo           BOOLEAN NOT NULL DEFAULT true,
  resuelto_por     TEXT,
  fecha_resolucion TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE avisos_equipo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lectura pública avisos_equipo"   ON avisos_equipo FOR SELECT USING (true);
CREATE POLICY "Inserción avisos_equipo"         ON avisos_equipo FOR INSERT WITH CHECK (true);
CREATE POLICY "Actualización avisos_equipo"     ON avisos_equipo FOR UPDATE USING (true);
CREATE POLICY "Eliminación avisos_equipo"       ON avisos_equipo FOR DELETE USING (true);

-- Pedidos a proveedor
CREATE TABLE IF NOT EXISTS pedidos_proveedor (
  id               BIGSERIAL PRIMARY KEY,
  local_id         INTEGER REFERENCES locales(id) ON DELETE SET NULL,
  empleado_nombre  TEXT NOT NULL,
  proveedor_id     INTEGER REFERENCES proveedores(id) ON DELETE SET NULL,
  estado           TEXT NOT NULL DEFAULT 'pendiente'
                     CHECK (estado IN ('pendiente','confirmado','recibido','cancelado')),
  notas            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE pedidos_proveedor ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lectura pública pedidos_proveedor"   ON pedidos_proveedor FOR SELECT USING (true);
CREATE POLICY "Inserción pedidos_proveedor"         ON pedidos_proveedor FOR INSERT WITH CHECK (true);
CREATE POLICY "Actualización pedidos_proveedor"     ON pedidos_proveedor FOR UPDATE USING (true);
CREATE POLICY "Eliminación pedidos_proveedor"       ON pedidos_proveedor FOR DELETE USING (true);

-- Líneas de pedido
CREATE TABLE IF NOT EXISTS pedidos_lineas (
  id               BIGSERIAL PRIMARY KEY,
  pedido_id        BIGINT NOT NULL REFERENCES pedidos_proveedor(id) ON DELETE CASCADE,
  ingrediente_id   INTEGER REFERENCES ingredientes(id) ON DELETE SET NULL,
  cantidad_pedida  NUMERIC(12,4) NOT NULL,
  unidad           TEXT,
  precio_unitario  NUMERIC(12,4),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE pedidos_lineas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lectura pública pedidos_lineas"   ON pedidos_lineas FOR SELECT USING (true);
CREATE POLICY "Inserción pedidos_lineas"         ON pedidos_lineas FOR INSERT WITH CHECK (true);
CREATE POLICY "Actualización pedidos_lineas"     ON pedidos_lineas FOR UPDATE USING (true);
CREATE POLICY "Eliminación pedidos_lineas"       ON pedidos_lineas FOR DELETE USING (true);

-- Recepciones de pedido
CREATE TABLE IF NOT EXISTS recepciones_pedido (
  id               BIGSERIAL PRIMARY KEY,
  pedido_id        BIGINT NOT NULL REFERENCES pedidos_proveedor(id) ON DELETE CASCADE,
  empleado_nombre  TEXT NOT NULL,
  fecha_recepcion  DATE NOT NULL DEFAULT CURRENT_DATE,
  notas            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE recepciones_pedido ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lectura pública recepciones_pedido"   ON recepciones_pedido FOR SELECT USING (true);
CREATE POLICY "Inserción recepciones_pedido"         ON recepciones_pedido FOR INSERT WITH CHECK (true);
CREATE POLICY "Actualización recepciones_pedido"     ON recepciones_pedido FOR UPDATE USING (true);
CREATE POLICY "Eliminación recepciones_pedido"       ON recepciones_pedido FOR DELETE USING (true);

-- Líneas de recepción
CREATE TABLE IF NOT EXISTS recepciones_lineas (
  id                BIGSERIAL PRIMARY KEY,
  recepcion_id      BIGINT NOT NULL REFERENCES recepciones_pedido(id) ON DELETE CASCADE,
  ingrediente_id    INTEGER REFERENCES ingredientes(id) ON DELETE SET NULL,
  cantidad_pedida   NUMERIC(12,4) NOT NULL,
  cantidad_recibida NUMERIC(12,4) NOT NULL,
  precio_real       NUMERIC(12,4),
  diferencia        NUMERIC(12,4) GENERATED ALWAYS AS (cantidad_recibida - cantidad_pedida) STORED,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE recepciones_lineas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lectura pública recepciones_lineas"   ON recepciones_lineas FOR SELECT USING (true);
CREATE POLICY "Inserción recepciones_lineas"         ON recepciones_lineas FOR INSERT WITH CHECK (true);
CREATE POLICY "Actualización recepciones_lineas"     ON recepciones_lineas FOR UPDATE USING (true);
CREATE POLICY "Eliminación recepciones_lineas"       ON recepciones_lineas FOR DELETE USING (true);

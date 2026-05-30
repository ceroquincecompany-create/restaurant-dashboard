-- Schema para el dashboard de restaurantes
-- Ejecutar en Supabase SQL Editor

-- Tabla de locales
CREATE TABLE IF NOT EXISTS locales (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  direccion TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de ventas diarias
CREATE TABLE IF NOT EXISTS ventas (
  id SERIAL PRIMARY KEY,
  local_id INTEGER REFERENCES locales(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  total_ventas NUMERIC(10, 2) NOT NULL DEFAULT 0,
  coste_alimentos NUMERIC(10, 2) NOT NULL DEFAULT 0,
  coste_personal NUMERIC(10, 2) NOT NULL DEFAULT 0,
  num_clientes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(local_id, fecha)
);

-- Datos de ejemplo: 3 locales
INSERT INTO locales (nombre, direccion) VALUES
  ('Local Centro', 'Calle Mayor 10, Madrid'),
  ('Local Norte', 'Av. de la Paz 45, Madrid'),
  ('Local Sur', 'Calle Alcalá 120, Madrid')
ON CONFLICT DO NOTHING;

-- Datos de ejemplo: ventas de los últimos 30 días
INSERT INTO ventas (local_id, fecha, total_ventas, coste_alimentos, coste_personal, num_clientes)
SELECT
  l.id,
  CURRENT_DATE - (generate_series(0, 29) * INTERVAL '1 day'),
  (RANDOM() * 3000 + 1500)::NUMERIC(10,2),
  (RANDOM() * 900 + 400)::NUMERIC(10,2),
  (RANDOM() * 700 + 300)::NUMERIC(10,2),
  (RANDOM() * 100 + 50)::INTEGER
FROM locales l
ON CONFLICT (local_id, fecha) DO NOTHING;

-- Habilitar Row Level Security (opcional)
ALTER TABLE locales ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso público de lectura
CREATE POLICY "Lectura pública locales" ON locales FOR SELECT USING (true);
CREATE POLICY "Lectura pública ventas" ON ventas FOR SELECT USING (true);
CREATE POLICY "Inserción ventas" ON ventas FOR INSERT WITH CHECK (true);
CREATE POLICY "Actualización ventas" ON ventas FOR UPDATE USING (true);

-- ──────────────────────────────────────────────────────────────
-- ESCANDALLOS
-- ──────────────────────────────────────────────────────────────

-- Tabla de ingredientes (Base de datos del Excel)
CREATE TABLE IF NOT EXISTS ingredientes (
  id INTEGER PRIMARY KEY,
  proveedor TEXT,
  nombre_ingrediente TEXT NOT NULL,
  formato_compra TEXT,
  unidad_compra TEXT,
  precio_formato_compra NUMERIC(10, 4),
  unidad_producto TEXT,
  precio_unidad_producto NUMERIC(10, 4),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de resumen de costes por producto
CREATE TABLE IF NOT EXISTS escandallos_resumen (
  id SERIAL PRIMARY KEY,
  familia TEXT,
  producto TEXT NOT NULL,
  coste NUMERIC(10, 4),
  pvp_sin_iva NUMERIC(10, 4),
  pvp_actual NUMERIC(10, 4),
  margen_euros NUMERIC(10, 4),
  margen_pct NUMERIC(6, 2),
  coste_pct NUMERIC(6, 2),
  unidades_vendidas INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE ingredientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE escandallos_resumen ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Lectura pública ingredientes" ON ingredientes FOR SELECT USING (true);
CREATE POLICY "Inserción ingredientes" ON ingredientes FOR INSERT WITH CHECK (true);
CREATE POLICY "Actualización ingredientes" ON ingredientes FOR UPDATE USING (true);
CREATE POLICY "Eliminación ingredientes" ON ingredientes FOR DELETE USING (true);

CREATE POLICY "Lectura pública escandallos_resumen" ON escandallos_resumen FOR SELECT USING (true);
CREATE POLICY "Inserción escandallos_resumen" ON escandallos_resumen FOR INSERT WITH CHECK (true);
CREATE POLICY "Actualización escandallos_resumen" ON escandallos_resumen FOR UPDATE USING (true);
CREATE POLICY "Eliminación escandallos_resumen" ON escandallos_resumen FOR DELETE USING (true);

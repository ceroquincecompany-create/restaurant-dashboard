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

-- ──────────────────────────────────────────────────────────────
-- IDENTIDAD SOFI — ejecutar en Supabase SQL Editor
-- ──────────────────────────────────────────────────────────────
-- UPDATE locales SET nombre = 'SOFI Pinomonotano' WHERE id = 1;
-- UPDATE locales SET nombre = 'Próxima Apertura', activo = false WHERE id = 2;
-- UPDATE locales SET activo = false WHERE id = 3;

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

-- ──────────────────────────────────────────────────────────────
-- FINANZAS — P&L por local, mes, año
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pl_datos (
  id SERIAL PRIMARY KEY,
  local_id INTEGER REFERENCES locales(id) ON DELETE CASCADE,
  año INTEGER NOT NULL,
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  partida TEXT NOT NULL,
  valor_real NUMERIC(12, 2) DEFAULT 0,
  valor_presupuesto NUMERIC(12, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(local_id, año, mes, partida)
);

ALTER TABLE pl_datos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lectura pública pl_datos"   ON pl_datos FOR SELECT USING (true);
CREATE POLICY "Inserción pl_datos"         ON pl_datos FOR INSERT WITH CHECK (true);
CREATE POLICY "Actualización pl_datos"     ON pl_datos FOR UPDATE USING (true);
CREATE POLICY "Eliminación pl_datos"       ON pl_datos FOR DELETE USING (true);

-- Datos de ejemplo: SOFI Pinomonotano (local_id=1), Febrero 2026
INSERT INTO pl_datos (local_id, año, mes, partida, valor_real, valor_presupuesto) VALUES
(1,2026,2,'ventas_sala',45000,42000),
(1,2026,2,'ventas_uber',12000,10000),
(1,2026,2,'proveedores',15000,14000),
(1,2026,2,'inventario_inicial',3000,2800),
(1,2026,2,'inventario_final',2500,2500),
(1,2026,2,'mermas',800,500),
(1,2026,2,'comision_plataforma',1800,1500),
(1,2026,2,'promociones',600,400),
(1,2026,2,'envio_gratis',200,200),
(1,2026,2,'ads_uber',800,600),
(1,2026,2,'devoluciones',150,100),
(1,2026,2,'alquiler',3500,3500),
(1,2026,2,'comunidad',200,200),
(1,2026,2,'basura',80,80),
(1,2026,2,'seguro_local',150,150),
(1,2026,2,'extintores',0,50),
(1,2026,2,'desinsectacion',120,120),
(1,2026,2,'alarma',60,60),
(1,2026,2,'otros_gopex',200,100),
(1,2026,2,'luz',800,700),
(1,2026,2,'agua',150,120),
(1,2026,2,'gas',600,500),
(1,2026,2,'telefonia',100,100),
(1,2026,2,'tpv_kds',150,150),
(1,2026,2,'otros_suministros',50,50),
(1,2026,2,'reparaciones',300,200),
(1,2026,2,'compras_arreglos',150,100),
(1,2026,2,'uniformes',80,0),
(1,2026,2,'menaje_maquinaria',200,150),
(1,2026,2,'otros_mantenimiento',50,50),
(1,2026,2,'foodies',300,300),
(1,2026,2,'carteleria',150,100),
(1,2026,2,'merchandising',50,50),
(1,2026,2,'accion_especial',200,0),
(1,2026,2,'otros_marketing',50,50),
(1,2026,2,'sueldos',14000,13000),
(1,2026,2,'seguros_sociales',4200,3900),
(1,2026,2,'incentivos',500,400)
ON CONFLICT (local_id, año, mes, partida) DO UPDATE SET
  valor_real = EXCLUDED.valor_real,
  valor_presupuesto = EXCLUDED.valor_presupuesto,
  updated_at = NOW();

-- ──────────────────────────────────────────────────────────────
-- PRODUCTOS Y RECETAS
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS productos (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  familia TEXT,
  pvp_sala NUMERIC(10, 4),
  pvp_delivery NUMERIC(10, 4),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(nombre, familia)
);

CREATE TABLE IF NOT EXISTS recetas (
  id SERIAL PRIMARY KEY,
  producto_id INTEGER REFERENCES productos(id) ON DELETE CASCADE,
  ingrediente_id INTEGER REFERENCES ingredientes(id) ON DELETE SET NULL,
  cantidad_bruta NUMERIC(12, 6),
  cantidad_neta NUMERIC(12, 6),
  merma_pct NUMERIC(8, 6) DEFAULT 0,
  coste NUMERIC(12, 6),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE recetas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura pública productos"   ON productos FOR SELECT USING (true);
CREATE POLICY "Inserción productos"         ON productos FOR INSERT WITH CHECK (true);
CREATE POLICY "Actualización productos"     ON productos FOR UPDATE USING (true);
CREATE POLICY "Eliminación productos"       ON productos FOR DELETE USING (true);

CREATE POLICY "Lectura pública recetas"     ON recetas FOR SELECT USING (true);
CREATE POLICY "Inserción recetas"           ON recetas FOR INSERT WITH CHECK (true);
CREATE POLICY "Actualización recetas"       ON recetas FOR UPDATE USING (true);
CREATE POLICY "Eliminación recetas"         ON recetas FOR DELETE USING (true);

-- ──────────────────────────────────────────────────────────────
-- PROVEEDORES
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS proveedores (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  cif TEXT,
  direccion TEXT,
  contacto TEXT,
  telefono TEXT,
  email TEXT,
  dias_entrega TEXT[] DEFAULT '{}',
  canal_aviso TEXT,
  forma_pago TEXT,
  iban TEXT,
  notas TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lectura pública proveedores" ON proveedores FOR SELECT USING (true);
CREATE POLICY "Inserción proveedores"       ON proveedores FOR INSERT WITH CHECK (true);
CREATE POLICY "Actualización proveedores"   ON proveedores FOR UPDATE USING (true);
CREATE POLICY "Eliminación proveedores"     ON proveedores FOR DELETE USING (true);

-- Añadir FK proveedor_id a ingredientes (idempotente)
ALTER TABLE ingredientes ADD COLUMN IF NOT EXISTS proveedor_id INTEGER REFERENCES proveedores(id) ON DELETE SET NULL;

-- Hacer que ingredientes.id sea auto-incremental para nuevas filas
CREATE SEQUENCE IF NOT EXISTS ingredientes_id_seq START WITH 200;
ALTER TABLE ingredientes ALTER COLUMN id SET DEFAULT nextval('ingredientes_id_seq');
SELECT setval('ingredientes_id_seq', GREATEST((SELECT MAX(id) FROM ingredientes), 199) + 1);

-- Políticas
CREATE POLICY "Lectura pública ingredientes" ON ingredientes FOR SELECT USING (true);
CREATE POLICY "Inserción ingredientes" ON ingredientes FOR INSERT WITH CHECK (true);
CREATE POLICY "Actualización ingredientes" ON ingredientes FOR UPDATE USING (true);
CREATE POLICY "Eliminación ingredientes" ON ingredientes FOR DELETE USING (true);

CREATE POLICY "Lectura pública escandallos_resumen" ON escandallos_resumen FOR SELECT USING (true);
CREATE POLICY "Inserción escandallos_resumen" ON escandallos_resumen FOR INSERT WITH CHECK (true);
CREATE POLICY "Actualización escandallos_resumen" ON escandallos_resumen FOR UPDATE USING (true);
CREATE POLICY "Eliminación escandallos_resumen" ON escandallos_resumen FOR DELETE USING (true);

-- ──────────────────────────────────────────────────────────────
-- RRHH
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS empleados (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  puesto TEXT NOT NULL DEFAULT 'Sala',
  local_id BIGINT REFERENCES locales(id),
  horas_contrato NUMERIC NOT NULL DEFAULT 40,
  salario_bruto NUMERIC,
  coste_empresa_pct NUMERIC NOT NULL DEFAULT 1.31,
  fecha_inicio DATE,
  estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'baja', 'vacaciones')),
  iban TEXT,
  nss TEXT,
  email_acceso TEXT,
  notas TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS turnos (
  id BIGSERIAL PRIMARY KEY,
  empleado_id BIGINT NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  tipo_turno TEXT NOT NULL,
  hora_inicio TIME,
  hora_fin TIME,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fichajes (
  id BIGSERIAL PRIMARY KEY,
  empleado_id BIGINT NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  hora_entrada TIME,
  hora_salida TIME,
  horas_total NUMERIC,
  horas_nocturnas NUMERIC,
  horas_extra NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE empleados ENABLE ROW LEVEL SECURITY;
ALTER TABLE turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE fichajes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura pública empleados"  ON empleados FOR SELECT USING (true);
CREATE POLICY "Inserción empleados"        ON empleados FOR INSERT WITH CHECK (true);
CREATE POLICY "Actualización empleados"    ON empleados FOR UPDATE USING (true);
CREATE POLICY "Eliminación empleados"      ON empleados FOR DELETE USING (true);

-- ──────────────────────────────────────────────────────────────
-- SANCIONES Y AVISOS
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sanciones (
  id BIGSERIAL PRIMARY KEY,
  empleado_id BIGINT NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('aviso_verbal','amonestacion_escrita','sancion_grave','sancion_muy_grave')),
  fecha DATE NOT NULL,
  descripcion TEXT NOT NULL,
  firmado BOOLEAN NOT NULL DEFAULT false,
  notas TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sanciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lectura pública sanciones"  ON sanciones FOR SELECT USING (true);
CREATE POLICY "Inserción sanciones"        ON sanciones FOR INSERT WITH CHECK (true);
CREATE POLICY "Actualización sanciones"    ON sanciones FOR UPDATE USING (true);
CREATE POLICY "Eliminación sanciones"      ON sanciones FOR DELETE USING (true);

-- ──────────────────────────────────────────────────────────────
-- INCENTIVOS
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS planes_incentivo (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('encargado','staff')),
  local_id BIGINT REFERENCES locales(id),
  trimestre INTEGER NOT NULL CHECK (trimestre BETWEEN 1 AND 4),
  año INTEGER NOT NULL,
  vigencia_inicio DATE,
  vigencia_fin DATE,
  importe_base NUMERIC,
  pct_facturacion NUMERIC,
  kpis JSONB NOT NULL DEFAULT '[]',
  clausulas JSONB NOT NULL DEFAULT '[]',
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tipo, local_id, trimestre, año)
);

CREATE TABLE IF NOT EXISTS incentivos_empleado (
  id BIGSERIAL PRIMARY KEY,
  empleado_id BIGINT NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  plan_id BIGINT NOT NULL REFERENCES planes_incentivo(id) ON DELETE CASCADE,
  trimestre INTEGER NOT NULL,
  año INTEGER NOT NULL,
  dias_efectivos INTEGER,
  dias_periodo INTEGER,
  bono_calculado NUMERIC,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','activado','pagado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(empleado_id, trimestre, año)
);

ALTER TABLE planes_incentivo ENABLE ROW LEVEL SECURITY;
ALTER TABLE incentivos_empleado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura pública planes_incentivo"       ON planes_incentivo FOR SELECT USING (true);
CREATE POLICY "Inserción planes_incentivo"             ON planes_incentivo FOR INSERT WITH CHECK (true);
CREATE POLICY "Actualización planes_incentivo"         ON planes_incentivo FOR UPDATE USING (true);
CREATE POLICY "Eliminación planes_incentivo"           ON planes_incentivo FOR DELETE USING (true);

CREATE POLICY "Lectura pública incentivos_empleado"    ON incentivos_empleado FOR SELECT USING (true);
CREATE POLICY "Inserción incentivos_empleado"          ON incentivos_empleado FOR INSERT WITH CHECK (true);
CREATE POLICY "Actualización incentivos_empleado"      ON incentivos_empleado FOR UPDATE USING (true);
CREATE POLICY "Eliminación incentivos_empleado"        ON incentivos_empleado FOR DELETE USING (true);

-- Planes iniciales Q2 2026 (vigencia desde 1 Mayo)
INSERT INTO planes_incentivo (nombre, tipo, local_id, trimestre, año, vigencia_inicio, vigencia_fin, importe_base, pct_facturacion, kpis, clausulas)
VALUES
(
  'Plan Encargado Q2 2026', 'encargado',
  (SELECT id FROM locales WHERE nombre ILIKE '%pinomonotano%' LIMIT 1),
  2, 2026, '2026-05-01', '2026-06-30', 400, NULL,
  '[
    {"nombre":"Reseñas Google","peso":0.20,"objetivo":4.3,"tipo":"mayor_igual","unidad":"★","descripcion":"Nota media Google (mín 30 reseñas/mes)","valor_real":null},
    {"nombre":"Coste Personal","peso":0.20,"objetivo":28,"tipo":"menor_igual","unidad":"%","descripcion":"% coste personal sobre ventas","valor_real":null},
    {"nombre":"Ticket Medio","peso":0.30,"objetivo":16,"tipo":"mayor_igual","unidad":"€","descripcion":"Ticket medio trimestral","valor_real":null},
    {"nombre":"Coste Producto","peso":0.30,"objetivo":30,"tipo":"menor_igual","unidad":"%","descripcion":"% food cost sobre ventas","valor_real":null}
  ]',
  '[
    {"id":"ebitda","nombre":"EBITDA ≥ 90% presupuesto","valor":null},
    {"id":"auditoria","nombre":"Auditoría interna ≥ 90%","valor":null},
    {"id":"prorrateo","nombre":"Prorrateo por días efectivos","informativa":true},
    {"id":"confidencialidad","nombre":"Confidencialidad","informativa":true}
  ]'
),
(
  'Plan Staff Q2 2026', 'staff',
  (SELECT id FROM locales WHERE nombre ILIKE '%pinomonotano%' LIMIT 1),
  2, 2026, '2026-05-01', '2026-06-30', NULL, 1.5,
  '[
    {"nombre":"Reseñas Google","peso":0.30,"objetivo":4.3,"tipo":"mayor_igual","unidad":"★","descripcion":"Nota media Google (mín 30 reseñas/mes)","valor_real":null},
    {"nombre":"Tiempo Preparación","peso":0.20,"objetivo":10,"tipo":"menor_igual","unidad":"min","descripcion":"Tiempo medio de preparación (media trimestral)","valor_real":null},
    {"nombre":"Ticket Medio","peso":0.30,"objetivo":16,"tipo":"mayor_igual","unidad":"€","descripcion":"Ticket medio trimestral","valor_real":null},
    {"nombre":"Coste Producto","peso":0.20,"objetivo":30,"tipo":"menor_igual","unidad":"%","descripcion":"% food cost sobre ventas","valor_real":null}
  ]',
  '[
    {"id":"ebitda","nombre":"EBITDA ≥ 90% presupuesto","valor":null},
    {"id":"auditoria","nombre":"Auditoría interna ≥ 90%","valor":null},
    {"id":"prorrateo","nombre":"Prorrateo por días efectivos","informativa":true},
    {"id":"confidencialidad","nombre":"Confidencialidad","informativa":true}
  ]'
)
ON CONFLICT (tipo, local_id, trimestre, año) DO NOTHING;

CREATE POLICY "Lectura pública turnos"     ON turnos FOR SELECT USING (true);
CREATE POLICY "Inserción turnos"           ON turnos FOR INSERT WITH CHECK (true);
CREATE POLICY "Actualización turnos"       ON turnos FOR UPDATE USING (true);
CREATE POLICY "Eliminación turnos"         ON turnos FOR DELETE USING (true);

CREATE POLICY "Lectura pública fichajes"   ON fichajes FOR SELECT USING (true);
CREATE POLICY "Inserción fichajes"         ON fichajes FOR INSERT WITH CHECK (true);
CREATE POLICY "Actualización fichajes"     ON fichajes FOR UPDATE USING (true);
CREATE POLICY "Eliminación fichajes"       ON fichajes FOR DELETE USING (true);

-- Empleados iniciales SOFI Pinomonotano
INSERT INTO empleados (nombre, puesto, local_id, horas_contrato, estado) VALUES
  ('Álvaro Torralbo Rete',     'Sala',   (SELECT id FROM locales WHERE nombre ILIKE '%pinomonotano%' LIMIT 1), 24, 'baja'),
  ('Celeste Santos Garzón',    'Sala',   (SELECT id FROM locales WHERE nombre ILIKE '%pinomonotano%' LIMIT 1), 38, 'baja'),
  ('Abdelkader Khedim',        'Cocina', (SELECT id FROM locales WHERE nombre ILIKE '%pinomonotano%' LIMIT 1), 40, 'activo'),
  ('Eva María Caballero Costa','Sala',   (SELECT id FROM locales WHERE nombre ILIKE '%pinomonotano%' LIMIT 1), 29, 'activo'),
  ('Sergio Hidalgo Lorca',     'Sala',   (SELECT id FROM locales WHERE nombre ILIKE '%pinomonotano%' LIMIT 1), 30, 'activo'),
  ('Raúl Benavente Rossi',     'Sala',   (SELECT id FROM locales WHERE nombre ILIKE '%pinomonotano%' LIMIT 1), 15, 'activo')
ON CONFLICT DO NOTHING;

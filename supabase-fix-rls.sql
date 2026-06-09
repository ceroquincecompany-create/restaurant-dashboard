-- ════════════════════════════════════════════════════════════════════════════
-- SOFI Pinomonotano — Corrección de RLS y creación de tablas faltantes
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ════════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────────
-- 1. MERMAS — Permitir lectura para usuarios autenticados (admin)
-- ────────────────────────────────────────────────────────────────────────────

-- Habilitar RLS si no está activo
ALTER TABLE mermas ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas conflictivas previas (si existen)
DROP POLICY IF EXISTS "Lectura mermas autenticados" ON mermas;
DROP POLICY IF EXISTS "Insertar mermas" ON mermas;
DROP POLICY IF EXISTS "Eliminar mermas" ON mermas;
DROP POLICY IF EXISTS "Actualizar mermas" ON mermas;

-- Lectura: cualquier usuario autenticado (admins y empleados logueados)
CREATE POLICY "Lectura mermas autenticados" ON mermas
  FOR SELECT USING (auth.role() = 'authenticated');

-- Inserción: cualquier usuario autenticado
CREATE POLICY "Insertar mermas" ON mermas
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Actualización: cualquier usuario autenticado
CREATE POLICY "Actualizar mermas" ON mermas
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Eliminación: cualquier usuario autenticado
CREATE POLICY "Eliminar mermas" ON mermas
  FOR DELETE USING (auth.role() = 'authenticated');


-- ────────────────────────────────────────────────────────────────────────────
-- 2. OFERTAS DE TRABAJO — Crear tabla si no existe
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ofertas_trabajo (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  puesto      TEXT NOT NULL,
  descripcion TEXT,
  horario     TEXT,
  salario     TEXT,
  fecha_inicio TEXT,
  estado      TEXT NOT NULL DEFAULT 'activa'
                   CHECK (estado IN ('activa', 'pausada', 'cerrada')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ofertas_trabajo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura ofertas activas publica" ON ofertas_trabajo;
DROP POLICY IF EXISTS "Gestión ofertas autenticados"   ON ofertas_trabajo;

-- Lectura pública: las ofertas activas son visibles sin login (para /trabajo)
CREATE POLICY "Lectura ofertas activas publica" ON ofertas_trabajo
  FOR SELECT USING (estado = 'activa' OR auth.role() = 'authenticated');

-- Gestión: solo usuarios autenticados pueden crear/editar/borrar
CREATE POLICY "Gestión ofertas autenticados" ON ofertas_trabajo
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');


-- ────────────────────────────────────────────────────────────────────────────
-- 3. CANDIDATURAS — Crear tabla si no existe
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS candidaturas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oferta_id       UUID REFERENCES ofertas_trabajo(id) ON DELETE SET NULL,
  nombre          TEXT NOT NULL,
  telefono        TEXT NOT NULL,
  email           TEXT,
  experiencia     TEXT,
  disponibilidad  TEXT[],
  tiene_vehiculo  BOOLEAN DEFAULT FALSE,
  descripcion     TEXT,
  estado          TEXT NOT NULL DEFAULT 'recibido'
                       CHECK (estado IN ('recibido','contactado','entrevista','contratado','descartado')),
  notas_proceso   TEXT,
  interesante     BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE candidaturas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Insertar candidatura pública"   ON candidaturas;
DROP POLICY IF EXISTS "Lectura candidaturas admin"     ON candidaturas;
DROP POLICY IF EXISTS "Actualizar candidaturas admin"  ON candidaturas;
DROP POLICY IF EXISTS "Eliminar candidaturas admin"    ON candidaturas;

-- Inserción pública: cualquiera puede enviar su candidatura desde /trabajo
CREATE POLICY "Insertar candidatura pública" ON candidaturas
  FOR INSERT WITH CHECK (true);

-- Lectura: solo usuarios autenticados (admins)
CREATE POLICY "Lectura candidaturas admin" ON candidaturas
  FOR SELECT USING (auth.role() = 'authenticated');

-- Actualización: solo usuarios autenticados
CREATE POLICY "Actualizar candidaturas admin" ON candidaturas
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Eliminación: solo usuarios autenticados
CREATE POLICY "Eliminar candidaturas admin" ON candidaturas
  FOR DELETE USING (auth.role() = 'authenticated');


-- ────────────────────────────────────────────────────────────────────────────
-- 4. INVENTARIO CONTEOS — Añadir columnas si no existen
--    (Ejecuta solo si no corriste supabase-inventario-mejora.sql antes)
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE inventario_conteos
  ADD COLUMN IF NOT EXISTS cerrado BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE inventario_conteos
  ADD COLUMN IF NOT EXISTS inventario_grupo_id UUID;

-- Constraint único para evitar duplicados al hacer upsert
ALTER TABLE inventario_conteos
  DROP CONSTRAINT IF EXISTS inventario_conteos_empleado_fecha_ing_unique;

ALTER TABLE inventario_conteos
  ADD CONSTRAINT inventario_conteos_empleado_fecha_ing_unique
  UNIQUE (empleado_id, fecha, ingrediente_id);

-- Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_inventario_conteos_grupo
  ON inventario_conteos (inventario_grupo_id);

CREATE INDEX IF NOT EXISTS idx_inventario_conteos_fecha
  ON inventario_conteos (fecha DESC);

CREATE INDEX IF NOT EXISTS idx_inventario_conteos_cerrado
  ON inventario_conteos (cerrado);


-- ────────────────────────────────────────────────────────────────────────────
-- FIN
-- ────────────────────────────────────────────────────────────────────────────

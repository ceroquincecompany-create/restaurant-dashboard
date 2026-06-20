-- ══════════════════════════════════════════════
-- MÓDULO COMUNIDAD — SOFI Dashboard
-- Ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════

-- Chat de equipo
CREATE TABLE IF NOT EXISTS mensajes_chat (
  id          BIGSERIAL PRIMARY KEY,
  local_id    INTEGER REFERENCES locales(id) ON DELETE SET NULL,
  empleado_nombre TEXT NOT NULL,
  mensaje     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Anuncios del equipo
CREATE TABLE IF NOT EXISTS anuncios (
  id          BIGSERIAL PRIMARY KEY,
  local_id    INTEGER REFERENCES locales(id) ON DELETE SET NULL,
  titulo      TEXT NOT NULL,
  texto       TEXT NOT NULL,
  fijado      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Control de lecturas de anuncios
CREATE TABLE IF NOT EXISTS anuncios_vistos (
  id           BIGSERIAL PRIMARY KEY,
  anuncio_id   BIGINT NOT NULL REFERENCES anuncios(id) ON DELETE CASCADE,
  empleado_id  INTEGER NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  fecha_visto  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(anuncio_id, empleado_id)
);

-- Bitácora de turno
CREATE TABLE IF NOT EXISTS bitacora_turno (
  id              BIGSERIAL PRIMARY KEY,
  local_id        INTEGER REFERENCES locales(id) ON DELETE SET NULL,
  empleado_nombre TEXT NOT NULL,
  turno           TEXT NOT NULL CHECK (turno IN ('mañana', 'tarde', 'noche')),
  nota            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reconocimientos del equipo
CREATE TABLE IF NOT EXISTS reconocimientos (
  id              BIGSERIAL PRIMARY KEY,
  local_id        INTEGER REFERENCES locales(id) ON DELETE SET NULL,
  empleado_id     INTEGER REFERENCES empleados(id) ON DELETE SET NULL,
  tipo            TEXT NOT NULL,
  motivo          TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Documentos de formación y manuales
CREATE TABLE IF NOT EXISTS documentos_formacion (
  id          BIGSERIAL PRIMARY KEY,
  titulo      TEXT NOT NULL,
  descripcion TEXT,
  categoria   TEXT NOT NULL CHECK (categoria IN ('Manual', 'Formación', 'Protocolo', 'Otro')),
  archivo_url TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Columna fecha_nacimiento en empleados (si no existe)
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE;

-- Storage bucket para documentos de formación
-- Crear en Supabase Dashboard → Storage → New bucket → "formacion-docs" (public)

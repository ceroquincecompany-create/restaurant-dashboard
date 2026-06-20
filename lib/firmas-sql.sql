-- ══════════════════════════════════════════════════════════════
-- BLOQUE 1 · Fix RLS — documentos_formacion + Storage bucket
-- ══════════════════════════════════════════════════════════════

-- 1a. Habilitar RLS en la tabla y crear políticas permisivas
ALTER TABLE documentos_formacion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "formacion_select" ON documentos_formacion;
DROP POLICY IF EXISTS "formacion_insert" ON documentos_formacion;
DROP POLICY IF EXISTS "formacion_update" ON documentos_formacion;
DROP POLICY IF EXISTS "formacion_delete" ON documentos_formacion;

CREATE POLICY "formacion_select" ON documentos_formacion FOR SELECT TO authenticated USING (true);
CREATE POLICY "formacion_insert" ON documentos_formacion FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "formacion_update" ON documentos_formacion FOR UPDATE TO authenticated USING (true);
CREATE POLICY "formacion_delete" ON documentos_formacion FOR DELETE TO authenticated USING (true);

-- 1b. Storage bucket "formacion-docs"
--     Ejecutar DESPUÉS de crear el bucket en Supabase Dashboard → Storage
DROP POLICY IF EXISTS "formacion_docs_upload"   ON storage.objects;
DROP POLICY IF EXISTS "formacion_docs_read"     ON storage.objects;
DROP POLICY IF EXISTS "formacion_docs_delete"   ON storage.objects;

CREATE POLICY "formacion_docs_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'formacion-docs');

CREATE POLICY "formacion_docs_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'formacion-docs');

CREATE POLICY "formacion_docs_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'formacion-docs');

-- 1c. Políticas para el resto de tablas de comunidad
--     (por si aún no las tienen activadas)
ALTER TABLE mensajes_chat     ENABLE ROW LEVEL SECURITY;
ALTER TABLE anuncios          ENABLE ROW LEVEL SECURITY;
ALTER TABLE anuncios_vistos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE bitacora_turno    ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconocimientos   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mensajes_chat_all"   ON mensajes_chat;
DROP POLICY IF EXISTS "anuncios_all"        ON anuncios;
DROP POLICY IF EXISTS "anuncios_vistos_all" ON anuncios_vistos;
DROP POLICY IF EXISTS "bitacora_all"        ON bitacora_turno;
DROP POLICY IF EXISTS "reconocimientos_all" ON reconocimientos;

CREATE POLICY "mensajes_chat_all"   ON mensajes_chat   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anuncios_all"        ON anuncios        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anuncios_vistos_all" ON anuncios_vistos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "bitacora_all"        ON bitacora_turno  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "reconocimientos_all" ON reconocimientos FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ══════════════════════════════════════════════════════════════
-- BLOQUE 2 · Módulo de Firmas Digitales
-- ══════════════════════════════════════════════════════════════

-- Documento que se envía para firmar
CREATE TABLE IF NOT EXISTS documentos_firma (
  id            BIGSERIAL PRIMARY KEY,
  tipo          TEXT NOT NULL,
  titulo        TEXT NOT NULL,
  texto         TEXT NOT NULL,
  empleado_id   INTEGER REFERENCES empleados(id) ON DELETE SET NULL,  -- NULL = todos los empleados
  fecha_limite  DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Registro de cada firma individual
CREATE TABLE IF NOT EXISTS firmas (
  id              BIGSERIAL PRIMARY KEY,
  documento_id    BIGINT NOT NULL REFERENCES documentos_firma(id) ON DELETE CASCADE,
  empleado_id     INTEGER NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  firmado         BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_firma     TIMESTAMPTZ,
  firma_data      TEXT,         -- base64 del canvas o texto de confirmación
  nombre_firmante TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(documento_id, empleado_id)
);

-- RLS para nuevas tablas
ALTER TABLE documentos_firma ENABLE ROW LEVEL SECURITY;
ALTER TABLE firmas           ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "firma_docs_all" ON documentos_firma;
DROP POLICY IF EXISTS "firmas_all"     ON firmas;

CREATE POLICY "firma_docs_all" ON documentos_firma FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "firmas_all"     ON firmas           FOR ALL TO authenticated USING (true) WITH CHECK (true);

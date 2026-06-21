-- ══════════════════════════════════════════════════════════════════
-- FIX COMPLETO — RLS + Realtime + Storage — SOFI Dashboard
-- Ejecutar completo en Supabase SQL Editor (Dashboard → SQL Editor)
-- ══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- BLOQUE 1 · RLS para todas las tablas de Comunidad
-- ─────────────────────────────────────────────────────────────────

-- mensajes_chat
ALTER TABLE mensajes_chat ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mensajes_chat_select" ON mensajes_chat;
DROP POLICY IF EXISTS "mensajes_chat_insert" ON mensajes_chat;
DROP POLICY IF EXISTS "mensajes_chat_all"    ON mensajes_chat;
CREATE POLICY "mensajes_chat_select" ON mensajes_chat FOR SELECT TO authenticated USING (true);
CREATE POLICY "mensajes_chat_insert" ON mensajes_chat FOR INSERT TO authenticated WITH CHECK (true);

-- anuncios
ALTER TABLE anuncios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anuncios_select" ON anuncios;
DROP POLICY IF EXISTS "anuncios_insert" ON anuncios;
DROP POLICY IF EXISTS "anuncios_delete" ON anuncios;
DROP POLICY IF EXISTS "anuncios_all"    ON anuncios;
CREATE POLICY "anuncios_select" ON anuncios FOR SELECT TO authenticated USING (true);
CREATE POLICY "anuncios_insert" ON anuncios FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "anuncios_delete" ON anuncios FOR DELETE TO authenticated USING (true);

-- anuncios_vistos
ALTER TABLE anuncios_vistos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anuncios_vistos_select" ON anuncios_vistos;
DROP POLICY IF EXISTS "anuncios_vistos_insert" ON anuncios_vistos;
DROP POLICY IF EXISTS "anuncios_vistos_all"    ON anuncios_vistos;
CREATE POLICY "anuncios_vistos_select" ON anuncios_vistos FOR SELECT TO authenticated USING (true);
CREATE POLICY "anuncios_vistos_insert" ON anuncios_vistos FOR INSERT TO authenticated WITH CHECK (true);

-- bitacora_turno
ALTER TABLE bitacora_turno ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bitacora_select" ON bitacora_turno;
DROP POLICY IF EXISTS "bitacora_insert" ON bitacora_turno;
DROP POLICY IF EXISTS "bitacora_delete" ON bitacora_turno;
DROP POLICY IF EXISTS "bitacora_all"    ON bitacora_turno;
CREATE POLICY "bitacora_select" ON bitacora_turno FOR SELECT TO authenticated USING (true);
CREATE POLICY "bitacora_insert" ON bitacora_turno FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "bitacora_delete" ON bitacora_turno FOR DELETE TO authenticated USING (true);

-- reconocimientos
ALTER TABLE reconocimientos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reconocimientos_select" ON reconocimientos;
DROP POLICY IF EXISTS "reconocimientos_insert" ON reconocimientos;
DROP POLICY IF EXISTS "reconocimientos_delete" ON reconocimientos;
DROP POLICY IF EXISTS "reconocimientos_all"    ON reconocimientos;
CREATE POLICY "reconocimientos_select" ON reconocimientos FOR SELECT TO authenticated USING (true);
CREATE POLICY "reconocimientos_insert" ON reconocimientos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "reconocimientos_delete" ON reconocimientos FOR DELETE TO authenticated USING (true);

-- documentos_formacion
ALTER TABLE documentos_formacion ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "formacion_select" ON documentos_formacion;
DROP POLICY IF EXISTS "formacion_insert" ON documentos_formacion;
DROP POLICY IF EXISTS "formacion_delete" ON documentos_formacion;
DROP POLICY IF EXISTS "formacion_update" ON documentos_formacion;
CREATE POLICY "formacion_select" ON documentos_formacion FOR SELECT TO authenticated USING (true);
CREATE POLICY "formacion_insert" ON documentos_formacion FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "formacion_delete" ON documentos_formacion FOR DELETE TO authenticated USING (true);

-- documentos_firma
ALTER TABLE documentos_firma ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "firma_docs_select" ON documentos_firma;
DROP POLICY IF EXISTS "firma_docs_insert" ON documentos_firma;
DROP POLICY IF EXISTS "firma_docs_delete" ON documentos_firma;
DROP POLICY IF EXISTS "firma_docs_all"    ON documentos_firma;
CREATE POLICY "firma_docs_select" ON documentos_firma FOR SELECT TO authenticated USING (true);
CREATE POLICY "firma_docs_insert" ON documentos_firma FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "firma_docs_delete" ON documentos_firma FOR DELETE TO authenticated USING (true);

-- firmas
ALTER TABLE firmas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "firmas_select" ON firmas;
DROP POLICY IF EXISTS "firmas_insert" ON firmas;
DROP POLICY IF EXISTS "firmas_upsert" ON firmas;
DROP POLICY IF EXISTS "firmas_all"    ON firmas;
CREATE POLICY "firmas_select" ON firmas FOR SELECT TO authenticated USING (true);
CREATE POLICY "firmas_insert" ON firmas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "firmas_update" ON firmas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────
-- BLOQUE 2 · Realtime para mensajes_chat
-- Necesario para que postgres_changes funcione en el chat
-- ─────────────────────────────────────────────────────────────────

-- Habilitar replica identity full (para que Realtime envíe el row completo)
ALTER TABLE mensajes_chat REPLICA IDENTITY FULL;

-- Añadir tabla a la publicación supabase_realtime
-- (equivalente a activar el switch en Dashboard → Database → Replication)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'mensajes_chat'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE mensajes_chat;
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────
-- BLOQUE 3 · Storage bucket "formacion-docs"
-- Ejecutar DESPUÉS de crear el bucket en Dashboard → Storage → New bucket
-- Nombre exacto del bucket: formacion-docs  (público)
-- ─────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "formacion_docs_upload"   ON storage.objects;
DROP POLICY IF EXISTS "formacion_docs_read"     ON storage.objects;
DROP POLICY IF EXISTS "formacion_docs_delete"   ON storage.objects;
DROP POLICY IF EXISTS "formacion_docs_update"   ON storage.objects;

-- Subida: solo usuarios autenticados
CREATE POLICY "formacion_docs_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'formacion-docs');

-- Lectura: público (para poder abrir el enlace sin sesión)
CREATE POLICY "formacion_docs_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'formacion-docs');

-- Eliminación: solo autenticados
CREATE POLICY "formacion_docs_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'formacion-docs');

-- ══════════════════════════════════════════════════════════════════
-- MÓDULO VACACIONES + FIRMAS — SOFI Dashboard
-- Ejecutar en Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════

-- 1. Añadir columna de enlace a documento de firma en solicitudes_vacaciones
ALTER TABLE solicitudes_vacaciones
  ADD COLUMN IF NOT EXISTS documento_firma_id BIGINT REFERENCES documentos_firma(id) ON DELETE SET NULL;

-- 2. RLS para solicitudes_vacaciones
ALTER TABLE solicitudes_vacaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vacaciones_select" ON solicitudes_vacaciones;
DROP POLICY IF EXISTS "vacaciones_insert" ON solicitudes_vacaciones;
DROP POLICY IF EXISTS "vacaciones_update" ON solicitudes_vacaciones;
DROP POLICY IF EXISTS "vacaciones_delete" ON solicitudes_vacaciones;

CREATE POLICY "vacaciones_select" ON solicitudes_vacaciones FOR SELECT TO authenticated USING (true);
CREATE POLICY "vacaciones_insert" ON solicitudes_vacaciones FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "vacaciones_update" ON solicitudes_vacaciones FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "vacaciones_delete" ON solicitudes_vacaciones FOR DELETE TO authenticated USING (true);

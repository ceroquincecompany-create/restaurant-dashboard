-- ══════════════════════════════════════════════════════════════
-- EMAILS PROCESADOS — deduplicación para polling de Resend
-- Ejecutar en Supabase Dashboard → SQL Editor → New query
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS emails_procesados (
  id_resend    TEXT        PRIMARY KEY,          -- ID del email en Resend (único)
  tipo         TEXT        NOT NULL DEFAULT 'desconocido',
                                                 -- 'cierre_caja' | 'factura' | 'desconocido'
  asunto       TEXT,
  remitente    TEXT,
  cierre_id    BIGINT      REFERENCES cierres_caja(id) ON DELETE SET NULL,
  error        TEXT,                             -- mensaje si el parsing falló
  procesado_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para detectar rápido si un email ya fue procesado
CREATE INDEX IF NOT EXISTS idx_emails_procesados_tipo
  ON emails_procesados (tipo, procesado_at DESC);

-- RLS
ALTER TABLE emails_procesados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "emails_procesados_select"
  ON emails_procesados FOR SELECT
  TO authenticated
  USING (true);

-- El endpoint usa service_role y bypasea RLS automáticamente

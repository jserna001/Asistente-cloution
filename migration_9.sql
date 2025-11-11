-- =====================================================
-- MIGRATION 9: Tracking de interacciones con resúmenes
-- =====================================================
-- Ejecutar en Supabase SQL Editor

-- Crear tabla para trackear interacciones del usuario con los resúmenes
CREATE TABLE IF NOT EXISTS summary_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary_id UUID NOT NULL REFERENCES daily_summaries(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL, -- 'view', 'click_notion', 'click_gmail', 'click_calendar', 'copy_text'
  target_id TEXT, -- ID del item clickeado (notion page id, gmail thread id, etc.)
  target_url TEXT, -- URL completa del link clickeado
  metadata JSONB, -- Info adicional (posición del link, etc.)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_summary_interactions_user_id
ON summary_interactions(user_id);

CREATE INDEX IF NOT EXISTS idx_summary_interactions_summary_id
ON summary_interactions(summary_id);

CREATE INDEX IF NOT EXISTS idx_summary_interactions_type
ON summary_interactions(interaction_type);

CREATE INDEX IF NOT EXISTS idx_summary_interactions_created_at
ON summary_interactions(created_at DESC);

-- Habilitar RLS (Row Level Security)
ALTER TABLE summary_interactions ENABLE ROW LEVEL SECURITY;

-- Policy: Los usuarios solo pueden insertar sus propias interacciones
CREATE POLICY "Users can insert own interactions"
ON summary_interactions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Los usuarios solo pueden ver sus propias interacciones
CREATE POLICY "Users can view own interactions"
ON summary_interactions
FOR SELECT
USING (auth.uid() = user_id);

-- Comentarios para documentación
COMMENT ON TABLE summary_interactions IS 'Trackea las interacciones del usuario con los resúmenes diarios';
COMMENT ON COLUMN summary_interactions.interaction_type IS 'Tipo de interacción: view, click_notion, click_gmail, click_calendar, copy_text';
COMMENT ON COLUMN summary_interactions.target_id IS 'ID del elemento clickeado (notion page id, gmail thread id, calendar event id)';
COMMENT ON COLUMN summary_interactions.target_url IS 'URL completa del link clickeado';
COMMENT ON COLUMN summary_interactions.metadata IS 'Metadata adicional en formato JSON (posición del link, etc.)';

-- Verificación
SELECT 'Migration 9 ejecutada exitosamente' as status;

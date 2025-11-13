-- Migration 12: Message Feedback para retroalimentación de usuarios
-- Permite a usuarios dar feedback positivo/negativo sobre respuestas del AI

-- Tabla para feedback de mensajes
CREATE TABLE IF NOT EXISTS message_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL, -- ID del mensaje (generado en frontend)
  message_text TEXT NOT NULL, -- Preview del mensaje (max 1000 chars)
  rating TEXT NOT NULL CHECK (rating IN ('positive', 'negative')),
  comment TEXT, -- Comentario opcional del usuario
  metadata JSONB DEFAULT '{}'::jsonb, -- metadata del mensaje (modelUsed, taskType, etc.)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_message_feedback_user_id
ON message_feedback(user_id);

CREATE INDEX IF NOT EXISTS idx_message_feedback_rating
ON message_feedback(rating);

CREATE INDEX IF NOT EXISTS idx_message_feedback_created_at
ON message_feedback(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_message_feedback_message_id
ON message_feedback(message_id);

-- RLS Policies
ALTER TABLE message_feedback ENABLE ROW LEVEL SECURITY;

-- Policy: Usuarios solo pueden ver su propio feedback
DROP POLICY IF EXISTS "Users can view own feedback" ON message_feedback;
CREATE POLICY "Users can view own feedback"
ON message_feedback FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Usuarios solo pueden insertar su propio feedback
DROP POLICY IF EXISTS "Users can insert own feedback" ON message_feedback;
CREATE POLICY "Users can insert own feedback"
ON message_feedback FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Usuarios solo pueden actualizar su propio feedback
DROP POLICY IF EXISTS "Users can update own feedback" ON message_feedback;
CREATE POLICY "Users can update own feedback"
ON message_feedback FOR UPDATE
USING (auth.uid() = user_id);

-- Policy: Usuarios solo pueden eliminar su propio feedback
DROP POLICY IF EXISTS "Users can delete own feedback" ON message_feedback;
CREATE POLICY "Users can delete own feedback"
ON message_feedback FOR DELETE
USING (auth.uid() = user_id);

COMMENT ON TABLE message_feedback IS 'Feedback de usuarios sobre respuestas del AI (útil/no útil con comentarios opcionales)';
COMMENT ON COLUMN message_feedback.message_id IS 'ID único del mensaje generado en el frontend';
COMMENT ON COLUMN message_feedback.rating IS 'positive (útil) o negative (no útil)';
COMMENT ON COLUMN message_feedback.comment IS 'Comentario opcional del usuario sobre qué mejorar';
COMMENT ON COLUMN message_feedback.metadata IS 'Metadata del mensaje: modelUsed, taskType, executionTimeMs, etc.';

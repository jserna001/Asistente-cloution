-- Migration 11: Chat Sessions para persistencia de mensajes
-- Estrategia: Guardar solo sesiones importantes (>3 mensajes con respuestas del AI)

-- Tabla para sesiones de chat
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_start TIMESTAMP WITH TIME ZONE NOT NULL,
  session_end TIMESTAMP WITH TIME ZONE NOT NULL,
  message_count INT NOT NULL DEFAULT 0,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id
ON chat_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at
ON chat_sessions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_created
ON chat_sessions(user_id, created_at DESC);

-- RLS Policies
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Usuarios solo pueden ver sus propias sesiones
DROP POLICY IF EXISTS "Users can view own chat sessions" ON chat_sessions;
CREATE POLICY "Users can view own chat sessions"
ON chat_sessions FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Usuarios solo pueden insertar sus propias sesiones
DROP POLICY IF EXISTS "Users can insert own chat sessions" ON chat_sessions;
CREATE POLICY "Users can insert own chat sessions"
ON chat_sessions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Usuarios solo pueden actualizar sus propias sesiones
DROP POLICY IF EXISTS "Users can update own chat sessions" ON chat_sessions;
CREATE POLICY "Users can update own chat sessions"
ON chat_sessions FOR UPDATE
USING (auth.uid() = user_id);

-- Policy: Usuarios solo pueden eliminar sus propias sesiones
DROP POLICY IF EXISTS "Users can delete own chat sessions" ON chat_sessions;
CREATE POLICY "Users can delete own chat sessions"
ON chat_sessions FOR DELETE
USING (auth.uid() = user_id);

-- Función para limpiar sesiones antiguas (solo mantener últimas 50)
CREATE OR REPLACE FUNCTION cleanup_old_chat_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM chat_sessions
  WHERE id IN (
    SELECT id FROM chat_sessions
    WHERE user_id = auth.uid()
    ORDER BY created_at DESC
    OFFSET 50
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE chat_sessions IS 'Sesiones de chat guardadas (solo conversaciones importantes con >3 mensajes)';
COMMENT ON COLUMN chat_sessions.messages IS 'Array JSONB de mensajes [{id, sender, text, timestamp, status, metadata}]';
COMMENT ON COLUMN chat_sessions.metadata IS 'Metadata adicional: device, session_duration, last_model_used, etc.';

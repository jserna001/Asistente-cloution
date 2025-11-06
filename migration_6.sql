-- Migración 6: Tabla de preferencias de usuario para el resumen diario
-- Ejecutar en Supabase SQL Editor

-- Crear tabla de preferencias de usuario
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    daily_summary_enabled BOOLEAN DEFAULT true,
    daily_summary_time TIME DEFAULT '07:00:00', -- Hora local del usuario
    timezone TEXT DEFAULT 'America/Bogota', -- Zona horaria del usuario
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Un usuario solo puede tener un registro de preferencias
    UNIQUE(user_id)
);

-- Índice para búsquedas rápidas por user_id
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id
ON user_preferences(user_id);

-- Índice para búsquedas por hora (usado por el cron)
CREATE INDEX IF NOT EXISTS idx_user_preferences_summary_time
ON user_preferences(daily_summary_time)
WHERE daily_summary_enabled = true;

-- Habilitar RLS (Row Level Security)
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Policy: Los usuarios solo pueden ver sus propias preferencias
CREATE POLICY "Users can view own preferences"
ON user_preferences
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Los usuarios solo pueden insertar sus propias preferencias
CREATE POLICY "Users can insert own preferences"
ON user_preferences
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Los usuarios solo pueden actualizar sus propias preferencias
CREATE POLICY "Users can update own preferences"
ON user_preferences
FOR UPDATE
USING (auth.uid() = user_id);

-- Policy: Los usuarios pueden eliminar sus propias preferencias
CREATE POLICY "Users can delete own preferences"
ON user_preferences
FOR DELETE
USING (auth.uid() = user_id);

-- Función para actualizar el campo updated_at automáticamente
CREATE OR REPLACE FUNCTION update_user_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
DROP TRIGGER IF EXISTS trigger_update_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER trigger_update_user_preferences_updated_at
BEFORE UPDATE ON user_preferences
FOR EACH ROW
EXECUTE FUNCTION update_user_preferences_updated_at();

-- Insertar preferencias por defecto para el usuario existente (opcional)
INSERT INTO user_preferences (user_id, daily_summary_enabled, daily_summary_time, timezone)
VALUES ('575a8929-81b3-4efa-ba4d-31b86b523c74', true, '07:00:00', 'America/Bogota')
ON CONFLICT (user_id) DO NOTHING;

-- Comentarios para documentación
COMMENT ON TABLE user_preferences IS 'Preferencias de usuario para funciones del asistente';
COMMENT ON COLUMN user_preferences.daily_summary_enabled IS 'Si el usuario quiere recibir el resumen diario';
COMMENT ON COLUMN user_preferences.daily_summary_time IS 'Hora local a la que se genera el resumen (formato HH:MM:SS)';
COMMENT ON COLUMN user_preferences.timezone IS 'Zona horaria del usuario (formato IANA, ej: America/Bogota)';

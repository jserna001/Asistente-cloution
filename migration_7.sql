-- Migración 7: Tabla de estado de onboarding
-- Ejecutar en Supabase SQL Editor
-- Rastrea el progreso del onboarding de nuevos usuarios

-- Crear tabla de estado de onboarding
CREATE TABLE IF NOT EXISTS user_onboarding_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Control de progreso
    current_step INT DEFAULT 0, -- 0=no iniciado, 1-3=pasos, 4=completado
    completed_at TIMESTAMP WITH TIME ZONE,
    skipped_at TIMESTAMP WITH TIME ZONE,

    -- Datos capturados durante onboarding
    full_name TEXT,
    timezone_detected TEXT,

    -- Seguimiento de integraciones conectadas
    notion_connected_during_onboarding BOOLEAN DEFAULT false,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Un usuario solo puede tener un registro de onboarding
    UNIQUE(user_id)
);

-- Índice para búsquedas rápidas por user_id
CREATE INDEX IF NOT EXISTS idx_user_onboarding_user_id
ON user_onboarding_status(user_id);

-- Índice para encontrar usuarios que no completaron onboarding
CREATE INDEX IF NOT EXISTS idx_user_onboarding_incomplete
ON user_onboarding_status(completed_at)
WHERE completed_at IS NULL AND skipped_at IS NULL;

-- Habilitar RLS (Row Level Security)
ALTER TABLE user_onboarding_status ENABLE ROW LEVEL SECURITY;

-- Policy: Los usuarios solo pueden ver su propio estado de onboarding
CREATE POLICY "Users can view own onboarding status"
ON user_onboarding_status
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Los usuarios solo pueden insertar su propio estado
CREATE POLICY "Users can insert own onboarding status"
ON user_onboarding_status
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Los usuarios solo pueden actualizar su propio estado
CREATE POLICY "Users can update own onboarding status"
ON user_onboarding_status
FOR UPDATE
USING (auth.uid() = user_id);

-- Policy: Los usuarios pueden eliminar su propio estado (opcional)
CREATE POLICY "Users can delete own onboarding status"
ON user_onboarding_status
FOR DELETE
USING (auth.uid() = user_id);

-- Función para actualizar el campo updated_at automáticamente
CREATE OR REPLACE FUNCTION update_user_onboarding_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
DROP TRIGGER IF EXISTS trigger_update_user_onboarding_updated_at ON user_onboarding_status;
CREATE TRIGGER trigger_update_user_onboarding_updated_at
BEFORE UPDATE ON user_onboarding_status
FOR EACH ROW
EXECUTE FUNCTION update_user_onboarding_updated_at();

-- Función helper: Verificar si un usuario necesita onboarding
CREATE OR REPLACE FUNCTION user_needs_onboarding(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_status RECORD;
BEGIN
    SELECT * INTO v_status
    FROM user_onboarding_status
    WHERE user_id = p_user_id;

    -- Si no existe registro, necesita onboarding
    IF NOT FOUND THEN
        RETURN TRUE;
    END IF;

    -- Si no está completado ni saltado, necesita onboarding
    IF v_status.completed_at IS NULL AND v_status.skipped_at IS NULL THEN
        RETURN TRUE;
    END IF;

    -- Ya completó o saltó el onboarding
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentarios para documentación
COMMENT ON TABLE user_onboarding_status IS 'Rastrea el progreso del wizard de onboarding para nuevos usuarios';
COMMENT ON COLUMN user_onboarding_status.current_step IS 'Paso actual: 0=no iniciado, 1-3=en progreso, 4=completado';
COMMENT ON COLUMN user_onboarding_status.completed_at IS 'Fecha cuando el usuario completó todo el onboarding';
COMMENT ON COLUMN user_onboarding_status.skipped_at IS 'Fecha cuando el usuario saltó el onboarding';
COMMENT ON COLUMN user_onboarding_status.full_name IS 'Nombre completo capturado durante onboarding';
COMMENT ON COLUMN user_onboarding_status.timezone_detected IS 'Zona horaria detectada automáticamente';
COMMENT ON FUNCTION user_needs_onboarding IS 'Helper para verificar si un usuario requiere completar el onboarding';

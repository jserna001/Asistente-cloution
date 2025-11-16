-- Migration 13: Tabla de estado de sincronización para servicios externos
-- Esta tabla rastrea el último punto de sincronización para Gmail, Notion, etc.
-- Ejecutar en Supabase SQL Editor

-- Crear tabla de estado de sincronización
CREATE TABLE IF NOT EXISTS sync_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    service_name TEXT NOT NULL, -- 'google', 'notion', 'calendar', etc.
    last_sync_token TEXT, -- historyId para Gmail, cursor para Notion, etc.
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_enabled BOOLEAN DEFAULT true,
    sync_config JSONB DEFAULT '{}'::jsonb, -- Configuración específica del servicio
    error_count INTEGER DEFAULT 0, -- Contador de errores consecutivos
    last_error TEXT, -- Último mensaje de error
    last_error_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Un usuario solo puede tener un registro por servicio
    UNIQUE(user_id, service_name)
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_sync_status_user_id
ON sync_status(user_id);

CREATE INDEX IF NOT EXISTS idx_sync_status_service
ON sync_status(service_name)
WHERE sync_enabled = true;

CREATE INDEX IF NOT EXISTS idx_sync_status_user_service
ON sync_status(user_id, service_name);

-- Índice para encontrar usuarios con sync habilitado
CREATE INDEX IF NOT EXISTS idx_sync_status_enabled
ON sync_status(user_id, service_name)
WHERE sync_enabled = true;

-- Habilitar RLS (Row Level Security)
ALTER TABLE sync_status ENABLE ROW LEVEL SECURITY;

-- Policy: Los usuarios solo pueden ver su propio estado de sincronización
CREATE POLICY "Users can view own sync status"
ON sync_status
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Los usuarios solo pueden insertar su propio estado
CREATE POLICY "Users can insert own sync status"
ON sync_status
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Los usuarios solo pueden actualizar su propio estado
CREATE POLICY "Users can update own sync status"
ON sync_status
FOR UPDATE
USING (auth.uid() = user_id);

-- Policy: Los usuarios pueden eliminar su propio estado
CREATE POLICY "Users can delete own sync status"
ON sync_status
FOR DELETE
USING (auth.uid() = user_id);

-- Policy: Service role puede acceder a todo (para background jobs)
CREATE POLICY "Service role has full access to sync status"
ON sync_status
FOR ALL
USING (auth.role() = 'service_role');

-- Función para actualizar el campo updated_at automáticamente
CREATE OR REPLACE FUNCTION update_sync_status_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
DROP TRIGGER IF EXISTS trigger_update_sync_status_updated_at ON sync_status;
CREATE TRIGGER trigger_update_sync_status_updated_at
BEFORE UPDATE ON sync_status
FOR EACH ROW
EXECUTE FUNCTION update_sync_status_updated_at();

-- Comentarios para documentación
COMMENT ON TABLE sync_status IS 'Estado de sincronización de servicios externos por usuario';
COMMENT ON COLUMN sync_status.service_name IS 'Nombre del servicio: google, notion, calendar, etc.';
COMMENT ON COLUMN sync_status.last_sync_token IS 'Token de sincronización específico del servicio (historyId, cursor, etc.)';
COMMENT ON COLUMN sync_status.last_sync_at IS 'Timestamp de la última sincronización exitosa';
COMMENT ON COLUMN sync_status.sync_enabled IS 'Si la sincronización automática está habilitada';
COMMENT ON COLUMN sync_status.sync_config IS 'Configuración JSON específica del servicio';
COMMENT ON COLUMN sync_status.error_count IS 'Número de errores consecutivos (se resetea en sync exitoso)';
COMMENT ON COLUMN sync_status.last_error IS 'Mensaje del último error ocurrido';

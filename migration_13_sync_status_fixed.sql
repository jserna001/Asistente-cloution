-- Migration 13: Tabla de estado de sincronización para servicios externos (FIXED)
-- Esta tabla rastrea el último punto de sincronización para Gmail, Notion, etc.
-- Ejecutar en Supabase SQL Editor

-- PASO 1: Eliminar tabla anterior si existe (con esquema incorrecto)
DROP TABLE IF EXISTS sync_status CASCADE;

-- PASO 2: Eliminar función si existe
DROP FUNCTION IF EXISTS update_sync_status_updated_at() CASCADE;

-- PASO 3: Crear función para updated_at
CREATE OR REPLACE FUNCTION update_sync_status_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- PASO 4: Crear tabla de estado de sincronización
CREATE TABLE sync_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    service_name TEXT NOT NULL,
    last_sync_token TEXT,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_enabled BOOLEAN DEFAULT true,
    sync_config JSONB DEFAULT '{}'::jsonb,
    error_count INTEGER DEFAULT 0,
    last_error TEXT,
    last_error_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(user_id, service_name)
);

-- PASO 5: Crear índices
CREATE INDEX idx_sync_status_user_id ON sync_status(user_id);
CREATE INDEX idx_sync_status_service ON sync_status(service_name) WHERE sync_enabled = true;
CREATE INDEX idx_sync_status_user_service ON sync_status(user_id, service_name);
CREATE INDEX idx_sync_status_enabled ON sync_status(user_id, service_name) WHERE sync_enabled = true;

-- PASO 6: Habilitar RLS
ALTER TABLE sync_status ENABLE ROW LEVEL SECURITY;

-- PASO 7: Crear policies
CREATE POLICY "Users can view own sync status"
ON sync_status FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sync status"
ON sync_status FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sync status"
ON sync_status FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sync status"
ON sync_status FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access to sync status"
ON sync_status FOR ALL
USING (auth.role() = 'service_role');

-- PASO 8: Crear trigger
CREATE TRIGGER trigger_update_sync_status_updated_at
BEFORE UPDATE ON sync_status
FOR EACH ROW
EXECUTE FUNCTION update_sync_status_updated_at();

-- PASO 9: Comentarios
COMMENT ON TABLE sync_status IS 'Estado de sincronización de servicios externos por usuario';
COMMENT ON COLUMN sync_status.service_name IS 'Nombre del servicio: google, notion, calendar, etc.';
COMMENT ON COLUMN sync_status.last_sync_token IS 'Token de sincronización específico del servicio (historyId, cursor, etc.)';
COMMENT ON COLUMN sync_status.last_sync_at IS 'Timestamp de la última sincronización exitosa';
COMMENT ON COLUMN sync_status.sync_enabled IS 'Si la sincronización automática está habilitada';
COMMENT ON COLUMN sync_status.sync_config IS 'Configuración JSON específica del servicio';
COMMENT ON COLUMN sync_status.error_count IS 'Número de errores consecutivos (se resetea en sync exitoso)';
COMMENT ON COLUMN sync_status.last_error IS 'Mensaje del último error ocurrido';

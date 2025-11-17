-- Migration 14: Configuración específica de sincronización de Gmail
-- Esta tabla almacena preferencias y configuración para la sincronización de Gmail
-- Ejecutar en Supabase SQL Editor

-- Crear tabla de configuración de Gmail
CREATE TABLE IF NOT EXISTS gmail_sync_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Configuración de sincronización
    max_emails_per_sync INTEGER DEFAULT 200, -- Límite de emails por sincronización
    initial_sync_days INTEGER DEFAULT 15, -- Días hacia atrás en primera sync
    sync_frequency_minutes INTEGER DEFAULT 60, -- Frecuencia deseada (para cron)

    -- Filtros de sincronización
    excluded_labels TEXT[] DEFAULT ARRAY[]::TEXT[], -- Labels a excluir (ej: 'SPAM', 'TRASH')
    included_labels TEXT[] DEFAULT NULL, -- Si se especifica, solo sincronizar estos labels
    exclude_promotions BOOLEAN DEFAULT true, -- Excluir categoría PROMOTIONS
    exclude_social BOOLEAN DEFAULT true, -- Excluir categoría SOCIAL

    -- Configuración de procesamiento
    process_attachments_names BOOLEAN DEFAULT true, -- Mencionar nombres de adjuntos
    max_email_content_length INTEGER DEFAULT 50000, -- Máximo caracteres por email

    -- Gmail Push Notifications
    watch_enabled BOOLEAN DEFAULT false, -- Si Gmail Push está configurado
    watch_topic_name TEXT, -- Nombre del topic de Pub/Sub
    watch_expiration TIMESTAMP WITH TIME ZONE, -- Cuándo expira el watch

    -- Metadata
    first_sync_completed BOOLEAN DEFAULT false,
    first_sync_completed_at TIMESTAMP WITH TIME ZONE,
    total_emails_synced INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Un usuario solo puede tener una configuración
    UNIQUE(user_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_gmail_sync_config_user_id
ON gmail_sync_config(user_id);

CREATE INDEX IF NOT EXISTS idx_gmail_sync_config_watch_enabled
ON gmail_sync_config(user_id)
WHERE watch_enabled = true;

-- Habilitar RLS
ALTER TABLE gmail_sync_config ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own gmail config"
ON gmail_sync_config
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own gmail config"
ON gmail_sync_config
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own gmail config"
ON gmail_sync_config
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own gmail config"
ON gmail_sync_config
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access to gmail config"
ON gmail_sync_config
FOR ALL
USING (auth.role() = 'service_role');

-- Trigger para updated_at
DROP TRIGGER IF EXISTS trigger_update_gmail_sync_config_updated_at ON gmail_sync_config;
CREATE TRIGGER trigger_update_gmail_sync_config_updated_at
BEFORE UPDATE ON gmail_sync_config
FOR EACH ROW
EXECUTE FUNCTION update_sync_status_updated_at(); -- Reutilizamos la función anterior

-- Función helper para inicializar config por defecto
CREATE OR REPLACE FUNCTION initialize_gmail_sync_config(p_user_id UUID)
RETURNS void AS $$
BEGIN
    INSERT INTO gmail_sync_config (user_id)
    VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentarios
COMMENT ON TABLE gmail_sync_config IS 'Configuración de sincronización de Gmail por usuario';
COMMENT ON COLUMN gmail_sync_config.max_emails_per_sync IS 'Máximo de emails a procesar por sincronización';
COMMENT ON COLUMN gmail_sync_config.initial_sync_days IS 'Días hacia atrás para la primera sincronización';
COMMENT ON COLUMN gmail_sync_config.excluded_labels IS 'Labels de Gmail a excluir de la sincronización';
COMMENT ON COLUMN gmail_sync_config.watch_enabled IS 'Si Gmail Push Notifications está configurado';
COMMENT ON COLUMN gmail_sync_config.watch_topic_name IS 'Nombre del topic de Google Cloud Pub/Sub';
COMMENT ON COLUMN gmail_sync_config.watch_expiration IS 'Fecha de expiración del watch (se renueva automáticamente)';

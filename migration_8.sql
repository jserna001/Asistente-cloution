-- Migration 8: Sistema de Plantillas Predeterminadas de Notion (CORREGIDO)
-- Fecha: 2025-11-10
-- Descripción: Implementa sistema de plantillas de Notion por perfil de usuario
--             para facilitar la adopción y mejorar el onboarding

-- =====================================================
-- 1. CATÁLOGO DE PLANTILLAS DE NOTION
-- =====================================================

-- Tabla que almacena las plantillas disponibles
CREATE TABLE IF NOT EXISTS notion_template_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_pack_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  target_audience TEXT[],
  template_structure JSONB NOT NULL,
  default_rag_queries JSONB,
  suggested_preferences JSONB,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_template_catalog_pack_id
ON notion_template_catalog(template_pack_id);

CREATE INDEX IF NOT EXISTS idx_template_catalog_active
ON notion_template_catalog(is_active)
WHERE is_active = true;

-- =====================================================
-- 2. TRACKING DE PLANTILLAS INSTALADAS
-- =====================================================

CREATE TABLE IF NOT EXISTS user_notion_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_pack_id TEXT NOT NULL REFERENCES notion_template_catalog(template_pack_id),
  installed_notion_ids JSONB,
  installation_status TEXT DEFAULT 'pending',
  installation_progress INTEGER DEFAULT 0,
  installation_error TEXT,
  installation_started_at TIMESTAMP WITH TIME ZONE,
  installation_completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, template_pack_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_templates_user_id
ON user_notion_templates(user_id);

CREATE INDEX IF NOT EXISTS idx_user_templates_status
ON user_notion_templates(installation_status);

CREATE INDEX IF NOT EXISTS idx_user_templates_user_status
ON user_notion_templates(user_id, installation_status);

-- =====================================================
-- 3. EXTENDER USER_PREFERENCES (UNA COLUMNA A LA VEZ)
-- =====================================================

-- Plantilla seleccionada
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS selected_template_pack TEXT;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS template_installed BOOLEAN DEFAULT false;

-- Perfil del usuario
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS user_role TEXT DEFAULT 'professional';
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS user_interests TEXT[];

-- Proyectos activos
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS active_projects JSONB DEFAULT '[]';

-- Contenido del resumen
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS include_calendar BOOLEAN DEFAULT true;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS include_notion BOOLEAN DEFAULT true;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS include_gmail BOOLEAN DEFAULT true;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS include_yesterday_summary BOOLEAN DEFAULT false;

-- Gmail personalización
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS gmail_priority_senders TEXT[];
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS gmail_keywords TEXT[];
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS gmail_only_unread BOOLEAN DEFAULT true;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS gmail_timeframe_hours INTEGER DEFAULT 24;

-- Notion personalización
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS notion_database_ids TEXT[];
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS notion_task_statuses TEXT[] DEFAULT ARRAY['Not Started', 'In Progress', 'To Do'];

-- Formato del resumen
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS summary_length TEXT DEFAULT 'balanced';
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS summary_tone TEXT DEFAULT 'friendly';
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS use_emojis BOOLEAN DEFAULT true;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS group_by_category BOOLEAN DEFAULT true;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS include_action_items BOOLEAN DEFAULT true;

-- Frecuencia del resumen
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS frequency TEXT DEFAULT 'daily';
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS custom_days INTEGER[];

-- Onboarding
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0;

-- Añadir foreign key constraint después de crear la columna
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_preferences_selected_template_pack_fkey'
  ) THEN
    ALTER TABLE user_preferences
    ADD CONSTRAINT user_preferences_selected_template_pack_fkey
    FOREIGN KEY (selected_template_pack)
    REFERENCES notion_template_catalog(template_pack_id);
  END IF;
END $$;

-- =====================================================
-- 4. TABLA DE CONTEXTO PERSONAL DEL USUARIO
-- =====================================================

CREATE TABLE IF NOT EXISTS user_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  context_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  keywords TEXT[],
  priority INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, title)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_context_user_id
ON user_context(user_id);

CREATE INDEX IF NOT EXISTS idx_user_context_type
ON user_context(context_type);

CREATE INDEX IF NOT EXISTS idx_user_context_status
ON user_context(status)
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_user_context_user_active
ON user_context(user_id, status)
WHERE status = 'active';

-- =====================================================
-- 5. TABLA DE FEEDBACK DE RESÚMENES
-- =====================================================

CREATE TABLE IF NOT EXISTS summary_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary_id UUID NOT NULL REFERENCES daily_summaries(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  was_helpful BOOLEAN,
  feedback_text TEXT,
  feedback_tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, summary_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_summary_feedback_user_id
ON summary_feedback(user_id);

CREATE INDEX IF NOT EXISTS idx_summary_feedback_summary_id
ON summary_feedback(summary_id);

CREATE INDEX IF NOT EXISTS idx_summary_feedback_rating
ON summary_feedback(rating);

-- =====================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- notion_template_catalog: Público para lectura
ALTER TABLE notion_template_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active templates" ON notion_template_catalog;
CREATE POLICY "Anyone can view active templates"
ON notion_template_catalog
FOR SELECT
USING (is_active = true);

-- user_notion_templates: Solo el propietario
ALTER TABLE user_notion_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own template installations" ON user_notion_templates;
CREATE POLICY "Users can view own template installations"
ON user_notion_templates
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own template installations" ON user_notion_templates;
CREATE POLICY "Users can insert own template installations"
ON user_notion_templates
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own template installations" ON user_notion_templates;
CREATE POLICY "Users can update own template installations"
ON user_notion_templates
FOR UPDATE
USING (auth.uid() = user_id);

-- user_context: Solo el propietario
ALTER TABLE user_context ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own context" ON user_context;
CREATE POLICY "Users can view own context"
ON user_context
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own context" ON user_context;
CREATE POLICY "Users can insert own context"
ON user_context
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own context" ON user_context;
CREATE POLICY "Users can update own context"
ON user_context
FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own context" ON user_context;
CREATE POLICY "Users can delete own context"
ON user_context
FOR DELETE
USING (auth.uid() = user_id);

-- summary_feedback: Solo el propietario
ALTER TABLE summary_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own feedback" ON summary_feedback;
CREATE POLICY "Users can view own feedback"
ON summary_feedback
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own feedback" ON summary_feedback;
CREATE POLICY "Users can insert own feedback"
ON summary_feedback
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own feedback" ON summary_feedback;
CREATE POLICY "Users can update own feedback"
ON summary_feedback
FOR UPDATE
USING (auth.uid() = user_id);

-- =====================================================
-- 7. TRIGGERS PARA UPDATED_AT
-- =====================================================

-- Función genérica para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para notion_template_catalog
DROP TRIGGER IF EXISTS trigger_update_template_catalog_updated_at ON notion_template_catalog;
CREATE TRIGGER trigger_update_template_catalog_updated_at
BEFORE UPDATE ON notion_template_catalog
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger para user_context
DROP TRIGGER IF EXISTS trigger_update_user_context_updated_at ON user_context;
CREATE TRIGGER trigger_update_user_context_updated_at
BEFORE UPDATE ON user_context
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 8. COMENTARIOS PARA DOCUMENTACIÓN
-- =====================================================

COMMENT ON TABLE notion_template_catalog IS 'Catálogo de plantillas predeterminadas de Notion por perfil de usuario';
COMMENT ON COLUMN notion_template_catalog.template_pack_id IS 'Identificador único del pack (ej: student, professional)';
COMMENT ON COLUMN notion_template_catalog.template_structure IS 'Estructura JSON completa con databases, páginas y vistas';
COMMENT ON COLUMN notion_template_catalog.default_rag_queries IS 'Queries predeterminadas para RAG por fuente de datos';

COMMENT ON TABLE user_notion_templates IS 'Tracking de plantillas instaladas por usuario';
COMMENT ON COLUMN user_notion_templates.installed_notion_ids IS 'IDs de elementos creados en Notion durante la instalación';
COMMENT ON COLUMN user_notion_templates.installation_status IS 'Estado: pending, installing, completed, failed';

COMMENT ON TABLE user_context IS 'Contexto personal del usuario (objetivos, proyectos, hábitos) para personalizar resúmenes';
COMMENT ON COLUMN user_context.context_type IS 'Tipo: goal, project, habit, focus_area, person';
COMMENT ON COLUMN user_context.keywords IS 'Palabras clave para mejorar búsquedas RAG';

COMMENT ON TABLE summary_feedback IS 'Feedback de usuarios sobre la calidad de los resúmenes diarios';

COMMENT ON COLUMN user_preferences.selected_template_pack IS 'Pack de plantilla que eligió el usuario durante onboarding';
COMMENT ON COLUMN user_preferences.summary_length IS 'Longitud preferida: brief, balanced, detailed';
COMMENT ON COLUMN user_preferences.summary_tone IS 'Tono preferido: professional, friendly, motivational';
COMMENT ON COLUMN user_preferences.frequency IS 'Frecuencia del resumen: daily, weekdays, custom';

-- =====================================================
-- 9. VIEWS ÚTILES (OPCIONAL)
-- =====================================================

-- Primero eliminar cualquier objeto existente con ese nombre
-- IMPORTANTE: Primero DROP TABLE, luego DROP VIEW (orden correcto)
DROP TABLE IF EXISTS user_onboarding_status CASCADE;
DROP VIEW IF EXISTS user_onboarding_status CASCADE;

-- Vista para ver el estado de onboarding de usuarios
CREATE VIEW user_onboarding_status AS
SELECT
  u.id as user_id,
  u.email,
  up.onboarding_completed,
  up.onboarding_step,
  up.selected_template_pack,
  up.template_installed,
  unt.installation_status,
  unt.installation_completed_at,
  CASE
    WHEN up.onboarding_completed THEN 'completed'
    WHEN unt.installation_status = 'installing' THEN 'installing_template'
    WHEN unt.installation_status = 'failed' THEN 'installation_failed'
    WHEN up.onboarding_step > 0 THEN 'in_progress'
    ELSE 'not_started'
  END as overall_status
FROM auth.users u
LEFT JOIN user_preferences up ON u.id = up.user_id
LEFT JOIN user_notion_templates unt ON u.id = unt.user_id
  AND unt.template_pack_id = up.selected_template_pack;

COMMENT ON VIEW user_onboarding_status IS 'Vista consolidada del estado de onboarding de cada usuario';

-- =====================================================
-- FIN DE MIGRATION 8
-- =====================================================

-- Para verificar que la migración se ejecutó correctamente:
SELECT 'Migration 8 ejecutada exitosamente' as status;

-- Migration 8: Sistema de Plantillas Predeterminadas de Notion
-- Fecha: 2025-11-10
-- Descripción: Implementa sistema de plantillas de Notion por perfil de usuario
--             para facilitar la adopción y mejorar el onboarding

-- =====================================================
-- 1. CATÁLOGO DE PLANTILLAS DE NOTION
-- =====================================================

-- Tabla que almacena las plantillas disponibles
CREATE TABLE IF NOT EXISTS notion_template_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_pack_id TEXT UNIQUE NOT NULL, -- 'student', 'professional', 'entrepreneur', 'freelancer', 'basic'
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  target_audience TEXT[], -- Array de audiencias objetivo

  -- Estructura JSON completa de la plantilla
  template_structure JSONB NOT NULL,
  -- Formato esperado:
  -- {
  --   "databases": [
  --     {
  --       "name": "Task Manager",
  --       "icon": "✅",
  --       "description": "Gestiona tus tareas",
  --       "properties": {
  --         "Name": { "type": "title" },
  --         "Status": { "type": "select", "options": [...] },
  --         ...
  --       },
  --       "views": [
  --         { "name": "All Tasks", "type": "table" },
  --         { "name": "By Status", "type": "board", "group_by": "Status" }
  --       ]
  --     }
  --   ],
  --   "pages": [
  --     {
  --       "name": "Dashboard",
  --       "icon": "📊",
  --       "content": [...]
  --     }
  --   ]
  -- }

  -- Queries RAG predeterminadas por fuente
  default_rag_queries JSONB,
  -- Formato:
  -- {
  --   "notion": ["¿Qué tareas tengo pendientes?", "Muéstrame mis proyectos"],
  --   "gmail": ["Correos de profesores", "Notificaciones importantes"],
  --   "calendar": ["Eventos de hoy"]
  -- }

  -- Preferencias de resumen sugeridas
  suggested_preferences JSONB,
  -- Formato:
  -- {
  --   "summary_length": "balanced",
  --   "summary_tone": "friendly",
  --   "use_emojis": true,
  --   "group_by_category": true
  -- }

  -- Orden de aparición en UI
  display_order INTEGER DEFAULT 0,

  -- Estado de la plantilla
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

-- Tabla que rastrea qué plantillas ha instalado cada usuario
CREATE TABLE IF NOT EXISTS user_notion_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_pack_id TEXT NOT NULL REFERENCES notion_template_catalog(template_pack_id),

  -- IDs de los elementos creados en Notion
  installed_notion_ids JSONB,
  -- Formato:
  -- {
  --   "parent_page_id": "xxxxx-xxxxx-xxxxx",
  --   "db_task_manager": "yyyyy-yyyyy-yyyyy",
  --   "db_notes": "zzzzz-zzzzz-zzzzz",
  --   "page_dashboard": "wwwww-wwwww-wwwww"
  -- }

  -- Estado de la instalación
  installation_status TEXT DEFAULT 'pending', -- 'pending', 'installing', 'completed', 'failed'
  installation_progress INTEGER DEFAULT 0, -- 0-100
  installation_error TEXT,

  -- Timestamps
  installation_started_at TIMESTAMP WITH TIME ZONE,
  installation_completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraint: Un usuario solo puede instalar cada plantilla una vez
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
-- 3. EXTENDER USER_PREFERENCES
-- =====================================================

-- Añadir columnas relacionadas con plantillas y personalización
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS
  -- Plantilla seleccionada
  selected_template_pack TEXT REFERENCES notion_template_catalog(template_pack_id),
  template_installed BOOLEAN DEFAULT false,

  -- Perfil del usuario
  user_role TEXT DEFAULT 'professional', -- 'student', 'professional', 'entrepreneur', 'freelancer', 'other'
  user_interests TEXT[], -- Array de intereses: ['tecnología', 'negocios', 'salud']

  -- Proyectos activos (simplificado)
  active_projects JSONB DEFAULT '[]',
  -- Formato: [{"name": "Proyecto X", "description": "...", "keywords": ["react", "nextjs"]}]

  -- Contenido del resumen
  include_calendar BOOLEAN DEFAULT true,
  include_notion BOOLEAN DEFAULT true,
  include_gmail BOOLEAN DEFAULT true,
  include_yesterday_summary BOOLEAN DEFAULT false,

  -- Gmail personalización
  gmail_priority_senders TEXT[], -- emails de personas importantes
  gmail_keywords TEXT[], -- palabras clave para priorizar
  gmail_only_unread BOOLEAN DEFAULT true,
  gmail_timeframe_hours INTEGER DEFAULT 24,

  -- Notion personalización
  notion_database_ids TEXT[], -- IDs de databases a revisar
  notion_task_statuses TEXT[] DEFAULT ARRAY['Not Started', 'In Progress', 'To Do'],

  -- Formato del resumen
  summary_length TEXT DEFAULT 'balanced', -- 'brief' | 'balanced' | 'detailed'
  summary_tone TEXT DEFAULT 'friendly', -- 'professional' | 'friendly' | 'motivational'
  use_emojis BOOLEAN DEFAULT true,
  group_by_category BOOLEAN DEFAULT true,
  include_action_items BOOLEAN DEFAULT true,

  -- Frecuencia del resumen
  frequency TEXT DEFAULT 'daily', -- 'daily' | 'weekdays' | 'custom'
  custom_days INTEGER[], -- [1,2,3,4,5] para Lun-Vie (1=Lunes, 7=Domingo)

  -- Onboarding
  onboarding_completed BOOLEAN DEFAULT false,
  onboarding_completed_at TIMESTAMP WITH TIME ZONE,
  onboarding_step INTEGER DEFAULT 0; -- Para retomar onboarding si se interrumpe

-- =====================================================
-- 4. TABLA DE CONTEXTO PERSONAL DEL USUARIO
-- =====================================================

-- Tabla para almacenar objetivos, proyectos, hábitos del usuario
-- Mejora el resumen diario al entender qué es importante para el usuario
CREATE TABLE IF NOT EXISTS user_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Tipo de contexto
  context_type TEXT NOT NULL, -- 'goal', 'project', 'habit', 'focus_area', 'person'

  -- Información
  title TEXT NOT NULL,
  description TEXT,
  keywords TEXT[], -- Para mejorar búsquedas RAG

  -- Importancia
  priority INTEGER DEFAULT 0, -- 0=normal, 1=high, 2=critical

  -- Estado
  status TEXT DEFAULT 'active', -- 'active', 'paused', 'completed', 'archived'

  -- Metadata
  metadata JSONB, -- Información adicional específica por tipo

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,

  -- Constraint
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

-- Para mejorar los resúmenes con el tiempo basado en feedback del usuario
CREATE TABLE IF NOT EXISTS summary_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary_id UUID NOT NULL REFERENCES daily_summaries(id) ON DELETE CASCADE,

  -- Rating
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  was_helpful BOOLEAN,

  -- Feedback específico
  feedback_text TEXT,
  feedback_tags TEXT[], -- ['demasiado_largo', 'falta_info', 'perfecto']

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Un usuario solo puede dar feedback una vez por resumen
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

CREATE POLICY "Anyone can view active templates"
ON notion_template_catalog
FOR SELECT
USING (is_active = true);

-- user_notion_templates: Solo el propietario
ALTER TABLE user_notion_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own template installations"
ON user_notion_templates
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own template installations"
ON user_notion_templates
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own template installations"
ON user_notion_templates
FOR UPDATE
USING (auth.uid() = user_id);

-- user_context: Solo el propietario
ALTER TABLE user_context ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own context"
ON user_context
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own context"
ON user_context
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own context"
ON user_context
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own context"
ON user_context
FOR DELETE
USING (auth.uid() = user_id);

-- summary_feedback: Solo el propietario
ALTER TABLE summary_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own feedback"
ON summary_feedback
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own feedback"
ON summary_feedback
FOR INSERT
WITH CHECK (auth.uid() = user_id);

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

-- Vista para ver el estado de onboarding de usuarios
CREATE OR REPLACE VIEW user_onboarding_status AS
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

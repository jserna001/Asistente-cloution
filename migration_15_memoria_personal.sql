-- ==================================================
-- MIGRACIONES PARA SISTEMA DE MEMORIA PERSONAL
-- CON AUTOAPRENDIZAJE
-- ==================================================
-- Ejecutar estas migraciones en Supabase SQL Editor
-- Después de todas las migraciones existentes (1-14)

-- ===== FASE 1: MEJORAR document_chunks =====
ALTER TABLE public.document_chunks 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS relevance_score FLOAT DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS access_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_accessed TIMESTAMP WITH TIME ZONE;

-- Crear índice para búsquedas por user_id
CREATE INDEX IF NOT EXISTS idx_document_chunks_user_id 
ON public.document_chunks(user_id);

CREATE INDEX IF NOT EXISTS idx_document_chunks_relevance 
ON public.document_chunks(relevance_score DESC);

CREATE INDEX IF NOT EXISTS idx_document_chunks_created 
ON public.document_chunks(created_at DESC);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_document_chunks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_document_chunks_updated_at ON public.document_chunks;
CREATE TRIGGER trigger_update_document_chunks_updated_at
BEFORE UPDATE ON public.document_chunks
FOR EACH ROW
EXECUTE FUNCTION update_document_chunks_updated_at();

-- ===== TABLA: user_learning_profile =====
CREATE TABLE IF NOT EXISTS user_learning_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Preferencias aprendidas
  preferred_response_length TEXT DEFAULT 'balanced', -- 'short', 'medium', 'long'
  preferred_tone TEXT DEFAULT 'friendly', -- 'professional', 'friendly', 'motivational'
  preferred_model TEXT DEFAULT 'gemini', -- 'gemini', 'claude'
  
  -- Patrones temporales
  peak_activity_hour INT, -- 0-23 (detectado)
  preferred_activity_days TEXT[] DEFAULT ARRAY[]::TEXT[], -- ['lunes', 'martes']
  
  -- Intereses personales
  top_topics TEXT[] DEFAULT ARRAY[]::TEXT[],
  skill_level TEXT DEFAULT 'intermediate', -- 'beginner', 'intermediate', 'expert'
  
  -- Estadísticas de aprendizaje
  total_interactions INT DEFAULT 0,
  feedback_count INT DEFAULT 0,
  avg_feedback_rating FLOAT DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_learning_profile_user_id 
ON user_learning_profile(user_id);

-- ===== TABLA: learning_events =====
CREATE TABLE IF NOT EXISTS learning_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  event_type TEXT NOT NULL, -- 'query', 'feedback', 'interaction', 'error', 'classification'
  query_text TEXT,
  task_type_classified TEXT,
  model_used TEXT,
  
  -- Feedback explícito
  rating INT CHECK (rating >= 1 AND rating <= 5),
  feedback_tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Performance
  execution_time_ms INT,
  success BOOLEAN,
  
  -- Metadata flexible
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_events_user_id 
ON learning_events(user_id);

CREATE INDEX IF NOT EXISTS idx_learning_events_type 
ON learning_events(event_type);

CREATE INDEX IF NOT EXISTS idx_learning_events_created 
ON learning_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_learning_events_user_type 
ON learning_events(user_id, event_type);

-- ===== TABLA: knowledge_relationships =====
CREATE TABLE IF NOT EXISTS knowledge_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  source_chunk_id BIGINT NOT NULL REFERENCES public.document_chunks(id) ON DELETE CASCADE,
  target_chunk_id BIGINT NOT NULL REFERENCES public.document_chunks(id) ON DELETE CASCADE,
  
  relationship_type TEXT NOT NULL, -- 'related', 'similar', 'contradicts', 'refines', 'precedes'
  strength FLOAT DEFAULT 0.5, -- 0-1, confidence
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- No permitir relaciones duplicadas
  UNIQUE(source_chunk_id, target_chunk_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_rel_source 
ON knowledge_relationships(source_chunk_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_rel_target 
ON knowledge_relationships(target_chunk_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_rel_user 
ON knowledge_relationships(user_id);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS trigger_update_knowledge_relationships_updated_at ON knowledge_relationships;
CREATE TRIGGER trigger_update_knowledge_relationships_updated_at
BEFORE UPDATE ON knowledge_relationships
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ===== TABLA: user_concepts =====
CREATE TABLE IF NOT EXISTS user_concepts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  concept_name TEXT NOT NULL,
  description TEXT,
  keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
  related_chunk_ids BIGINT[] DEFAULT ARRAY[]::BIGINT[],
  
  -- Métricas
  mention_count INT DEFAULT 0,
  last_mentioned TIMESTAMP WITH TIME ZONE,
  confidence_score FLOAT DEFAULT 0.5, -- Qué tan bien se entiende [0-1]
  
  -- Estado
  status TEXT DEFAULT 'active', -- 'active', 'archived', 'learning'
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, concept_name)
);

CREATE INDEX IF NOT EXISTS idx_user_concepts_user_id 
ON user_concepts(user_id);

CREATE INDEX IF NOT EXISTS idx_user_concepts_status 
ON user_concepts(status);

CREATE INDEX IF NOT EXISTS idx_user_concepts_confidence 
ON user_concepts(confidence_score DESC);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS trigger_update_user_concepts_updated_at ON user_concepts;
CREATE TRIGGER trigger_update_user_concepts_updated_at
BEFORE UPDATE ON user_concepts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ===== TABLA: usage_patterns =====
CREATE TABLE IF NOT EXISTS usage_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  pattern_type TEXT NOT NULL, -- 'time_based', 'topic_based', 'tool_usage', 'interaction_frequency'
  pattern_name TEXT, -- Descripción legible: "Activo los lunes a las 9am"
  pattern_data JSONB NOT NULL, -- Estructura flexible según tipo
  
  -- Estadísticas
  occurrence_count INT DEFAULT 1,
  confidence FLOAT DEFAULT 0.5, -- 0-1
  last_detected TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_patterns_user_id 
ON usage_patterns(user_id);

CREATE INDEX IF NOT EXISTS idx_usage_patterns_type 
ON usage_patterns(pattern_type);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS trigger_update_usage_patterns_updated_at ON usage_patterns;
CREATE TRIGGER trigger_update_usage_patterns_updated_at
BEFORE UPDATE ON usage_patterns
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ===== TABLA: chunk_interactions =====
-- Tracking granular de qué chunks fueron interactuados
CREATE TABLE IF NOT EXISTS chunk_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chunk_id BIGINT NOT NULL REFERENCES public.document_chunks(id) ON DELETE CASCADE,
  
  interaction_type TEXT, -- 'viewed_in_rag', 'clicked', 'copied', 'shared'
  context TEXT, -- Contexto de la interacción (qué query llevó a esto)
  helpful BOOLEAN, -- Si el usuario indicó que fue útil
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chunk_interactions_user_id 
ON chunk_interactions(user_id);

CREATE INDEX IF NOT EXISTS idx_chunk_interactions_chunk_id 
ON chunk_interactions(chunk_id);

CREATE INDEX IF NOT EXISTS idx_chunk_interactions_created 
ON chunk_interactions(created_at DESC);

-- ===== RLS POLICIES =====

-- user_learning_profile
ALTER TABLE user_learning_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own learning profile" ON user_learning_profile;
CREATE POLICY "Users can view own learning profile"
ON user_learning_profile FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own learning profile" ON user_learning_profile;
CREATE POLICY "Users can update own learning profile"
ON user_learning_profile FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role has full access to learning profile" ON user_learning_profile;
CREATE POLICY "Service role has full access to learning profile"
ON user_learning_profile FOR ALL
USING (auth.role() = 'service_role');

-- learning_events
ALTER TABLE learning_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own learning events" ON learning_events;
CREATE POLICY "Users can insert own learning events"
ON learning_events FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own learning events" ON learning_events;
CREATE POLICY "Users can view own learning events"
ON learning_events FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role has full access to learning events" ON learning_events;
CREATE POLICY "Service role has full access to learning events"
ON learning_events FOR ALL
USING (auth.role() = 'service_role');

-- knowledge_relationships
ALTER TABLE knowledge_relationships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own knowledge relationships" ON knowledge_relationships;
CREATE POLICY "Users can view own knowledge relationships"
ON knowledge_relationships FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role has full access to knowledge relationships" ON knowledge_relationships;
CREATE POLICY "Service role has full access to knowledge relationships"
ON knowledge_relationships FOR ALL
USING (auth.role() = 'service_role');

-- user_concepts
ALTER TABLE user_concepts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own concepts" ON user_concepts;
CREATE POLICY "Users can view own concepts"
ON user_concepts FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own concepts" ON user_concepts;
CREATE POLICY "Users can insert own concepts"
ON user_concepts FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own concepts" ON user_concepts;
CREATE POLICY "Users can update own concepts"
ON user_concepts FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role has full access to user concepts" ON user_concepts;
CREATE POLICY "Service role has full access to user concepts"
ON user_concepts FOR ALL
USING (auth.role() = 'service_role');

-- usage_patterns
ALTER TABLE usage_patterns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own usage patterns" ON usage_patterns;
CREATE POLICY "Users can view own usage patterns"
ON usage_patterns FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role has full access to usage patterns" ON usage_patterns;
CREATE POLICY "Service role has full access to usage patterns"
ON usage_patterns FOR ALL
USING (auth.role() = 'service_role');

-- chunk_interactions
ALTER TABLE chunk_interactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own chunk interactions" ON chunk_interactions;
CREATE POLICY "Users can insert own chunk interactions"
ON chunk_interactions FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own chunk interactions" ON chunk_interactions;
CREATE POLICY "Users can view own chunk interactions"
ON chunk_interactions FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role has full access to chunk interactions" ON chunk_interactions;
CREATE POLICY "Service role has full access to chunk interactions"
ON chunk_interactions FOR ALL
USING (auth.role() = 'service_role');

-- ===== COMENTARIOS =====

COMMENT ON TABLE user_learning_profile IS 
'Perfil de aprendizaje del usuario: preferencias aprendidas, patrones temporales, intereses';

COMMENT ON TABLE learning_events IS 
'Eventos de aprendizaje: queries, feedback, interacciones, errores para análisis posterior';

COMMENT ON TABLE knowledge_relationships IS 
'Relaciones entre chunks de conocimiento para construir grafo conceptual del usuario';

COMMENT ON TABLE user_concepts IS 
'Conceptos aprendidos por el usuario con confianza y referencias a chunks';

COMMENT ON TABLE usage_patterns IS 
'Patrones de uso detectados: horas pico, tópicos preferidos, herramientas más usadas';

COMMENT ON TABLE chunk_interactions IS 
'Tracking granular de interacciones con chunks para mejorar relevancia scores';

-- ===== VERIFICACIÓN =====
SELECT 'Migración de Memoria Personal completada exitosamente' as status;

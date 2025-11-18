-- ==================================================
-- MIGRACIÓN 15: SISTEMA DE MEMORIA PERSONAL
-- CON AUTOAPRENDIZAJE
-- ==================================================
-- Ejecutar en Supabase SQL Editor
-- Fecha: 2025-11-18

-- ===== FASE 1: MEJORAR document_chunks =====

-- Agregar columnas para tracking y relevancia
ALTER TABLE public.document_chunks
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS relevance_score FLOAT DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS access_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_accessed TIMESTAMP WITH TIME ZONE;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_document_chunks_user_id ON public.document_chunks(user_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_relevance ON public.document_chunks(relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_document_chunks_created ON public.document_chunks(created_at DESC);

-- Trigger para updated_at automático
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
-- Perfil de aprendizaje del usuario

CREATE TABLE IF NOT EXISTS user_learning_profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Preferencias aprendidas
    preferred_response_length TEXT DEFAULT 'balanced',
    preferred_tone TEXT DEFAULT 'friendly',
    preferred_model TEXT DEFAULT 'gemini',

    -- Patrones temporales detectados
    peak_activity_hour INT,
    preferred_activity_days TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- Intereses personales
    top_topics TEXT[] DEFAULT ARRAY[]::TEXT[],
    skill_level TEXT DEFAULT 'intermediate',

    -- Estadísticas
    total_interactions INT DEFAULT 0,
    feedback_count INT DEFAULT 0,
    avg_feedback_rating FLOAT DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_learning_profile_user_id ON user_learning_profile(user_id);


-- ===== TABLA: learning_events =====
-- Log de eventos para análisis y aprendizaje

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

    -- Contexto adicional
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_events_user_id ON learning_events(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_events_type ON learning_events(event_type);
CREATE INDEX IF NOT EXISTS idx_learning_events_created ON learning_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_events_user_type ON learning_events(user_id, event_type);


-- ===== TABLA: knowledge_relationships =====
-- Grafo de relaciones entre chunks de conocimiento

CREATE TABLE IF NOT EXISTS knowledge_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    source_chunk_id BIGINT NOT NULL REFERENCES public.document_chunks(id) ON DELETE CASCADE,
    target_chunk_id BIGINT NOT NULL REFERENCES public.document_chunks(id) ON DELETE CASCADE,

    relationship_type TEXT NOT NULL, -- 'related', 'similar', 'contradicts', 'refines', 'precedes'
    strength FLOAT DEFAULT 0.5, -- 0-1 confidence

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(source_chunk_id, target_chunk_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_rel_source ON knowledge_relationships(source_chunk_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_rel_target ON knowledge_relationships(target_chunk_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_rel_user ON knowledge_relationships(user_id);


-- ===== TABLA: user_concepts =====
-- Conceptos aprendidos por usuario

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
    confidence_score FLOAT DEFAULT 0.5,

    -- Estado
    status TEXT DEFAULT 'active', -- 'active', 'archived', 'learning'

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(user_id, concept_name)
);

CREATE INDEX IF NOT EXISTS idx_user_concepts_user_id ON user_concepts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_concepts_status ON user_concepts(status);


-- ===== TABLA: usage_patterns =====
-- Patrones de uso detectados

CREATE TABLE IF NOT EXISTS usage_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    pattern_type TEXT NOT NULL, -- 'time_based', 'topic_based', 'tool_usage'
    pattern_name TEXT,
    pattern_data JSONB NOT NULL,

    -- Estadísticas
    occurrence_count INT DEFAULT 1,
    confidence FLOAT DEFAULT 0.5,
    last_detected TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_patterns_user_id ON usage_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_patterns_type ON usage_patterns(pattern_type);


-- ===== TABLA: chunk_interactions =====
-- Tracking de interacciones con chunks

CREATE TABLE IF NOT EXISTS chunk_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    chunk_id BIGINT NOT NULL REFERENCES public.document_chunks(id) ON DELETE CASCADE,

    interaction_type TEXT, -- 'viewed_in_rag', 'clicked', 'copied', 'helpful', 'not_helpful'
    context TEXT,
    helpful BOOLEAN,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chunk_interactions_user_id ON chunk_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_chunk_interactions_chunk_id ON chunk_interactions(chunk_id);
CREATE INDEX IF NOT EXISTS idx_chunk_interactions_created ON chunk_interactions(created_at DESC);


-- ===== TABLA: communication_styles =====
-- Estilos de comunicación aprendidos por contacto

CREATE TABLE IF NOT EXISTS communication_styles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Identificación del contacto
    contact_identifier TEXT NOT NULL, -- email, teléfono, nombre
    contact_name TEXT,
    platform TEXT, -- 'email', 'whatsapp', 'calendar', 'notion'

    -- Estilo aprendido
    formality_level TEXT DEFAULT 'neutral', -- 'formal', 'neutral', 'casual'
    typical_greeting TEXT,
    typical_closing TEXT,
    tone_keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
    language TEXT DEFAULT 'es', -- Idioma preferido con este contacto

    -- Ejemplos de referencia
    example_messages JSONB DEFAULT '[]',

    -- Métricas
    interaction_count INT DEFAULT 0,
    last_interaction TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(user_id, contact_identifier)
);

CREATE INDEX IF NOT EXISTS idx_communication_styles_user_id ON communication_styles(user_id);
CREATE INDEX IF NOT EXISTS idx_communication_styles_contact ON communication_styles(contact_identifier);
CREATE INDEX IF NOT EXISTS idx_communication_styles_platform ON communication_styles(platform);


-- ===== TABLA: conversation_facts =====
-- Hechos extraídos de conversaciones para memoria a largo plazo

CREATE TABLE IF NOT EXISTS conversation_facts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- El hecho aprendido
    fact_type TEXT NOT NULL, -- 'preference', 'personal_info', 'goal', 'relationship', 'context'
    fact_content TEXT NOT NULL,

    -- Contexto de origen
    source_type TEXT, -- 'chat', 'email', 'calendar', 'notion'
    source_id TEXT,
    extracted_from TEXT, -- Fragmento original

    -- Validación
    confidence FLOAT DEFAULT 0.7,
    confirmed_by_user BOOLEAN DEFAULT false,

    -- Estado
    is_active BOOLEAN DEFAULT true,
    superseded_by UUID REFERENCES conversation_facts(id),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_facts_user_id ON conversation_facts(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_facts_type ON conversation_facts(fact_type);
CREATE INDEX IF NOT EXISTS idx_conversation_facts_active ON conversation_facts(is_active);


-- ===== RLS POLICIES =====

-- user_learning_profile
ALTER TABLE user_learning_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own learning profile" ON user_learning_profile;
CREATE POLICY "Users can view own learning profile" ON user_learning_profile
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own learning profile" ON user_learning_profile;
CREATE POLICY "Users can insert own learning profile" ON user_learning_profile
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own learning profile" ON user_learning_profile;
CREATE POLICY "Users can update own learning profile" ON user_learning_profile
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access learning profile" ON user_learning_profile;
CREATE POLICY "Service role full access learning profile" ON user_learning_profile
    FOR ALL USING (auth.role() = 'service_role');

-- learning_events
ALTER TABLE learning_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own learning events" ON learning_events;
CREATE POLICY "Users can insert own learning events" ON learning_events
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own learning events" ON learning_events;
CREATE POLICY "Users can view own learning events" ON learning_events
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access learning events" ON learning_events;
CREATE POLICY "Service role full access learning events" ON learning_events
    FOR ALL USING (auth.role() = 'service_role');

-- knowledge_relationships
ALTER TABLE knowledge_relationships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own knowledge relationships" ON knowledge_relationships;
CREATE POLICY "Users can view own knowledge relationships" ON knowledge_relationships
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access knowledge relationships" ON knowledge_relationships;
CREATE POLICY "Service role full access knowledge relationships" ON knowledge_relationships
    FOR ALL USING (auth.role() = 'service_role');

-- user_concepts
ALTER TABLE user_concepts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own concepts" ON user_concepts;
CREATE POLICY "Users can view own concepts" ON user_concepts
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own concepts" ON user_concepts;
CREATE POLICY "Users can insert own concepts" ON user_concepts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own concepts" ON user_concepts;
CREATE POLICY "Users can update own concepts" ON user_concepts
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access user concepts" ON user_concepts;
CREATE POLICY "Service role full access user concepts" ON user_concepts
    FOR ALL USING (auth.role() = 'service_role');

-- usage_patterns
ALTER TABLE usage_patterns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own usage patterns" ON usage_patterns;
CREATE POLICY "Users can view own usage patterns" ON usage_patterns
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access usage patterns" ON usage_patterns;
CREATE POLICY "Service role full access usage patterns" ON usage_patterns
    FOR ALL USING (auth.role() = 'service_role');

-- chunk_interactions
ALTER TABLE chunk_interactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own chunk interactions" ON chunk_interactions;
CREATE POLICY "Users can insert own chunk interactions" ON chunk_interactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own chunk interactions" ON chunk_interactions;
CREATE POLICY "Users can view own chunk interactions" ON chunk_interactions
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access chunk interactions" ON chunk_interactions;
CREATE POLICY "Service role full access chunk interactions" ON chunk_interactions
    FOR ALL USING (auth.role() = 'service_role');

-- communication_styles
ALTER TABLE communication_styles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own communication styles" ON communication_styles;
CREATE POLICY "Users can view own communication styles" ON communication_styles
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own communication styles" ON communication_styles;
CREATE POLICY "Users can insert own communication styles" ON communication_styles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own communication styles" ON communication_styles;
CREATE POLICY "Users can update own communication styles" ON communication_styles
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access communication styles" ON communication_styles;
CREATE POLICY "Service role full access communication styles" ON communication_styles
    FOR ALL USING (auth.role() = 'service_role');

-- conversation_facts
ALTER TABLE conversation_facts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own facts" ON conversation_facts;
CREATE POLICY "Users can view own facts" ON conversation_facts
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own facts" ON conversation_facts;
CREATE POLICY "Users can insert own facts" ON conversation_facts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own facts" ON conversation_facts;
CREATE POLICY "Users can update own facts" ON conversation_facts
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access conversation facts" ON conversation_facts;
CREATE POLICY "Service role full access conversation facts" ON conversation_facts
    FOR ALL USING (auth.role() = 'service_role');


-- ===== FUNCIÓN: Actualizar relevance_score basado en interacciones =====

CREATE OR REPLACE FUNCTION update_chunk_relevance_from_interaction()
RETURNS TRIGGER AS $$
BEGIN
    -- Incrementar access_count
    UPDATE public.document_chunks
    SET
        access_count = access_count + 1,
        last_accessed = NOW(),
        relevance_score = CASE
            WHEN NEW.helpful = true THEN LEAST(relevance_score + 0.05, 1.0)
            WHEN NEW.helpful = false THEN GREATEST(relevance_score - 0.05, 0.0)
            ELSE relevance_score
        END
    WHERE id = NEW.chunk_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_chunk_relevance ON chunk_interactions;
CREATE TRIGGER trigger_update_chunk_relevance
    AFTER INSERT ON chunk_interactions
    FOR EACH ROW
    EXECUTE FUNCTION update_chunk_relevance_from_interaction();


-- ===== FUNCIÓN: Actualizar estadísticas de learning_profile =====

CREATE OR REPLACE FUNCTION update_learning_profile_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Crear perfil si no existe
    INSERT INTO user_learning_profile (user_id)
    VALUES (NEW.user_id)
    ON CONFLICT (user_id) DO NOTHING;

    -- Actualizar estadísticas
    UPDATE user_learning_profile
    SET
        total_interactions = total_interactions + 1,
        feedback_count = CASE
            WHEN NEW.rating IS NOT NULL THEN feedback_count + 1
            ELSE feedback_count
        END,
        avg_feedback_rating = CASE
            WHEN NEW.rating IS NOT NULL THEN
                (avg_feedback_rating * feedback_count + NEW.rating) / (feedback_count + 1)
            ELSE avg_feedback_rating
        END,
        updated_at = NOW()
    WHERE user_id = NEW.user_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_learning_profile ON learning_events;
CREATE TRIGGER trigger_update_learning_profile
    AFTER INSERT ON learning_events
    FOR EACH ROW
    EXECUTE FUNCTION update_learning_profile_stats();


-- ===== COMENTARIOS =====

COMMENT ON TABLE user_learning_profile IS 'Perfil de aprendizaje: preferencias, patrones temporales, intereses del usuario';
COMMENT ON TABLE learning_events IS 'Log de eventos para análisis: queries, feedback, errores';
COMMENT ON TABLE knowledge_relationships IS 'Grafo conceptual: relaciones entre chunks de conocimiento';
COMMENT ON TABLE user_concepts IS 'Conceptos aprendidos con confianza y referencias';
COMMENT ON TABLE usage_patterns IS 'Patrones detectados: horas pico, tópicos, herramientas';
COMMENT ON TABLE chunk_interactions IS 'Tracking de interacciones para mejorar relevancia';
COMMENT ON TABLE communication_styles IS 'Estilos de comunicación por contacto/persona';
COMMENT ON TABLE conversation_facts IS 'Hechos extraídos de conversaciones para memoria a largo plazo';


-- ===== VERIFICACIÓN =====
SELECT 'Migración 15 - Sistema de Memoria Personal completada' as status;

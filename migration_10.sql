-- =====================================================
-- MIGRATION 10: Mejoras a Gmail RAG (Fase 7)
-- =====================================================
-- Agregar metadata JSONB a document_chunks para información adicional

-- 1. Agregar columna metadata a document_chunks
ALTER TABLE document_chunks
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 2. Crear índices GIN para búsquedas eficientes en metadata
CREATE INDEX IF NOT EXISTS idx_document_chunks_metadata
ON document_chunks USING GIN (metadata);

-- 3. Crear índice compuesto para búsquedas por source_type + metadata
CREATE INDEX IF NOT EXISTS idx_document_chunks_source_metadata
ON document_chunks(source_type, user_id)
WHERE metadata IS NOT NULL;

-- 4. Agregar comentarios de documentación
COMMENT ON COLUMN document_chunks.metadata IS 'Metadata adicional en formato JSON. Para Gmail: category, is_unread, thread_id, from, date, labels. Para Notion: status, priority, due_date.';

-- 5. Crear función helper para filtrar por metadata
CREATE OR REPLACE FUNCTION filter_chunks_by_metadata(
  p_user_id UUID,
  p_source_type TEXT,
  p_metadata_filter JSONB DEFAULT '{}'::jsonb
) RETURNS TABLE (
  id UUID,
  content TEXT,
  source_id TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.content,
    dc.source_id,
    dc.metadata,
    dc.created_at
  FROM document_chunks dc
  WHERE dc.user_id = p_user_id
    AND dc.source_type = p_source_type
    AND (
      p_metadata_filter = '{}'::jsonb
      OR dc.metadata @> p_metadata_filter  -- Operador de contenencia JSONB
    )
  ORDER BY dc.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Ejemplo de uso:
-- SELECT * FROM filter_chunks_by_metadata(
--   'user-uuid',
--   'gmail',
--   '{"category": "personal", "is_unread": true}'::jsonb
-- );

-- 6. Actualizar función match_document_chunks para considerar metadata
-- (Opcional: agregar weights basados en metadata)
CREATE OR REPLACE FUNCTION match_document_chunks_with_metadata(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5,
  p_source_type text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_metadata_filter jsonb DEFAULT '{}'::jsonb
) RETURNS TABLE (
  id uuid,
  content text,
  similarity float,
  document_id text,
  metadata jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.content,
    1 - (dc.embedding <=> query_embedding) AS similarity,
    dc.source_id AS document_id,
    dc.metadata
  FROM document_chunks dc
  WHERE
    (p_user_id IS NULL OR dc.user_id = p_user_id)
    AND (p_source_type IS NULL OR dc.source_type = p_source_type)
    AND (p_metadata_filter = '{}'::jsonb OR dc.metadata @> p_metadata_filter)
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding ASC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Verificación
SELECT 'Migration 10 ejecutada exitosamente. Columna metadata agregada a document_chunks.' as status;

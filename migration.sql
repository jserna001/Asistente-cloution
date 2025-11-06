-- 1. Habilitar la extensión pg_vector (si aún no está habilitada)
-- Vaya a Database -> Extensions en su dashboard de Supabase y habilite "vector".
-- O ejecute la siguiente línea:
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Crear la tabla para almacenar los chunks de documentos y sus embeddings
-- Esta tabla almacenará el contenido de Notion, Gmail, etc., y sus vectores.
-- NOTA: Si ya tiene una tabla "document_chunks" con una dimensión de embedding diferente,
-- es posible que deba hacer una copia de seguridad de sus datos, eliminar la tabla y volver a crearla.
CREATE TABLE IF NOT EXISTS document_chunks (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    document_id TEXT,
    content TEXT,
    source_type TEXT, -- Para filtrar por 'notion', 'gmail', etc.
    embedding VECTOR(768) -- La dimensión para text-embedding-004 es 768
);

-- 3. Crear la función para buscar chunks de documentos similares
-- Esta función RPC será llamada desde su código de Next.js.
CREATE OR REPLACE FUNCTION match_document_chunks(
    query_embedding VECTOR(768),
    match_threshold FLOAT,
    match_count INT,
    p_source_type TEXT
)
RETURNS TABLE (
    id BIGINT,
    document_id TEXT,
    content TEXT,
    source_type TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        dc.id,
        dc.document_id,
        dc.content,
        dc.source_type,
        1 - (dc.embedding <=> query_embedding) AS similarity
    FROM
        document_chunks dc
    WHERE
        dc.source_type = p_source_type AND
        1 - (dc.embedding <=> query_embedding) > match_threshold
    ORDER BY
        dc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
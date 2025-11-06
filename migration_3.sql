-- Solución: Actualizar la función para forzar la conversión de tipo en la columna 'source_type'
CREATE OR REPLACE FUNCTION public.match_document_chunks(
    query_embedding vector(768),
    match_threshold double precision,
    match_count integer,
    p_source_type text)
    RETURNS TABLE(id bigint, document_id text, content text, source_type text, similarity double precision)
    LANGUAGE 'plpgsql'
    COST 100
    VOLATILE PARALLEL UNSAFE
    ROWS 1000

AS $BODY$
BEGIN
    RETURN QUERY
    SELECT
        dc.id,
        dc.document_id,
        dc.content,
        dc.source_type::text, -- Conversión de tipo explícita aquí
        1 - (dc.embedding <=> query_embedding) AS similarity
    FROM
        document_chunks dc
    WHERE
        dc.source_type::text = p_source_type AND
        1 - (dc.embedding <=> query_embedding) > match_threshold
    ORDER BY
        dc.embedding <=> query_embedding
    LIMIT match_count;
END;
$BODY$;

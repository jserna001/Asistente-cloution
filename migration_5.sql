-- Solución: Eliminar la función existente y volver a crearla con el tipo de retorno correcto para 'id'.
DROP FUNCTION IF EXISTS public.match_document_chunks(vector, double precision, integer, text);

CREATE OR REPLACE FUNCTION public.match_document_chunks(
    query_embedding vector(768),
    match_threshold double precision,
    match_count integer,
    p_source_type text)
    RETURNS TABLE(id uuid, document_id text, content text, source_type text, similarity double precision)
    LANGUAGE 'plpgsql'
    COST 100
    VOLATILE PARALLEL UNSAFE
    ROWS 1000

AS $BODY$
BEGIN
    RETURN QUERY
    SELECT
        dc.id, -- Se quita el cast a bigint
        dc.document_id::text,
        dc.content::text,
        dc.source_type::text,
        (1 - (dc.embedding <=> query_embedding))::double precision AS similarity
    FROM
        public.document_chunks dc
    WHERE
        dc.source_type::text = p_source_type AND
        1 - (dc.embedding <=> query_embedding) > match_threshold
    ORDER BY
        dc.embedding <=> query_embedding
    LIMIT match_count;
END;
$BODY$;
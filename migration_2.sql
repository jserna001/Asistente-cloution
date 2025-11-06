-- Solución: Añadir la columna faltante 'document_id' a la tabla 'document_chunks'
ALTER TABLE public.document_chunks ADD COLUMN document_id TEXT;

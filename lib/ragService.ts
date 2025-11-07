import { GoogleGenerativeAI } from '@google/generative-ai';

// Carga la API key de Gemini (esto es seguro en el backend)
const geminiApiKey = process.env.GEMINI_API_KEY;
if (!geminiApiKey) {
  throw new Error('Falta la variable de entorno GEMINI_API_KEY.');
}

// Inicializa el modelo de embedding una sola vez
const genAI = new GoogleGenerativeAI(geminiApiKey);
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

/**
 * Ejecuta una búsqueda RAG (memoria) para un usuario específico.
 * Ya no crea su propio cliente, sino que recibe el cliente 
 * autenticado de Supabase como argumento.
 */
export async function executeRAG(
  supabase: any, // Cliente de Supabase (ya autenticado)
  userId: string, 
  query: string
): Promise<string> {
  
  console.log(`Ejecutando RAG para el usuario ${userId} con la consulta: "${query}"`);

  // Paso 1: Vectorizar la Pregunta (esto sí lo puede hacer aquí)
  const embeddingResult = await embeddingModel.embedContent(query);
  const queryVector = embeddingResult.embedding.values;

  // Paso 2: Buscar en Supabase usando el cliente y userId proporcionados
  const { data: chunks, error } = await supabase.rpc('match_document_chunks', {
    query_embedding: queryVector,
    match_threshold: 0.4, // Reducido a 0.4 para búsquedas más flexibles
    match_count: 10, // Aumentado de 5 a 10 para obtener más contexto
    user_id_input: userId // ¡La RLS se aplica aquí!
  });

  if (error) {
    console.error('Error en la búsqueda RAG de Supabase:', error);
    return `Error al buscar en la memoria: ${error.message}`;
  }

  if (!chunks || chunks.length === 0) {
    console.log('[RAG] No se encontraron chunks relevantes.');
    console.log(`[RAG] Query: "${query}"`);
    console.log(`[RAG] User ID: ${userId}`);
    return "No se encontró información relevante en la memoria.";
  }

  // Paso 3: Devolver el Contexto
  console.log(`[RAG] ✓ Encontró ${chunks.length} chunks relevantes`);
  console.log(`[RAG] Chunks:`, chunks.map((c: any) => ({ id: c.id, similarity: c.similarity, preview: c.content.substring(0, 50) })));
  const contextText = chunks.map((chunk: any) => chunk.content).join("\n---\n");

  return contextText;
}
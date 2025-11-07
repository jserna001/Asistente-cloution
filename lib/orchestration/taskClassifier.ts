/**
 * Clasificador de tareas usando Gemini Flash
 * Determina qué tipo de tarea es para asignar el modelo óptimo
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { TaskType } from './types';

const geminiApiKey = process.env.GEMINI_API_KEY!;
if (!geminiApiKey) {
  throw new Error('Falta la variable de entorno GEMINI_API_KEY.');
}

const genAI = new GoogleGenerativeAI(geminiApiKey);
const classifierModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

/**
 * Clasifica una consulta del usuario en un tipo de tarea
 */
export async function classifyTask(query: string, ragContext: string): Promise<TaskType> {
  const startTime = Date.now();

  const classificationPrompt = `Eres un clasificador de intenciones. Analiza la solicitud del usuario y clasifícala en UNA categoría.

CATEGORÍAS DISPONIBLES:

1. SIMPLE: Saludos, conversación casual, preguntas generales que NO requieren herramientas
   Ejemplos: "Hola", "¿Cómo estás?", "Gracias", "¿Qué puedes hacer?"

2. RAG: Preguntas sobre información personal del usuario (tareas, correos, notas, calendario)
   Ejemplos: "¿Qué tareas tengo?", "¿Hay correos importantes?", "¿Qué tengo en mi agenda?"
   NOTA: Si el RAG_CONTEXT contiene información relevante, probablemente es RAG

3. BROWSER: Navegar web, interactuar con páginas, hacer búsquedas en internet
   Ejemplos: "Navega a google.com", "Busca información sobre...", "Abre la página de..."

4. NOTION_MCP: CUALQUIER operación que mencione explícitamente "Notion"
   Ejemplos: "Busca en Notion...", "Crea una página en Notion...", "Actualiza mi base de datos de Notion"
   REGLA CRÍTICA: Si la query contiene la palabra "Notion", SIEMPRE clasifica como NOTION_MCP

5. COMPLEX: Tareas que requieren múltiples herramientas o razonamiento profundo
   Ejemplos: "Busca información en web Y añádela a Notion", "Revisa mis correos Y crea tareas"

REGLAS IMPORTANTES (en orden de prioridad):
1. Si la query contiene "Notion" (case-insensitive), SIEMPRE clasifica como NOTION_MCP
2. Si menciona URL o "navega" o "busca en internet", clasifica como BROWSER
3. Si menciona "añadir tarea" o "recuérdame" SIN mencionar Notion, clasifica como SIMPLE
4. Si la pregunta es simple y el RAG_CONTEXT tiene la respuesta, clasifica como RAG
5. Solo usa COMPLEX si claramente necesita 2+ herramientas DIFERENTES

RAG_CONTEXT disponible:
${ragContext ? 'SÍ - hay información relevante en memoria' : 'NO - no hay información relevante'}

Consulta del usuario:
"${query}"

Responde SOLO con UNA palabra (la categoría): SIMPLE, RAG, BROWSER, NOTION_MCP o COMPLEX`;

  try {
    const result = await classifierModel.generateContent(classificationPrompt);
    const classification = result.response.text().trim().toUpperCase();

    // Validar que sea una categoría válida
    const validTypes: TaskType[] = ['SIMPLE', 'RAG', 'BROWSER', 'NOTION_MCP', 'COMPLEX'];
    let taskType = validTypes.includes(classification as TaskType)
      ? (classification as TaskType)
      : 'SIMPLE'; // Fallback seguro

    // OVERRIDE FORZADO: Si la query contiene "Notion", SIEMPRE usar NOTION_MCP
    if (query.toLowerCase().includes('notion')) {
      taskType = 'NOTION_MCP';
      console.log(`[CLASSIFIER] ⚠️ Override aplicado: Query contiene "Notion" → NOTION_MCP`);
    }

    const duration = Date.now() - startTime;
    console.log(`[CLASSIFIER] Query: "${query.substring(0, 50)}..." → ${taskType} (${duration}ms)`);

    return taskType;

  } catch (error: any) {
    console.error('[CLASSIFIER] Error clasificando tarea:', error.message);
    // En caso de error, verificar si contiene "Notion"
    if (query.toLowerCase().includes('notion')) {
      return 'NOTION_MCP';
    }
    return 'SIMPLE';
  }
}

/**
 * Versión síncrona para testing (usa reglas simples sin llamar al modelo)
 */
export function classifyTaskSync(query: string): TaskType {
  const lowerQuery = query.toLowerCase();

  // Reglas simples basadas en palabras clave
  if (lowerQuery.match(/^(hola|hi|hey|buenos días|buenas tardes|buenas noches|adiós|gracias|ok)$/)) {
    return 'SIMPLE';
  }

  if (lowerQuery.includes('navega') || lowerQuery.includes('abre') || lowerQuery.includes('http')) {
    return 'BROWSER';
  }

  if (lowerQuery.includes('tareas') || lowerQuery.includes('correo') || lowerQuery.includes('agenda')) {
    return 'RAG';
  }

  if (lowerQuery.includes('notion') && (lowerQuery.includes('crea') || lowerQuery.includes('actualiza'))) {
    return 'NOTION_MCP';
  }

  // Por defecto, usar modelo potente
  return 'RAG';
}

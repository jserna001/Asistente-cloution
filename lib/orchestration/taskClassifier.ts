/**
 * Clasificador de tareas usando Gemini Flash
 * Determina qué tipo de tarea es para asignar el modelo óptimo
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { TaskType } from './types';

// Lazy loading del modelo para evitar errores al importar el módulo
function getClassifierModel() {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    throw new Error('Falta la variable de entorno GEMINI_API_KEY.');
  }

  const genAI = new GoogleGenerativeAI(geminiApiKey);
  return genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
}

/**
 * Keywords para detectar operaciones de Notion
 */
const NOTION_KEYWORDS = [
  'notion',
  'tarea', 'tareas', 'task', 'tasks', 'todo', 'todos',
  'nota', 'notas', 'note', 'notes',
  'página', 'pagina', 'page', 'pages',
  'idea', 'ideas',
  'recordatorio', 'recordatorios', 'reminder', 'reminders',
  'entrada', 'entradas', 'entry', 'entries',
  'database', 'base de datos', 'bd'
];

const NOTION_ACTIONS = [
  'crear', 'crea', 'create', 'creame',
  'agregar', 'agrega', 'añadir', 'añade', 'add', 'agregame', 'añademe',
  'guardar', 'guarda', 'save',
  'nueva', 'nuevo', 'new',
  'actualizar', 'actualiza', 'update', 'actualizame',
  'editar', 'edita', 'edit',
  'buscar', 'busca', 'search', 'encontrar', 'encuentra', 'find',
  'listar', 'lista', 'list', 'ver', 'mostrar', 'show', 'dame'
];

/**
 * Detecta si una query es una operación de Notion basándose en keywords
 */
function detectNotionOperation(query: string): boolean {
  const lowerQuery = query.toLowerCase();

  // 1. Si menciona explícitamente "notion" → siempre es NOTION_MCP
  if (lowerQuery.includes('notion')) {
    return true;
  }

  // 2. Si combina ACCIÓN + KEYWORD de Notion → probablemente es NOTION_MCP
  const hasNotionAction = NOTION_ACTIONS.some(action => {
    // Buscar la palabra completa (word boundary)
    const regex = new RegExp(`\\b${action}\\b`, 'i');
    return regex.test(lowerQuery);
  });

  const hasNotionKeyword = NOTION_KEYWORDS.some(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    return regex.test(lowerQuery);
  });

  if (hasNotionAction && hasNotionKeyword) {
    console.log(`[CLASSIFIER] 🎯 Detección de Notion: Acción + Keyword encontrados`);
    return true;
  }

  return false;
}

/**
 * Clasifica una consulta del usuario en un tipo de tarea
 */
export async function classifyTask(query: string, ragContext: string): Promise<TaskType> {
  const startTime = Date.now();

  // PRE-CLASIFICACIÓN: Detectar operaciones de Notion con reglas
  if (detectNotionOperation(query)) {
    console.log(`[CLASSIFIER] ⚡ Pre-clasificación: Query detectada como NOTION_MCP (keywords)`);
    return 'NOTION_MCP';
  }

  const classificationPrompt = `Eres un clasificador de intenciones. Analiza la solicitud del usuario y clasifícala en UNA categoría.

CATEGORÍAS DISPONIBLES:

1. SIMPLE: Saludos, conversación casual, preguntas generales que NO requieren herramientas
   Ejemplos: "Hola", "¿Cómo estás?", "Gracias", "¿Qué puedes hacer?"

2. RAG: Preguntas sobre información personal del usuario (correos, calendario) que ya está en memoria
   Ejemplos: "¿Hay correos importantes?", "¿Qué tengo en mi agenda de hoy?"
   NOTA: Si el RAG_CONTEXT contiene información relevante, probablemente es RAG

3. BROWSER: Navegar web, interactuar con páginas, hacer búsquedas en internet
   Ejemplos: "Navega a google.com", "Busca información sobre...", "Abre la página de..."

4. NOTION_MCP: CUALQUIER operación relacionada con tareas, notas, páginas, ideas, recordatorios
   Ejemplos:
   - "Crea una tarea: Comprar leche"
   - "Agregar nota sobre ideas del día"
   - "Nueva página para proyecto X"
   - "Guardar esta idea en mis notas"
   - "Busca en mis tareas pendientes"
   - "Lista mis recordatorios"
   REGLA CRÍTICA: Si menciona crear/agregar/guardar/buscar + (tarea/nota/página/idea) → NOTION_MCP

5. COMPLEX: Tareas que requieren múltiples herramientas o razonamiento profundo
   Ejemplos: "Busca información en web Y añádela a Notion", "Revisa mis correos Y crea tareas"

REGLAS IMPORTANTES (en orden de prioridad):
1. Si la query contiene "Notion" (case-insensitive), SIEMPRE clasifica como NOTION_MCP
2. Si menciona crear/agregar/guardar + (tarea/nota/página/idea), clasifica como NOTION_MCP
3. Si menciona URL o "navega" o "busca en internet", clasifica como BROWSER
4. Si pregunta por información que está en RAG_CONTEXT, clasifica como RAG
5. Solo usa COMPLEX si claramente necesita 2+ herramientas DIFERENTES
6. Solo usa SIMPLE si es conversación casual SIN requerir acciones

RAG_CONTEXT disponible:
${ragContext ? 'SÍ - hay información relevante en memoria' : 'NO - no hay información relevante'}

Consulta del usuario:
"${query}"

Responde SOLO con UNA palabra (la categoría): SIMPLE, RAG, BROWSER, NOTION_MCP o COMPLEX`;

  try {
    const classifierModel = getClassifierModel();
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

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
 * Keywords para detectar operaciones de Google Services
 * Separados por servicio para enrutamiento granular y optimización de costos
 */

// Gmail Keywords
const GMAIL_KEYWORDS = [
  'correo', 'correos', 'email', 'emails', 'mail', 'mensaje', 'mensajes',
  'hilo', 'hilos', 'thread', 'threads', 'bandeja', 'inbox',
  'message', 'messages', 'newsletter', 'gmail'
];

const GMAIL_ACTIONS = [
  'enviar', 'envía', 'envia', 'manda', 'mandar', 'send',
  'buscar', 'busca', 'search', 'encontrar', 'encuentra', 'find',
  'leer', 'lee', 'read', 'revisar', 'revisa', 'check',
  'redactar', 'redacta', 'draft', 'borrador',
  'responder', 'responde', 'reply', 'contestar', 'contesta',
  'reenviar', 'reenvía', 'reenvia', 'forward',
  'etiquetar', 'etiqueta', 'label', 'archivar', 'archiva', 'archive',
  // Keywords de lectura/recepción (fix alucinación)
  'recibir', 'recibí', 'recibido', 'recibidos', 'recibida', 'recibidas', 'received',
  'llegó', 'llegaron', 'llegar', 'arrived',
  'tengo', 'hay', 'have', 'got',
  'me llegó', 'me llegaron'
];

// Calendar Keywords
const CALENDAR_KEYWORDS = [
  'evento', 'eventos', 'event', 'events',
  'reunión', 'reuniones', 'reunion', 'reuniones', 'meeting', 'meetings',
  'cita', 'citas', 'appointment', 'appointments',
  'calendario', 'calendar', 'agenda', 'schedule'
];

const CALENDAR_ACTIONS = [
  'crear', 'crea', 'create', 'creame',
  'agendar', 'agenda', 'programar', 'programa', 'schedule',
  'listar', 'lista', 'list', 'mostrar', 'muestra', 'show',
  'buscar', 'busca', 'search', 'encontrar', 'encuentra', 'find',
  'cancelar', 'cancela', 'cancel', 'borrar', 'borra', 'delete',
  'actualizar', 'actualiza', 'update', 'modificar', 'modifica', 'modify',
  'ver', 'check', 'qué tengo', 'que tengo', 'what do i have'
];

// Google Tasks Keywords (tareas simples, no Notion)
const TASKS_KEYWORDS = [
  'recordatorio', 'recordatorios', 'reminder', 'reminders',
  'pendiente', 'pendientes', 'to-do', 'todo'
];

const TASKS_ACTIONS = [
  'crear', 'crea', 'create',
  'agregar', 'agrega', 'añadir', 'añade', 'add',
  'anotar', 'anota',
  'listar', 'lista', 'list',
  'mostrar', 'muestra', 'show',
  'completar', 'completa', 'complete', 'marcar', 'marca', 'mark'
];

// Google Drive Keywords
const DRIVE_KEYWORDS = [
  'documento', 'documentos', 'doc', 'docs', 'document', 'documents',
  'hoja de cálculo', 'hoja de calculo', 'sheet', 'sheets', 'spreadsheet',
  'presentación', 'presentacion', 'slide', 'slides', 'presentation',
  'archivo', 'archivos', 'file', 'files',
  'google doc', 'google docs', 'google sheet', 'google sheets'
];

const DRIVE_ACTIONS = [
  'crear', 'crea', 'create',
  'nuevo', 'nueva', 'new',
  'buscar', 'busca', 'search',
  'encontrar', 'encuentra', 'find'
];

/**
 * Keywords para detectar operaciones de Notion (refinadas)
 * Notion maneja tareas COMPLEJAS con contexto de proyecto
 */
const NOTION_KEYWORDS = [
  'notion',
  'proyecto', 'proyectos', 'project', 'projects',
  'nota', 'notas', 'note', 'notes',
  'página', 'pagina', 'page', 'pages',
  'idea', 'ideas',
  'wiki', 'base de conocimiento', 'knowledge base',
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
 * Función de ayuda para detectar si una query tiene keywords y acciones
 */
function hasKeywords(query: string, actions: string[], keywords: string[]): boolean {
  const lowerQuery = query.toLowerCase();

  const hasAction = actions.some(action => {
    const regex = new RegExp(`\\b${action}\\b`, 'i');
    return regex.test(lowerQuery);
  });

  const hasKeyword = keywords.some(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    return regex.test(lowerQuery);
  });

  return hasAction && hasKeyword;
}

/**
 * Detecta operaciones de Gmail
 */
function detectGmailOperation(query: string): boolean {
  const lowerQuery = query.toLowerCase();

  // Si menciona explícitamente "gmail"
  if (lowerQuery.includes('gmail')) {
    return true;
  }

  return hasKeywords(query, GMAIL_ACTIONS, GMAIL_KEYWORDS);
}

/**
 * Detecta operaciones de Calendar
 */
function detectCalendarOperation(query: string): boolean {
  const lowerQuery = query.toLowerCase();

  // Si menciona explícitamente "calendar" o "calendario"
  if (lowerQuery.includes('calendar') || lowerQuery.includes('calendario')) {
    return true;
  }

  return hasKeywords(query, CALENDAR_ACTIONS, CALENDAR_KEYWORDS);
}

/**
 * Detecta operaciones de Google Tasks (tareas simples)
 */
function detectTasksOperation(query: string): boolean {
  return hasKeywords(query, TASKS_ACTIONS, TASKS_KEYWORDS);
}

/**
 * Detecta operaciones de Google Drive
 */
function detectDriveOperation(query: string): boolean {
  const lowerQuery = query.toLowerCase();

  // Si menciona explícitamente "google doc", "google sheet", etc.
  if (lowerQuery.includes('google doc') || lowerQuery.includes('google sheet') || lowerQuery.includes('google slide')) {
    return true;
  }

  return hasKeywords(query, DRIVE_ACTIONS, DRIVE_KEYWORDS);
}

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
  if (hasKeywords(query, NOTION_ACTIONS, NOTION_KEYWORDS)) {
    console.log(`[CLASSIFIER] 🎯 Detección de Notion: Acción + Keyword encontrados`);
    return true;
  }

  return false;
}

/**
 * Clasifica una consulta del usuario en un tipo de tarea
 * Orden de precedencia según la arquitectura de investigación:
 * 1. Google Services explícitos (Gmail, Calendar, Drive)
 * 2. Notion explícito
 * 3. Google Tasks (tareas simples sin contexto)
 * 4. Browser, Complex
 * 5. Default (Simple/RAG)
 */
export async function classifyTask(query: string, ragContext: string): Promise<TaskType> {
  const startTime = Date.now();

  // --- FASE 1: Google Services Explícitos (Alta Precedencia) ---
  // Estos se comprueban primero porque "correo" y "evento" son raramente ambiguos
  if (detectGmailOperation(query)) {
    console.log(`[CLASSIFIER] ⚡ Pre-clasificación: Query detectada como GMAIL (keywords)`);
    return 'GMAIL';
  }

  if (detectCalendarOperation(query)) {
    console.log(`[CLASSIFIER] ⚡ Pre-clasificación: Query detectada como CALENDAR (keywords)`);
    return 'CALENDAR';
  }

  if (detectDriveOperation(query)) {
    console.log(`[CLASSIFIER] ⚡ Pre-clasificación: Query detectada como GOOGLE_DRIVE (keywords)`);
    return 'GOOGLE_DRIVE';
  }

  // --- FASE 2: Notion Explícito (Alta Precedencia) ---
  // Comprobar Notion antes de tareas genéricas es crucial
  if (detectNotionOperation(query)) {
    console.log(`[CLASSIFIER] ⚡ Pre-clasificación: Query detectada como NOTION_MCP (keywords)`);
    return 'NOTION_MCP';
  }

  // --- FASE 3: Google Tasks (Resolución de Ambigüedad) ---
  // Si no es una tarea de Notion (ej. "tarea en el proyecto X"),
  // se asume que es una tarea simple de Google Tasks
  if (detectTasksOperation(query)) {
    console.log(`[CLASSIFIER] ⚡ Pre-clasificación: Query detectada como GOOGLE_TASKS (keywords)`);
    return 'GOOGLE_TASKS';
  }

  // --- FASE 4: Clasificación por LLM (fallback para casos ambiguos) ---
  const classificationPrompt = `Eres un clasificador de intenciones. Analiza la solicitud del usuario y clasifícala en UNA categoría.

CATEGORÍAS DISPONIBLES:

1. SIMPLE: Saludos, conversación casual, preguntas generales que NO requieren herramientas
   Ejemplos: "Hola", "¿Cómo estás?", "Gracias", "¿Qué puedes hacer?"

2. RAG: Preguntas sobre información personal del usuario que ya está en memoria
   Ejemplos: "¿Hay algo importante en mi bandeja?", "Resumen de mis tareas"
   NOTA: Si el RAG_CONTEXT contiene información relevante, probablemente es RAG

3. BROWSER: Navegar web, interactuar con páginas, hacer búsquedas en internet
   Ejemplos: "Navega a google.com", "Busca información sobre...", "Abre la página de..."

4. GMAIL: Operaciones de correo electrónico
   Ejemplos: "Envía un correo a Juan", "Busca correos de la semana pasada", "Lee mi último email"

5. CALENDAR: Operaciones de calendario y eventos
   Ejemplos: "Crea un evento mañana", "¿Qué tengo en mi agenda?", "Cancela mi reunión de las 3pm"

6. GOOGLE_TASKS: Tareas simples sin contexto de proyecto
   Ejemplos: "Recuérdame comprar leche", "Añade tarea: llamar al dentista"

7. GOOGLE_DRIVE: Crear documentos de Google
   Ejemplos: "Crea un Google Doc para mis notas", "Nueva hoja de cálculo de presupuesto"

8. NOTION_MCP: Operaciones complejas de Notion (proyectos, notas elaboradas, bases de datos)
   Ejemplos:
   - "Añadir tarea al proyecto X"
   - "Guardar nota en mi base de conocimiento"
   - "Busca en mis páginas de Notion"

9. COMPLEX: Tareas que requieren múltiples herramientas o razonamiento profundo
   Ejemplos: "Busca información en web Y añádela a Notion"

REGLAS IMPORTANTES (en orden de prioridad):

⚠️ DISTINCIÓN CRÍTICA: Lectura vs Escritura
- LECTURA de datos existentes (consultas sobre información ya ingresada) → RAG
- ESCRITURA de nuevos datos (enviar email, crear evento) → GMAIL/CALENDAR/etc.

Ejemplos:
✅ "¿Qué correos he recibido hoy?" → RAG (lectura)
✅ "¿Recibí algún correo de Anthropic?" → RAG (lectura)
✅ "¿Qué eventos tengo mañana?" → RAG (lectura)
❌ "Envía un correo a Juan" → GMAIL (escritura)
❌ "Crea un evento para mañana" → CALENDAR (escritura)

1. Si PREGUNTA sobre correos/eventos RECIBIDOS o existentes → RAG (NO GMAIL/CALENDAR)
2. Si ENVÍA/CREA correo/evento → GMAIL/CALENDAR
3. Si menciona "Google Doc/Sheet/Slide" → GOOGLE_DRIVE
4. Si menciona "recordatorio/to-do" simple → GOOGLE_TASKS
5. Si menciona "Notion" o "proyecto" o contexto complejo → NOTION_MCP
6. Si menciona URL o "navega" → BROWSER
7. Si pregunta por información y RAG_CONTEXT tiene datos relevantes → RAG
8. Solo usa COMPLEX si claramente necesita 2+ herramientas DIFERENTES
9. Solo usa SIMPLE si es conversación casual SIN requerir acciones o datos

RAG_CONTEXT disponible:
${ragContext ? 'SÍ - hay información relevante en memoria' : 'NO - no hay información relevante'}

Consulta del usuario:
"${query}"

Responde SOLO con UNA palabra (la categoría): SIMPLE, RAG, BROWSER, GMAIL, CALENDAR, GOOGLE_TASKS, GOOGLE_DRIVE, NOTION_MCP o COMPLEX`;

  try {
    const classifierModel = getClassifierModel();
    const result = await classifierModel.generateContent(classificationPrompt);
    const classification = result.response.text().trim().toUpperCase();

    // Validar que sea una categoría válida (actualizado con nuevos TaskTypes)
    const validTypes: TaskType[] = [
      'SIMPLE', 'RAG', 'BROWSER',
      'GMAIL', 'CALENDAR', 'GOOGLE_TASKS', 'GOOGLE_DRIVE',
      'NOTION_MCP', 'COMPLEX'
    ];
    let taskType = validTypes.includes(classification as TaskType)
      ? (classification as TaskType)
      : 'SIMPLE'; // Fallback seguro

    // OVERRIDES FORZADOS (asegurar clasificación correcta)
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('gmail')) {
      taskType = 'GMAIL';
      console.log(`[CLASSIFIER] ⚠️ Override aplicado: Query contiene "gmail" → GMAIL`);
    } else if (lowerQuery.includes('calendar') || lowerQuery.includes('calendario')) {
      taskType = 'CALENDAR';
      console.log(`[CLASSIFIER] ⚠️ Override aplicado: Query contiene "calendar/calendario" → CALENDAR`);
    } else if (lowerQuery.includes('notion')) {
      taskType = 'NOTION_MCP';
      console.log(`[CLASSIFIER] ⚠️ Override aplicado: Query contiene "notion" → NOTION_MCP`);
    }

    const duration = Date.now() - startTime;
    console.log(`[CLASSIFIER] Query: "${query.substring(0, 50)}..." → ${taskType} (${duration}ms)`);

    return taskType;

  } catch (error: any) {
    console.error('[CLASSIFIER] Error clasificando tarea:', error.message);

    // En caso de error, aplicar reglas de fallback
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes('gmail') || lowerQuery.includes('correo') || lowerQuery.includes('email')) {
      return 'GMAIL';
    }
    if (lowerQuery.includes('calendar') || lowerQuery.includes('evento') || lowerQuery.includes('reunión')) {
      return 'CALENDAR';
    }
    if (lowerQuery.includes('notion')) {
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

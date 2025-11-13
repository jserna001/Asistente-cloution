/**
 * Tipos compartidos para el sistema de orquestación multi-modelo
 */

// Tipos de tareas que el sistema puede clasificar
export type TaskType =
  | 'SIMPLE'         // Saludos, conversación casual
  | 'RAG'            // Búsquedas en memoria (tareas, correos, notas)
  | 'BROWSER'        // Navegación web y automatización
  | 'GMAIL'          // Operaciones de Gmail (enviar, buscar, leer correos)
  | 'CALENDAR'       // Operaciones de Google Calendar (crear, listar, buscar eventos)
  | 'GOOGLE_TASKS'   // Tareas simples de Google Tasks (crear, listar tareas)
  | 'GOOGLE_DRIVE'   // Operaciones de Google Drive (crear documentos)
  | 'NOTION_MCP'     // Operaciones complejas de Notion vía MCP
  | 'COMPLEX';       // Tareas multi-herramienta o razonamiento profundo

// Configuración del modelo a usar
export interface ModelConfig {
  provider: 'gemini' | 'claude';
  model: string;
}

// Mapeo de tipos de tarea a configuración de modelo
export const TASK_MODEL_MAPPING: Record<TaskType, ModelConfig> = {
  SIMPLE: { provider: 'gemini', model: 'gemini-2.0-flash-exp' },
  RAG: { provider: 'gemini', model: 'gemini-2.0-flash-exp' },
  BROWSER: { provider: 'gemini', model: 'gemini-2.0-flash-exp' },
  GMAIL: { provider: 'gemini', model: 'gemini-2.0-flash-exp' },            // Google Services → Gemini Flash (ahorro de costos)
  CALENDAR: { provider: 'gemini', model: 'gemini-2.0-flash-exp' },
  GOOGLE_TASKS: { provider: 'gemini', model: 'gemini-2.0-flash-exp' },
  GOOGLE_DRIVE: { provider: 'gemini', model: 'gemini-2.0-flash-exp' },
  NOTION_MCP: { provider: 'claude', model: 'claude-sonnet-4-20250514' },  // Notion → Claude Sonnet (alta complejidad)
  COMPLEX: { provider: 'claude', model: 'claude-sonnet-4-20250514' }
};

// Formato de mensaje del historial
export interface ChatMessage {
  role: 'user' | 'model' | 'assistant';
  content: string;
}

// Resultado de ejecución de un modelo
export interface ModelExecutionResult {
  answer: string;
  modelUsed: string;
  taskType: TaskType;
  executionTimeMs: number;
}

// Herramienta en formato genérico
export interface GenericTool {
  name: string;
  description: string;
  parameters: any;
}

// Contexto de ejecución
export interface ExecutionContext {
  userId: string;
  query: string;
  history: ChatMessage[];
  ragContext: string;
  supabase: any;
}

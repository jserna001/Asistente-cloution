/**
 * Orquestador Central Multi-Modelo
 *
 * Coordina el flujo completo:
 * 1. Clasifica la tarea con Gemini Flash
 * 2. Selecciona el modelo óptimo
 * 3. Delega la ejecución al ejecutor apropiado
 * 4. Retorna el resultado con métricas
 */

import { classifyTask } from './taskClassifier';
import { executeGemini } from './geminiExecutor';
import { executeClaude } from './claudeExecutor';
import {
  TaskType,
  ModelConfig,
  ExecutionContext,
  ModelExecutionResult,
  TASK_MODEL_MAPPING
} from './types';

/**
 * Punto de entrada principal del orquestador
 */
export async function orchestrateModelExecution(
  context: ExecutionContext
): Promise<ModelExecutionResult> {
  const totalStartTime = Date.now();

  console.log('\n=== ORQUESTADOR MULTI-MODELO ===');
  console.log(`Query: "${context.query.substring(0, 100)}..."`);
  console.log(`Usuario: ${context.userId}`);

  // PASO 1: Clasificar la tarea
  console.log('\n[1/3] CLASIFICACIÓN DE TAREA');
  let taskType = await classifyTask(context.query, context.ragContext);
  let modelConfig = TASK_MODEL_MAPPING[taskType];

  console.log(`✓ Tarea clasificada como: ${taskType}`);
  console.log(`✓ Modelo seleccionado: ${modelConfig.provider} / ${modelConfig.model}`);

  // VALIDACIÓN PRE-EJECUCIÓN: Prevenir alucinaciones
  console.log('\n[1.5/3] VALIDACIÓN DE CLASIFICACIÓN');
  const validationResult = validateTaskClassification(context.query, taskType, modelConfig);

  if (validationResult.shouldOverride) {
    console.log(`⚠️ OVERRIDE: ${validationResult.reason}`);
    taskType = validationResult.newTaskType!;
    modelConfig = TASK_MODEL_MAPPING[taskType];
    console.log(`✓ Nueva clasificación: ${taskType}`);
    console.log(`✓ Nuevo modelo: ${modelConfig.provider} / ${modelConfig.model}`);
  } else {
    console.log(`✓ Clasificación válida, continuando...`);
  }

  // PASO 2: Seleccionar herramientas según tipo de tarea
  console.log('\n[2/3] PREPARACIÓN DE HERRAMIENTAS');
  const toolsConfig = selectToolsForTask(taskType);
  console.log(`✓ Herramientas: ${toolsConfig.join(', ')}`);

  // PASO 3: Ejecutar con el modelo apropiado
  console.log('\n[3/3] EJECUCIÓN DEL MODELO');
  let answer: string;
  const executionStartTime = Date.now();

  try {
    if (modelConfig.provider === 'gemini') {
      // Pasar taskType para que cargue las herramientas correctas
      answer = await executeGemini(modelConfig.model, context, taskType, toolsConfig);
    } else if (modelConfig.provider === 'claude') {
      const useMCP = taskType === 'NOTION_MCP' || taskType === 'COMPLEX';
      answer = await executeClaude(modelConfig.model, context, useMCP);
    } else {
      throw new Error(`Proveedor de modelo no soportado: ${modelConfig.provider}`);
    }
  } catch (error: any) {
    console.error(`\n✗ ERROR en ejecución de ${modelConfig.provider}:`, error.message);

    // Fallback: intentar con Gemini Flash si falla Claude
    if (modelConfig.provider === 'claude') {
      console.log('\n⚠️ FALLBACK: Intentando con Gemini Flash 2.0...');
      answer = await executeGemini('gemini-2.0-flash-exp', context, undefined);
    } else {
      throw error;
    }
  }

  const executionTime = Date.now() - executionStartTime;
  const totalTime = Date.now() - totalStartTime;

  // Resultado final con métricas
  const result: ModelExecutionResult = {
    answer,
    modelUsed: `${modelConfig.provider}:${modelConfig.model}`,
    taskType,
    executionTimeMs: executionTime
  };

  console.log('\n=== RESULTADO ===');
  console.log(`✓ Respuesta generada (${answer.length} caracteres)`);
  console.log(`✓ Tiempo de ejecución: ${executionTime}ms`);
  console.log(`✓ Tiempo total: ${totalTime}ms`);
  console.log('=================\n');

  // Registrar métricas (para futuro monitoring)
  logMetrics(result, totalTime);

  return result;
}

/**
 * Valida que la clasificación sea correcta y previene alucinaciones
 */
interface ValidationResult {
  shouldOverride: boolean;
  reason?: string;
  newTaskType?: TaskType;
}

function validateTaskClassification(
  query: string,
  taskType: TaskType,
  modelConfig: ModelConfig
): ValidationResult {
  const lowerQuery = query.toLowerCase();

  // VALIDACIÓN 1: Si Gemini Flash fue seleccionado pero la query menciona crear/agregar notas/páginas/ideas
  // → Debe ser NOTION_MCP con Claude
  if (modelConfig.provider === 'gemini' && modelConfig.model.includes('flash')) {
    const notionComplexKeywords = [
      'nota', 'notas', 'note', 'notes',
      'página', 'pagina', 'page', 'pages',
      'idea', 'ideas',
      'documento', 'documentos'
    ];

    const notionComplexActions = [
      'crear', 'crea', 'create',
      'agregar', 'agrega', 'añadir', 'añade', 'add',
      'guardar', 'guarda', 'save',
      'nueva', 'nuevo', 'new'
    ];

    const hasComplexAction = notionComplexActions.some(action => {
      const regex = new RegExp(`\\b${action}\\b`, 'i');
      return regex.test(lowerQuery);
    });

    const hasComplexKeyword = notionComplexKeywords.some(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      return regex.test(lowerQuery);
    });

    if (hasComplexAction && hasComplexKeyword) {
      return {
        shouldOverride: true,
        reason: 'Query requiere crear nota/página/idea → Gemini Flash NO puede hacerlo → Redirigiendo a Claude Sonnet con MCP',
        newTaskType: 'NOTION_MCP'
      };
    }
  }

  // VALIDACIÓN 2: Si la clasificación es SIMPLE pero la query menciona "buscar" + "notion/tareas/notas"
  // → Probablemente debería ser NOTION_MCP o RAG
  if (taskType === 'SIMPLE') {
    const hasSearch = /\b(buscar|busca|search|encontrar|encuentra|find|listar|lista|list|dame|mostrar)\b/i.test(lowerQuery);
    const hasNotionContent = /\b(notion|tarea|tareas|nota|notas|idea|ideas)\b/i.test(lowerQuery);

    if (hasSearch && hasNotionContent) {
      return {
        shouldOverride: true,
        reason: 'Query pide buscar en Notion/tareas/notas → Requiere herramientas → Redirigiendo a NOTION_MCP',
        newTaskType: 'NOTION_MCP'
      };
    }
  }

  // No se requiere override
  return { shouldOverride: false };
}

/**
 * Selecciona las herramientas apropiadas según el tipo de tarea
 */
function selectToolsForTask(taskType: TaskType): string[] {
  switch (taskType) {
    case 'SIMPLE':
      // Solo responder, sin herramientas complejas
      return ['answer_user'];

    case 'RAG':
      // RAG ya se ejecutó, solo necesita responder
      return ['answer_user'];

    case 'BROWSER':
      // Herramientas de navegador + responder
      return ['browser.browse_web', 'browser.type_text', 'browser.click_element', 'answer_user'];

    case 'NOTION_MCP':
      // Para Claude: MCP se carga automáticamente
      // Para Gemini (fallback): herramienta básica de Notion
      return ['api.add_task_to_notion', 'answer_user'];

    case 'COMPLEX':
      // Todas las herramientas disponibles
      return [
        'answer_user',
        'api.add_task_to_notion',
        'browser.browse_web',
        'browser.type_text',
        'browser.click_element'
      ];

    default:
      return ['answer_user'];
  }
}

/**
 * Registra métricas para monitoring
 */
function logMetrics(result: ModelExecutionResult, totalTime: number): void {
  // Por ahora solo log a consola, en el futuro se puede enviar a un sistema de métricas
  const metrics = {
    timestamp: new Date().toISOString(),
    taskType: result.taskType,
    modelUsed: result.modelUsed,
    executionTimeMs: result.executionTimeMs,
    totalTimeMs: totalTime,
    responseLength: result.answer.length
  };

  console.log('[METRICS]', JSON.stringify(metrics));

  // TODO: Enviar a sistema de métricas (ej. Supabase analytics table, Vercel Analytics, etc.)
}

/**
 * Función de conveniencia para testing
 */
export async function testOrchestrator(
  userId: string,
  query: string,
  supabase: any
): Promise<string> {
  const context: ExecutionContext = {
    userId,
    query,
    history: [],
    ragContext: '',
    supabase
  };

  const result = await orchestrateModelExecution(context);
  return result.answer;
}

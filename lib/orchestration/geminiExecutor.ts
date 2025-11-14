/**
 * Ejecutor de modelos Gemini (Flash y Pro)
 * Refactorizado del código original de /api/chat
 * Incluye integración con Google Services
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { ExecutionContext, ChatMessage, TaskType } from './types';
import { addNotionTodo } from '../notionActions';
import { executeBrowserAction } from '../browserService';
import { getToolsForTaskType } from '../googleServices/toolDefinitions';
import { getSystemPromptForTaskType } from '../googleServices/systemPrompts';
import { executeGoogleTool, isGoogleTool } from '../googleServices/toolExecutor';

const geminiApiKey = process.env.GEMINI_API_KEY!;
if (!geminiApiKey) {
  throw new Error('Falta la variable de entorno GEMINI_API_KEY.');
}

const genAI = new GoogleGenerativeAI(geminiApiKey);
const NOTION_PAGE_ID = "2a1b6781ca4a80f9a481ea7a4d0d4ca6";
const MAX_AGENT_STEPS = 5;

// Definición de herramientas disponibles para Gemini
const geminiTools = [{
  functionDeclarations: [
    {
      name: "answer_user",
      description: "Responde directamente al usuario con un texto final.",
      parameters: {
        type: "object",
        properties: {
          respuesta: {
            type: "string",
            description: "La respuesta final y completa para el usuario."
          }
        },
        required: ["respuesta"]
      }
    },
    {
      name: "api.add_task_to_notion",
      description: "Añade una TAREA SIMPLE a una lista predefinida de Notion. SOLO para tareas simples (ej: 'comprar leche'). NO usar para crear notas, páginas o ideas complejas.",
      parameters: {
        type: "object",
        properties: {
          task_text: {
            type: "string",
            description: "El texto de la tarea SIMPLE a añadir. Debe ser breve y concreta. Ejemplo: 'comprar leche', 'llamar a Juan'"
          }
        },
        required: ["task_text"]
      }
    },
    {
      name: 'browser.browse_web',
      description: 'Navega a una URL específica.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'La URL completa a la que navegar.'
          }
        },
        required: ['url']
      }
    },
    {
      name: 'browser.type_text',
      description: 'Escribe texto en un campo de entrada (input).',
      parameters: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'El selector CSS, ID o "name" del input (ej. "#email", "username").'
          },
          text: {
            type: 'string',
            description: 'El texto a escribir.'
          }
        },
        required: ['selector', 'text']
      }
    },
    {
      name: 'browser.click_element',
      description: 'Hace clic en un elemento interactivo (botón o enlace).',
      parameters: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'El selector o texto visible del botón/enlace (ej. "Login", "a.enlace-factura").'
          },
          description: {
            type: 'string',
            description: 'Una breve descripción de por qué se hace clic en este elemento.'
          }
        },
        required: ['selector', 'description']
      }
    }
  ]
}] as any;

/**
 * Ejecuta una consulta usando Gemini (Flash o Pro)
 */
export async function executeGemini(
  modelName: string,
  context: ExecutionContext,
  taskType?: TaskType, // Nuevo: TaskType para cargar herramientas específicas
  toolsSubset?: string[] // Opcionalmente filtrar herramientas disponibles
): Promise<string> {
  const startTime = Date.now();

  console.log(`[GEMINI] Ejecutando con modelo: ${modelName}`);
  console.log(`[GEMINI] TaskType: ${taskType || 'general'}`);
  console.log(`[GEMINI] Query: "${context.query.substring(0, 100)}..."`);

  // Inicializar modelo
  const chatModel = genAI.getGenerativeModel({ model: modelName });

  // Cargar herramientas según TaskType
  let tools: any;

  if (taskType && ['GMAIL', 'CALENDAR', 'GOOGLE_TASKS', 'GOOGLE_DRIVE'].includes(taskType)) {
    // Usar herramientas de Google Services
    const googleTools = getToolsForTaskType(taskType);
    tools = [{ functionDeclarations: googleTools }];
    console.log(`[GEMINI] Cargadas ${googleTools.length} herramientas para ${taskType}`);
  } else {
    // Usar herramientas estándar (browser, notion, etc.)
    tools = geminiTools;

    // Filtrar herramientas si se especifica
    if (toolsSubset && toolsSubset.length > 0) {
      tools = [{
        functionDeclarations: geminiTools[0].functionDeclarations.filter(
          (tool: any) => toolsSubset.includes(tool.name)
        )
      }];
    }
  }

  // Construir instrucciones del sistema (específicas para Google Services si aplica)
  const systemInstructionText = buildSystemInstruction(taskType);

  // Procesar historial
  const processedHistory = context.history.map((msg: ChatMessage) => ({
    role: msg.role,
    parts: [{ text: msg.content }],
  }));

  // Iniciar chat
  const chat = chatModel.startChat({
    tools,
    history: processedHistory,
  });

  // Construir prompt con RAG context
  const ragContextPresent = context.ragContext && context.ragContext.trim().length > 0;

  const userPrompt = `
${systemInstructionText}

**INFORMACIÓN DEL USUARIO (RAG_CONTEXT):**
${ragContextPresent
  ? `El usuario tiene la siguiente información almacenada que es RELEVANTE para su consulta:\n\n${context.ragContext}\n\nDEBES usar esta información para responder.`
  : 'No se encontró información relevante en la memoria del usuario para esta consulta.'
}

**Solicitud del Usuario:**
${context.query}
`;

  let step = 0;
  let result = await chat.sendMessage(userPrompt);
  let finalResponseText: string | undefined = undefined;

  // Bucle ReAct
  let functionCalls = typeof result.response.functionCalls === 'function'
    ? result.response.functionCalls()
    : result.response.functionCalls;

  while (functionCalls && functionCalls.length > 0 && step < MAX_AGENT_STEPS) {
    step++;
    const toolCall = functionCalls[0];
    let toolResult: any;

    console.log(`[GEMINI] Paso ${step}: Llamando herramienta: ${toolCall.name}`);

    // Caso especial: answer_user finaliza el bucle
    if (toolCall.name === 'answer_user') {
      finalResponseText = (toolCall.args as any).respuesta;
      break;
    }

    // Ejecutar herramienta
    if (isGoogleTool(toolCall.name)) {
      // Herramientas de Google Services
      toolResult = await executeGoogleTool(
        toolCall.name,
        toolCall.args,
        context.supabase,
        context.userId
      );
      console.log('[GEMINI] Google tool result:', toolResult);
    } else {
      // Herramientas estándar (browser, notion, etc.)
      switch (toolCall.name) {
        case 'api.add_task_to_notion':
          await addNotionTodo(context.userId, NOTION_PAGE_ID, (toolCall.args as any).task_text);
          toolResult = "Tarea añadida con éxito.";
          break;

        default:
          if (toolCall.name.startsWith('browser.')) {
            toolResult = await executeBrowserAction(
              context.userId,
              context.supabase,
              toolCall.name,
              toolCall.args
            );
            console.log('[GEMINI] Browser tool result:', toolResult);
          } else {
            console.warn(`[GEMINI] Herramienta desconocida: ${toolCall.name}`);
            toolResult = 'Herramienta no reconocida.';
          }
          break;
      }
    }

    // Enviar resultado de vuelta al modelo
    result = await chat.sendMessage([{
      functionResponse: {
        name: toolCall.name,
        response: { content: toolResult }
      }
    }]);

    // Actualizar functionCalls
    functionCalls = typeof result.response.functionCalls === 'function'
      ? result.response.functionCalls()
      : result.response.functionCalls;
  }

  // Obtener respuesta final
  if (!finalResponseText) {
    finalResponseText = result.response.text() ?? 'Acción completada, pero no se proporcionó respuesta de texto.';
  }

  const duration = Date.now() - startTime;
  console.log(`[GEMINI] ✓ Completado en ${duration}ms (${step} pasos)`);

  return finalResponseText;
}

/**
 * Construye las instrucciones del sistema para Gemini
 * @param taskType - Si es un TaskType de Google Services, usar su system prompt específico
 */
function buildSystemInstruction(taskType?: TaskType): string {
  // Si es un TaskType de Google Services, usar su system prompt específico
  if (taskType && ['GMAIL', 'CALENDAR', 'GOOGLE_TASKS', 'GOOGLE_DRIVE'].includes(taskType)) {
    return getSystemPromptForTaskType(taskType);
  }

  // System prompt estándar para otros casos

  return `Eres un asistente personal IA que ayuda al usuario con sus tareas, correos, calendarios y datos personales.

🔐 AUTORIZACIÓN DE ACCESO A DATOS PERSONALES:
El usuario ha dado consentimiento explícito para que accedas a su información personal incluyendo:
- Correos electrónicos (Gmail)
- Eventos de calendario (Google Calendar)
- Tareas y notas (Notion)
- Otros datos personales almacenados en el sistema

El campo RAG_CONTEXT que recibes contiene información REAL del usuario que ÉL MISMO ingresó y autorizó compartir contigo.
Es tu OBLIGACIÓN usar esta información para responder sus preguntas de manera útil y precisa.

IMPORTANTE:
✅ SÍ puedes acceder y usar información del RAG_CONTEXT (correos, eventos, tareas, etc.)
✅ SÍ debes responder preguntas sobre sus correos, calendario, etc. usando el RAG_CONTEXT
✅ SÍ está dentro de tu propósito ayudar con datos personales del usuario
❌ NO rechaces consultas legítimas por "privacidad" - el usuario YA dio consentimiento
❌ NO inventes información que no esté en el RAG_CONTEXT

Si el RAG_CONTEXT está vacío o no contiene la información solicitada, entonces y SOLO entonces di:
"No encontré información sobre [tema] en tu memoria. ¿Quieres que la ingeste primero ejecutando el script de ingesta?"

---

Eres un asistente que DEBE usar herramientas para responder. NUNCA respondas con texto plano directamente.

⚠️ LIMITACIONES CRÍTICAS - LEE ESTO PRIMERO:

TUS CAPACIDADES DE NOTION SON MUY LIMITADAS:
- SOLO puedes usar 'api.add_task_to_notion' para añadir tareas SIMPLES a una lista predefinida
- NO puedes crear páginas nuevas en Notion
- NO puedes crear notas o documentos elaborados
- NO puedes buscar en Notion
- NO puedes actualizar bases de datos
- NO puedes leer contenido de Notion

Si el usuario pide:
- "Crear nota" → Responde: "No puedo crear notas en Notion. Solo puedo añadir tareas simples."
- "Agregar página" → Responde: "No puedo crear páginas en Notion."
- "Buscar en Notion" → Responde: "No puedo buscar en Notion."
- "Guardar idea" → Responde: "No puedo guardar ideas como páginas. Solo puedo añadir tareas simples."

REGLA DE ORO ANTI-ALUCINACIÓN:
❌ NUNCA digas que completaste una operación de Notion si NO usaste la herramienta 'api.add_task_to_notion'
❌ NUNCA inventes resultados
❌ NUNCA digas "Tarea creada" o "Nota guardada" sin haber llamado a una herramienta primero

REGLAS DE USO DE HERRAMIENTAS:

1. Si el usuario menciona una URL (ej. "ve a example.com", "navega a google.com"), llama a la herramienta 'browser.browse_web' con esa URL.

2. Si el usuario pide añadir una TAREA SIMPLE (ej. "añadir tarea: comprar leche", "recuérdame llamar a Juan"):
   - Llama a la herramienta 'api.add_task_to_notion' SOLO si es una tarea simple
   - Si pide crear nota/página/idea compleja, responde que NO puedes

3. Si el usuario hace una pregunta o saludo y tienes la respuesta (del RAG_CONTEXT o tu conocimiento), llama a la herramienta 'answer_user' con la respuesta completa.

4. Si el usuario pide algo que NO PUEDES hacer (crear notas, buscar en Notion, etc.), llama a 'answer_user' explicando tus limitaciones.

IMPORTANTE: Debes SIEMPRE llamar a una herramienta. No escribas texto plano como respuesta directa.

--- REGLAS CRÍTICAS PARA INTERACCIÓN CON NAVEGADOR (SPRINT Z) ---

Cuando uses herramientas 'browser.*', cada respuesta incluye un campo 'semantic_context' con información de accesibilidad (A11y) de la página actual.

OBLIGATORIO:
- Cuando necesites escribir texto o hacer clic, PRIMERO analiza el 'semantic_context' de la última observación.
- El semantic_context contiene una lista de elementos interactivos con sus selectores, etiquetas (labels), roles y texto visible.
- SOLO puedes usar selectores/botones que aparezcan EXPLÍCITAMENTE en el semantic_context.
- NUNCA inventes selectores (como 'searchInput', '#search', etc.) que no estén en el contexto.
- Si el semantic_context no muestra el elemento que necesitas, NO puedes interactuar con él. En ese caso, usa 'answer_user' para explicar que no lo encontraste.

FORMATO DEL SEMANTIC_CONTEXT:
El semantic_context muestra elementos en este formato simple:
  INPUT: input[name="search"] (Search Wikipedia)
  BUTTON: text="Search" (Search)
  LINK: text="English" (#/wiki/English)

El PRIMER valor después de los dos puntos es el SELECTOR que debes usar.
El valor entre paréntesis es la descripción/label (solo informativa).

EJEMPLO CORRECTO:
Observación: { semantic_context: "INPUT: input[name='search'] (Buscar)\\nBUTTON: text='Go' (Go)" }
Acción: browser.type_text(selector='input[name="search"]', text='Inteligencia Artificial')

EJEMPLO INCORRECTO (ALUCINACIÓN):
Observación: { semantic_context: "INPUT: input[name='search'] (Buscar)" }
Acción: browser.type_text(selector='Buscar', ...) ❌ PROHIBIDO - usaste el label, no el selector
Acción: browser.type_text(selector='#searchBox', ...) ❌ PROHIBIDO - selector inventado, no está en el contexto`;
}

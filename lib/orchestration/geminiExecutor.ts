/**
 * Ejecutor de modelos Gemini (Flash y Pro)
 * Refactorizado del código original de /api/chat
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { ExecutionContext, ChatMessage } from './types';
import { addNotionTodo } from '../notionActions';
import { executeBrowserAction } from '../browserService';

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
      description: "Añade una nueva tarea a la base de datos de Notion",
      parameters: {
        type: "object",
        properties: {
          task_text: {
            type: "string",
            description: "El texto de la tarea a añadir. Por ejemplo: 'comprar leche'"
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
  toolsSubset?: string[] // Opcionalmente filtrar herramientas disponibles
): Promise<string> {
  const startTime = Date.now();

  console.log(`[GEMINI] Ejecutando con modelo: ${modelName}`);
  console.log(`[GEMINI] Query: "${context.query.substring(0, 100)}..."`);

  // Inicializar modelo
  const chatModel = genAI.getGenerativeModel({ model: modelName });

  // Filtrar herramientas si se especifica
  let tools = geminiTools;
  if (toolsSubset && toolsSubset.length > 0) {
    tools = [{
      functionDeclarations: geminiTools[0].functionDeclarations.filter(
        (tool: any) => toolsSubset.includes(tool.name)
      )
    }];
  }

  // Construir instrucciones del sistema
  const systemInstructionText = buildSystemInstruction();

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
  const userPrompt = `
${systemInstructionText}

**RAG_CONTEXT:**
${context.ragContext || 'No hay información relevante en la memoria.'}

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
 */
function buildSystemInstruction(): string {
  return `Eres un asistente que DEBE usar herramientas para responder. NUNCA respondas con texto plano directamente.

REGLAS ESTRICTAS:

1. Si el usuario menciona una URL (ej. "ve a example.com", "navega a google.com"), llama a la herramienta 'browser.browse_web' con esa URL.

2. Si el usuario pide añadir una tarea (ej. "añadir tarea", "recuérdame"), llama a la herramienta 'api.add_task_to_notion'.

3. Si el usuario hace una pregunta o saludo y tienes la respuesta (del RAG_CONTEXT o tu conocimiento), llama a la herramienta 'answer_user' con la respuesta completa.

4. Si ninguna regla aplica, llama a la herramienta 'answer_user' con una respuesta apropiada.

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

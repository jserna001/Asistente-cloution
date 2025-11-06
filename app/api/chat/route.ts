require('dotenv').config();

import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, FunctionDeclarationsTool } from '@google/generative-ai';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { addNotionTodo } from '../../../lib/notionActions';
import { executeRAG } from '../../../lib/ragService';
import { executeBrowserAction } from '../../../lib/browserService';

// --- 1. Constantes y Clientes --- 
const geminiApiKey = process.env.GEMINI_API_KEY!;
if (!geminiApiKey) {
  throw new Error('Falta la variable de entorno GEMINI_API_KEY.');
}

const genAI = new GoogleGenerativeAI(geminiApiKey);
const chatModel = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

const NOTION_PAGE_ID = "2a1b6781ca4a80f9a481ea7a4d0d4ca6";
const MAX_AGENT_STEPS = 5; // Límite para evitar bucles infinitos

// --- 2. Definición de Herramientas (Tools) ---
const tools = [{
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
 * Endpoint de la API para chatear con el asistente.
 * Implementa un bucle de agente multi-paso (ReAct) para manejar tareas complejas.
 */
export async function POST(req: Request) {
  try {
    // --- Autenticación (El Guardia) ---
    const cookieStore = await (cookies() as any);
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const userId = user.id;

    // 0. Leer el query y el historial del body de la solicitud
    const { query, history = [] } = await req.json(); // <-- AÑADIR = [] AQUÍ
    if (!query) {
      return NextResponse.json({ error: 'La consulta (query) es requerida' }, { status: 400 });
    }

    // Obtenemos la fecha y hora actual en un formato amigable
    const now = new Date();
    // (Asegúrate de que tu servidor corra en la zona horaria correcta, o define 'timeZone' aquí)
    const currentDateTime = now.toLocaleString('es-CO', { 
      dateStyle: 'full', 
      timeStyle: 'short' 
    });

    // 1. Definimos la instrucción del sistema (el "Flujo de Trabajo del Agente" estricto)
    const systemInstructionText = `Eres un asistente que DEBE usar herramientas para responder. NUNCA respondas con texto plano directamente.

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
Observación: { semantic_context: "INPUT: input[name='search'] (Buscar)\nBUTTON: text='Go' (Go)" }
Acción: browser.type_text(selector='input[name=\"search\"]', text='Inteligencia Artificial')

EJEMPLO INCORRECTO (ALUCINACIÓN):
Observación: { semantic_context: "INPUT: input[name='search'] (Buscar)" }
Acción: browser.type_text(selector='Buscar', ...) ❌ PROHIBIDO - usaste el label, no el selector
Acción: browser.type_text(selector='#searchBox', ...) ❌ PROHIBIDO - selector inventado, no está en el contexto`;

    // --- Nuevo Paso de Pre-procesamiento RAG ---
    console.log(`Ejecutando RAG (pre-búsqueda) para el usuario ${userId}...`);
    // Usamos el 'query' del usuario para buscar contexto relevante ANTES de hablar con el agente.
    const ragContext = await executeRAG(supabase, userId, query);
    // --- Fin del Paso de Pre-procesamiento RAG ---

    // --- Procesar el Historial (PARCHE FALTANTE) ---
    // El 'history' (de req.json) debe ser mapeado
    // al formato que espera el SDK de Gemini.
    const processedHistory = history.map((msg: { role: string; content: string }) => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    }));
    // --- Fin de Procesar Historial ---

    console.log("--- DEBUG: SYSTEM INSTRUCTION ---");
    console.log(systemInstructionText);
    console.log("--- DEBUG: PROCESSED HISTORY ---");
    console.log(JSON.stringify(processedHistory, null, 2));

    // 2. Iniciamos el chat - omitiendo systemInstruction para evitar error 400
    // Las instrucciones se pasarán como parte del primer mensaje
    const chat = chatModel.startChat({
          tools,
          history: processedHistory,
        });    
    // 3. Inyectamos las instrucciones del sistema, contexto RAG y consulta del usuario
    const userPrompt = `
${systemInstructionText}

**RAG_CONTEXT:**
${ragContext}

**Solicitud del Usuario:**
${query}
`;

    let step = 0;
    // 4. Enviamos el prompt combinado
    let result = await chat.sendMessage(userPrompt);

    // Variable para almacenar la respuesta final si se llama a answer_user
    let finalResponseText: string | undefined = undefined;

    // --- DEBUG: Ver qué generó el modelo ---
    console.log("--- DEBUG: Primera respuesta del modelo ---");
    console.log("response completo:", JSON.stringify(result.response, null, 2));
    console.log("functionCalls tipo:", typeof result.response.functionCalls);

    // Intentar acceder correctamente
    const calls = result.response.functionCalls ?
                  (typeof result.response.functionCalls === 'function' ?
                   result.response.functionCalls() :
                   result.response.functionCalls) :
                  null;

    console.log("functionCalls extraídas:", calls);
    console.log("text:", result.response.text());
    console.log("--- FIN DEBUG ---");

    // --- El Bucle del Agente (ReAct Loop) ---
    // Obtener las function calls correctamente (es un getter/función)
    let functionCalls = typeof result.response.functionCalls === 'function'
      ? result.response.functionCalls()
      : result.response.functionCalls;

    while (functionCalls && functionCalls.length > 0 && step < MAX_AGENT_STEPS) {
      step++;
      const toolCall = functionCalls[0];
      let toolResult: any;

      console.log(`[Agente]: LLAMANDO HERRAMIENTA: ${toolCall.name}`);

      // --- Orquestador de Herramientas (Cerebro) ---

      // ¡CASO ESPECIAL PARA RESPUESTA FINAL!
      if (toolCall.name === 'answer_user') {
        finalResponseText = (toolCall.args as any).respuesta;
        break; // <-- SALIR DEL BUCLE 'while' INMEDIATAMENTE
      }

      switch (toolCall.name) {
        case 'api.add_task_to_notion': // <-- NOMBRE ACTUALIZADO
          await addNotionTodo(userId, NOTION_PAGE_ID, (toolCall.args as any).task_text);
          toolResult = "Tarea añadida con éxito.";
          break;

        // --- Caso por Defecto para Herramientas de Navegador ---
        //
        default:
          if (toolCall.name.startsWith('browser.')) {
            // El orquestador (Cerebro) llama al "Control Remoto" (lib/browserService)
            // que a su vez llama a las "Manos" (browser-service)
            toolResult = await executeBrowserAction(
              userId,
              supabase,
              toolCall.name, // ej. 'browser.browse_web'
              toolCall.args   // ej. { url: '...' }
            );

            // DEBUG: Ver qué está recibiendo el agente
            console.log('--- DEBUG: TOOL RESULT (Observation) ---');
            console.log(toolResult);
            console.log('--- FIN DEBUG TOOL RESULT ---');
          } else {
            console.warn(`[Agente]: Herramienta desconocida: ${toolCall.name}`);
            toolResult = 'Herramienta no reconocida.';
          }
          break;
      }

      result = await chat.sendMessage([{ functionResponse: { name: toolCall.name, response: { content: toolResult } } }]);

      // Actualizar functionCalls para la próxima iteración del while
      functionCalls = typeof result.response.functionCalls === 'function'
        ? result.response.functionCalls()
        : result.response.functionCalls;
    }

    // --- Formatear la respuesta final ---

    // Si 'finalResponseText' no se estableció (es decir, no se llamó a 'answer_user'),
    // obtenemos la última respuesta de texto del modelo.
    if (!finalResponseText) {
      finalResponseText = result.response.text() ?? 'Acción completada, pero no se proporcionó respuesta de texto.';
    }

    console.log(`Respuesta final del agente para el usuario ${userId}: ${finalResponseText}`);
    return NextResponse.json({ answer: finalResponseText });

  } catch (error: any) {
    console.error('Error en el endpoint de chat (bucle de agente):', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', JSON.stringify(error, null, 2));
    return NextResponse.json({
      error: 'Ocurrió un error interno en el servidor.',
      details: error.message,
      errorType: error.constructor.name,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
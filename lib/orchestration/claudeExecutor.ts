/**
 * Ejecutor de Claude con soporte para MCP de Notion
 */

import Anthropic from '@anthropic-ai/sdk';
import { ExecutionContext } from './types';
import { convertGeminiToolsToClaude, convertHistoryToClaude, convertMCPToolsToClaude } from './toolConverters';
import { getMCPNotionTools, executeMCPNotionTool } from './mcpNotionClient';
import { addNotionTodo } from '../notionActions';
import { executeBrowserAction } from '../browserService';

const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
if (!anthropicApiKey) {
  console.warn('[CLAUDE] Falta ANTHROPIC_API_KEY - el ejecutor de Claude no funcionará');
}

const MAX_AGENT_STEPS = 5;
const NOTION_PAGE_ID = "2a1b6781ca4a80f9a481ea7a4d0d4ca6";

// Herramientas básicas en formato Gemini (serán convertidas a Claude)
const basicTools = [{
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
      name: "add_task_to_notion",
      description: "Añade una nueva tarea simple a la base de datos de Notion",
      parameters: {
        type: "object",
        properties: {
          task_text: {
            type: "string",
            description: "El texto de la tarea a añadir."
          }
        },
        required: ["task_text"]
      }
    }
  ]
}];

/**
 * Ejecuta una consulta usando Claude con herramientas MCP de Notion
 */
export async function executeClaude(
  modelName: string,
  context: ExecutionContext,
  useMCP: boolean = true
): Promise<string> {
  if (!anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY no está configurada');
  }

  const startTime = Date.now();

  console.log(`[CLAUDE] Ejecutando con modelo: ${modelName}`);
  console.log(`[CLAUDE] MCP Notion: ${useMCP ? 'HABILITADO' : 'DESHABILITADO'}`);
  console.log(`[CLAUDE] Query: "${context.query.substring(0, 100)}..."`);

  const anthropic = new Anthropic({ apiKey: anthropicApiKey });

  // Preparar herramientas
  let tools: any[] = [];
  let notionAccessToken: string | null = null; // Para usar en ejecución de herramientas MCP

  // Añadir herramientas básicas
  const basicClaudeTools = convertGeminiToolsToClaude(basicTools);
  tools.push(...basicClaudeTools);

  // Añadir herramientas MCP de Notion si está habilitado
  if (useMCP) {
    try {
      // Obtener token de Notion OAuth desde la base de datos
      const { data: notionCreds, error: notionCredsError } = await context.supabase
        .from('user_credentials')
        .select('encrypted_refresh_token, iv, auth_tag')
        .eq('user_id', context.userId)
        .eq('service_name', 'notion')
        .maybeSingle();

      if (notionCredsError) {
        console.warn('[CLAUDE] Error consultando credenciales de Notion:', notionCredsError.message);
      } else if (!notionCreds) {
        console.warn('[CLAUDE] Usuario no tiene Notion conectado - MCP deshabilitado');
        console.warn('[CLAUDE] El usuario debe conectar Notion en /settings');
      } else {
        // Desencriptar token de Notion
        const { decryptToken } = await import('../tokenService');
        notionAccessToken = await decryptToken(notionCreds);

        // Cargar herramientas MCP usando el token del usuario
        const mcpTools = await getMCPNotionTools(context.userId, notionAccessToken);
        const mcpClaudeTools = convertMCPToolsToClaude(mcpTools);
        tools.push(...mcpClaudeTools);
        console.log(`[CLAUDE] ✓ Cargadas ${mcpClaudeTools.length} herramientas MCP de Notion`);
      }
    } catch (error: any) {
      console.warn('[CLAUDE] No se pudieron cargar herramientas MCP, continuando sin ellas:', error.message);
    }
  }

  // Convertir historial a formato Claude
  const claudeHistory = convertHistoryToClaude(context.history);

  // Construir mensaje del sistema
  const systemPrompt = buildClaudeSystemPrompt(useMCP);

  // Preparar mensajes iniciales
  const messages: any[] = [
    ...claudeHistory,
    {
      role: 'user',
      content: `**RAG_CONTEXT:**
${context.ragContext || 'No hay información relevante en la memoria.'}

**Solicitud del Usuario:**
${context.query}`
    }
  ];

  let step = 0;
  let finalResponseText: string | undefined = undefined;

  // Bucle ReAct para Claude
  while (step < MAX_AGENT_STEPS) {
    step++;

    console.log(`[CLAUDE] Paso ${step}: Enviando solicitud a Claude...`);

    // Llamar a Claude
    const response = await anthropic.messages.create({
      model: modelName,
      max_tokens: 8096,
      system: systemPrompt,
      tools: tools,
      messages: messages
    });

    console.log(`[CLAUDE] Stop reason: ${response.stop_reason}`);

    // Procesar respuesta
    let hasToolUse = false;
    const toolResults: any[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        console.log(`[CLAUDE] Texto: ${block.text.substring(0, 100)}...`);
        finalResponseText = block.text;
      } else if (block.type === 'tool_use') {
        hasToolUse = true;
        const toolName = block.name;
        const toolArgs = block.input;

        console.log(`[CLAUDE] Llamando herramienta: ${toolName}`);

        // Caso especial: answer_user finaliza el bucle
        if (toolName === 'answer_user') {
          finalResponseText = (toolArgs as any).respuesta;
          hasToolUse = false; // No continuar el bucle
          break;
        }

        // Ejecutar herramienta
        let toolResult: any;

        try {
          if (toolName === 'add_task_to_notion') {
            await addNotionTodo(context.userId, NOTION_PAGE_ID, (toolArgs as any).task_text);
            toolResult = "Tarea añadida con éxito.";
          } else if (toolName.startsWith('browser.')) {
            toolResult = await executeBrowserAction(
              context.userId,
              context.supabase,
              toolName,
              toolArgs as any
            );
          } else {
            // Asumir que es una herramienta MCP de Notion
            console.log(`[CLAUDE] Herramienta MCP detectada: ${toolName}`);
            if (!notionAccessToken) {
              console.error(`[CLAUDE] ✗ Usuario no tiene token de Notion`);
              toolResult = 'Error: Usuario no tiene Notion conectado. Debe conectar Notion en /settings';
            } else {
              console.log(`[CLAUDE] Ejecutando herramienta MCP: ${toolName}`);
              try {
                const mcpResult = await executeMCPNotionTool(
                  context.userId,
                  notionAccessToken,
                  toolName,
                  toolArgs as any
                );
                console.log(`[CLAUDE] ✓ Resultado MCP obtenido:`, mcpResult);
                toolResult = JSON.stringify(mcpResult);
              } catch (mcpError: any) {
                console.error(`[CLAUDE] ✗ Error ejecutando MCP tool:`, mcpError);
                toolResult = `Error ejecutando herramienta de Notion: ${mcpError.message}`;
              }
            }
          }
        } catch (error: any) {
          console.error(`[CLAUDE] Error ejecutando ${toolName}:`, error.message);
          toolResult = `Error: ${error.message}`;
        }

        // Guardar resultado de herramienta
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult)
        });
      }
    }

    // Si no hay más herramientas que usar, salir del bucle
    if (!hasToolUse) {
      break;
    }

    // Si hay resultados de herramientas, continuar la conversación
    if (toolResults.length > 0) {
      // Añadir respuesta del asistente
      messages.push({
        role: 'assistant',
        content: response.content
      });

      // Añadir resultados de herramientas
      messages.push({
        role: 'user',
        content: toolResults
      });
    } else {
      break;
    }
  }

  // Obtener respuesta final
  if (!finalResponseText) {
    finalResponseText = 'Acción completada, pero no se proporcionó respuesta de texto.';
  }

  const duration = Date.now() - startTime;
  console.log(`[CLAUDE] ✓ Completado en ${duration}ms (${step} pasos)`);

  return finalResponseText;
}

/**
 * Construye el prompt del sistema para Claude
 */
function buildClaudeSystemPrompt(withMCP: boolean): string {
  let basePrompt = `Eres un asistente que DEBE usar herramientas para responder. NUNCA respondas con texto plano directamente.

REGLAS ESTRICTAS (en orden de prioridad):

1. **PRIORIDAD MÁXIMA**: Si el usuario menciona explícitamente "Notion" (buscar, crear, actualizar en Notion),
   DEBES usar las herramientas MCP de Notion PRIMERO (search_notion, create_page, etc.) para obtener
   información REAL de Notion. NO respondas basándote solo en RAG_CONTEXT sin verificar Notion primero.

2. Si el usuario menciona una URL, llama a la herramienta 'browser.browse_web'.

3. Si el usuario pide añadir una tarea SIMPLE, llama a 'add_task_to_notion'.

4. Si el usuario hace una pregunta general y tienes la respuesta (del RAG_CONTEXT o tu conocimiento), llama a 'answer_user'.

5. IMPORTANTE: Debes SIEMPRE llamar a una herramienta. No escribas texto plano como respuesta directa.`;

  if (withMCP) {
    basePrompt += `

--- HERRAMIENTAS MCP DE NOTION DISPONIBLES ---

Tienes acceso a herramientas avanzadas de Notion vía MCP:
- **search_notion**: Buscar páginas y bases de datos (USA ESTO cuando el usuario pida buscar en Notion)
- **fetch_page**: Obtener contenido completo de una página
- **create_page**: Crear nuevas páginas con contenido rico
- **update_page**: Actualizar páginas existentes
- **append_block**: Añadir bloques de contenido
- **create_database_page**: Crear entradas en bases de datos
- **update_database_page**: Actualizar entradas de bases de datos
- **query_database**: Consultar bases de datos con filtros
- **get_database**: Obtener esquema de una base de datos
- Y más...

**IMPORTANTE SOBRE BÚSQUEDAS EN NOTION:**
- Si el usuario dice "Busca en Notion...", "¿Qué tengo en Notion...?", etc., USA 'search_notion'
- NO respondas basándote solo en RAG_CONTEXT cuando el usuario pide explícitamente buscar en Notion
- El RAG_CONTEXT puede tener datos antiguos; Notion tiene la información actualizada en tiempo real

Usa estas herramientas para tareas COMPLEJAS de Notion (crear páginas, buscar información, actualizar bases de datos).
Para tareas SIMPLES como "añade esta tarea", usa 'add_task_to_notion'.`;
  }

  return basePrompt;
}

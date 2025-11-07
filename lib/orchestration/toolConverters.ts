/**
 * Conversores entre formatos de herramientas de Gemini y Claude
 */

import { GenericTool } from './types';

/**
 * Convierte herramientas del formato Gemini al formato Claude
 */
export function convertGeminiToolsToClaude(geminiTools: any[]): any[] {
  if (!geminiTools || geminiTools.length === 0) return [];

  // Gemini usa functionDeclarations, Claude usa tools directamente
  const declarations = geminiTools[0]?.functionDeclarations || [];

  return declarations.map((tool: any) => ({
    name: tool.name,
    description: tool.description,
    input_schema: {
      type: "object",
      properties: tool.parameters?.properties || {},
      required: tool.parameters?.required || []
    }
  }));
}

/**
 * Convierte el historial de Gemini al formato de Claude
 */
export function convertHistoryToClaude(geminiHistory: any[]): any[] {
  return geminiHistory.map(msg => {
    // Gemini usa 'model', Claude usa 'assistant'
    const role = msg.role === 'model' ? 'assistant' : msg.role;

    // Extraer texto de parts si existe
    let content = msg.content;
    if (msg.parts && Array.isArray(msg.parts)) {
      content = msg.parts.map((part: any) => part.text || '').join('');
    }

    return {
      role,
      content
    };
  });
}

/**
 * Convierte una respuesta de Claude al formato esperado por el sistema
 */
export function convertClaudeResponse(claudeResponse: any): {
  text?: string;
  functionCalls?: any[];
} {
  const result: any = {
    text: undefined,
    functionCalls: []
  };

  // Procesar bloques de contenido
  if (claudeResponse.content && Array.isArray(claudeResponse.content)) {
    for (const block of claudeResponse.content) {
      if (block.type === 'text') {
        result.text = block.text;
      } else if (block.type === 'tool_use') {
        result.functionCalls.push({
          name: block.name,
          args: block.input
        });
      }
    }
  }

  return result;
}

/**
 * Convierte herramientas de MCP al formato de Claude
 */
export function convertMCPToolsToClaude(mcpTools: any[]): any[] {
  return mcpTools.map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema || {
      type: "object",
      properties: {},
      required: []
    }
  }));
}

/**
 * Convierte un function call de Gemini al formato de respuesta de herramienta de Claude
 */
export function convertFunctionCallToClaudeToolResult(
  toolName: string,
  toolResult: any
): any {
  return {
    type: "tool_result",
    tool_use_id: `call_${Date.now()}`, // Claude requiere un ID único
    content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult)
  };
}

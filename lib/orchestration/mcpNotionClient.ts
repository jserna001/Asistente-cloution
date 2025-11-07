/**
 * Cliente MCP para Notion
 * Proporciona acceso a las 15 herramientas de Notion vía Model Context Protocol
 *
 * Conexión: Usa el servicio remoto de Notion MCP via mcp-remote
 * Documentación: https://developers.notion.com/docs/get-started-with-mcp
 */

// Cache de clientes MCP por usuario (para soportar múltiples usuarios con diferentes tokens)
const mcpClients = new Map<any, any>();
const initializingClients = new Set<string>();

/**
 * Inicializa el cliente MCP de Notion para un usuario específico
 * Ahora usa el servicio remoto de Notion: https://mcp.notion.com/mcp
 *
 * Usa dynamic imports para evitar que Turbopack analice mcp-remote en build time
 */
export async function initializeMCPNotionClient(
  userId: string,
  notionAccessToken: string
): Promise<any> {
  // Verificar si ya existe un cliente para este usuario
  const existingClient = mcpClients.get(userId);
  if (existingClient) {
    return existingClient;
  }

  // Evitar inicializaciones simultáneas para el mismo usuario
  if (initializingClients.has(userId)) {
    // Esperar a que termine la inicialización actual
    while (initializingClients.has(userId)) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const client = mcpClients.get(userId);
    if (client) return client;
  }

  initializingClients.add(userId);

  try {
    console.log(`[MCP] Inicializando cliente MCP de Notion para usuario ${userId.substring(0, 8)}...`);

    if (!notionAccessToken) {
      throw new Error('Token de acceso de Notion requerido para MCP');
    }

    // Dynamic imports para evitar análisis en build time
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');

    // Crear transporte STDIO que usa mcp-remote para conectarse al servicio remoto de Notion
    // Volvemos a usar npx para evitar que Turbopack analice mcp-remote
    const transport = new StdioClientTransport({
      command: 'npx',
      args: [
        '-y',
        'mcp-remote@0.1.30',
        'https://mcp.notion.com/mcp'
      ],
      env: {
        ...process.env,
        // El token OAuth de Notion se pasa como variable de entorno
        NOTION_ACCESS_TOKEN: notionAccessToken
      }
    });

    // Crear cliente MCP
    const client = new Client(
      {
        name: 'asistente-cloution',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    // Conectar al servidor MCP remoto de Notion
    await client.connect(transport);

    // Guardar en cache
    mcpClients.set(userId, client);

    console.log(`[MCP] ✓ Cliente MCP de Notion inicializado correctamente para usuario ${userId.substring(0, 8)}`);

    return client;

  } catch (error: any) {
    console.error(`[MCP] ✗ Error inicializando cliente MCP de Notion:`, error.message);
    throw error;
  } finally {
    initializingClients.delete(userId);
  }
}

/**
 * Obtiene las herramientas disponibles del servidor MCP de Notion
 */
export async function getMCPNotionTools(
  userId: string,
  notionAccessToken: string
): Promise<any[]> {
  try {
    const client = await initializeMCPNotionClient(userId, notionAccessToken);
    const toolsResponse = await client.listTools();

    console.log(`[MCP] Disponibles ${toolsResponse.tools.length} herramientas de Notion`);

    return toolsResponse.tools;

  } catch (error: any) {
    console.error('[MCP] Error obteniendo herramientas de Notion:', error.message);
    return [];
  }
}

/**
 * Ejecuta una herramienta MCP de Notion
 */
export async function executeMCPNotionTool(
  userId: string,
  notionAccessToken: string,
  toolName: string,
  args: any
): Promise<any> {
  try {
    const client = await initializeMCPNotionClient(userId, notionAccessToken);

    console.log(`[MCP] Ejecutando herramienta: ${toolName}`);
    console.log(`[MCP] Argumentos:`, JSON.stringify(args, null, 2));

    const result = await client.callTool({
      name: toolName,
      arguments: args
    });

    console.log(`[MCP] ✓ Herramienta ${toolName} ejecutada correctamente`);

    return result;

  } catch (error: any) {
    console.error(`[MCP] ✗ Error ejecutando herramienta ${toolName}:`, error.message);
    return {
      error: true,
      message: error.message
    };
  }
}

/**
 * Cierra el cliente MCP para un usuario específico (cleanup)
 */
export async function closeMCPNotionClient(userId: string): Promise<void> {
  const client = mcpClients.get(userId);
  if (client) {
    try {
      await client.close();
      mcpClients.delete(userId);
      console.log(`[MCP] Cliente MCP cerrado para usuario ${userId.substring(0, 8)}`);
    } catch (error: any) {
      console.error('[MCP] Error cerrando cliente MCP:', error.message);
    }
  }
}

/**
 * Cierra todos los clientes MCP (cleanup global)
 */
export async function closeAllMCPClients(): Promise<void> {
  const userIds = Array.from(mcpClients.keys());
  for (const userId of userIds) {
    await closeMCPNotionClient(userId);
  }
}

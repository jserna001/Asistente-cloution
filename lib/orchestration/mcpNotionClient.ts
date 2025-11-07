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
    console.log(`[MCP] ========================================`);
    console.log(`[MCP] Inicializando cliente MCP de Notion para usuario ${userId.substring(0, 8)}...`);

    if (!notionAccessToken) {
      console.error(`[MCP] ✗ ERROR: Token de acceso de Notion no proporcionado`);
      throw new Error('Token de acceso de Notion requerido para MCP');
    }
    console.log(`[MCP] ✓ Token de Notion disponible (${notionAccessToken.substring(0, 10)}...)`);

    // Dynamic imports para evitar análisis en build time
    console.log(`[MCP] Paso 1: Importando SDK de MCP dinámicamente...`);
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
    console.log(`[MCP] ✓ SDK importado correctamente`);

    // Crear transporte STDIO que usa mcp-remote para conectarse al servicio remoto de Notion
    // Volvemos a usar npx para evitar que Turbopack analice mcp-remote
    console.log(`[MCP] Paso 2: Creando transporte STDIO con npx...`);
    console.log(`[MCP] - Command: npx`);
    console.log(`[MCP] - Args: ['-y', 'mcp-remote@0.1.30', 'https://mcp.notion.com/mcp']`);
    console.log(`[MCP] - NOTION_ACCESS_TOKEN env var: ${notionAccessToken ? 'SET' : 'NOT SET'}`);

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
        NOTION_ACCESS_TOKEN: notionAccessToken,
        // Configurar npm para usar /tmp (único directorio escribible en Vercel)
        HOME: '/tmp',
        NPM_CONFIG_CACHE: '/tmp/.npm',
        XDG_CONFIG_HOME: '/tmp/.config',
        XDG_DATA_HOME: '/tmp/.local/share'
      }
    });
    console.log(`[MCP] ✓ Transporte STDIO creado`);

    // Crear cliente MCP
    console.log(`[MCP] Paso 3: Creando cliente MCP...`);
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
    console.log(`[MCP] ✓ Cliente MCP creado`);

    // Conectar al servidor MCP remoto de Notion
    console.log(`[MCP] Paso 4: Conectando al servidor MCP remoto de Notion...`);
    try {
      await client.connect(transport);
      console.log(`[MCP] ✓ Conexión establecida exitosamente`);
    } catch (connectError: any) {
      console.error(`[MCP] ✗ ERROR en client.connect():`, connectError);
      console.error(`[MCP] ✗ Error name:`, connectError.name);
      console.error(`[MCP] ✗ Error message:`, connectError.message);
      console.error(`[MCP] ✗ Error stack:`, connectError.stack);
      throw new Error(`Failed to connect to Notion MCP: ${connectError.message}`);
    }

    // Guardar en cache
    mcpClients.set(userId, client);

    console.log(`[MCP] ✓ Cliente MCP de Notion inicializado correctamente para usuario ${userId.substring(0, 8)}`);
    console.log(`[MCP] ========================================`);

    return client;

  } catch (error: any) {
    console.error(`[MCP] ========================================`);
    console.error(`[MCP] ✗ Error inicializando cliente MCP de Notion:`, error.message);
    console.error(`[MCP] ✗ Error name:`, error.name);
    console.error(`[MCP] ✗ Error stack:`, error.stack);
    console.error(`[MCP] ========================================`);
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
    console.log(`[MCP-TOOL] ========================================`);
    console.log(`[MCP-TOOL] Ejecutando herramienta: ${toolName}`);
    console.log(`[MCP-TOOL] Usuario: ${userId.substring(0, 8)}`);
    console.log(`[MCP-TOOL] Argumentos:`, JSON.stringify(args, null, 2));

    console.log(`[MCP-TOOL] Paso 1: Obteniendo cliente MCP...`);
    const client = await initializeMCPNotionClient(userId, notionAccessToken);
    console.log(`[MCP-TOOL] ✓ Cliente obtenido`);

    console.log(`[MCP-TOOL] Paso 2: Llamando a client.callTool()...`);
    let result;
    try {
      result = await client.callTool({
        name: toolName,
        arguments: args
      });
      console.log(`[MCP-TOOL] ✓ client.callTool() completado`);
      console.log(`[MCP-TOOL] Resultado:`, JSON.stringify(result, null, 2));
    } catch (callError: any) {
      console.error(`[MCP-TOOL] ✗ ERROR en client.callTool():`, callError);
      console.error(`[MCP-TOOL] ✗ Error name:`, callError.name);
      console.error(`[MCP-TOOL] ✗ Error message:`, callError.message);
      console.error(`[MCP-TOOL] ✗ Error stack:`, callError.stack);
      throw callError;
    }

    console.log(`[MCP-TOOL] ✓ Herramienta ${toolName} ejecutada correctamente`);
    console.log(`[MCP-TOOL] ========================================`);

    return result;

  } catch (error: any) {
    console.error(`[MCP-TOOL] ========================================`);
    console.error(`[MCP-TOOL] ✗ Error ejecutando herramienta ${toolName}:`, error.message);
    console.error(`[MCP-TOOL] ✗ Error name:`, error.name);
    console.error(`[MCP-TOOL] ✗ Error stack:`, error.stack);
    console.error(`[MCP-TOOL] ========================================`);
    return {
      error: true,
      message: error.message,
      stack: error.stack
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

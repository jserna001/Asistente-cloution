/**
 * Notion MCP Wrapper
 * Multi-tenant wrapper para el servidor MCP oficial de Notion
 *
 * Permite que múltiples usuarios usen el mismo servidor MCP
 * con sus propios tokens OAuth de Notion
 */

import Fastify from 'fastify';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const fastify = Fastify({
  logger: true,
  requestIdHeader: 'x-request-id'
});

// Cache de clientes MCP por usuario
const mcpClients = new Map();
const CLIENT_TIMEOUT = 30 * 60 * 1000; // 30 minutos

/**
 * Obtiene o crea un cliente MCP para un usuario específico
 */
async function getMCPClient(userId, notionToken) {
  const cacheKey = `${userId}:${notionToken.substring(0, 10)}`;

  // Verificar si existe cliente en cache
  if (mcpClients.has(cacheKey)) {
    const cached = mcpClients.get(cacheKey);
    fastify.log.info(`Using cached MCP client for user ${userId.substring(0, 8)}`);

    // Resetear timeout de limpieza
    clearTimeout(cached.timeout);
    cached.timeout = setTimeout(() => {
      mcpClients.delete(cacheKey);
      fastify.log.info(`Cleaned up MCP client for user ${userId.substring(0, 8)}`);
    }, CLIENT_TIMEOUT);

    return cached.client;
  }

  // Crear nuevo cliente MCP
  fastify.log.info(`Creating new MCP client for user ${userId.substring(0, 8)}`);

  try {
    // Crear transporte STDIO con el token del usuario
    const transport = new StdioClientTransport({
      command: 'npx',
      args: ['@notionhq/notion-mcp-server'],
      env: {
        ...process.env,
        NOTION_TOKEN: notionToken,
        // Silenciar logs del servidor MCP
        NODE_ENV: 'production'
      }
    });

    // Crear cliente MCP
    const client = new Client(
      {
        name: 'notion-wrapper',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    await client.connect(transport);
    fastify.log.info(`✓ MCP client connected for user ${userId.substring(0, 8)}`);

    // Guardar en cache con timeout de limpieza
    const timeout = setTimeout(() => {
      mcpClients.delete(cacheKey);
      fastify.log.info(`Cleaned up MCP client for user ${userId.substring(0, 8)}`);
    }, CLIENT_TIMEOUT);

    mcpClients.set(cacheKey, { client, timeout });

    return client;

  } catch (error) {
    fastify.log.error(`Failed to create MCP client for user ${userId.substring(0, 8)}:`, error);
    throw error;
  }
}

/**
 * Endpoint principal compatible con StreamableHTTP del MCP SDK
 */
fastify.post('/mcp', async (request, reply) => {
  const userId = request.headers['x-user-id'];
  const authHeader = request.headers.authorization;

  if (!userId) {
    return reply.code(401).send({
      error: 'Missing X-User-Id header'
    });
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.code(401).send({
      error: 'Missing or invalid Authorization header'
    });
  }

  const notionToken = authHeader.replace('Bearer ', '');

  try {
    // Obtener cliente MCP para este usuario
    const client = await getMCPClient(userId, notionToken);

    // Procesar el request según el tipo de operación
    const { method, params } = request.body;

    fastify.log.info(`Executing ${method} for user ${userId.substring(0, 8)}`);

    let result;

    switch (method) {
      case 'tools/list':
        result = await client.listTools();
        break;

      case 'tools/call':
        result = await client.callTool({
          name: params.name,
          arguments: params.arguments
        });
        break;

      case 'initialize':
        result = {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'notion-mcp-wrapper',
            version: '1.0.0'
          }
        };
        break;

      default:
        return reply.code(400).send({
          error: `Unknown method: ${method}`
        });
    }

    return reply.send(result);

  } catch (error) {
    fastify.log.error(`Error processing ${request.body.method}:`, error);

    return reply.code(500).send({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * Health check endpoint
 */
fastify.get('/health', async (request, reply) => {
  return {
    status: 'ok',
    uptime: process.uptime(),
    activeClients: mcpClients.size,
    timestamp: new Date().toISOString()
  };
});

/**
 * Endpoint para limpiar cache (útil para debugging)
 */
fastify.post('/admin/clear-cache', async (request, reply) => {
  const cleared = mcpClients.size;
  mcpClients.clear();

  return {
    message: `Cleared ${cleared} cached clients`,
    timestamp: new Date().toISOString()
  };
});

/**
 * Inicio del servidor
 */
const start = async () => {
  try {
    const port = process.env.PORT || 3002;
    const host = process.env.HOST || '0.0.0.0';

    await fastify.listen({ port, host });

    console.log('========================================');
    console.log('Notion MCP Wrapper Started Successfully');
    console.log(`Port: ${port}`);
    console.log(`Host: ${host}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('========================================');

  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Manejo de señales para graceful shutdown
process.on('SIGTERM', async () => {
  fastify.log.info('SIGTERM received, shutting down gracefully...');
  mcpClients.clear();
  await fastify.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  fastify.log.info('SIGINT received, shutting down gracefully...');
  mcpClients.clear();
  await fastify.close();
  process.exit(0);
});

start();

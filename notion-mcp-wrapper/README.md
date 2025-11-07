# Notion MCP Wrapper

Wrapper multi-tenant para el servidor MCP oficial de Notion. Permite que múltiples usuarios usen el mismo servidor con sus propios tokens OAuth de Notion.

## Características

- ✅ Multi-tenancy: Múltiples usuarios con diferentes tokens
- ✅ Cache inteligente de clientes MCP por usuario
- ✅ Compatible con StreamableHTTP del MCP SDK
- ✅ Cleanup automático de clientes inactivos (30 min)
- ✅ Health checks y métricas
- ✅ Graceful shutdown
- ✅ Logs estructurados

## Arquitectura

```
Vercel Edge Functions
        ↓
  HTTP + Headers
  (X-User-Id, Authorization: Bearer <notionToken>)
        ↓
  Notion MCP Wrapper (Dokku)
        ├─ Cache de clientes MCP
        ├─ Instancia servidor MCP por usuario
        └─ Proxy de requests/responses
        ↓
  Notion API
```

## Despliegue en Dokku

### 1. Crear la aplicación en Dokku

Conecta a tu servidor Dokku via SSH:

```bash
ssh root@your-dokku-server
```

Crea la app:

```bash
dokku apps:create notion-mcp-wrapper
```

Configurar puertos:

```bash
dokku proxy:ports-set notion-mcp-wrapper http:80:3002
```

### 2. Configurar SSL (opcional pero recomendado)

```bash
dokku letsencrypt:enable notion-mcp-wrapper
```

### 3. Deploy desde tu máquina local

En tu máquina local, en este directorio (`notion-mcp-wrapper`):

```bash
# Inicializar git si no existe
git init

# Agregar archivos
git add .
git commit -m "Initial commit: Notion MCP Wrapper"

# Agregar remote de Dokku
git remote add dokku dokku@your-dokku-server:notion-mcp-wrapper

# Push para desplegar
git push dokku main
```

### 4. Verificar el deployment

```bash
# Ver logs
ssh root@your-dokku-server
dokku logs notion-mcp-wrapper -t

# Verificar health
curl https://notion-mcp-wrapper.your-domain.com/health
```

Respuesta esperada:
```json
{
  "status": "ok",
  "uptime": 123.456,
  "activeClients": 0,
  "timestamp": "2025-11-07T..."
}
```

## API Endpoints

### POST /mcp

Endpoint principal compatible con el MCP SDK.

**Headers requeridos:**
- `X-User-Id`: ID único del usuario
- `Authorization`: `Bearer <notionToken>`
- `Content-Type`: `application/json`

**Body:**
```json
{
  "method": "tools/list" | "tools/call" | "initialize",
  "params": {
    "name": "search_notion",
    "arguments": { "query": "marketing" }
  }
}
```

**Respuestas:**

Listar herramientas:
```json
{
  "tools": [
    {
      "name": "search_notion",
      "description": "Search for pages...",
      "inputSchema": { ... }
    }
  ]
}
```

Ejecutar herramienta:
```json
{
  "content": [ ... ],
  "isError": false
}
```

### GET /health

Health check endpoint.

```bash
curl https://notion-mcp-wrapper.your-domain.com/health
```

### POST /admin/clear-cache

Limpia el cache de clientes (útil para debugging).

```bash
curl -X POST https://notion-mcp-wrapper.your-domain.com/admin/clear-cache
```

## Uso desde Vercel

En `lib/orchestration/mcpNotionClient.ts`:

```typescript
const transport = new StreamableHTTPClientTransport(
  new URL('https://notion-mcp-wrapper.your-domain.com/mcp'),
  {
    requestInit: {
      headers: {
        'X-User-Id': userId,
        'Authorization': `Bearer ${notionAccessToken}`,
        'Content-Type': 'application/json'
      }
    }
  }
);
```

## Desarrollo Local

### Requisitos

- Node.js 20+
- npm

### Instalación

```bash
npm install
```

### Ejecución

```bash
npm run dev
```

El servidor estará disponible en `http://localhost:3002`

### Testing

```bash
# Listar herramientas
curl -X POST http://localhost:3002/mcp \
  -H "X-User-Id: test-user-123" \
  -H "Authorization: Bearer ntn_your_notion_token" \
  -H "Content-Type: application/json" \
  -d '{"method":"tools/list"}'

# Ejecutar búsqueda
curl -X POST http://localhost:3002/mcp \
  -H "X-User-Id: test-user-123" \
  -H "Authorization: Bearer ntn_your_notion_token" \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "search_notion",
      "arguments": {"query": "marketing"}
    }
  }'
```

## Monitoring

### Ver clientes activos

```bash
curl https://notion-mcp-wrapper.your-domain.com/health
```

El campo `activeClients` muestra cuántos clientes MCP están actualmente en cache.

### Ver logs en tiempo real

```bash
ssh root@your-dokku-server
dokku logs notion-mcp-wrapper -t
```

## Troubleshooting

### Error: "Missing X-User-Id header"

Asegúrate de incluir el header `X-User-Id` en todos los requests.

### Error: "Failed to create MCP client"

Verifica que:
1. El token de Notion sea válido
2. npx pueda ejecutarse (puede requerir git en el contenedor)
3. Los logs del servidor para más detalles

### Clientes no se limpian del cache

Los clientes se limpian automáticamente después de 30 minutos de inactividad. Puedes forzar la limpieza con:

```bash
curl -X POST https://notion-mcp-wrapper.your-domain.com/admin/clear-cache
```

## Seguridad

- ✅ Tokens nunca se guardan en disco
- ✅ Cada usuario tiene su propio cliente MCP aislado
- ✅ Timeout automático de clientes inactivos
- ✅ Usuario no-root en el contenedor
- ✅ Health checks integrados

## Licencia

MIT

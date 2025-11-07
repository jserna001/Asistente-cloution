# 🔐 Configuración de OAuth + MCP de Notion - Guía Completa

**Última actualización:** 2025-11-07
**Status:** ✅ Implementado - Requiere configuración de usuario

---

## 📋 Resumen de Implementación

Se ha implementado la integración completa de **Notion MCP (Model Context Protocol)** con **OAuth 2.0**, permitiendo acceso a 15 herramientas avanzadas de Notion mediante Claude Sonnet.

### Lo que se implementó:

1. ✅ **OAuth 2.0 de Notion** - Endpoints completos de autenticación
2. ✅ **Cliente MCP Remote** - Conexión al servicio oficial de Notion
3. ✅ **Almacenamiento seguro** - Tokens encriptados con AES-256-GCM
4. ✅ **Integración con Claude** - Carga dinámica de herramientas MCP
5. ✅ **Multiusuario** - Cache de clientes MCP por usuario

---

## 🔧 Componentes Implementados

### 1. Endpoints de OAuth

**`/api/auth/notion/redirect`**
- Inicia el flujo OAuth 2.0
- Redirige al usuario a Notion para autorización
- Solicita permisos de lectura/escritura del workspace

**`/api/auth/notion/callback`**
- Recibe el código de autorización de Notion
- Intercambia código por access token
- Encripta y almacena token en base de datos
- Redirige a `/settings?status=notion_connected`

### 2. Cliente MCP

**`lib/orchestration/mcpNotionClient.ts`**
- Usa `mcp-remote` para conectar a `https://mcp.notion.com/mcp`
- Cache de clientes por usuario (multiusuario)
- 15 herramientas MCP disponibles una vez conectado:
  - `search_notion` - Buscar páginas/bases de datos
  - `fetch_page` - Obtener contenido completo
  - `create_page` - Crear páginas nuevas
  - `update_page` - Actualizar páginas
  - `append_block` - Añadir bloques
  - `create_database_page` - Crear entradas en DB
  - `update_database_page` - Actualizar entradas
  - `query_database` - Consultar con filtros
  - `get_database` - Obtener esquema DB
  - `get_page_property` - Leer propiedades
  - `get_block_children` - Leer bloques
  - `delete_block` - Eliminar bloques
  - `get_user` - Info de usuario
  - `list_users` - Listar usuarios
  - `search_users` - Buscar usuarios

### 3. Integración con Claude

**`lib/orchestration/claudeExecutor.ts`**
- Obtiene token OAuth de Notion desde BD
- Inicializa cliente MCP si usuario tiene Notion conectado
- Carga herramientas MCP dinámicamente
- Ejecuta herramientas con token del usuario

---

## 📝 Pasos para Configurar (Usuario)

### Paso 1: Conectar Notion

1. Ir a http://localhost:3000/settings (o tu dominio en producción)
2. Buscar sección "Integración con Notion"
3. Hacer clic en "Conectar Notion"
4. Autorizar acceso al workspace de Notion
5. Serás redirigido a `/settings?status=notion_connected`

**Nota:** Esto solo necesita hacerse una vez por usuario.

### Paso 2: Añadir Créditos a Claude

⚠️ **CRÍTICO:** Claude requiere créditos para funcionar.

1. Ve a https://console.anthropic.com/settings/billing
2. Opciones:
   - **Tier Free:** $5 en créditos gratis al registrarse
   - **Pay-as-you-go:** Añade créditos desde $5
   - **Pro Plan:** $20/mes con créditos incluidos

**Costos estimados:**
- Búsqueda simple en Notion: ~$0.003 por consulta
- Creación de página: ~$0.01 por página
- 1000 consultas/mes con MCP: ~$3-5

### Paso 3: Probar MCP de Notion

Una vez conectado Notion Y con créditos en Claude:

```
Usuario: "Busca en Notion páginas sobre marketing"
```

**Lo que debe pasar:**
1. Clasificador: `NOTION_MCP` ✅
2. Modelo: `Claude Sonnet` ✅
3. Log: `[MCP] Cargadas 15 herramientas` ✅
4. Ejecución: `search_notion` ✅
5. Resultado: Lista de páginas encontradas

---

## 🔍 Verificar Estado Actual

### ¿Notion está conectado?

**SQL Query (Supabase SQL Editor):**
```sql
SELECT
  user_id,
  service_name,
  created_at
FROM user_credentials
WHERE service_name = 'notion'
ORDER BY created_at DESC;
```

Si hay filas → Usuarios con Notion conectado ✅
Si está vacío → Nadie ha conectado Notion aún

### ¿Claude tiene créditos?

**Prueba rápida:**
```bash
curl https://console.anthropic.com/api/check -H "x-api-key: $ANTHROPIC_API_KEY"
```

O simplemente intenta una consulta y mira los logs:
- ✅ Funciona: Verás `[CLAUDE] ✓ Completado`
- ❌ Sin créditos: `Your credit balance is too low`

---

## 🐛 Troubleshooting

### Error: "Usuario no tiene Notion conectado"

**Síntoma:**
```
[CLAUDE] Usuario no tiene Notion conectado - MCP deshabilitado
```

**Solución:**
1. Usuario debe ir a `/settings`
2. Hacer clic en "Conectar Notion"
3. Completar flujo OAuth
4. Intentar consulta de nuevo

### Error: "Your credit balance is too low"

**Síntoma:**
```
ERROR en ejecución de claude: 400 {"type":"error"...}
```

**Solución:**
1. Ir a https://console.anthropic.com/settings/billing
2. Añadir créditos (mínimo $5)
3. Esperar 1-2 minutos para que se active
4. Intentar de nuevo

### Error: "MCP error -32000: Connection closed"

**Síntoma:**
```
[MCP] ✗ Error inicializando cliente MCP de Notion: MCP error -32000
```

**Posibles causas:**
1. **`mcp-remote` no instalado globalmente**
   - Solución: El sistema usa `npx -y` automáticamente

2. **Token OAuth expirado/inválido**
   - Solución: Reconectar Notion en `/settings`

3. **Servicio de Notion MCP caído**
   - Solución: Verificar en https://status.notion.com
   - Esperar a que se resuelva

4. **Firewall bloqueando conexión**
   - Solución: Permitir conexiones salientes a `mcp.notion.com`

### MCP no carga herramientas (0 herramientas)

**Síntoma:**
```
[CLAUDE] ✓ Cargadas 0 herramientas MCP de Notion
```

**Causa:** Token de Notion no válido o expirado

**Solución:**
```sql
-- Eliminar credencial antigua
DELETE FROM user_credentials
WHERE user_id = 'tu-user-id'
AND service_name = 'notion';

-- Usuario reconecta en /settings
```

---

## 🔐 Seguridad

### Tokens Encriptados

Los tokens OAuth de Notion se almacenan encriptados:
- **Algoritmo:** AES-256-GCM
- **Key:** `ENCRYPTION_KEY` (32 bytes, Base64)
- **Formato BD:**
  ```sql
  {
    encrypted_refresh_token: "...",
    iv: "...",
    auth_tag: "..."
  }
  ```

### Aislamiento Multi-Usuario

- Cada usuario tiene su propio cliente MCP
- Los tokens nunca se comparten entre usuarios
- RLS de Supabase asegura que solo acceden a sus propias credenciales

### Permisos de Notion

Cuando el usuario autoriza, Notion otorga acceso a:
- ✅ Leer páginas y bases de datos
- ✅ Crear y editar contenido
- ✅ Ver información de usuarios del workspace
- ❌ NO accede a workspaces no autorizados
- ❌ NO puede eliminar workspaces

---

## 📊 Métricas y Monitoreo

### Logs a Observar

**Conexión exitosa:**
```
[MCP] Inicializando cliente MCP de Notion para usuario 575a8929...
[MCP] ✓ Cliente MCP de Notion inicializado correctamente
[MCP] Disponibles 15 herramientas de Notion
[CLAUDE] ✓ Cargadas 15 herramientas MCP de Notion
```

**Ejecución de herramienta:**
```
[MCP] Ejecutando herramienta: search_notion
[MCP] Argumentos: {"query":"marketing","page_size":10}
[MCP] ✓ Herramienta search_notion ejecutada correctamente
```

### Costos Reales

Después de usar MCP por un mes, revisar:

```sql
-- Ver uso de Claude por usuario
SELECT
  COUNT(*) as queries,
  AVG(execution_time_ms) as avg_time
FROM task_metrics  -- Crear esta tabla si quieres tracking
WHERE model_used LIKE 'claude%'
AND task_type = 'NOTION_MCP'
GROUP BY DATE(timestamp);
```

Costo estimado = `queries * $0.003` (promedio)

---

## 🚀 Despliegue a Producción

### Variables de Entorno Requeridas

```bash
# Notion OAuth
NOTION_CLIENT_ID=your-notion-client-id
NOTION_CLIENT_SECRET=secret_your-notion-client-secret

# Claude API
ANTHROPIC_API_KEY=sk-ant-api03-your-anthropic-api-key

# Encriptación
ENCRYPTION_KEY=your-base64-encoded-32-byte-encryption-key

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

### Checklist Pre-Deployment

- [ ] Variables de entorno configuradas en Vercel/Dokku
- [ ] Créditos añadidos a cuenta de Claude
- [ ] Redirect URI de Notion actualizado en consola de Notion
- [ ] `mcp-remote` instalado como dependencia (✅ ya instalado)
- [ ] Build exitoso sin errores (✅ verificado)
- [ ] Testing en staging con usuario real

---

## 📚 Referencias

- [Notion MCP Docs](https://developers.notion.com/docs/get-started-with-mcp)
- [Anthropic Console](https://console.anthropic.com)
- [MCP Remote Package](https://www.npmjs.com/package/mcp-remote)
- [Notion OAuth Guide](https://developers.notion.com/docs/authorization)

---

**¿Listo para probar?**

1. ✅ Conecta Notion en `/settings`
2. ✅ Añade $5 en créditos de Claude
3. ✅ Prueba: "Busca en Notion páginas sobre X"
4. 🎉 ¡Disfruta de 15 herramientas MCP!

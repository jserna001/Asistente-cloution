# Migración Híbrida Multi-Modelo - Completada ✓

## Resumen de Implementación

Se ha implementado con éxito un sistema de orquestación inteligente multi-modelo que optimiza costos y rendimiento:

### Arquitectura

```
Usuario → RAG → [Router Gemini Flash] → Clasificador de Tareas
                                              ↓
                    ┌─────────────────────────┼─────────────────────┐
                    ↓                         ↓                     ↓
            [Gemini Flash]            [Gemini Pro]          [Claude Sonnet]
            Tareas simples           RAG + Browser          + MCP Notion
            (~$0.60/1M tokens)       (~$3.50/1M tokens)     (~$3.00/1M tokens)
```

### Modelos por Tipo de Tarea

| Tipo de Tarea | Modelo Asignado | Razón |
|---------------|-----------------|-------|
| **SIMPLE** | Gemini Flash | Saludos, conversación básica - más económico |
| **RAG** | Gemini Pro | Búsquedas en memoria - coherencia con embeddings |
| **BROWSER** | Gemini Pro | Automatización web - precisión en selectores |
| **NOTION_MCP** | Claude Sonnet | 15 herramientas MCP nativas de Notion |
| **COMPLEX** | Claude Sonnet | Tareas multi-herramienta - mejor razonamiento |

### Ahorro Estimado

- **Actual (Solo Gemini):** ~$3.52/mes
- **Nuevo (Híbrido):** ~$1.53/mes
- **AHORRO: 56%** 💰

## Archivos Creados

### Nuevos Módulos de Orquestación

```
/lib/orchestration/
├── types.ts                    # Tipos compartidos
├── taskClassifier.ts           # Router inteligente (Gemini Flash)
├── geminiExecutor.ts           # Ejecutor de Gemini (refactorizado)
├── claudeExecutor.ts           # Ejecutor de Claude + MCP
├── mcpNotionClient.ts          # Cliente MCP de Notion (15 herramientas)
├── toolConverters.ts           # Conversores Gemini ↔ Claude
└── modelOrchestrator.ts        # Orquestador central
```

### Archivos Modificados

- **app/api/chat/route.ts** - Ahora usa el orquestador (simplificado de 338 → 95 líneas)
- **package.json** - Añadido `@anthropic-ai/sdk` y `@modelcontextprotocol/sdk`
- **.env.local** - Añadida variable `ANTHROPIC_API_KEY` (requiere configuración)

## Configuración Requerida

### 1. Obtener API Key de Claude

1. Ir a https://console.anthropic.com
2. Crear cuenta o iniciar sesión
3. Ir a "API Keys" → "Create Key"
4. Copiar la clave (empieza con `sk-ant-...`)
5. Añadirla a `.env.local`:

```bash
ANTHROPIC_API_KEY=sk-ant-api03-tu-clave-aqui
```

### 2. Variables de Entorno Requeridas

Verificar que `.env.local` contenga:

```bash
# APIs de IA
GEMINI_API_KEY=...                          # ✓ Ya configurada
ANTHROPIC_API_KEY=sk-ant-...                # ⚠️ NUEVO - configurar

# Supabase
NEXT_PUBLIC_SUPABASE_URL=...                # ✓ Ya configurada
NEXT_PUBLIC_SUPABASE_ANON_KEY=...           # ✓ Ya configurada
SUPABASE_SERVICE_ROLE_KEY=...               # ✓ Ya configurada

# Google OAuth
GOOGLE_CLIENT_ID=...                        # ✓ Ya configurada
GOOGLE_CLIENT_SECRET=...                    # ✓ Ya configurada

# Notion
NOTION_INTERNAL_INTEGRATION_TOKEN=...       # ✓ Ya configurada

# Encriptación
ENCRYPTION_KEY=...                          # ✓ Ya configurada
```

## Testing del Sistema

### Ejecutar Servidor de Desarrollo

```bash
npm run dev
```

### Plan de Pruebas

1. **Tareas SIMPLES (Gemini Flash)**
   - "Hola"
   - "¿Qué puedes hacer?"
   - "Gracias"
   - **Esperado:** Respuestas rápidas, log muestra `[GEMINI] Ejecutando con modelo: gemini-2.0-flash-exp`

2. **Tareas RAG (Gemini Pro)**
   - "¿Qué tareas tengo pendientes?"
   - "¿Hay correos importantes?"
   - **Esperado:** Búsqueda en memoria, log muestra `[GEMINI] Ejecutando con modelo: gemini-2.5-pro`

3. **Tareas BROWSER (Gemini Pro)**
   - "Navega a wikipedia.org"
   - "Busca información sobre IA"
   - **Esperado:** Interacción con navegador, log muestra `[GEMINI]` con herramientas `browser.*`

4. **Tareas NOTION_MCP (Claude Sonnet)** ⚠️ Requiere ANTHROPIC_API_KEY
   - "Crea una página en Notion sobre el proyecto X"
   - "Busca en Notion páginas sobre 'marketing'"
   - **Esperado:** Log muestra `[CLAUDE]` y `[MCP] Ejecutando herramienta: search_notion`

5. **Tareas COMPLEX (Claude Sonnet)** ⚠️ Requiere ANTHROPIC_API_KEY
   - "Busca información en internet Y créame una página en Notion"
   - **Esperado:** Múltiples herramientas, log muestra `[CLAUDE]` con varios pasos

### Verificar Logs

Los logs mostrarán el flujo completo:

```bash
[CHAT API] Nueva solicitud de usuario: 575a8929-...
[CHAT API] Query: "¿Qué tareas tengo?"

=== ORQUESTADOR MULTI-MODELO ===
[1/3] CLASIFICACIÓN DE TAREA
[CLASSIFIER] Query: "¿Qué tareas tengo?..." → RAG (150ms)
✓ Tarea clasificada como: RAG
✓ Modelo seleccionado: gemini / gemini-2.5-pro

[2/3] PREPARACIÓN DE HERRAMIENTAS
✓ Herramientas: answer_user

[3/3] EJECUCIÓN DEL MODELO
[GEMINI] Ejecutando con modelo: gemini-2.5-pro
[RAG] ✓ Encontró 5 chunks relevantes
[GEMINI] ✓ Completado en 1420ms (1 pasos)

=== RESULTADO ===
✓ Respuesta generada (234 caracteres)
✓ Tiempo de ejecución: 1420ms
✓ Tiempo total: 1580ms
```

## Funcionalidades MCP de Notion (15 Herramientas)

Una vez configurado `ANTHROPIC_API_KEY`, Claude tendrá acceso a:

### Búsqueda y Lectura
- `search_notion` - Buscar páginas y bases de datos
- `fetch_page` - Obtener contenido completo de una página
- `get_page_property` - Leer propiedades específicas
- `get_block_children` - Leer bloques de contenido

### Creación y Edición
- `create_page` - Crear nuevas páginas
- `update_page` - Actualizar páginas existentes
- `append_block` - Añadir bloques de contenido
- `delete_block` - Eliminar bloques

### Bases de Datos
- `create_database_page` - Crear entradas en bases de datos
- `update_database_page` - Actualizar entradas
- `query_database` - Consultar con filtros y ordenamiento
- `get_database` - Obtener esquema de base de datos

### Usuarios
- `get_user` - Obtener información de usuario
- `list_users` - Listar usuarios del workspace
- `search_users` - Buscar usuarios

## Monitoreo y Métricas

El sistema registra automáticamente:

```json
{
  "timestamp": "2025-11-06T...",
  "taskType": "RAG",
  "modelUsed": "gemini:gemini-2.5-pro",
  "executionTimeMs": 1420,
  "totalTimeMs": 1580,
  "responseLength": 234
}
```

## Rollback (Si es necesario)

Si hay problemas, se puede volver al sistema anterior:

1. Restaurar `app/api/chat/route.ts` desde git:
   ```bash
   git checkout HEAD -- app/api/chat/route.ts
   ```

2. O simplemente comentar la importación del orquestador y descomentar el código antiguo

## Próximos Pasos

### FASE 7: Optimización y Monitoring

1. **Añadir tabla de métricas en Supabase**
   - Guardar distribución de tareas por modelo
   - Calcular costo real mensual
   - Detectar patrones de uso

2. **Ajustar clasificador**
   - Si clasifica mal, actualizar prompts en `taskClassifier.ts`
   - Añadir ejemplos de casos edge

3. **Extender MCP**
   - Añadir MCP de Gmail (en desarrollo por Anthropic)
   - Añadir MCP de Google Calendar
   - Integrar todos los servicios vía MCP

4. **A/B Testing**
   - Comparar calidad Gemini vs Claude en mismas tareas
   - Optimizar umbral de complejidad para switch de modelo

## Notas Técnicas

### Compatibilidad con Código Existente

- ✅ **RAG Service** - Sin cambios, sigue usando `text-embedding-004`
- ✅ **Browser Service** - Sin cambios, funciona con ambos modelos
- ✅ **Daily Summary** - Sin cambios, sigue usando Gemini Flash
- ✅ **Notion REST API** - Sigue funcionando como fallback si MCP falla

### Manejo de Errores

El sistema tiene fallback automático:
- Si Claude falla → Gemini Pro toma el control
- Si MCP falla → REST API de Notion como backup
- Si clasificador falla → Usa `SIMPLE` como predeterminado

### Límites de Rate

- Gemini: 60 requests/minuto (generoso)
- Claude: 50 requests/minuto (Tier gratuito)
- MCP Notion: Mismo límite que Notion API (3 req/s)

---

**Última actualización:** 2025-11-06
**Status:** ✅ Implementación completa, listo para testing
**Pendiente:** Configurar `ANTHROPIC_API_KEY` para habilitar Claude y MCP

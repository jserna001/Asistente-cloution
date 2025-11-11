# 📊 Análisis del Sistema de Resumen Diario

## 🔍 Estado Actual

### Arquitectura General

```
┌─────────────────────────────────────────────────────────────┐
│ SISTEMA DE RESUMEN DIARIO (ACTUAL)                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Trigger: Cron Job / Usuario manual                        │
│     ↓                                                       │
│  GET /api/cron/daily-summary                               │
│     ↓                                                       │
│  Para cada usuario:                                         │
│     1. ✅ Lee Google Calendar (eventos del día)            │
│     2. ❌ Lee Notion (HARDCODED query)                     │
│     3. ❌ Lee Gmail (HARDCODED query)                      │
│     4. ❌ Genera resumen (HARDCODED prompt)                │
│     5. ✅ Guarda en daily_summaries                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Archivos Clave

| Archivo | Líneas Clave | Función |
|---------|--------------|---------|
| `app/api/cron/daily-summary/route.ts` | 261-262 | Query hardcodeada de Notion |
| `app/api/cron/daily-summary/route.ts` | 278-279 | Query hardcodeada de Gmail |
| `app/api/cron/daily-summary/route.ts` | 295-317 | Prompt hardcodeado de generación |
| `scripts/generate-summary.ts` | 94 | Query hardcodeada de Notion (versión CLI) |
| `migration_8.sql` | 91-99 | Campos de personalización en user_preferences |

---

## ❌ Problemas Identificados

### 1. **Query RAG de Notion Hardcodeada** (Líneas 261-262)

**Código actual:**
```typescript
const notionQueryEmbedding = await embeddingModel.embedContent(
  "¿Cuáles son mis tareas pendientes o lista de compras?"
);
```

**Problema:**
- Asume que todos los usuarios tienen "tareas" y "lista de compras"
- No se adapta al tipo de usuario:
  - **Estudiante:** debería buscar "entregas académicas, exámenes, proyectos"
  - **Profesional:** debería buscar "reuniones, deadlines, proyectos laborales"
  - **Emprendedor:** debería buscar "OKRs, leads, seguimiento a clientes"
  - **Freelancer:** debería buscar "proyectos activos, facturas pendientes"
  - **Básico:** sí buscar "tareas pendientes"

**Evidencia del problema:**
El usuario reporta: *"el mensaje del resumen del día parece tener algunos elementos hardcodeados como la lista de compras y tareas en notion"*

---

### 2. **Query RAG de Gmail Hardcodeada** (Líneas 278-279)

**Código actual:**
```typescript
const gmailQueryEmbedding = await embeddingModel.embedContent(
  "¿Hay algún correo urgente o importante que necesite mi atención?"
);
```

**Problema:**
- Query genérica que no considera:
  - **Remitentes prioritarios** del usuario (ej: jefe, clientes, profesores)
  - **Keywords personalizadas** (ej: "factura", "entrega", "urgente")
  - **Preferencia de solo emails no leídos**

---

### 3. **Prompt de Generación Hardcodeado** (Líneas 295-317)

**Código actual:**
```typescript
const systemPrompt = `Eres mi asistente personal. Hoy es ${fecha}.
Aquí está mi información del día.

Eventos del Calendario:
---
${calendarContext || 'No hay eventos programados para hoy.'}
---

Tareas y Notas de Notion:
---
${notionContext || 'Sin notas o tareas relevantes encontradas.'}
---

Correos Relevantes:
---
${gmailContext || 'No se encontraron correos urgentes.'}
---

Tu tarea: Escribe un resumen matutino conciso y amigable (máximo 3-5 puntos clave)...`;
```

**Problemas:**
- ❌ **Longitud fija:** "máximo 3-5 puntos clave" (debería ser personalizable: brief, balanced, detailed)
- ❌ **Tono fijo:** "conciso y amigable" (debería adaptarse: professional, friendly, motivational)
- ❌ **Emojis:** no especificados (debería ser configurable: use_emojis)
- ❌ **Formato fijo:** siempre agrupa por tema (debería respetar: group_by_category)
- ❌ **Action items:** no menciona si incluirlos (debería respetar: include_action_items)

---

### 4. **No Considera Databases Específicas del Usuario**

**Problema:**
- Cuando el usuario instala una plantilla, se crean databases específicas en Notion
- El sistema guarda los IDs en `user_preferences.notion_database_ids`
- **PERO** el sistema de resumen NO USA estos IDs, busca genéricamente en todo Notion

**Ejemplo:**
- Usuario Profesional instala plantilla con:
  - "Task & Projects Manager" (ID: abc123)
  - "Meeting Notes" (ID: def456)
- El resumen debería consultar específicamente esas databases
- Actualmente busca en todo el workspace con query genérica

---

## ✅ Campos de Personalización Disponibles (migration_8.sql)

Ya existen estos campos en `user_preferences` que NO se están usando:

### Perfil del Usuario
```sql
user_role TEXT DEFAULT 'professional'
user_interests TEXT[]
selected_template_pack TEXT  -- ¡CLAVE! Saber qué plantilla eligió
```

### Contenido del Resumen
```sql
include_calendar BOOLEAN DEFAULT true
include_notion BOOLEAN DEFAULT true
include_gmail BOOLEAN DEFAULT true
include_yesterday_summary BOOLEAN DEFAULT false
```

### Gmail Personalización
```sql
gmail_priority_senders TEXT[]      -- ej: ['jefe@empresa.com', 'cliente@startup.com']
gmail_keywords TEXT[]               -- ej: ['urgente', 'factura', 'entrega']
gmail_only_unread BOOLEAN DEFAULT true
gmail_timeframe_hours INTEGER DEFAULT 24
```

### Notion Personalización
```sql
notion_database_ids TEXT[]          -- IDs de databases instaladas con la plantilla
notion_task_statuses TEXT[]         -- Estados a considerar como "pendiente"
  DEFAULT ARRAY['Not Started', 'In Progress', 'To Do']
```

### Formato del Resumen
```sql
summary_length TEXT DEFAULT 'balanced'   -- 'brief', 'balanced', 'detailed'
summary_tone TEXT DEFAULT 'friendly'     -- 'professional', 'friendly', 'motivational'
use_emojis BOOLEAN DEFAULT true
group_by_category BOOLEAN DEFAULT true
include_action_items BOOLEAN DEFAULT true
```

---

## 🎯 Solución Propuesta

### Fase 1: Personalización Básica (Quick Win)

#### 1.1 Usar `selected_template_pack` para Queries Dinámicas

**Implementación:**
```typescript
// Obtener preferencias del usuario
const { data: userPref } = await supabase
  .from('user_preferences')
  .select('selected_template_pack, notion_database_ids, default_rag_queries')
  .eq('user_id', userId)
  .single();

// Usar queries predeterminadas de la plantilla
const template = await getTemplateByPackId(userPref.selected_template_pack);
const notionQueries = template.default_rag_queries.notion || [
  "¿Cuáles son mis tareas pendientes?"
];

// Buscar en RAG con cada query
const notionContexts = await Promise.all(
  notionQueries.map(query => searchRAG(query, 'notion', userId))
);
```

**Resultado:**
- ✅ Estudiante verá: "Exámenes próximos, proyectos académicos"
- ✅ Profesional verá: "Reuniones de hoy, proyectos en progreso"
- ✅ Emprendedor verá: "Clientes a seguir, OKRs del trimestre"

---

#### 1.2 Personalizar el Prompt según Formato y Tono

**Implementación:**
```typescript
const { summary_length, summary_tone, use_emojis, group_by_category, include_action_items } = userPref;

// Mapeo de configuraciones a instrucciones
const lengthInstructions = {
  brief: "Resume en 2-3 puntos clave máximo",
  balanced: "Resume en 4-6 puntos clave",
  detailed: "Detalla 8-10 puntos importantes, con contexto adicional"
};

const toneInstructions = {
  professional: "Usa lenguaje formal y directo. Evita coloquialismos.",
  friendly: "Usa lenguaje cercano y amigable. Sé conversacional.",
  motivational: "Sé inspirador y energético. Enfatiza oportunidades y logros."
};

const systemPrompt = `Eres mi asistente personal. Hoy es ${fecha}.

FORMATO: ${lengthInstructions[summary_length]}
TONO: ${toneInstructions[summary_tone]}
${use_emojis ? 'USA emojis relevantes (ej: 📅, ✅, 📧)' : 'NO uses emojis'}
${group_by_category ? 'AGRUPA la información por categorías (Reuniones, Tareas, Correos)' : 'Presenta en orden de prioridad'}
${include_action_items ? 'INCLUYE action items específicos al final' : ''}

[... resto del prompt ...]
`;
```

---

#### 1.3 Usar `notion_database_ids` para Búsquedas Específicas

**Problema actual:**
La función `match_document_chunks` busca en TODOS los chunks de Notion del usuario.

**Solución:**
Filtrar por `source_metadata->>'database_id'` si el chunk proviene de una database específica.

**Implementación:**
```typescript
// Si el usuario tiene databases instaladas, buscar solo en esas
if (userPref.notion_database_ids && userPref.notion_database_ids.length > 0) {
  const { data: notionChunks } = await supabase.rpc('match_document_chunks', {
    query_embedding: notionQueryEmbedding.embedding.values,
    match_threshold: 0.6,
    match_count: 5,
    p_source_type: 'notion',
    p_user_id: userId,
    p_database_ids: userPref.notion_database_ids  // NUEVO parámetro
  });
}
```

**Cambio en SQL Function:**
```sql
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  p_source_type text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_database_ids text[] DEFAULT NULL  -- NUEVO
)
RETURNS TABLE (...) AS $$
BEGIN
  RETURN QUERY
  SELECT ...
  FROM document_chunks
  WHERE
    user_id = COALESCE(p_user_id, auth.uid())
    AND (p_source_type IS NULL OR source_type = p_source_type)
    -- NUEVO filtro:
    AND (
      p_database_ids IS NULL
      OR (source_metadata->>'database_id')::text = ANY(p_database_ids)
    )
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;
```

---

### Fase 2: Personalización Avanzada

#### 2.1 Gmail Priority Senders y Keywords

**Implementación:**
```typescript
const { gmail_priority_senders, gmail_keywords } = userPref;

let gmailQuery = "¿Hay algún correo urgente o importante?";

if (gmail_priority_senders && gmail_priority_senders.length > 0) {
  gmailQuery += ` Prioriza correos de: ${gmail_priority_senders.join(', ')}.`;
}

if (gmail_keywords && gmail_keywords.length > 0) {
  gmailQuery += ` Busca especialmente: ${gmail_keywords.join(', ')}.`;
}

const gmailQueryEmbedding = await embeddingModel.embedContent(gmailQuery);
```

---

#### 2.2 Incluir Resumen de Ayer (Contexto)

**Implementación:**
```typescript
if (userPref.include_yesterday_summary) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const { data: yesterdaySummary } = await supabase
    .from('daily_summaries')
    .select('summary_text')
    .eq('user_id', userId)
    .gte('created_at', yesterday.toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (yesterdaySummary) {
    systemPrompt = `Resumen de ayer para contexto:
---
${yesterdaySummary.summary_text}
---

${systemPrompt}`;
  }
}
```

---

#### 2.3 User Context (Objetivos, Proyectos Activos)

**De la tabla `user_context` (creada en migration_8):**
```typescript
const { data: userContexts } = await supabase
  .from('user_context')
  .select('title, description, context_type')
  .eq('user_id', userId)
  .eq('status', 'active')
  .order('priority', { ascending: false })
  .limit(5);

if (userContexts && userContexts.length > 0) {
  const contextSection = userContexts.map(ctx =>
    `- ${ctx.context_type === 'goal' ? '🎯' : '📁'} ${ctx.title}: ${ctx.description}`
  ).join('\n');

  systemPrompt = `Contexto Personal (objetivos y proyectos activos):
---
${contextSection}
---

${systemPrompt}

Cuando sea relevante, menciona cómo los eventos de hoy se relacionan con mis objetivos.`;
}
```

---

## 📋 Plan de Implementación

### Sprint 1: Fundamentos (2-3 días)
- [ ] Modificar `app/api/cron/daily-summary/route.ts` para cargar `user_preferences` completas
- [ ] Implementar queries dinámicas basadas en `selected_template_pack`
- [ ] Implementar personalización de prompt (length, tone, emojis, etc.)
- [ ] Testing con diferentes perfiles

### Sprint 2: Notion Específico (2 días)
- [ ] Modificar función SQL `match_document_chunks` para aceptar `p_database_ids`
- [ ] Actualizar llamadas a RAG para usar `notion_database_ids`
- [ ] Testing con plantillas instaladas

### Sprint 3: Gmail Avanzado (1 día)
- [ ] Implementar `gmail_priority_senders` en query
- [ ] Implementar `gmail_keywords` en query
- [ ] Testing con diferentes configuraciones

### Sprint 4: Contexto Personal (2 días)
- [ ] Integrar `user_context` en el resumen
- [ ] Implementar `include_yesterday_summary`
- [ ] Testing end-to-end

---

## 🧪 Casos de Prueba

### Test 1: Usuario Estudiante
**Configuración:**
- `selected_template_pack`: `'student'`
- `summary_tone`: `'friendly'`
- `use_emojis`: `true`

**Resumen esperado:**
```
📚 Buenos días! Aquí está tu día académico:

🎯 Entregas y Exámenes:
- Proyecto de Historia debido mañana (alta prioridad)
- Examen de Matemáticas el viernes

📅 Clases de Hoy:
- 9:00 AM - Cálculo I
- 2:00 PM - Literatura Española

📧 Correos:
- Profesor García envió material de estudio para el examen

✅ To-Do:
- Terminar capítulo 4 de Historia
- Repasar fórmulas de derivadas
```

### Test 2: Usuario Profesional
**Configuración:**
- `selected_template_pack`: `'professional'`
- `summary_tone`: `'professional'`
- `use_emojis`: `false`

**Resumen esperado:**
```
Resumen Diario - Lunes, 11 de noviembre de 2025

REUNIONES PROGRAMADAS:
- 10:00 AM - Daily Standup con el equipo de desarrollo
- 3:00 PM - Review de Q4 con stakeholders

TAREAS CRÍTICAS:
- Completar documentación del API antes de las 5 PM
- Revisar PR #234 (bloqueante para deploy)

CORREOS IMPORTANTES:
- Manager solicitó actualización del roadmap
- Cliente ABC pregunta por fecha de entrega

PROYECTOS EN PROGRESO:
- Proyecto A: En curso (deadline: viernes)
- Proyecto B: Bloqueado por dependencia externa
```

---

## 📊 Métricas de Éxito

| Métrica | Antes | Meta |
|---------|-------|------|
| Relevancia del resumen (NPS) | ? | 8+/10 |
| Queries hardcodeadas | 2 | 0 |
| Personalización por plantilla | 0% | 100% |
| Uso de preferencias de usuario | 0% | 100% |
| Usuarios que desactivan resumen | ? | <5% |

---

## 🔄 Retroalimentación Continua

Para mejorar el sistema con el tiempo:

1. **Tabla `summary_feedback`** (ya existe en migration_8):
   ```sql
   CREATE TABLE summary_feedback (
     user_id UUID,
     summary_id UUID,
     rating INTEGER CHECK (rating >= 1 AND rating <= 5),
     was_helpful BOOLEAN,
     feedback_text TEXT,
     feedback_tags TEXT[]
   );
   ```

2. **UI de Feedback en el Chat:**
   - Botón "👍 Útil" / "👎 No útil" en cada resumen
   - Permitir ajustar preferencias directamente desde el resumen

3. **Análisis Periódico:**
   - Query mensual: ¿Qué queries de RAG tienen mejor match_threshold?
   - ¿Qué configuraciones de tono/longitud tienen mejor rating?

---

## 🚀 Próximos Pasos Inmediatos

1. **Revisar esta propuesta** con el equipo
2. **Priorizar sprints** según impacto vs esfuerzo
3. **Crear issues en GitHub** para cada tarea
4. **Comenzar con Sprint 1** (cambios más simples, mayor impacto)

---

**Última actualización:** 2025-11-11
**Autor:** Claude (Análisis del sistema actual)

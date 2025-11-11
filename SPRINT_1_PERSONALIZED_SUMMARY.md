# 🎯 Sprint 1: Personalización Básica del Resumen Diario

## Objetivo

Eliminar todos los elementos hardcodeados del resumen diario y hacerlo dinámico según:
1. La plantilla elegida por el usuario en onboarding
2. Las preferencias de formato y tono del usuario
3. Las databases instaladas en Notion

**Impacto esperado:** 80% de mejora en relevancia del resumen con 2-3 días de desarrollo

---

## 📝 Cambios a Implementar

### Archivo 1: `app/api/cron/daily-summary/route.ts`

#### Cambio 1.1: Cargar Preferencias Completas del Usuario

**Ubicación:** Línea ~100-106

**Antes:**
```typescript
const { data: userPref, error: prefError } = await supabase
  .from('user_preferences')
  .select('user_id, daily_summary_time, timezone')
  .eq('user_id', authenticatedUserId)
  .eq('daily_summary_enabled', true)
  .maybeSingle();
```

**Después:**
```typescript
const { data: userPref, error: prefError } = await supabase
  .from('user_preferences')
  .select(`
    user_id,
    daily_summary_time,
    timezone,
    selected_template_pack,
    notion_database_ids,
    notion_task_statuses,
    gmail_priority_senders,
    gmail_keywords,
    summary_length,
    summary_tone,
    use_emojis,
    group_by_category,
    include_action_items,
    include_calendar,
    include_notion,
    include_gmail
  `)
  .eq('user_id', authenticatedUserId)
  .eq('daily_summary_enabled', true)
  .maybeSingle();
```

---

#### Cambio 1.2: Obtener Queries Dinámicas de la Plantilla

**Ubicación:** Nueva función antes de la línea ~259

**Agregar esta función helper:**
```typescript
/**
 * Obtiene las queries RAG predeterminadas según la plantilla del usuario
 */
async function getTemplateQueries(
  supabase: any,
  templatePackId: string
): Promise<{ notion: string[]; gmail: string[]; calendar: string[] }> {
  const { data: template, error } = await supabase
    .from('notion_template_catalog')
    .select('default_rag_queries')
    .eq('template_pack_id', templatePackId)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !template) {
    console.warn(`[CRON] No se encontró plantilla ${templatePackId}, usando queries por defecto`);
    return {
      notion: ["¿Cuáles son mis tareas pendientes?"],
      gmail: ["¿Hay algún correo urgente o importante?"],
      calendar: ["Eventos de hoy"]
    };
  }

  return template.default_rag_queries || {
    notion: ["¿Cuáles son mis tareas pendientes?"],
    gmail: ["¿Hay algún correo urgente o importante?"],
    calendar: ["Eventos de hoy"]
  };
}
```

---

#### Cambio 1.3: Reemplazar Query Hardcodeada de Notion

**Ubicación:** Líneas ~259-274

**Antes:**
```typescript
console.log(`[CRON] [${userId}] Buscando tareas en Notion...`);
const notionQueryEmbedding = await embeddingModel.embedContent(
  "¿Cuáles son mis tareas pendientes o lista de compras?"
);

const { data: notionChunks, error: notionError } = await supabase.rpc('match_document_chunks', {
  query_embedding: notionQueryEmbedding.embedding.values,
  match_threshold: 0.6,
  match_count: 5,
  p_source_type: 'notion',
  p_user_id: userId
});
```

**Después:**
```typescript
console.log(`[CRON] [${userId}] Buscando información en Notion...`);

// Obtener queries dinámicas según la plantilla
const templateQueries = await getTemplateQueries(supabase, userPref.selected_template_pack || 'basic');
const notionQueries = templateQueries.notion;

console.log(`[CRON] [${userId}] Usando queries de plantilla ${userPref.selected_template_pack}:`, notionQueries);

// Ejecutar múltiples queries y combinar resultados
const notionChunksArrays = await Promise.all(
  notionQueries.map(async (query) => {
    const embedding = await embeddingModel.embedContent(query);
    const { data, error } = await supabase.rpc('match_document_chunks', {
      query_embedding: embedding.embedding.values,
      match_threshold: 0.6,
      match_count: 3, // 3 chunks por query
      p_source_type: 'notion',
      p_user_id: userId
    });

    if (error) {
      console.error(`[CRON] [${userId}] Error en query "${query}":`, error.message);
      return [];
    }

    return data || [];
  })
);

// Combinar y deduplicar chunks (por si dos queries retornan el mismo)
const notionChunksMap = new Map();
notionChunksArrays.flat().forEach(chunk => {
  if (!notionChunksMap.has(chunk.id)) {
    notionChunksMap.set(chunk.id, chunk);
  }
});

const notionChunks = Array.from(notionChunksMap.values());
const notionContext = notionChunks.map((c: any) => c.content).join('\n---\n') || null;

console.log(`[CRON] [${userId}] Encontrados ${notionChunks.length} chunks relevantes en Notion`);
```

---

#### Cambio 1.4: Personalizar Query de Gmail

**Ubicación:** Líneas ~276-291

**Antes:**
```typescript
console.log(`[CRON] [${userId}] Buscando correos importantes...`);
const gmailQueryEmbedding = await embeddingModel.embedContent(
  "¿Hay algún correo urgente o importante que necesite mi atención?"
);
```

**Después:**
```typescript
console.log(`[CRON] [${userId}] Buscando correos importantes...`);

// Construir query dinámica basada en preferencias
let gmailQuery = templateQueries.gmail[0] || "¿Hay algún correo urgente o importante?";

// Agregar contexto de remitentes prioritarios
if (userPref.gmail_priority_senders && userPref.gmail_priority_senders.length > 0) {
  gmailQuery += ` Especialmente de: ${userPref.gmail_priority_senders.slice(0, 3).join(', ')}.`;
}

// Agregar keywords
if (userPref.gmail_keywords && userPref.gmail_keywords.length > 0) {
  gmailQuery += ` Busca palabras clave: ${userPref.gmail_keywords.slice(0, 5).join(', ')}.`;
}

console.log(`[CRON] [${userId}] Query de Gmail personalizada: "${gmailQuery}"`);

const gmailQueryEmbedding = await embeddingModel.embedContent(gmailQuery);
```

---

#### Cambio 1.5: Personalizar el Prompt de Generación

**Ubicación:** Líneas ~293-317

**Antes:**
```typescript
const systemPrompt = `Eres mi asistente personal. Hoy es ${fecha}.
Aquí está mi información del día.

[... resto del prompt hardcodeado ...]

Tu tarea: Escribe un resumen matutino conciso y amigable (máximo 3-5 puntos clave)...`;
```

**Después:**
```typescript
// Mapeos de configuraciones a instrucciones
const lengthInstructions = {
  brief: "Resume en 2-3 puntos clave máximo, ultra conciso",
  balanced: "Resume en 4-6 puntos clave, equilibrando detalle y brevedad",
  detailed: "Detalla 8-10 puntos importantes con contexto adicional"
};

const toneInstructions = {
  professional: "Usa lenguaje formal y directo. Evita coloquialismos. Sé objetivo y estructurado.",
  friendly: "Usa lenguaje cercano y amigable. Sé conversacional pero respetuoso.",
  motivational: "Sé inspirador y energético. Enfatiza oportunidades, logros y posibilidades. Anima al usuario."
};

// Obtener configuraciones (con defaults por si son null)
const summaryLength = userPref.summary_length || 'balanced';
const summaryTone = userPref.summary_tone || 'friendly';
const useEmojis = userPref.use_emojis !== false; // default true
const groupByCategory = userPref.group_by_category !== false; // default true
const includeActionItems = userPref.include_action_items !== false; // default true

const systemPrompt = `Eres mi asistente personal. Hoy es ${new Date().toLocaleDateString('es-ES', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric'
})}.

INSTRUCCIONES DE FORMATO:
- LONGITUD: ${lengthInstructions[summaryLength]}
- TONO: ${toneInstructions[summaryTone]}
- EMOJIS: ${useEmojis ? 'USA emojis relevantes para categorías (ej: 📅 Reuniones, ✅ Tareas, 📧 Correos, 🎯 Objetivos)' : 'NO uses emojis en absoluto'}
- ESTRUCTURA: ${groupByCategory ? 'AGRUPA la información por categorías claras (Reuniones, Tareas, Correos, etc.)' : 'Presenta en orden de prioridad sin categorizar'}
${includeActionItems ? '- INCLUYE una sección final "Action Items" con tareas específicas para hoy' : ''}

---

Aquí está la información del día:

${userPref.include_calendar !== false ? `
📅 Eventos del Calendario:
---
${calendarContext || 'No hay eventos programados para hoy.'}
---
` : ''}

${userPref.include_notion !== false ? `
📝 Información de Notion:
---
${notionContext || 'Sin información relevante encontrada en Notion.'}
---
` : ''}

${userPref.include_gmail !== false ? `
📧 Correos Relevantes:
---
${gmailContext || 'No se encontraron correos urgentes.'}
---
` : ''}

Tu tarea: Genera el resumen matutino siguiendo EXACTAMENTE las instrucciones de formato arriba. Si no hay información importante, simplemente di "${summaryTone === 'motivational' ? '¡Todo tranquilo por hoy! Es un gran día para avanzar en tus objetivos personales.' : summaryTone === 'professional' ? 'No hay elementos críticos programados para hoy.' : 'Todo tranquilo por hoy, ¡que tengas un gran día!'}".`;
```

---

#### Cambio 1.6: Actualizar Logs de Stats

**Ubicación:** Líneas ~336-345

**Agregar más contexto a los logs:**
```typescript
console.log(`[CRON] [${userId}] ✓ Resumen generado y guardado exitosamente`);
console.log(`[CRON] [${userId}] Config: ${summaryLength} / ${summaryTone} / ${useEmojis ? 'con' : 'sin'} emojis`);
console.log(`[CRON] [${userId}] Plantilla: ${userPref.selected_template_pack || 'ninguna'}`);

results.push({
  userId,
  success: true,
  config: {
    template: userPref.selected_template_pack,
    length: summaryLength,
    tone: summaryTone,
    emojis: useEmojis
  },
  stats: {
    calendarEvents: calendarEvents.length,
    notionChunks: notionChunks?.length || 0,
    gmailChunks: gmailChunks?.length || 0,
  }
});
```

---

### Archivo 2: `scripts/generate-summary.ts`

**Nota:** Este script es para testing manual/local. Aplicar los mismos cambios que en `route.ts`:

1. Cargar preferencias completas del usuario
2. Usar `selected_template_pack` para queries dinámicas
3. Personalizar el prompt

---

## 🧪 Testing

### Test 1: Usuario con Plantilla Estudiante

**Setup:**
```sql
UPDATE user_preferences SET
  selected_template_pack = 'student',
  summary_tone = 'friendly',
  summary_length = 'balanced',
  use_emojis = true,
  daily_summary_enabled = true
WHERE user_id = 'TU_USER_ID';
```

**Ejecutar:**
```bash
curl -X GET https://tu-app.vercel.app/api/cron/daily-summary \
  -H "Authorization: Bearer TU_SUPABASE_TOKEN"
```

**Verificar:**
- El resumen debe mencionar "exámenes", "proyectos académicos", "entregas"
- Debe tener tono amigable y emojis
- Longitud: 4-6 puntos

---

### Test 2: Usuario con Plantilla Profesional

**Setup:**
```sql
UPDATE user_preferences SET
  selected_template_pack = 'professional',
  summary_tone = 'professional',
  summary_length = 'detailed',
  use_emojis = false,
  gmail_priority_senders = ARRAY['jefe@empresa.com', 'manager@startup.com'],
  daily_summary_enabled = true
WHERE user_id = 'TU_USER_ID';
```

**Verificar:**
- El resumen debe mencionar "reuniones", "proyectos", "deadlines"
- Tono formal, sin emojis
- Longitud: 8-10 puntos detallados
- Prioriza correos de los remitentes especificados

---

### Test 3: Usuario con Plantilla Emprendedor

**Setup:**
```sql
UPDATE user_preferences SET
  selected_template_pack = 'entrepreneur',
  summary_tone = 'motivational',
  summary_length = 'balanced',
  use_emojis = true,
  gmail_keywords = ARRAY['cliente', 'oportunidad', 'inversión'],
  daily_summary_enabled = true
WHERE user_id = 'TU_USER_ID';
```

**Verificar:**
- El resumen debe mencionar "OKRs", "clientes", "leads", "seguimiento"
- Tono motivacional e inspirador
- Incluye keywords de Gmail en la búsqueda

---

## 📊 Métricas de Éxito

**Antes del Sprint:**
- [ ] Resumen con query hardcodeada "lista de compras"
- [ ] Mismo formato para todos los usuarios
- [ ] Sin usar preferencias de `user_preferences`

**Después del Sprint:**
- [ ] Resumen personalizado por plantilla
- [ ] Formato adaptado a preferencias (tono, longitud, emojis)
- [ ] Queries dinámicas según perfil de usuario
- [ ] Logs detallados de configuración usada

**KPIs:**
- Líneas de código hardcodeado eliminadas: **5 → 0**
- Campos de `user_preferences` usados: **3 → 15**
- Variedad de resúmenes generados: **1 → 5+ configuraciones**

---

## 🚀 Deployment

### Paso 1: Backup
```sql
-- Crear backup de summaries existentes
CREATE TABLE daily_summaries_backup AS
SELECT * FROM daily_summaries;
```

### Paso 2: Deploy a Vercel
```bash
git add .
git commit -m "feat: Personalización dinámica del resumen diario por plantilla"
git push origin tu-branch
```

### Paso 3: Verificar en Producción
1. Ejecutar resumen para usuario de prueba
2. Verificar logs en Vercel
3. Revisar resumen generado en Supabase
4. Confirmar que usa template correcto

### Paso 4: Rollout Gradual
- Día 1: Activar para 10% de usuarios
- Día 2: Si todo OK, 50%
- Día 3: 100% de usuarios

---

## 🐛 Rollback Plan

Si algo falla:

```bash
git revert HEAD
git push origin tu-branch
```

Los resúmenes volverán al comportamiento anterior (hardcoded) inmediatamente.

---

## 📝 Checklist de Implementación

- [ ] **Código:**
  - [ ] Cambio 1.1: Cargar preferencias completas
  - [ ] Cambio 1.2: Función `getTemplateQueries()`
  - [ ] Cambio 1.3: Queries dinámicas de Notion
  - [ ] Cambio 1.4: Query personalizada de Gmail
  - [ ] Cambio 1.5: Prompt dinámico con tono/longitud/emojis
  - [ ] Cambio 1.6: Logs mejorados

- [ ] **Testing:**
  - [ ] Test con template student
  - [ ] Test con template professional
  - [ ] Test con template entrepreneur
  - [ ] Test con template freelancer
  - [ ] Test con template basic
  - [ ] Test sin template (default)

- [ ] **Documentación:**
  - [ ] Actualizar README con nuevas capacidades
  - [ ] Documentar configuraciones en CLAUDE.md
  - [ ] Añadir ejemplos de personalización

- [ ] **Deploy:**
  - [ ] Push a branch
  - [ ] Deploy a Vercel preview
  - [ ] Testing en preview
  - [ ] Merge a main
  - [ ] Deploy a producción
  - [ ] Monitorear logs

---

**Estimación de esfuerzo:** 2-3 días
**Prioridad:** Alta (impacto directo en experiencia del usuario)
**Riesgo:** Bajo (cambios no rompen funcionalidad existente, solo mejoran)

**Última actualización:** 2025-11-11

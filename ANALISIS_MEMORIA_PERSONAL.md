# INFORME EXHAUSTIVO: COMPONENTES REUTILIZABLES PARA SISTEMA DE MEMORIA PERSONAL CON AUTOAPRENDIZAJE

**Fecha**: 2025-11-18
**Proyecto**: Asistente-cloution
**Objetivo**: Identificar y documentar componentes para un sistema de memoria personal con capacidad de autoaprendizaje

---

## 1. SISTEMA RAG ACTUAL - ANÁLISIS DETALLADO

### 1.1 Funcionamiento Actual
- **Ubicación**: `lib/ragService.ts`
- **Modelo de Embedding**: Gemini `text-embedding-004` (dimensión: 768)
- **Vector Store**: PostgreSQL con extensión `pgvector`
- **Función RPC**: `match_document_chunks()` - búsqueda por similitud coseno
- **Threshold**: 0.4 (flexible)
- **Match Count**: 10 chunks máximo

### 1.2 Estructura de Tabla `document_chunks`
```sql
CREATE TABLE document_chunks (
    id BIGINT PRIMARY KEY,
    document_id TEXT,
    content TEXT,
    source_type TEXT ('notion', 'gmail', etc),
    embedding VECTOR(768)
);
```

### 1.3 Flujo RAG
1. Vectorizar query con Gemini (client-side auth)
2. RPC call a `match_document_chunks()` con user_id implícito en RLS
3. Retorna JSON con top 10 chunks relevantes
4. Inyectar contexto en prompt del agente

### ✅ COMPONENTES REUTILIZABLES DIRECTAMENTE

| Componente | Ubicación | Uso para Memoria Personal |
|-----------|-----------|--------------------------|
| **Servicio RAG** | `lib/ragService.ts` | Core - Búsqueda por similitud en memoria |
| **Tabla document_chunks** | `migration.sql` | Base para almacenar chunks de aprendizaje |
| **Función match_document_chunks()** | `migration.sql` | Búsqueda vectorial de fragmentos relacionados |
| **Gemini Embeddings** | `ragService.ts` | Vectorización de nuevas entradas de memoria |
| **Client Supabase + RLS** | `lib/supabaseClient.ts` | Aislamiento seguro de datos por usuario |
| **Encriptación AES-256-GCM** | `lib/encryption.ts` | Protección de datos sensibles en memoria |
| **Estructura user_credentials** | `migration.sql` | Patrón para almacenar tokens encriptados |

### ⚠️ LIMITACIONES A CONSIDERAR

1. **Sin timestamp de creación** - No hay `created_at` en document_chunks
2. **Sin metadata estructurada** - Solo source_type, necesita más contexto
3. **Sin relación user_id directa** - Depende de RLS, no tiene FK
4. **Sin score de relevancia histórica** - No aprende qué es útil
5. **Sin categorización** - Todos los chunks tienen igual "peso"
6. **Dimensión fija 768** - No es flexible para otros modelos de embedding

---

## 2. INTEGRACIONES EXISTENTES - ANÁLISIS DE FUENTES

### 2.1 Gmail (Sincronización e Ingesta)

#### Ubicación de Código
- **Servicio Principal**: `lib/gmailService.ts` (clase `GmailSyncService`)
- **Script CLI**: `scripts/ingest-gmail.ts`
- **Parser**: `lib/emailParser.ts`
- **Configuración**: `migration_14_gmail_sync_config_fixed.sql`

#### Flujo de Sincronización
```
1. Obtener credenciales OAuth (encriptadas en user_credentials)
2. Determinar sincronización: inicial (últimos 15 días) o incremental (via historyId)
3. Filtrar por labels, promociones, social, fecha
4. Parsear email: headers, body, attachments, metadata
5. Generar embedding con Gemini
6. Insertar en document_chunks (source_type='gmail')
7. Actualizar sync_status con último historyId
```

#### Tabla: `gmail_sync_config`
```sql
max_emails_per_sync INT DEFAULT 200
initial_sync_days INT DEFAULT 15
excluded_labels TEXT[]
exclude_promotions BOOLEAN DEFAULT true
exclude_social BOOLEAN DEFAULT true
process_attachments_names BOOLEAN DEFAULT true
max_email_content_length INT DEFAULT 50000
watch_enabled BOOLEAN DEFAULT false (para push notifications)
```

#### ✅ REUTILIZABLE PARA MEMORIA
- Patrón de sincronización incremental con tokens
- Parseo de múltiples formatos de contenido
- Tratamiento de archivos adjuntos
- Filtrado inteligente de ruido (promociones, social)

#### ⚠️ PROBLEMAS A RESOLVER
- Información de archivos adjuntos no se guarda en chunks
- Sin análisis de sentimiento de emails
- Sin extracción de acciones/tareas de correos
- Ausencia de deduplicación por hash

### 2.2 Google Calendar

#### Ubicación de Código
- **Acciones**: `lib/calendarActions.ts`
- **Tools de Gemini**: `lib/googleServices/calendarTools.ts`

#### Flujo Actual
- Solo crea eventos (create)
- No hay ingesta de eventos para RAG
- No se almacenan eventos en document_chunks

#### ✅ REUTILIZABLE
- OAuth flow con credenciales encriptadas
- Client de Google APIs configurado

#### ⚠️ GAPS CRÍTICOS
- **NO HAY INGESTA DE CALENDAR EN RAG** - Los eventos no se indexan para búsqueda
- No hay tabla para almacenar eventos con timestamps
- Sin análisis de patrones de tiempo/ocupación

### 2.3 Notion (Lectura y Escritura vía MCP)

#### Ubicación de Código
- **Cliente MCP**: `lib/orchestration/mcpNotionClient.ts`
- **Acciones Legacy**: `lib/notionActions.ts`
- **Script Ingesta**: `scripts/ingest-notion.ts`
- **Herramientas**: 15 tools nativos via MCP
- **Catálogo de Plantillas**: `migration_8.sql` + `seed_templates.sql`

#### Flujo de Sincronización
```
1. Obtener token Notion de user_credentials
2. Llamar API search con filtro last_edited_time
3. Extraer contenido de bloques (párrafos, títulos, listas, etc)
4. Generar embedding con Gemini
5. Actualizar documento en document_chunks
6. Actualizar marca de agua (sync_status)
```

#### MCP Integration
- Usa **StreamableHTTP** transport
- URL del wrapper MCP: `NOTION_MCP_WRAPPER_URL` (default localhost:3002)
- Disponibles 15 herramientas Notion vía MCP

#### ✅ REUTILIZABLE
- Patrón de sincronización con marca de agua
- Extracción de contenido de tipos de bloque diversos
- Sistema MCP como patrón para herramientas externas
- Cache de clientes MCP por usuario

#### ⚠️ PROBLEMAS
- Ingestión manual (no incremental)
- No hay almacenamiento de propiedades de bases de datos
- Sin extracción de relaciones entre páginas

---

## 3. ARQUITECTURA DE BASE DE DATOS SUPABASE

### 3.1 Tablas Principales

#### Core de Memoria
```
document_chunks
├─ id (BIGINT)
├─ document_id (TEXT) - ID de origen (page_id, email_id, etc)
├─ content (TEXT) - Contenido para indexar
├─ source_type (TEXT) - 'gmail', 'notion', 'calendar', 'browser'
└─ embedding (VECTOR(768)) - Gemini embeddings
```

**PROBLEMA**: Faltan campos críticos:
- `created_at` / `updated_at` - Para cronología
- `user_id` - Foreign key (actualmente depende de RLS)
- `metadata` (JSONB) - Contexto adicional
- `relevance_score` - Para autoaprendizaje

#### Sincronización
```
sync_status
├─ id (UUID)
├─ user_id (UUID) FK auth.users
├─ service_name (TEXT) - 'google', 'notion', 'calendar'
├─ last_sync_token (TEXT) - historyId, cursor, etc
├─ last_sync_at (TIMESTAMP)
├─ error_count (INT)
├─ last_error (TEXT)
└─ sync_config (JSONB) - Configuración por servicio
```

#### Configuración por Servicio
```
gmail_sync_config
├─ user_id (UUID) FK
├─ max_emails_per_sync (INT)
├─ initial_sync_days (INT)
├─ excluded_labels (TEXT[])
├─ exclude_promotions (BOOLEAN)
└─ watch_enabled (BOOLEAN)
```

#### Historial de Chat y Sesiones
```
chat_sessions
├─ id (UUID)
├─ user_id (UUID) FK
├─ messages (JSONB) - Array de mensajes
├─ session_start/end (TIMESTAMP)
└─ metadata (JSONB)

message_feedback
├─ id (UUID)
├─ user_id (UUID) FK
├─ message_id (UUID)
├─ rating (INT 1-5)
├─ feedback_text (TEXT)
└─ created_at (TIMESTAMP)
```

#### Preferencias y Contexto Personal
```
user_preferences
├─ user_id (UUID) FK
├─ daily_summary_enabled (BOOLEAN)
├─ summary_tone (TEXT) - 'professional', 'friendly'
├─ summary_length (TEXT) - 'brief', 'balanced', 'detailed'
├─ user_interests (TEXT[])
└─ [+20 columnas más para personalización]

user_context
├─ id (UUID)
├─ user_id (UUID) FK
├─ context_type (TEXT) - 'goal', 'project', 'habit', 'person'
├─ title (TEXT) - "Aprender React", "Proyecto X"
├─ keywords (TEXT[]) - Para búsqueda RAG
├─ status (TEXT) - 'active', 'completed'
└─ metadata (JSONB)
```

#### Resúmenes Diarios e Interactions
```
daily_summaries
├─ id (UUID)
├─ user_id (UUID) FK
├─ summary_text (TEXT)
├─ created_at (TIMESTAMP)
├─ metadata (JSONB)

summary_interactions
├─ id (UUID)
├─ user_id (UUID) FK
├─ summary_id (UUID) FK
├─ interaction_type (TEXT) - 'view', 'click_notion', 'click_gmail'
├─ target_id (TEXT) - Elemento clickeado
└─ created_at (TIMESTAMP)

summary_feedback
├─ id (UUID)
├─ user_id (UUID) FK
├─ summary_id (UUID) FK
├─ rating (INT 1-5)
├─ was_helpful (BOOLEAN)
└─ feedback_tags (TEXT[])
```

#### Plantillas y Onboarding
```
notion_template_catalog (público)
├─ template_pack_id (TEXT UNIQUE)
├─ template_structure (JSONB)
├─ default_rag_queries (JSONB)
└─ is_active (BOOLEAN)

user_notion_templates
├─ user_id (UUID) FK
├─ template_pack_id (TEXT) FK
├─ installed_notion_ids (JSONB)
├─ installation_status (TEXT)
└─ installation_completed_at (TIMESTAMP)

user_onboarding_status
├─ user_id (UUID) FK
├─ current_step (INT)
├─ completed_at (TIMESTAMP)
└─ notion_connected_during_onboarding (BOOLEAN)
```

#### Credenciales Encriptadas
```
user_credentials
├─ id (UUID)
├─ user_id (UUID) FK
├─ service_name (TEXT) - 'google', 'notion'
├─ encrypted_refresh_token (TEXT)
├─ iv (TEXT) - AES IV
└─ auth_tag (TEXT) - AES auth tag
```

### 3.2 RLS Policies (Row Level Security)

**Patrón General**:
```sql
-- Lectura: Solo datos del usuario
CREATE POLICY "Users can view own X" ON table_x
  FOR SELECT USING (auth.uid() = user_id);

-- Inserción: Solo datos propios
CREATE POLICY "Users can insert own X" ON table_x
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Service Role: Acceso total (para scripts/crons)
CREATE POLICY "Service role has full access" ON table_x
  FOR ALL USING (auth.role() = 'service_role');
```

---

## 4. SISTEMA DE ORQUESTACIÓN MULTI-MODELO

### 4.1 Arquitectura

```
POST /api/chat
    ↓
[1] executeRAG(userId, query)
    → Vectorizar query
    → match_document_chunks()
    → Retornar TOP 10 chunks
    ↓
[2] classifyTask(query, ragContext)
    → Gemini 2.0 Flash (rápido)
    → Detectar: SIMPLE | RAG | BROWSER | GMAIL | CALENDAR | GOOGLE_TASKS | GOOGLE_DRIVE | NOTION_MCP | COMPLEX
    ↓
[3] orchestrateModelExecution(context)
    → Validate task classification (anti-alucinación)
    → Select tools for task type
    → Delegate to appropriate executor
    ↓
[4a] executeGemini(model, context, taskType, tools)
     - Gemini Flash: tareas simples
     - Gemini Pro: RAG + Browser
     ↓
[4b] executeClaude(model, context, useMCP)
     - Claude Sonnet: NOTION_MCP + COMPLEX
     - Usa MCP para acceso a 15 herramientas Notion
     ↓
[5] Return ModelExecutionResult
    ├─ answer: string
    ├─ modelUsed: 'gemini:2.5-flash' | 'claude:sonnet-4'
    ├─ taskType: TaskType
    └─ executionTimeMs: number
```

### 4.2 Task Classification

**Ubicación**: `lib/orchestration/taskClassifier.ts`

**Keywords por Servicio**:
- GMAIL: 'correo', 'email', 'mensaje', 'enviar', 'buscar'
- CALENDAR: 'evento', 'reunión', 'agendar', 'programar'
- GOOGLE_TASKS: 'recordatorio', 'pendiente', 'to-do'
- GOOGLE_DRIVE: 'documento', 'crear documento', 'compartir'
- NOTION_MCP: 'notion', 'database', 'página'
- BROWSER: 'navega', 'busca en google', 'abre'

### 4.3 Model Config Mapping

```typescript
TASK_MODEL_MAPPING = {
  SIMPLE: { provider: 'gemini', model: 'gemini-2.5-flash' },
  RAG: { provider: 'gemini', model: 'gemini-2.5-pro' },
  BROWSER: { provider: 'gemini', model: 'gemini-2.5-pro' },
  GMAIL: { provider: 'gemini', model: 'gemini-2.5-flash' },
  CALENDAR: { provider: 'gemini', model: 'gemini-2.5-flash' },
  GOOGLE_TASKS: { provider: 'gemini', model: 'gemini-2.5-flash' },
  GOOGLE_DRIVE: { provider: 'gemini', model: 'gemini-2.5-flash' },
  NOTION_MCP: { provider: 'claude', model: 'claude-sonnet-4-20250514' },
  COMPLEX: { provider: 'claude', model: 'claude-sonnet-4-20250514' }
}
```

### ✅ COMPONENTES REUTILIZABLES

1. **Task Classifier Pattern** - Framework para detectar tipos de consulta
2. **Model Selection Logic** - Algoritmo de elección modelo óptimo
3. **Orchestrator Pattern** - Patrón para delegar a ejecutores especializados
4. **Type System** - TaskType, ExecutionContext, ModelExecutionResult

### ⚠️ LIMITACIONES PARA AUTOAPRENDIZAJE

- No hay feedback loop: el modelo NO aprende de clasificaciones erróneas
- No hay metrics de precisión por tipo de tarea
- Task weights son estáticos (no adaptativos)
- Sin A/B testing entre modelos

---

## 5. ENCRIPTACIÓN Y SEGURIDAD

### 5.1 Sistema AES-256-GCM

**Ubicación**: `lib/encryption.ts`

```typescript
ALGORITHM = 'aes-256-gcm'
IV_LENGTH = 16 bytes
AUTH_TAG_LENGTH = 16 bytes
KEY_LENGTH = 32 bytes (256 bits)
KEY_ENCODING = Base64 (from .env)

Format: "iv:authTag:encrypted"
```

#### Almacenamiento en BD
```sql
user_credentials:
├─ encrypted_refresh_token (TEXT) - El cifrado
├─ iv (TEXT) - Vector de inicialización
└─ auth_tag (TEXT) - Tag de autenticación
```

### ✅ REUTILIZABLE PARA MEMORIA
- Patrón de encriptación para datos sensibles
- Separación de componentes (iv, tag, ciphertext) para BD
- Lazy loading de claves para evitar errores en boot

### ⚠️ MEJORAS NECESARIAS
- **Sin rotación de claves** - Una sola clave ENCRYPTION_KEY
- **Sin versionado** - No se puede cambiar algoritmo sin migración
- **Sin auditoría** - No se registra quién descifra qué datos

---

## 6. SISTEMA DE FEEDBACK Y AUTOAPRENDIZAJE

### 6.1 Infraestructura Existente

#### Message Feedback (Para Chats)
```sql
message_feedback:
├─ user_id
├─ message_id (FK chat_sessions.id)
├─ rating (1-5)
├─ feedback_text
└─ created_at
```

#### Summary Feedback (Para Resúmenes Diarios)
```sql
summary_feedback:
├─ user_id
├─ summary_id (FK daily_summaries.id)
├─ rating (1-5)
├─ was_helpful (BOOLEAN)
├─ feedback_tags (TEXT[])
└─ created_at
```

#### Summary Interactions (Para Tracking)
```sql
summary_interactions:
├─ summary_id (FK daily_summaries.id)
├─ interaction_type ('view', 'click_notion', 'click_gmail')
├─ target_id (elemento clickeado)
├─ target_url
└─ metadata (JSONB)
```

### ✅ REUTILIZABLE
- Estructura de feedback por entidad
- Tipos de interacción para tracking
- Metadata flexible para análisis

### ⚠️ GAPS CRÍTICOS PARA AUTOAPRENDIZAJE
- **Sin scoring de relevancia RAG** - No sabe qué chunks fueron útiles
- **Sin update a vectores** - No reentrenan embeddings basados en feedback
- **Sin sistema de reinforcement** - No aprende a clasificar mejor
- **Sin clustering dinámico** - No agrupa conocimiento similar

---

## 7. COMPONENTES QUE NECESITAN MODIFICACIÓN

### 7.1 document_chunks Table

**MODIFICACIÓN URGENTE**:
```sql
ALTER TABLE document_chunks ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE document_chunks ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE document_chunks ADD COLUMN user_id UUID NOT NULL REFERENCES auth.users(id);
ALTER TABLE document_chunks ADD COLUMN metadata JSONB DEFAULT '{}';
ALTER TABLE document_chunks ADD COLUMN relevance_score FLOAT DEFAULT 0.5;
ALTER TABLE document_chunks ADD COLUMN access_count INT DEFAULT 0;
ALTER TABLE document_chunks ADD COLUMN last_accessed TIMESTAMP;
```

### 7.2 RAG Service

**MODIFICACIONES**:
- Agregar parámetro `relevance_weight` a match_document_chunks()
- Retornar `metadata` en resultados
- Implementar re-ranking basado en relevance_score
- Agregar decay temporal: chunks antiguos tienen menos peso

### 7.3 Google Services Integration

**GAPS**:
- **Calendar**: Implementar ingesta de eventos a document_chunks
- **Gmail**: Agregar extracción de acciones/tareas
- **Drive**: Sin integración actualmente

### 7.4 Task Classifier

**MEJORAR**:
- Agregar confidence score en clasificación
- Fallback a COMPLEX si confidence < 0.6
- Logging de clasificaciones para análisis

---

## 8. GAPS CRÍTICOS QUE NECESITAMOS LLENAR

### 8.1 Tabla de Aprendizaje de Usuario

```sql
CREATE TABLE IF NOT EXISTS user_learning_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Preferencias aprendidas
  preferred_response_length TEXT, -- 'short', 'medium', 'long'
  preferred_tone TEXT, -- Tono detectado
  preferred_model TEXT, -- Gemini vs Claude
  
  -- Patrones temporales
  peak_activity_hour INT, -- 0-23
  preferred_activity_days TEXT[], -- ['lunes', 'martes']
  
  -- Intereses personales
  top_topics TEXT[],
  skill_level TEXT, -- 'beginner', 'intermediate', 'expert'
  
  -- Estadísticas de aprendizaje
  total_interactions INT DEFAULT 0,
  feedback_count INT DEFAULT 0,
  avg_feedback_rating FLOAT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id)
);
```

### 8.2 Tabla de Eventos de Aprendizaje

```sql
CREATE TABLE IF NOT EXISTS learning_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  event_type TEXT, -- 'query', 'feedback', 'interaction', 'error'
  query_text TEXT,
  task_type_classified TEXT,
  model_used TEXT,
  
  -- Feedback
  rating INT,
  feedback_tags TEXT[],
  
  -- Performance
  execution_time_ms INT,
  success BOOLEAN,
  
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_learning_events_user_id ON learning_events(user_id);
CREATE INDEX idx_learning_events_type ON learning_events(event_type);
CREATE INDEX idx_learning_events_created ON learning_events(created_at DESC);
```

### 8.3 Tabla de Relaciones de Conocimiento

```sql
CREATE TABLE IF NOT EXISTS knowledge_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  source_chunk_id BIGINT REFERENCES document_chunks(id),
  target_chunk_id BIGINT REFERENCES document_chunks(id),
  
  relationship_type TEXT, -- 'related', 'similar', 'contradicts', 'refines'
  strength FLOAT, -- 0-1
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_knowledge_rel_source ON knowledge_relationships(source_chunk_id);
CREATE INDEX idx_knowledge_rel_user ON knowledge_relationships(user_id);
```

### 8.4 Tabla de Conceptos Personales

```sql
CREATE TABLE IF NOT EXISTS user_concepts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  concept_name TEXT NOT NULL,
  description TEXT,
  keywords TEXT[],
  related_chunk_ids BIGINT[],
  
  -- Métricas
  mention_count INT DEFAULT 0,
  last_mentioned TIMESTAMP,
  confidence_score FLOAT, -- Qué tan bien se entiende
  
  status TEXT DEFAULT 'active', -- 'active', 'archived', 'learning'
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id, concept_name)
);
```

### 8.5 Tabla de Patrones de Uso

```sql
CREATE TABLE IF NOT EXISTS usage_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  pattern_type TEXT, -- 'time_based', 'topic_based', 'tool_usage'
  pattern_data JSONB,
  
  -- Ejemplo time_based:
  -- {"hour": 9, "day_of_week": "lunes", "activity_count": 15}
  
  confidence FLOAT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 9. RECOMENDACIONES TÉCNICAS

### 9.1 Arquitectura de Memoria Personal Recomendada

```
┌─────────────────────────────────────────────────────────┐
│         SISTEMA DE MEMORIA PERSONAL CON IA             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │         1. CAPA DE INGESTA (Sources)            │  │
│  │  • Gmail (sincronización incremental)           │  │
│  │  • Calendar (eventos + patrones de tiempo)      │  │
│  │  • Notion (sincronización con marca de agua)    │  │
│  │  • Browser (contexto de navegación)             │  │
│  │  • Chat (historial conversacional)              │  │
│  └──────────────────────────────────────────────────┘  │
│                      ↓                                  │
│  ┌──────────────────────────────────────────────────┐  │
│  │     2. CAPA DE PROCESAMIENTO (ETL+Vectors)      │  │
│  │  • Parsing & normalización de formatos          │  │
│  │  • Chunking inteligente + metadata              │  │
│  │  • Generación de embeddings (Gemini 768d)       │  │
│  │  • Deduplicación por hash                       │  │
│  │  • Extracción de entidades & relaciones         │  │
│  └──────────────────────────────────────────────────┘  │
│                      ↓                                  │
│  ┌──────────────────────────────────────────────────┐  │
│  │    3. CAPA DE ALMACENAMIENTO (Vector DB)        │  │
│  │  • document_chunks (con metadata + scores)      │  │
│  │  • knowledge_relationships (grafo conceptual)    │  │
│  │  • user_concepts (ontología personal)           │  │
│  │  • usage_patterns (estadísticas)                │  │
│  └──────────────────────────────────────────────────┘  │
│                      ↓                                  │
│  ┌──────────────────────────────────────────────────┐  │
│  │     4. CAPA DE BÚSQUEDA Y RECUPERACIÓN          │  │
│  │  • Búsqueda por similitud (RAG mejorada)        │  │
│  │  • Búsqueda por concepto (knowledge graph)      │  │
│  │  • Re-ranking con relevance score               │  │
│  │  • Temporal decay (reciente > antiguo)          │  │
│  └──────────────────────────────────────────────────┘  │
│                      ↓                                  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  5. CAPA DE GENERACIÓN E INGESTA DE FEEDBACK    │  │
│  │  • Razonamiento con contexto RAG                │  │
│  │  • Feedback de relevancia (rating 1-5)          │  │
│  │  • Tracking de interacciones                    │  │
│  │  • Learning events log                          │  │
│  └──────────────────────────────────────────────────┘  │
│                      ↓                                  │
│  ┌──────────────────────────────────────────────────┐  │
│  │   6. CAPA DE APRENDIZAJE (Autoimprovement)      │  │
│  │  • Análisis de feedback → actualizar scores     │  │
│  │  • Detección de patrones de uso                 │  │
│  │  • Ajuste dinámico de clasificador de tareas    │  │
│  │  • Re-clustering de conceptos                   │  │
│  │  • Generación de recomendaciones                │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 9.2 Pipeline de Autoaprendizaje Recomendado

```python
# Pseudocódigo del loop de aprendizaje
async function autolearningLoop(userId):
    while True:
        # Fase 1: Recolectar feedback
        events = await fetchRecentLearningEvents(userId)
        
        if events:
            # Fase 2: Analizar patrones
            patterns = analyzeUsagePatterns(events)
            
            # Fase 3: Actualizar modelo de usuario
            await updateUserProfile(userId, patterns)
            
            # Fase 4: Ajustar pesos del RAG
            for chunk in documentChunks:
                if wasInteractedWith(chunk):
                    chunk.relevance_score += 0.1
                else if notSeenIn30days(chunk):
                    chunk.relevance_score *= 0.95  # Decay
            
            # Fase 5: Re-entrenar clasificador de tareas
            await retrainTaskClassifier(userId, events)
            
            # Fase 6: Generar insights
            insights = generatePersonalInsights(userId)
            await notifyUser(userId, insights)
        
        await sleep(1 hour)
```

### 9.3 Timeline de Implementación Recomendado

**FASE 1 (Semana 1-2): Mejorar RAG Existente**
- [ ] Agregar columnas a document_chunks (created_at, user_id, metadata)
- [ ] Mejorar match_document_chunks() con relevance_score
- [ ] Implementar decay temporal
- [ ] Crear tabla user_learning_profile

**FASE 2 (Semana 3-4): Integrar Todas las Fuentes**
- [ ] Implementar ingesta de Calendar
- [ ] Agregar extracción de acciones de Gmail
- [ ] Crear pipeline de normalización
- [ ] Implementar tabla learning_events

**FASE 3 (Semana 5-6): Knowledge Graph**
- [ ] Crear knowledge_relationships table
- [ ] Implementar detección automática de relaciones
- [ ] Crear user_concepts table
- [ ] Visualizar grafo conceptual

**FASE 4 (Semana 7-8): Autoaprendizaje**
- [ ] Implementar feedback loop
- [ ] Crear algoritmo de re-ranking
- [ ] Ajuste dinámico de task classifier
- [ ] Generación de recomendaciones personales

### 9.4 Estrategia de Chunking Mejorada

```typescript
interface ChunkMetadata {
  source_type: 'gmail' | 'notion' | 'calendar' | 'browser';
  source_id: string;
  created_at: Date;
  last_accessed?: Date;
  access_count: number;
  
  // Extracción automática
  entities?: string[]; // Personas, lugares, conceptos mencionados
  sentiment?: 'positive' | 'neutral' | 'negative';
  importance?: 0 | 1 | 2; // 0=reference, 1=important, 2=critical
  
  // Para Gmail
  email?: {
    from?: string;
    subject?: string;
    is_starred?: boolean;
  };
  
  // Para Notion
  notion?: {
    page_id?: string;
    database_name?: string;
    is_todo_list?: boolean;
  };
  
  // Para Calendar
  calendar?: {
    event_id?: string;
    start_time?: Date;
    duration_minutes?: number;
  };
  
  // Contexto personal
  user_context_ids?: string[]; // Linked user_context records
  concept_ids?: string[]; // Linked user_concepts
}
```

### 9.5 Mejoras de Seguridad

```sql
-- Tabla de auditoría de acceso a datos sensibles
CREATE TABLE data_access_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  accessed_table TEXT,
  accessed_record_id UUID,
  action TEXT, -- 'SELECT', 'UPDATE', 'DELETE'
  accessed_at TIMESTAMP DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

-- Rotation de claves de encriptación
CREATE TABLE encryption_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INT,
  key_hash TEXT UNIQUE, -- Para validar
  created_at TIMESTAMP,
  rotated_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);
```

### 9.6 Monitoreo y Métricas

```typescript
// Métricas a rastrear
interface SystemMetrics {
  // Performance
  avgRagLatencyMs: number;
  avgTaskClassificationMs: number;
  modelInvocationCount: Record<string, number>;
  
  // Quality
  taskClassificationAccuracy: number; // Basado en feedback
  avgFeedbackRating: number; // 1-5
  chunkRelevanceScore: number; // Average
  
  // Engagement
  dailyActiveUsers: number;
  avgSessionLength: number;
  interactionsPerUser: number;
  
  // Learning
  conceptsLearned: number;
  relationshipsDiscovered: number;
  patternsIdentified: number;
}
```

---

## 10. COMPONENTES LISTOS PARA COPIAR DIRECTAMENTE

### 10.1 Código Completo para Reutilizar

```typescript
// 1. Servicio RAG (copiar tal cual)
// lib/ragService.ts - Ya funciona

// 2. Encriptación
// lib/encryption.ts - AES-256-GCM listo para producción

// 3. Cliente Supabase
// lib/supabaseClient.ts - Patrón de cliente seguro

// 4. Email Parser
// lib/emailParser.ts - Extracción completa de datos

// 5. Task Classifier Pattern
// lib/orchestration/taskClassifier.ts - Lógica de routing

// 6. MCP Client Pattern
// lib/orchestration/mcpNotionClient.ts - Para herramientas externas

// 7. RLS Policies (copiar patrón)
// migration_*.sql - Políticas de aislamiento
```

### 10.2 Tablas para Crear Ya

```sql
-- Copiar tal cual:
-- migration.sql (document_chunks)
-- migration_6.sql (user_preferences)
-- migration_11_chat_sessions.sql
-- migration_13_sync_status_fixed.sql

-- Crear nuevas:
-- user_learning_profile (ver sección 8.1)
-- learning_events (ver sección 8.2)
-- knowledge_relationships (ver sección 8.3)
-- user_concepts (ver sección 8.4)
-- usage_patterns (ver sección 8.5)
```

---

## CONCLUSIONES

### ✅ FORTALEZAS DEL CODEBASE ACTUAL
1. **RAG bien implementado** - Búsqueda vectorial funcional
2. **Multi-model orchestration** - Sistema flexible de routing
3. **Encriptación robusta** - AES-256-GCM en producción
4. **Integraciones diversas** - Gmail, Notion, Calendar
5. **RLS policies** - Aislamiento de datos seguro

### ⚠️ GAPS CRÍTICOS PARA MEMORIA + AUTOAPRENDIZAJE
1. **Sin timestamp en chunks** - No hay cronología
2. **Sin feedback loop** - El sistema no aprende
3. **Sin knowledge graph** - No relaciona conceptos
4. **Sin ingesta de Calendar** - Falta fuente importante
5. **Sin modelo de usuario** - No personaliza

### 🎯 RECOMENDACIÓN FINAL

**Implementar en este orden**:
1. Migración de BD (agregar columnas a document_chunks)
2. Tabla user_learning_profile
3. Learning events logging
4. Feedback loop & re-ranking
5. Knowledge graph
6. Autoaprendizaje proactivo

**Esfuerzo estimado**: 4-6 semanas para MVP funcional
**Reutilización**: 70% del código existente
**ROI**: Sistema de memoria personal verdaderamente inteligente


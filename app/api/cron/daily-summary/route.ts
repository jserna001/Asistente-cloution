import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { google } from 'googleapis';
import { decryptToken } from '@/lib/tokenService';
import { getGoogleOAuthClient } from '@/lib/googleAuth';

/**
 * Cache global de embeddings para evitar regenerar embeddings de queries comunes.
 * Ahorro: Con 100 usuarios = 400+ embeddings evitados por día
 */
const embeddingCache = new Map<string, number[]>();

/**
 * Helper para obtener embedding con cache
 */
async function getCachedEmbedding(
  embeddingModel: any,
  text: string
): Promise<number[]> {
  const cacheKey = text.trim().toLowerCase();

  if (embeddingCache.has(cacheKey)) {
    console.log(`[CACHE] Hit para query: "${text.substring(0, 50)}..."`);
    return embeddingCache.get(cacheKey)!;
  }

  console.log(`[CACHE] Miss para query: "${text.substring(0, 50)}..."`);
  const result = await embeddingModel.embedContent(text);
  const embedding = result.embedding.values;

  // Limitar cache a 100 entradas para evitar memory leak
  if (embeddingCache.size >= 100) {
    const firstKey = embeddingCache.keys().next().value;
    embeddingCache.delete(firstKey);
  }

  embeddingCache.set(cacheKey, embedding);
  return embedding;
}

/**
 * Retry logic con backoff exponencial para APIs externas
 * @param fn - Función a ejecutar
 * @param retries - Número de reintentos (default: 3)
 * @param operation - Nombre de la operación para logging
 * @returns Resultado de la función o null si falla todos los intentos
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  operation: string = 'Operation'
): Promise<T | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isLastAttempt = attempt === retries;

      if (isLastAttempt) {
        console.error(`[RETRY] ${operation} falló después de ${retries} intentos:`, error.message);
        return null;
      }

      const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // max 5s
      console.warn(`[RETRY] ${operation} falló (intento ${attempt}/${retries}), reintentando en ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return null;
}

/**
 * Calcula el score de prioridad para un chunk basándose en:
 * - Proximidad temporal (fechas cercanas)
 * - Palabras clave de urgencia
 * - Similarity score del RAG
 */
function calculatePriorityScore(chunk: any): number {
  let score = chunk.similarity || 0; // Base: similarity del RAG (0-1)

  const content = chunk.content.toLowerCase();
  const now = new Date();

  // +3 puntos: Palabras clave de urgencia
  const urgencyKeywords = ['urgente', 'importante', 'asap', 'hoy', 'deadline', 'crítico', 'blocker'];
  const hasUrgency = urgencyKeywords.some(kw => content.includes(kw));
  if (hasUrgency) score += 3;

  // +5 puntos: Fechas de hoy o mañana
  const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  if (content.includes(todayStr) || content.includes('today') || content.includes('hoy')) {
    score += 5;
  } else if (content.includes(tomorrowStr) || content.includes('tomorrow') || content.includes('mañana')) {
    score += 3;
  }

  // +2 puntos: Status de alta prioridad
  const priorityStatuses = ['high', 'alta', 'urgent', 'crítica'];
  const hasPriorityStatus = priorityStatuses.some(status => content.includes(status));
  if (hasPriorityStatus) score += 2;

  // +1 punto: Menciones de números pequeños (días restantes)
  const daysMatch = content.match(/(\d+)\s*(días?|days?)\s*(restantes?|remaining|left)/i);
  if (daysMatch) {
    const daysLeft = parseInt(daysMatch[1]);
    if (daysLeft <= 3) score += 1;
  }

  return score;
}

/**
 * Trunca el contenido de un chunk si es demasiado largo
 * Máximo: 500 caracteres por chunk para optimizar tokens
 */
function truncateChunkContent(content: string, maxLength: number = 500): string {
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength) + '... [truncado]';
}

/**
 * Obtiene las queries RAG predeterminadas según la plantilla del usuario
 */
async function getTemplateQueries(
  supabase: any,
  templatePackId: string | null
): Promise<{ notion: string[]; gmail: string[]; calendar: string[] }> {
  // Si no tiene plantilla, usar queries por defecto
  if (!templatePackId) {
    return {
      notion: ["¿Cuáles son mis tareas pendientes?"],
      gmail: ["¿Hay algún correo urgente o importante?"],
      calendar: ["Eventos de hoy"]
    };
  }

  const { data: template, error } = await supabase
    .from('notion_template_catalog')
    .select('default_rag_queries')
    .eq('template_pack_id', templatePackId)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !template || !template.default_rag_queries) {
    console.warn(`[CRON] No se encontró plantilla ${templatePackId}, usando queries por defecto`);
    return {
      notion: ["¿Cuáles son mis tareas pendientes?"],
      gmail: ["¿Hay algún correo urgente o importante?"],
      calendar: ["Eventos de hoy"]
    };
  }

  return template.default_rag_queries;
}

/**
 * API endpoint para generar el resumen diario.
 * Puede ser llamado por:
 * 1. Cron jobs del sistema
 * 2. Vercel Cron Jobs
 * 3. GitHub Actions
 * 4. Servicios de cron externos (cron-job.org, etc.)
 *
 * IMPORTANTE: Este endpoint debe estar protegido con un token secreto
 * para evitar que personas no autorizadas lo ejecuten.
 */
export async function GET(request: Request) {
  try {
    // 1. Verificar el token de autorización
    // Aceptamos requests de:
    // - Vercel Cron (header x-vercel-cron)
    // - Servicios externos con Bearer token (CRON_SECRET)
    // - Usuario autenticado con Supabase token (para generar su propio resumen)
    const authHeader = request.headers.get('authorization');
    const vercelCronHeader = request.headers.get('x-vercel-cron');
    const cronSecret = process.env.CRON_SECRET;

    // Si viene de Vercel Cron, permitir sin token
    const isVercelCron = vercelCronHeader === '1';

    let supabase;
    let authenticatedUserId: string | null = null;

    // Si no es Vercel Cron, verificar autenticación
    if (!isVercelCron) {
      // Intentar autenticar como usuario de Supabase
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);

        // Verificar si es el CRON_SECRET o un token de Supabase
        if (token === cronSecret) {
          // Es un cron job externo, usar SERVICE_ROLE_KEY para bypasear RLS
          console.log('[CRON] Autenticado como cron job externo');
          supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );
        } else {
          // Es un usuario individual, verificar su token
          const tempClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
          );

          const { data: { user }, error: authError } = await tempClient.auth.getUser(token);

          if (authError || !user) {
            return NextResponse.json(
              { error: 'No autorizado - token inválido' },
              { status: 401 }
            );
          }

          // Usuario autenticado - usar SERVICE_ROLE_KEY para bypasear RLS
          // (Ya verificamos la identidad del usuario con getUser, es seguro)
          authenticatedUserId = user.id;
          console.log(`[CRON] Usuario autenticado: ${authenticatedUserId}`);

          // Usar SERVICE_ROLE_KEY para evitar problemas con RLS
          supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );
        }
      } else {
        return NextResponse.json(
          { error: 'No autorizado - falta token' },
          { status: 401 }
        );
      }
    } else {
      // Vercel Cron - usar SERVICE_ROLE_KEY para bypasear RLS
      console.log('[CRON] Autenticado como Vercel Cron');
      supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const chatModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    interface UserPreferences {
      user_id: string;
      daily_summary_time: string;
      timezone: string;
      selected_template_pack?: string | null;
      notion_database_ids?: string[] | null;
      notion_task_statuses?: string[] | null;
      gmail_priority_senders?: string[] | null;
      gmail_keywords?: string[] | null;
      summary_length?: string | null;
      summary_tone?: string | null;
      use_emojis?: boolean | null;
      group_by_category?: boolean | null;
      include_action_items?: boolean | null;
      include_calendar?: boolean | null;
      include_notion?: boolean | null;
      include_gmail?: boolean | null;
    }

    let usersToProcess: UserPreferences[] = [];

    // 3. Determinar qué usuarios procesar
    if (authenticatedUserId) {
      // Usuario individual autenticado - solo procesar su resumen
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

      if (prefError) {
        return NextResponse.json({
          error: 'Error consultando preferencias',
          details: prefError.message
        }, { status: 500 });
      }

      if (!userPref) {
        return NextResponse.json({
          error: 'Resumen diario no está habilitado para este usuario',
          details: 'No se encontró configuración o daily_summary_enabled es false'
        }, { status: 400 });
      }

      usersToProcess = [userPref];
      console.log(`[CRON] Procesando resumen para usuario individual: ${authenticatedUserId}`);
    } else {
      // Cron automático - procesar todos los usuarios que necesitan resumen
      const { data: userPrefs, error: prefsError } = await supabase
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
        .eq('daily_summary_enabled', true);

      if (prefsError) {
        throw new Error(`Error obteniendo preferencias de usuarios: ${prefsError.message}`);
      }

      if (!userPrefs || userPrefs.length === 0) {
        console.log('[CRON] No hay usuarios con resumen diario habilitado');
        return NextResponse.json({
          success: true,
          message: 'No hay usuarios con resumen diario habilitado',
          processedUsers: 0
        });
      }

      console.log(`[CRON] Encontrados ${userPrefs.length} usuarios con resumen habilitado`);

      // 4. Filtrar usuarios cuya hora configurada coincida con la hora actual
      const now = new Date();

      usersToProcess = userPrefs.filter(pref => {
        // Convertir la hora configurada del usuario a UTC
        const [hours, minutes] = pref.daily_summary_time.split(':').map(Number);

        // Crear fecha en la zona horaria del usuario
        const userTime = new Date(now.toLocaleString('en-US', { timeZone: pref.timezone }));
        const userHour = userTime.getHours();
        const userMinute = userTime.getMinutes();

        // Verificar si la hora actual del usuario coincide con su hora configurada
        // (con margen de ±30 minutos para evitar pérdidas si el cron se ejecuta con retraso)
        const configuredMinutes = hours * 60 + minutes;
        const currentUserMinutes = userHour * 60 + userMinute;
        const diff = Math.abs(configuredMinutes - currentUserMinutes);

        return diff <= 30;
      });

      console.log(`[CRON] ${usersToProcess.length} usuarios necesitan resumen en este momento`);

      if (usersToProcess.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'Ningún usuario necesita resumen en este momento',
          processedUsers: 0,
          totalUsers: userPrefs.length
        });
      }
    }

    // 5. Generar resumen para cada usuario
    const results = [];

    for (const userPref of usersToProcess) {
      const userId = userPref.user_id;
      console.log(`[CRON] Generando resumen para usuario: ${userId}`);

      try {
        // 5.0 Verificar si ya existe un resumen de HOY
        const checkDateStart = new Date();
        checkDateStart.setHours(0, 0, 0, 0);

        const { data: existingSummary, error: summaryCheckError } = await supabase
          .from('daily_summaries')
          .select('id, created_at')
          .eq('user_id', userId)
          .gte('created_at', checkDateStart.toISOString())
          .maybeSingle();

        if (!summaryCheckError && existingSummary) {
          console.log(`[CRON] [${userId}] ⏭️ Ya existe un resumen de hoy, saltando...`);
          results.push({
            userId,
            success: true,
            skipped: true,
            message: 'Resumen de hoy ya existe'
          });
          continue;
        }

        // 5.1 Obtener credenciales de Google
        const { data: creds, error: credsError } = await supabase
          .from('user_credentials')
          .select('encrypted_refresh_token, iv, auth_tag')
          .eq('user_id', userId)
          .eq('service_name', 'google')
          .maybeSingle();

        if (credsError) {
          throw new Error(`Error consultando credenciales: ${credsError.message}`);
        }

        if (!creds) {
          throw new Error('No se encontraron credenciales de Google para este usuario');
        }

        if (!creds.encrypted_refresh_token || !creds.iv || !creds.auth_tag) {
          throw new Error('Datos de token incompletos');
        }

        const refreshToken = await decryptToken(creds);
        const oauth2Client = getGoogleOAuthClient();
        oauth2Client.setCredentials({ refresh_token: refreshToken });

        // 5.2 Leer Google Calendar con retry
        console.log(`[CRON] [${userId}] Leyendo Google Calendar...`);
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        // Obtener rango de fechas para eventos de hoy
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const calendarResponse = await withRetry(
          () => calendar.events.list({
            calendarId: 'primary',
            timeMin: todayStart.toISOString(),
            timeMax: todayEnd.toISOString(),
            maxResults: 5,
            singleEvents: true,
            orderBy: 'startTime',
          }),
          3,
          `Calendar[${userId}]`
        );

        const calendarEvents = calendarResponse?.data?.items || [];
        const calendarContext = calendarEvents.map(event => {
          const start = event.start?.dateTime
            ? new Date(event.start.dateTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
            : 'Todo el día';
          return `${start} - ${event.summary}`;
        }).join('\n');

        // 5.3 Leer Tareas de Notion (RAG) - PERSONALIZADO POR PLANTILLA
        console.log(`[CRON] [${userId}] Buscando información en Notion...`);

        // Obtener queries dinámicas según la plantilla del usuario
        const templateQueries = await getTemplateQueries(supabase, userPref.selected_template_pack || null);
        const notionQueries = templateQueries.notion;

        console.log(`[CRON] [${userId}] Plantilla: ${userPref.selected_template_pack || 'ninguna'}`);
        console.log(`[CRON] [${userId}] Queries de Notion:`, notionQueries);

        // Ejecutar múltiples queries y combinar resultados con retry
        const notionChunksArrays = await Promise.all(
          notionQueries.map(async (query) => {
            const embedding = await getCachedEmbedding(embeddingModel, query);

            const result = await withRetry(
              () => supabase.rpc('match_document_chunks', {
                query_embedding: embedding,
                match_threshold: 0.75, // Aumentado de 0.6 para mayor relevancia
                match_count: 2, // Reducido de 3 para optimizar context
                p_source_type: 'notion',
                p_user_id: userId
              }),
              3,
              `Notion RAG[${userId}] - "${query.substring(0, 30)}"`
            );

            if (!result || result.error) {
              console.error(`[CRON] [${userId}] Error en query "${query}":`, result?.error?.message || 'Failed after retries');
              return [];
            }

            return result.data || [];
          })
        );

        // Combinar y deduplicar chunks (por si dos queries retornan el mismo)
        const notionChunksMap = new Map();
        notionChunksArrays.flat().forEach(chunk => {
          if (!notionChunksMap.has(chunk.id)) {
            notionChunksMap.set(chunk.id, chunk);
          }
        });

        // Priorizar chunks por urgencia y relevancia
        const notionChunks = Array.from(notionChunksMap.values())
          .map(chunk => ({
            ...chunk,
            priorityScore: calculatePriorityScore(chunk)
          }))
          .sort((a, b) => b.priorityScore - a.priorityScore); // Mayor prioridad primero

        // Truncar chunks largos para optimizar context window
        const notionContext = notionChunks
          .map((c: any) => truncateChunkContent(c.content))
          .join('\n---\n') || null;

        console.log(`[CRON] [${userId}] Encontrados ${notionChunks.length} chunks relevantes en Notion (ordenados por prioridad)`);

        // 5.4 Leer Correos de Gmail (RAG) - PERSONALIZADO
        console.log(`[CRON] [${userId}] Buscando correos importantes...`);

        // Construir query dinámica basada en preferencias del usuario
        let gmailQuery = templateQueries.gmail[0] || "¿Hay algún correo urgente o importante?";

        // Agregar contexto de remitentes prioritarios
        if (userPref.gmail_priority_senders && userPref.gmail_priority_senders.length > 0) {
          const senders = userPref.gmail_priority_senders.slice(0, 3).join(', ');
          gmailQuery += ` Especialmente de: ${senders}.`;
        }

        // Agregar keywords
        if (userPref.gmail_keywords && userPref.gmail_keywords.length > 0) {
          const keywords = userPref.gmail_keywords.slice(0, 5).join(', ');
          gmailQuery += ` Busca palabras clave: ${keywords}.`;
        }

        console.log(`[CRON] [${userId}] Query de Gmail personalizada: "${gmailQuery}"`);

        const gmailQueryEmbedding = await getCachedEmbedding(embeddingModel, gmailQuery);

        const gmailResult = await withRetry(
          () => supabase.rpc('match_document_chunks', {
            query_embedding: gmailQueryEmbedding,
            match_threshold: 0.75, // Aumentado de 0.7 para mayor relevancia
            match_count: 2, // Reducido de 3 para optimizar context
            p_source_type: 'gmail',
            p_user_id: userId
          }),
          3,
          `Gmail RAG[${userId}]`
        );

        const gmailChunksRaw = gmailResult?.data || [];

        // Priorizar correos por urgencia
        const gmailChunks = gmailChunksRaw
          .map((chunk: any) => ({
            ...chunk,
            priorityScore: calculatePriorityScore(chunk)
          }))
          .sort((a: any, b: any) => b.priorityScore - a.priorityScore);

        // Truncar correos largos para optimizar context window
        const gmailContext = gmailChunks?.map((c: any) => truncateChunkContent(c.content)).join('\n---\n') || null;

        // 5.5 Generar resumen con Gemini - PERSONALIZADO
        console.log(`[CRON] [${userId}] Generando resumen con Gemini...`);

        // Mapeos de configuraciones a instrucciones
        const lengthInstructions: Record<string, string> = {
          brief: "Resume en 2-3 puntos clave máximo, ultra conciso",
          balanced: "Resume en 4-6 puntos clave, equilibrando detalle y brevedad",
          detailed: "Detalla 8-10 puntos importantes con contexto adicional"
        };

        const toneInstructions: Record<string, string> = {
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

        // Mensaje por defecto si no hay nada
        const emptyMessage = summaryTone === 'motivational'
          ? '¡Todo tranquilo por hoy! Es un gran día para avanzar en tus objetivos personales.'
          : summaryTone === 'professional'
            ? 'No hay elementos críticos programados para hoy.'
            : 'Todo tranquilo por hoy, ¡que tengas un gran día!';

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
${includeActionItems ? '- INCLUYE una sección final "Action Items" o "Para Hoy" con tareas específicas para hoy' : ''}

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

Tu tarea: Genera el resumen matutino siguiendo EXACTAMENTE las instrucciones de formato arriba. Si no hay información importante, simplemente di "${emptyMessage}".`;

        console.log(`[CRON] [${userId}] Config: ${summaryLength} / ${summaryTone} / ${useEmojis ? 'con' : 'sin'} emojis`);

        const result = await chatModel.generateContent(systemPrompt);
        const summaryText = result.response.text();

        // 5.6 Guardar resumen en Supabase
        console.log(`[CRON] [${userId}] Guardando resumen en Supabase...`);
        const { error: insertError } = await supabase
          .from('daily_summaries')
          .insert({
            user_id: userId,
            summary_text: summaryText
          });

        if (insertError) {
          throw new Error(`Error guardando resumen: ${insertError.message}`);
        }

        console.log(`[CRON] [${userId}] ✓ Resumen generado y guardado exitosamente`);
        console.log(`[CRON] [${userId}] Plantilla: ${userPref.selected_template_pack || 'ninguna'}`);
        console.log(`[CRON] [${userId}] Configuración: ${summaryLength} / ${summaryTone} / ${useEmojis ? 'con' : 'sin'} emojis`);

        results.push({
          userId,
          success: true,
          config: {
            template: userPref.selected_template_pack || null,
            length: summaryLength,
            tone: summaryTone,
            emojis: useEmojis,
            groupByCategory,
            includeActionItems
          },
          stats: {
            calendarEvents: calendarEvents.length,
            notionChunks: notionChunks.length,
            gmailChunks: gmailChunks?.length || 0,
            notionQueries: notionQueries.length
          }
        });

      } catch (error: any) {
        console.error(`[CRON] [${userId}] ✗ Error generando resumen:`, error.message);
        results.push({
          userId,
          success: false,
          error: error.message
        });
      }
    }

    // 6. Retornar resultados consolidados
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`[CRON] ✓ Proceso completado: ${successCount} éxitos, ${failureCount} fallos`);

    return NextResponse.json({
      success: true,
      message: `Resúmenes procesados: ${successCount}/${results.length} exitosos`,
      processedUsers: results.length,
      successCount,
      failureCount,
      results
    });

  } catch (error: any) {
    console.error('[CRON] Error generando resumen diario:', error);
    return NextResponse.json(
      {
        error: 'Error interno del servidor',
        details: error.message
      },
      { status: 500 }
    );
  }
}

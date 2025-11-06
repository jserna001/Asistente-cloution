import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { google } from 'googleapis';
import { decryptToken } from '@/lib/tokenService';
import { getGoogleOAuthClient } from '@/lib/googleAuth';

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

    let usersToProcess: Array<{ user_id: string; daily_summary_time: string; timezone: string }> = [];

    // 3. Determinar qué usuarios procesar
    if (authenticatedUserId) {
      // Usuario individual autenticado - solo procesar su resumen
      const { data: userPref, error: prefError } = await supabase
        .from('user_preferences')
        .select('user_id, daily_summary_time, timezone')
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
        .select('user_id, daily_summary_time, timezone')
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

        // 5.2 Leer Google Calendar
        console.log(`[CRON] [${userId}] Leyendo Google Calendar...`);
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        // Obtener rango de fechas para eventos de hoy
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const calendarResponse = await calendar.events.list({
          calendarId: 'primary',
          timeMin: todayStart.toISOString(),
          timeMax: todayEnd.toISOString(),
          maxResults: 5,
          singleEvents: true,
          orderBy: 'startTime',
        });

        const calendarEvents = calendarResponse.data.items || [];
        const calendarContext = calendarEvents.map(event => {
          const start = event.start?.dateTime
            ? new Date(event.start.dateTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
            : 'Todo el día';
          return `${start} - ${event.summary}`;
        }).join('\n');

        // 5.3 Leer Tareas de Notion (RAG)
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

        if (notionError) throw new Error(`Error buscando en Notion: ${notionError.message}`);
        const notionContext = notionChunks?.map((c: any) => c.content).join('\n---\n') || null;

        // 5.4 Leer Correos de Gmail (RAG)
        console.log(`[CRON] [${userId}] Buscando correos importantes...`);
        const gmailQueryEmbedding = await embeddingModel.embedContent(
          "¿Hay algún correo urgente o importante que necesite mi atención?"
        );

        const { data: gmailChunks, error: gmailError } = await supabase.rpc('match_document_chunks', {
          query_embedding: gmailQueryEmbedding.embedding.values,
          match_threshold: 0.7,
          match_count: 3,
          p_source_type: 'gmail',
          p_user_id: userId
        });

        if (gmailError) throw new Error(`Error buscando en Gmail: ${gmailError.message}`);
        const gmailContext = gmailChunks?.map((c: any) => c.content).join('\n---\n') || null;

        // 5.5 Generar resumen con Gemini
        console.log(`[CRON] [${userId}] Generando resumen con Gemini...`);
        const systemPrompt = `Eres mi asistente personal. Hoy es ${new Date().toLocaleDateString('es-ES', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}. Aquí está mi información del día.

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

Tu tarea: Escribe un resumen matutino conciso y amigable (máximo 3-5 puntos clave) de lo que necesito saber hoy. Sé directo, prioriza lo más importante y agrupa la información por tema (ej. "Reuniones", "Tareas Urgentes"). Si no hay nada destacable, simplemente di "Todo tranquilo por hoy, ¡que tengas un gran día!".`;

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

        results.push({
          userId,
          success: true,
          stats: {
            calendarEvents: calendarEvents.length,
            notionChunks: notionChunks?.length || 0,
            gmailChunks: gmailChunks?.length || 0,
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

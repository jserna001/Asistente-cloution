import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decryptToken } from '@/lib/tokenService';
import { google } from 'googleapis';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * FASE 7: Endpoint de cron para sincronización automática de Gmail
 *
 * Este endpoint debe ser llamado periódicamente (ej: cada 6 horas) por:
 * - Vercel Cron (vercel.json)
 * - GitHub Actions
 * - O cualquier servicio de cron externo
 *
 * Ruta: GET /api/cron/ingest-gmail
 * Headers: Authorization: Bearer <CRON_SECRET>
 */

/**
 * Extrae el cuerpo completo del correo desde el payload de Gmail
 */
function extractFullBody(payload: any): string {
  try {
    if (payload.body?.data) {
      const decoded = Buffer.from(payload.body.data, 'base64').toString('utf-8');
      return decoded;
    }

    if (payload.parts && Array.isArray(payload.parts)) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          const decoded = Buffer.from(part.body.data, 'base64').toString('utf-8');
          return decoded;
        }
      }

      for (const part of payload.parts) {
        if (part.mimeType === 'text/html' && part.body?.data) {
          const decoded = Buffer.from(part.body.data, 'base64').toString('utf-8');
          return decoded.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
        }
      }

      for (const part of payload.parts) {
        if (part.parts) {
          const nestedBody = extractFullBody(part);
          if (nestedBody) return nestedBody;
        }
      }
    }

    return '';
  } catch (error) {
    console.error('Error extrayendo cuerpo del correo:', error);
    return '';
  }
}

/**
 * Detecta la categoría del correo basado en labels de Gmail
 */
function detectCategory(labels: string[] | undefined): string {
  if (!labels) return 'unknown';

  if (labels.includes('CATEGORY_PERSONAL')) return 'personal';
  if (labels.includes('CATEGORY_SOCIAL')) return 'social';
  if (labels.includes('CATEGORY_PROMOTIONS')) return 'promotions';
  if (labels.includes('CATEGORY_UPDATES')) return 'updates';
  if (labels.includes('CATEGORY_FORUMS')) return 'forums';
  if (labels.includes('INBOX')) return 'personal';

  return 'unknown';
}

/**
 * Procesa correos de Gmail para un usuario específico
 */
async function ingestGmailForUser(
  userId: string,
  supabase: any,
  genAI: GoogleGenerativeAI,
  oauth2Client: any
): Promise<{ processed: number; skipped: number; error?: string }> {
  try {
    console.log(`[INGEST] Procesando usuario: ${userId}`);

    // Obtener y desencriptar credenciales de Google
    const { data: creds, error: credsError } = await supabase
      .from('user_credentials')
      .select('encrypted_refresh_token, iv, auth_tag')
      .eq('user_id', userId)
      .eq('service_name', 'google')
      .maybeSingle();

    if (credsError || !creds) {
      console.warn(`[INGEST] Usuario ${userId} no tiene credenciales de Google`);
      return { processed: 0, skipped: 0, error: 'No Google credentials' };
    }

    const decryptedToken = await decryptToken(creds as any);
    oauth2Client.setCredentials({ refresh_token: decryptedToken });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Obtener último historyId sincronizado
    const { data: syncStatus } = await supabase
      .from('sync_status')
      .select('last_sync_token')
      .eq('user_id', userId)
      .eq('service_name', 'google')
      .maybeSingle();

    let currentStartHistoryId = syncStatus?.last_sync_token || null;

    // Primera sincronización: obtener historyId actual
    if (!currentStartHistoryId) {
      const profile = await gmail.users.getProfile({ userId: 'me' });
      currentStartHistoryId = profile.data.historyId || null;
      if (!currentStartHistoryId) {
        return { processed: 0, skipped: 0, error: 'No history ID available' };
      }
    }

    // Obtener cambios desde última sincronización
    const historyResponse = await gmail.users.history.list({
      userId: 'me',
      startHistoryId: currentStartHistoryId,
      historyTypes: ['messageAdded'],
    });

    const newHistoryId = historyResponse.data.historyId;
    if (!newHistoryId) {
      return { processed: 0, skipped: 0 };
    }

    const messagesAdded = historyResponse.data.history?.flatMap(h => h.messagesAdded || []) || [];

    if (messagesAdded.length === 0) {
      // Actualizar historyId aunque no haya mensajes nuevos
      await supabase.from('sync_status').upsert({
        user_id: userId,
        service_name: 'google',
        last_sync_token: newHistoryId,
      }, { onConflict: 'user_id, service_name' });

      return { processed: 0, skipped: 0 };
    }

    let processedCount = 0;
    let skippedCount = 0;

    // Procesar cada correo nuevo
    for (const added of messagesAdded) {
      if (!added.message?.id) continue;

      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: added.message.id,
        format: 'full'
      });

      const labels = msg.data.labelIds || [];
      const isUnread = labels.includes('UNREAD');
      const isInInbox = labels.includes('INBOX');
      const isSpam = labels.includes('SPAM');
      const isTrash = labels.includes('TRASH');

      // Solo procesar correos no leídos en INBOX
      if (!isUnread || !isInInbox || isSpam || isTrash) {
        skippedCount++;
        continue;
      }

      // Extraer headers
      const headers = msg.data.payload?.headers || [];
      const subjectHeader = headers.find(h => h.name === 'Subject');
      const fromHeader = headers.find(h => h.name === 'From');
      const dateHeader = headers.find(h => h.name === 'Date');

      const subject = subjectHeader?.value || 'Sin Asunto';
      const fromEmail = fromHeader?.value || 'desconocido';
      const dateReceived = dateHeader?.value || new Date().toISOString();

      // Extraer cuerpo completo
      const fullBody = extractFullBody(msg.data.payload);
      const snippet = msg.data.snippet || '';
      const bodyText = fullBody || snippet;
      const truncatedBody = bodyText.slice(0, 2000);
      const textContent = `Asunto: ${subject}\n\nDe: ${fromEmail}\n\n${truncatedBody}`;

      // Detectar categoría
      const category = detectCategory(labels);

      // Construir metadata
      const metadata = {
        category: category,
        is_unread: isUnread,
        thread_id: msg.data.threadId || msg.data.id,
        from: fromEmail,
        date: dateReceived,
        labels: labels,
        has_full_body: !!fullBody,
        body_length: bodyText.length
      };

      // Generar embedding
      const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
      const embeddingResult = await model.embedContent(textContent);
      const embedding = embeddingResult.embedding.values;

      // Guardar en la base de datos
      const { error: insertError } = await supabase.from('document_chunks').insert({
        user_id: userId,
        source_type: 'gmail',
        source_id: msg.data.id!,
        content: textContent,
        embedding: embedding,
        metadata: metadata
      });

      if (insertError) {
        console.error(`[INGEST] Error guardando correo para ${userId}:`, insertError.message);
      } else {
        processedCount++;
      }
    }

    // Actualizar historyId
    await supabase.from('sync_status').upsert({
      user_id: userId,
      service_name: 'google',
      last_sync_token: newHistoryId,
    }, { onConflict: 'user_id, service_name' });

    return { processed: processedCount, skipped: skippedCount };

  } catch (error: any) {
    console.error(`[INGEST] Error procesando usuario ${userId}:`, error.message);
    return { processed: 0, skipped: 0, error: error.message };
  }
}

/**
 * GET /api/cron/ingest-gmail
 * Endpoint de cron para sincronización automática de Gmail
 */
export async function GET(req: Request) {
  try {
    // Verificar autenticación de cron (secret)
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[INGEST] Iniciando sincronización automática de Gmail...');

    // Inicializar clientes
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const googleClientId = process.env.GOOGLE_CLIENT_ID!;
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET!;
    const geminiApiKey = process.env.GEMINI_API_KEY!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const oauth2Client = new google.auth.OAuth2(googleClientId, googleClientSecret);

    // Obtener usuarios con Gmail conectado
    const { data: users, error: usersError } = await supabase
      .from('user_credentials')
      .select('user_id')
      .eq('service_name', 'google');

    if (usersError || !users || users.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No users with Gmail connected',
        processedUsers: 0
      });
    }

    console.log(`[INGEST] Encontrados ${users.length} usuarios con Gmail conectado`);

    // Procesar cada usuario
    const results = [];
    for (const user of users) {
      const result = await ingestGmailForUser(
        user.user_id,
        supabase,
        genAI,
        oauth2Client
      );
      results.push({
        userId: user.user_id,
        ...result
      });
    }

    const totalProcessed = results.reduce((sum, r) => sum + r.processed, 0);
    const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);
    const totalErrors = results.filter(r => r.error).length;

    console.log(`[INGEST] ✅ Sincronización completada:`);
    console.log(`   - Usuarios: ${users.length}`);
    console.log(`   - Correos procesados: ${totalProcessed}`);
    console.log(`   - Correos saltados: ${totalSkipped}`);
    console.log(`   - Errores: ${totalErrors}`);

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers: users.length,
        emailsProcessed: totalProcessed,
        emailsSkipped: totalSkipped,
        errors: totalErrors
      },
      results: results
    });

  } catch (error: any) {
    console.error('[INGEST] Error en sincronización automática:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error.message
      },
      { status: 500 }
    );
  }
}

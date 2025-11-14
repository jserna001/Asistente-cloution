/**
 * Servicio de Ingesta de Datos para RAG
 *
 * Funciones reutilizables para ingerir datos de Gmail y Notion
 * en la tabla document_chunks para el sistema RAG.
 *
 * Usado por:
 * - scripts/generate-summary.ts (automático, antes del resumen diario)
 * - scripts/ingest-gmail.ts (manual, si es necesario)
 * - scripts/ingest-notion.ts (manual, si es necesario)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { decryptToken } from './tokenService';
import { google } from 'googleapis';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Client as NotionClient } from '@notionhq/client';

// =====================================================
// INGESTA DE GMAIL
// =====================================================

export async function ingestGmailData(
  userId: string,
  supabase?: SupabaseClient,
  geminiApiKey?: string
): Promise<{ success: boolean; emailsProcessed: number; error?: string }> {

  console.log(`[INGEST-GMAIL] Iniciando ingesta para usuario ${userId.substring(0, 8)}...`);

  try {
    // Usar cliente proporcionado o crear uno nuevo
    const supabaseClient = supabase || createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const apiKey = geminiApiKey || process.env.GEMINI_API_KEY!;
    const genAI = new GoogleGenerativeAI(apiKey);

    // 1. Obtener credenciales de Google del usuario
    const { data: creds, error: credsError } = await supabaseClient
      .from('user_credentials')
      .select('encrypted_refresh_token, iv, auth_tag')
      .eq('user_id', userId)
      .eq('service_name', 'google')
      .maybeSingle();

    if (credsError || !creds) {
      console.warn(`[INGEST-GMAIL] No se encontraron credenciales de Google para usuario ${userId.substring(0, 8)}`);
      return { success: false, emailsProcessed: 0, error: 'No Google credentials found' };
    }

    // 2. Desencriptar token y configurar OAuth
    const decryptedToken = await decryptToken(creds as any);
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!
    );
    oauth2Client.setCredentials({ refresh_token: decryptedToken });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // 3. Obtener último historyId sincronizado
    const { data: syncStatus } = await supabaseClient
      .from('sync_status')
      .select('last_sync_token')
      .eq('user_id', userId)
      .eq('service_name', 'google')
      .maybeSingle();

    let lastHistoryId = syncStatus?.last_sync_token || null;

    // Si es primera sincronización, obtener historyId actual
    if (!lastHistoryId) {
      console.log('[INGEST-GMAIL] Primera sincronización, obteniendo historyId inicial...');
      const profile = await gmail.users.getProfile({ userId: 'me' });
      lastHistoryId = profile.data.historyId || null;

      if (!lastHistoryId) {
        console.warn('[INGEST-GMAIL] No se pudo obtener historyId inicial');
        return { success: false, emailsProcessed: 0, error: 'Could not get initial historyId' };
      }
    }

    // 4. Buscar correos nuevos
    console.log(`[INGEST-GMAIL] Buscando correos nuevos desde historyId: ${lastHistoryId}`);
    const historyResponse = await gmail.users.history.list({
      userId: 'me',
      startHistoryId: lastHistoryId,
      historyTypes: ['messageAdded'],
    });

    const newHistoryId = historyResponse.data.historyId;
    if (!newHistoryId) {
      console.log('[INGEST-GMAIL] No hay nuevo historyId, sincronización completa');
      return { success: true, emailsProcessed: 0 };
    }

    const messagesAdded = historyResponse.data.history?.flatMap(h => h.messagesAdded || []) || [];

    if (messagesAdded.length === 0) {
      console.log('[INGEST-GMAIL] No hay correos nuevos');

      // Actualizar historyId aunque no haya correos nuevos
      await supabaseClient.from('sync_status').upsert({
        user_id: userId,
        service_name: 'google',
        last_sync_token: newHistoryId,
      }, { onConflict: 'user_id,service_name' });

      return { success: true, emailsProcessed: 0 };
    }

    console.log(`[INGEST-GMAIL] ${messagesAdded.length} correos nuevos encontrados, procesando...`);

    // 5. Procesar cada correo
    let processed = 0;
    const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

    for (const added of messagesAdded) {
      if (!added.message?.id) continue;

      try {
        const msg = await gmail.users.messages.get({ userId: 'me', id: added.message.id });

        const subjectHeader = msg.data.payload?.headers?.find(h => h.name === 'Subject');
        const fromHeader = msg.data.payload?.headers?.find(h => h.name === 'From');
        const dateHeader = msg.data.payload?.headers?.find(h => h.name === 'Date');

        const subject = subjectHeader?.value || 'Sin Asunto';
        const from = fromHeader?.value || 'Desconocido';
        const date = dateHeader?.value || '';
        const snippet = msg.data.snippet || '';

        const textContent = `De: ${from}\nFecha: ${date}\nAsunto: ${subject}\n\n${snippet}`;

        // Generar embedding
        const embeddingResult = await embeddingModel.embedContent(textContent);
        const embedding = embeddingResult.embedding.values;

        // Guardar en BD
        const { error: insertError } = await supabaseClient.from('document_chunks').insert({
          user_id: userId,
          source: 'gmail',
          source_id: msg.data.id!,
          content: textContent,
          embedding: embedding,
        });

        if (insertError) {
          console.error(`[INGEST-GMAIL] Error guardando correo [${subject}]:`, insertError.message);
        } else {
          processed++;
          console.log(`[INGEST-GMAIL] ✓ Correo procesado [${subject.substring(0, 50)}...]`);
        }

      } catch (emailError: any) {
        console.error(`[INGEST-GMAIL] Error procesando correo:`, emailError.message);
        continue;
      }
    }

    // 6. Actualizar historyId
    await supabaseClient.from('sync_status').upsert({
      user_id: userId,
      service_name: 'google',
      last_sync_token: newHistoryId,
    }, { onConflict: 'user_id,service_name' });

    console.log(`[INGEST-GMAIL] ✓ Completado: ${processed}/${messagesAdded.length} correos procesados`);

    return { success: true, emailsProcessed: processed };

  } catch (error: any) {
    console.error('[INGEST-GMAIL] Error en ingesta:', error.message);
    return { success: false, emailsProcessed: 0, error: error.message };
  }
}

// =====================================================
// INGESTA DE NOTION
// =====================================================

export async function ingestNotionData(
  userId: string,
  supabase?: SupabaseClient,
  geminiApiKey?: string
): Promise<{ success: boolean; pagesProcessed: number; error?: string }> {

  console.log(`[INGEST-NOTION] Iniciando ingesta para usuario ${userId.substring(0, 8)}...`);

  try {
    // Usar cliente proporcionado o crear uno nuevo
    const supabaseClient = supabase || createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const apiKey = geminiApiKey || process.env.GEMINI_API_KEY!;
    const genAI = new GoogleGenerativeAI(apiKey);

    // 1. Obtener credenciales de Notion del usuario
    const { data: creds, error: credsError } = await supabaseClient
      .from('user_credentials')
      .select('encrypted_refresh_token, iv, auth_tag')
      .eq('user_id', userId)
      .eq('service_name', 'notion')
      .maybeSingle();

    if (credsError || !creds) {
      console.warn(`[INGEST-NOTION] No se encontraron credenciales de Notion para usuario ${userId.substring(0, 8)}`);
      return { success: false, pagesProcessed: 0, error: 'No Notion credentials found' };
    }

    // 2. Desencriptar token y configurar cliente de Notion
    const notionToken = await decryptToken(creds as any);
    const notion = new NotionClient({ auth: notionToken });

    // 3. Buscar databases del usuario
    console.log('[INGEST-NOTION] Buscando databases...');
    const searchResponse = await notion.search({
      filter: { property: 'object', value: 'database' },
      page_size: 20,
    });

    if (!searchResponse.results || searchResponse.results.length === 0) {
      console.log('[INGEST-NOTION] No se encontraron databases');
      return { success: true, pagesProcessed: 0 };
    }

    console.log(`[INGEST-NOTION] ${searchResponse.results.length} databases encontradas`);

    let processed = 0;
    const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

    // 4. Procesar cada database
    for (const db of searchResponse.results) {
      if (db.object !== 'database') continue;

      try {
        const database = db as any;
        const dbTitle = database.title?.[0]?.plain_text || 'Untitled Database';

        // Consultar páginas de la database
        const pagesResponse = await notion.databases.query({
          database_id: database.id,
          page_size: 50,
        });

        console.log(`[INGEST-NOTION] Database [${dbTitle}]: ${pagesResponse.results.length} páginas`);

        // Procesar cada página
        for (const page of pagesResponse.results) {
          if (page.object !== 'page') continue;

          try {
            const pageData = page as any;

            // Extraer título de la página
            const titleProp = Object.values(pageData.properties).find(
              (prop: any) => prop.type === 'title'
            ) as any;
            const pageTitle = titleProp?.title?.[0]?.plain_text || 'Untitled';

            // Extraer otras propiedades relevantes
            let contentText = `Página: ${pageTitle}\nDatabase: ${dbTitle}\n\n`;

            for (const [propName, propValue] of Object.entries(pageData.properties)) {
              const prop = propValue as any;

              if (prop.type === 'rich_text' && prop.rich_text?.[0]?.plain_text) {
                contentText += `${propName}: ${prop.rich_text[0].plain_text}\n`;
              } else if (prop.type === 'select' && prop.select?.name) {
                contentText += `${propName}: ${prop.select.name}\n`;
              } else if (prop.type === 'multi_select' && prop.multi_select?.length > 0) {
                contentText += `${propName}: ${prop.multi_select.map((s: any) => s.name).join(', ')}\n`;
              } else if (prop.type === 'date' && prop.date?.start) {
                contentText += `${propName}: ${prop.date.start}\n`;
              }
            }

            // Generar embedding
            const embeddingResult = await embeddingModel.embedContent(contentText);
            const embedding = embeddingResult.embedding.values;

            // Guardar en BD
            const { error: insertError } = await supabaseClient.from('document_chunks').insert({
              user_id: userId,
              source: 'notion',
              source_id: pageData.id,
              content: contentText,
              embedding: embedding,
            });

            if (insertError) {
              // Si es error de duplicado (ya existe), ignorar
              if (insertError.message.includes('duplicate') || insertError.code === '23505') {
                console.log(`[INGEST-NOTION] ⏭ Página ya existe: [${pageTitle}]`);
              } else {
                console.error(`[INGEST-NOTION] Error guardando página [${pageTitle}]:`, insertError.message);
              }
            } else {
              processed++;
              console.log(`[INGEST-NOTION] ✓ Página procesada [${pageTitle}]`);
            }

          } catch (pageError: any) {
            console.error(`[INGEST-NOTION] Error procesando página:`, pageError.message);
            continue;
          }
        }

      } catch (dbError: any) {
        console.error(`[INGEST-NOTION] Error procesando database:`, dbError.message);
        continue;
      }
    }

    console.log(`[INGEST-NOTION] ✓ Completado: ${processed} páginas procesadas`);

    return { success: true, pagesProcessed: processed };

  } catch (error: any) {
    console.error('[INGEST-NOTION] Error en ingesta:', error.message);
    return { success: false, pagesProcessed: 0, error: error.message };
  }
}

// =====================================================
// INGESTA COMPLETA (Gmail + Notion)
// =====================================================

/**
 * Ejecuta ingesta completa de Gmail y Notion para un usuario
 * Útil para el script de resumen diario
 */
export async function ingestAllData(userId: string): Promise<{
  gmail: { success: boolean; emailsProcessed: number };
  notion: { success: boolean; pagesProcessed: number };
}> {
  console.log(`\n[INGEST] ========================================`);
  console.log(`[INGEST] Iniciando ingesta completa para usuario ${userId.substring(0, 8)}...`);
  console.log(`[INGEST] ========================================\n`);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Ejecutar ingestas en paralelo (más rápido)
  const [gmailResult, notionResult] = await Promise.all([
    ingestGmailData(userId, supabase),
    ingestNotionData(userId, supabase),
  ]);

  console.log(`\n[INGEST] ========================================`);
  console.log(`[INGEST] ✓ Ingesta completa terminada`);
  console.log(`[INGEST] Gmail: ${gmailResult.emailsProcessed} correos procesados`);
  console.log(`[INGEST] Notion: ${notionResult.pagesProcessed} páginas procesadas`);
  console.log(`[INGEST] ========================================\n`);

  return {
    gmail: {
      success: gmailResult.success,
      emailsProcessed: gmailResult.emailsProcessed
    },
    notion: {
      success: notionResult.success,
      pagesProcessed: notionResult.pagesProcessed
    },
  };
}

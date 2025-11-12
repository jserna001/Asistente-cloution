// Carga las variables de entorno desde .env.local ANTES de cualquier import
import { config } from 'dotenv';
config({ path: './.env.local' });

// Esperar a que dotenv se cargue completamente
if (!process.env.ENCRYPTION_KEY) {
  console.error('Error: ENCRYPTION_KEY no está definida. Asegúrate de que .env.local existe y tiene todas las variables.');
  process.exit(1);
}

import { createClient } from '@supabase/supabase-js';
import { decryptToken } from '../lib/tokenService';
import { google, Auth } from 'googleapis';
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- CONFIGURACIÓN ---
// TODO: Reemplaza este placeholder con el ID de usuario real para el que quieres ingestar correos.
const userId = '575a8929-81b3-4efa-ba4d-31b86b523c74';
// -------------------

/**
 * FASE 7: Mejoras Gmail RAG
 * - Extrae cuerpo completo (no solo snippet)
 * - Detecta metadata (category, is_unread, thread_id, from, date)
 * - Filtra solo correos no leídos en INBOX
 * - Agrupa por hilos de conversación
 */

/**
 * Extrae el cuerpo completo del correo desde el payload de Gmail
 */
function extractFullBody(payload: any): string {
  try {
    // Caso 1: Cuerpo directo en payload.body.data
    if (payload.body?.data) {
      const decoded = Buffer.from(payload.body.data, 'base64').toString('utf-8');
      return decoded;
    }

    // Caso 2: Multipart (buscar recursivamente)
    if (payload.parts && Array.isArray(payload.parts)) {
      for (const part of payload.parts) {
        // Priorizar text/plain sobre text/html
        if (part.mimeType === 'text/plain' && part.body?.data) {
          const decoded = Buffer.from(part.body.data, 'base64').toString('utf-8');
          return decoded;
        }
      }

      // Si no hay text/plain, buscar text/html
      for (const part of payload.parts) {
        if (part.mimeType === 'text/html' && part.body?.data) {
          const decoded = Buffer.from(part.body.data, 'base64').toString('utf-8');
          // Remover tags HTML básicos (muy simple, no perfecto)
          return decoded.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
        }
      }

      // Búsqueda recursiva en nested multiparts
      for (const part of payload.parts) {
        if (part.parts) {
          const nestedBody = extractFullBody(part);
          if (nestedBody) return nestedBody;
        }
      }
    }

    return ''; // No se encontró cuerpo
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

  // Si está en INBOX pero sin categoría específica, es personal
  if (labels.includes('INBOX')) return 'personal';

  return 'unknown';
}

/**
 * Worker de ingesta para procesar correos nuevos de Gmail, generar embeddings
 * y guardarlos en Supabase para un sistema RAG.
 */
async function main() {
  console.log('--- Iniciando worker de ingesta de Gmail (FASE 7) ---');

  try {
    // 1. Validar y obtener las variables de entorno.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!supabaseUrl || !supabaseServiceKey || !googleClientId || !googleClientSecret || !geminiApiKey) {
      throw new Error('Faltan una o más variables de entorno críticas.');
    }

    // 2. Inicializar clientes (usando SERVICE_ROLE_KEY para bypassar RLS).
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const oauth2Client = new google.auth.OAuth2(googleClientId, googleClientSecret);
    console.log('Clientes de Supabase, Google AI y OAuth inicializados.');

    // 3. Obtener y desencriptar el refresh_token del usuario.
    const { data: creds, error: credsError } = await supabase
      .from('user_credentials')
      .select('encrypted_refresh_token, iv, auth_tag')
      .eq('user_id', userId)
      .eq('service_name', 'google')
      .single();

    if (credsError || !creds) {
      throw new Error(`No se encontraron credenciales para el usuario ${userId}. Error: ${credsError?.message}`);
    }

    const decryptedToken = await decryptToken(creds as any);
    oauth2Client.setCredentials({ refresh_token: decryptedToken });
    console.log('Token de Google desencriptado y configurado.');

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // 4. Obtener el último `historyId` sincronizado.
    const { data: syncStatus, error: syncError } = await supabase
      .from('sync_status')
      .select('last_sync_token')
      .eq('user_id', userId)
      .eq('service_name', 'google')
      .single();

    const lastHistoryId = syncStatus?.last_sync_token || null;
    console.log(`Último History ID: ${lastHistoryId || 'Ninguno (primera sincronización)'}`);

    let currentStartHistoryId = lastHistoryId;

    // Si es la primera sincronización, obtenemos el historyId actual del perfil del usuario.
    if (!currentStartHistoryId) {
      console.log('Primera sincronización: Obteniendo el historyId actual del perfil de Gmail...');
      const profile = await gmail.users.getProfile({ userId: 'me' });
      currentStartHistoryId = profile.data.historyId || null;
      if (!currentStartHistoryId) {
        console.log('No se pudo obtener un historyId inicial del perfil. No hay historial para sincronizar.');
        return;
      }
      console.log(`History ID inicial obtenido: ${currentStartHistoryId}`);
    }

    // 5. Obtener historial de cambios desde la última sincronización.
    console.log('Buscando correos nuevos desde la última sincronización...');
    const historyResponse = await gmail.users.history.list({
      userId: 'me',
      startHistoryId: currentStartHistoryId,
      historyTypes: ['messageAdded'],
    });

    const newHistoryId = historyResponse.data.historyId;
    if (!newHistoryId) {
        console.log('No hay un nuevo History ID. Sincronización completa.');
        return;
    }

    const messagesAdded = historyResponse.data.history?.flatMap(h => h.messagesAdded || []) || [];

    if (messagesAdded.length === 0) {
      console.log('No hay correos nuevos.');
    } else {
        console.log(`${messagesAdded.length} correos nuevos encontrados. Procesando...`);

        let processedCount = 0;
        let skippedCount = 0;

        // 6. Procesar cada correo nuevo.
        for (const added of messagesAdded) {
            if (!added.message?.id) continue;

            const msg = await gmail.users.messages.get({
              userId: 'me',
              id: added.message.id,
              format: 'full' // Obtener payload completo
            });

            const labels = msg.data.labelIds || [];
            const isUnread = labels.includes('UNREAD');
            const isInInbox = labels.includes('INBOX');
            const isSpam = labels.includes('SPAM');
            const isTrash = labels.includes('TRASH');

            // FILTRO: Solo procesar correos no leídos en INBOX (no spam, no trash)
            if (!isUnread || !isInInbox || isSpam || isTrash) {
              skippedCount++;
              console.log(`⏭️  Saltando correo ${msg.data.id} (leído=${!isUnread}, no-inbox=${!isInInbox}, spam=${isSpam}, trash=${isTrash})`);
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

            // NUEVO: Extraer cuerpo completo (no solo snippet)
            const fullBody = extractFullBody(msg.data.payload);
            const snippet = msg.data.snippet || '';

            // Usar cuerpo completo si está disponible, sino fallback a snippet
            const bodyText = fullBody || snippet;

            // Truncar a 2000 caracteres para embeddings eficientes
            const truncatedBody = bodyText.slice(0, 2000);

            // Combinar asunto + cuerpo para embedding
            const textContent = `Asunto: ${subject}\n\nDe: ${fromEmail}\n\n${truncatedBody}`;

            // Detectar categoría
            const category = detectCategory(labels);

            // NUEVO: Construir metadata
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

            console.log(`📧 Procesando: [${subject}] de [${fromEmail}] - Categoría: ${category}`);

            // 7. Generar embedding.
            const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
            const embeddingResult = await model.embedContent(textContent);
            const embedding = embeddingResult.embedding.values;

            // 8. Guardar en la base de datos con metadata.
            const { error: insertError } = await supabase.from('document_chunks').insert({
                user_id: userId,
                source_type: 'gmail',
                source_id: msg.data.id!,
                content: textContent,
                embedding: embedding,
                metadata: metadata // NUEVO campo
            });

            if (insertError) {
                console.error(`❌ Error al guardar el correo [${subject}] en la DB:`, insertError.message);
            } else {
                processedCount++;
                console.log(`✅ Correo [${subject}] procesado y guardado (${bodyText.length} caracteres)`);
            }
        }

        console.log(`\n📊 Resumen de procesamiento:`);
        console.log(`   ✅ Procesados: ${processedCount}`);
        console.log(`   ⏭️  Saltados: ${skippedCount} (leídos o fuera de inbox)`);
    }

    // 9. Actualizar el `historyId` para la próxima sincronización.
    const { error: updateSyncError } = await supabase.from('sync_status').upsert({
      user_id: userId,
      service_name: 'google',
      last_sync_token: newHistoryId,
    }, { onConflict: 'user_id, service_name' });

    if (updateSyncError) {
        throw new Error(`Error al actualizar el estado de sincronización: ${updateSyncError.message}`);
    }

    console.log(`\n✅ Sincronización completada. Nuevo History ID guardado: ${newHistoryId}`);

  } catch (error) {
    console.error('❌ Ocurrió un error durante la ingesta de Gmail:', error);
    process.exit(1);
  }
}

main();

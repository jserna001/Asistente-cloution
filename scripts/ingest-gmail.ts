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
 * Worker de ingesta para procesar correos nuevos de Gmail, generar embeddings
 * y guardarlos en Supabase para un sistema RAG.
 */
async function main() {
  console.log('--- Iniciando worker de ingesta de Gmail ---');

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
        // 6. Procesar cada correo nuevo.
        for (const added of messagesAdded) {
            if (!added.message?.id) continue;

            const msg = await gmail.users.messages.get({ userId: 'me', id: added.message.id });

            const subjectHeader = msg.data.payload?.headers?.find(h => h.name === 'Subject');
            const subject = subjectHeader?.value || 'Sin Asunto';
            const snippet = msg.data.snippet || '';

            const textContent = `Asunto: ${subject}\n\n${snippet}`;

            // 7. Generar embedding.
            const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
            const embeddingResult = await model.embedContent(textContent);
            const embedding = embeddingResult.embedding.values;

            // 8. Guardar en la base de datos.
            const { error: insertError } = await supabase.from('document_chunks').insert({
                user_id: userId,
                source_type: 'gmail',
                source_id: msg.data.id!,
                content: textContent,
                embedding: embedding,
            });

            if (insertError) {
                console.error(`Error al guardar el correo [${subject}] en la DB:`, insertError.message);
            } else {
                console.log(`✅ Correo [${subject}] procesado y guardado.`);
            }
        }
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

    console.log(`Sincronización completada. Nuevo History ID guardado: ${newHistoryId}`);

  } catch (error) {
    console.error('❌ Ocurrió un error durante la ingesta de Gmail:', error);
    process.exit(1);
  }
}

main();

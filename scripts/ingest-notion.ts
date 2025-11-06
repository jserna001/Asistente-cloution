
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Client } from '@notionhq/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import { BlockObjectResponse } from '@notionhq/client/build/src/api-endpoints';

// Cargar variables de entorno desde .env.local
dotenv.config({ path: './.env.local' });

// --- 1. Constantes y Configuración ---
// !! IMPORTANTE: Reemplaza este valor con el UUID de tu usuario de Supabase.
const userId = '575a8929-81b3-4efa-ba4d-31b86b523c74'; 

const geminiApiKey = process.env.GEMINI_API_KEY!;
const notionToken = process.env.NOTION_INTERNAL_INTEGRATION_TOKEN!;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!userId) {
  console.error("Error: userId no está definido en scripts/ingest-notion.ts");
  process.exit(1);
}

if (!geminiApiKey || !notionToken || !supabaseUrl || !supabaseAnonKey) {
  throw new Error("Faltan una o más variables de entorno requeridas.");
}

// --- 2. Inicialización de Clientes ---
const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);
const notion = new Client({ auth: notionToken });
const genAI = new GoogleGenerativeAI(geminiApiKey);
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

/**
 * Obtiene el contenido de texto plano de una página de Notion,
 * extrayendo texto de varios tipos de bloques comunes.
 */
async function fetchPageContent(pageId: string): Promise<string> {
  console.log(`--- Extrayendo contenido de la página: ${pageId} ---`);
  let textContent = "";
  let hasMore = true;
  let startCursor: string | undefined = undefined;

  while (hasMore) {
    const response = await notion.blocks.children.list({
      block_id: pageId,
      start_cursor: startCursor,
    });

    for (const block of response.results) {
      if (!('type' in block)) continue; // Omitir bloques sin tipo

      let text = "";
      switch (block.type) {
        case 'paragraph':
          text = block.paragraph.rich_text.map((t) => t.plain_text).join('');
          break;
        case 'heading_1':
          text = block.heading_1.rich_text.map((t) => t.plain_text).join('');
          break;
        case 'heading_2':
          text = block.heading_2.rich_text.map((t) => t.plain_text).join('');
          break;
        case 'heading_3':
          text = block.heading_3.rich_text.map((t) => t.plain_text).join('');
          break;
        case 'bulleted_list_item':
          text = block.bulleted_list_item.rich_text.map((t) => t.plain_text).join('');
          break;
        case 'numbered_list_item':
          text = block.numbered_list_item.rich_text.map((t) => t.plain_text).join('');
          break;
        case 'to_do':
          text = block.to_do.rich_text.map((t) => t.plain_text).join('');
          break;
        case 'quote':
          text = block.quote.rich_text.map((t) => t.plain_text).join('');
          break;
        // Añadir más tipos de bloque si es necesario
      }
      
      if (text) {
        textContent += text + "\n"; // Añadir un salto de línea entre bloques
      }
    }

    hasMore = response.has_more;
    startCursor = response.next_cursor || undefined;
  }
  
  console.log(`--- Contenido extraído (longitud: ${textContent.length}) ---`);
  return textContent.trim();
}

/**
 * Función principal para sincronizar las páginas de Notion con Supabase.
 */
async function main() {
  console.log("Iniciando la sincronización de Notion...");

  // a. Obtener la marca de agua (última fecha de sincronización)
  const { data: syncData, error: syncError } = await supabase
    .from('sync_status')
    .select('last_sync_timestamp')
    .eq('user_id', userId)
    .eq('service_name', 'notion')
    .single();

  if (syncError && syncError.code !== 'PGRST116') { // PGRST116 = no rows found
    throw new Error(`Error al obtener el estado de sincronización: ${syncError.message}`);
  }

  const last_sync_timestamp = syncData?.last_sync_timestamp;

  // b. Buscar páginas nuevas o modificadas en Notion
  console.log("Buscando páginas nuevas o modificadas en Notion...");
  const searchParams: any = {
    filter: {
      value: 'page',
      property: 'object',
    },
    sort: {
      direction: 'descending', // Ordenar por más reciente primero
      timestamp: 'last_edited_time',
    },
  };

  if (last_sync_timestamp) {
    console.log(`Buscando páginas editadas desde: ${last_sync_timestamp}`);
  } else {
    console.log("No hay sincronización previa, se buscarán todas las páginas accesibles.");
  }

  const pages = await notion.search(searchParams);

  // c. Procesar las páginas encontradas
  let processedCount = 0;
  console.log(`Se encontraron ${pages.results.length} páginas en total. Procesando las más recientes...`);

  for (const page of pages.results) {
    if (page.object !== 'page') continue;

    // Detener el proceso si la página es más antigua que la última sincronización
    if (last_sync_timestamp && new Date(page.last_edited_time) < new Date(last_sync_timestamp)) {
      console.log("Se alcanzó una página más antigua que la última sincronización. Deteniendo.");
      break;
    }

    const pageId = page.id;
    const pageTitle = (page as any).properties.title.title[0]?.plain_text ?? 'Sin Título';

    try {
      // iii. Borrar chunks viejos para manejar actualizaciones
      const { error: deleteError } = await supabase
        .from('document_chunks')
        .delete()
        .eq('source_id', pageId);

      if (deleteError) {
        console.error(`Error al eliminar chunks para la página ${pageId}:`, deleteError);
        continue; 
      }

      // iv. Obtener el contenido de texto de la página
      const textContent = await fetchPageContent(pageId);

      // v. Omitir si no hay contenido
      if (!textContent) {
        console.log(`Página "${pageTitle}" omitida (sin contenido de texto).`);
        continue;
      }

      console.log(`Procesando página: "${pageTitle}"`);

      // d. Generar embedding para el contenido
      const embeddingResult = await embeddingModel.embedContent(textContent);
      const embedding = embeddingResult.embedding.values;

      // e. Guardar el nuevo chunk en la base de datos
      const { error: insertError } = await supabase.from('document_chunks').insert({
        user_id: userId,
        source_type: 'notion',
        source_id: pageId,
        content: textContent,
        embedding: embedding,
      });

      if (insertError) {
        console.error(`Error al guardar el chunk para la página "${pageTitle}":`, insertError);
      } else {
        processedCount++;
        console.log(`Página de Notion "${pageTitle}" procesada y guardada.`);
      }
    } catch (err) {
      console.error(`Error procesando la página "${pageTitle}" (${pageId}):`, err);
    }
  }

  console.log(`\nProcesamiento finalizado. Se actualizaron ${processedCount} páginas.`);

  // f. Actualizar la marca de agua
  const newSyncTimestamp = new Date().toISOString();
  console.log(`Actualizando la marca de agua a: ${newSyncTimestamp}`);
  const { error: upsertError } = await supabase
    .from('sync_status')
    .upsert({
      user_id: userId,
      service_name: 'notion',
      last_sync_timestamp: newSyncTimestamp,
    }, { onConflict: 'user_id,service_name' });

  if (upsertError) {
    console.error("Error al actualizar la marca de agua:", upsertError);
  }

  console.log("Sincronización de Notion completada.");
}

// --- 7. Ejecutar Script ---
main().catch(error => {
  console.error("Ocurrió un error fatal durante la ejecución del script:", error);
  process.exit(1);
});

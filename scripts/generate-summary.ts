import { decryptToken } from '../lib/tokenService';
import { getGoogleOAuthClient } from '../lib/googleAuth';
import { google } from 'googleapis';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Client as NotionClient } from '@notionhq/client';
import * as dotenv from 'dotenv';

// Cargar variables de entorno desde .env.local
dotenv.config({ path: './.env.local' });

// --- 1. Constantes y Configuración ---
// !! IMPORTANTE: Reemplaza este valor con el UUID de tu usuario de Supabase.
const userId = '575a8929-81b3-4efa-ba4d-31b86b523c74';

const geminiApiKey = process.env.GEMINI_API_KEY!;
const notionToken = process.env.NOTION_INTERNAL_INTEGRATION_TOKEN!;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const encryptionKey = process.env.ENCRYPTION_KEY!;

if (!userId || userId.includes('PLACEHOLDER')) {
  console.error("Error: Por favor, define tu UUID de usuario de Supabase en scripts/generate-summary.ts");
  process.exit(1);
}

if (!geminiApiKey || !notionToken || !supabaseUrl || !supabaseAnonKey || !encryptionKey) {
  throw new Error("Faltan una o más variables de entorno requeridas.");
}

import * as Supabase from '@supabase/supabase-js';

// ... (other imports)

// --- 2. Inicialización de Clientes ---
const supabase: Supabase.SupabaseClient = Supabase.createClient(supabaseUrl, supabaseAnonKey);
const notion = new NotionClient({ auth: notionToken });
const genAI = new GoogleGenerativeAI(geminiApiKey);
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
const chatModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

/**
 * FASE 4: Función para obtener insights de productividad de la última semana
 */
async function getProductivityInsights(userId: string): Promise<string> {
  try {
    // Obtener resúmenes de los últimos 7 días
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: summaries, error: summariesError } = await supabase
      .from('daily_summaries')
      .select('id, created_at')
      .eq('user_id', userId)
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (summariesError || !summaries || summaries.length < 3) {
      return ''; // No hay suficientes datos
    }

    const summaryIds = summaries.map(s => s.id);

    // Obtener interacciones
    const { data: interactions, error: interactionsError } = await supabase
      .from('summary_interactions')
      .select('summary_id, interaction_type, created_at')
      .in('summary_id', summaryIds);

    if (interactionsError || !interactions || interactions.length === 0) {
      return ''; // No hay interacciones
    }

    // Calcular métricas
    const totalSummaries = summaries.length;
    const totalInteractions = interactions.length;
    const avgInteractionsPerDay = Math.round(totalInteractions / totalSummaries);

    // Encontrar día más activo
    const interactionsByDay: { [key: string]: number } = {};
    interactions.forEach(i => {
      const day = new Date(i.created_at).toLocaleDateString('es-ES', { weekday: 'long' });
      interactionsByDay[day] = (interactionsByDay[day] || 0) + 1;
    });

    const mostActiveDay = Object.entries(interactionsByDay)
      .sort(([, a], [, b]) => b - a)[0];

    // Tipos de interacción más comunes
    const interactionTypes: { [key: string]: number } = {};
    interactions.forEach(i => {
      interactionTypes[i.interaction_type] = (interactionTypes[i.interaction_type] || 0) + 1;
    });

    const topInteractionType = Object.entries(interactionTypes)
      .sort(([, a], [, b]) => b - a)[0];

    const typeLabels: { [key: string]: string } = {
      'click_notion': 'Tareas de Notion',
      'click_gmail': 'Correos',
      'click_calendar': 'Eventos'
    };

    return `
Tendencias de la Semana:
---
📊 Esta semana tuviste ${totalInteractions} interacciones en ${totalSummaries} días (promedio: ${avgInteractionsPerDay}/día).
🔥 ${mostActiveDay ? `${mostActiveDay[0]} fue tu día más activo (${mostActiveDay[1]} interacciones).` : ''}
🎯 Interactúas más con: ${topInteractionType ? typeLabels[topInteractionType[0]] || topInteractionType[0] : 'N/A'}.
---
`;
  } catch (error) {
    console.error('Error obteniendo insights de productividad:', error);
    return '';
  }
}

/**
 * Función principal para generar y guardar el resumen diario.
 */
async function main() {
  console.log("Iniciando la generación del resumen matutino...");

  // a. Obtener y configurar el token de Google
  const { data: creds, error: credsError } = await supabase
    .from('user_credentials')
    .select('encrypted_refresh_token, iv, auth_tag')
    .eq('user_id', userId)
    .single();

  if (credsError || !creds) {
    throw new Error(`No se encontraron credenciales para el usuario ${userId}: ${credsError?.message}`);
  }

  // Validar que los datos del token no son nulos
  if (!creds.encrypted_refresh_token || !creds.iv || !creds.auth_tag) {
    throw new Error(`Los datos del token para el usuario ${userId} están incompletos o nulos en la base de datos. Por favor, vuelve a autenticarte con Google.`);
  }

  const refreshToken = await decryptToken(creds);
  
  const oauth2Client = getGoogleOAuthClient();
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  // --- TAREA 1: Leer Google Calendar ---
  console.log("Buscando eventos del calendario para hoy...");
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
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
    const start = event.start?.dateTime ? new Date(event.start.dateTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : 'Todo el día';
    return `${start} - ${event.summary}`;
  }).join('\n');
  console.log(`Eventos encontrados: ${calendarEvents.length}`);

  // --- TAREA 2: Leer Tareas de Notion (RAG) ---
  console.log("Buscando tareas en Notion...");
  const notionQueryEmbedding = await embeddingModel.embedContent("¿Cuáles son mis tareas pendientes o lista de compras?");
  const { data: notionChunks, error: notionError } = await supabase.rpc('match_document_chunks', {
    query_embedding: notionQueryEmbedding.embedding.values,
    match_threshold: 0.6,
    match_count: 5,
    p_source_type: 'notion' // Filtro por tipo de fuente
  });
  if (notionError) throw new Error(`Error buscando en Notion: ${notionError.message}`);
  const notionContext = notionChunks?.map((c: any) => c.content).join('\n---\n') || null;

  // --- TAREA 3: Leer Correos Clave de Gmail (RAG) ---
  console.log("Buscando correos importantes...");
  const gmailQueryEmbedding = await embeddingModel.embedContent("¿Hay algún correo urgente o importante que necesite mi atención?");
  const { data: gmailChunks, error: gmailError } = await supabase.rpc('match_document_chunks', {
    query_embedding: gmailQueryEmbedding.embedding.values,
    match_threshold: 0.7, // Umbral más alto para correos importantes
    match_count: 3,
    p_source_type: 'gmail' // Filtro por tipo de fuente
  });
  if (gmailError) throw new Error(`Error buscando en Gmail: ${gmailError.message}`);
  const gmailContext = gmailChunks?.map((c: any) => c.content).join('\n---\n') || null;

  // --- FASE 4: Obtener Insights de Productividad ---
  console.log("Obteniendo insights de productividad...");
  const productivityInsights = await getProductivityInsights(userId);

  // --- TAREA 4: Sintetizar el Resumen ---
  console.log("Generando resumen diario...");
  const systemPrompt = `Eres mi asistente personal. Hoy es ${new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}. Aquí está mi información del día.

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

${productivityInsights ? productivityInsights : ''}

Tu tarea: Escribe un resumen matutino conciso y amigable (máximo 3-5 puntos clave) de lo que necesito saber hoy. Sé directo, prioriza lo más importante y agrupa la información por tema (ej. "Reuniones", "Tareas Urgentes"). ${productivityInsights ? 'Incluye un breve comentario motivacional basado en las tendencias de la semana.' : ''} Si no hay nada destacable, simplemente di "Todo tranquilo por hoy, ¡que tengas un gran día!".`;

  const result = await chatModel.generateContent(systemPrompt);
  const summaryText = result.response.text();

  // --- TAREA 5: Guardar el Resumen ---
  console.log("\n--- RESUMEN DEL DÍA ---\n");
  console.log(summaryText);
  console.log("\n-----------------------\n");

  const { error: insertError } = await supabase
    .from('daily_summaries')
    .insert({ user_id: userId, summary_text: summaryText });

  if (insertError) {
    throw new Error(`Error al guardar el resumen en Supabase: ${insertError.message}`);
  }

  console.log("Resumen guardado en Supabase exitosamente.");
}

// --- 6. Ejecutar Script ---
main().catch(error => {
  console.error("Ocurrió un error fatal durante la generación del resumen:", error);
  process.exit(1);
});

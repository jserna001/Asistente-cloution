/**
 * Sistema de Parafraseo para confirmar entendimiento
 * El asistente parafrasea la solicitud antes de ejecutar acciones importantes
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { SupabaseClient } from '@supabase/supabase-js';
import { getUserFacts, getUserLearningProfile } from './learningLogger';

// Resultado del análisis de parafraseo
export interface ParaphraseResult {
  // La paráfrasis generada
  paraphrase: string;
  // Nivel de confianza (0-1) de que se entendió correctamente
  confidence: number;
  // Si se requiere confirmación del usuario
  requiresConfirmation: boolean;
  // Preguntas clarificadoras si la confianza es baja
  clarifyingQuestions?: string[];
  // Intención detectada
  detectedIntent: string;
  // Entidades extraídas
  entities: string[];
  // Si es una acción irreversible o importante
  isHighRiskAction: boolean;
}

// Acciones que siempre requieren confirmación
const HIGH_RISK_KEYWORDS = [
  'eliminar', 'borrar', 'delete', 'enviar correo', 'send email',
  'crear evento', 'agendar', 'schedule', 'mover', 'transferir',
  'cancelar', 'cancel', 'modificar', 'cambiar', 'actualizar'
];

// Threshold de confianza para proceder sin confirmación
const CONFIDENCE_THRESHOLD = 0.85;

/**
 * Analiza y parafrasea la consulta del usuario
 */
export async function analyzeAndParaphrase(
  query: string,
  supabase: SupabaseClient,
  userId: string,
  history: Array<{ role: string; content: string }> = []
): Promise<ParaphraseResult> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  // Obtener contexto del usuario para mejor parafraseo
  const [userFacts, userProfile] = await Promise.all([
    getUserFacts(supabase, userId, ['preference', 'context', 'goal'], 10),
    getUserLearningProfile(supabase, userId)
  ]);

  // Construir contexto de hechos conocidos
  const factsContext = userFacts.length > 0
    ? `\nHechos conocidos sobre el usuario:\n${userFacts.map(f => `- ${f.content}`).join('\n')}`
    : '';

  const profileContext = userProfile
    ? `\nPerfil: Tono preferido: ${userProfile.preferredTone}, Longitud: ${userProfile.preferredLength}`
    : '';

  // Historial reciente
  const recentHistory = history.slice(-4).map(m =>
    `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content.substring(0, 200)}`
  ).join('\n');

  const prompt = `Eres un asistente que debe analizar y parafrasear la solicitud del usuario para confirmar que la entiendes correctamente.

SOLICITUD DEL USUARIO:
"${query}"

${recentHistory ? `HISTORIAL RECIENTE:\n${recentHistory}` : ''}
${factsContext}
${profileContext}

INSTRUCCIONES:
1. Parafrasea la solicitud de forma clara y concisa (en español)
2. Identifica la intención principal
3. Extrae entidades importantes (personas, fechas, lugares, acciones)
4. Evalúa tu confianza de 0 a 1
5. Si la confianza es menor a 0.85 o la solicitud es ambigua, sugiere preguntas clarificadoras
6. Marca si es una acción de alto riesgo (enviar emails, eliminar, modificar datos)

Responde SOLO en este formato JSON exacto:
{
  "paraphrase": "Lo que entendí: ...",
  "confidence": 0.XX,
  "intent": "descripción breve de la intención",
  "entities": ["entidad1", "entidad2"],
  "isHighRisk": true/false,
  "clarifyingQuestions": ["pregunta1", "pregunta2"]
}`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Extraer JSON de la respuesta
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[Paraphrase] No se encontró JSON en respuesta:', responseText);
      return createDefaultResult(query);
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Verificar si es acción de alto riesgo por keywords
    const isHighRiskByKeywords = HIGH_RISK_KEYWORDS.some(keyword =>
      query.toLowerCase().includes(keyword.toLowerCase())
    );

    const confidence = parsed.confidence || 0.5;
    const isHighRisk = parsed.isHighRisk || isHighRiskByKeywords;

    return {
      paraphrase: parsed.paraphrase || `Entiendo que quieres: ${query}`,
      confidence,
      requiresConfirmation: confidence < CONFIDENCE_THRESHOLD || isHighRisk,
      clarifyingQuestions: parsed.clarifyingQuestions || [],
      detectedIntent: parsed.intent || 'no especificado',
      entities: parsed.entities || [],
      isHighRiskAction: isHighRisk
    };

  } catch (error) {
    console.error('[Paraphrase] Error:', error);
    return createDefaultResult(query);
  }
}

/**
 * Genera una respuesta de confirmación para el usuario
 */
export function generateConfirmationMessage(result: ParaphraseResult): string {
  let message = result.paraphrase;

  if (result.isHighRiskAction) {
    message += '\n\n⚠️ Esta es una acción importante.';
  }

  if (result.clarifyingQuestions && result.clarifyingQuestions.length > 0 && result.confidence < 0.7) {
    message += '\n\nTengo algunas dudas:';
    result.clarifyingQuestions.forEach((q, i) => {
      message += `\n${i + 1}. ${q}`;
    });
  }

  if (result.requiresConfirmation) {
    message += '\n\n¿Es correcto? Responde "sí" para continuar o corrígeme.';
  }

  return message;
}

/**
 * Verifica si la respuesta del usuario es una confirmación
 */
export function isConfirmation(response: string): boolean {
  const confirmations = [
    'sí', 'si', 'yes', 'ok', 'okay', 'dale', 'perfecto',
    'correcto', 'exacto', 'así es', 'adelante', 'procede',
    'confirmo', 'confirmado', 'hazlo', 'continúa', 'continua'
  ];

  const normalized = response.toLowerCase().trim();
  return confirmations.some(c => normalized.includes(c));
}

/**
 * Verifica si la respuesta es una corrección
 */
export function isCorrection(response: string): boolean {
  const corrections = [
    'no', 'nope', 'incorrecto', 'mal', 'error', 'equivocado',
    'no es', 'no quiero', 'en realidad', 'más bien', 'quise decir',
    'me refiero a', 'lo que quiero'
  ];

  const normalized = response.toLowerCase().trim();
  return corrections.some(c => normalized.includes(c));
}

/**
 * Resultado por defecto cuando falla el análisis
 */
function createDefaultResult(query: string): ParaphraseResult {
  const isHighRisk = HIGH_RISK_KEYWORDS.some(keyword =>
    query.toLowerCase().includes(keyword.toLowerCase())
  );

  return {
    paraphrase: `Entiendo que quieres: "${query}"`,
    confidence: 0.6,
    requiresConfirmation: true,
    clarifyingQuestions: ['¿Podrías darme más detalles sobre lo que necesitas?'],
    detectedIntent: 'no determinado',
    entities: [],
    isHighRiskAction: isHighRisk
  };
}

/**
 * Determina si se debe parafrasear basado en el tipo de consulta
 */
export function shouldParaphrase(query: string, taskType: string): boolean {
  // Siempre parafrasear acciones de alto riesgo
  if (HIGH_RISK_KEYWORDS.some(k => query.toLowerCase().includes(k))) {
    return true;
  }

  // Parafrasear para tareas que modifican datos
  const modifyingTasks = ['GMAIL', 'CALENDAR', 'NOTION_MCP', 'GOOGLE_TASKS', 'GOOGLE_DRIVE'];
  if (modifyingTasks.includes(taskType)) {
    return true;
  }

  // No parafrasear consultas simples o de RAG
  if (['SIMPLE', 'RAG'].includes(taskType)) {
    return false;
  }

  // Por defecto, parafrasear si la consulta es larga o compleja
  return query.length > 100 || query.includes(' y ') || query.includes(' luego ');
}

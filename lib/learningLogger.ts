/**
 * Sistema de logging para aprendizaje automático
 * Registra eventos, feedback e interacciones para mejorar el asistente
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { TaskType } from './orchestration/types';

// Tipos de eventos que se pueden loguear
export type LearningEventType =
  | 'query'           // Consulta del usuario
  | 'feedback'        // Feedback explícito (rating)
  | 'interaction'     // Interacción con UI
  | 'error'           // Error del sistema
  | 'classification'  // Resultado de clasificación de tarea
  | 'paraphrase_correction'; // Corrección de parafraseo

// Datos de un evento de aprendizaje
export interface LearningEventData {
  eventType: LearningEventType;
  queryText?: string;
  taskTypeClassified?: TaskType;
  modelUsed?: string;
  rating?: number;
  feedbackTags?: string[];
  executionTimeMs?: number;
  success?: boolean;
  metadata?: Record<string, any>;
}

// Datos para registrar un hecho de conversación
export interface ConversationFactData {
  factType: 'preference' | 'personal_info' | 'goal' | 'relationship' | 'context';
  factContent: string;
  sourceType?: 'chat' | 'email' | 'calendar' | 'notion';
  sourceId?: string;
  extractedFrom?: string;
  confidence?: number;
}

// Datos para estilo de comunicación
export interface CommunicationStyleData {
  contactIdentifier: string;
  contactName?: string;
  platform: 'email' | 'whatsapp' | 'calendar' | 'notion';
  formalityLevel?: 'formal' | 'neutral' | 'casual';
  typicalGreeting?: string;
  typicalClosing?: string;
  toneKeywords?: string[];
  exampleMessage?: string;
}

// Datos para interacción con chunk
export interface ChunkInteractionData {
  chunkId: number;
  interactionType: 'viewed_in_rag' | 'clicked' | 'copied' | 'helpful' | 'not_helpful';
  context?: string;
  helpful?: boolean;
}

/**
 * Registra un evento de aprendizaje
 */
export async function logLearningEvent(
  supabase: SupabaseClient,
  userId: string,
  eventData: LearningEventData
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('learning_events').insert({
      user_id: userId,
      event_type: eventData.eventType,
      query_text: eventData.queryText,
      task_type_classified: eventData.taskTypeClassified,
      model_used: eventData.modelUsed,
      rating: eventData.rating,
      feedback_tags: eventData.feedbackTags || [],
      execution_time_ms: eventData.executionTimeMs,
      success: eventData.success,
      metadata: eventData.metadata || {}
    });

    if (error) {
      console.error('[LearningLogger] Error logging event:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('[LearningLogger] Exception:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Registra un hecho extraído de una conversación
 */
export async function logConversationFact(
  supabase: SupabaseClient,
  userId: string,
  factData: ConversationFactData
): Promise<{ success: boolean; factId?: string; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('conversation_facts')
      .insert({
        user_id: userId,
        fact_type: factData.factType,
        fact_content: factData.factContent,
        source_type: factData.sourceType,
        source_id: factData.sourceId,
        extracted_from: factData.extractedFrom,
        confidence: factData.confidence || 0.7
      })
      .select('id')
      .single();

    if (error) {
      console.error('[LearningLogger] Error logging fact:', error);
      return { success: false, error: error.message };
    }

    return { success: true, factId: data?.id };
  } catch (err) {
    console.error('[LearningLogger] Exception:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Actualiza o crea un estilo de comunicación para un contacto
 */
export async function updateCommunicationStyle(
  supabase: SupabaseClient,
  userId: string,
  styleData: CommunicationStyleData
): Promise<{ success: boolean; error?: string }> {
  try {
    // Buscar estilo existente
    const { data: existing } = await supabase
      .from('communication_styles')
      .select('id, example_messages, interaction_count')
      .eq('user_id', userId)
      .eq('contact_identifier', styleData.contactIdentifier)
      .single();

    if (existing) {
      // Actualizar existente
      const updates: any = {
        interaction_count: existing.interaction_count + 1,
        last_interaction: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (styleData.contactName) updates.contact_name = styleData.contactName;
      if (styleData.formalityLevel) updates.formality_level = styleData.formalityLevel;
      if (styleData.typicalGreeting) updates.typical_greeting = styleData.typicalGreeting;
      if (styleData.typicalClosing) updates.typical_closing = styleData.typicalClosing;
      if (styleData.toneKeywords) updates.tone_keywords = styleData.toneKeywords;

      // Agregar ejemplo si se proporciona (máximo 5)
      if (styleData.exampleMessage) {
        const examples = existing.example_messages || [];
        examples.push({
          message: styleData.exampleMessage,
          timestamp: new Date().toISOString()
        });
        updates.example_messages = examples.slice(-5); // Mantener últimos 5
      }

      const { error } = await supabase
        .from('communication_styles')
        .update(updates)
        .eq('id', existing.id);

      if (error) {
        return { success: false, error: error.message };
      }
    } else {
      // Crear nuevo
      const { error } = await supabase.from('communication_styles').insert({
        user_id: userId,
        contact_identifier: styleData.contactIdentifier,
        contact_name: styleData.contactName,
        platform: styleData.platform,
        formality_level: styleData.formalityLevel || 'neutral',
        typical_greeting: styleData.typicalGreeting,
        typical_closing: styleData.typicalClosing,
        tone_keywords: styleData.toneKeywords || [],
        example_messages: styleData.exampleMessage
          ? [{ message: styleData.exampleMessage, timestamp: new Date().toISOString() }]
          : [],
        interaction_count: 1,
        last_interaction: new Date().toISOString()
      });

      if (error) {
        return { success: false, error: error.message };
      }
    }

    return { success: true };
  } catch (err) {
    console.error('[LearningLogger] Exception:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Registra una interacción con un chunk de RAG
 */
export async function logChunkInteraction(
  supabase: SupabaseClient,
  userId: string,
  interactionData: ChunkInteractionData
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('chunk_interactions').insert({
      user_id: userId,
      chunk_id: interactionData.chunkId,
      interaction_type: interactionData.interactionType,
      context: interactionData.context,
      helpful: interactionData.helpful
    });

    if (error) {
      console.error('[LearningLogger] Error logging chunk interaction:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('[LearningLogger] Exception:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Obtiene el estilo de comunicación para un contacto específico
 */
export async function getCommunicationStyle(
  supabase: SupabaseClient,
  userId: string,
  contactIdentifier: string
): Promise<{
  formalityLevel: string;
  typicalGreeting?: string;
  typicalClosing?: string;
  toneKeywords: string[];
  examples: string[];
} | null> {
  try {
    const { data, error } = await supabase
      .from('communication_styles')
      .select('*')
      .eq('user_id', userId)
      .eq('contact_identifier', contactIdentifier)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      formalityLevel: data.formality_level,
      typicalGreeting: data.typical_greeting,
      typicalClosing: data.typical_closing,
      toneKeywords: data.tone_keywords || [],
      examples: (data.example_messages || []).map((e: any) => e.message)
    };
  } catch (err) {
    console.error('[LearningLogger] Error getting communication style:', err);
    return null;
  }
}

/**
 * Obtiene hechos relevantes del usuario para contexto
 */
export async function getUserFacts(
  supabase: SupabaseClient,
  userId: string,
  factTypes?: string[],
  limit: number = 20
): Promise<Array<{ type: string; content: string; confidence: number }>> {
  try {
    let query = supabase
      .from('conversation_facts')
      .select('fact_type, fact_content, confidence')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('confidence', { ascending: false })
      .limit(limit);

    if (factTypes && factTypes.length > 0) {
      query = query.in('fact_type', factTypes);
    }

    const { data, error } = await query;

    if (error || !data) {
      return [];
    }

    return data.map(f => ({
      type: f.fact_type,
      content: f.fact_content,
      confidence: f.confidence
    }));
  } catch (err) {
    console.error('[LearningLogger] Error getting user facts:', err);
    return [];
  }
}

/**
 * Obtiene el perfil de aprendizaje del usuario
 */
export async function getUserLearningProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<{
  preferredTone: string;
  preferredLength: string;
  topTopics: string[];
  totalInteractions: number;
  avgRating: number;
} | null> {
  try {
    const { data, error } = await supabase
      .from('user_learning_profile')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      preferredTone: data.preferred_tone,
      preferredLength: data.preferred_response_length,
      topTopics: data.top_topics || [],
      totalInteractions: data.total_interactions,
      avgRating: data.avg_feedback_rating
    };
  } catch (err) {
    console.error('[LearningLogger] Error getting learning profile:', err);
    return null;
  }
}

/**
 * Registra feedback de una respuesta del asistente
 */
export async function logFeedback(
  supabase: SupabaseClient,
  userId: string,
  messageId: string,
  rating: number,
  tags?: string[],
  comment?: string
): Promise<{ success: boolean; error?: string }> {
  return logLearningEvent(supabase, userId, {
    eventType: 'feedback',
    rating,
    feedbackTags: tags,
    metadata: {
      message_id: messageId,
      comment
    }
  });
}

/**
 * Registra una corrección de parafraseo (el usuario corrigió la interpretación)
 */
export async function logParaphraseCorrection(
  supabase: SupabaseClient,
  userId: string,
  originalQuery: string,
  paraphrase: string,
  correction: string
): Promise<{ success: boolean; error?: string }> {
  return logLearningEvent(supabase, userId, {
    eventType: 'paraphrase_correction',
    queryText: originalQuery,
    metadata: {
      paraphrase,
      correction,
      was_wrong: true
    }
  });
}

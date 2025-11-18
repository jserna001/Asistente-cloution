import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { logChunkInteraction, logFeedback } from '../../../../lib/learningLogger';

/**
 * POST /api/feedback/chunk
 * Registra feedback sobre un chunk de RAG o una respuesta del asistente
 *
 * Body:
 * - chunkId?: number - ID del chunk (si aplica)
 * - messageId?: string - ID del mensaje (si aplica)
 * - rating?: number - Rating 1-5
 * - helpful?: boolean - Si fue útil
 * - interactionType?: string - Tipo de interacción
 * - context?: string - Contexto de la interacción
 * - tags?: string[] - Tags de feedback
 * - comment?: string - Comentario opcional
 */
export async function POST(req: Request) {
  try {
    // Autenticación
    const cookieStore = await (cookies() as any);
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: '', ...options });
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const {
      chunkId,
      messageId,
      rating,
      helpful,
      interactionType,
      context,
      tags,
      comment
    } = body;

    const results: any = {};

    // Registrar interacción con chunk si se proporciona chunkId
    if (chunkId) {
      const chunkResult = await logChunkInteraction(supabase, user.id, {
        chunkId,
        interactionType: interactionType || (helpful ? 'helpful' : 'not_helpful'),
        context,
        helpful
      });
      results.chunkInteraction = chunkResult;
    }

    // Registrar feedback general si se proporciona rating o messageId
    if (rating || messageId) {
      const feedbackResult = await logFeedback(
        supabase,
        user.id,
        messageId || 'unknown',
        rating || 0,
        tags,
        comment
      );
      results.feedback = feedbackResult;
    }

    // Verificar si hubo errores
    const hasErrors = Object.values(results).some((r: any) => !r.success);
    if (hasErrors) {
      return NextResponse.json({
        success: false,
        results,
        message: 'Algunos registros fallaron'
      }, { status: 207 });
    }

    return NextResponse.json({
      success: true,
      results,
      message: 'Feedback registrado correctamente'
    });

  } catch (error: any) {
    console.error('[Feedback API] Error:', error);
    return NextResponse.json({
      error: 'Error interno del servidor',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * GET /api/feedback/chunk
 * Obtiene estadísticas de feedback del usuario
 */
export async function GET(req: Request) {
  try {
    // Autenticación
    const cookieStore = await (cookies() as any);
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: '', ...options });
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Obtener estadísticas
    const [profileResult, eventsResult, interactionsResult] = await Promise.all([
      // Perfil de aprendizaje
      supabase
        .from('user_learning_profile')
        .select('total_interactions, feedback_count, avg_feedback_rating')
        .eq('user_id', user.id)
        .single(),

      // Últimos eventos de feedback
      supabase
        .from('learning_events')
        .select('event_type, rating, created_at')
        .eq('user_id', user.id)
        .eq('event_type', 'feedback')
        .order('created_at', { ascending: false })
        .limit(10),

      // Conteo de interacciones por tipo
      supabase
        .from('chunk_interactions')
        .select('interaction_type')
        .eq('user_id', user.id)
    ]);

    // Calcular estadísticas de interacciones
    const interactionStats: Record<string, number> = {};
    if (interactionsResult.data) {
      interactionsResult.data.forEach((i: any) => {
        interactionStats[i.interaction_type] = (interactionStats[i.interaction_type] || 0) + 1;
      });
    }

    return NextResponse.json({
      profile: profileResult.data || { total_interactions: 0, feedback_count: 0, avg_feedback_rating: 0 },
      recentFeedback: eventsResult.data || [],
      interactionStats
    });

  } catch (error: any) {
    console.error('[Feedback API] Error:', error);
    return NextResponse.json({
      error: 'Error interno del servidor',
      details: error.message
    }, { status: 500 });
  }
}

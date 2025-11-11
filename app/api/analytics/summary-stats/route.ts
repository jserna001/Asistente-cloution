import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/analytics/summary-stats
 * Obtiene estadísticas de calidad de los resúmenes del usuario
 */
export async function GET(request: Request) {
  try {
    // 1. Verificar autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'No autorizado - falta token' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
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

    const userId = user.id;

    // 2. Obtener estadísticas
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Total de resúmenes generados
    const { count: totalSummaries, error: countError } = await supabase
      .from('daily_summaries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError) {
      throw new Error(`Error contando resúmenes: ${countError.message}`);
    }

    // Feedback recibido
    const { data: feedbackData, error: feedbackError } = await supabase
      .from('summary_feedback')
      .select('rating, was_helpful, feedback_tags')
      .eq('user_id', userId);

    if (feedbackError) {
      throw new Error(`Error obteniendo feedback: ${feedbackError.message}`);
    }

    // Calcular métricas
    const totalFeedback = feedbackData?.length || 0;
    const feedbackRate = totalSummaries ? (totalFeedback / totalSummaries) * 100 : 0;

    const helpfulCount = feedbackData?.filter(f => f.was_helpful === true).length || 0;
    const notHelpfulCount = feedbackData?.filter(f => f.was_helpful === false).length || 0;
    const helpfulRate = totalFeedback ? (helpfulCount / totalFeedback) * 100 : 0;

    const ratings = feedbackData?.filter(f => f.rating !== null).map(f => f.rating) || [];
    const avgRating = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
      : null;

    // Tags más comunes
    const allTags = feedbackData?.flatMap(f => f.feedback_tags || []) || [];
    const tagCounts: Record<string, number> = {};
    allTags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
    const topTags = Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([tag, count]) => ({ tag, count }));

    // Estadísticas de interacciones (tracking)
    const { data: interactionsData, error: interactionsError } = await supabase
      .from('summary_interactions')
      .select('interaction_type')
      .eq('user_id', userId);

    const interactionStats: Record<string, number> = {};
    (interactionsData || []).forEach(i => {
      interactionStats[i.interaction_type] = (interactionStats[i.interaction_type] || 0) + 1;
    });

    const totalInteractions = interactionsData?.length || 0;
    const clickThroughRate = totalSummaries
      ? ((interactionStats.click_notion || 0) +
         (interactionStats.click_gmail || 0) +
         (interactionStats.click_calendar || 0)) / totalSummaries * 100
      : 0;

    // Últimos 7 días de resúmenes
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: recentSummaries, error: recentError } = await supabase
      .from('daily_summaries')
      .select('id, created_at')
      .eq('user_id', userId)
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (recentError) {
      throw new Error(`Error obteniendo resúmenes recientes: ${recentError.message}`);
    }

    const recentSummariesWithFeedback = await Promise.all(
      (recentSummaries || []).map(async (summary) => {
        const { data: fb } = await supabase
          .from('summary_feedback')
          .select('was_helpful, rating')
          .eq('user_id', userId)
          .eq('summary_id', summary.id)
          .maybeSingle();

        return {
          date: new Date(summary.created_at).toLocaleDateString('es-ES'),
          has_feedback: fb !== null,
          was_helpful: fb?.was_helpful || null,
          rating: fb?.rating || null
        };
      })
    );

    return NextResponse.json({
      stats: {
        total_summaries: totalSummaries || 0,
        total_feedback: totalFeedback,
        feedback_rate: Math.round(feedbackRate * 10) / 10,
        helpful_count: helpfulCount,
        not_helpful_count: notHelpfulCount,
        helpful_rate: Math.round(helpfulRate * 10) / 10,
        average_rating: avgRating ? Math.round(avgRating * 10) / 10 : null,
        top_feedback_tags: topTags,
        // Estadísticas de interacciones
        total_interactions: totalInteractions,
        click_through_rate: Math.round(clickThroughRate * 10) / 10,
        interactions_by_type: {
          notion_clicks: interactionStats.click_notion || 0,
          gmail_clicks: interactionStats.click_gmail || 0,
          calendar_clicks: interactionStats.click_calendar || 0,
          views: interactionStats.view || 0,
          copy_actions: interactionStats.copy_text || 0
        }
      },
      recent_summaries: recentSummariesWithFeedback
    });

  } catch (error: any) {
    console.error('[ANALYTICS] Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    );
  }
}

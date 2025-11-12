import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * FASE 3: Smart Scheduling - Análisis de Patrones de Engagement
 *
 * Analiza las interacciones del usuario con resúmenes históricos para
 * identificar el mejor horario de envío basado en:
 * - Click-through rate por hora del día
 * - Tiempo promedio entre envío y primera interacción
 * - Feedback positivo por hora
 * - Días de la semana con mayor engagement
 */

interface EngagementPattern {
  hour: number;
  dayOfWeek: string;
  totalSummaries: number;
  viewCount: number;
  clickCount: number;
  ctr: number; // Click-through rate
  avgTimeToFirstInteraction: number; // En minutos
  helpfulRate: number;
}

/**
 * GET /api/user/schedule-suggestions
 *
 * Retorna sugerencias de horario basadas en análisis de engagement
 */
export async function GET(req: Request) {
  try {
    // Autenticación
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = user.id;

    // 1. Obtener preferencias actuales
    const { data: currentPrefs, error: prefsError } = await supabase
      .from('user_preferences')
      .select('daily_summary_time, timezone')
      .eq('user_id', userId)
      .single();

    if (prefsError) {
      return NextResponse.json({ error: 'Error fetching preferences' }, { status: 500 });
    }

    const currentTime = currentPrefs?.daily_summary_time || '07:00:00';
    const currentHour = parseInt(currentTime.split(':')[0]);

    // 2. Obtener todos los resúmenes de los últimos 30 días
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: summaries, error: summariesError } = await supabase
      .from('daily_summaries')
      .select('id, created_at')
      .eq('user_id', userId)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (summariesError || !summaries || summaries.length === 0) {
      return NextResponse.json({
        success: true,
        hasEnoughData: false,
        message: 'No hay suficientes datos para análisis. Se necesitan al menos 7 días de resúmenes.',
        currentSchedule: {
          time: currentTime,
          hour: currentHour
        }
      });
    }

    // 3. Obtener interacciones para cada resumen
    const summaryIds = summaries.map(s => s.id);

    const { data: interactions, error: interactionsError } = await supabase
      .from('summary_interactions')
      .select('summary_id, interaction_type, created_at')
      .in('summary_id', summaryIds)
      .eq('user_id', userId);

    if (interactionsError) {
      return NextResponse.json({ error: 'Error fetching interactions' }, { status: 500 });
    }

    // 4. Obtener feedback para cada resumen
    const { data: feedbacks, error: feedbacksError } = await supabase
      .from('summary_feedback')
      .select('summary_id, was_helpful, rating')
      .in('summary_id', summaryIds)
      .eq('user_id', userId);

    if (feedbacksError) {
      return NextResponse.json({ error: 'Error fetching feedback' }, { status: 500 });
    }

    // 5. Analizar patrones por hora del día
    const hourlyPatterns: { [hour: number]: EngagementPattern } = {};

    for (const summary of summaries) {
      const createdAt = new Date(summary.created_at);
      const hour = createdAt.getHours();
      const dayOfWeek = createdAt.toLocaleDateString('es-ES', { weekday: 'long' });

      if (!hourlyPatterns[hour]) {
        hourlyPatterns[hour] = {
          hour,
          dayOfWeek: '', // Calculado después
          totalSummaries: 0,
          viewCount: 0,
          clickCount: 0,
          ctr: 0,
          avgTimeToFirstInteraction: 0,
          helpfulRate: 0
        };
      }

      const pattern = hourlyPatterns[hour];
      pattern.totalSummaries++;

      // Contar interacciones
      const summaryInteractions = interactions?.filter(i => i.summary_id === summary.id) || [];
      const hasView = summaryInteractions.some(i => i.interaction_type === 'view');
      const hasClick = summaryInteractions.some(i =>
        ['click_notion', 'click_gmail', 'click_calendar'].includes(i.interaction_type)
      );

      if (hasView) pattern.viewCount++;
      if (hasClick) pattern.clickCount++;

      // Calcular tiempo hasta primera interacción
      if (summaryInteractions.length > 0) {
        const firstInteraction = summaryInteractions.sort((a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )[0];
        const timeDiff = new Date(firstInteraction.created_at).getTime() - createdAt.getTime();
        const minutesDiff = timeDiff / (1000 * 60);
        pattern.avgTimeToFirstInteraction += minutesDiff;
      }

      // Contar feedback positivo
      const summaryFeedback = feedbacks?.find(f => f.summary_id === summary.id);
      if (summaryFeedback?.was_helpful === true) {
        pattern.helpfulRate++;
      }
    }

    // 6. Calcular promedios y CTR
    const patterns: EngagementPattern[] = [];
    for (const hour in hourlyPatterns) {
      const pattern = hourlyPatterns[hour];
      pattern.ctr = pattern.totalSummaries > 0
        ? (pattern.clickCount / pattern.totalSummaries) * 100
        : 0;
      pattern.avgTimeToFirstInteraction = pattern.viewCount > 0
        ? pattern.avgTimeToFirstInteraction / pattern.viewCount
        : 0;
      pattern.helpfulRate = pattern.totalSummaries > 0
        ? (pattern.helpfulRate / pattern.totalSummaries) * 100
        : 0;
      patterns.push(pattern);
    }

    // 7. Ordenar por CTR descendente
    patterns.sort((a, b) => b.ctr - a.ctr);

    // 8. Encontrar el mejor horario (mayor CTR + menor tiempo de respuesta)
    const bestPattern = patterns.reduce((best, current) => {
      // Score combinado: 70% CTR + 30% rapidez de respuesta
      const currentScore = (current.ctr * 0.7) +
        ((60 - Math.min(current.avgTimeToFirstInteraction, 60)) * 0.3);
      const bestScore = (best.ctr * 0.7) +
        ((60 - Math.min(best.avgTimeToFirstInteraction, 60)) * 0.3);

      return currentScore > bestScore ? current : best;
    }, patterns[0]);

    // 9. Calcular mejora potencial
    const currentPattern = hourlyPatterns[currentHour];
    const improvement = currentPattern && bestPattern
      ? ((bestPattern.ctr - currentPattern.ctr) / currentPattern.ctr) * 100
      : 0;

    // 10. Generar recomendación
    const shouldChange = improvement > 15; // Solo sugerir si mejora es >15%
    const recommendation = shouldChange
      ? `Cambiar a las ${bestPattern.hour.toString().padStart(2, '0')}:00 podría aumentar tu engagement en ${Math.round(improvement)}%`
      : `Tu horario actual (${currentTime}) ya es óptimo basado en tus patrones de uso`;

    return NextResponse.json({
      success: true,
      hasEnoughData: summaries.length >= 7,
      dataPoints: summaries.length,
      currentSchedule: {
        time: currentTime,
        hour: currentHour,
        ctr: currentPattern?.ctr || 0,
        avgResponseTime: currentPattern?.avgTimeToFirstInteraction || 0
      },
      suggestedSchedule: {
        time: `${bestPattern.hour.toString().padStart(2, '0')}:00:00`,
        hour: bestPattern.hour,
        ctr: bestPattern.ctr,
        avgResponseTime: bestPattern.avgTimeToFirstInteraction,
        potentialImprovement: improvement
      },
      shouldChange,
      recommendation,
      allPatterns: patterns.map(p => ({
        hour: p.hour,
        ctr: Math.round(p.ctr * 10) / 10,
        avgResponseTimeMinutes: Math.round(p.avgTimeToFirstInteraction),
        totalSummaries: p.totalSummaries
      })),
      insights: generateInsights(patterns, currentHour, bestPattern.hour)
    });

  } catch (error: any) {
    console.error('[SCHEDULE SUGGESTIONS] Error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * Genera insights textuales basados en los patrones
 */
function generateInsights(
  patterns: EngagementPattern[],
  currentHour: number,
  bestHour: number
): string[] {
  const insights: string[] = [];

  // Insight 1: Mejor horario
  if (bestHour !== currentHour) {
    insights.push(`Tu mejor horario es ${bestHour}:00 - ${bestHour + 1}:00 basado en engagement histórico`);
  } else {
    insights.push(`¡Ya estás usando tu mejor horario! (${currentHour}:00)`);
  }

  // Insight 2: Patrones de engagement
  const topPatterns = patterns.slice(0, 3);
  if (topPatterns.length >= 3) {
    insights.push(
      `Tus 3 mejores horarios son: ${topPatterns.map(p => `${p.hour}:00 (${Math.round(p.ctr)}% CTR)`).join(', ')}`
    );
  }

  // Insight 3: Peores horarios para evitar
  const worstPatterns = patterns.filter(p => p.ctr < 20).slice(-2);
  if (worstPatterns.length > 0) {
    insights.push(
      `Evita estas horas: ${worstPatterns.map(p => `${p.hour}:00 (${Math.round(p.ctr)}% CTR)`).join(', ')}`
    );
  }

  // Insight 4: Tiempo de respuesta
  const avgResponseTime = patterns.reduce((sum, p) => sum + p.avgTimeToFirstInteraction, 0) / patterns.length;
  if (avgResponseTime < 30) {
    insights.push(`Respondes rápido a tus resúmenes (promedio: ${Math.round(avgResponseTime)} minutos)`);
  } else if (avgResponseTime > 120) {
    insights.push(`Sueles revisar tus resúmenes varias horas después (promedio: ${Math.round(avgResponseTime / 60)} horas)`);
  }

  return insights;
}

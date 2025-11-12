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
  avgResponseTime: number; // minutos
  helpfulCount: number;
  ctr: number; // click-through rate
  score: number; // score combinado
}

export async function GET(req: Request) {
  try {
    // Autenticación
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // --- 1. Obtener Resúmenes de los Últimos 30 Días ---
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: summaries, error: summariesError } = await supabase
      .from('daily_summaries')
      .select('id, created_at')
      .eq('user_id', user.id)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (summariesError) {
      return NextResponse.json(
        { error: 'Error obteniendo resúmenes', details: summariesError },
        { status: 500 }
      );
    }

    if (!summaries || summaries.length < 7) {
      return NextResponse.json({
        hasEnoughData: false,
        dataPoints: summaries?.length || 0,
        message: 'Se necesitan al menos 7 días de resúmenes para generar sugerencias',
      });
    }

    const summaryIds = summaries.map(s => s.id);

    // --- 2. Obtener Interacciones ---
    const { data: interactions, error: interactionsError } = await supabase
      .from('summary_interactions')
      .select('summary_id, interaction_type, created_at')
      .in('summary_id', summaryIds);

    if (interactionsError) {
      return NextResponse.json(
        { error: 'Error obteniendo interacciones', details: interactionsError },
        { status: 500 }
      );
    }

    if (!interactions || interactions.length === 0) {
      return NextResponse.json({
        hasEnoughData: false,
        dataPoints: summaries.length,
        message: 'Se necesitan interacciones con los resúmenes para generar sugerencias',
      });
    }

    // --- 3. Obtener Feedback ---
    const { data: feedback } = await supabase
      .from('summary_feedback')
      .select('summary_id, was_helpful')
      .in('summary_id', summaryIds);

    // --- 4. Análisis por Hora del Día ---
    const patternsByHour: { [hour: number]: EngagementPattern } = {};

    for (let hour = 0; hour < 24; hour++) {
      patternsByHour[hour] = {
        hour,
        dayOfWeek: '',
        totalSummaries: 0,
        viewCount: 0,
        clickCount: 0,
        avgResponseTime: 0,
        helpfulCount: 0,
        ctr: 0,
        score: 0,
      };
    }

    summaries.forEach((summary) => {
      const summaryDate = new Date(summary.created_at);
      const hour = summaryDate.getHours();

      patternsByHour[hour].totalSummaries++;

      // Contar views (primera interacción)
      const summaryInteractions = interactions.filter(i => i.summary_id === summary.id);
      if (summaryInteractions.length > 0) {
        patternsByHour[hour].viewCount++;

        // Contar clicks (interacciones de tipo click)
        const clicks = summaryInteractions.filter(i =>
          i.interaction_type.includes('click')
        );
        patternsByHour[hour].clickCount += clicks.length > 0 ? 1 : 0;

        // Calcular tiempo de respuesta promedio
        const firstInteraction = summaryInteractions.sort((a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )[0];

        const responseTime = (
          new Date(firstInteraction.created_at).getTime() -
          new Date(summary.created_at).getTime()
        ) / (1000 * 60); // minutos

        patternsByHour[hour].avgResponseTime += responseTime;
      }

      // Contar feedback positivo
      const summaryFeedback = feedback?.filter(f => f.summary_id === summary.id && f.was_helpful);
      if (summaryFeedback && summaryFeedback.length > 0) {
        patternsByHour[hour].helpfulCount++;
      }
    });

    // Calcular métricas finales
    Object.values(patternsByHour).forEach(pattern => {
      if (pattern.totalSummaries > 0) {
        pattern.ctr = (pattern.clickCount / pattern.totalSummaries) * 100;
        pattern.avgResponseTime = pattern.avgResponseTime / pattern.totalSummaries;

        // Score: CTR tiene 70% de peso, rapidez de respuesta 30%
        // Rapidez: invertido (menos minutos = mejor score)
        const rapidezScore = Math.max(0, 100 - pattern.avgResponseTime);
        pattern.score = (pattern.ctr * 0.7) + (rapidezScore * 0.3);
      }
    });

    // --- 5. Obtener Configuración Actual ---
    const { data: userPrefs } = await supabase
      .from('user_preferences')
      .select('daily_summary_time')
      .eq('user_id', user.id)
      .single();

    const currentTime = userPrefs?.daily_summary_time || '07:00:00';
    const currentHour = parseInt(currentTime.split(':')[0]);
    const currentPattern = patternsByHour[currentHour];

    // --- 6. Encontrar Mejor Horario ---
    const sortedPatterns = Object.values(patternsByHour)
      .filter(p => p.totalSummaries >= 3) // Al menos 3 muestras
      .sort((a, b) => b.score - a.score);

    const bestPattern = sortedPatterns[0];

    // --- 7. Generar Sugerencias e Insights ---
    const insights: string[] = [];
    const topThree = sortedPatterns.slice(0, 3);

    if (topThree.length > 0) {
      insights.push(
        `Tu mejor horario es ${topThree[0].hour}:00 - ${topThree[0].hour + 1}:00 con ${Math.round(topThree[0].ctr)}% CTR`
      );

      if (topThree.length >= 3) {
        insights.push(
          `Tus 3 mejores horarios son: ${topThree.map(p => `${p.hour}:00 (${Math.round(p.ctr)}%)`).join(', ')}`
        );
      }

      if (currentPattern.score > 0) {
        const improvement = ((bestPattern.score - currentPattern.score) / currentPattern.score) * 100;
        if (improvement > 15) {
          insights.push(
            `Cambiar de ${currentHour}:00 a ${bestPattern.hour}:00 podría mejorar tu engagement en ${Math.round(improvement)}%`
          );
        }
      }
    }

    // --- 8. Decidir si Recomendar Cambio ---
    const shouldChange =
      bestPattern &&
      currentPattern.score > 0 &&
      bestPattern.hour !== currentHour &&
      ((bestPattern.score - currentPattern.score) / currentPattern.score) > 0.15; // >15% mejora

    // --- 9. Construir Respuesta ---
    return NextResponse.json({
      hasEnoughData: true,
      dataPoints: summaries.length,
      currentSchedule: {
        time: currentTime,
        ctr: Math.round(currentPattern.ctr),
      },
      suggestedSchedule: bestPattern ? {
        time: `${bestPattern.hour.toString().padStart(2, '0')}:00:00`,
        ctr: Math.round(bestPattern.ctr),
        potentialImprovement: currentPattern.score > 0
          ? ((bestPattern.score - currentPattern.score) / currentPattern.score) * 100
          : 0,
      } : null,
      shouldChange,
      recommendation: shouldChange
        ? `Basado en tus patrones, cambiar a las ${bestPattern.hour}:00 podría aumentar tu engagement.`
        : `Tu horario actual (${currentTime.substring(0, 5)}) ya es óptimo según tus patrones de uso.`,
      insights,
      topThreeSchedules: topThree.map(p => ({
        time: `${p.hour.toString().padStart(2, '0')}:00:00`,
        ctr: Math.round(p.ctr),
        score: Math.round(p.score),
      })),
    });

  } catch (error: any) {
    console.error('Error en schedule-suggestions:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    );
  }
}

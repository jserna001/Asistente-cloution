import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * FASE 4: Análisis de Tendencias de Productividad
 *
 * GET /api/analytics/productivity-trends?period=week|month
 *
 * Analiza patrones históricos de productividad y genera insights automáticos:
 * - Tareas completadas por período
 * - Comparación con período anterior
 * - Día más productivo
 * - Horas más productivas
 * - Categorías más trabajadas
 * - Tendencias de urgencia
 */

interface DayStats {
  dayOfWeek: string;
  date: string;
  taskCount: number;
  urgentCount: number;
}

interface HourStats {
  hour: string;
  taskCount: number;
}

interface TrendAnalysis {
  period: 'week' | 'month';
  totalTasks: number;
  completedTasks: number;
  urgentTasks: number;
  completionRate: number;
  vsLastPeriod: {
    tasksChange: number;
    completionRateChange: number;
  };
  mostProductiveDay: {
    day: string;
    date: string;
    taskCount: number;
  };
  busiestHours: HourStats[];
  dailyBreakdown: DayStats[];
  insights: string[];
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

    // Obtener parámetro de período
    const url = new URL(req.url);
    const period = (url.searchParams.get('period') || 'week') as 'week' | 'month';
    const daysToAnalyze = period === 'month' ? 30 : 7;

    // --- 1. Obtener Resúmenes del Período ---
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysToAnalyze);
    startDate.setHours(0, 0, 0, 0);

    const { data: summaries, error: summariesError } = await supabase
      .from('daily_summaries')
      .select('id, created_at, summary_text')
      .eq('user_id', user.id)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    if (summariesError) {
      return NextResponse.json(
        { error: 'Error obteniendo resúmenes', details: summariesError },
        { status: 500 }
      );
    }

    if (!summaries || summaries.length === 0) {
      return NextResponse.json({
        success: true,
        message: `No hay datos suficientes para el análisis (mínimo 3 días de resúmenes)`,
        hasEnoughData: false
      });
    }

    const summaryIds = summaries.map(s => s.id);

    // --- 2. Obtener Interacciones del Período ---
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

    const totalInteractions = interactions?.length || 0;

    // --- 3. Análisis por Día de la Semana ---
    const dayStats: { [key: string]: DayStats } = {};
    const hourStats: { [key: string]: number } = {};

    summaries.forEach(summary => {
      const summaryDate = new Date(summary.created_at);
      const dayOfWeek = summaryDate.toLocaleDateString('es-ES', { weekday: 'long' });
      const dateStr = summaryDate.toISOString().split('T')[0];

      if (!dayStats[dateStr]) {
        dayStats[dateStr] = {
          dayOfWeek: dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1),
          date: dateStr,
          taskCount: 0,
          urgentCount: 0
        };
      }

      // Contar interacciones de este resumen
      const summaryInteractions = interactions?.filter(i => i.summary_id === summary.id) || [];
      dayStats[dateStr].taskCount += summaryInteractions.length;

      // Detectar tareas urgentes en el texto del resumen (heurística simple)
      if (summary.summary_text.toLowerCase().includes('urgent') ||
          summary.summary_text.toLowerCase().includes('alta prioridad')) {
        dayStats[dateStr].urgentCount++;
      }

      // Análisis de horas
      summaryInteractions.forEach(interaction => {
        const interactionDate = new Date(interaction.created_at);
        const hour = `${interactionDate.getHours()}:00-${interactionDate.getHours() + 1}:00`;
        hourStats[hour] = (hourStats[hour] || 0) + 1;
      });
    });

    const dailyBreakdown = Object.values(dayStats).sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const busiestHours = Object.entries(hourStats)
      .map(([hour, count]) => ({ hour, taskCount: count }))
      .sort((a, b) => b.taskCount - a.taskCount)
      .slice(0, 3);

    // --- 4. Día Más Productivo ---
    const mostProductiveDay = dailyBreakdown.reduce((max, day) =>
      day.taskCount > max.taskCount ? day : max,
      dailyBreakdown[0] || { dayOfWeek: 'N/A', date: '', taskCount: 0 }
    );

    // --- 5. Calcular Métricas Globales ---
    const totalTasks = dailyBreakdown.reduce((sum, day) => sum + day.taskCount, 0);
    const urgentTasks = dailyBreakdown.reduce((sum, day) => sum + day.urgentCount, 0);
    const completedTasks = totalTasks; // Por ahora asumimos que todas las interacciones son completadas
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    // --- 6. Comparación con Período Anterior ---
    const previousStartDate = new Date(startDate);
    previousStartDate.setDate(previousStartDate.getDate() - daysToAnalyze);

    const { data: previousSummaries } = await supabase
      .from('daily_summaries')
      .select('id')
      .eq('user_id', user.id)
      .gte('created_at', previousStartDate.toISOString())
      .lt('created_at', startDate.toISOString());

    const previousSummaryIds = previousSummaries?.map(s => s.id) || [];

    const { data: previousInteractions } = await supabase
      .from('summary_interactions')
      .select('id')
      .in('summary_id', previousSummaryIds);

    const previousTotalTasks = previousInteractions?.length || 0;
    const tasksChange = previousTotalTasks > 0
      ? ((totalTasks - previousTotalTasks) / previousTotalTasks) * 100
      : 0;

    // --- 7. Generar Insights Automáticos ---
    const insights: string[] = [];

    // Insight 1: Comparación con período anterior
    if (tasksChange > 10) {
      insights.push(`¡Excelente trabajo! Completaste ${Math.round(tasksChange)}% más tareas que ${period === 'week' ? 'la semana pasada' : 'el mes pasado'}.`);
    } else if (tasksChange < -10) {
      insights.push(`Tuviste ${Math.round(Math.abs(tasksChange))}% menos actividad que ${period === 'week' ? 'la semana pasada' : 'el mes pasado'} - considera revisar tus prioridades.`);
    }

    // Insight 2: Día más productivo
    if (mostProductiveDay && mostProductiveDay.taskCount > totalTasks * 0.3) {
      insights.push(`${mostProductiveDay.dayOfWeek} es tu día más productivo - considera agendar tareas difíciles ese día.`);
    }

    // Insight 3: Mejores horarios
    if (busiestHours.length > 0) {
      const topHour = busiestHours[0];
      const hoursList = busiestHours.map(h => `${h.hour} (${h.taskCount} interacciones)`).join(', ');
      insights.push(`Tus mejores horarios son: ${hoursList}.`);
    }

    // Insight 4: Tendencia de urgencia
    const urgentRatio = totalTasks > 0 ? (urgentTasks / totalTasks) * 100 : 0;
    if (urgentRatio > 20) {
      insights.push(`Muchas tareas urgentes (${Math.round(urgentRatio)}%) - considera mejor planificación.`);
    } else if (urgentRatio < 10) {
      insights.push(`¡Bien! Pocas tareas urgentes (${Math.round(urgentRatio)}%) = buena planificación.`);
    }

    // --- 8. Construir Respuesta ---
    const analysis: TrendAnalysis = {
      period,
      totalTasks,
      completedTasks,
      urgentTasks,
      completionRate,
      vsLastPeriod: {
        tasksChange,
        completionRateChange: 0 // Simplificado por ahora
      },
      mostProductiveDay: {
        day: mostProductiveDay.dayOfWeek,
        date: mostProductiveDay.date,
        taskCount: mostProductiveDay.taskCount
      },
      busiestHours,
      dailyBreakdown,
      insights
    };

    return NextResponse.json({
      success: true,
      analysis
    });

  } catch (error: any) {
    console.error('Error en productivity-trends:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    );
  }
}

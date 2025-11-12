import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * FASE 3: Smart Scheduling - Auto-optimización de Horario
 *
 * POST /api/user/optimize-summary-schedule
 *
 * Aplica automáticamente el mejor horario basado en análisis de engagement.
 * Llama al endpoint de suggestions y actualiza user_preferences.
 */

export async function POST(req: Request) {
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

    // 1. Obtener sugerencias del endpoint de análisis
    const suggestionsUrl = new URL('/api/user/schedule-suggestions', req.url);
    const suggestionsResponse = await fetch(suggestionsUrl.toString(), {
      headers: {
        'Authorization': authHeader
      }
    });

    if (!suggestionsResponse.ok) {
      return NextResponse.json({
        error: 'Error obteniendo sugerencias',
        details: await suggestionsResponse.text()
      }, { status: 500 });
    }

    const suggestions = await suggestionsResponse.json();

    // 2. Verificar si hay suficientes datos
    if (!suggestions.hasEnoughData) {
      return NextResponse.json({
        success: false,
        error: 'Datos insuficientes',
        message: 'Se necesitan al menos 7 días de resúmenes con interacciones para optimizar el horario.',
        dataPoints: suggestions.dataPoints || 0
      }, { status: 400 });
    }

    // 3. Verificar si el cambio es recomendable
    if (!suggestions.shouldChange) {
      return NextResponse.json({
        success: true,
        alreadyOptimal: true,
        message: 'Tu horario actual ya es óptimo. No se realizaron cambios.',
        currentSchedule: suggestions.currentSchedule,
        analysis: suggestions.recommendation
      });
    }

    // 4. Aplicar el nuevo horario
    const newTime = suggestions.suggestedSchedule.time;

    const { error: updateError } = await supabase
      .from('user_preferences')
      .update({
        daily_summary_time: newTime,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('[OPTIMIZE SCHEDULE] Error updating preferences:', updateError);
      return NextResponse.json({
        error: 'Error actualizando preferencias',
        details: updateError.message
      }, { status: 500 });
    }

    // 5. Registrar el cambio en un log (opcional - para analytics futuros)
    console.log(`[OPTIMIZE SCHEDULE] Usuario ${userId} cambió horario de ${suggestions.currentSchedule.time} a ${newTime}`);

    return NextResponse.json({
      success: true,
      optimized: true,
      message: `Horario optimizado exitosamente. Tu resumen ahora llegará a las ${newTime.substring(0, 5)}.`,
      previousSchedule: {
        time: suggestions.currentSchedule.time,
        ctr: suggestions.currentSchedule.ctr
      },
      newSchedule: {
        time: newTime,
        ctr: suggestions.suggestedSchedule.ctr,
        potentialImprovement: `+${Math.round(suggestions.suggestedSchedule.potentialImprovement)}%`
      },
      analysis: {
        recommendation: suggestions.recommendation,
        insights: suggestions.insights
      }
    });

  } catch (error: any) {
    console.error('[OPTIMIZE SCHEDULE] Error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * GET /api/user/optimize-summary-schedule
 *
 * Retorna el estado de la última optimización (si existe)
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

    // Obtener preferencias actuales
    const { data: prefs, error: prefsError } = await supabase
      .from('user_preferences')
      .select('daily_summary_time, updated_at')
      .eq('user_id', userId)
      .single();

    if (prefsError) {
      return NextResponse.json({
        error: 'Error fetching preferences',
        details: prefsError.message
      }, { status: 500 });
    }

    // Obtener sugerencias actuales
    const suggestionsUrl = new URL('/api/user/schedule-suggestions', req.url);
    const suggestionsResponse = await fetch(suggestionsUrl.toString(), {
      headers: {
        'Authorization': authHeader
      }
    });

    if (!suggestionsResponse.ok) {
      return NextResponse.json({
        success: false,
        error: 'Error obteniendo sugerencias'
      }, { status: 500 });
    }

    const suggestions = await suggestionsResponse.json();

    return NextResponse.json({
      success: true,
      currentSchedule: {
        time: prefs.daily_summary_time,
        lastUpdated: prefs.updated_at
      },
      optimization: {
        isOptimal: !suggestions.shouldChange,
        potentialImprovement: suggestions.suggestedSchedule?.potentialImprovement || 0,
        suggestedTime: suggestions.suggestedSchedule?.time || prefs.daily_summary_time,
        hasEnoughData: suggestions.hasEnoughData,
        dataPoints: suggestions.dataPoints
      }
    });

  } catch (error: any) {
    console.error('[OPTIMIZE SCHEDULE GET] Error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

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

    // --- 1. Obtener Sugerencias ---
    const suggestionsResponse = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('/rest/v1', '')}/api/user/schedule-suggestions`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (!suggestionsResponse.ok) {
      return NextResponse.json(
        { error: 'Error obteniendo sugerencias' },
        { status: 500 }
      );
    }

    const suggestions = await suggestionsResponse.json();

    // --- 2. Validar que hay Datos Suficientes ---
    if (!suggestions.hasEnoughData) {
      return NextResponse.json({
        success: false,
        message: suggestions.message,
      });
    }

    // --- 3. Validar que Vale la Pena Cambiar ---
    if (!suggestions.shouldChange) {
      return NextResponse.json({
        success: true,
        changed: false,
        message: suggestions.recommendation,
        currentSchedule: suggestions.currentSchedule,
      });
    }

    // --- 4. Actualizar Configuración ---
    const { error: updateError } = await supabase
      .from('user_preferences')
      .update({
        daily_summary_time: suggestions.suggestedSchedule.time,
      })
      .eq('user_id', user.id);

    if (updateError) {
      // Si no existe registro, insertar
      if (updateError.code === 'PGRST116') {
        const { error: insertError } = await supabase
          .from('user_preferences')
          .insert({
            user_id: user.id,
            daily_summary_time: suggestions.suggestedSchedule.time,
            daily_summary_enabled: true,
            timezone: 'America/New_York', // Default
          });

        if (insertError) {
          return NextResponse.json(
            { error: 'Error actualizando preferencias', details: insertError },
            { status: 500 }
          );
        }
      } else {
        return NextResponse.json(
          { error: 'Error actualizando preferencias', details: updateError },
          { status: 500 }
        );
      }
    }

    // --- 5. Retornar Confirmación ---
    return NextResponse.json({
      success: true,
      changed: true,
      message: `Horario optimizado exitosamente de ${suggestions.currentSchedule.time.substring(0, 5)} a ${suggestions.suggestedSchedule.time.substring(0, 5)}`,
      previousSchedule: suggestions.currentSchedule,
      newSchedule: suggestions.suggestedSchedule,
      improvement: suggestions.suggestedSchedule.potentialImprovement,
      insights: suggestions.insights,
    });

  } catch (error: any) {
    console.error('Error en optimize-summary-schedule:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    );
  }
}

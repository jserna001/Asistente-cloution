import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/summaries/[id]/feedback
 * Permite al usuario enviar feedback sobre un resumen diario
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: summaryId } = await params;

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

    // 2. Parsear body
    const body = await request.json();
    const {
      rating,
      was_helpful,
      feedback_text,
      feedback_tags
    } = body;

    // 3. Validar datos
    if (rating !== undefined && (rating < 1 || rating > 5)) {
      return NextResponse.json(
        { error: 'Rating debe estar entre 1 y 5' },
        { status: 400 }
      );
    }

    if (was_helpful === undefined && rating === undefined) {
      return NextResponse.json(
        { error: 'Debes proporcionar al menos was_helpful o rating' },
        { status: 400 }
      );
    }

    // 4. Verificar que el resumen pertenece al usuario
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: summary, error: summaryError } = await supabase
      .from('daily_summaries')
      .select('id, user_id')
      .eq('id', summaryId)
      .maybeSingle();

    if (summaryError) {
      return NextResponse.json(
        { error: 'Error verificando resumen', details: summaryError.message },
        { status: 500 }
      );
    }

    if (!summary) {
      return NextResponse.json(
        { error: 'Resumen no encontrado' },
        { status: 404 }
      );
    }

    if (summary.user_id !== userId) {
      return NextResponse.json(
        { error: 'No tienes permiso para dar feedback a este resumen' },
        { status: 403 }
      );
    }

    // 5. Insertar o actualizar feedback
    const { data: feedback, error: feedbackError } = await supabase
      .from('summary_feedback')
      .upsert({
        user_id: userId,
        summary_id: summaryId,
        rating: rating || null,
        was_helpful: was_helpful !== undefined ? was_helpful : null,
        feedback_text: feedback_text || null,
        feedback_tags: feedback_tags || null
      }, {
        onConflict: 'user_id,summary_id'
      })
      .select()
      .single();

    if (feedbackError) {
      return NextResponse.json(
        { error: 'Error guardando feedback', details: feedbackError.message },
        { status: 500 }
      );
    }

    console.log(`[FEEDBACK] Usuario ${userId} dio feedback a resumen ${summaryId}: ${was_helpful ? '👍' : '👎'}`);

    return NextResponse.json({
      success: true,
      feedback: {
        id: feedback.id,
        rating: feedback.rating,
        was_helpful: feedback.was_helpful,
        created_at: feedback.created_at
      }
    });

  } catch (error: any) {
    console.error('[FEEDBACK] Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/summaries/[id]/feedback
 * Obtiene el feedback del usuario para un resumen específico
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: summaryId } = await params;

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

    // 2. Obtener feedback
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: feedback, error: feedbackError } = await supabase
      .from('summary_feedback')
      .select('*')
      .eq('user_id', userId)
      .eq('summary_id', summaryId)
      .maybeSingle();

    if (feedbackError) {
      return NextResponse.json(
        { error: 'Error obteniendo feedback', details: feedbackError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      feedback: feedback || null
    });

  } catch (error: any) {
    console.error('[FEEDBACK] Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    );
  }
}

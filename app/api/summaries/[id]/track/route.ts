import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/summaries/[id]/track
 * Registra una interacción del usuario con el resumen
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const summaryId = params.id;

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
      interaction_type,
      target_id,
      target_url,
      metadata
    } = body;

    // 3. Validar datos
    const validTypes = ['view', 'click_notion', 'click_gmail', 'click_calendar', 'copy_text'];
    if (!validTypes.includes(interaction_type)) {
      return NextResponse.json(
        { error: `Tipo de interacción inválido. Debe ser uno de: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // 4. Registrar interacción
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: interaction, error: insertError } = await supabase
      .from('summary_interactions')
      .insert({
        user_id: userId,
        summary_id: summaryId,
        interaction_type,
        target_id: target_id || null,
        target_url: target_url || null,
        metadata: metadata || null
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: 'Error registrando interacción', details: insertError.message },
        { status: 500 }
      );
    }

    console.log(`[TRACK] Usuario ${userId} - ${interaction_type} en resumen ${summaryId}`);

    return NextResponse.json({
      success: true,
      interaction_id: interaction.id
    });

  } catch (error: any) {
    console.error('[TRACK] Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/summaries/[id]/track
 * Obtiene las interacciones del usuario con un resumen específico
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const summaryId = params.id;

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

    // 2. Obtener interacciones
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: interactions, error: fetchError } = await supabase
      .from('summary_interactions')
      .select('*')
      .eq('user_id', userId)
      .eq('summary_id', summaryId)
      .order('created_at', { ascending: false });

    if (fetchError) {
      return NextResponse.json(
        { error: 'Error obteniendo interacciones', details: fetchError.message },
        { status: 500 }
      );
    }

    // Agrupar por tipo
    const byType: Record<string, number> = {};
    interactions?.forEach(i => {
      byType[i.interaction_type] = (byType[i.interaction_type] || 0) + 1;
    });

    return NextResponse.json({
      total: interactions?.length || 0,
      interactions: interactions || [],
      by_type: byType
    });

  } catch (error: any) {
    console.error('[TRACK] Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    );
  }
}

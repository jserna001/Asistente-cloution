import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Endpoint para guardar sesiones de chat vía sendBeacon (al cerrar página)
export async function POST(request: NextRequest) {
  try {
    // Leer datos de la sesión
    const sessionData = await request.json();

    // Obtener token del body (porque sendBeacon no puede enviar headers custom)
    const token = sessionData.token;

    if (!token) {
      return NextResponse.json(
        { error: 'No autorizado - token faltante' },
        { status: 401 }
      );
    }

    // Crear cliente Supabase con token del usuario
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    // Verificar usuario
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Usuario no autenticado' },
        { status: 401 }
      );
    }

    // Validar datos mínimos
    if (!sessionData.messages || sessionData.message_count < 4) {
      return NextResponse.json(
        { message: 'Sesión no cumple criterios mínimos' },
        { status: 200 } // 200 porque no es un error, solo no se guarda
      );
    }

    // Preparar datos para insertar
    const insertData = {
      user_id: user.id,
      session_start: sessionData.session_start,
      session_end: sessionData.session_end,
      message_count: sessionData.message_count,
      messages: sessionData.messages,
      metadata: sessionData.metadata || {},
    };

    // Insertar sesión
    const { error: insertError } = await supabase
      .from('chat_sessions')
      .insert(insertData);

    if (insertError) {
      console.error('Error insertando sesión:', insertError);
      return NextResponse.json(
        { error: 'Error guardando sesión', details: insertError.message },
        { status: 500 }
      );
    }

    // Limpiar sesiones antiguas (mantener solo últimas 50)
    try {
      await supabase.rpc('cleanup_old_chat_sessions');
    } catch (cleanupError) {
      // No es crítico si falla el cleanup
      console.error('Error en cleanup:', cleanupError);
    }

    return NextResponse.json({
      message: 'Sesión guardada exitosamente',
      message_count: sessionData.message_count,
    });
  } catch (error) {
    console.error('Error en save-session:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

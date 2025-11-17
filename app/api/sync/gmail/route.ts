import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GmailSyncService } from '@/lib/gmailService';

/**
 * Endpoint para sincronizar Gmail manualmente desde la UI
 *
 * POST /api/sync/gmail
 * Headers: Authorization: Bearer {supabase_token}
 * Body: { forceFullSync?: boolean }
 *
 * Respuesta:
 * {
 *   success: boolean,
 *   emailsProcessed: number,
 *   emailsSkipped: number,
 *   syncType: 'initial' | 'incremental',
 *   duration: number,
 *   lastSyncAt: string,
 *   error?: string
 * }
 */

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Validar variables de entorno
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!supabaseUrl || !supabaseServiceKey || !geminiApiKey) {
      return NextResponse.json(
        { success: false, error: 'Configuración del servidor incompleta' },
        { status: 500 }
      );
    }

    // 2. Autenticar usuario
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'No autorizado - Token faltante' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'No autorizado - Token inválido' },
        { status: 401 }
      );
    }

    const userId = user.id;
    console.log(`[API /sync/gmail] Solicitud de sincronización del usuario: ${userId}`);

    // 3. Parsear body
    const body = await request.json().catch(() => ({}));
    const forceFullSync = body.forceFullSync === true;

    // 4. Verificar que el usuario tenga credenciales de Google
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);
    const { data: credentials, error: credsError } = await supabaseService
      .from('user_credentials')
      .select('service_name')
      .eq('user_id', userId)
      .eq('service_name', 'google')
      .single();

    if (credsError || !credentials) {
      return NextResponse.json({
        success: false,
        error: 'No se encontraron credenciales de Google. Por favor, vincula tu cuenta de Google primero.',
      }, { status: 400 });
    }

    // 5. Ejecutar sincronización
    const gmailService = new GmailSyncService(supabaseUrl, supabaseServiceKey, geminiApiKey);
    const result = await gmailService.syncUserGmail(userId, forceFullSync);

    // 6. Obtener información de última sincronización
    const { data: syncStatus } = await supabaseService
      .from('sync_status')
      .select('last_sync_at')
      .eq('user_id', userId)
      .eq('service_name', 'google')
      .single();

    // 7. Responder
    if (result.success) {
      return NextResponse.json({
        success: true,
        emailsProcessed: result.emailsProcessed,
        emailsSkipped: result.emailsSkipped,
        syncType: result.isFirstSync ? 'initial' : 'incremental',
        duration: result.duration,
        lastSyncAt: syncStatus?.last_sync_at || new Date().toISOString(),
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || 'Error desconocido durante la sincronización',
        emailsProcessed: result.emailsProcessed,
        emailsSkipped: result.emailsSkipped,
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('[API /sync/gmail] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor',
      duration: Date.now() - startTime,
    }, { status: 500 });
  }
}

/**
 * Obtener estado de sincronización actual
 *
 * GET /api/sync/gmail
 * Headers: Authorization: Bearer {supabase_token}
 *
 * Respuesta:
 * {
 *   hasCredentials: boolean,
 *   syncEnabled: boolean,
 *   lastSyncAt: string | null,
 *   firstSyncCompleted: boolean,
 *   totalEmailsSynced: number,
 *   errorCount: number,
 *   lastError: string | null,
 *   config: {...}
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Configuración del servidor incompleta' }, { status: 500 });
    }

    // Autenticar
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userId = user.id;
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar credenciales
    const { data: credentials } = await supabaseService
      .from('user_credentials')
      .select('service_name')
      .eq('user_id', userId)
      .eq('service_name', 'google')
      .single();

    if (!credentials) {
      return NextResponse.json({
        hasCredentials: false,
        syncEnabled: false,
        firstSyncCompleted: false,
      });
    }

    // Obtener estado de sincronización
    const { data: syncStatus } = await supabaseService
      .from('sync_status')
      .select('*')
      .eq('user_id', userId)
      .eq('service_name', 'google')
      .single();

    // Obtener configuración
    const { data: config } = await supabaseService
      .from('gmail_sync_config')
      .select('*')
      .eq('user_id', userId)
      .single();

    return NextResponse.json({
      hasCredentials: true,
      syncEnabled: syncStatus?.sync_enabled ?? true,
      lastSyncAt: syncStatus?.last_sync_at || null,
      firstSyncCompleted: config?.first_sync_completed ?? false,
      totalEmailsSynced: config?.total_emails_synced ?? 0,
      errorCount: syncStatus?.error_count ?? 0,
      lastError: syncStatus?.last_error || null,
      config: config ? {
        maxEmailsPerSync: config.max_emails_per_sync,
        initialSyncDays: config.initial_sync_days,
        watchEnabled: config.watch_enabled,
      } : null,
    });

  } catch (error: any) {
    console.error('[API GET /sync/gmail] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GmailSyncService } from '@/lib/gmailService';

/**
 * Webhook para recibir notificaciones de Gmail Push Notifications (Google Cloud Pub/Sub)
 *
 * POST /api/webhooks/gmail
 *
 * Google Cloud Pub/Sub envía notificaciones en este formato:
 * {
 *   "message": {
 *     "data": "base64_encoded_data",
 *     "messageId": "...",
 *     "publishTime": "..."
 *   },
 *   "subscription": "..."
 * }
 *
 * El campo "data" decodificado contiene:
 * {
 *   "emailAddress": "user@gmail.com",
 *   "historyId": "12345"
 * }
 */

interface PubSubMessage {
  message: {
    data: string; // Base64 encoded
    messageId: string;
    publishTime: string;
  };
  subscription: string;
}

interface GmailNotificationData {
  emailAddress: string;
  historyId: string;
}

export async function POST(request: NextRequest) {
  try {
    console.log('[Webhook /gmail] Notificación recibida de Gmail Push');

    // 1. Validar configuración
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!supabaseUrl || !supabaseServiceKey || !geminiApiKey) {
      console.error('[Webhook /gmail] Configuración incompleta');
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    // 2. Parsear mensaje de Pub/Sub
    const body: PubSubMessage = await request.json();

    if (!body.message || !body.message.data) {
      console.error('[Webhook /gmail] Formato de mensaje inválido');
      return NextResponse.json({ error: 'Invalid message format' }, { status: 400 });
    }

    // 3. Decodificar data (base64)
    const decodedData = Buffer.from(body.message.data, 'base64').toString('utf-8');
    const notificationData: GmailNotificationData = JSON.parse(decodedData);

    console.log('[Webhook /gmail] Notificación decodificada:', notificationData);

    const { emailAddress, historyId } = notificationData;

    if (!emailAddress || !historyId) {
      console.error('[Webhook /gmail] Datos faltantes en notificación');
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 4. Buscar el usuario por email
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Primero buscamos en auth.users el usuario con ese email
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();

    if (userError) {
      console.error('[Webhook /gmail] Error buscando usuarios:', userError);
      return NextResponse.json({ error: 'User lookup failed' }, { status: 500 });
    }

    const user = users.find(u => u.email === emailAddress);

    if (!user) {
      console.warn(`[Webhook /gmail] No se encontró usuario para email: ${emailAddress}`);
      // Retornar 200 para que Pub/Sub no reintente
      return NextResponse.json({ status: 'ignored', reason: 'User not found' });
    }

    const userId = user.id;
    console.log(`[Webhook /gmail] Usuario identificado: ${userId}`);

    // 5. Verificar que el watch esté habilitado para este usuario
    const { data: config } = await supabase
      .from('gmail_sync_config')
      .select('watch_enabled')
      .eq('user_id', userId)
      .single();

    if (!config?.watch_enabled) {
      console.warn(`[Webhook /gmail] Watch no habilitado para usuario ${userId}`);
      return NextResponse.json({ status: 'ignored', reason: 'Watch not enabled' });
    }

    // 6. Ejecutar sincronización incremental en segundo plano
    // NOTA: No esperamos el resultado para responder rápidamente a Pub/Sub
    const gmailService = new GmailSyncService(supabaseUrl, supabaseServiceKey, geminiApiKey);

    // Ejecutar en background (no await)
    gmailService.syncUserGmail(userId, false)
      .then(result => {
        if (result.success) {
          console.log(`[Webhook /gmail] Sincronización completada para ${userId}: ${result.emailsProcessed} emails`);
        } else {
          console.error(`[Webhook /gmail] Sincronización falló para ${userId}: ${result.error}`);
        }
      })
      .catch(error => {
        console.error(`[Webhook /gmail] Error en sincronización background:`, error);
      });

    // 7. Responder inmediatamente a Pub/Sub (200 OK)
    return NextResponse.json({
      status: 'processing',
      userId: userId,
      historyId: historyId,
    });

  } catch (error: any) {
    console.error('[Webhook /gmail] Error procesando webhook:', error);

    // Retornar 200 para evitar reintentos infinitos de Pub/Sub
    return NextResponse.json({
      status: 'error',
      error: error.message,
    }, { status: 200 });
  }
}

/**
 * Endpoint de verificación (health check)
 */
export async function GET() {
  return NextResponse.json({
    service: 'Gmail Push Notifications Webhook',
    status: 'active',
    timestamp: new Date().toISOString(),
  });
}

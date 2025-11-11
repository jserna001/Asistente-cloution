/**
 * API Endpoint: POST /api/onboarding/install-template
 *
 * Instala una plantilla predeterminada de Notion para el usuario autenticado.
 * Se llama durante el proceso de onboarding.
 *
 * Body esperado:
 * {
 *   "templatePackId": "student" | "professional" | "entrepreneur" | "freelancer" | "basic"
 * }
 *
 * Respuesta exitosa:
 * {
 *   "success": true,
 *   "message": "Plantilla instalada exitosamente",
 *   "installedIds": { "parent_page_id": "xxx", "db_tasks": "yyy", ... },
 *   "notionWorkspaceUrl": "https://notion.so/xxx"
 * }
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { installNotionTemplate } from '@/lib/services/notionTemplateService';
import { decryptToken } from '@/lib/tokenService';

// Configuración para Vercel: permitir hasta 60 segundos de ejecución
export const maxDuration = 60; // seconds
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    console.log('[API-INSTALL] Iniciando instalación de plantilla...');

    // 1. Verificar autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[API-INSTALL] ✗ No se proporcionó token de autorización');
      return NextResponse.json(
        { error: 'No autorizado - falta token' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('[API-INSTALL] ✗ Token inválido:', authError?.message);
      return NextResponse.json(
        { error: 'Token inválido o expirado' },
        { status: 401 }
      );
    }

    console.log(`[API-INSTALL] Usuario autenticado: ${user.id.substring(0, 8)}...`);

    // 2. Obtener templatePackId del body
    const body = await request.json();
    const { templatePackId } = body;

    if (!templatePackId) {
      console.error('[API-INSTALL] ✗ Falta templatePackId en el body');
      return NextResponse.json(
        { error: 'templatePackId es requerido' },
        { status: 400 }
      );
    }

    console.log(`[API-INSTALL] Plantilla solicitada: ${templatePackId}`);

    // 3. Verificar que no esté ya instalada
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: existingInstallation } = await serviceSupabase
      .from('user_notion_templates')
      .select('installation_status, installed_notion_ids')
      .eq('user_id', user.id)
      .eq('template_pack_id', templatePackId)
      .maybeSingle();

    if (existingInstallation && existingInstallation.installation_status === 'completed') {
      console.log('[API-INSTALL] ⚠ Plantilla ya instalada previamente');
      return NextResponse.json({
        success: true,
        message: 'Esta plantilla ya está instalada',
        alreadyInstalled: true,
        installedIds: existingInstallation.installed_notion_ids
      });
    }

    // 4. Obtener credenciales de Notion del usuario
    console.log('[API-INSTALL] Obteniendo credenciales de Notion...');
    const { data: creds, error: credsError } = await serviceSupabase
      .from('user_credentials')
      .select('encrypted_refresh_token, iv, auth_tag')
      .eq('user_id', user.id)
      .eq('service_name', 'notion')
      .maybeSingle();

    if (credsError || !creds) {
      console.error('[API-INSTALL] ✗ No se encontraron credenciales de Notion:', credsError?.message);
      return NextResponse.json({
        error: 'No se encontraron credenciales de Notion',
        details: 'Por favor, conecta tu cuenta de Notion primero en Settings > Conexiones',
        needsNotionAuth: true
      }, { status: 400 });
    }

    if (!creds.encrypted_refresh_token || !creds.iv || !creds.auth_tag) {
      console.error('[API-INSTALL] ✗ Datos de credenciales incompletos');
      return NextResponse.json({
        error: 'Credenciales de Notion incompletas',
        details: 'Por favor, reconecta tu cuenta de Notion',
        needsNotionAuth: true
      }, { status: 400 });
    }

    console.log('[API-INSTALL] Descifrando token de Notion...');
    const notionToken = await decryptToken(creds);
    console.log('[API-INSTALL] ✓ Token descifrado');

    // 5. Instalar plantilla
    console.log('[API-INSTALL] Iniciando instalación...');
    const result = await installNotionTemplate(user.id, notionToken, templatePackId);

    if (result.success) {
      console.log('[API-INSTALL] ✓ Instalación exitosa');

      // Construir URL de Notion
      const parentPageId = result.installedIds['parent_page_id'];
      const notionUrl = parentPageId
        ? `https://notion.so/${parentPageId.replace(/-/g, '')}`
        : null;

      return NextResponse.json({
        success: true,
        message: 'Plantilla instalada exitosamente',
        installedIds: result.installedIds,
        notionWorkspaceUrl: notionUrl,
        totalCreated: Object.keys(result.installedIds).length
      });

    } else {
      console.error('[API-INSTALL] ✗ Instalación falló:', result.error);
      return NextResponse.json({
        success: false,
        error: result.error || 'Error desconocido durante la instalación',
        details: 'Hubo un problema al crear las plantillas en Notion. Por favor, intenta nuevamente.'
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('[API-INSTALL] ✗ Error inesperado:', error);
    console.error('[API-INSTALL] Stack:', error.stack);

    return NextResponse.json({
      error: 'Error interno del servidor',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

/**
 * GET /api/onboarding/install-template?templatePackId=xxx
 * Obtiene el estado de instalación de una plantilla
 */
export async function GET(request: Request) {
  try {
    // Verificar autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Obtener templatePackId de la query
    const { searchParams } = new URL(request.url);
    const templatePackId = searchParams.get('templatePackId');

    if (!templatePackId) {
      return NextResponse.json({ error: 'templatePackId requerido' }, { status: 400 });
    }

    // Consultar estado
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await serviceSupabase
      .from('user_notion_templates')
      .select('*')
      .eq('user_id', user.id)
      .eq('template_pack_id', templatePackId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({
        installed: false,
        status: 'not_started'
      });
    }

    return NextResponse.json({
      installed: data.installation_status === 'completed',
      status: data.installation_status,
      progress: data.installation_progress,
      installedIds: data.installed_notion_ids,
      error: data.installation_error
    });

  } catch (error: any) {
    console.error('[API-INSTALL] Error en GET:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

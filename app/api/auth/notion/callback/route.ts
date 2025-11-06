import { NextResponse, type NextRequest } from 'next/server';
import { encryptTokenToObject } from '@/lib/encryption';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';


export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set(name, value, options);
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set(name, '', options);
        },
      },
    }
  );

  // Paso 1: Obtener el Usuario de forma segura
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return new NextResponse('Sesión de usuario no encontrada o inválida.', { status: 401 });
  }
  const userId = user.id;

  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/settings?status=error&error_message=El código de autorización de Notion no fue proporcionado', req.url));
  }

  // Paso 2: Intercambiar el Código
  const NOTION_CLIENT_ID = process.env.NOTION_CLIENT_ID;
  const NOTION_CLIENT_SECRET = process.env.NOTION_CLIENT_SECRET;

  if (!NOTION_CLIENT_ID || !NOTION_CLIENT_SECRET) {
    return NextResponse.redirect(new URL('/settings?status=error&error_message=Credenciales de Notion no configuradas en el servidor', req.url));
  }

  const redirectUri = process.env.NODE_ENV === 'production'
    ? 'https://asistente-justine.cloution.cloud/api/auth/notion/callback'
    : 'http://localhost:3000/api/auth/notion/callback';

  const basicAuth = Buffer.from(`${NOTION_CLIENT_ID}:${NOTION_CLIENT_SECRET}`).toString('base64');

  try {
    const response = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error_description || 'Error al obtener el token de Notion');
    }

    const accessToken = data.access_token;

    // Paso 3: Encriptar y Guardar el Token
    const { encrypted_refresh_token, iv, auth_tag } = encryptTokenToObject(accessToken);

    const dataToUpsert = {
      user_id: userId,
      service_name: 'notion',
      encrypted_refresh_token: encrypted_refresh_token,
      iv: iv,
      auth_tag: auth_tag,
    };

    const { error: dbError } = await supabase
      .from('user_credentials')
      .upsert(dataToUpsert, { onConflict: 'user_id, service_name' });

    if (dbError) {
      throw dbError;
    }

    // Paso 4: Redirigir
    return NextResponse.redirect(new URL('/settings?status=notion_connected', req.url));

  } catch (error) {
    console.error('Error en el callback de Notion:', error);
    const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error desconocido';
    return NextResponse.redirect(new URL(`/settings?status=error&error_message=${encodeURIComponent(errorMessage)}`, req.url));
  }
}

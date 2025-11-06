import { NextRequest, NextResponse } from 'next/server';
import { getGoogleOAuthClient } from '@/lib/googleAuth';
import { encryptTokenToObject } from '@/lib/encryption';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';


/**
 * Handler para la ruta GET /api/auth/google/callback.
 *
 * Procesa el callback de Google, autentica al usuario en Supabase,
 * y guarda de forma segura el refresh_token.
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'El código de autorización es requerido' }, { status: 400 });
  }

  try {
    // 1. Intercambiar el código de autorización por tokens de Google.
    const oauth2Client = getGoogleOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.id_token || !tokens.refresh_token) {
      throw new Error('No se recibieron los tokens necesarios de Google.');
    }

    // 2. Autenticar al usuario en Supabase usando el id_token de Google.
    // WORKAROUND: Forzar la espera de la promesa de cookies debido a un entorno de ejecución anómalo.
    const cookieStore = await (cookies() as any);

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

    const { data: { user }, error: authError } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: tokens.id_token,
    });

    if (authError) {
      console.error('Error al autenticar con Supabase:', authError);
      throw authError;
    }

    if (!user) {
      throw new Error('No se pudo obtener el usuario de Supabase después de la autenticación.');
    }

    // 3. Encriptar y guardar el refresh_token en la base de datos.
    const { encrypted_refresh_token, iv, auth_tag } = encryptTokenToObject(tokens.refresh_token);

    const dataToUpsert = {
      user_id: user.id, // Usar el UUID del usuario de Supabase
      service_name: 'google',
      encrypted_refresh_token: encrypted_refresh_token,
      iv: iv,
      auth_tag: auth_tag,
    };

    const { error: dbError } = await supabase
      .from('user_credentials')
      .upsert(dataToUpsert, { onConflict: 'user_id, service_name' });

    if (dbError) {
      console.error('Error al guardar las credenciales en Supabase:', dbError);
      throw dbError;
    }

    // 4. Redirigir al usuario a la página principal con un estado de éxito.
    return NextResponse.redirect(`${origin}/?status=success`);

  } catch (error) {
    console.error('Error en el callback de Google OAuth:', error);
    const redirectUrl = new URL('/?status=error', req.url);
    if (error instanceof Error) {
      redirectUrl.searchParams.set('error_message', error.message);
    }
    return NextResponse.redirect(redirectUrl);
  }
}
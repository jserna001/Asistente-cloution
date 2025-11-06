
import { NextResponse } from 'next/server';
import { getGoogleOAuthClient, requiredScopes } from '@/lib/googleAuth';

/**
 * Handler para la ruta GET /api/auth/google/redirect.
 *
 * Inicia el flujo de autenticación OAuth 2.0 con Google.
 * Genera una URL de consentimiento y redirige al usuario a esa URL.
 */
export async function GET() {
  // 1. Obtener el cliente de Google OAuth configurado.
  const oauth2Client = getGoogleOAuthClient();

  // 2. Generar la URL de autorización.
  // Es CRÍTICO incluir `access_type: 'offline'` y `prompt: 'consent'`
  // para asegurar que Google nos devuelva un refresh_token cada vez.
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Solicita un refresh_token.
    prompt: 'consent',      // Pide consentimiento al usuario aunque ya lo haya dado antes.
    scope: requiredScopes   // Los permisos que solicitamos.
  });

  // 3. Redirigir al usuario a la página de consentimiento de Google.
  return NextResponse.redirect(authUrl);
}

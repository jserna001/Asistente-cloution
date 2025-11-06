import { google, Auth } from 'googleapis';
import { decryptToken } from './encryption';

// Scopes requeridos para la aplicación
export const requiredScopes = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

// Función sobrecargada para soportar ambos casos de uso
export function getGoogleOAuthClient(): Auth.OAuth2Client;
export function getGoogleOAuthClient(supabase: any, userId: string): Promise<Auth.OAuth2Client>;
export function getGoogleOAuthClient(supabase?: any, userId?: string): Auth.OAuth2Client | Promise<Auth.OAuth2Client> {
  // Caso 1: Sin parámetros - para el flujo OAuth inicial (redirect)
  if (!supabase && !userId) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback'
    );
    return oauth2Client;
  }

  // Caso 2: Con parámetros - para obtener cliente autenticado con credenciales del usuario
  return getAuthenticatedGoogleClient(supabase!, userId!);
}

async function getAuthenticatedGoogleClient(supabase: any, userId: string): Promise<Auth.OAuth2Client> {
  console.log(`Obteniendo credenciales de Google para el usuario: ${userId}`);

  // 1. Buscar las credenciales encriptadas del usuario en Supabase
  const { data: credential, error: dbError } = await supabase
    .from('user_credentials')
    .select('encrypted_refresh_token, iv, auth_tag')
    .eq('user_id', userId)
    .eq('service_name', 'google')
    .single();

  if (dbError || !credential) {
    console.error('Error buscando el token de Google:', dbError);
    throw new Error(`No se encontraron credenciales de Google para este usuario.`);
  }

  // 2. Descifrar el refresh_token
  const decryptedRefreshToken = decryptToken(credential);

  // 3. Crear el cliente OAuth2
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback'
  );

  // 4. Establecer el refresh_token en el cliente
  oauth2Client.setCredentials({
    refresh_token: decryptedRefreshToken,
  });

  return oauth2Client;
}

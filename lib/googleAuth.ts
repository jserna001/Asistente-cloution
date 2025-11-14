import { google, Auth } from 'googleapis';
import { decryptToken } from './encryption';

// ========================================
// ESTRATEGIA DE CONSENTIMIENTO INCREMENTAL
// ========================================
// Implementamos incremental authorization para cumplir mejores prácticas de Google.
// Ver: OAUTH_TROUBLESHOOTING.md para detalles.

// Scopes NO sensibles (NO requieren verificación de Google)
// Estos se solicitan en el login inicial
export const initialScopes = [
  // User Info (siempre requerido)
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',

  // Gmail - Solo lectura (NO sensible)
  'https://www.googleapis.com/auth/gmail.readonly',      // Lectura de correos ✅

  // Calendar - Solo lectura (NO sensible)
  'https://www.googleapis.com/auth/calendar.readonly',   // Lectura de calendario ✅

  // Google Contacts - Solo lectura (NO sensible)
  'https://www.googleapis.com/auth/contacts.readonly',   // Lectura de contactos ✅

  // Google Drive - Solo archivos de la app (NO sensible)
  'https://www.googleapis.com/auth/drive.file',          // Archivos creados por la app ✅
];

// Scopes RESTRINGIDOS (REQUIEREN verificación de Google - 2-6 semanas)
// Estos se solicitarán on-demand cuando el usuario intente usar la funcionalidad
export const restrictedScopes = [
  // Gmail - Escritura (RESTRINGIDO)
  'https://www.googleapis.com/auth/gmail.send',          // Enviar correos ⚠️
  'https://www.googleapis.com/auth/gmail.compose',       // Crear/modificar borradores ⚠️

  // Calendar - Lectura y escritura (RESTRINGIDO)
  'https://www.googleapis.com/auth/calendar',            // Acceso completo al calendario ⚠️
  'https://www.googleapis.com/auth/calendar.events',     // Crear/modificar/eliminar eventos ⚠️

  // Google Tasks (RESTRINGIDO)
  'https://www.googleapis.com/auth/tasks',               // Acceso completo a tareas ⚠️
];

// SCOPES ACTUALES: Por ahora solo usamos los NO sensibles
// Esto permite que Gmail Read, Calendar Read y Contacts funcionen sin verificación
export const requiredScopes = initialScopes;

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

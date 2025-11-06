
// Carga las variables de entorno desde .env.local
import { config } from 'dotenv';
config({ path: './.env.local' });

import { createClient } from '@supabase/supabase-js';
import { decryptToken, EncryptedToken } from '../lib/tokenService';
import { google } from 'googleapis';

/**
 * Script de prueba manual para verificar la desencriptación de un refresh_token
 * y su validez haciendo una llamada a la API de Google.
 */
async function testToken() {
  console.log('--- Iniciando prueba de desencriptación y API de Google ---');

  try {
    // 1. Validar que las variables de entorno necesarias estén cargadas.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!supabaseUrl || !supabaseAnonKey || !googleClientId || !googleClientSecret) {
      throw new Error('Faltan variables de entorno críticas. Asegúrate de que .env.local esté configurado.');
    }

    // 2. Crear un cliente de Supabase.
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    console.log('Cliente de Supabase creado.');

    // 3. Obtener las credenciales encriptadas de la base de datos.
    const { data, error } = await supabase
      .from('user_credentials')
      .select('encrypted_refresh_token, iv, auth_tag')
      .eq('service_name', 'google')
      .limit(1)
      .single(); // .single() es más conveniente que .limit(1)

    if (error || !data) {
      throw new Error(`No se encontraron credenciales para el servicio 'google'. Error: ${error?.message}`);
    }
    console.log('Credenciales encriptadas obtenidas de Supabase.');

    // 4. Desencriptar el token.
    const encryptedData: EncryptedToken = data;
    const decryptedToken = await decryptToken(encryptedData);
    console.log('✅ Token descifrado con éxito.');

    // 5. Verificar el token haciendo una llamada a la API de Google.
    console.log('Verificando el token con la API de Google...');
    const oauth2Client = new google.auth.OAuth2(
      googleClientId,
      googleClientSecret
    );

    oauth2Client.setCredentials({ refresh_token: decryptedToken });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const res = await gmail.users.getProfile({ userId: 'me' });

    if (res.data.emailAddress) {
      console.log(`✅ ¡Llamada a la API de Google exitosa! Correo: ${res.data.emailAddress}`);
    } else {
      throw new Error('La llamada a la API de Google fue exitosa pero no se obtuvo el email.');
    }

    console.log('--- Prueba completada con éxito ---');

  } catch (error) {
    console.error('❌ Ocurrió un error durante la prueba:', error);
    process.exit(1); // Termina el script con un código de error.
  }
}

// Ejecutar la función de prueba.
testToken();

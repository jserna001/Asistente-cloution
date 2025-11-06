// lib/tokenService.ts
import { decryptToken as decryptTokenRaw } from './encryption';

/**
 * Interfaz para los datos de token almacenados en Supabase
 */
interface EncryptedTokenData {
  encrypted_refresh_token: string;
  iv: string;
  auth_tag: string;
}

/**
 * Descifra un token de refresh almacenado en Supabase.
 * Combina los campos encrypted_refresh_token, iv, y auth_tag
 * en el formato esperado por la función decryptToken de encryption.ts
 */
export async function decryptToken(tokenData: EncryptedTokenData): Promise<string> {
  // El formato esperado por decryptToken es: "iv:authTag:encrypted"
  const combinedToken = `${tokenData.iv}:${tokenData.auth_tag}:${tokenData.encrypted_refresh_token}`;

  try {
    return decryptTokenRaw(combinedToken);
  } catch (error) {
    console.error('Error descifrando token:', error);
    throw new Error('No se pudo descifrar el token de autenticación. Por favor, vuelve a autenticarte.');
  }
}

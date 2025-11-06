// lib/encryption.ts
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto';

// --- Configuración de Encriptación ---
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const TEXT_ENCODING = 'utf8';
const CIPHER_ENCODING = 'hex';

// --- Validación de la Llave (Modificado para Base64) ---
const KEY_ENCODING_FROM_ENV = 'base64'; // Usamos Base64 de .env
const KEY_LENGTH_BYTES = 32;

const encryptionKey = process.env.ENCRYPTION_KEY!;
if (!encryptionKey) {
  throw new Error('ENCRYPTION_KEY no está definida en .env.local');
}

const key = Buffer.from(encryptionKey, KEY_ENCODING_FROM_ENV);

if (key.length !== KEY_LENGTH_BYTES) {
  throw new Error(`ENCRYPTION_KEY tiene una longitud incorrecta. Debe ser una clave Base64 de 32 bytes.`);
}
// --- Fin de la Validación ---

/**
 * Cifra un token. Almacena el iv, authTag y el texto cifrado
 * como una única string separada por ':'.
 * (Según el Apéndice A del informe)
 */
export function encryptToken(text: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, TEXT_ENCODING, CIPHER_ENCODING);
  encrypted += cipher.final(CIPHER_ENCODING);

  const authTag = cipher.getAuthTag();

  // Almacenar como iv:authTag:encrypted
  return `${iv.toString(CIPHER_ENCODING)}:${authTag.toString(CIPHER_ENCODING)}:${encrypted}`;
}

/**
 * Cifra un token y retorna los componentes separados
 * para guardarlos en columnas separadas en la base de datos
 */
export function encryptTokenToObject(text: string): {
  encrypted_refresh_token: string;
  iv: string;
  auth_tag: string;
} {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, TEXT_ENCODING, CIPHER_ENCODING);
  encrypted += cipher.final(CIPHER_ENCODING);

  const authTag = cipher.getAuthTag();

  return {
    encrypted_refresh_token: encrypted,
    iv: iv.toString(CIPHER_ENCODING),
    auth_tag: authTag.toString(CIPHER_ENCODING),
  };
}

/**
 * Descifra un token almacenado como 'iv:authTag:encrypted'.
 * (Según el Apéndice A del informe)
 */
export function decryptToken(encryptedText: string): string {
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error('Formato de token cifrado inválido. Se esperaba "iv:authTag:encrypted"');
    }

    const [ivHex, authTagHex, encryptedData] = parts;

    const iv = Buffer.from(ivHex, CIPHER_ENCODING);
    const authTag = Buffer.from(authTagHex, CIPHER_ENCODING);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData, CIPHER_ENCODING, TEXT_ENCODING);
    decrypted += decipher.final(TEXT_ENCODING);

    return decrypted;
  } catch (error) {
    console.error('Fallo al descifrar el token:', error);
    throw new Error('No se pudo descifrar el token de autenticación. La llave puede ser incorrecta o el token estar corrupto.');
  }
}
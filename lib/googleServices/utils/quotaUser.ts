/**
 * Utilidad para generar quotaUser y manejar rate limits de Google APIs
 *
 * ⚠️ CRÍTICO PARA PRODUCCIÓN:
 * Todas las llamadas a Google APIs deben incluir el parámetro 'quotaUser'
 * para distribuir los rate limits por usuario en lugar de por IP del servidor.
 *
 * Sin esto, todas las solicitudes de usuarios se contarían contra la misma IP,
 * causando errores 403 rateLimitExceeded en aplicaciones multi-usuario.
 */

import crypto from 'crypto';

/**
 * Genera un identificador único de quota para un usuario
 * Debe ser consistente para el mismo usuario pero no revelar información sensible
 *
 * @param userId - ID del usuario en la base de datos
 * @returns String único para usar como quotaUser en Google APIs
 */
export function generateQuotaUser(userId: string): string {
  // Opción 1: Usar el userId directamente si no es sensible
  // return `user_${userId}`;

  // Opción 2: Hash del userId para privacidad (recomendado)
  const hash = crypto.createHash('sha256').update(userId).digest('hex');
  return `user_${hash.substring(0, 16)}`; // Usar los primeros 16 caracteres del hash
}

/**
 * Implementa exponential backoff para reintentar llamadas API fallidas
 * Útil para errores 429 (rateLimitExceeded) y 5xx (errores del servidor)
 *
 * @param fn - Función async a ejecutar con reintentos
 * @param maxRetries - Número máximo de reintentos (default: 3)
 * @param baseDelayMs - Delay base en milisegundos (default: 1000)
 * @returns Resultado de la función o lanza el último error
 */
export async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Determinar si el error es reintentable
      const isRetryable = isRetryableError(error);

      if (!isRetryable || attempt === maxRetries) {
        // No reintentar o último intento
        throw error;
      }

      // Calcular delay con exponential backoff
      const delayMs = baseDelayMs * Math.pow(2, attempt);
      const jitter = Math.random() * 100; // Agregar jitter para evitar thundering herd
      const totalDelay = delayMs + jitter;

      console.warn(
        `[QUOTA] Intento ${attempt + 1}/${maxRetries} falló. ` +
        `Error: ${error.message}. Reintentando en ${Math.round(totalDelay)}ms...`
      );

      // Esperar antes de reintentar
      await sleep(totalDelay);
    }
  }

  // Si llegamos aquí, todos los reintentos fallaron
  throw lastError;
}

/**
 * Determina si un error de Google API es reintentable
 */
function isRetryableError(error: any): boolean {
  // Error de código HTTP
  if (error.code) {
    // 429: Rate limit exceeded (definitivamente reintentable)
    if (error.code === 429) {
      return true;
    }

    // 403: Puede ser rateLimitExceeded o userRateLimitExceeded
    if (error.code === 403) {
      const message = error.message?.toLowerCase() || '';
      if (message.includes('rate') || message.includes('quota')) {
        return true;
      }
    }

    // 5xx: Errores del servidor de Google (reintentables)
    if (error.code >= 500 && error.code < 600) {
      return true;
    }
  }

  // Errores de red (ECONNRESET, ETIMEDOUT, etc.)
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
    return true;
  }

  // Por defecto, no reintentar
  return false;
}

/**
 * Función de ayuda para esperar (sleep)
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extrae información útil de errores de Google API para logging
 */
export function formatGoogleApiError(error: any): string {
  if (error.errors && Array.isArray(error.errors)) {
    // Error de googleapis con detalles
    const firstError = error.errors[0];
    return `[${firstError.domain}] ${firstError.reason}: ${firstError.message}`;
  }

  if (error.message) {
    return error.message;
  }

  return JSON.stringify(error);
}

/**
 * Wrapper para llamadas a Google API con rate limiting y retries automáticos
 *
 * @example
 * const result = await callGoogleApiSafely(
 *   'calendar.events.list',
 *   () => calendar.events.list({ calendarId: 'primary', quotaUser: userId }),
 *   userId
 * );
 */
export async function callGoogleApiSafely<T>(
  apiName: string,
  apiCall: () => Promise<T>,
  userId: string,
  options?: {
    maxRetries?: number;
    logErrors?: boolean;
  }
): Promise<T> {
  const { maxRetries = 3, logErrors = true } = options || {};

  try {
    return await retryWithExponentialBackoff(apiCall, maxRetries);
  } catch (error: any) {
    if (logErrors) {
      console.error(
        `[GOOGLE_API] Error en ${apiName} (userId: ${userId}): ` +
        formatGoogleApiError(error)
      );
    }
    throw error;
  }
}

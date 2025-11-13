/**
 * Utilidad para crear mensajes MIME para Gmail API
 * Gmail requiere mensajes en formato RFC 2822 codificados en base64url
 */

/**
 * Crea un mensaje MIME para Gmail (formato RFC 2822)
 * @param to - Destinatario(s) (puede ser un string o array de strings)
 * @param subject - Asunto del correo
 * @param body - Cuerpo del mensaje (puede ser texto plano o HTML)
 * @param cc - Opcional: copia (CC)
 * @param bcc - Opcional: copia oculta (BCC)
 * @param isHtml - Si el body es HTML (default: false)
 * @returns String codificado en base64url listo para Gmail API
 */
export function createMimeMessage(
  to: string | string[],
  subject: string,
  body: string,
  options?: {
    cc?: string | string[];
    bcc?: string | string[];
    isHtml?: boolean;
    from?: string; // Opcional: normalmente Gmail usa el email del usuario autenticado
  }
): string {
  const { cc, bcc, isHtml = false, from } = options || {};

  // Convertir arrays a strings separados por comas
  const toStr = Array.isArray(to) ? to.join(', ') : to;
  const ccStr = cc ? (Array.isArray(cc) ? cc.join(', ') : cc) : undefined;
  const bccStr = bcc ? (Array.isArray(bcc) ? bcc.join(', ') : bcc) : undefined;

  // Construir headers del mensaje
  const emailLines: string[] = [];

  if (from) {
    emailLines.push(`From: ${from}`);
  }
  emailLines.push(`To: ${toStr}`);

  if (ccStr) {
    emailLines.push(`Cc: ${ccStr}`);
  }

  if (bccStr) {
    emailLines.push(`Bcc: ${bccStr}`);
  }

  emailLines.push(`Subject: ${subject}`);

  // Content-Type
  if (isHtml) {
    emailLines.push('Content-Type: text/html; charset=utf-8');
  } else {
    emailLines.push('Content-Type: text/plain; charset=utf-8');
  }

  emailLines.push('MIME-Version: 1.0');
  emailLines.push(''); // Línea en blanco requerida antes del body

  // Agregar el cuerpo del mensaje
  emailLines.push(body);

  // Unir con saltos de línea CRLF (RFC 2822 requiere \r\n)
  const email = emailLines.join('\r\n');

  // Codificar en base64url
  // base64url = base64 standard con reemplazos: + → -, / → _, sin padding =
  return Buffer.from(email)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Crea un mensaje MIME con thread ID (para responder en un hilo)
 * @param threadId - ID del hilo de Gmail
 * @param to - Destinatario(s)
 * @param subject - Asunto (debe empezar con "Re: " si es una respuesta)
 * @param body - Cuerpo del mensaje
 * @param options - Opciones adicionales
 * @returns Objeto con raw y threadId listos para Gmail API
 */
export function createMimeReply(
  threadId: string,
  to: string | string[],
  subject: string,
  body: string,
  options?: {
    cc?: string | string[];
    isHtml?: boolean;
  }
): { raw: string; threadId: string } {
  // Asegurar que el subject tiene "Re: " si no lo tiene
  const replySubject = subject.startsWith('Re: ') ? subject : `Re: ${subject}`;

  const raw = createMimeMessage(to, replySubject, body, options);

  return {
    raw,
    threadId,
  };
}

/**
 * Crea un mensaje MIME para borrador (draft)
 * Los borradores tienen el mismo formato que los mensajes normales
 */
export function createMimeDraft(
  to: string | string[],
  subject: string,
  body: string,
  options?: {
    cc?: string | string[];
    isHtml?: boolean;
  }
): string {
  return createMimeMessage(to, subject, body, options);
}

/**
 * Valida que un email sea válido (regex básico)
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Valida que todos los emails en un array sean válidos
 */
export function validateEmails(emails: string | string[]): boolean {
  const emailArray = Array.isArray(emails) ? emails : [emails];
  return emailArray.every(isValidEmail);
}

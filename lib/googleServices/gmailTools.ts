/**
 * Herramientas de Gmail para Gemini Pro
 * Implementa operaciones de búsqueda, lectura, envío y creación de borradores
 */

import { google } from 'googleapis';
import { Auth } from 'googleapis';
import { createMimeMessage, createMimeDraft, validateEmails } from './utils/mimeMessage';
import { parseDateRangeForGmail } from './utils/dateParser';
import { generateQuotaUser, callGoogleApiSafely } from './utils/quotaUser';

/**
 * Busca correos electrónicos en Gmail
 */
export async function searchEmails(
  authClient: Auth.OAuth2Client,
  userId: string,
  params: {
    query: string;
    date_range?: string;
    maxResults?: number;
  }
): Promise<any> {
  const gmail = google.gmail({ version: 'v1', auth: authClient });
  const quotaUser = generateQuotaUser(userId);

  try {
    // Construir query con rango de fechas si se proporciona
    let finalQuery = params.query.trim();

    if (params.date_range) {
      const dateQuery = parseDateRangeForGmail(params.date_range);
      if (dateQuery) {
        finalQuery = `${finalQuery} ${dateQuery}`.trim();
      }
    }

    console.log(`[GMAIL] Buscando emails con query: "${finalQuery}"`);

    // Buscar mensajes
    const response = await callGoogleApiSafely(
      'gmail.users.messages.list',
      () => gmail.users.messages.list({
        userId: 'me',
        q: finalQuery,
        maxResults: params.maxResults || 20,
        includeSpamTrash: false,
        quotaUser: quotaUser,
      }),
      userId
    );

    if (!response.data.messages || response.data.messages.length === 0) {
      return {
        status: 'success',
        message: 'No se encontraron correos que coincidan con la búsqueda.',
        results: [],
        count: 0,
      };
    }

    // Obtener metadata básica de los primeros resultados (snippets, subject, from)
    const messagesWithMeta = await Promise.all(
      response.data.messages!.slice(0, 10).map(async (msg) => {
        const details = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date'],
          quotaUser: quotaUser,
        });

        const headers = details.data.payload?.headers || [];
        const from = headers.find((h) => h.name === 'From')?.value || 'Desconocido';
        const subject = headers.find((h) => h.name === 'Subject')?.value || '(Sin asunto)';
        const date = headers.find((h) => h.name === 'Date')?.value || '';

        return {
          id: msg.id,
          threadId: msg.threadId,
          from,
          subject,
          date,
          snippet: details.data.snippet || '',
        };
      })
    );

    return {
      status: 'success',
      message: `Se encontraron ${response.data.resultSizeEstimate} correos. Mostrando los primeros ${messagesWithMeta.length}.`,
      results: messagesWithMeta,
      count: response.data.resultSizeEstimate,
    };

  } catch (error: any) {
    console.error('[GMAIL] Error buscando emails:', error.message);
    return {
      status: 'error',
      message: `Error al buscar correos: ${error.message}`,
    };
  }
}

/**
 * Lee el contenido completo de un correo electrónico
 */
export async function readEmailContent(
  authClient: Auth.OAuth2Client,
  userId: string,
  params: {
    message_id: string;
  }
): Promise<any> {
  const gmail = google.gmail({ version: 'v1', auth: authClient });
  const quotaUser = generateQuotaUser(userId);

  try {
    console.log(`[GMAIL] Leyendo email con ID: ${params.message_id}`);

    const response = await callGoogleApiSafely(
      'gmail.users.messages.get',
      () => gmail.users.messages.get({
        userId: 'me',
        id: params.message_id,
        format: 'full',
        quotaUser: quotaUser,
      }),
      userId
    );

    const message = response.data;
    const headers = message.payload?.headers || [];

    const from = headers.find((h) => h.name === 'From')?.value || 'Desconocido';
    const to = headers.find((h) => h.name === 'To')?.value || '';
    const subject = headers.find((h) => h.name === 'Subject')?.value || '(Sin asunto)';
    const date = headers.find((h) => h.name === 'Date')?.value || '';

    // Extraer el body (puede estar en diferentes formatos)
    let body = '';
    if (message.payload?.body?.data) {
      // Body directo
      body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
    } else if (message.payload?.parts) {
      // Body en partes (multipart)
      const textPart = message.payload.parts.find(
        (part) => part.mimeType === 'text/plain' || part.mimeType === 'text/html'
      );
      if (textPart?.body?.data) {
        body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
      }
    }

    // Si no se pudo extraer el body, usar snippet
    if (!body) {
      body = message.snippet || '(No se pudo extraer el contenido del correo)';
    }

    return {
      status: 'success',
      email: {
        id: message.id,
        threadId: message.threadId,
        from,
        to,
        subject,
        date,
        body: body.substring(0, 5000), // Limitar a 5000 caracteres para no saturar el contexto
        snippet: message.snippet,
        labelIds: message.labelIds,
      },
    };

  } catch (error: any) {
    console.error('[GMAIL] Error leyendo email:', error.message);
    return {
      status: 'error',
      message: `Error al leer el correo: ${error.message}`,
    };
  }
}

/**
 * Envía un correo electrónico
 * ⚠️ Requiere scope: gmail.send
 */
export async function sendEmail(
  authClient: Auth.OAuth2Client,
  userId: string,
  params: {
    to: string | string[];
    subject: string;
    body: string;
    cc?: string | string[];
    isHtml?: boolean;
  }
): Promise<any> {
  const gmail = google.gmail({ version: 'v1', auth: authClient });
  const quotaUser = generateQuotaUser(userId);

  try {
    // Validar emails
    const allEmails = [
      ...(Array.isArray(params.to) ? params.to : [params.to]),
      ...(params.cc ? (Array.isArray(params.cc) ? params.cc : [params.cc]) : []),
    ];

    if (!validateEmails(allEmails)) {
      return {
        status: 'error',
        message: 'Una o más direcciones de correo electrónico no son válidas.',
      };
    }

    console.log(`[GMAIL] Enviando email a: ${JSON.stringify(params.to)}`);

    // Crear mensaje MIME
    const rawMessage = createMimeMessage(params.to, params.subject, params.body, {
      cc: params.cc,
      isHtml: params.isHtml || false,
    });

    // Enviar
    const response = await callGoogleApiSafely(
      'gmail.users.messages.send',
      () => gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: rawMessage,
        },
        quotaUser: quotaUser,
      }),
      userId
    );

    return {
      status: 'success',
      message: 'Correo enviado exitosamente.',
      messageId: response.data.id,
      threadId: response.data.threadId,
    };

  } catch (error: any) {
    console.error('[GMAIL] Error enviando email:', error.message);

    // Mensaje de error más específico
    let errorMsg = error.message;
    if (error.code === 403) {
      errorMsg = 'No tienes permisos para enviar correos. Verifica los scopes de OAuth.';
    } else if (error.code === 400) {
      errorMsg = 'Los datos del correo son inválidos. Verifica destinatarios y formato.';
    }

    return {
      status: 'error',
      message: `Error al enviar el correo: ${errorMsg}`,
    };
  }
}

/**
 * Crea un borrador de correo electrónico
 * ⚠️ Requiere scope: gmail.compose
 */
export async function createDraft(
  authClient: Auth.OAuth2Client,
  userId: string,
  params: {
    to: string | string[];
    subject: string;
    body: string;
    cc?: string | string[];
    isHtml?: boolean;
  }
): Promise<any> {
  const gmail = google.gmail({ version: 'v1', auth: authClient });
  const quotaUser = generateQuotaUser(userId);

  try {
    console.log(`[GMAIL] Creando borrador para: ${JSON.stringify(params.to)}`);

    // Crear mensaje MIME
    const rawMessage = createMimeDraft(params.to, params.subject, params.body, {
      cc: params.cc,
      isHtml: params.isHtml || false,
    });

    // Crear borrador
    const response = await callGoogleApiSafely(
      'gmail.users.drafts.create',
      () => gmail.users.drafts.create({
        userId: 'me',
        requestBody: {
          message: {
            raw: rawMessage,
          },
        },
        quotaUser: quotaUser,
      }),
      userId
    );

    return {
      status: 'success',
      message: 'Borrador creado exitosamente.',
      draftId: response.data.id,
      messageId: response.data.message?.id,
    };

  } catch (error: any) {
    console.error('[GMAIL] Error creando borrador:', error.message);

    let errorMsg = error.message;
    if (error.code === 403) {
      errorMsg = 'No tienes permisos para crear borradores. Verifica los scopes de OAuth.';
    }

    return {
      status: 'error',
      message: `Error al crear el borrador: ${errorMsg}`,
    };
  }
}

/**
 * Busca un contacto por nombre para obtener su email
 * Usa la API de People (Google Contacts)
 * ⚠️ Requiere scope: contacts.readonly
 */
export async function searchContact(
  authClient: Auth.OAuth2Client,
  userId: string,
  params: {
    query: string;
  }
): Promise<any> {
  const people = google.people({ version: 'v1', auth: authClient });
  const quotaUser = generateQuotaUser(userId);

  try {
    console.log(`[CONTACTS] Buscando contacto: "${params.query}"`);

    const response = await callGoogleApiSafely(
      'people.people.searchContacts',
      () => people.people.searchContacts({
        query: params.query,
        pageSize: 10,
        readMask: 'names,emailAddresses,phoneNumbers',
        quotaUser: quotaUser,
      }),
      userId
    );

    if (!response.data.results || response.data.results.length === 0) {
      return {
        status: 'success',
        message: `No se encontró ningún contacto con el nombre "${params.query}".`,
        results: [],
      };
    }

    // Formatear resultados
    const contacts = response.data.results.map((result: any) => {
      const person = result.person;
      const name = person.names?.[0]?.displayName || 'Desconocido';
      const email = person.emailAddresses?.[0]?.value || null;
      const phone = person.phoneNumbers?.[0]?.value || null;

      return { name, email, phone };
    });

    return {
      status: 'success',
      message: `Se encontraron ${contacts.length} contactos.`,
      results: contacts,
    };

  } catch (error: any) {
    console.error('[CONTACTS] Error buscando contacto:', error.message);

    let errorMsg = error.message;
    if (error.code === 403) {
      errorMsg = 'No tienes permisos para acceder a contactos. Verifica los scopes de OAuth.';
    }

    return {
      status: 'error',
      message: `Error al buscar contacto: ${errorMsg}`,
    };
  }
}

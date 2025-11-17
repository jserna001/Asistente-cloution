import { gmail_v1 } from 'googleapis';

/**
 * Interface para el resultado del parseo de un email
 */
export interface ParsedEmail {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string[];
  date: Date;
  labels: string[];
  snippet: string;
  bodyText: string;
  bodyHtml?: string;
  attachments: EmailAttachment[];
  fullContent: string; // Contenido listo para RAG
  metadata: EmailMetadata;
}

export interface EmailAttachment {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId?: string;
}

export interface EmailMetadata {
  hasAttachments: boolean;
  attachmentCount: number;
  isStarred: boolean;
  isImportant: boolean;
  isUnread: boolean;
  category?: string; // INBOX, PROMOTIONS, SOCIAL, etc.
}

/**
 * Parser de emails de Gmail para extraer contenido completo
 */
export class EmailParser {
  /**
   * Parsea un mensaje completo de Gmail
   */
  static parseMessage(message: gmail_v1.Schema$Message): ParsedEmail {
    const headers = this.extractHeaders(message);
    const body = this.extractBody(message);
    const attachments = this.extractAttachments(message);
    const metadata = this.extractMetadata(message);

    // Construir contenido completo para RAG
    const fullContent = this.buildFullContent({
      subject: headers.subject,
      from: headers.from,
      to: headers.to,
      date: headers.date,
      bodyText: body.text,
      attachments,
      snippet: message.snippet || '',
    });

    return {
      id: message.id!,
      threadId: message.threadId!,
      subject: headers.subject,
      from: headers.from,
      to: headers.to,
      date: headers.date,
      labels: message.labelIds || [],
      snippet: message.snippet || '',
      bodyText: body.text,
      bodyHtml: body.html,
      attachments,
      fullContent,
      metadata,
    };
  }

  /**
   * Extrae headers importantes del email
   */
  private static extractHeaders(message: gmail_v1.Schema$Message) {
    const headers = message.payload?.headers || [];

    const getHeader = (name: string): string => {
      const header = headers.find(h => h.name?.toLowerCase() === name.toLowerCase());
      return header?.value || '';
    };

    const subject = getHeader('Subject') || 'Sin Asunto';
    const from = getHeader('From');
    const to = getHeader('To').split(',').map(t => t.trim()).filter(Boolean);
    const dateStr = getHeader('Date');
    const date = dateStr ? new Date(dateStr) : new Date();

    return { subject, from, to, date };
  }

  /**
   * Extrae el cuerpo del email (texto plano y HTML)
   */
  private static extractBody(message: gmail_v1.Schema$Message): { text: string; html?: string } {
    const payload = message.payload;
    if (!payload) return { text: '' };

    let textBody = '';
    let htmlBody = '';

    // Función recursiva para buscar en partes del mensaje
    const extractFromParts = (part: gmail_v1.Schema$MessagePart) => {
      // Si tiene un body con data
      if (part.body?.data) {
        const decoded = this.decodeBase64(part.body.data);

        if (part.mimeType === 'text/plain') {
          textBody += decoded;
        } else if (part.mimeType === 'text/html') {
          htmlBody += decoded;
        }
      }

      // Procesar subpartes recursivamente
      if (part.parts) {
        part.parts.forEach(subPart => extractFromParts(subPart));
      }
    };

    // Caso 1: Mensaje simple (no multipart)
    if (payload.body?.data) {
      const decoded = this.decodeBase64(payload.body.data);
      if (payload.mimeType === 'text/plain') {
        textBody = decoded;
      } else if (payload.mimeType === 'text/html') {
        htmlBody = decoded;
      }
    }

    // Caso 2: Mensaje multipart
    if (payload.parts) {
      payload.parts.forEach(part => extractFromParts(part));
    }

    // Preferir texto plano, si no hay, convertir HTML a texto
    if (!textBody && htmlBody) {
      textBody = this.htmlToText(htmlBody);
    }

    // Limpiar y truncar
    textBody = this.cleanText(textBody);

    return {
      text: textBody,
      html: htmlBody || undefined,
    };
  }

  /**
   * Extrae información de adjuntos (sin descargar el contenido)
   */
  private static extractAttachments(message: gmail_v1.Schema$Message): EmailAttachment[] {
    const attachments: EmailAttachment[] = [];
    const payload = message.payload;
    if (!payload) return attachments;

    const extractFromParts = (part: gmail_v1.Schema$MessagePart) => {
      // Si tiene filename y no es el cuerpo principal
      if (part.filename && part.filename.length > 0 && part.body?.attachmentId) {
        attachments.push({
          filename: part.filename,
          mimeType: part.mimeType || 'application/octet-stream',
          size: part.body.size || 0,
          attachmentId: part.body.attachmentId,
        });
      }

      // Procesar subpartes
      if (part.parts) {
        part.parts.forEach(subPart => extractFromParts(subPart));
      }
    };

    if (payload.parts) {
      payload.parts.forEach(part => extractFromParts(part));
    }

    return attachments;
  }

  /**
   * Extrae metadata útil del mensaje
   */
  private static extractMetadata(message: gmail_v1.Schema$Message): EmailMetadata {
    const labels = message.labelIds || [];

    return {
      hasAttachments: (message.payload?.parts?.some(p => p.filename && p.filename.length > 0)) || false,
      attachmentCount: this.extractAttachments(message).length,
      isStarred: labels.includes('STARRED'),
      isImportant: labels.includes('IMPORTANT'),
      isUnread: labels.includes('UNREAD'),
      category: this.detectCategory(labels),
    };
  }

  /**
   * Detecta la categoría del email basado en labels
   */
  private static detectCategory(labels: string[]): string | undefined {
    if (labels.includes('CATEGORY_PROMOTIONS')) return 'PROMOTIONS';
    if (labels.includes('CATEGORY_SOCIAL')) return 'SOCIAL';
    if (labels.includes('CATEGORY_UPDATES')) return 'UPDATES';
    if (labels.includes('CATEGORY_FORUMS')) return 'FORUMS';
    if (labels.includes('INBOX')) return 'INBOX';
    return undefined;
  }

  /**
   * Construye el contenido completo formateado para RAG
   */
  private static buildFullContent(params: {
    subject: string;
    from: string;
    to: string[];
    date: Date;
    bodyText: string;
    attachments: EmailAttachment[];
    snippet: string;
  }): string {
    const { subject, from, to, date, bodyText, attachments } = params;

    let content = '';

    // Header
    content += `Asunto: ${subject}\n`;
    content += `De: ${from}\n`;
    if (to.length > 0) {
      content += `Para: ${to.join(', ')}\n`;
    }
    content += `Fecha: ${date.toLocaleString('es-CO', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: 'America/Bogota'
    })}\n`;

    // Adjuntos
    if (attachments.length > 0) {
      content += `\nAdjuntos (${attachments.length}):\n`;
      attachments.forEach(att => {
        const sizeKB = Math.round(att.size / 1024);
        content += `- ${att.filename} (${sizeKB} KB)\n`;
      });
    }

    // Cuerpo
    content += `\n--- Contenido del Email ---\n\n`;
    content += bodyText;

    return content;
  }

  /**
   * Decodifica base64 URL-safe de Gmail
   */
  private static decodeBase64(data: string): string {
    try {
      // Reemplazar caracteres URL-safe
      const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
      // Decodificar
      const decoded = Buffer.from(base64, 'base64').toString('utf-8');
      return decoded;
    } catch (error) {
      console.error('Error decoding base64:', error);
      return '';
    }
  }

  /**
   * Convierte HTML simple a texto plano
   */
  private static htmlToText(html: string): string {
    let text = html;

    // Reemplazar <br> y <p> con saltos de línea
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<\/p>/gi, '\n\n');
    text = text.replace(/<p[^>]*>/gi, '');

    // Remover tags HTML
    text = text.replace(/<[^>]*>/g, '');

    // Decodificar entidades HTML comunes
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");

    return text;
  }

  /**
   * Limpia y normaliza texto
   */
  private static cleanText(text: string): string {
    // Remover múltiples espacios
    text = text.replace(/[ \t]+/g, ' ');

    // Normalizar saltos de línea (máximo 2 consecutivos)
    text = text.replace(/\n{3,}/g, '\n\n');

    // Trim
    text = text.trim();

    return text;
  }

  /**
   * Trunca el contenido a un máximo de caracteres
   */
  static truncateContent(content: string, maxLength: number = 50000): string {
    if (content.length <= maxLength) {
      return content;
    }

    // Truncar y agregar indicador
    const truncated = content.substring(0, maxLength);
    return truncated + '\n\n[... Contenido truncado ...]';
  }

  /**
   * Valida si un email debe ser procesado según filtros
   */
  static shouldProcessEmail(
    message: gmail_v1.Schema$Message,
    config: {
      excludedLabels?: string[];
      includedLabels?: string[] | null;
      excludePromotions?: boolean;
      excludeSocial?: boolean;
    }
  ): boolean {
    const labels = message.labelIds || [];

    // Siempre excluir SPAM y TRASH
    if (labels.includes('SPAM') || labels.includes('TRASH')) {
      return false;
    }

    // Filtros de categorías
    if (config.excludePromotions && labels.includes('CATEGORY_PROMOTIONS')) {
      return false;
    }
    if (config.excludeSocial && labels.includes('CATEGORY_SOCIAL')) {
      return false;
    }

    // Filtro de labels excluidos
    if (config.excludedLabels && config.excludedLabels.length > 0) {
      const hasExcludedLabel = labels.some(label =>
        config.excludedLabels!.includes(label)
      );
      if (hasExcludedLabel) return false;
    }

    // Filtro de labels incluidos (whitelist)
    if (config.includedLabels && config.includedLabels.length > 0) {
      const hasIncludedLabel = labels.some(label =>
        config.includedLabels!.includes(label)
      );
      return hasIncludedLabel;
    }

    return true;
  }
}

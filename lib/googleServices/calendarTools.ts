/**
 * Herramientas de Google Calendar para Gemini Pro
 * Implementa operaciones de calendario: listar, crear, actualizar, eliminar, buscar eventos
 */

import { google } from 'googleapis';
import { Auth } from 'googleapis';
import { parseNaturalLanguageDate, parseDateRangeForCalendar } from './utils/dateParser';
import { generateQuotaUser, callGoogleApiSafely } from './utils/quotaUser';

// Zona horaria por defecto (debería obtenerse de preferencias del usuario)
const DEFAULT_TIMEZONE = 'America/Bogota';

/**
 * Lista eventos del calendario en un rango de fechas
 */
export async function listCalendarEvents(
  authClient: Auth.OAuth2Client,
  userId: string,
  params: {
    date_range?: string; // "today", "tomorrow", "this week", "next 7 days"
  }
): Promise<any> {
  const calendar = google.calendar({ version: 'v3', auth: authClient });
  const quotaUser = generateQuotaUser(userId);

  try {
    // Parsear rango de fechas (default: hoy)
    const dateRange = params.date_range || 'today';
    const { timeMin, timeMax } = parseDateRangeForCalendar(dateRange);

    console.log(`[CALENDAR] Listando eventos del ${timeMin.toISOString()} al ${timeMax.toISOString()}`);

    const response = await callGoogleApiSafely(
      'calendar.events.list',
      () => calendar.events.list({
        calendarId: 'primary',
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        maxResults: 50,
        singleEvents: true, // Expandir eventos recurrentes
        orderBy: 'startTime',
        timeZone: DEFAULT_TIMEZONE,
        quotaUser: quotaUser,
      }),
      userId
    );

    const events = response.data.items || [];

    if (events.length === 0) {
      return {
        status: 'success',
        message: `No tienes eventos en ${dateRange}.`,
        events: [],
        count: 0,
      };
    }

    // Formatear eventos
    const formattedEvents = events.map((event: any) => ({
      id: event.id,
      summary: event.summary || '(Sin título)',
      description: event.description || '',
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      location: event.location || '',
      attendees: event.attendees?.map((a: any) => a.email) || [],
      htmlLink: event.htmlLink,
    }));

    return {
      status: 'success',
      message: `Se encontraron ${events.length} eventos en ${dateRange}.`,
      events: formattedEvents,
      count: events.length,
    };

  } catch (error: any) {
    console.error('[CALENDAR] Error listando eventos:', error.message);

    let errorMsg = error.message;
    if (error.code === 403) {
      errorMsg = 'No tienes permisos para acceder al calendario. Verifica los scopes de OAuth.';
    }

    return {
      status: 'error',
      message: `Error al listar eventos: ${errorMsg}`,
    };
  }
}

/**
 * Crea un nuevo evento en el calendario
 * ⚠️ Requiere scope: calendar.events o calendar
 */
export async function createCalendarEvent(
  authClient: Auth.OAuth2Client,
  userId: string,
  params: {
    summary: string;
    start_time: string; // Lenguaje natural: "mañana a las 3pm", "November 15 at 10:00"
    end_time: string;
    description?: string;
    location?: string;
    attendees?: string[]; // Array de emails
  }
): Promise<any> {
  const calendar = google.calendar({ version: 'v3', auth: authClient });
  const quotaUser = generateQuotaUser(userId);

  try {
    // Parsear fechas
    const startDate = parseNaturalLanguageDate(params.start_time, DEFAULT_TIMEZONE);
    const endDate = parseNaturalLanguageDate(params.end_time, DEFAULT_TIMEZONE);

    if (!startDate || !endDate) {
      return {
        status: 'error',
        message: `No se pudieron interpretar las fechas: "${params.start_time}" y "${params.end_time}". Por favor, sé más específico (ej: "mañana a las 3pm", "15 de noviembre a las 10:00").`,
      };
    }

    // Validar que end > start
    if (endDate <= startDate) {
      return {
        status: 'error',
        message: 'La hora de fin debe ser posterior a la hora de inicio.',
      };
    }

    console.log(`[CALENDAR] Creando evento: "${params.summary}" de ${startDate.toISOString()} a ${endDate.toISOString()}`);

    const eventResource: any = {
      summary: params.summary,
      description: params.description || '',
      location: params.location || '',
      start: {
        dateTime: startDate.toISOString(),
        timeZone: DEFAULT_TIMEZONE,
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: DEFAULT_TIMEZONE,
      },
      reminders: {
        useDefault: true,
      },
    };

    // Agregar asistentes si se proporcionaron
    if (params.attendees && params.attendees.length > 0) {
      eventResource.attendees = params.attendees.map((email) => ({ email }));
    }

    const response = await callGoogleApiSafely(
      'calendar.events.insert',
      () => calendar.events.insert({
        calendarId: 'primary',
        requestBody: eventResource,
        sendUpdates: params.attendees && params.attendees.length > 0 ? 'all' : 'none',
        quotaUser: quotaUser,
      }),
      userId
    );

    return {
      status: 'success',
      message: `Evento "${params.summary}" creado exitosamente.`,
      event: {
        id: response.data.id,
        summary: response.data.summary,
        start: response.data.start?.dateTime,
        end: response.data.end?.dateTime,
        htmlLink: response.data.htmlLink,
      },
    };

  } catch (error: any) {
    console.error('[CALENDAR] Error creando evento:', error.message);

    let errorMsg = error.message;
    if (error.code === 403) {
      errorMsg = 'No tienes permisos para crear eventos. Verifica los scopes de OAuth.';
    }

    return {
      status: 'error',
      message: `Error al crear el evento: ${errorMsg}`,
    };
  }
}

/**
 * Busca eventos por palabra clave
 */
export async function searchCalendarEvents(
  authClient: Auth.OAuth2Client,
  userId: string,
  params: {
    query: string;
    date_range?: string; // Opcional: "this month", "all history"
  }
): Promise<any> {
  const calendar = google.calendar({ version: 'v3', auth: authClient });
  const quotaUser = generateQuotaUser(userId);

  try {
    // Parsear rango de fechas (default: todo el historial)
    let timeMin: string | undefined;
    let timeMax: string | undefined;

    if (params.date_range && params.date_range !== 'all history') {
      const range = parseDateRangeForCalendar(params.date_range);
      timeMin = range.timeMin.toISOString();
      timeMax = range.timeMax.toISOString();
    }

    console.log(`[CALENDAR] Buscando eventos con query: "${params.query}"`);

    const response = await callGoogleApiSafely(
      'calendar.events.list',
      () => calendar.events.list({
        calendarId: 'primary',
        q: params.query, // Busca en título, descripción, ubicación
        timeMin: timeMin,
        timeMax: timeMax,
        maxResults: 50,
        singleEvents: true,
        orderBy: 'startTime',
        quotaUser: quotaUser,
      }),
      userId
    );

    const events = response.data.items || [];

    if (events.length === 0) {
      return {
        status: 'success',
        message: `No se encontraron eventos con "${params.query}".`,
        events: [],
        count: 0,
      };
    }

    // Formatear eventos
    const formattedEvents = events.map((event: any) => ({
      id: event.id,
      summary: event.summary || '(Sin título)',
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      description: event.description || '',
      location: event.location || '',
    }));

    return {
      status: 'success',
      message: `Se encontraron ${events.length} eventos.`,
      events: formattedEvents,
      count: events.length,
    };

  } catch (error: any) {
    console.error('[CALENDAR] Error buscando eventos:', error.message);
    return {
      status: 'error',
      message: `Error al buscar eventos: ${error.message}`,
    };
  }
}

/**
 * Elimina un evento del calendario
 * ⚠️ Requiere scope: calendar.events o calendar
 */
export async function deleteCalendarEvent(
  authClient: Auth.OAuth2Client,
  userId: string,
  params: {
    event_id: string;
  }
): Promise<any> {
  const calendar = google.calendar({ version: 'v3', auth: authClient });
  const quotaUser = generateQuotaUser(userId);

  try {
    console.log(`[CALENDAR] Eliminando evento con ID: ${params.event_id}`);

    await callGoogleApiSafely(
      'calendar.events.delete',
      () => calendar.events.delete({
        calendarId: 'primary',
        eventId: params.event_id,
        sendUpdates: 'all', // Notificar a asistentes
        quotaUser: quotaUser,
      }),
      userId
    );

    return {
      status: 'success',
      message: 'Evento eliminado exitosamente.',
    };

  } catch (error: any) {
    console.error('[CALENDAR] Error eliminando evento:', error.message);

    let errorMsg = error.message;
    if (error.code === 404) {
      errorMsg = 'No se encontró el evento con ese ID. Puede que ya haya sido eliminado.';
    } else if (error.code === 403) {
      errorMsg = 'No tienes permisos para eliminar eventos.';
    }

    return {
      status: 'error',
      message: `Error al eliminar el evento: ${errorMsg}`,
    };
  }
}

/**
 * Actualiza un evento existente
 * ⚠️ Requiere scope: calendar.events o calendar
 */
export async function updateCalendarEvent(
  authClient: Auth.OAuth2Client,
  userId: string,
  params: {
    event_id: string;
    summary?: string;
    start_time?: string;
    end_time?: string;
    description?: string;
    location?: string;
  }
): Promise<any> {
  const calendar = google.calendar({ version: 'v3', auth: authClient });
  const quotaUser = generateQuotaUser(userId);

  try {
    console.log(`[CALENDAR] Actualizando evento con ID: ${params.event_id}`);

    // Primero obtener el evento actual
    const existingEvent = await calendar.events.get({
      calendarId: 'primary',
      eventId: params.event_id,
      quotaUser: quotaUser,
    });

    // Preparar los cambios
    const updatedEvent: any = {
      ...existingEvent.data,
      summary: params.summary || existingEvent.data.summary,
      description: params.description !== undefined ? params.description : existingEvent.data.description,
      location: params.location !== undefined ? params.location : existingEvent.data.location,
    };

    // Actualizar fechas si se proporcionaron
    if (params.start_time) {
      const startDate = parseNaturalLanguageDate(params.start_time, DEFAULT_TIMEZONE);
      if (!startDate) {
        return {
          status: 'error',
          message: `No se pudo interpretar la fecha de inicio: "${params.start_time}".`,
        };
      }
      updatedEvent.start = {
        dateTime: startDate.toISOString(),
        timeZone: DEFAULT_TIMEZONE,
      };
    }

    if (params.end_time) {
      const endDate = parseNaturalLanguageDate(params.end_time, DEFAULT_TIMEZONE);
      if (!endDate) {
        return {
          status: 'error',
          message: `No se pudo interpretar la fecha de fin: "${params.end_time}".`,
        };
      }
      updatedEvent.end = {
        dateTime: endDate.toISOString(),
        timeZone: DEFAULT_TIMEZONE,
      };
    }

    const response = await callGoogleApiSafely(
      'calendar.events.update',
      () => calendar.events.update({
        calendarId: 'primary',
        eventId: params.event_id,
        requestBody: updatedEvent,
        sendUpdates: 'all',
        quotaUser: quotaUser,
      }),
      userId
    );

    return {
      status: 'success',
      message: 'Evento actualizado exitosamente.',
      event: {
        id: response.data.id,
        summary: response.data.summary,
        start: response.data.start?.dateTime,
        end: response.data.end?.dateTime,
      },
    };

  } catch (error: any) {
    console.error('[CALENDAR] Error actualizando evento:', error.message);

    let errorMsg = error.message;
    if (error.code === 404) {
      errorMsg = 'No se encontró el evento con ese ID.';
    } else if (error.code === 403) {
      errorMsg = 'No tienes permisos para actualizar eventos.';
    }

    return {
      status: 'error',
      message: `Error al actualizar el evento: ${errorMsg}`,
    };
  }
}

import { google } from 'googleapis';
import { getGoogleOAuthClient } from './googleAuth';

/**
 * Crea un evento en el calendario principal de Google del usuario.
 *
 * @param supabase Cliente de Supabase autenticado.
 * @param userId El ID del usuario de Supabase.
 * @param title El título del evento.
 * @param startTime La hora de inicio del evento (formato ISO 8601).
 * @param endTime La hora de finalización del evento (formato ISO 8601).
 * @param timeZone La zona horaria del evento (por defecto 'America/Bogota').
 * @returns Un objeto con `success` y `eventLink` si el evento se crea correctamente.
 */
export async function createCalendarEvent(
  supabase: any,
  userId: string,
  title: string,
  startTime: string,
  endTime: string,
  timeZone: string = 'America/Bogota'
) {
  try {
    console.log(`Creando evento de calendario para el usuario ${userId}: ${title}`);

    // 1. Obtener el cliente OAuth2 autenticado con las credenciales del usuario.
    const auth = await getGoogleOAuthClient(supabase, userId);

    // 2. Crear el cliente de Google Calendar.
    const calendar = google.calendar({ version: 'v3', auth });

    // 3. Definir el objeto del evento.
    const event = {
      summary: title,
      start: {
        dateTime: startTime,
        timeZone: timeZone,
      },
      end: {
        dateTime: endTime,
        timeZone: timeZone,
      },
    };

    // 4. Insertar el evento en el calendario principal del usuario.
    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
    });

    console.log(`Evento de calendario creado: ${response.data.htmlLink}`);
    return { success: true, eventLink: response.data.htmlLink };

  } catch (error) {
    console.error('Error al crear evento de calendario:', error);
    throw new Error(`No se pudo crear el evento de calendario: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
}

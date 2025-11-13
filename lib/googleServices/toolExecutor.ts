/**
 * Ejecutor de herramientas de Google Services
 * Centraliza la lógica de ejecución de todas las herramientas de Google
 */

import { getGoogleOAuthClient } from '../googleAuth';
import * as gmailTools from './gmailTools';
import * as calendarTools from './calendarTools';
import * as tasksTools from './tasksTools';
import * as driveTools from './driveTools';

/**
 * Ejecuta una herramienta de Google Services
 * @param toolName - Nombre de la herramienta (ej: "google.search_emails")
 * @param args - Argumentos de la herramienta
 * @param supabase - Cliente de Supabase
 * @param userId - ID del usuario
 * @returns Resultado de la ejecución
 */
export async function executeGoogleTool(
  toolName: string,
  args: any,
  supabase: any,
  userId: string
): Promise<any> {
  try {
    // Obtener cliente OAuth autenticado
    const authClient = await getGoogleOAuthClient(supabase, userId);

    // Ejecutar la herramienta correspondiente
    switch (toolName) {
      // --- Gmail Tools ---
      case 'google.search_emails':
        return await gmailTools.searchEmails(authClient, userId, args);

      case 'google.read_email':
        return await gmailTools.readEmailContent(authClient, userId, args);

      case 'google.send_email':
        return await gmailTools.sendEmail(authClient, userId, args);

      case 'google.create_draft':
        return await gmailTools.createDraft(authClient, userId, args);

      case 'google.search_contact':
        return await gmailTools.searchContact(authClient, userId, args);

      // --- Calendar Tools ---
      case 'google.list_events':
        return await calendarTools.listCalendarEvents(authClient, userId, args);

      case 'google.create_event':
        return await calendarTools.createCalendarEvent(authClient, userId, args);

      case 'google.search_events':
        return await calendarTools.searchCalendarEvents(authClient, userId, args);

      case 'google.delete_event':
        return await calendarTools.deleteCalendarEvent(authClient, userId, args);

      case 'google.update_event':
        return await calendarTools.updateCalendarEvent(authClient, userId, args);

      // --- Tasks Tools ---
      case 'google.create_task':
        return await tasksTools.createTask(authClient, userId, args);

      case 'google.list_tasks':
        return await tasksTools.listTasks(authClient, userId, args);

      case 'google.complete_task':
        return await tasksTools.completeTask(authClient, userId, args);

      case 'google.delete_task':
        return await tasksTools.deleteTask(authClient, userId, args);

      // --- Drive Tools ---
      case 'google.create_document':
        return await driveTools.createDocument(authClient, userId, args);

      case 'google.list_documents':
        return await driveTools.listMyDocuments(authClient, userId, args);

      case 'google.delete_document':
        return await driveTools.deleteDocument(authClient, userId, args);

      default:
        console.error(`[GOOGLE_TOOLS] Herramienta desconocida: ${toolName}`);
        return {
          status: 'error',
          message: `Herramienta desconocida: ${toolName}`,
        };
    }
  } catch (error: any) {
    console.error(`[GOOGLE_TOOLS] Error ejecutando ${toolName}:`, error.message);

    // Manejar errores comunes de OAuth
    if (error.message?.includes('No se encontraron credenciales')) {
      return {
        status: 'error',
        message: 'No tienes configuradas las credenciales de Google. Por favor, inicia sesión nuevamente.',
      };
    }

    return {
      status: 'error',
      message: `Error al ejecutar ${toolName}: ${error.message}`,
    };
  }
}

/**
 * Verifica si una herramienta es de Google Services
 */
export function isGoogleTool(toolName: string): boolean {
  return toolName.startsWith('google.');
}

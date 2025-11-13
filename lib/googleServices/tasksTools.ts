/**
 * Herramientas de Google Tasks para Gemini Pro
 * Implementa operaciones de tareas simples: crear, listar, completar
 */

import { google } from 'googleapis';
import { Auth } from 'googleapis';
import { parseNaturalLanguageDate } from './utils/dateParser';
import { generateQuotaUser, callGoogleApiSafely } from './utils/quotaUser';

/**
 * Crea una nueva tarea en Google Tasks
 * ⚠️ Requiere scope: tasks
 */
export async function createTask(
  authClient: Auth.OAuth2Client,
  userId: string,
  params: {
    title: string;
    due_date?: string; // Lenguaje natural: "today", "tomorrow", "next Monday"
    notes?: string;
  }
): Promise<any> {
  const tasks = google.tasks({ version: 'v1', auth: authClient });
  const quotaUser = generateQuotaUser(userId);

  try {
    console.log(`[TASKS] Creando tarea: "${params.title}"`);

    // Preparar la tarea
    const taskResource: any = {
      title: params.title,
      notes: params.notes || '',
    };

    // Parsear fecha de vencimiento si se proporcionó
    if (params.due_date) {
      const dueDate = parseNaturalLanguageDate(params.due_date);
      if (dueDate) {
        // Google Tasks requiere formato RFC 3339 (ISO 8601)
        taskResource.due = dueDate.toISOString();
      } else {
        console.warn(`[TASKS] No se pudo parsear la fecha: "${params.due_date}". Tarea sin fecha de vencimiento.`);
      }
    }

    // Crear tarea en la lista principal (@default)
    const response = await callGoogleApiSafely(
      'tasks.tasks.insert',
      () => tasks.tasks.insert({
        tasklist: '@default',
        requestBody: taskResource,
        quotaUser: quotaUser,
      }),
      userId
    );

    const dueInfo = response.data.due
      ? ` con vencimiento el ${new Date(response.data.due).toLocaleDateString('es-CO')}`
      : '';

    return {
      status: 'success',
      message: `Tarea "${params.title}" creada exitosamente${dueInfo}.`,
      task: {
        id: response.data.id,
        title: response.data.title,
        due: response.data.due,
        status: response.data.status,
      },
    };

  } catch (error: any) {
    console.error('[TASKS] Error creando tarea:', error.message);

    let errorMsg = error.message;
    if (error.code === 403) {
      errorMsg = 'No tienes permisos para crear tareas. Verifica los scopes de OAuth.';
    }

    return {
      status: 'error',
      message: `Error al crear la tarea: ${errorMsg}`,
    };
  }
}

/**
 * Lista tareas de Google Tasks
 * ⚠️ Requiere scope: tasks.readonly o tasks
 */
export async function listTasks(
  authClient: Auth.OAuth2Client,
  userId: string,
  params?: {
    status?: 'needsAction' | 'completed'; // Filtrar por estado
    due_date_range?: string; // "today", "this week"
  }
): Promise<any> {
  const tasks = google.tasks({ version: 'v1', auth: authClient });
  const quotaUser = generateQuotaUser(userId);

  try {
    const status = params?.status || 'needsAction'; // Default: tareas pendientes

    console.log(`[TASKS] Listando tareas con estado: ${status}`);

    // Listar tareas
    const response = await callGoogleApiSafely(
      'tasks.tasks.list',
      () => tasks.tasks.list({
        tasklist: '@default',
        showCompleted: status === 'completed',
        showHidden: false,
        maxResults: 100,
        quotaUser: quotaUser,
      }),
      userId
    );

    const tasksList = response.data.items || [];

    if (tasksList.length === 0) {
      const statusMsg = status === 'needsAction' ? 'pendientes' : 'completadas';
      return {
        status: 'success',
        message: `No tienes tareas ${statusMsg}.`,
        tasks: [],
        count: 0,
      };
    }

    // Formatear tareas
    const formattedTasks = tasksList.map((task: any) => ({
      id: task.id,
      title: task.title,
      notes: task.notes || '',
      due: task.due ? new Date(task.due).toLocaleDateString('es-CO') : null,
      status: task.status, // 'needsAction' o 'completed'
      updated: task.updated,
    }));

    // Filtrar por rango de fecha si se especificó
    let filteredTasks = formattedTasks;
    if (params?.due_date_range) {
      // TODO: Implementar filtro por rango de fecha si es necesario
      console.warn('[TASKS] Filtro por due_date_range no implementado aún.');
    }

    return {
      status: 'success',
      message: `Se encontraron ${filteredTasks.length} tareas.`,
      tasks: filteredTasks,
      count: filteredTasks.length,
    };

  } catch (error: any) {
    console.error('[TASKS] Error listando tareas:', error.message);

    let errorMsg = error.message;
    if (error.code === 403) {
      errorMsg = 'No tienes permisos para acceder a tareas. Verifica los scopes de OAuth.';
    }

    return {
      status: 'error',
      message: `Error al listar tareas: ${errorMsg}`,
    };
  }
}

/**
 * Marca una tarea como completada
 * ⚠️ Requiere scope: tasks
 */
export async function completeTask(
  authClient: Auth.OAuth2Client,
  userId: string,
  params: {
    task_id: string;
  }
): Promise<any> {
  const tasks = google.tasks({ version: 'v1', auth: authClient });
  const quotaUser = generateQuotaUser(userId);

  try {
    console.log(`[TASKS] Marcando tarea como completada: ${params.task_id}`);

    // Obtener la tarea actual
    const currentTask = await tasks.tasks.get({
      tasklist: '@default',
      task: params.task_id,
      quotaUser: quotaUser,
    });

    // Actualizar el status a 'completed'
    const response = await callGoogleApiSafely(
      'tasks.tasks.update',
      () => tasks.tasks.update({
        tasklist: '@default',
        task: params.task_id,
        requestBody: {
          ...currentTask.data,
          status: 'completed',
        },
        quotaUser: quotaUser,
      }),
      userId
    );

    return {
      status: 'success',
      message: `Tarea "${response.data.title}" marcada como completada.`,
    };

  } catch (error: any) {
    console.error('[TASKS] Error completando tarea:', error.message);

    let errorMsg = error.message;
    if (error.code === 404) {
      errorMsg = 'No se encontró la tarea con ese ID.';
    } else if (error.code === 403) {
      errorMsg = 'No tienes permisos para actualizar tareas.';
    }

    return {
      status: 'error',
      message: `Error al completar la tarea: ${errorMsg}`,
    };
  }
}

/**
 * Elimina una tarea de Google Tasks
 * ⚠️ Requiere scope: tasks
 */
export async function deleteTask(
  authClient: Auth.OAuth2Client,
  userId: string,
  params: {
    task_id: string;
  }
): Promise<any> {
  const tasks = google.tasks({ version: 'v1', auth: authClient });
  const quotaUser = generateQuotaUser(userId);

  try {
    console.log(`[TASKS] Eliminando tarea: ${params.task_id}`);

    await callGoogleApiSafely(
      'tasks.tasks.delete',
      () => tasks.tasks.delete({
        tasklist: '@default',
        task: params.task_id,
        quotaUser: quotaUser,
      }),
      userId
    );

    return {
      status: 'success',
      message: 'Tarea eliminada exitosamente.',
    };

  } catch (error: any) {
    console.error('[TASKS] Error eliminando tarea:', error.message);

    let errorMsg = error.message;
    if (error.code === 404) {
      errorMsg = 'No se encontró la tarea con ese ID.';
    } else if (error.code === 403) {
      errorMsg = 'No tienes permisos para eliminar tareas.';
    }

    return {
      status: 'error',
      message: `Error al eliminar la tarea: ${errorMsg}`,
    };
  }
}

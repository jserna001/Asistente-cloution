/**
 * Definiciones de herramientas de Google Services para Gemini Function Calling
 * Cada TaskType (GMAIL, CALENDAR, GOOGLE_TASKS, GOOGLE_DRIVE) tiene su conjunto de herramientas
 */

import { FunctionDeclaration } from '@google/generative-ai';

/**
 * Herramientas de Gmail (TaskType: GMAIL)
 */
export const GMAIL_TOOLS: FunctionDeclaration[] = [
  {
    name: 'google.search_emails',
    description: 'Busca correos electrónicos en Gmail usando la sintaxis de búsqueda de Gmail. Puede buscar por remitente, destinatario, asunto, fecha, archivos adjuntos, etc.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Búsqueda de Gmail. Ejemplos: "from:boss@company.com after:2025/11/01", "has:attachment subject:factura", "is:unread label:INBOX"',
        },
        date_range: {
          type: 'string',
          description: 'Rango de fechas en lenguaje natural (ej: "today", "last 7 days", "this month"). Opcional.',
        },
        maxResults: {
          type: 'number',
          description: 'Número máximo de resultados a retornar (1-100). Default: 20',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'google.read_email',
    description: 'Lee el contenido completo de un correo electrónico específico usando su ID. Úsalo solo después de que google.search_emails haya devuelto un ID y el usuario quiera leer un correo específico.',
    parameters: {
      type: 'object',
      properties: {
        message_id: {
          type: 'string',
          description: 'El ID único del mensaje a leer, obtenido de una búsqueda previa.',
        },
      },
      required: ['message_id'],
    },
  },
  {
    name: 'google.send_email',
    description: 'Envía un correo electrónico a uno o más destinatarios usando la cuenta de Gmail del usuario. Esta es una acción final. NUNCA confirmes al usuario que el correo fue enviado hasta que esta herramienta se ejecute y devuelva un estado "success".',
    parameters: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'Dirección de correo electrónico del destinatario (o múltiples separados por comas).',
        },
        subject: {
          type: 'string',
          description: 'El asunto del correo electrónico.',
        },
        body: {
          type: 'string',
          description: 'El contenido (cuerpo) del correo electrónico en texto plano.',
        },
        cc: {
          type: 'string',
          description: 'Direcciones de email en copia (CC), separadas por comas. Opcional.',
        },
        isHtml: {
          type: 'boolean',
          description: 'Si el body es HTML. Default: false.',
        },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'google.create_draft',
    description: 'Crea un borrador de correo electrónico en la cuenta del usuario, pero NO lo envía. Esto es útil si el usuario quiere revisarlo más tarde.',
    parameters: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'Destinatario(s) (opcional).',
        },
        subject: {
          type: 'string',
          description: 'Asunto (opcional).',
        },
        body: {
          type: 'string',
          description: 'Cuerpo (opcional).',
        },
        cc: {
          type: 'string',
          description: 'Copia (CC) (opcional).',
        },
      },
      required: [],
    },
  },
  {
    name: 'google.search_contact',
    description: 'Busca en los contactos del usuario por nombre para encontrar una dirección de correo electrónico completa. Úsalo cuando el usuario diga "Envía un correo a Juan" para encontrar el correo "juan@ejemplo.com" antes de llamar a send_email.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Nombre o correo electrónico parcial a buscar (ej: "Juan Perez", "Maria G").',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'answer_user',
    description: 'Responde directamente al usuario con un texto final.',
    parameters: {
      type: 'object',
      properties: {
        respuesta: {
          type: 'string',
          description: 'La respuesta final y completa para el usuario.',
        },
      },
      required: ['respuesta'],
    },
  },
];

/**
 * Herramientas de Google Calendar (TaskType: CALENDAR)
 */
export const CALENDAR_TOOLS: FunctionDeclaration[] = [
  {
    name: 'google.list_events',
    description: 'Lista eventos del calendario de Google en un rango de fechas. Útil para ver la agenda del día, semana o mes.',
    parameters: {
      type: 'object',
      properties: {
        date_range: {
          type: 'string',
          description: 'Rango de fechas en lenguaje natural (ej: "today", "tomorrow", "this week", "next 7 days"). Default: "today".',
        },
      },
      required: [],
    },
  },
  {
    name: 'google.create_event',
    description: 'Crea un nuevo evento, cita o reunión en el calendario principal del usuario. NUNCA confirmes la creación hasta que esta herramienta se ejecute y devuelva un estado "success".',
    parameters: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: 'El título o nombre del evento.',
        },
        start_time: {
          type: 'string',
          description: 'La fecha y hora de inicio del evento, en lenguaje natural (ej: "mañana a las 3pm", "25 de diciembre a las 10:00").',
        },
        end_time: {
          type: 'string',
          description: 'La fecha y hora de fin del evento, en lenguaje natural (ej: "mañana a las 4pm", "25 de diciembre a las 11:00").',
        },
        description: {
          type: 'string',
          description: 'Descripción del evento (opcional).',
        },
        location: {
          type: 'string',
          description: 'La ubicación física o enlace de la reunión (opcional).',
        },
        attendees: {
          type: 'string',
          description: 'Emails de los invitados separados por comas (opcional).',
        },
      },
      required: ['summary', 'start_time', 'end_time'],
    },
  },
  {
    name: 'google.search_events',
    description: 'Busca eventos pasados o futuros en el calendario por palabras clave.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Palabra clave para buscar en el título, descripción o asistentes del evento (ej: "Reunión con Juan").',
        },
        date_range: {
          type: 'string',
          description: 'Rango de fechas en lenguaje natural (ej: "this month", "all history"). Default: "all history".',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'google.delete_event',
    description: 'Elimina un evento del calendario. Requiere el ID del evento. Si el usuario proporciona un nombre (ej: "cancela mi reunión con Juan"), primero debes usar google.search_events para encontrar el event_id.',
    parameters: {
      type: 'object',
      properties: {
        event_id: {
          type: 'string',
          description: 'El ID único del evento a eliminar.',
        },
      },
      required: ['event_id'],
    },
  },
  {
    name: 'google.update_event',
    description: 'Actualiza un evento existente en el calendario (cambiar hora, título, etc.).',
    parameters: {
      type: 'object',
      properties: {
        event_id: {
          type: 'string',
          description: 'ID del evento a actualizar (obtenido de list_events o search_events).',
        },
        summary: {
          type: 'string',
          description: 'Nuevo título del evento (opcional).',
        },
        start_time: {
          type: 'string',
          description: 'Nueva fecha y hora de inicio en lenguaje natural (opcional).',
        },
        end_time: {
          type: 'string',
          description: 'Nueva fecha y hora de fin en lenguaje natural (opcional).',
        },
        description: {
          type: 'string',
          description: 'Nueva descripción (opcional).',
        },
        location: {
          type: 'string',
          description: 'Nueva ubicación (opcional).',
        },
      },
      required: ['event_id'],
    },
  },
  {
    name: 'answer_user',
    description: 'Responde directamente al usuario con un texto final.',
    parameters: {
      type: 'object',
      properties: {
        respuesta: {
          type: 'string',
          description: 'La respuesta final y completa para el usuario.',
        },
      },
      required: ['respuesta'],
    },
  },
];

/**
 * Herramientas de Google Tasks (TaskType: GOOGLE_TASKS)
 */
export const TASKS_TOOLS: FunctionDeclaration[] = [
  {
    name: 'google.create_task',
    description: 'Crea una nueva tarea simple, recordatorio o "to-do" en la lista de tareas principal del usuario.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'El nombre o descripción de la tarea.',
        },
        due_date: {
          type: 'string',
          description: 'La fecha de vencimiento, en lenguaje natural (ej: "today", "tomorrow", "next Monday"). Opcional.',
        },
        notes: {
          type: 'string',
          description: 'Notas adicionales sobre la tarea. Opcional.',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'google.list_tasks',
    description: 'Lista las tareas de la lista principal, filtradas por estado o fecha de vencimiento. El default es listar tareas pendientes.',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Filtrar por estado: "needsAction" (pendientes) o "completed" (completadas). Default: "needsAction".',
        },
      },
      required: [],
    },
  },
  {
    name: 'google.complete_task',
    description: 'Marca una tarea como completada.',
    parameters: {
      type: 'object',
      properties: {
        task_id: {
          type: 'string',
          description: 'ID de la tarea a completar (obtenido de list_tasks).',
        },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'answer_user',
    description: 'Responde directamente al usuario con un texto final.',
    parameters: {
      type: 'object',
      properties: {
        respuesta: {
          type: 'string',
          description: 'La respuesta final y completa para el usuario.',
        },
      },
      required: ['respuesta'],
    },
  },
];

/**
 * Herramientas de Google Drive (TaskType: GOOGLE_DRIVE)
 */
export const DRIVE_TOOLS: FunctionDeclaration[] = [
  {
    name: 'google.create_document',
    description: 'Crea un nuevo archivo de Google (Documento, Hoja de Cálculo o Presentación) en el Google Drive del usuario. El archivo estará en blanco.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'El título del nuevo documento.',
        },
        type: {
          type: 'string',
          description: 'El tipo de documento a crear: "doc" (Documento), "sheet" (Hoja de Cálculo), o "slide" (Presentación).',
        },
      },
      required: ['title', 'type'],
    },
  },
  {
    name: 'google.list_documents',
    description: 'Lista los documentos de Google Drive creados por esta aplicación.',
    parameters: {
      type: 'object',
      properties: {
        maxResults: {
          type: 'number',
          description: 'Número máximo de documentos a listar. Default: 20.',
        },
      },
      required: [],
    },
  },
  {
    name: 'answer_user',
    description: 'Responde directamente al usuario con un texto final.',
    parameters: {
      type: 'object',
      properties: {
        respuesta: {
          type: 'string',
          description: 'La respuesta final y completa para el usuario.',
        },
      },
      required: ['respuesta'],
    },
  },
];

/**
 * Obtiene las herramientas correctas según el TaskType
 */
export function getToolsForTaskType(taskType: string): FunctionDeclaration[] {
  switch (taskType) {
    case 'GMAIL':
      return GMAIL_TOOLS;
    case 'CALENDAR':
      return CALENDAR_TOOLS;
    case 'GOOGLE_TASKS':
      return TASKS_TOOLS;
    case 'GOOGLE_DRIVE':
      return DRIVE_TOOLS;
    default:
      return [];
  }
}

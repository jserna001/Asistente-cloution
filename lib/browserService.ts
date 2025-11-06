import { SupabaseClient } from '@supabase/supabase-js';

// URL del microservicio de "Manos"
// Asumimos que corre en localhost para desarrollo.
// En producción, será una URL interna (ej. http://browser-service:3001)
const BROWSER_SERVICE_URL = process.env.BROWSER_SERVICE_URL || 'http://localhost:3001';

/**
 * Encuentra una sesión activa en Supabase o crea una nueva.
 * Esta es la implementación central de la Acción 2 del Sprint Y.
 * @param userId ID del usuario autenticado (auth.uid())
 * @param supabase El cliente de Supabase (pasado desde el orquestador)
 * @returns El UUID de la sesión de navegador
 */
async function getOrCreateSession(userId: string, supabase: SupabaseClient): Promise<string> {
  // 1. Buscar una sesión activa en Supabase
  const { data: sessionData, error: sessionError } = await supabase
    .from('browser_sessions')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle(); // Solo esperamos una, o ninguna

  if (sessionError) {
    console.error('Error buscando sesión en Supabase:', sessionError);
    throw new Error(`Error al buscar sesión: ${sessionError.message}`);
  }

  // 2. Caso A: Sesión Encontrada - Verificar que existe en browser-service
  if (sessionData) {
    // Verificar que la sesión existe en el browser-service (podría haberse reiniciado)
    // NOTA: Usamos get_semantic_context en lugar de navegar a about:blank
    // para no perder el estado actual de la página
    const testResponse = await fetch(`${BROWSER_SERVICE_URL}/session/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: sessionData.id,
        action: 'get_semantic_context',
        params: {} // Sin parámetros necesarios
      }),
    });

    if (testResponse.ok) {
      // La sesión existe y funciona
      console.log(`Sesión ${sessionData.id} verificada y activa.`);
      return sessionData.id;
    } else {
      // La sesión no existe en browser-service (probablemente se reinició)
      console.log(`Sesión ${sessionData.id} no existe en browser-service. Eliminando y creando nueva...`);

      // Eliminar sesión obsoleta de Supabase
      await supabase
        .from('browser_sessions')
        .delete()
        .eq('id', sessionData.id);

      // Continuar al flujo de creación (Caso B)
    }
  }

  // 3. Caso B: Sin Sesión (Crear una nueva)
  console.log(`No se encontró sesión para ${userId}. Creando una nueva...`);

  // 3a. Llamar al browser-service para que cree el contexto en memoria
  const response = await fetch(`${BROWSER_SERVICE_URL}/session/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}), // Body vacío para satisfacer el parser de Fastify
  });

  if (!response.ok) {
    throw new Error('Fallo al crear la sesión en browser-service');
  }

  const { sessionId } = (await response.json()) as { sessionId: string };

  // 3b. Guardar el mapeo (userId -> sessionId) en Supabase
  const { error: insertError } = await supabase
    .from('browser_sessions')
    .insert({
      id: sessionId, // El UUID de la sesión
      user_id: userId,
    });

  if (insertError) {
    console.error('Error insertando sesión en Supabase:', insertError);
    throw new Error(`Error al guardar sesión: ${insertError.message}`);
  }

  console.log(`Sesión ${sessionId} creada y mapeada a ${userId}`);
  return sessionId;
}

/**
 * Función principal llamada por el orquestador (app/api/chat).
 * Traduce una intención de acción (ej. 'browse_web') en una llamada API
 * al microservicio browser-service.
 * @param userId ID del usuario autenticado
 * @param supabase Cliente de Supabase
 * @param action La primitiva a ejecutar (ej. 'browse_web', 'get_semantic_context')
 * @param params Los argumentos para la acción (ej. { url: '...' })
 * @returns El resultado (Observación) del browser-service
 */
export async function executeBrowserAction(
  userId: string,
  supabase: SupabaseClient,
  action: string,
  params: Record<string, any>
) {
  try {
    // 1. Obtener el ID de la sesión (lógica de estado)
    const sessionId = await getOrCreateSession(userId, supabase);

    // 2. Extraer el nombre de la acción sin el prefijo "browser."
    // Por ejemplo: "browser.browse_web" -> "browse_web"
    const actionName = action.startsWith('browser.') ? action.substring(8) : action;

    // 3. Llamar al endpoint /session/execute del browser-service
    const response = await fetch(`${BROWSER_SERVICE_URL}/session/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        action: actionName,
        params,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`browser-service falló la acción ${action}: ${errorBody}`);
    }

    const result = await response.json();

    // 3. Devolver la "Observación" completa con el semantic_context
    // El browser-service devuelve un objeto con { success, url, semantic_context }
    // Necesitamos pasarle TODO al agente para que pueda leer el contexto A11y
    if (result.semantic_context) {
      return JSON.stringify({
        success: true,
        action: actionName,
        semantic_context: result.semantic_context,
        url: result.url || 'N/A',
      }, null, 2);
    }

    // Fallback si no hay semantic_context
    return `Acción ${actionName} completada exitosamente.`;
    
  } catch (error) {
    console.error('Error en executeBrowserAction:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return `Error ejecutando la acción del navegador: ${errorMessage}`;
  }
}
import { Client } from '@notionhq/client';
import { decryptToken as decryptTokenFromObject } from './tokenService';
import { createClient } from '@supabase/supabase-js';


/**
 * Añade un nuevo bloque de "to-do" a una página específica de Notion
 * utilizando las credenciales de un usuario específico.
 *
 * @param userId El ID del usuario de Supabase para buscar sus credenciales.
 * @param pageId El ID de la página de Notion donde se añadirá la tarea.
 * @param todoText El texto de la tarea a añadir.
 */
export async function addNotionTodo(userId: string, pageId: string, todoText: string): Promise<void> {
  console.log(`Iniciando la adición de tarea a Notion para el usuario: ${userId}`);

  // Paso 1: Obtener el Token de Notion del Usuario.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } } // Usar clave de servicio para acceso a nivel de servidor
  );

  const { data: credential, error: dbError } = await supabase
    .from('user_credentials')
    .select('encrypted_refresh_token, iv, auth_tag')
    .eq('user_id', userId)
    .eq('service_name', 'notion')
    .single();

  if (dbError || !credential) {
    console.error('Error buscando el token de Notion:', dbError);
    throw new Error(`No se encontraron credenciales de Notion para el usuario ${userId}.`);
  }

  // Paso 2: Descifrar el Token.
  const decryptedAccessToken = await decryptTokenFromObject(credential);

  // Paso 3: Crear un Cliente de Notion Específico.
  const notion = new Client({ auth: decryptedAccessToken });

  // Paso 4: Añadir la Tarea.
  try {
    await notion.blocks.children.append({
      block_id: pageId,
      children: [
        {
          object: 'block',
          type: 'to_do',
          to_do: {
            rich_text: [
              {
                type: 'text',
                text: { content: todoText },
              },
            ],
            checked: false,
          },
        },
      ],
    });
    console.log(`Tarea '${todoText}' añadida a Notion exitosamente para el usuario ${userId}.`);
  } catch (error) {
    console.error('Error al añadir la tarea en Notion:', error);
    throw new Error('No se pudo añadir la tarea a Notion.');
  }
}
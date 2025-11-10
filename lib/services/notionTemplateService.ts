/**
 * Servicio de Gestión de Plantillas de Notion
 *
 * Este servicio maneja la clonación automática de plantillas predeterminadas
 * de Notion según el perfil del usuario durante el onboarding.
 *
 * Utiliza la API directa de Notion (@notionhq/client) para crear databases, páginas y vistas.
 */

import { Client as NotionClient } from '@notionhq/client';
import { createClient } from '@supabase/supabase-js';

// =====================================================
// TIPOS Y INTERFACES
// =====================================================

interface TemplateDatabaseProperty {
  type: string;
  [key: string]: any;
}

interface TemplateDatabaseView {
  name: string;
  type: 'table' | 'board' | 'calendar' | 'list' | 'gallery' | 'timeline';
  group_by?: string;
  sort_by?: string;
  filter?: any;
}

interface TemplateDatabase {
  name: string;
  icon: string;
  description?: string;
  properties: Record<string, TemplateDatabaseProperty>;
  views?: TemplateDatabaseView[];
}

interface TemplatePage {
  name: string;
  icon: string;
  content: any[];
}

interface TemplateStructure {
  databases: TemplateDatabase[];
  pages: TemplatePage[];
}

interface InstallationResult {
  success: boolean;
  installedIds: Record<string, string>;
  error?: string;
  progress?: number;
}

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

/**
 * Convierte un nombre a formato slug (ej: "Task Manager" -> "task_manager")
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

/**
 * Extrae el ID de página de la respuesta de Notion API
 */
function extractPageId(result: any): string {
  try {
    // La respuesta de la API de Notion devuelve directamente el objeto con id
    if (result && result.id) {
      return result.id;
    }

    // Si viene como string directamente
    if (typeof result === 'string') {
      return result;
    }

    console.error('[TEMPLATE] No se pudo extraer page_id de:', JSON.stringify(result));
    throw new Error('No se pudo extraer el ID de la página');
  } catch (error: any) {
    console.error('[TEMPLATE] Error extrayendo page_id:', error);
    throw error;
  }
}

/**
 * Extrae el ID de database de la respuesta de Notion API
 */
function extractDatabaseId(result: any): string {
  return extractPageId(result); // Mismo formato que las páginas
}

/**
 * Actualiza el progreso de instalación en la base de datos
 */
async function updateInstallationProgress(
  userId: string,
  templatePackId: string,
  progress: number,
  status: 'installing' | 'completed' | 'failed' = 'installing'
): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await supabase
    .from('user_notion_templates')
    .update({
      installation_progress: progress,
      installation_status: status,
      ...(status === 'installing' && !progress ? { installation_started_at: new Date().toISOString() } : {}),
      ...(status === 'completed' ? { installation_completed_at: new Date().toISOString() } : {})
    })
    .match({ user_id: userId, template_pack_id: templatePackId });
}

// =====================================================
// FUNCIÓN PRINCIPAL DE INSTALACIÓN
// =====================================================

/**
 * Instala una plantilla completa de Notion para un usuario
 *
 * @param userId - ID del usuario en Supabase
 * @param notionAccessToken - Token de acceso OAuth de Notion del usuario
 * @param templatePackId - ID del pack de plantilla a instalar
 * @returns Resultado de la instalación con IDs creados
 */
export async function installNotionTemplate(
  userId: string,
  notionAccessToken: string,
  templatePackId: string
): Promise<InstallationResult> {

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    console.log(`[TEMPLATE] ========================================`);
    console.log(`[TEMPLATE] Iniciando instalación de plantilla`);
    console.log(`[TEMPLATE] Usuario: ${userId.substring(0, 8)}...`);
    console.log(`[TEMPLATE] Plantilla: ${templatePackId}`);
    console.log(`[TEMPLATE] ========================================`);

    // 1. Obtener la plantilla del catálogo
    console.log(`[TEMPLATE] Paso 1/6: Obteniendo plantilla del catálogo...`);
    const { data: template, error: templateError } = await supabase
      .from('notion_template_catalog')
      .select('*')
      .eq('template_pack_id', templatePackId)
      .eq('is_active', true)
      .single();

    if (templateError || !template) {
      throw new Error(`Plantilla '${templatePackId}' no encontrada o no está activa`);
    }

    console.log(`[TEMPLATE] ✓ Plantilla obtenida: ${template.name}`);

    const structure: TemplateStructure = template.template_structure;
    const installedIds: Record<string, string> = {};

    // 2. Crear registro de instalación
    console.log(`[TEMPLATE] Paso 2/6: Creando registro de instalación...`);
    await supabase
      .from('user_notion_templates')
      .upsert({
        user_id: userId,
        template_pack_id: templatePackId,
        installation_status: 'installing',
        installation_progress: 0,
        installation_started_at: new Date().toISOString()
      });

    // 3. Crear página padre (workspace principal)
    console.log(`[TEMPLATE] Paso 3/6: Creando workspace principal en Notion...`);
    await updateInstallationProgress(userId, templatePackId, 10);

    // Inicializar cliente de Notion con el token del usuario
    const notion = new NotionClient({ auth: notionAccessToken });

    // Buscar una página raíz en el workspace del usuario donde colocar la plantilla
    console.log('[TEMPLATE] Buscando workspace del usuario...');

    // Intentamos buscar cualquier página existente para usarla como parent
    const searchResult = await notion.search({
      filter: { property: 'object', value: 'page' },
      page_size: 10,
      sort: { direction: 'descending', timestamp: 'last_edited_time' }
    });

    let parentPageId: string;

    if (searchResult.results.length > 0) {
      // Usar la página más reciente como parent
      const recentPage: any = searchResult.results[0];
      const pageName = recentPage.properties?.title?.title?.[0]?.text?.content || 'Untitled';
      console.log(`[TEMPLATE] Creando plantilla dentro de: "${pageName}" (${recentPage.id})`);

      const parentPageResult = await notion.pages.create({
        parent: {
          type: 'page_id',
          page_id: recentPage.id
        },
        properties: {
          title: {
            title: [{ text: { content: `📦 ${template.name}` } }]
          }
        },
        icon: { type: 'emoji', emoji: template.icon || '📁' }
      });

      parentPageId = extractPageId(parentPageResult);
    } else {
      // Si no hay páginas, buscar bases de datos
      console.log('[TEMPLATE] No se encontraron páginas, buscando bases de datos...');
      const dbSearchResult = await notion.search({
        filter: { property: 'object', value: 'database' },
        page_size: 1
      });

      if (dbSearchResult.results.length > 0) {
        // Crear como página hija de una database
        const database: any = dbSearchResult.results[0];
        console.log(`[TEMPLATE] Creando plantilla en database: ${database.id}`);

        const parentPageResult = await notion.pages.create({
          parent: {
            type: 'database_id',
            database_id: database.id
          },
          properties: {
            title: {
              title: [{ text: { content: `📦 ${template.name}` } }]
            }
          },
          icon: { type: 'emoji', emoji: template.icon || '📁' }
        });

        parentPageId = extractPageId(parentPageResult);
      } else {
        // Último recurso: el usuario debe crear al menos una página manualmente
        throw new Error(
          'No se encontraron páginas ni bases de datos en tu workspace de Notion. ' +
          'Por favor, abre Notion, crea una página nueva y vuelve a intentar la instalación.'
        );
      }
    }

    installedIds['parent_page_id'] = parentPageId;
    console.log(`[TEMPLATE] ✓ Workspace de plantilla creado: ${parentPageId}`);

    await updateInstallationProgress(userId, templatePackId, 20);

    // 4. Crear databases
    console.log(`[TEMPLATE] Paso 4/6: Creando databases (${structure.databases.length})...`);
    const totalDatabases = structure.databases.length;

    for (let i = 0; i < totalDatabases; i++) {
      const db = structure.databases[i];
      const progressStart = 20;
      const progressEnd = 60;
      const dbProgress = progressStart + ((progressEnd - progressStart) / totalDatabases) * (i + 1);

      console.log(`[TEMPLATE] Creando database ${i + 1}/${totalDatabases}: ${db.name}...`);

      try {
        // Convertir propiedades al formato de Notion API
        const notionProperties: Record<string, any> = {};

        for (const [propName, propConfig] of Object.entries(db.properties)) {
          notionProperties[propName] = propConfig;
        }

        // Crear la database usando la API directa de Notion
        const dbResult = await notion.databases.create({
          parent: {
            type: 'page_id',
            page_id: parentPageId
          },
          title: [
            {
              type: 'text',
              text: { content: db.name }
            }
          ],
          properties: notionProperties,
          ...(db.icon ? { icon: { type: 'emoji', emoji: db.icon } } : {})
        });

        const dbId = extractDatabaseId(dbResult);
        const dbKey = `db_${slugify(db.name)}`;
        installedIds[dbKey] = dbId;

        console.log(`[TEMPLATE] ✓ Database ${db.name} creada: ${dbId}`);

        // Crear vistas si están definidas (puede no estar soportado aún por MCP)
        if (db.views && db.views.length > 0) {
          console.log(`[TEMPLATE]   Creando ${db.views.length} vistas...`);
          // Por ahora, las vistas pueden crearse manualmente o en futuras versiones MCP
        }

      } catch (dbError: any) {
        console.error(`[TEMPLATE] ✗ Error creando database ${db.name}:`, dbError.message);
        // Continuamos con las demás
      }

      await updateInstallationProgress(userId, templatePackId, Math.round(dbProgress));
    }

    // 5. Crear páginas adicionales
    console.log(`[TEMPLATE] Paso 5/6: Creando páginas adicionales (${structure.pages.length})...`);
    const totalPages = structure.pages.length;

    for (let i = 0; i < totalPages; i++) {
      const page = structure.pages[i];
      const progressStart = 60;
      const progressEnd = 90;
      const pageProgress = progressStart + ((progressEnd - progressStart) / totalPages) * (i + 1);

      console.log(`[TEMPLATE] Creando página ${i + 1}/${totalPages}: ${page.name}...`);

      try {
        const pageResult = await notion.pages.create({
          parent: {
            type: 'page_id',
            page_id: parentPageId
          },
          properties: {
            title: {
              title: [{ text: { content: page.name } }]
            }
          },
          ...(page.icon ? { icon: { type: 'emoji', emoji: page.icon } } : {}),
          children: page.content || []
        });

        const pageId = extractPageId(pageResult);
        const pageKey = `page_${slugify(page.name)}`;
        installedIds[pageKey] = pageId;

        console.log(`[TEMPLATE] ✓ Página ${page.name} creada: ${pageId}`);

      } catch (pageError: any) {
        console.error(`[TEMPLATE] ✗ Error creando página ${page.name}:`, pageError.message);
      }

      await updateInstallationProgress(userId, templatePackId, Math.round(pageProgress));
    }

    // 6. Actualizar estado final
    console.log(`[TEMPLATE] Paso 6/6: Finalizando instalación...`);

    await supabase
      .from('user_notion_templates')
      .update({
        installation_status: 'completed',
        installation_progress: 100,
        installed_notion_ids: installedIds,
        installation_completed_at: new Date().toISOString()
      })
      .match({ user_id: userId, template_pack_id: templatePackId });

    // 7. Actualizar user_preferences
    const databaseIds = Object.entries(installedIds)
      .filter(([key]) => key.startsWith('db_'))
      .map(([, id]) => id);

    await supabase
      .from('user_preferences')
      .upsert({
        user_id: userId,
        selected_template_pack: templatePackId,
        template_installed: true,
        notion_database_ids: databaseIds,
        ...(template.suggested_preferences || {})
      }, {
        onConflict: 'user_id'
      });

    console.log(`[TEMPLATE] ========================================`);
    console.log(`[TEMPLATE] ✓ Instalación completada exitosamente`);
    console.log(`[TEMPLATE] Elementos creados: ${Object.keys(installedIds).length}`);
    console.log(`[TEMPLATE] ========================================`);

    return {
      success: true,
      installedIds,
      progress: 100
    };

  } catch (error: any) {
    console.error(`[TEMPLATE] ========================================`);
    console.error(`[TEMPLATE] ✗ Error instalando plantilla:`, error.message);
    console.error(`[TEMPLATE] Stack:`, error.stack);
    console.error(`[TEMPLATE] ========================================`);

    // Actualizar estado a 'failed'
    await supabase
      .from('user_notion_templates')
      .update({
        installation_status: 'failed',
        installation_error: error.message
      })
      .match({ user_id: userId, template_pack_id: templatePackId });

    return {
      success: false,
      installedIds: {},
      error: error.message
    };
  }
}

// =====================================================
// FUNCIONES AUXILIARES DE CONSULTA
// =====================================================

/**
 * Obtiene el catálogo completo de plantillas disponibles
 */
export async function getTemplatesCatalog(): Promise<any[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase
    .from('notion_template_catalog')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('[TEMPLATE] Error obteniendo catálogo:', error);
    return [];
  }

  return data || [];
}

/**
 * Obtiene el estado de instalación de una plantilla para un usuario
 */
export async function getTemplateInstallationStatus(
  userId: string,
  templatePackId: string
): Promise<any> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('user_notion_templates')
    .select('*')
    .eq('user_id', userId)
    .eq('template_pack_id', templatePackId)
    .maybeSingle();

  if (error) {
    console.error('[TEMPLATE] Error obteniendo estado:', error);
    return null;
  }

  return data;
}

/**
 * Obtiene todas las plantillas instaladas por un usuario
 */
export async function getUserInstalledTemplates(userId: string): Promise<any[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('user_notion_templates')
    .select(`
      *,
      template:notion_template_catalog(*)
    `)
    .eq('user_id', userId)
    .eq('installation_status', 'completed');

  if (error) {
    console.error('[TEMPLATE] Error obteniendo plantillas instaladas:', error);
    return [];
  }

  return data || [];
}

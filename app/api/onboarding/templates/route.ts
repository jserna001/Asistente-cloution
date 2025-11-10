/**
 * API Endpoint: GET /api/onboarding/templates
 *
 * Obtiene el catálogo completo de plantillas disponibles.
 * Se usa en el componente de onboarding para mostrar las opciones al usuario.
 *
 * Respuesta:
 * [
 *   {
 *     "id": "uuid",
 *     "template_pack_id": "student",
 *     "name": "📚 Estudiante",
 *     "description": "Organiza tus clases...",
 *     "icon": "📚",
 *     "target_audience": ["Estudiantes", "Cursos online"],
 *     "template_structure": {...},
 *     "default_rag_queries": {...},
 *     "suggested_preferences": {...}
 *   },
 *   ...
 * ]
 */

import { NextResponse } from 'next/server';
import { getTemplatesCatalog } from '@/lib/services/notionTemplateService';

export async function GET(request: Request) {
  try {
    console.log('[API-TEMPLATES] Obteniendo catálogo de plantillas...');

    const templates = await getTemplatesCatalog();

    console.log(`[API-TEMPLATES] ✓ Encontradas ${templates.length} plantillas activas`);

    // Eliminar campos innecesarios para el frontend (optimizar tamaño)
    const simplifiedTemplates = templates.map(t => ({
      id: t.id,
      template_pack_id: t.template_pack_id,
      name: t.name,
      description: t.description,
      icon: t.icon,
      target_audience: t.target_audience,
      // No incluimos template_structure completo para ahorrar ancho de banda
      // Solo lo necesitamos en el backend al instalar
      hasStructure: !!t.template_structure,
      display_order: t.display_order
    }));

    return NextResponse.json({
      success: true,
      templates: simplifiedTemplates
    });

  } catch (error: any) {
    console.error('[API-TEMPLATES] Error obteniendo catálogo:', error);
    return NextResponse.json({
      error: 'Error obteniendo catálogo de plantillas',
      details: error.message
    }, { status: 500 });
  }
}

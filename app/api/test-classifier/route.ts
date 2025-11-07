import { NextResponse } from 'next/server';
import { classifyTask } from '../../../lib/orchestration/taskClassifier';

/**
 * Endpoint de prueba para verificar el clasificador de tareas
 * GET /api/test-classifier?query=tu+query+aqui
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('query');

    if (!query) {
      return NextResponse.json(
        { error: 'Se requiere el parámetro "query"' },
        { status: 400 }
      );
    }

    // Ejecutar clasificación
    const ragContext = ''; // Sin contexto RAG para test
    const taskType = await classifyTask(query, ragContext);

    // Verificar si debería aplicar override
    const hasNotion = query.toLowerCase().includes('notion');
    const overrideShouldApply = hasNotion;
    const overrideApplied = hasNotion && taskType === 'NOTION_MCP';

    return NextResponse.json({
      success: true,
      query,
      taskType,
      metadata: {
        hasNotion,
        overrideShouldApply,
        overrideApplied,
        expectedType: hasNotion ? 'NOTION_MCP' : 'any',
        isCorrect: !hasNotion || taskType === 'NOTION_MCP'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[TEST-CLASSIFIER] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: error.stack
      },
      { status: 500 }
    );
  }
}

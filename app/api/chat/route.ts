require('dotenv').config();

import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { executeRAG } from '../../../lib/ragService';
import { orchestrateModelExecution } from '../../../lib/orchestration/modelOrchestrator';
import { ExecutionContext } from '../../../lib/orchestration/types';
import { logLearningEvent, getUserFacts } from '../../../lib/learningLogger';

/**
 * Endpoint de la API para chatear con el asistente.
 * NUEVO: Implementa orquestación multi-modelo inteligente
 * - Gemini Flash para tareas simples (económico)
 * - Gemini Pro para RAG y navegador (preciso)
 * - Claude Sonnet para Notion MCP y tareas complejas (potente)
 */
export async function POST(req: Request) {
  try {
    // --- Autenticación (El Guardia) ---
    const cookieStore = await (cookies() as any);
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const userId = user.id;

    // Leer el query y el historial del body de la solicitud
    const { query, history = [] } = await req.json();
    if (!query) {
      return NextResponse.json({ error: 'La consulta (query) es requerida' }, { status: 400 });
    }

    console.log(`\n[CHAT API] Nueva solicitud de usuario: ${userId}`);
    console.log(`[CHAT API] Query: "${query.substring(0, 100)}..."`);

    // Paso de Pre-procesamiento RAG (siempre ejecutar para tener contexto)
    console.log(`[CHAT API] Ejecutando RAG (pre-búsqueda)...`);
    const ragContext = await executeRAG(supabase, userId, query);

    // Obtener hechos del usuario para enriquecer contexto
    const userFacts = await getUserFacts(supabase, userId, ['preference', 'context', 'goal'], 5);
    const factsContext = userFacts.length > 0
      ? `\n\nContexto personal del usuario:\n${userFacts.map(f => `- ${f.content}`).join('\n')}`
      : '';

    // Preparar contexto de ejecución
    const context: ExecutionContext = {
      userId,
      query,
      history,
      ragContext: ragContext + factsContext,
      supabase
    };

    // NUEVO: Usar el orquestador multi-modelo
    const result = await orchestrateModelExecution(context);

    console.log(`[CHAT API] ✓ Respuesta generada con ${result.modelUsed}`);
    console.log(`[CHAT API] Tipo de tarea: ${result.taskType}`);
    console.log(`[CHAT API] Tiempo de ejecución: ${result.executionTimeMs}ms\n`);

    // Registrar evento de aprendizaje (async, no bloquea respuesta)
    logLearningEvent(supabase, userId, {
      eventType: 'query',
      queryText: query,
      taskTypeClassified: result.taskType,
      modelUsed: result.modelUsed,
      executionTimeMs: result.executionTimeMs,
      success: true,
      metadata: {
        historyLength: history.length,
        ragContextLength: ragContext.length,
        userFactsCount: userFacts.length
      }
    }).catch(err => console.error('[CHAT API] Error logging event:', err));

    return NextResponse.json({
      answer: result.answer,
      // Metadata adicional para debugging/analytics
      metadata: {
        modelUsed: result.modelUsed,
        taskType: result.taskType,
        executionTimeMs: result.executionTimeMs
      }
    });

  } catch (error: any) {
    console.error('[CHAT API] Error en el endpoint de chat:', error);
    console.error('[CHAT API] Error stack:', error.stack);
    console.error('[CHAT API] Error details:', JSON.stringify(error, null, 2));

    // Intentar loguear el error (requiere supabase y userId del contexto anterior)
    // Nota: Este logging es best-effort, no debería fallar la respuesta
    try {
      const cookieStore = await (cookies() as any);
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) { return cookieStore.get(name)?.value },
            set() {},
            remove() {},
          },
        }
      );
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await logLearningEvent(supabase, user.id, {
          eventType: 'error',
          success: false,
          metadata: {
            errorMessage: error.message,
            errorType: error.constructor.name
          }
        });
      }
    } catch (logError) {
      console.error('[CHAT API] Error logging failure event:', logError);
    }

    return NextResponse.json({
      error: 'Ocurrió un error interno en el servidor.',
      details: error.message,
      errorType: error.constructor.name,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

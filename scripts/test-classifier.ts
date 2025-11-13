/**
 * Script de prueba para verificar la clasificación de tareas
 *
 * IMPORTANTE: Asegúrate de tener GEMINI_API_KEY en las variables de entorno
 *
 * Uso:
 * GEMINI_API_KEY=tu_api_key npx tsx scripts/test-classifier.ts
 */

import { classifyTask } from '../lib/orchestration/taskClassifier';

interface TestCase {
  query: string;
  expected: string;
  description: string;
}

async function testClassifier() {
  console.log('=== TEST DE CLASIFICADOR MEJORADO ===\n');

  // Verificar que GEMINI_API_KEY esté disponible
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ ERROR: GEMINI_API_KEY no está configurada en las variables de entorno');
    console.error('   Por favor ejecuta: GEMINI_API_KEY=tu_api_key npx tsx scripts/test-classifier.ts');
    process.exit(1);
  }

  const testCases: TestCase[] = [
    // === CASOS CRÍTICOS (los que estaban fallando) ===
    {
      query: 'Agregar nota sobre ideas del día',
      expected: 'NOTION_MCP',
      description: '🔥 CASO CRÍTICO: Agregar nota sin mencionar "Notion"'
    },
    {
      query: 'Crear tarea: Comprar leche',
      expected: 'NOTION_MCP',
      description: '🔥 CASO CRÍTICO: Crear tarea (debería usar Claude MCP)'
    },
    {
      query: 'Nueva página para proyecto X',
      expected: 'NOTION_MCP',
      description: '🔥 CASO CRÍTICO: Nueva página sin mencionar "Notion"'
    },
    {
      query: 'Guardar esta idea',
      expected: 'NOTION_MCP',
      description: '🔥 CASO CRÍTICO: Guardar idea'
    },

    // === CASOS CON "NOTION" EXPLÍCITO (deberían funcionar siempre) ===
    {
      query: 'Busca en Notion páginas sobre marketing',
      expected: 'NOTION_MCP',
      description: 'Búsqueda explícita en Notion'
    },
    {
      query: 'Crea una página en Notion con título "Test"',
      expected: 'NOTION_MCP',
      description: 'Crear página con "Notion" explícito'
    },

    // === CASOS DE NOTION SIN PALABRA "NOTION" ===
    {
      query: 'Busca en mis tareas pendientes',
      expected: 'NOTION_MCP',
      description: 'Buscar tareas (detección por keywords)'
    },
    {
      query: 'Lista mis recordatorios',
      expected: 'NOTION_MCP',
      description: 'Listar recordatorios'
    },
    {
      query: 'Crea una entrada en mi base de datos',
      expected: 'NOTION_MCP',
      description: 'Crear entrada en database'
    },
    {
      query: 'Agrégame una tarea para mañana',
      expected: 'NOTION_MCP',
      description: 'Agregar tarea informal'
    },

    // === CASOS DE SIMPLE (control) ===
    {
      query: 'Hola, ¿cómo estás?',
      expected: 'SIMPLE',
      description: 'Saludo simple'
    },
    {
      query: 'Gracias',
      expected: 'SIMPLE',
      description: 'Agradecimiento'
    },

    // === CASOS DE BROWSER ===
    {
      query: 'Navega a google.com',
      expected: 'BROWSER',
      description: 'Navegación web'
    },
    {
      query: 'Busca información sobre IA en internet',
      expected: 'BROWSER',
      description: 'Búsqueda en internet'
    },

    // === CASOS DE RAG ===
    {
      query: '¿Hay correos importantes?',
      expected: 'RAG',
      description: 'Pregunta sobre correos'
    }
  ];

  let passed = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const testCase of testCases) {
    console.log(`\n📝 "${testCase.query}"`);
    console.log(`   ${testCase.description}`);
    console.log('-'.repeat(70));

    try {
      const result = await classifyTask(testCase.query, '');

      const isCorrect = result === testCase.expected;
      const status = isCorrect ? '✅ PASS' : '❌ FAIL';

      console.log(`${status} - Clasificado: ${result} | Esperado: ${testCase.expected}`);

      if (isCorrect) {
        passed++;
      } else {
        failed++;
        failures.push(`"${testCase.query}" → Got ${result}, expected ${testCase.expected}`);
      }
    } catch (error: any) {
      console.log(`❌ ERROR: ${error.message}`);
      failed++;
      failures.push(`"${testCase.query}" → Error: ${error.message}`);
    }
  }

  // === RESUMEN ===
  console.log('\n\n' + '='.repeat(70));
  console.log('📊 RESUMEN DE TESTS');
  console.log('='.repeat(70));
  console.log(`Total: ${testCases.length} tests`);
  console.log(`✅ Passed: ${passed} (${Math.floor(passed / testCases.length * 100)}%)`);
  console.log(`❌ Failed: ${failed} (${Math.floor(failed / testCases.length * 100)}%)`);

  if (failures.length > 0) {
    console.log('\n❌ FALLOS:');
    failures.forEach(f => console.log(`   - ${f}`));
  } else {
    console.log('\n🎉 ¡TODOS LOS TESTS PASARON!');
  }

  console.log('='.repeat(70) + '\n');
}

testClassifier().catch(console.error);

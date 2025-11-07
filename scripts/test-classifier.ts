// Script de prueba para verificar la clasificación de tareas
import { config } from 'dotenv';
config({ path: './.env.local' });

import { classifyTask } from '../lib/orchestration/taskClassifier';

async function testClassifier() {
  console.log('=== TEST DE CLASIFICADOR ===\n');

  const testQueries = [
    'Busca en Notion páginas sobre marketing',
    'Crea una página en Notion con título "Test"',
    'notion buscar documentos',
    'NOTION crear página',
    '¿Qué tengo en mi Notion?',
    'Hola', // Control - debería ser SIMPLE
    '¿Qué tareas tengo?', // Control - debería ser RAG
  ];

  for (const query of testQueries) {
    console.log(`\n📝 Query: "${query}"`);
    console.log('-'.repeat(60));

    try {
      const ragContext = ''; // Sin contexto RAG para esta prueba
      const result = await classifyTask(query, ragContext);

      const hasNotion = query.toLowerCase().includes('notion');
      const isCorrect = hasNotion ? (result === 'NOTION_MCP') : true;
      const status = isCorrect ? '✅' : '❌';

      console.log(`${status} Clasificación: ${result}`);
      console.log(`   Contiene "Notion": ${hasNotion}`);
      console.log(`   Esperado: ${hasNotion ? 'NOTION_MCP' : 'SIMPLE/RAG'}`);

      if (!isCorrect) {
        console.log('   ⚠️ FALLO: Clasificación incorrecta!');
      }
    } catch (error: any) {
      console.log(`❌ Error: ${error.message}`);
    }
  }

  console.log('\n=== FIN DE PRUEBAS ===');
}

testClassifier().catch(console.error);

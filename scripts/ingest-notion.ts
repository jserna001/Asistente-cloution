/**
 * Script Manual de Ingesta de Notion
 *
 * Ejecuta la ingesta de páginas de Notion para un usuario específico.
 * Ahora usa la función reutilizable del servicio de ingesta.
 *
 * Uso:
 *   npx tsx scripts/ingest-notion.ts
 */

import * as dotenv from 'dotenv';

// Cargar variables de entorno desde .env.local
dotenv.config({ path: './.env.local' });

if (!process.env.ENCRYPTION_KEY) {
  console.error('Error: ENCRYPTION_KEY no está definida. Asegúrate de que .env.local existe y tiene todas las variables.');
  process.exit(1);
}

import { ingestNotionData } from '../lib/ingestionService';

// --- CONFIGURACIÓN ---
// TODO: Reemplaza este placeholder con el ID de usuario real para el que quieres ingestar datos de Notion.
const userId = '575a8929-81b3-4efa-ba4d-31b86b523c74';
// -------------------

/**
 * Ejecuta la ingesta manual de Notion
 */
async function main() {
  console.log('===========================================');
  console.log('  Script Manual de Ingesta de Notion');
  console.log('===========================================');
  console.log(`Usuario: ${userId.substring(0, 8)}...`);
  console.log();

  try {
    const result = await ingestNotionData(userId);

    console.log();
    console.log('===========================================');
    if (result.success) {
      console.log('✅ Ingesta completada exitosamente');
      console.log(`   Páginas procesadas: ${result.pagesProcessed}`);
    } else {
      console.log('⚠️  Ingesta completada con advertencias');
      console.log(`   Error: ${result.error}`);
    }
    console.log('===========================================');

  } catch (error: any) {
    console.error();
    console.error('===========================================');
    console.error('❌ Error fatal durante la ingesta:');
    console.error(`   ${error.message}`);
    console.error('===========================================');
    process.exit(1);
  }
}

main();

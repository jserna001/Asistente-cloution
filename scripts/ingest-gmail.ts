/**
 * Script Manual de Ingesta de Gmail
 *
 * Ejecuta la ingesta de correos de Gmail para un usuario específico.
 * Ahora usa la función reutilizable del servicio de ingesta.
 *
 * Uso:
 *   npx tsx scripts/ingest-gmail.ts
 */

// Carga las variables de entorno desde .env.local ANTES de cualquier import
import { config } from 'dotenv';
config({ path: './.env.local' });

// Esperar a que dotenv se cargue completamente
if (!process.env.ENCRYPTION_KEY) {
  console.error('Error: ENCRYPTION_KEY no está definida. Asegúrate de que .env.local existe y tiene todas las variables.');
  process.exit(1);
}

import { ingestGmailData } from '../lib/ingestionService';

// --- CONFIGURACIÓN ---
// TODO: Reemplaza este placeholder con el ID de usuario real para el que quieres ingestar correos.
const userId = '575a8929-81b3-4efa-ba4d-31b86b523c74';
// -------------------

/**
 * Ejecuta la ingesta manual de Gmail
 */
async function main() {
  console.log('===========================================');
  console.log('  Script Manual de Ingesta de Gmail');
  console.log('===========================================');
  console.log(`Usuario: ${userId.substring(0, 8)}...`);
  console.log();

  try {
    const result = await ingestGmailData(userId);

    console.log();
    console.log('===========================================');
    if (result.success) {
      console.log('✅ Ingesta completada exitosamente');
      console.log(`   Correos procesados: ${result.emailsProcessed}`);
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

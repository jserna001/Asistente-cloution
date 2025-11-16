// Carga las variables de entorno desde .env.local ANTES de cualquier import
import { config } from 'dotenv';
config({ path: './.env.local' });

// Validar variables de entorno críticas
if (!process.env.ENCRYPTION_KEY) {
  console.error('Error: ENCRYPTION_KEY no está definida. Asegúrate de que .env.local existe y tiene todas las variables.');
  process.exit(1);
}

import { createClient } from '@supabase/supabase-js';
import { GmailSyncService } from '../lib/gmailService';

/**
 * Script CLI para sincronizar Gmail de uno o múltiples usuarios
 *
 * Uso:
 *   npx tsx scripts/ingest-gmail.ts [userId]                    - Sincronizar usuario específico
 *   npx tsx scripts/ingest-gmail.ts --all                       - Sincronizar todos los usuarios con credenciales
 *   npx tsx scripts/ingest-gmail.ts [userId] --force-full-sync  - Forzar sincronización completa
 *
 * Ejemplos:
 *   npx tsx scripts/ingest-gmail.ts 575a8929-81b3-4efa-ba4d-31b86b523c74
 *   npx tsx scripts/ingest-gmail.ts --all
 *   npx tsx scripts/ingest-gmail.ts 575a8929-81b3-4efa-ba4d-31b86b523c74 --force-full-sync
 */

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     Worker de Sincronización de Gmail (v2.0)          ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  try {
    // 1. Validar variables de entorno
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!supabaseUrl || !supabaseServiceKey || !geminiApiKey) {
      throw new Error('Faltan variables de entorno críticas (Supabase o Gemini API)');
    }

    // 2. Parsear argumentos de línea de comandos
    const args = process.argv.slice(2);
    const syncAll = args.includes('--all');
    const forceFullSync = args.includes('--force-full-sync');
    const targetUserId = args.find(arg => !arg.startsWith('--'));

    // 3. Inicializar servicio
    const gmailService = new GmailSyncService(supabaseUrl, supabaseServiceKey, geminiApiKey);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 4. Determinar usuarios a sincronizar
    let userIds: string[] = [];

    if (syncAll) {
      console.log('🔍 Buscando todos los usuarios con credenciales de Google...\n');

      const { data: users, error } = await supabase
        .from('user_credentials')
        .select('user_id')
        .eq('service_name', 'google');

      if (error) {
        throw new Error(`Error obteniendo usuarios: ${error.message}`);
      }

      userIds = users.map(u => u.user_id);
      console.log(`✓ Encontrados ${userIds.length} usuarios con credenciales de Google\n`);

    } else if (targetUserId) {
      userIds = [targetUserId];
      console.log(`🎯 Sincronizando usuario específico: ${targetUserId}\n`);

    } else {
      console.error('❌ Error: Debes especificar un userId o usar --all\n');
      console.log('Uso:');
      console.log('  npx tsx scripts/ingest-gmail.ts [userId]');
      console.log('  npx tsx scripts/ingest-gmail.ts --all');
      console.log('  npx tsx scripts/ingest-gmail.ts [userId] --force-full-sync\n');
      process.exit(1);
    }

    // 5. Sincronizar cada usuario
    let totalProcessed = 0;
    let totalSkipped = 0;
    let successCount = 0;
    let errorCount = 0;

    for (const userId of userIds) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📧 Procesando usuario: ${userId}`);
      console.log(`${'='.repeat(60)}\n`);

      try {
        const result = await gmailService.syncUserGmail(userId, forceFullSync);

        if (result.success) {
          successCount++;
          totalProcessed += result.emailsProcessed;
          totalSkipped += result.emailsSkipped;

          console.log('\n✅ SINCRONIZACIÓN EXITOSA');
          console.log(`   - Emails procesados: ${result.emailsProcessed}`);
          console.log(`   - Emails omitidos: ${result.emailsSkipped}`);
          console.log(`   - Tipo: ${result.isFirstSync ? 'Inicial' : 'Incremental'}`);
          console.log(`   - Duración: ${(result.duration / 1000).toFixed(2)}s`);
          if (result.newHistoryId) {
            console.log(`   - Nuevo History ID: ${result.newHistoryId}`);
          }
        } else {
          errorCount++;
          console.error(`\n❌ SINCRONIZACIÓN FALLIDA`);
          console.error(`   - Error: ${result.error}`);
        }

      } catch (error: any) {
        errorCount++;
        console.error(`\n❌ ERROR INESPERADO: ${error.message}`);
      }
    }

    // 6. Resumen final
    console.log(`\n\n${'═'.repeat(60)}`);
    console.log('📊 RESUMEN FINAL');
    console.log(`${'═'.repeat(60)}`);
    console.log(`Usuarios procesados:     ${successCount}/${userIds.length}`);
    console.log(`Usuarios con errores:    ${errorCount}`);
    console.log(`Total emails procesados: ${totalProcessed}`);
    console.log(`Total emails omitidos:   ${totalSkipped}`);
    console.log(`${'═'.repeat(60)}\n`);

    if (errorCount > 0) {
      console.warn('⚠️  Algunos usuarios tuvieron errores. Revisa los logs arriba.\n');
      process.exit(1);
    } else {
      console.log('✨ Sincronización completada exitosamente para todos los usuarios.\n');
      process.exit(0);
    }

  } catch (error: any) {
    console.error('\n❌ ERROR FATAL:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

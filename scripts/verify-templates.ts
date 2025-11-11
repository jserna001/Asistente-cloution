/**
 * Script para verificar el estado del catálogo de plantillas
 *
 * Uso:
 *   npx tsx scripts/verify-templates.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Faltan variables de entorno requeridas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verify() {
  console.log('🔍 Verificando estado del catálogo de plantillas...\n');

  // 1. Verificar que la tabla existe
  console.log('1️⃣ Verificando existencia de la tabla notion_template_catalog...');
  const { data: tables, error: tablesError } = await supabase
    .rpc('exec_sql', {
      sql: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notion_template_catalog'`
    })
    .catch(async () => {
      // Fallback si el RPC no existe - consultar directamente
      return await supabase
        .from('notion_template_catalog')
        .select('*')
        .limit(1);
    });

  // 2. Verificar contenido de la tabla
  console.log('2️⃣ Consultando plantillas en el catálogo...');
  const { data: templates, error: templatesError } = await supabase
    .from('notion_template_catalog')
    .select('template_pack_id, name, is_active, display_order')
    .order('display_order', { ascending: true });

  if (templatesError) {
    console.error('❌ Error consultando plantillas:', templatesError.message);

    if (templatesError.message.includes('relation "notion_template_catalog" does not exist')) {
      console.error('\n⚠️  La tabla notion_template_catalog NO EXISTE');
      console.error('📝 Acción requerida: Ejecuta la migración migration_8.sql\n');
      console.error('Comando:');
      console.error('  psql -U postgres -h [SUPABASE_HOST] -d postgres < migration_8.sql\n');
    }

    process.exit(1);
  }

  if (!templates || templates.length === 0) {
    console.error('❌ La tabla existe pero está VACÍA (0 plantillas)');
    console.error('\n📝 Acción requerida: Ejecuta el script de seed\n');
    console.error('Comando:');
    console.error('  npx tsx scripts/seed-template-catalog.ts\n');
    process.exit(1);
  }

  console.log(`✅ Se encontraron ${templates.length} plantillas:\n`);

  templates.forEach((t, index) => {
    const status = t.is_active ? '✓' : '✗';
    console.log(`  ${index + 1}. [${status}] ${t.name} (${t.template_pack_id})`);
  });

  console.log('\n✅ El catálogo está correctamente configurado!');

  // 3. Verificar endpoint API
  console.log('\n3️⃣ Verificando que el endpoint API funciona...');
  console.log('💡 Puedes probar manualmente:');
  console.log('   curl http://localhost:3000/api/onboarding/templates\n');
}

verify().catch(console.error);

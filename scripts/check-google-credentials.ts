/**
 * Script para verificar credenciales de Google de un usuario
 * Uso: npx tsx scripts/check-google-credentials.ts <user_id>
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkCredentials(userId: string) {
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`\n🔍 Verificando credenciales de Google para usuario: ${userId}\n`);

  // Verificar si el usuario existe
  const { data: user, error: userError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (userError) {
    console.error('❌ Usuario no encontrado:', userError.message);
    return;
  }

  console.log('✅ Usuario encontrado:', user.email || user.id);

  // Verificar credenciales de Google
  const { data: creds, error: credsError } = await supabase
    .from('user_credentials')
    .select('*')
    .eq('user_id', userId)
    .eq('service_name', 'google');

  if (credsError) {
    console.error('❌ Error consultando credenciales:', credsError.message);
    return;
  }

  if (!creds || creds.length === 0) {
    console.log('\n⚠️  NO HAY CREDENCIALES DE GOOGLE');
    console.log('\nSolución:');
    console.log('1. El usuario debe hacer logout');
    console.log('2. Volver a hacer login con Google');
    console.log('3. Aceptar todos los permisos solicitados');
    console.log('\nNota: Si acabas de actualizar el código con nuevos scopes,');
    console.log('el usuario DEBE re-autenticarse para obtener los nuevos permisos.\n');
    return;
  }

  console.log('\n✅ Credenciales encontradas:');
  creds.forEach((cred) => {
    console.log(`  - ID: ${cred.id}`);
    console.log(`  - Creado: ${new Date(cred.created_at).toLocaleString()}`);
    console.log(`  - Tiene encrypted_refresh_token: ${!!cred.encrypted_refresh_token}`);
    console.log(`  - Tiene IV: ${!!cred.iv}`);
    console.log(`  - Tiene auth_tag: ${!!cred.auth_tag}`);
    console.log();
  });

  // Verificar si las credenciales están completas
  const mainCred = creds[0];
  if (!mainCred.encrypted_refresh_token || !mainCred.iv || !mainCred.auth_tag) {
    console.log('⚠️  ADVERTENCIA: Credenciales incompletas');
    console.log('El usuario debe re-autenticarse.\n');
    return;
  }

  console.log('✅ Credenciales completas y listas para usar\n');
  console.log('Si aun así hay errores, verifica:');
  console.log('1. Que ENCRYPTION_KEY esté configurada correctamente');
  console.log('2. Que los scopes de Google estén aprobados');
  console.log('3. Que el token no haya expirado (Google invalida tokens después de 6 meses sin uso)\n');
}

// Ejecutar
const userId = process.argv[2];
if (!userId) {
  console.error('❌ Uso: npx tsx scripts/check-google-credentials.ts <user_id>');
  process.exit(1);
}

checkCredentials(userId).catch(console.error);

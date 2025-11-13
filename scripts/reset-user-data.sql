/**
 * Script para resetear completamente los datos de un usuario
 *
 * IMPORTANTE: Reemplaza 'TU_USER_ID_AQUI' con tu user_id real antes de ejecutar
 *
 * Puedes obtener tu user_id ejecutando:
 * SELECT id, email FROM auth.users WHERE email = 'tu-email@ejemplo.com';
 *
 * Este script eliminará:
 * - Credenciales de Google (fuerza re-autenticación con nuevos scopes)
 * - Estado de onboarding (vuelve a mostrar el wizard)
 * - Preferencias de usuario
 * - Conversaciones anteriores (mensajes del chat)
 * - Resúmenes diarios generados
 * - Chunks de documentos ingestionados (Notion, Gmail)
 *
 * NO eliminará:
 * - La cuenta de usuario en auth.users
 * - El perfil básico en profiles
 */

-- ============================================
-- PASO 1: Verificar que el usuario existe
-- ============================================
DO $$
DECLARE
    v_user_id UUID := 'TU_USER_ID_AQUI'; -- ⚠️ REEMPLAZAR CON TU USER_ID
    v_user_exists BOOLEAN;
BEGIN
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = v_user_id) INTO v_user_exists;

    IF NOT v_user_exists THEN
        RAISE EXCEPTION 'Usuario con ID % no existe', v_user_id;
    END IF;

    RAISE NOTICE '✓ Usuario encontrado: %', v_user_id;
END $$;

-- ============================================
-- PASO 2: Eliminar credenciales de Google
-- (Esto fuerza re-autenticación con nuevos scopes)
-- ============================================
DELETE FROM user_credentials
WHERE user_id = 'TU_USER_ID_AQUI' -- ⚠️ REEMPLAZAR
  AND service_name = 'google';

-- Verificar
SELECT
    COUNT(*) AS credenciales_restantes,
    'Si es 0, el usuario deberá re-autenticarse' AS nota
FROM user_credentials
WHERE user_id = 'TU_USER_ID_AQUI'; -- ⚠️ REEMPLAZAR

-- ============================================
-- PASO 3: Resetear onboarding
-- ============================================
UPDATE user_preferences
SET
    onboarding_completed = false,
    onboarding_step = 1,
    selected_template_pack = NULL,
    notion_database_ids = NULL,
    notion_task_statuses = NULL,
    gmail_priority_senders = NULL,
    gmail_keywords = NULL,
    updated_at = NOW()
WHERE user_id = 'TU_USER_ID_AQUI'; -- ⚠️ REEMPLAZAR

-- Verificar
SELECT
    onboarding_completed,
    onboarding_step,
    selected_template_pack,
    'Usuario debe volver a hacer onboarding' AS nota
FROM user_preferences
WHERE user_id = 'TU_USER_ID_AQUI'; -- ⚠️ REEMPLAZAR

-- ============================================
-- PASO 4: Limpiar conversaciones anteriores
-- ============================================
-- Nota: Si tienes una tabla de mensajes, agrégala aquí
-- DELETE FROM messages WHERE user_id = 'TU_USER_ID_AQUI';

-- ============================================
-- PASO 5: Eliminar resúmenes diarios
-- ============================================
DELETE FROM daily_summaries
WHERE user_id = 'TU_USER_ID_AQUI'; -- ⚠️ REEMPLAZAR

-- Verificar
SELECT
    COUNT(*) AS resumenes_eliminados,
    'Resúmenes diarios limpiados' AS nota
FROM daily_summaries
WHERE user_id = 'TU_USER_ID_AQUI'; -- ⚠️ REEMPLAZAR

-- ============================================
-- PASO 6: Eliminar chunks de documentos (RAG)
-- ============================================
DELETE FROM document_chunks
WHERE user_id = 'TU_USER_ID_AQUI'; -- ⚠️ REEMPLAZAR

-- Verificar
SELECT
    COUNT(*) AS chunks_eliminados,
    'Datos de RAG limpiados (Gmail, Notion)' AS nota
FROM document_chunks
WHERE user_id = 'TU_USER_ID_AQUI'; -- ⚠️ REEMPLAZAR

-- ============================================
-- PASO 7: Opcional - Eliminar sesiones de browser
-- ============================================
DELETE FROM browser_sessions
WHERE user_id = 'TU_USER_ID_AQUI'; -- ⚠️ REEMPLAZAR

-- ============================================
-- RESUMEN FINAL
-- ============================================
SELECT
    'RESET COMPLETADO' AS status,
    'El usuario debe:' AS accion,
    '1. Hacer logout en la aplicación' AS paso_1,
    '2. Volver a hacer login con Google' AS paso_2,
    '3. Aceptar TODOS los permisos (incluyendo Gmail, Calendar, etc.)' AS paso_3,
    '4. Completar el wizard de onboarding nuevamente' AS paso_4,
    '5. Probar las herramientas de Google Services' AS paso_5;

-- ============================================
-- VERIFICACIÓN FINAL
-- ============================================
SELECT
    'Credenciales Google' AS tipo,
    COUNT(*)::text AS cantidad
FROM user_credentials
WHERE user_id = 'TU_USER_ID_AQUI' -- ⚠️ REEMPLAZAR
  AND service_name = 'google'

UNION ALL

SELECT
    'Onboarding completado' AS tipo,
    onboarding_completed::text AS cantidad
FROM user_preferences
WHERE user_id = 'TU_USER_ID_AQUI' -- ⚠️ REEMPLAZAR

UNION ALL

SELECT
    'Resúmenes diarios' AS tipo,
    COUNT(*)::text AS cantidad
FROM daily_summaries
WHERE user_id = 'TU_USER_ID_AQUI' -- ⚠️ REEMPLAZAR

UNION ALL

SELECT
    'Chunks de documentos' AS tipo,
    COUNT(*)::text AS cantidad
FROM document_chunks
WHERE user_id = 'TU_USER_ID_AQUI'; -- ⚠️ REEMPLAZAR

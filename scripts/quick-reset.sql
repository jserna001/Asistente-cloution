/**
 * RESET RÁPIDO - Un solo comando
 *
 * Paso 1: Obtén tu user_id:
 * SELECT id FROM auth.users WHERE email = 'tu-email@ejemplo.com';
 *
 * Paso 2: Reemplaza 'TU_USER_ID_AQUI' abajo y ejecuta
 */

-- RESET COMPLETO EN UN SOLO COMANDO
DO $$
DECLARE
    v_user_id UUID := 'TU_USER_ID_AQUI'; -- ⚠️ REEMPLAZAR
BEGIN
    -- 1. Eliminar credenciales Google
    DELETE FROM user_credentials WHERE user_id = v_user_id AND service_name = 'google';
    RAISE NOTICE '✓ Credenciales Google eliminadas';

    -- 2. Resetear onboarding
    UPDATE user_preferences
    SET onboarding_completed = false,
        onboarding_step = 1,
        selected_template_pack = NULL,
        notion_database_ids = NULL,
        notion_task_statuses = NULL,
        gmail_priority_senders = NULL,
        gmail_keywords = NULL
    WHERE user_id = v_user_id;
    RAISE NOTICE '✓ Onboarding reseteado';

    -- 3. Limpiar datos
    DELETE FROM daily_summaries WHERE user_id = v_user_id;
    DELETE FROM document_chunks WHERE user_id = v_user_id;
    DELETE FROM browser_sessions WHERE user_id = v_user_id;
    RAISE NOTICE '✓ Datos históricos limpiados';

    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ RESET COMPLETADO';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Próximos pasos:';
    RAISE NOTICE '1. Logout en la app';
    RAISE NOTICE '2. Login con Google';
    RAISE NOTICE '3. Aceptar todos los permisos';
    RAISE NOTICE '4. Completar onboarding';
END $$;

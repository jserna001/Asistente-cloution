/**
 * Limpia resúmenes diarios duplicados del bucle infinito
 *
 * Este script elimina resúmenes duplicados creados el mismo día,
 * manteniendo solo el MÁS RECIENTE de cada día.
 *
 * Uso:
 * 1. Reemplaza 'TU_USER_ID_AQUI' con tu user_id
 * 2. Ejecuta en Supabase SQL Editor
 */

-- ============================================
-- PASO 1: Ver resúmenes duplicados
-- ============================================
SELECT
    DATE(created_at) AS fecha,
    COUNT(*) AS total_resumenes,
    MIN(created_at) AS primer_resumen,
    MAX(created_at) AS ultimo_resumen,
    CASE
        WHEN COUNT(*) > 1 THEN '⚠️ DUPLICADOS'
        ELSE '✓ OK'
    END AS estado
FROM daily_summaries
WHERE user_id = 'TU_USER_ID_AQUI' -- ⚠️ REEMPLAZAR
GROUP BY DATE(created_at)
ORDER BY fecha DESC;

-- ============================================
-- PASO 2: Eliminar duplicados (mantener el más reciente)
-- ============================================
-- Esta query usa una CTE para identificar los resúmenes a eliminar
WITH ranked_summaries AS (
    SELECT
        id,
        created_at,
        ROW_NUMBER() OVER (
            PARTITION BY DATE(created_at)
            ORDER BY created_at DESC
        ) AS rn
    FROM daily_summaries
    WHERE user_id = 'TU_USER_ID_AQUI' -- ⚠️ REEMPLAZAR
)
DELETE FROM daily_summaries
WHERE id IN (
    SELECT id
    FROM ranked_summaries
    WHERE rn > 1 -- Elimina todos excepto el más reciente de cada día
);

-- ============================================
-- PASO 3: Verificar resultado
-- ============================================
SELECT
    DATE(created_at) AS fecha,
    COUNT(*) AS total_resumenes,
    created_at,
    LEFT(summary_text, 100) || '...' AS preview
FROM daily_summaries
WHERE user_id = 'TU_USER_ID_AQUI' -- ⚠️ REEMPLAZAR
GROUP BY DATE(created_at), created_at, summary_text
ORDER BY created_at DESC
LIMIT 10;

-- ============================================
-- RESUMEN FINAL
-- ============================================
SELECT
    COUNT(DISTINCT DATE(created_at)) AS dias_con_resumen,
    COUNT(*) AS total_resumenes,
    MIN(created_at) AS resumen_mas_antiguo,
    MAX(created_at) AS resumen_mas_reciente,
    CASE
        WHEN COUNT(DISTINCT DATE(created_at)) = COUNT(*) THEN '✅ Sin duplicados'
        ELSE '⚠️ Aún hay duplicados'
    END AS estado
FROM daily_summaries
WHERE user_id = 'TU_USER_ID_AQUI'; -- ⚠️ REEMPLAZAR

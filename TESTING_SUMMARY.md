# 🧪 Testing del Resumen Diario Personalizado

## 🔄 Reiniciar Resúmenes para Testing

### Opción 1: Borrar el resumen de hoy (Recomendado)

Ejecuta en **Supabase SQL Editor:**

```sql
-- Borrar solo el resumen de hoy para poder regenerarlo
DELETE FROM daily_summaries
WHERE user_id = 'TU_USER_ID'
  AND DATE(created_at) = CURRENT_DATE;
```

### Opción 2: Borrar todos los resúmenes (Testing completo)

```sql
-- ⚠️ CUIDADO: Esto borra TODOS tus resúmenes
DELETE FROM daily_summaries
WHERE user_id = 'TU_USER_ID';
```

---

## ⚙️ Configurar Preferencias para Testing

### Test 1: Perfil Estudiante (Amigable, con emojis)

```sql
UPDATE user_preferences SET
  selected_template_pack = 'student',
  summary_tone = 'friendly',
  summary_length = 'balanced',
  use_emojis = true,
  group_by_category = true,
  include_action_items = true,
  daily_summary_enabled = true
WHERE user_id = 'TU_USER_ID';
```

### Test 2: Perfil Profesional (Formal, sin emojis, detallado)

```sql
UPDATE user_preferences SET
  selected_template_pack = 'professional',
  summary_tone = 'professional',
  summary_length = 'detailed',
  use_emojis = false,
  group_by_category = true,
  include_action_items = true,
  gmail_priority_senders = ARRAY['jefe@empresa.com', 'manager@startup.com'],
  gmail_keywords = ARRAY['urgente', 'deadline', 'importante'],
  daily_summary_enabled = true
WHERE user_id = 'TU_USER_ID';
```

### Test 3: Perfil Emprendedor (Motivacional, breve)

```sql
UPDATE user_preferences SET
  selected_template_pack = 'entrepreneur',
  summary_tone = 'motivational',
  summary_length = 'brief',
  use_emojis = true,
  group_by_category = true,
  include_action_items = true,
  gmail_keywords = ARRAY['cliente', 'oportunidad', 'inversión'],
  daily_summary_enabled = true
WHERE user_id = 'TU_USER_ID';
```

---

## 🚀 Generar Resumen Manual

### Método 1: Desde el navegador (con token de Supabase)

1. **Obtener tu token de Supabase:**
   - Abre DevTools (F12) en la app
   - Ve a Application → Local Storage → Busca el token de sesión
   - O ejecuta en la consola:
     ```javascript
     JSON.parse(localStorage.getItem('sb-YOUR_PROJECT-auth-token')).access_token
     ```

2. **Hacer la llamada:**
   ```bash
   # En producción
   curl -X GET https://asistente-justine.cloution.cloud/api/cron/daily-summary \
     -H "Authorization: Bearer TU_SUPABASE_ACCESS_TOKEN" \
     -v

   # En local (si tienes el server corriendo)
   curl -X GET http://localhost:3000/api/cron/daily-summary \
     -H "Authorization: Bearer TU_SUPABASE_ACCESS_TOKEN" \
     -v
   ```

### Método 2: Desde la UI del Chat

Si tienes acceso al chat, puedes ejecutar el endpoint desde ahí porque el frontend ya tiene el token:

```javascript
// Ejecuta esto en la consola del navegador (DevTools)
async function testSummary() {
  const { data: { session } } = await supabase.auth.getSession();

  const response = await fetch('/api/cron/daily-summary', {
    headers: {
      'Authorization': `Bearer ${session.access_token}`
    }
  });

  const result = await response.json();
  console.log('Resultado:', result);
  return result;
}

testSummary();
```

---

## 🔍 Verificar el Resumen Generado

### Ver el resumen en la base de datos:

```sql
SELECT
  summary_text,
  created_at,
  LENGTH(summary_text) as caracteres
FROM daily_summaries
WHERE user_id = 'TU_USER_ID'
ORDER BY created_at DESC
LIMIT 1;
```

### Verificar configuración usada (en los logs de Vercel):

Ve a **Vercel Dashboard** → Tu proyecto → Logs

Busca líneas como:
```
[CRON] [user-id] Plantilla: professional
[CRON] [user-id] Queries de Notion: ["¿Qué reuniones tengo hoy?", "¿Cuál es el estado de mis proyectos?"]
[CRON] [user-id] Config: detailed / professional / sin emojis
[CRON] [user-id] Encontrados 5 chunks relevantes en Notion
```

---

## 📊 Comparar Diferentes Configuraciones

### Script de Testing Automatizado

Ejecuta diferentes configuraciones y compara resultados:

```sql
-- 1. Configurar como Estudiante
UPDATE user_preferences SET
  selected_template_pack = 'student',
  summary_tone = 'friendly',
  use_emojis = true
WHERE user_id = 'TU_USER_ID';

-- 2. Borrar resumen de hoy
DELETE FROM daily_summaries
WHERE user_id = 'TU_USER_ID' AND DATE(created_at) = CURRENT_DATE;

-- 3. Generar resumen (hacer curl)
-- (ejecutar el curl de arriba)

-- 4. Guardar resultado
SELECT summary_text INTO TEMP TABLE resumen_estudiante
FROM daily_summaries
WHERE user_id = 'TU_USER_ID'
ORDER BY created_at DESC LIMIT 1;

-- 5. Repetir con Profesional
UPDATE user_preferences SET
  selected_template_pack = 'professional',
  summary_tone = 'professional',
  use_emojis = false
WHERE user_id = 'TU_USER_ID';

DELETE FROM daily_summaries
WHERE user_id = 'TU_USER_ID' AND DATE(created_at) = CURRENT_DATE;

-- (ejecutar curl de nuevo)

-- 6. Comparar
SELECT
  'Estudiante' as perfil,
  summary_text
FROM resumen_estudiante
UNION ALL
SELECT
  'Profesional' as perfil,
  summary_text
FROM daily_summaries
WHERE user_id = 'TU_USER_ID'
ORDER BY created_at DESC LIMIT 1;
```

---

## 🎯 Checklist de Testing

### Antes de mergear el PR:

- [ ] **Seed de plantillas ejecutado:**
  ```sql
  SELECT COUNT(*) FROM notion_template_catalog;
  -- Debe retornar: 5
  ```

- [ ] **Configuración de usuario:**
  ```sql
  SELECT
    selected_template_pack,
    summary_tone,
    summary_length,
    use_emojis
  FROM user_preferences
  WHERE user_id = 'TU_USER_ID';
  ```

- [ ] **Resumen borrado para testing:**
  ```sql
  SELECT COUNT(*) FROM daily_summaries
  WHERE user_id = 'TU_USER_ID' AND DATE(created_at) = CURRENT_DATE;
  -- Debe retornar: 0
  ```

### Ejecutar Tests:

- [ ] Test 1: Generar resumen con plantilla `student`
  - Verificar que menciona: exámenes, proyectos, entregas
  - Verificar tono amigable
  - Verificar que tiene emojis

- [ ] Test 2: Generar resumen con plantilla `professional`
  - Verificar que menciona: reuniones, proyectos laborales, deadlines
  - Verificar tono formal
  - Verificar que NO tiene emojis

- [ ] Test 3: Generar resumen con plantilla `entrepreneur`
  - Verificar que menciona: clientes, OKRs, oportunidades
  - Verificar tono motivacional
  - Verificar que tiene emojis

- [ ] Verificar logs en Vercel:
  - Confirmar que muestra `[CRON] Plantilla: XXX`
  - Confirmar que muestra queries dinámicas
  - Confirmar que muestra config correcta

### Validar Resultados:

- [ ] El resumen es relevante para el tipo de usuario
- [ ] El formato respeta la configuración (brief/balanced/detailed)
- [ ] El tono es correcto (professional/friendly/motivational)
- [ ] Los emojis aparecen/no aparecen según configuración
- [ ] Las queries de Notion son específicas de la plantilla
- [ ] Si hay `gmail_priority_senders`, priorizó esos correos

---

## 🐛 Troubleshooting

### "Error: No autorizado"
- Verifica que tu token de Supabase sea válido
- Regenera el token desde el navegador

### "Error: Resumen diario no está habilitado"
```sql
UPDATE user_preferences SET
  daily_summary_enabled = true
WHERE user_id = 'TU_USER_ID';
```

### "No se encontró plantilla XXX"
- Verifica que el seed se ejecutó:
  ```sql
  SELECT * FROM notion_template_catalog;
  ```

### El resumen se ve igual que antes
- Verifica que el deployment de Vercel se completó
- Verifica la fecha del último commit en Vercel
- Revisa los logs de Vercel para confirmar que usa el nuevo código

---

## 📈 Métricas a Validar

```sql
-- Ver configuración actual
SELECT
  selected_template_pack,
  summary_tone,
  summary_length,
  use_emojis,
  gmail_priority_senders,
  gmail_keywords
FROM user_preferences
WHERE user_id = 'TU_USER_ID';

-- Ver últimos 5 resúmenes
SELECT
  summary_text,
  created_at,
  LENGTH(summary_text) as caracteres
FROM daily_summaries
WHERE user_id = 'TU_USER_ID'
ORDER BY created_at DESC
LIMIT 5;

-- Stats de tus chunks de Notion
SELECT
  COUNT(*) as total_chunks,
  source_type
FROM document_chunks
WHERE user_id = 'TU_USER_ID'
GROUP BY source_type;
```

---

**Última actualización:** 2025-11-11
**Testing estimado:** 20-30 minutos

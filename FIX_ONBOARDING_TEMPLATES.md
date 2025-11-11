# 🔧 Solución: Plantillas de Onboarding No Aparecen

## Problema Identificado

Después de conectar Notion, no aparecen las opciones de plantillas (Estudiante, Profesional, Emprendedor, Freelancer, Básico) en el onboarding.

**Causa Raíz:** La tabla `notion_template_catalog` está vacía o no existe en tu base de datos de Supabase.

---

## ✅ Solución Paso a Paso

### Paso 1: Verificar si la Migración Está Aplicada

Ve a tu proyecto de Supabase → SQL Editor y ejecuta:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'notion_template_catalog';
```

**Si NO retorna ninguna fila:** Necesitas aplicar la migración.

#### Aplicar Migration 8:

En Supabase → SQL Editor → Copia y pega el contenido completo de `migration_8.sql` y ejecuta.

O vía CLI:
```bash
# Conéctate a tu base de datos de Supabase
psql -h [TU_SUPABASE_HOST] -U postgres -d postgres

# Ejecuta la migración
\i migration_8.sql
```

---

### Paso 2: Poblar el Catálogo de Plantillas

Una vez que la tabla existe, necesitas insertar las 5 plantillas. Ejecuta:

```bash
npx tsx scripts/seed-template-catalog.ts
```

**Salida esperada:**
```
🌱 Iniciando seed del catálogo de plantillas...
Procesando: 📚 Estudiante...
  ✅ Insertado/actualizado exitosamente
Procesando: 💼 Profesional...
  ✅ Insertado/actualizado exitosamente
...
🎉 Seed completado!
📋 Plantillas en el catálogo:
  - 📚 Estudiante (student) ✓
  - 💼 Profesional (professional) ✓
  - 🚀 Emprendedor (entrepreneur) ✓
  - 🎨 Freelancer (freelancer) ✓
  - 🌱 Básico (basic) ✓
```

---

### Paso 3: Verificar que Funcionó

#### Opción A: Vía SQL (Supabase)

```sql
SELECT template_pack_id, name, is_active
FROM notion_template_catalog
ORDER BY display_order;
```

Deberías ver 5 filas con las plantillas.

#### Opción B: Vía API (localhost o producción)

```bash
# Si estás en desarrollo local:
curl http://localhost:3000/api/onboarding/templates

# Si estás en producción:
curl https://asistente-justine.cloution.cloud/api/onboarding/templates
```

**Respuesta esperada:**
```json
{
  "success": true,
  "templates": [
    {
      "id": "uuid-aquí",
      "template_pack_id": "student",
      "name": "📚 Estudiante",
      "description": "Organiza tus clases...",
      "icon": "📚",
      "target_audience": ["Estudiantes", "Cursos online", "Universitarios"],
      "hasStructure": true,
      "display_order": 1
    },
    ...
  ]
}
```

---

### Paso 4: Probar el Onboarding

1. **Resetea tu onboarding** (solo para testing):
   ```sql
   UPDATE user_preferences
   SET onboarding_completed = false
   WHERE user_id = 'TU_USER_ID';
   ```

2. **Recarga la aplicación:** Ve a `/` (home page)

3. **Deberías ver el OnboardingWizard** con las 5 plantillas listadas

---

## 🐛 Troubleshooting

### Error: "Cannot find module @supabase/supabase-js"

Si al ejecutar el seed obtienes este error, primero instala las dependencias:

```bash
npm install
```

Luego vuelve a ejecutar:
```bash
npx tsx scripts/seed-template-catalog.ts
```

---

### Las Plantillas Siguen Sin Aparecer

1. **Verifica variables de entorno:**
   ```bash
   # Asegúrate de que existen en .env.local:
   NEXT_PUBLIC_SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```

2. **Verifica RLS (Row Level Security):**
   ```sql
   -- La tabla debe permitir lectura pública de plantillas activas
   SELECT * FROM pg_policies
   WHERE tablename = 'notion_template_catalog';
   ```

   Deberías ver una policy: `"Anyone can view active templates"`

3. **Revisa los logs del navegador:**
   - Abre DevTools → Console
   - Busca errores en la llamada a `/api/onboarding/templates`

4. **Verifica los logs del servidor:**
   ```bash
   npm run dev
   # Busca:
   # [API-TEMPLATES] Obteniendo catálogo de plantillas...
   # [API-TEMPLATES] ✓ Encontradas X plantillas activas
   ```

---

## 📊 Verificación Final

Después de aplicar los pasos, verifica que todo funciona:

```sql
-- 1. Tabla existe y tiene 5 plantillas
SELECT COUNT(*) as total_templates
FROM notion_template_catalog
WHERE is_active = true;
-- Debe retornar: total_templates = 5

-- 2. RLS está habilitado correctamente
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename = 'notion_template_catalog';
-- Debe retornar al menos 1 policy

-- 3. Estado de onboarding de usuarios
SELECT * FROM user_onboarding_status;
```

---

## 🎯 Resultado Esperado

Una vez completados los pasos:

1. ✅ La tabla `notion_template_catalog` existe con 5 plantillas
2. ✅ El endpoint `/api/onboarding/templates` retorna las 5 plantillas
3. ✅ Al conectar Notion, el OnboardingWizard muestra las 5 opciones
4. ✅ El usuario puede seleccionar una plantilla e instalarla

---

## 📞 Soporte

Si el problema persiste después de seguir todos los pasos:

1. Comparte los logs del navegador (DevTools → Console)
2. Comparte los logs del servidor (terminal donde ejecutas `npm run dev`)
3. Comparte el resultado de esta query:
   ```sql
   SELECT * FROM notion_template_catalog;
   ```

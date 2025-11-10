# 🚀 Sistema de Onboarding con Plantillas Predeterminadas

## 📋 Tabla de Contenidos

- [Descripción General](#descripción-general)
- [Características](#características)
- [Arquitectura](#arquitectura)
- [Instalación y Deployment](#instalación-y-deployment)
- [Uso](#uso)
- [Personalización](#personalización)
- [Troubleshooting](#troubleshooting)

---

## 📖 Descripción General

Este sistema implementa un **onboarding interactivo** que guía a nuevos usuarios a través de un proceso de 4 pasos para:

1. **Seleccionar una plantilla** predeterminada según su perfil (Estudiante, Profesional, Emprendedor, Freelancer, Básico)
2. **Ver preview detallado** de la plantilla con características y beneficios
3. **Instalar automáticamente** la plantilla en su workspace de Notion (databases, páginas y vistas)
4. **Configurar preferencias** de resumen diario personalizadas

### 🎯 Problema que Resuelve

**Pain Point Crítico:** Muchos usuarios no saben usar Notion o no tienen tiempo para configurar un sistema organizacional desde cero. Esto genera:
- Baja adopción del sistema
- Frustración al no ver valor inmediato
- Abandono antes de completar la configuración

**Solución:** Plantillas predeterminadas instaladas en **30 segundos** que proporcionan valor inmediato y guían al usuario sobre cómo usar el sistema.

---

## ✨ Características

### 1. **Catálogo de 5 Plantillas Predeterminadas**

| Plantilla | Audiencia | Databases Incluidas | Beneficio Clave |
|-----------|-----------|---------------------|-----------------|
| 📚 **Estudiante** | Estudiantes, cursos online | Tasks, Apuntes, Recursos | Nunca olvides una entrega |
| 💼 **Profesional** | Empleados, PMs | Tasks & Projects, Meetings | Gestiona múltiples proyectos |
| 🚀 **Emprendedor** | Fundadores, startups | OKRs, CRM, Finanzas | Mantén foco en objetivos |
| 🎨 **Freelancer** | Freelancers, consultores | Proyectos, Clientes, Facturas | Control de deadlines y cobros |
| 🌱 **Básico** | Todos, principiantes | Tasks, Notas | Empieza rápido sin complicaciones |

### 2. **Instalación Automática**

- Clonación de databases completas con propiedades y vistas
- Creación de páginas con contenido inicial
- Progress tracking en tiempo real (0-100%)
- Manejo de errores con reintentos

### 3. **Personalización Post-Instalación**

- **Queries RAG predeterminadas** optimizadas por perfil
- **Preferencias de resumen** sugeridas (longitud, tono, formato)
- **Database IDs** automáticamente vinculadas al sistema de resumen diario

### 4. **UX Mejorada**

- **Wizard de 4 pasos** con animaciones GSAP
- **Preview visual** de plantillas antes de instalar
- **Progress indicator** durante instalación
- **Success screen** con next steps claros
- **Skip option** para usuarios avanzados

---

## 🏗️ Arquitectura

### Stack Tecnológico

```
Frontend: Next.js 16 + React 19 + TypeScript
Backend: Supabase PostgreSQL + Row Level Security
AI: Google Gemini API (Flash/Pro) + Anthropic Claude (Sonnet)
Integrations: Notion MCP (15 native tools)
Animations: GSAP
Styling: CSS Modules + CSS Variables
```

### Flujo de Datos

```
┌─────────────────────────────────────────────────────────┐
│ 1. Usuario nuevo login → Verificar onboarding          │
│    ↓                                                    │
│    user_preferences.onboarding_completed = false       │
│    ↓                                                    │
│ 2. Mostrar OnboardingWizard                            │
│    ↓                                                    │
│ 3. Usuario selecciona plantilla                        │
│    ↓                                                    │
│    GET /api/onboarding/templates                       │
│    ← [student, professional, entrepreneur, ...]        │
│    ↓                                                    │
│ 4. Usuario confirma instalación                        │
│    ↓                                                    │
│    POST /api/onboarding/install-template               │
│    body: { templatePackId: "professional" }            │
│    ↓                                                    │
│ 5. Backend ejecuta clonación                           │
│    ↓                                                    │
│    notionTemplateService.installNotionTemplate()       │
│    ├─ Crear página padre en Notion                     │
│    ├─ Crear databases con propiedades                  │
│    ├─ Crear vistas (Kanban, Calendar, etc.)            │
│    └─ Guardar IDs en user_notion_templates             │
│    ↓                                                    │
│ 6. Actualizar user_preferences                         │
│    ├─ onboarding_completed = true                      │
│    ├─ selected_template_pack = "professional"          │
│    └─ notion_database_ids = [db_id_1, db_id_2, ...]   │
│    ↓                                                    │
│ 7. Redirigir al chat → Sistema listo                   │
└─────────────────────────────────────────────────────────┘
```

### Estructura de Archivos

```
├── migration_8.sql                              # Schema de DB
├── lib/
│   └── services/
│       └── notionTemplateService.ts             # Lógica de clonación
├── app/
│   ├── api/
│   │   └── onboarding/
│   │       ├── templates/route.ts               # GET catálogo
│   │       └── install-template/route.ts        # POST instalar
│   └── page.tsx                                 # Integración con chat
├── components/
│   └── onboarding/
│       ├── OnboardingWizard.tsx                 # Componente principal
│       └── OnboardingWizard.css                 # Estilos
└── scripts/
    └── seed-template-catalog.ts                 # Poblar catálogo
```

---

## 🚀 Instalación y Deployment

### Prerrequisitos

- [x] Node.js 18+
- [x] Supabase project creado
- [x] Notion OAuth configurado
- [x] Google Gemini API key
- [x] Anthropic API key

### Paso 1: Migración de Base de Datos

```bash
# Conectar a tu proyecto de Supabase
psql -U postgres -h [YOUR_SUPABASE_HOST] -d postgres

# Ejecutar migration_8.sql
\i migration_8.sql

# Verificar tablas creadas
\dt

# Deberías ver:
# - notion_template_catalog
# - user_notion_templates
# - user_context
# - summary_feedback
# + extensiones a user_preferences
```

**Verificación:**
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '%template%';
```

### Paso 2: Seedear Catálogo de Plantillas

```bash
# Asegúrate de tener las variables de entorno configuradas
# en .env.local:
# NEXT_PUBLIC_SUPABASE_URL=...
# SUPABASE_SERVICE_ROLE_KEY=...

# Ejecutar script de seed
npx tsx scripts/seed-template-catalog.ts

# Output esperado:
# 🌱 Iniciando seed del catálogo de plantillas...
# Procesando: 📚 Estudiante...
#   ✅ Insertado/actualizado exitosamente
# Procesando: 💼 Profesional...
#   ✅ Insertado/actualizado exitosamente
# ...
# 🎉 Seed completado!
# 📋 Plantillas en el catálogo:
#   - 📚 Estudiante (student) ✓
#   - 💼 Profesional (professional) ✓
#   - 🚀 Emprendedor (entrepreneur) ✓
#   - 🎨 Freelancer (freelancer) ✓
#   - 🌱 Básico (basic) ✓
```

**Verificación en Supabase:**
```sql
SELECT template_pack_id, name, is_active
FROM notion_template_catalog
ORDER BY display_order;
```

### Paso 3: Desplegar Aplicación

```bash
# Instalar dependencias
npm install

# Build
npm run build

# Deploy a Vercel (recomendado)
vercel --prod

# O deployment manual:
npm run start
```

### Paso 4: Verificar Integración

1. **Login con usuario nuevo** (que no tenga preferencias aún)
2. **Verificar que aparece OnboardingWizard** automáticamente
3. **Seleccionar una plantilla** y hacer clic en "Instalar"
4. **Esperar progreso** (20-30 segundos)
5. **Verificar en Notion** que se crearon los elementos
6. **Confirmar redirección** al chat

---

## 🎮 Uso

### Para Usuarios

#### Primera Vez

1. Inicia sesión con Google
2. Conecta tu cuenta de Notion (Settings > Conexiones)
3. El onboarding aparece automáticamente
4. Selecciona tu perfil (ej: "Profesional")
5. Revisa el preview de la plantilla
6. Haz clic en "Instalar plantilla"
7. Espera ~30 segundos
8. ¡Listo! Abre tu Notion y verás tu nuevo workspace

#### Después del Onboarding

- El sistema **nunca volverá a mostrar** el onboarding
- Todas las preferencias están guardadas en `user_preferences`
- Puedes ajustar configuraciones en **Settings > Preferencias**

### Para Administradores

#### Añadir Nueva Plantilla

1. **Editar `seed-template-catalog.ts`:**

```typescript
{
  template_pack_id: 'mi_nueva_plantilla',
  name: '🎓 Mi Template',
  description: 'Descripción breve',
  icon: '🎓',
  target_audience: ['Audience 1', 'Audience 2'],
  display_order: 6,
  template_structure: {
    databases: [
      {
        name: 'Mi Database',
        icon: '📊',
        properties: {
          Name: { title: {} },
          Status: {
            select: {
              options: [
                { name: 'Active', color: 'green' }
              ]
            }
          }
        }
      }
    ],
    pages: []
  },
  default_rag_queries: {
    notion: ['Query 1', 'Query 2']
  },
  suggested_preferences: {
    summary_length: 'balanced',
    summary_tone: 'friendly'
  }
}
```

2. **Re-seedear:**
```bash
npx tsx scripts/seed-template-catalog.ts
```

3. **Actualizar `OnboardingWizard.tsx`** con detalles de la nueva plantilla en `TEMPLATE_DETAILS`

#### Monitorear Instalaciones

```sql
-- Ver estado de instalaciones por usuario
SELECT
  u.email,
  unt.template_pack_id,
  unt.installation_status,
  unt.installation_progress,
  unt.installation_completed_at
FROM user_notion_templates unt
JOIN auth.users u ON u.id = unt.user_id
ORDER BY unt.created_at DESC;

-- Ver plantillas más instaladas
SELECT
  template_pack_id,
  COUNT(*) as installations,
  COUNT(CASE WHEN installation_status = 'completed' THEN 1 END) as successful,
  COUNT(CASE WHEN installation_status = 'failed' THEN 1 END) as failed
FROM user_notion_templates
GROUP BY template_pack_id;
```

---

## 🎨 Personalización

### Modificar Estilos

Los estilos están en `components/onboarding/OnboardingWizard.css` y usan CSS Variables del sistema de diseño principal.

**Variables clave:**
```css
--accent-blue: #0EA5E9
--accent-purple: #8B5CF6
--bg-primary, --bg-secondary, --bg-tertiary
--text-primary, --text-secondary
--border-primary
--radius-md, --radius-lg
--space-*
```

### Modificar Animaciones

Las animaciones usan GSAP. Puedes ajustar en:

```css
/* Duración de animaciones */
animation: fadeIn 0.3s ease-out;

/* Timings en GSAP (OnboardingWizard.tsx) */
gsap.from(element, {
  duration: 0.5,
  ease: 'back.out(1.2)'
});
```

### Cambiar Textos

Todos los textos están hardcoded en español. Para i18n:

1. Crear archivo `locales/es.json` y `locales/en.json`
2. Usar `next-i18next` o `next-intl`
3. Reemplazar strings con `t('key')`

---

## 🐛 Troubleshooting

### Error: "Plantilla no encontrada"

**Causa:** El catálogo no está seeded.

**Solución:**
```bash
npx tsx scripts/seed-template-catalog.ts
```

### Error: "Credenciales de Notion no encontradas"

**Causa:** El usuario no ha conectado su cuenta de Notion.

**Solución:**
1. Verificar en Supabase: `SELECT * FROM user_credentials WHERE service_name = 'notion'`
2. Si no hay registro, el usuario debe ir a Settings > Conexiones > Conectar Notion

### Error: "Failed to connect to Notion MCP"

**Causa:** El wrapper de MCP no está respondiendo o el token de Notion expiró.

**Solución:**
1. Verificar que `NOTION_MCP_WRAPPER_URL` está configurado en `.env.local`
2. Probar el wrapper manualmente:
```bash
curl -X POST http://localhost:3002/mcp \
  -H "Authorization: Bearer YOUR_NOTION_TOKEN"
```
3. Si falla, reconectar Notion en Settings

### Progreso se queda en 90%

**Causa:** Una database o página falló al crearse, pero el proceso continuó.

**Solución:**
1. Verificar logs del servidor: `vercel logs` o logs locales
2. Verificar en Supabase:
```sql
SELECT installation_error
FROM user_notion_templates
WHERE installation_status = 'failed';
```
3. Permitir retry: El sistema ya tiene lógica de continue-on-error

### Onboarding no aparece para nuevo usuario

**Causa:** La tabla `user_preferences` ya tiene un registro con `onboarding_completed = true`.

**Solución:**
```sql
-- Verificar estado
SELECT onboarding_completed
FROM user_preferences
WHERE user_id = 'USER_ID';

-- Resetear si es necesario
UPDATE user_preferences
SET onboarding_completed = false
WHERE user_id = 'USER_ID';
```

---

## 📊 Métricas y Analytics

### Tracking de Conversión

```sql
-- Tasa de completación de onboarding
SELECT
  COUNT(DISTINCT CASE WHEN onboarding_completed THEN user_id END)::float /
  NULLIF(COUNT(DISTINCT user_id), 0) * 100 AS completion_rate
FROM user_preferences;

-- Tiempo promedio de instalación
SELECT
  template_pack_id,
  AVG(EXTRACT(EPOCH FROM (installation_completed_at - installation_started_at))) AS avg_seconds
FROM user_notion_templates
WHERE installation_status = 'completed'
GROUP BY template_pack_id;
```

### Plantilla Más Popular

```sql
SELECT
  ntc.name,
  COUNT(*) as installations
FROM user_notion_templates unt
JOIN notion_template_catalog ntc ON ntc.template_pack_id = unt.template_pack_id
WHERE unt.installation_status = 'completed'
GROUP BY ntc.name
ORDER BY installations DESC;
```

---

## 🔐 Seguridad

### Row Level Security (RLS)

Todas las tablas tienen RLS habilitado:

```sql
-- Solo el usuario puede ver sus propias plantillas instaladas
CREATE POLICY "Users can view own template installations"
ON user_notion_templates
FOR SELECT
USING (auth.uid() = user_id);
```

### Validaciones

- ✅ Token de autorización requerido en todos los endpoints
- ✅ User ID verificado contra Supabase auth
- ✅ Service Role Key usado para bypasear RLS solo después de autenticación
- ✅ Notion token cifrado con AES-256-GCM

---

## 📚 Referencias

- [Notion API Documentation](https://developers.notion.com/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Supabase Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [GSAP Animations](https://greensock.com/docs/)

---

## 🤝 Contribuir

Para mejorar el sistema de plantillas:

1. Fork el repositorio
2. Crear branch: `git checkout -b feature/nueva-plantilla`
3. Implementar cambios
4. Probar localmente
5. Commit: `git commit -am 'Add: Template para Profesores'`
6. Push: `git push origin feature/nueva-plantilla`
7. Crear Pull Request

---

## 📝 Changelog

### v1.0.0 (2025-11-10)

- ✨ Implementación inicial del sistema de onboarding
- 📦 5 plantillas predeterminadas
- 🎨 Wizard interactivo con 4 pasos
- 🤖 Integración con MCP Notion (15 tools)
- 📊 Sistema de tracking y analytics
- 🔐 Row Level Security
- 📱 Responsive design
- ⚡ Animaciones GSAP

---

**Desarrollado con ❤️ para mejorar la adopción y UX del asistente IA**

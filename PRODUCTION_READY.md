# Aplicación Lista para Producción

## ✅ Resumen

Tu aplicación **Asistente IA** está lista para ser desplegada a producción con la siguiente arquitectura:

```
┌─────────────────────┐         ┌─────────────────────┐
│  Vercel             │         │  Supabase           │
│  (Frontend + API)   │────────▶│  (Base de Datos)    │
│  *.vercel.app       │         │  PostgreSQL + Auth  │
└──────────┬──────────┘         └─────────────────────┘
           │
           │ HTTP
           ▼
┌─────────────────────┐
│  Dokku/Railway      │
│  (Browser Service)  │
│  Playwright + Docker│
└─────────────────────┘
```

## 📁 Archivos de Configuración Creados

### 1. `vercel.json`
Configuración de Vercel con:
- Cron job para resúmenes diarios (cada hora)
- Framework: Next.js
- Región: iad1 (US East)

### 2. `.vercelignore`
Excluye de producción:
- Scripts de utilidad
- Migraciones SQL
- Archivos de desarrollo
- Configuración de Dokku

### 3. `tsconfig.json` (actualizado)
- Excluye carpeta `scripts/` del build
- Evita errores de TypeScript en scripts de mantenimiento

### 4. `DEPLOYMENT.md`
Guía completa paso a paso para:
- Deployment del Browser Service
- Deployment en Vercel
- Configuración de variables de entorno
- Configuración de OAuth callbacks
- Troubleshooting

### 5. `BROWSER_SERVICE_DEPLOYMENT.md`
Guía especializada para el microservicio de browser automation:
- Opciones de deployment (Dokku, Railway, Render)
- Configuración de seguridad
- Monitoreo y mantenimiento

## 🚀 Orden de Deployment

### Paso 1: Browser Service PRIMERO
```bash
# Opción A: Dokku (recomendado si ya tienes el servidor)
ssh root@192.168.80.17
dokku apps:create browser-service
dokku proxy:ports-add browser-service http:80:3001

cd browser-service
git init
git add .
git commit -m "Deploy browser service"
git remote add dokku-browser dokku@192.168.80.17:browser-service
git push dokku-browser master

# Resultado: http://192.168.80.17:3001
```

### Paso 2: Aplicación Principal en Vercel

1. **Preparar el repositorio:**
   ```bash
   git add .
   git commit -m "Preparar para producción"
   git push origin master
   ```

2. **Crear proyecto en Vercel:**
   - Ve a [vercel.com/dashboard](https://vercel.com/dashboard)
   - Import Git Repository
   - Selecciona tu repositorio

3. **Configurar variables de entorno** (NO hacer deploy todavía):

   **Críticas:**
   ```
   BROWSER_SERVICE_URL=http://192.168.80.17:3001
   ENCRYPTION_KEY=4/Ww28ypEwNJ5EWjxDux9HgqPqDbYg9NTLnuv1C4Imc=
   CRON_SECRET=WPpkXpr8mxvd8znAULOfuTHlQneg2LvkD8XwYRUu/C8=
   ```

   **Supabase:**
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://wkcqdrnqdfafxdxarpgs.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   SUPABASE_SERVICE_ROLE_KEY=[obtener de Supabase Dashboard]
   ```

   **OAuth (temporalmente con localhost):**
   ```
   GOOGLE_CLIENT_ID=tu-google-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=tu-google-client-secret
   GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

   NOTION_CLIENT_ID=tu-notion-client-id
   NOTION_CLIENT_SECRET=tu-notion-client-secret
   NOTION_INTERNAL_INTEGRATION_TOKEN=tu-notion-internal-integration-token
   ```

   **AI:**
   ```
   GEMINI_API_KEY=tu-gemini-api-key
   ```

4. **Deploy:**
   - Clic en "Deploy"
   - Esperar 2-5 minutos
   - Obtener URL: `https://[tu-proyecto].vercel.app`

### Paso 3: Actualizar OAuth Callbacks

Una vez tengas tu URL de Vercel:

**Google Cloud Console:**
1. [console.cloud.google.com](https://console.cloud.google.com)
2. APIs & Services → Credentials
3. OAuth 2.0 Client ID
4. Agregar a "Authorized redirect URIs":
   ```
   https://[tu-proyecto].vercel.app/api/auth/google/callback
   ```

**Notion:**
1. [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Selecciona tu integración
3. Agregar a "Redirect URIs":
   ```
   https://[tu-proyecto].vercel.app/api/auth/notion/callback
   ```

**Actualizar en Vercel:**
1. Settings → Environment Variables
2. Editar `GOOGLE_REDIRECT_URI`:
   ```
   https://[tu-proyecto].vercel.app/api/auth/google/callback
   ```
3. Redeploy

## 🔍 Verificación Post-Deployment

### Checklist

- [ ] Browser Service está corriendo: `docker ps | grep browser-service`
- [ ] Aplicación carga en Vercel: `https://[tu-proyecto].vercel.app`
- [ ] Login con Google funciona
- [ ] Integración con Notion funciona
- [ ] Chat responde (prueba: "Hola, ¿cómo estás?")
- [ ] Cron jobs configurados en Vercel Dashboard
- [ ] Variables de entorno actualizadas con URLs de producción
- [ ] OAuth callbacks actualizados

### Probar Funcionalidades

1. **Autenticación:**
   - Login con Google
   - Autorizar Gmail y Calendar
   - Conectar Notion

2. **Chat:**
   - Enviar mensaje básico
   - Probar búsqueda en documentos (RAG)
   - Probar automatización web (si tienes browser service corriendo)

3. **Resúmenes Diarios:**
   - Ir a Settings
   - Configurar hora y timezone
   - Verificar que se guarde en Supabase

## 📊 Base de Datos (Supabase)

### Migraciones Pendientes

Asegúrate de ejecutar todas las migraciones en Supabase SQL Editor:

```sql
-- Verificar tablas existentes
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public';
```

Deberías tener:
- `user_credentials`
- `document_chunks`
- `sync_status`
- `conversations`
- `browser_sessions`
- `user_preferences` (para resúmenes diarios)

Si falta alguna, ejecuta las migraciones correspondientes:
- `migration.sql` - Tablas iniciales
- `migration_2.sql` - ...
- `migration_3.sql` - ...
- `migration_4.sql` - Browser sessions
- `migration_5.sql` - Conversations
- `migration_6.sql` - User preferences

## 🔐 Seguridad

### Claves Sensibles

Si este código está en un repositorio público:

1. **Regenerar todas las claves:**
   ```bash
   # Nueva encryption key
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

   # Nueva cron secret
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

2. **Obtener nueva Service Role Key** de Supabase Dashboard

3. **Rotar OAuth secrets** en Google Cloud Console y Notion

### Variables de Entorno

NUNCA commitear archivos `.env` al repositorio. El `.gitignore` ya está configurado para ignorarlos.

## 🎉 Próximos Pasos

### Opcional: Dominio Personalizado

Si tienes un dominio en Cloudflare:

1. **En Vercel:**
   - Settings → Domains
   - Add Domain: `asistente.tudominio.com`
   - Copiar registros DNS

2. **En Cloudflare:**
   - DNS → Add Record
   - Type: CNAME
   - Name: asistente
   - Target: [valor de Vercel]
   - Proxy: Enabled

3. **Actualizar OAuth callbacks** con el nuevo dominio

### Monitoreo

- **Vercel Analytics**: Settings → Analytics (gratis)
- **Vercel Logs**: Dashboard → Logs
- **Supabase Logs**: Dashboard → Logs
- **Browser Service**: `docker logs browser-service -f`

### Optimizaciones Futuras

1. **Caching**: Implementar caching de embeddings
2. **Rate Limiting**: Proteger endpoints de API
3. **Error Tracking**: Sentry o similar
4. **Database Indexes**: Optimizar queries de Supabase
5. **CDN**: Cloudflare para assets estáticos

## 📚 Documentación

- [DEPLOYMENT.md](DEPLOYMENT.md) - Guía detallada de deployment
- [BROWSER_SERVICE_DEPLOYMENT.md](BROWSER_SERVICE_DEPLOYMENT.md) - Deployment del microservicio
- [Vercel Docs](https://vercel.com/docs)
- [Supabase Docs](https://supabase.com/docs)

## 🆘 Soporte

Si encuentras problemas:

1. **Revisa los logs:**
   - Vercel: Dashboard → Logs
   - Supabase: Dashboard → Logs
   - Browser Service: `docker logs browser-service`

2. **Verifica las variables:**
   - Vercel: Settings → Environment Variables
   - Todas deben estar configuradas para "Production"

3. **OAuth errors:**
   - Verifica redirect URIs en Google/Notion
   - Verifica `GOOGLE_REDIRECT_URI` en Vercel

---

**Estado**: ✅ Aplicación lista para deployment
**Última actualización**: 2025-11-06

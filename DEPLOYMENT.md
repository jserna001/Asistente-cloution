# Guía de Deployment a Producción - Vercel

## 📋 Tabla de Contenidos
1. [Arquitectura](#arquitectura)
2. [Pre-requisitos](#pre-requisitos)
3. [Deployment del Browser Service](#deployment-del-browser-service)
4. [Deployment en Vercel](#deployment-en-vercel)
5. [Configurar Variables de Entorno](#configurar-variables-de-entorno)
6. [Post-Deployment](#post-deployment)
7. [Configurar OAuth Callbacks](#configurar-oauth-callbacks)
8. [Verificación Final](#verificación-final)

---

## 🏗️ Arquitectura

Esta aplicación tiene una arquitectura híbrida:

```
┌─────────────────────┐         ┌─────────────────────┐
│  Vercel             │         │  Supabase           │
│  (Serverless)       │────────▶│  (PostgreSQL)       │
│  - Next.js Frontend │         │  - User Data        │
│  - API Routes       │         │  - Embeddings       │
└──────────┬──────────┘         └─────────────────────┘
           │
           │ HTTP
           ▼
┌─────────────────────┐
│  Browser Service    │
│  (Docker)           │
│  - Playwright       │
│  - Fastify Server   │
└─────────────────────┘
```

**Importante**: El Browser Service **NO** puede correr en Vercel. Debe desplegarse en un servidor separado con Docker (Dokku, Railway, Render, etc.).

---

## 🔧 Pre-requisitos

Antes de comenzar, asegúrate de tener:

- [ ] Cuenta en [Vercel](https://vercel.com) (puedes usar GitHub para login)
- [ ] Repositorio Git (GitHub, GitLab o Bitbucket)
- [ ] Base de datos Supabase configurada y migraciones aplicadas
- [ ] Credenciales de Google OAuth (Client ID y Secret)
- [ ] Credenciales de Notion OAuth (Client ID y Secret)
- [ ] API Key de Gemini
- [ ] Encryption Key generada
- [ ] Servidor con Docker para el Browser Service (Dokku, Railway, o similar)

---

## 🤖 Deployment del Browser Service

**PASO CRÍTICO**: Antes de desplegar en Vercel, debes desplegar el Browser Service.

El Browser Service es un microservicio separado que proporciona capacidades de automatización web con Playwright. Este componente **DEBE** desplegarse primero porque la aplicación principal lo necesita.

### Guía Completa

Consulta [BROWSER_SERVICE_DEPLOYMENT.md](BROWSER_SERVICE_DEPLOYMENT.md) para instrucciones detalladas.

### Quick Start (usando tu servidor Dokku)

```bash
# 1. Conectar a tu servidor
ssh root@192.168.80.17

# 2. Crear app en Dokku
dokku apps:create browser-service
dokku proxy:ports-add browser-service http:80:3001

# 3. En tu máquina local
cd browser-service
git init
git add .
git commit -m "Deploy browser service"
git remote add dokku-browser dokku@192.168.80.17:browser-service
git push dokku-browser master

# 4. Verificar
ssh root@192.168.80.17
docker ps | grep browser-service
```

Tu Browser Service estará disponible en: `http://192.168.80.17:3001`

**Anota esta URL**, la necesitarás para configurar `BROWSER_SERVICE_URL` en Vercel.

---

## 🚀 Deployment en Vercel

### Paso 1: Preparar el Repositorio

1. Asegúrate de que todos los cambios estén commiteados:
   ```bash
   git add .
   git commit -m "Preparar aplicación para deployment en Vercel"
   git push origin master
   ```

### Paso 2: Importar Proyecto en Vercel

1. Ve a [Vercel Dashboard](https://vercel.com/dashboard)
2. Haz clic en "Add New..." → "Project"
3. Selecciona tu repositorio Git
4. Vercel detectará automáticamente que es un proyecto Next.js

### Paso 3: Configurar el Proyecto

En la página de configuración:

- **Framework Preset**: Next.js (detectado automáticamente)
- **Root Directory**: `./` (raíz del proyecto)
- **Build Command**: `npm run build` (ya está en vercel.json)
- **Output Directory**: `.next` (automático)
- **Install Command**: `npm install`

**¡NO HAGAS CLIC EN DEPLOY TODAVÍA!** Primero necesitas configurar las variables de entorno.

---

## 🔐 Configurar Variables de Entorno

### Variables Requeridas

En el panel de Vercel, en la sección "Environment Variables", agrega las siguientes:

#### 1. Encryption & Security

```
ENCRYPTION_KEY=4/Ww28ypEwNJ5EWjxDux9HgqPqDbYg9NTLnuv1C4Imc=
CRON_SECRET=WPpkXpr8mxvd8znAULOfuTHlQneg2LvkD8XwYRUu/C8=
```

> ⚠️ **IMPORTANTE**: Si vas a generar nuevas claves, usa:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
> ```

#### 2. Supabase

```
NEXT_PUBLIC_SUPABASE_URL=https://wkcqdrnqdfafxdxarpgs.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrY3Fkcm5xZGZhZnhkeGFycGdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxNTEyODEsImV4cCI6MjA3NzcyNzI4MX0.RA9gXObfKc19zA3mew81_i21SX2jqe5-ih8lV91EbYQ
SUPABASE_SERVICE_ROLE_KEY=[Tu Service Role Key de Supabase]
```

> 📝 **Nota**: El Service Role Key lo encuentras en Supabase Dashboard → Settings → API

#### 3. Google OAuth

**TEMPORALMENTE** (actualizaremos después del primer deployment):

```
GOOGLE_CLIENT_ID=tu-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

> ⚠️ **CAMBIARÁS ESTO DESPUÉS**: Una vez deployed, actualizaremos esta URL con tu dominio de Vercel.

#### 4. Notion OAuth

**TEMPORALMENTE**:

```
NOTION_CLIENT_ID=tu-notion-client-id
NOTION_CLIENT_SECRET=tu-notion-client-secret
NOTION_INTERNAL_INTEGRATION_TOKEN=tu-notion-internal-integration-token
```

#### 5. Gemini AI

```
GEMINI_API_KEY=tu-gemini-api-key
```

#### 6. Browser Service

```
BROWSER_SERVICE_URL=http://192.168.80.17:3001
```

> 📝 **Importante**: Usa la URL donde desplegaste el Browser Service en el paso anterior.
> - Si usaste Dokku: `http://192.168.80.17:3001`
> - Si usaste Railway: `https://tu-app.railway.app`
> - Si usaste Render: `https://tu-app.onrender.com`

### Configurar en Vercel

Para cada variable:

1. Haz clic en "Add new"
2. Nombre: `NOMBRE_VARIABLE`
3. Value: `valor_de_la_variable`
4. Environments: Marca "Production", "Preview" y "Development"
5. Haz clic en "Add"

---

## 📦 Realizar el Deployment

Una vez configuradas TODAS las variables de entorno:

1. Haz clic en **"Deploy"**
2. Vercel comenzará a construir tu aplicación (toma ~2-5 minutos)
3. Una vez completado, recibirás una URL como: `https://tu-proyecto.vercel.app`

---

## 🔄 Post-Deployment

### Paso 1: Obtener tu URL de Producción

Después del deployment, tu aplicación estará disponible en:
```
https://[nombre-proyecto].vercel.app
```

Anota esta URL, la necesitarás para los siguientes pasos.

### Paso 2: Verificar las Migraciones de Base de Datos

Asegúrate de que todas las migraciones estén aplicadas en Supabase:

1. Ve a [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecciona tu proyecto
3. Ve a "SQL Editor"
4. Verifica que existan las siguientes tablas:
   - `user_credentials`
   - `document_chunks`
   - `sync_status`
   - `conversations`
   - `user_preferences` (importante para el resumen diario)

Si falta alguna tabla, ejecuta las migraciones correspondientes (`migration.sql`, etc.)

---

## 🔑 Configurar OAuth Callbacks

### Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com)
2. Selecciona tu proyecto
3. Ve a "APIs & Services" → "Credentials"
4. Haz clic en tu OAuth 2.0 Client ID
5. En "Authorized redirect URIs", agrega:
   ```
   https://[tu-proyecto].vercel.app/api/auth/google/callback
   ```
6. Guarda los cambios

### Notion Integration

1. Ve a [Notion Developers](https://www.notion.so/my-integrations)
2. Selecciona tu integración
3. En "Redirect URIs", agrega:
   ```
   https://[tu-proyecto].vercel.app/api/auth/notion/callback
   ```
4. Guarda los cambios

### Actualizar Variables de Entorno en Vercel

1. Ve a tu proyecto en Vercel Dashboard
2. Ve a "Settings" → "Environment Variables"
3. Encuentra `GOOGLE_REDIRECT_URI` y haz clic en los tres puntos → "Edit"
4. Cambia el valor a:
   ```
   https://[tu-proyecto].vercel.app/api/auth/google/callback
   ```
5. Guarda y haz clic en "Redeploy" (Vercel te preguntará si quieres hacer redeploy)

---

## ✅ Verificación Final

### Checklist de Verificación

- [ ] La aplicación carga en `https://[tu-proyecto].vercel.app`
- [ ] Puedes acceder a la página de login
- [ ] El login con Google funciona correctamente
- [ ] La integración con Notion funciona
- [ ] El chat con Gemini responde
- [ ] Las credenciales se guardan en Supabase
- [ ] El cron job está configurado (verifica en Vercel Dashboard → Cron Jobs)
- [ ] Las variables de entorno están todas configuradas

### Verificar Cron Jobs

1. En Vercel Dashboard, ve a tu proyecto
2. Haz clic en "Cron Jobs" en el menú lateral
3. Deberías ver: `daily-summary` con schedule `0 * * * *`
4. Vercel ejecutará esto automáticamente cada hora

### Probar la Aplicación

1. Visita tu URL de producción
2. Inicia sesión con Google
3. Autoriza acceso a Gmail y Calendar
4. Conecta Notion
5. Envía un mensaje de prueba al chat
6. Verifica en la página de Settings que puedas configurar el resumen diario

---

## 🐛 Troubleshooting

### Error: "Missing environment variable"

**Solución**: Ve a Vercel Dashboard → Settings → Environment Variables y verifica que todas estén configuradas para "Production".

### Error en OAuth: "redirect_uri_mismatch"

**Solución**:
1. Verifica que hayas actualizado los redirect URIs en Google Cloud Console y Notion
2. Verifica que `GOOGLE_REDIRECT_URI` en Vercel tenga la URL correcta de producción
3. Haz un redeploy después de cambiar las variables

### Error: "Database connection failed"

**Solución**:
1. Verifica que `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` estén correctos
2. Verifica que tu proyecto de Supabase esté activo

### El cron job no se ejecuta

**Solución**:
1. Los cron jobs gratuitos en Vercel tienen un límite
2. Verifica en Vercel Dashboard → Cron Jobs que esté activo
3. Revisa los logs en Vercel Dashboard → Logs

---

## 🎉 ¡Deployment Completado!

Tu aplicación ahora está en producción. Próximos pasos opcionales:

1. **Configurar un dominio personalizado** (si tienes uno)
2. **Configurar Analytics** en Vercel
3. **Configurar Monitoring** para recibir alertas de errores
4. **Revisar logs regularmente** en Vercel Dashboard

---

## 📞 Soporte

Si encuentras problemas:
- Revisa los logs en Vercel Dashboard → Logs
- Verifica las variables de entorno
- Consulta la [documentación de Vercel](https://vercel.com/docs)

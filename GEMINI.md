# GEMINI.md: Análisis del Proyecto `asistente-ia-nuevo`

## 🚀 Resumen del Proyecto

Este proyecto es el backend de autenticación para un asistente de IA personal, enfocado en la integración segura con Google OAuth 2.0 y Supabase. Utiliza el App Router de Next.js para gestionar las rutas de la API y proporcionar una experiencia de usuario interactiva. El objetivo principal es autenticar usuarios a través de Google y almacenar de forma segura sus `refresh_tokens` para acceder a los servicios de Google (Gmail, Calendar) desde el asistente de IA.

### Tecnologías Clave

*   **Framework:** Next.js 16.0.1 (App Router)
*   **Lenguaje:** TypeScript
*   **Autenticación:** Google OAuth 2.0 (`google-auth-library`)
*   **Base de Datos/Backend as a Service (BaaS):** Supabase (`@supabase/ssr`, `@supabase/supabase-js`)
*   **Encriptación:** Módulo `crypto` nativo de Node.js (AES-256-GCM) para `refresh_tokens`.
*   **Interfaz de Usuario:** React (Client Components en Next.js)

### Arquitectura y Flujo de Autenticación

El flujo de autenticación se basa en rutas API de Next.js:

1.  **Inicio de Sesión:** El frontend (`app/page.tsx`) presenta un botón "Conectar con Google". Al hacer clic, redirige al usuario a la ruta API `/api/auth/google/redirect`.
2.  **Redirección a Google:** La ruta `/api/auth/google/redirect` genera la URL de consentimiento de Google con los `scopes` requeridos y `access_type: 'offline'` (para obtener un `refresh_token`), y redirige al usuario a Google.
3.  **Callback de Google:** Tras el consentimiento del usuario, Google redirige al usuario a la ruta API `/api/auth/google/callback` con un código de autorización.
4.  **Procesamiento del Callback:**
    *   Se intercambia el código de autorización por `id_token` y `refresh_token` de Google.
    *   El `id_token` se utiliza con `supabase.auth.signInWithIdToken` para autenticar/registrar al usuario en Supabase, obteniendo un `user.id` (UUID).
    *   El `refresh_token` de Google se encripta de forma segura utilizando AES-256-GCM.
    *   El `user.id` de Supabase y el `refresh_token` encriptado (junto con el IV y el Auth Tag) se almacenan en una tabla `user_credentials` de Supabase.
5.  **Redirección Final:** Se redirige al usuario a la página principal con un estado de éxito o error.

## 📁 Estructura de Archivos Clave

*   **`/app`:** Contiene las rutas de la aplicación y las rutas API.
    *   **`/app/api/auth/google/redirect/route.ts`:** Lógica para iniciar el flujo de Google OAuth.
    *   **`/app/api/auth/google/callback/route.ts`:** Lógica para manejar la respuesta de Google, autenticar con Supabase y guardar credenciales.
    *   **`/app/page.tsx`:** Componente principal del frontend para la interfaz de inicio de sesión.
*   **`/lib`:** Contiene módulos de utilidad reutilizables.
    *   **`/lib/googleAuth.ts`:** Configuración centralizada del cliente Google OAuth 2.0 y definición de `scopes`.
    *   **`/lib/supabaseClient.ts`:** Función para crear un cliente de Supabase para Client Components.
*   **`.env.local`:** Archivo de configuración para variables de entorno locales (no debe ser versionado).
*   **`package.json`:** Define las dependencias del proyecto y los scripts.

## ⚙️ Configuración y Variables de Entorno

El proyecto asume que las siguientes variables de entorno están definidas en el archivo `.env.local`:

*   `GOOGLE_CLIENT_ID`: ID de cliente de tu aplicación Google OAuth.
*   `GOOGLE_CLIENT_SECRET`: Secreto de cliente de tu aplicación Google OAuth.
*   `ENCRYPTION_KEY`: Clave de 32 bytes codificada en Base64 para la encriptación AES-256-GCM de los `refresh_tokens`.
*   `NEXT_PUBLIC_SUPABASE_URL`: URL de tu proyecto Supabase.
*   `NEXT_PUBLIC_SUPABASE_ANON_KEY`: "anon key" de tu proyecto Supabase (clave pública).
*   `GEMINI_API_KEY`: Clave de API para el servicio Gemini.
*   `NOTION_INTERNAL_INTEGRATION_TOKEN`: Token de integración para Notion.

**Ejemplo de `.env.local`:**

```dotenv
ENCRYPTION_KEY=[TU_CLAVE_DE_ENCRIPTACION_BASE64]
GOOGLE_CLIENT_ID=[TU_CLIENT_ID_DE_GOOGLE]
GOOGLE_CLIENT_SECRET=[TU_CLIENT_SECRET_DE_GOOGLE]
GEMINI_API_KEY=[TU_LLAVE_DE_GEMINI]
NOTION_INTERNAL_INTEGRATION_TOKEN=[TU_TOKEN_DE_NOTION]
NEXT_PUBLIC_SUPABASE_URL=https://[tu-id-proyecto].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[TU_CLAVE_ANON_SUPABASE]
```

## 🛠️ Cómo Construir y Ejecutar

### Requisitos

*   Node.js (versión 18.x o superior)
*   npm (o yarn, pnpm, bun)

### Pasos

1.  **Clonar el repositorio:**
    ```bash
    git clone <URL_DEL_REPOSITORIO> asistente-ia-nuevo
    cd asistente-ia-nuevo
    ```

2.  **Instalar dependencias:**
    ```bash
    npm install
    ```
    *(Si usas Yarn, pnpm o bun, usa `yarn`, `pnpm install` o `bun install` respectivamente.)*

3.  **Configurar Variables de Entorno:**
    *   Crea un archivo `.env.local` en la raíz del proyecto.
    *   Rellena con tus credenciales tal como se describe en la sección "Configuración y Variables de Entorno".

4.  **Iniciar el servidor de desarrollo:**
    ```bash
    npm run dev
    ```
    *   Para ejecutar sin Turbopack (útil para solucionar problemas):
        ```bash
        npm run dev -- --no-turbo
        ```

5.  **Abrir en el Navegador:**
    *   Abre `http://localhost:3000` en tu navegador.

### Consideraciones para Despliegue en Producción (Dokku)

Antes de desplegar en Dokku, asegúrate de:

*   Haber habilitado el proveedor de Google en tu instancia de Supabase y añadido las credenciales de cliente.
*   Haber añadido la URL de callback de Supabase (`https://<tu-id-proyecto>.supabase.co/auth/v1/callback`) a las "URI de redireccionamiento autorizados" en la Consola de Google Cloud.
*   Haber añadido los "Authorized JavaScript Origins" si tu frontend tiene un dominio diferente.
*   Configurar las variables de entorno necesarias en tu entorno de Dokku (p. ej., `dokku config:set my-app GOOGLE_CLIENT_ID=...`).

## ✨ Convenciones de Desarrollo

*   **TypeScript:** El proyecto está escrito enteramente en TypeScript para mayor robustez y claridad.
*   **Next.js App Router:** Sigue las convenciones del App Router para routing y API routes.
*   **Client Components:** Uso de `'use client'` para componentes de React que requieren interactividad en el navegador.
*   **Módulos de Utilidad:** La lógica compartida se abstrae en el directorio `/lib` para reutilización y mantenibilidad.
*   **Manejo de Errores:** Incluye un manejo básico de errores con redirecciones a la página principal con parámetros de estado.

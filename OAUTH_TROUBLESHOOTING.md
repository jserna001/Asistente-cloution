# Guía de Troubleshooting - OAuth de Google

**Fecha:** 2025-11-13
**Problema:** Gmail y Calendar fallan con error de autenticación después de re-autenticación
**Estado:** 🔴 ACTIVO - En investigación

---

## 📊 Estado Actual

### ✅ Funcionando
- **Notion MCP**: Funciona correctamente (añadir objetivos, crear tareas)
- **Credenciales en DB**: Existen y están completas (encrypted_refresh_token, iv, auth_tag)
- **OAuth Redirect**: Solicita los scopes correctamente

### ❌ Fallando
- **Gmail Search** (`google.search_emails`): Error de autenticación
- **Calendar Read** (`google.read_calendar`): Error de autenticación

---

## 🔍 Diagnóstico del Problema

### Síntomas
1. Usuario completa onboarding exitosamente
2. Credenciales se guardan en `user_credentials` table
3. Durante re-autenticación, Google muestra: **"esta aplicacion ya tiene cierto acceso"**
4. No se solicitan NUEVOS permisos
5. Gmail y Calendar fallan con: **"problema con la autenticación"**

### Causa Raíz Identificada

El problema tiene dos capas:

#### 1. **Scopes Restringidos vs No Restringidos**

En `lib/googleAuth.ts:7-29`, solicitamos estos scopes:

```typescript
export const requiredScopes = [
  // ✅ NO SENSIBLES (deberían funcionar sin verificación)
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/gmail.readonly',      // ✅ Lectura
  'https://www.googleapis.com/auth/contacts.readonly',   // ✅ Lectura
  'https://www.googleapis.com/auth/drive.file',          // ✅ Solo archivos de la app

  // ❌ RESTRINGIDOS (requieren verificación de Google)
  'https://www.googleapis.com/auth/gmail.send',          // ⚠️ Escritura
  'https://www.googleapis.com/auth/gmail.compose',       // ⚠️ Escritura
  'https://www.googleapis.com/auth/calendar',            // ⚠️ Acceso completo
  'https://www.googleapis.com/auth/calendar.events',     // ⚠️ Escritura
  'https://www.googleapis.com/auth/tasks',               // ⚠️ Escritura
];
```

**Problema:** Cuando solicitas scopes restringidos sin verificación, Google puede:
- Bloquear TODOS los scopes (incluyendo los no sensibles)
- Mostrar pantalla de advertencia "Esta app no ha sido verificada"
- Limitar el acceso solo a "Test Users" configurados en Google Cloud Console

#### 2. **Configuración de Google Cloud Console**

La aplicación OAuth debe estar en uno de estos estados:

| Estado | Requiere Verificación | Usuarios Permitidos | Scopes Permitidos |
|--------|----------------------|---------------------|-------------------|
| **Testing** | No | Solo Test Users (máx 100) | Todos (sin restricción) |
| **Production** | **Sí** | Cualquiera | Solo scopes verificados |

**Hipótesis:** La app está en modo "Testing" pero el usuario `jserna001@cloution.cloud` NO está agregado como "Test User".

---

## 🛠️ Soluciones

### Solución 1: Agregar Test User (INMEDIATA - 5 minutos)

**Pasos:**

1. Ir a [Google Cloud Console](https://console.cloud.google.com)
2. Seleccionar el proyecto OAuth (verificar `GOOGLE_CLIENT_ID` en `.env.local`)
3. Navegar a: **APIs y Servicios** → **Pantalla de consentimiento OAuth**
4. Sección **Test users** → Click en "ADD USERS"
5. Agregar: `jserna001@cloution.cloud`
6. Guardar cambios

**Después:**
- Revocar acceso en https://myaccount.google.com/permissions
- Logout de la app
- Login nuevamente con Google
- Aceptar todos los permisos (ahora SÍ debería funcionar)

---

### Solución 2: Consentimiento Incremental (RECOMENDADA - 2 horas)

Separar los scopes en dos grupos y solicitar solo los NO sensibles al inicio:

#### 2.1. Modificar `lib/googleAuth.ts`

```typescript
// Scopes iniciales (no requieren verificación)
export const initialScopes = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/contacts.readonly',
  'https://www.googleapis.com/auth/drive.file',
];

// Scopes de escritura (requieren verificación)
export const restrictedScopes = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/tasks',
];

// Por ahora, solo usar initialScopes
export const requiredScopes = initialScopes;
```

#### 2.2. Modificar `app/api/auth/google/redirect/route.ts`

```typescript
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: initialScopes,  // ← Cambiar de requiredScopes a initialScopes
});
```

**Beneficios:**
- Gmail Read y Calendar Read funcionarán inmediatamente
- No se requiere verificación de Google
- Mejor experiencia de usuario (menos permisos asusta menos)

**Limitación:**
- Gmail Send, Calendar Write y Tasks NO funcionarán hasta que:
  1. Se implemente consentimiento incremental (pedir scopes adicionales on-demand)
  2. Se complete el proceso de verificación de Google (2-6 semanas)

---

### Solución 3: Verificación de Google (LARGO PLAZO - 2-6 semanas)

Seguir los pasos en `GOOGLE_VERIFICATION.md` para verificar la aplicación.

**Requisitos:**
- Política de privacidad pública
- Dominio verificado
- Video de demostración
- Justificaciones por scope

**Timeline:**
- Preparación: 2-3 días
- Revisión de Google: 2-6 semanas
- Re-verificación: Anualmente

---

## 🧪 Plan de Pruebas

### Después de Solución 1 (Agregar Test User)

```bash
# Test 1: Gmail Read
"Busca correos de cloudflare de la semana pasada"
# Esperado: ✅ Lista de correos

# Test 2: Calendar Read
"¿Qué tengo en mi agenda hoy?"
# Esperado: ✅ Eventos del día

# Test 3: Notion (control)
"Agregar objetivo: Alcanzar 60K MRR en Q2"
# Esperado: ✅ OKR creado

# Test 4: Gmail Write (DEBERÍA FALLAR todavía)
"Envía un correo a juan@ejemplo.com"
# Esperado: ❌ Error (scope restringido sin verificar)
```

### Después de Solución 2 (Consentimiento Incremental)

Mismas pruebas, pero Gmail Write y Calendar Write seguirán fallando hasta la verificación.

---

## 📝 Checklist de Verificación

**Configuración de Google Cloud Console:**
- [ ] Verificar que el proyecto OAuth esté creado
- [ ] Verificar que la app esté en modo "Testing" o "Production"
- [ ] Verificar que `jserna001@cloution.cloud` sea Test User (si está en Testing)
- [ ] Verificar que los scopes estén configurados en la pantalla de consentimiento
- [ ] Verificar que el dominio `asistente-justine.cloution.cloud` esté autorizado

**Configuración Local:**
- [ ] `.env.local` tiene `GOOGLE_CLIENT_ID` correcto
- [ ] `.env.local` tiene `GOOGLE_CLIENT_SECRET` correcto
- [ ] `.env.local` tiene `GOOGLE_REDIRECT_URI` correcto

**Base de Datos:**
- [ ] Verificar que existen credenciales: `SELECT * FROM user_credentials WHERE user_id = '575a8929-81b3-4efa-ba4d-31b86b523c74' AND service_name = 'google';`
- [ ] Verificar que están completas (encrypted_refresh_token, iv, auth_tag NOT NULL)

---

## 🔗 Referencias

- **Scopes de Google:** https://developers.google.com/identity/protocols/oauth2/scopes
- **Verificación OAuth:** https://support.google.com/cloud/answer/9110914
- **Políticas de Datos de Usuario:** https://developers.google.com/terms/api-services-user-data-policy
- **Google Cloud Console:** https://console.cloud.google.com
- **Revocar Acceso:** https://myaccount.google.com/permissions

---

## 📞 Soporte

Si el problema persiste después de implementar Solución 1:

1. Verificar logs del servidor: `npm run dev` y buscar errores de OAuth
2. Verificar respuesta de Google API en Network tab
3. Ejecutar script de diagnóstico: `npx tsx scripts/check-google-credentials.ts 575a8929-81b3-4efa-ba4d-31b86b523c74`
4. Revisar quota de Google APIs en Cloud Console

---

**Última actualización:** 2025-11-13
**Próximo paso:** Implementar Solución 1 (Agregar Test User) o Solución 2 (Consentimiento Incremental)

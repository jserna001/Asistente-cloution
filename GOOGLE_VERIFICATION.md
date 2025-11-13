# Guía de Verificación OAuth de Google

**Fecha:** 2025-11-13
**Proyecto:** Asistente-cloution (asistente-ia-nuevo)
**Estado:** Pendiente de verificación para scopes de escritura

---

## 📋 Resumen Ejecutivo

Este proyecto solicita scopes de OAuth 2.0 de Google que requieren **verificación obligatoria** antes de ser usados en producción. Los scopes de escritura (Gmail send/compose, Calendar events, Tasks, Drive.file) requieren un proceso de revisión de seguridad de Google que puede tardar **2-6 semanas**.

---

## 🔑 Scopes Solicitados

### ✅ Scopes NO Sensibles (Ya funcionales)

| Scope | Nivel de Riesgo | Estado |
|-------|-----------------|--------|
| `userinfo.email` | No sensible | ✓ Funcional |
| `userinfo.profile` | No sensible | ✓ Funcional |
| `gmail.readonly` | Sensible (lectura) | ✓ Funcional |
| `calendar.readonly` | Sensible (lectura) | ✓ Funcional |
| `contacts.readonly` | Sensible (lectura) | ✓ Funcional |
| `drive.file` | **No sensible** | ✓ Funcional |

**⚠️ Nota importante:** `drive.file` es NO sensible porque solo accede a archivos creados por la aplicación, no a todos los archivos del usuario.

### 🔒 Scopes Restringidos (REQUIEREN VERIFICACIÓN)

| Scope | Descripción | Justificación |
|-------|-------------|---------------|
| `gmail.send` | Enviar correos electrónicos | **Característica principal:** Permitir al asistente enviar correos en nombre del usuario (ej: "envía un correo a Juan") |
| `gmail.compose` | Crear/modificar borradores | **Característica principal:** Crear borradores para revisión antes de enviar |
| `calendar` | Acceso completo al calendario | **Característica principal:** Crear, actualizar y eliminar eventos (ej: "crea un evento mañana a las 3pm") |
| `calendar.events` | Gestionar eventos del calendario | **Característica principal:** Operaciones CRUD de eventos |
| `tasks` | Gestión de tareas de Google | **Característica principal:** Crear y gestionar recordatorios simples (ej: "recuérdame comprar leche") |

---

## 📝 Pasos para la Verificación OAuth

### Fase 1: Configuración Inicial (2-3 días)

#### 1.1. Crear Política de Privacidad Pública

**Requisito:** Documento público y accesible vía HTTPS

**Ubicación sugerida:** `https://asistente-justine.cloution.cloud/privacy-policy`

**Contenido mínimo requerido:**

1. **Qué datos recopilamos:**
   - Correos electrónicos (Gmail)
   - Eventos del calendario (Google Calendar)
   - Tareas (Google Tasks)
   - Contactos (Google Contacts - solo lectura)
   - Archivos creados por la aplicación (Google Drive)

2. **Cómo usamos los datos:**
   - Para ejecutar comandos del usuario (enviar correos, crear eventos, etc.)
   - Para búsqueda y recuperación de información (RAG)
   - Para mejorar la experiencia del asistente

3. **Cómo almacenamos los datos:**
   - Los tokens de acceso se almacenan encriptados (AES-256-GCM) en Supabase PostgreSQL
   - Los correos y eventos se procesan en memoria y se vectorizan para búsqueda semántica
   - NO compartimos datos con terceros

4. **Cómo eliminar los datos:**
   - El usuario puede revocar acceso en cualquier momento desde Google Account Settings
   - Los tokens encriptados se eliminan al revocar acceso

#### 1.2. Verificar Dominio

**Herramienta:** Google Search Console

**Pasos:**
1. Ir a [Google Search Console](https://search.google.com/search-console)
2. Agregar propiedad: `asistente-justine.cloution.cloud`
3. Verificar propiedad (método DNS o archivo HTML)

#### 1.3. Configurar Pantalla de Consentimiento OAuth

**Ubicación:** Google Cloud Console > APIs y Servicios > Pantalla de Consentimiento

**Campos requeridos:**

- **Nombre de la aplicación:** Asistente Cloution
- **Logotipo:** (Subir imagen 120x120px)
- **Correo de soporte del usuario:** jserna001@cloution.cloud
- **Dominio de la aplicación:** asistente-justine.cloution.cloud
- **Enlace a política de privacidad:** https://asistente-justine.cloution.cloud/privacy-policy
- **Enlace a términos de servicio:** (Opcional pero recomendado)

**Scopes a solicitar en la pantalla:**
- ✅ Marcar TODOS los scopes listados en la sección anterior

### Fase 2: Preparación de Documentación (1-2 días)

#### 2.1. Video de Demostración

**Requisito:** Video corto (2-5 minutos) mostrando el flujo completo

**Contenido del video:**

1. **Inicio de sesión:**
   - Mostrar flujo de OAuth (redirect a Google)
   - Pantalla de consentimiento mostrando los scopes

2. **Gmail (gmail.send y gmail.compose):**
   - Usuario dice: "Envía un correo a juan@ejemplo.com"
   - Mostrar la herramienta `google.send_email` siendo llamada
   - Mostrar el correo apareciendo en Gmail

3. **Calendar (calendar.events):**
   - Usuario dice: "Crea un evento mañana a las 3pm"
   - Mostrar la herramienta `google.create_event` siendo llamada
   - Mostrar el evento apareciendo en Google Calendar

4. **Tasks (tasks):**
   - Usuario dice: "Recuérdame comprar leche mañana"
   - Mostrar la herramienta `google.create_task` siendo llamada
   - Mostrar la tarea apareciendo en Google Tasks

**Herramientas recomendadas:**
- Loom (https://loom.com) - Grabación de pantalla sencilla
- OBS Studio - Para edición más profesional

#### 2.2. Justificación Escrita por Scope

Google pedirá justificaciones detalladas para cada scope. Preparar respuestas claras:

**Ejemplo de justificación para `gmail.send`:**

> "Nuestra aplicación es un asistente personal de IA que permite a los usuarios enviar correos electrónicos mediante comandos de voz o texto natural. Por ejemplo, el usuario puede decir 'Envía un correo a Juan con el reporte semanal' y la aplicación lo ejecuta automáticamente. El scope gmail.send es necesario para esta funcionalidad principal de la aplicación. El usuario mantiene control total, ya que el asistente solicita confirmación antes de enviar."

### Fase 3: Envío de Solicitud (1 día)

#### 3.1. Completar Formulario de Verificación

**Ubicación:** Google Cloud Console > OAuth Consent Screen > Enviar para verificación

**Información requerida:**
- URL de la política de privacidad
- URL del video de demostración (YouTube o Drive)
- Descripción de la aplicación
- Justificaciones por scope

#### 3.2. Tiempo de Respuesta Estimado

- **Primera revisión:** 3-5 días laborables
- **Solicitudes de información adicional:** 1-2 semanas (si Google pide aclaraciones)
- **Aprobación final:** 2-6 semanas en total

---

## 🚀 Estrategia de Implementación por Fases

### Fase 1A: Lectura (ACTUAL - Ya funcional)

**Scopes activos:**
- `gmail.readonly`
- `calendar.readonly`
- `contacts.readonly`
- `drive.file`

**Funcionalidad:**
- Buscar correos ✅
- Leer correos ✅
- Ver agenda ✅
- Buscar contactos ✅
- Crear documentos en blanco ✅

### Fase 1B: Escritura Gmail (SIGUIENTE - Requiere verificación)

**Scopes a habilitar:**
- `gmail.send`
- `gmail.compose`

**Funcionalidad nueva:**
- Enviar correos
- Crear borradores

**Acción:** Enviar solicitud de verificación **AHORA** (puede tardar 2-6 semanas)

### Fase 2: Escritura Calendar y Tasks (Después de aprobación Gmail)

**Scopes a habilitar:**
- `calendar.events`
- `tasks`

**Funcionalidad nueva:**
- Crear/editar/eliminar eventos
- Crear/completar tareas

**Acción:** Solicitar verificación una vez aprobado Gmail

---

## ⚠️ Consideraciones Importantes

### 1. Consentimiento Incremental (RECOMENDADO)

NO pedir todos los scopes al inicio de sesión. Implementar **incremental authorization:**

```typescript
// Scopes iniciales (registro)
const initialScopes = [
  'userinfo.email',
  'userinfo.profile',
  'gmail.readonly',
  'calendar.readonly',
  'contacts.readonly',
  'drive.file'
];

// Scopes adicionales (cuando el usuario intenta enviar un correo)
const gmailSendScopes = [
  'gmail.send',
  'gmail.compose'
];

// Trigger: Usuario dice "envía un correo"
if (userWantsToSendEmail && !hasGmailSendScope) {
  // Mostrar nuevo flujo de OAuth pidiendo SOLO gmail.send
  redirectToOAuthWithAdditionalScopes(gmailSendScopes);
}
```

**Beneficios:**
- Mejor tasa de aprobación de Google (principio de privilegio mínimo)
- Mejor experiencia de usuario (no asustar con muchos permisos al inicio)
- Cumple con las mejores prácticas de seguridad

### 2. Pantalla de Advertencia de Google

Hasta que la aplicación sea verificada, los usuarios verán una pantalla de advertencia:

> "Esta aplicación no ha sido verificada por Google"

**Soluciones temporales:**
- Agregar usuarios de prueba en Google Cloud Console (máximo 100 usuarios)
- Registrar la aplicación como "Interna" (solo para dominio de Google Workspace)

### 3. Renovación Anual

La verificación de OAuth NO es permanente. Google puede solicitar re-verificación anualmente si:
- Cambias los scopes solicitados
- Modificas significativamente la funcionalidad de la aplicación
- Google actualiza sus políticas de seguridad

---

## 📚 Recursos Adicionales

### Documentación Oficial
- **OAuth Verification:** https://support.google.com/cloud/answer/9110914
- **OAuth Policies:** https://developers.google.com/terms/api-services-user-data-policy
- **Restricted Scopes:** https://developers.google.com/identity/protocols/oauth2/scopes

### Casos de Uso Similares
- Gmail Delegation (similar a nuestro `gmail.send`)
- Calendar Management Apps (similar a nuestro `calendar.events`)

---

## ✅ Checklist de Pre-Verificación

Antes de enviar la solicitud, asegurarse de:

- [ ] Política de privacidad pública y accesible vía HTTPS
- [ ] Dominio verificado en Google Search Console
- [ ] Pantalla de consentimiento configurada con toda la información
- [ ] Video de demostración grabado y publicado (YouTube/Drive)
- [ ] Justificaciones escritas para cada scope
- [ ] Aplicación funcional en ambiente de producción (no localhost)
- [ ] Logotipo de la aplicación (120x120px)
- [ ] Correo de soporte configurado y monitoreado

---

## 🎯 Próximos Pasos Inmediatos

1. **HOY:** Crear política de privacidad y publicarla
2. **HOY:** Verificar dominio en Google Search Console
3. **MAÑANA:** Grabar video de demostración
4. **MAÑANA:** Completar pantalla de consentimiento OAuth
5. **PASADO MAÑANA:** Enviar solicitud de verificación para scopes de Gmail
6. **ESPERAR:** 2-6 semanas para aprobación

---

**Última actualización:** 2025-11-13
**Autor:** Sistema de documentación automatizado
**Contacto:** jserna001@cloution.cloud

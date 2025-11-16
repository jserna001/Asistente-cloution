# Gmail Push Notifications Setup Guide

Esta guía explica cómo configurar Gmail Push Notifications para sincronización en tiempo real de emails.

## Descripción General

Gmail Push Notifications utiliza Google Cloud Pub/Sub para notificar a tu aplicación cuando hay nuevos emails. Esto permite sincronización automática sin necesidad de polling constante.

## Arquitectura

```
Gmail (nuevo email)
    ↓
Google Cloud Pub/Sub Topic
    ↓
POST /api/webhooks/gmail (tu servidor)
    ↓
Sincronización automática en background
```

## Requisitos Previos

1. **Cuenta de Google Cloud** con acceso al proyecto
2. **API de Gmail habilitada** (ya configurada si tienes OAuth funcionando)
3. **Dominio público** para el webhook (ej: `asistente-justine.cloution.cloud`)
4. **HTTPS obligatorio** (Pub/Sub solo funciona con HTTPS)

## Paso 1: Crear Topic en Cloud Pub/Sub

### 1.1 Acceder a Google Cloud Console

Ve a: https://console.cloud.google.com/cloudpubsub/topic/list

### 1.2 Crear un nuevo Topic

```bash
# Nombre sugerido
projects/YOUR_PROJECT_ID/topics/gmail-notifications

# O usando gcloud CLI:
gcloud pubsub topics create gmail-notifications --project=YOUR_PROJECT_ID
```

### 1.3 Crear una Suscripción (Push)

```bash
# Nombre de suscripción
gmail-notifications-push

# Endpoint URL (tu webhook)
https://asistente-justine.cloution.cloud/api/webhooks/gmail

# Usando gcloud CLI:
gcloud pubsub subscriptions create gmail-notifications-push \
  --topic=gmail-notifications \
  --push-endpoint=https://asistente-justine.cloution.cloud/api/webhooks/gmail \
  --project=YOUR_PROJECT_ID
```

**Importante:** El endpoint debe ser HTTPS y estar públicamente accesible.

## Paso 2: Otorgar Permisos a Gmail

Gmail necesita permisos para publicar en tu topic de Pub/Sub.

### 2.1 Obtener la cuenta de servicio de Gmail

La cuenta de servicio de Gmail es:
```
gmail-api-push@system.gserviceaccount.com
```

### 2.2 Agregar permisos de Publisher

En Google Cloud Console:
1. Ve a tu Topic `gmail-notifications`
2. Click en "PERMISSIONS" (permisos)
3. Click en "ADD PRINCIPAL" (agregar principal)
4. Ingresa: `gmail-api-push@system.gserviceaccount.com`
5. Selecciona rol: `Pub/Sub Publisher`
6. Click en "SAVE"

**O usando gcloud CLI:**

```bash
gcloud pubsub topics add-iam-policy-binding gmail-notifications \
  --member=serviceAccount:gmail-api-push@system.gserviceaccount.com \
  --role=roles/pubsub.publisher \
  --project=YOUR_PROJECT_ID
```

## Paso 3: Configurar Watch en la Aplicación

### 3.1 Usando el Script CLI

Puedes configurar el watch para un usuario específico usando el servicio de Gmail:

```typescript
// En tu código o script
import { GmailSyncService } from './lib/gmailService';

const gmailService = new GmailSyncService(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  process.env.GEMINI_API_KEY!
);

const result = await gmailService.setupGmailWatch(
  userId,
  'projects/YOUR_PROJECT_ID/topics/gmail-notifications'
);

console.log('Watch configurado:', result);
```

### 3.2 Usando API directamente

O crear un endpoint interno para que los usuarios activen el watch desde la UI:

```typescript
// app/api/sync/gmail/watch/route.ts
export async function POST(request: NextRequest) {
  // Autenticar usuario
  const userId = user.id;

  const gmailService = new GmailSyncService(...);

  const result = await gmailService.setupGmailWatch(
    userId,
    'projects/YOUR_PROJECT_ID/topics/gmail-notifications'
  );

  return NextResponse.json(result);
}
```

## Paso 4: Renovación Automática del Watch

Los watches de Gmail **expiran cada 7 días**. Necesitas renovarlos automáticamente.

### 4.1 Crear Cron Job para Renovación

```typescript
// scripts/renew-gmail-watches.ts
import { createClient } from '@supabase/supabase-js';
import { GmailSyncService } from '../lib/gmailService';

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Obtener usuarios con watch habilitado
  const { data: configs } = await supabase
    .from('gmail_sync_config')
    .select('user_id, watch_topic_name')
    .eq('watch_enabled', true);

  if (!configs) return;

  const gmailService = new GmailSyncService(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    process.env.GEMINI_API_KEY!
  );

  for (const config of configs) {
    try {
      await gmailService.setupGmailWatch(
        config.user_id,
        config.watch_topic_name
      );
      console.log(`✓ Watch renovado para usuario ${config.user_id}`);
    } catch (error) {
      console.error(`✗ Error renovando watch para ${config.user_id}:`, error);
    }
  }
}

main();
```

### 4.2 Configurar Cron (cada 6 días)

```bash
# En crontab o deployment platform
0 0 */6 * * npx tsx scripts/renew-gmail-watches.ts
```

O usando **Supabase Edge Functions** con cron:

```typescript
// supabase/functions/renew-gmail-watches/index.ts
import { serve } from 'std/http/server.ts';

serve(async (req) => {
  // Lógica de renovación
  // Se ejecuta automáticamente según configuración de cron
});
```

## Paso 5: Verificar Funcionamiento

### 5.1 Test Manual

Envía un email de prueba a tu cuenta de Gmail y verifica:

1. **Logs del servidor**: Deberías ver en consola:
   ```
   [Webhook /gmail] Notificación recibida de Gmail Push
   [Webhook /gmail] Usuario identificado: {userId}
   [GmailSync] Sincronización completada para {userId}: X emails
   ```

2. **Base de datos**: Verifica que se creó un nuevo registro en `document_chunks`

3. **Pub/Sub Console**: Ve a Google Cloud Console → Pub/Sub → Subscription
   - Verifica que "Message count" incrementa
   - Revisa los logs de delivery

### 5.2 Test con Postman

Simula una notificación de Pub/Sub:

```json
POST https://tu-dominio.com/api/webhooks/gmail
Content-Type: application/json

{
  "message": {
    "data": "eyJlbWFpbEFkZHJlc3MiOiJ0dUBlbWFpbC5jb20iLCJoaXN0b3J5SWQiOiIxMjM0NTYifQ==",
    "messageId": "test-message-123",
    "publishTime": "2025-01-15T10:00:00Z"
  },
  "subscription": "projects/YOUR_PROJECT_ID/subscriptions/gmail-notifications-push"
}
```

**Nota:** El campo `data` es base64 de:
```json
{
  "emailAddress": "tu@email.com",
  "historyId": "123456"
}
```

## Paso 6: Monitoreo y Debugging

### 6.1 Verificar Estado del Watch

```typescript
// Obtener información del watch actual
const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
const profile = await gmail.users.getProfile({ userId: 'me' });
console.log('History ID:', profile.data.historyId);
```

### 6.2 Detener un Watch

```typescript
const gmailService = new GmailSyncService(...);
await gmailService.stopGmailWatch(userId);
```

### 6.3 Logs de Pub/Sub

En Google Cloud Console:
1. Ve a Pub/Sub → Subscriptions
2. Click en `gmail-notifications-push`
3. Tab "METRICS" para ver gráficas
4. Tab "LOGS" para ver errores de delivery

## Troubleshooting

### Problema: No llegan notificaciones

**Solución:**
1. Verifica que el topic tenga permisos para `gmail-api-push@system.gserviceaccount.com`
2. Verifica que el endpoint sea HTTPS y públicamente accesible
3. Revisa los logs de Pub/Sub para ver errores de delivery
4. Verifica que el watch esté activo (no expirado)

### Problema: Error 403 en webhook

**Solución:**
- Pub/Sub está intentando entregar pero tu servidor rechaza la petición
- Verifica que el endpoint `/api/webhooks/gmail` exista y esté activo
- Revisa los logs de tu servidor

### Problema: Emails duplicados

**Solución:**
- Verifica que no tengas múltiples watches activos para el mismo usuario
- Agrega constraint UNIQUE en `document_chunks` para `(user_id, source_id)`

### Problema: Watch expira

**Solución:**
- Los watches expiran cada 7 días
- Configura el cron job de renovación (ver Paso 4)
- Considera implementar alertas cuando expira un watch

## Configuración Alternativa: Solo Sincronización Manual

Si no quieres configurar Push Notifications, puedes usar **solo sincronización manual** desde la UI y/o cron job:

```bash
# Cron job cada hora para todos los usuarios
0 * * * * npx tsx scripts/ingest-gmail.ts --all

# O para un usuario específico cada 30 minutos
*/30 * * * * npx tsx scripts/ingest-gmail.ts {userId}
```

## Variables de Entorno Necesarias

No requiere variables adicionales si ya tienes:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
GEMINI_API_KEY=...
```

## Recursos Adicionales

- **Gmail API - Push Notifications:** https://developers.google.com/gmail/api/guides/push
- **Cloud Pub/Sub Docs:** https://cloud.google.com/pubsub/docs
- **Gmail Watch Reference:** https://developers.google.com/gmail/api/reference/rest/v1/users/watch

## Resumen de Comandos

```bash
# 1. Crear topic
gcloud pubsub topics create gmail-notifications

# 2. Crear subscription push
gcloud pubsub subscriptions create gmail-notifications-push \
  --topic=gmail-notifications \
  --push-endpoint=https://tu-dominio.com/api/webhooks/gmail

# 3. Dar permisos a Gmail
gcloud pubsub topics add-iam-policy-binding gmail-notifications \
  --member=serviceAccount:gmail-api-push@system.gserviceaccount.com \
  --role=roles/pubsub.publisher

# 4. Configurar watch desde código/script
# Ver Paso 3.1

# 5. Configurar renovación automática (cron)
# Ver Paso 4.2
```

---

**Implementado:** 2025-01-15
**Última actualización:** 2025-01-15

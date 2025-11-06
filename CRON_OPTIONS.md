# Opciones para Cron Jobs - Resúmenes Diarios

## Problema

Vercel Hobby (plan gratuito) solo permite cron jobs que se ejecuten **una vez al día**. Sin embargo, los usuarios pueden configurar diferentes horas para recibir su resumen diario.

## Soluciones Disponibles

### ✅ Opción 1: Usar Servicio Cron Externo (Recomendado)

Usar un servicio gratuito como [cron-job.org](https://cron-job.org) para ejecutar el endpoint cada hora:

**Configuración:**
1. Registrarse en [cron-job.org](https://cron-job.org) (gratis)
2. Crear un nuevo cron job:
   - **URL**: `https://tu-proyecto.vercel.app/api/cron/daily-summary`
   - **Schedule**: Cada hora (`0 * * * *`)
   - **Headers**:
     ```
     Authorization: Bearer tu-cron-secret-aqui
     ```
3. El servicio llamará tu endpoint cada hora
4. Tu código filtrará automáticamente qué usuarios necesitan el resumen en ese momento

**Ventajas:**
- ✅ Respeta las preferencias de hora de cada usuario
- ✅ Completamente gratis
- ✅ Configuración simple
- ✅ Puedes tener múltiples cron jobs

**Desventajas:**
- ❌ Depende de un servicio externo

---

### Opción 2: Vercel Cron (Limitado)

Usar el cron nativo de Vercel que se ejecuta una vez al día.

**Configuración Actual:**
```json
{
  "crons": [
    {
      "path": "/api/cron/daily-summary",
      "schedule": "0 0 * * *"
    }
  ]
}
```

**Limitaciones:**
- ⚠️ Se ejecuta solo a medianoche UTC (00:00 UTC)
- ⚠️ Los usuarios no pueden elegir su hora preferida
- ⚠️ Todos reciben el resumen a la misma hora

**Ventajas:**
- ✅ Integrado con Vercel
- ✅ Sin dependencias externas
- ✅ Gratis

---

### Opción 3: Upgrade a Vercel Pro

Actualizar a Vercel Pro ($20/mes) para desbloquear cron jobs ilimitados.

**Ventajas:**
- ✅ Cron jobs ilimitados
- ✅ Puedes ejecutar cada hora
- ✅ Completamente manejado por Vercel

**Desventajas:**
- ❌ $20/mes

---

## 🎯 Recomendación

**Usar Opción 1: cron-job.org** (gratis y respeta preferencias de usuario)

### Configuración Paso a Paso

1. **Registrarse en cron-job.org:**
   - Ve a https://cron-job.org
   - Crea una cuenta gratuita

2. **Obtener tu CRON_SECRET:**
   - Busca en tus variables de Vercel la variable `CRON_SECRET`
   - O genera una nueva:
     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
     ```

3. **Crear el Cron Job:**
   - En cron-job.org, clic en "Create Cronjob"
   - **Title**: "Daily Summary - Asistente IA"
   - **URL**: `https://tu-proyecto.vercel.app/api/cron/daily-summary`
   - **Schedule**:
     - Pattern: `0 * * * *` (cada hora)
     - O personalizado según necesites
   - **Request Method**: GET
   - **Headers**: Agregar header:
     - **Name**: `Authorization`
     - **Value**: `Bearer TU_CRON_SECRET_AQUI`
   - **Notifications**: Configura alertas si falla

4. **Activar:**
   - Clic en "Create"
   - El cron comenzará a ejecutarse automáticamente

5. **Verificar:**
   - Revisa los logs en cron-job.org
   - Revisa los logs en Vercel Dashboard

---

## Configuración Actual

El proyecto está configurado con:
- **vercel.json**: Cron una vez al día (00:00 UTC)
- **Endpoint**: `/api/cron/daily-summary`
- **Autenticación**: Bearer token con `CRON_SECRET`

### Si usas Vercel Cron (Opción 2):

El endpoint procesará **todos** los usuarios con resumen habilitado a las 00:00 UTC cada día.

### Si usas cron-job.org (Opción 1):

El endpoint se ejecutará cada hora y filtrará automáticamente qué usuarios necesitan su resumen según sus preferencias de hora y timezone.

---

## Migrar de Vercel Cron a cron-job.org

Si decides cambiar a cron-job.org:

1. Configura el cron job en cron-job.org (pasos arriba)
2. Puedes dejar el cron de Vercel como backup
3. O eliminar el cron de `vercel.json`:
   ```json
   {
     "buildCommand": "npm run build",
     "framework": "nextjs",
     "env": {
       "NODE_ENV": "production"
     },
     "regions": ["iad1"]
   }
   ```

---

## Alternativas Adicionales

### Otros Servicios Cron Gratuitos:
- [EasyCron](https://www.easycron.com) - 100 ejecuciones/día gratis
- [cron-job.de](https://cron-job.de) - Similar a cron-job.org
- [UptimeRobot](https://uptimerobot.com) - Monitor cada 5 min (puede usarse como cron)

### GitHub Actions (Avanzado):
Puedes crear un workflow de GitHub Actions que se ejecute cada hora y llame al endpoint. Esto es gratis en repositorios públicos.

---

## FAQ

**¿Qué pasa si no configuro un cron externo?**
- El cron de Vercel se ejecutará una vez al día (00:00 UTC)
- Todos los usuarios recibirán su resumen a la misma hora
- Las preferencias de hora configuradas por usuarios serán ignoradas

**¿Es seguro usar cron-job.org?**
- Sí, es un servicio legítimo usado por millones
- Tu endpoint está protegido por el `CRON_SECRET`
- Solo pueden ejecutarlo quienes tengan el secret

**¿Puedo probar el endpoint manualmente?**
- Sí, usa curl:
  ```bash
  curl -X GET https://tu-proyecto.vercel.app/api/cron/daily-summary \
    -H "Authorization: Bearer TU_CRON_SECRET"
  ```

**¿Los usuarios necesitan hacer algo?**
- No, los resúmenes se generan automáticamente
- Los usuarios solo configuran su hora preferida en `/settings`
- Los resúmenes se guardan en la base de datos

---

## Estado Actual del Proyecto

- ✅ Endpoint de cron implementado
- ✅ Protección con CRON_SECRET
- ✅ Soporte para Vercel Cron (header `x-vercel-cron`)
- ✅ Soporte para servicios externos (Bearer token)
- ✅ Filtrado por hora y timezone del usuario
- ✅ Tabla `user_preferences` en Supabase
- ⚠️ Limitado a 1 ejecución/día por Vercel Hobby

**Próximo paso**: Configurar cron-job.org o aceptar la limitación de Vercel Hobby.

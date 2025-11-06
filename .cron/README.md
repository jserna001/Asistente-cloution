# Configuración del Resumen Diario Automático

Este directorio contiene los scripts y configuraciones necesarios para ejecutar el resumen diario automáticamente cada día.

## 📋 Requisitos Previos

1. El servidor Next.js debe estar ejecutándose
2. La variable de entorno `CRON_SECRET` debe estar configurada
3. El usuario debe tener credenciales de Google configuradas en Supabase

## 🚀 Opciones de Configuración

### Opción 1: Vercel Cron Jobs (Recomendado para producción)

Si estás desplegando en Vercel, el archivo `vercel.json` ya está configurado para ejecutar el cron job automáticamente.

**Configuración:**
1. El archivo `vercel.json` en la raíz ya incluye la configuración
2. Vercel ejecutará `/api/cron/daily-summary` todos los días a las 7:00 AM UTC
3. No necesitas configurar `CRON_SECRET` para Vercel (usa el header `x-vercel-cron`)

**Verificar:**
- Ve a tu dashboard de Vercel > Proyecto > Crons
- Deberías ver el cron job programado

---

### Opción 2: Windows Task Scheduler

**Pasos:**

1. Abrir PowerShell como Administrador

2. Configurar la variable de entorno CRON_SECRET:
   ```powershell
   [Environment]::SetEnvironmentVariable("CRON_SECRET", "TU_CRON_SECRET_AQUI", "User")
   ```

3. Crear la tarea programada:
   ```powershell
   $action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-File C:\ruta\a\tu\proyecto\.cron\windows-task.ps1"
   $trigger = New-ScheduledTaskTrigger -Daily -At 7:00AM
   Register-ScheduledTask -TaskName "DailySummaryGeneration" -Action $action -Trigger $trigger -Description "Genera el resumen diario del asistente IA"
   ```

4. Verificar que la tarea se creó:
   ```powershell
   Get-ScheduledTask -TaskName "DailySummaryGeneration"
   ```

**Ejecutar manualmente para probar:**
```powershell
cd C:\ruta\a\tu\proyecto\.cron
.\windows-task.ps1
```

---

### Opción 3: Linux/Mac con Crontab

**Pasos:**

1. Hacer el script ejecutable:
   ```bash
   chmod +x .cron/linux-cron.sh
   ```

2. Configurar variables de entorno en tu shell profile (~/.bashrc o ~/.zshrc):
   ```bash
   export CRON_SECRET="TU_CRON_SECRET_AQUI"
   export BASE_URL="http://localhost:3000"  # O tu URL de producción
   ```

3. Abrir crontab:
   ```bash
   crontab -e
   ```

4. Agregar esta línea (ejecutar todos los días a las 7:00 AM):
   ```
   0 7 * * * /ruta/a/tu/proyecto/.cron/linux-cron.sh >> /var/log/daily-summary.log 2>&1
   ```

5. Guardar y salir

**Verificar que el cron job se agregó:**
```bash
crontab -l
```

**Ejecutar manualmente para probar:**
```bash
./.cron/linux-cron.sh
```

---

### Opción 4: GitHub Actions

Si tienes tu código en GitHub, puedes usar GitHub Actions para ejecutar el cron job.

**Pasos:**

1. Ve a tu repositorio en GitHub
2. Settings > Secrets and variables > Actions
3. Agregar estos secrets:
   - `CRON_SECRET`: Tu CRON_SECRET
   - `APP_URL`: La URL de tu aplicación (ej. https://tu-app.vercel.app)

4. El workflow en `.github/workflows/daily-summary.yml` ya está configurado

5. Verificar:
   - Ve a Actions > Daily Summary Generation
   - Deberías ver el workflow programado
   - Puedes ejecutarlo manualmente con "Run workflow"

---

### Opción 5: Dokku con Scheduler Plugin (Recomendado para servidor propio)

Si estás desplegando en un servidor Dokku, puedes usar el plugin scheduler para ejecutar cron jobs.

**Requisitos previos:**
1. Acceso SSH al servidor Dokku
2. Plugin scheduler instalado en Dokku

**Pasos:**

1. **Conectar al servidor Dokku por SSH:**
   ```bash
   ssh justine@192.168.80.17
   ```

2. **Instalar el plugin scheduler (si no está instalado):**
   ```bash
   sudo dokku plugin:install https://github.com/dokku/dokku-scheduler.git scheduler
   ```

3. **Configurar variables de entorno en Dokku:**
   ```bash
   dokku config:set asistente-ia CRON_SECRET="TU_CRON_SECRET_AQUI"
   dokku config:set asistente-ia APP_URL="http://tu-dominio.com"
   ```

4. **El archivo `cron.txt` en la raíz del proyecto ya está configurado:**
   - Dokku detecta automáticamente este archivo durante el deploy
   - El cron se ejecutará a las 7:00 AM hora del servidor

5. **Hacer el script ejecutable (se hace automáticamente en el deploy):**
   El archivo `.cron/dokku-cron.sh` ya tiene permisos de ejecución configurados

6. **Desplegar la aplicación:**
   ```bash
   git add .
   git commit -m "Agregar configuración de cron para Dokku"
   git push dokku master
   ```

7. **Verificar que el cron se instaló correctamente:**
   ```bash
   ssh justine@192.168.80.17
   dokku scheduler:report asistente-ia
   ```

8. **Ver logs del cron:**
   ```bash
   dokku logs asistente-ia --tail
   ```

**Ejecutar manualmente para probar (desde el servidor):**
```bash
ssh justine@192.168.80.17
dokku run asistente-ia /app/.cron/dokku-cron.sh
```

**Alternativa: Cron del sistema (sin scheduler plugin)**

Si no quieres usar el scheduler plugin, puedes configurar cron directamente en el servidor:

1. **Conectar al servidor:**
   ```bash
   ssh justine@192.168.80.17
   ```

2. **Editar crontab del usuario dokku:**
   ```bash
   sudo crontab -u dokku -e
   ```

3. **Agregar esta línea:**
   ```
   0 7 * * * dokku run asistente-ia /app/.cron/dokku-cron.sh >> /var/log/daily-summary.log 2>&1
   ```

4. **Guardar y salir**

---

### Opción 6: Servicios de Cron Externos

Puedes usar servicios como:
- **cron-job.org** (gratis)
- **EasyCron**
- **Zapier**

**Configuración:**

1. Registrarte en el servicio
2. Crear un nuevo cron job con:
   - URL: `https://tu-app.com/api/cron/daily-summary`
   - Método: GET
   - Headers: `Authorization: Bearer TU_CRON_SECRET_AQUI`
   - Horario: Todos los días a las 7:00 AM

---

## 🧪 Probar el Endpoint Manualmente

Puedes probar el endpoint con curl:

```bash
curl -H "Authorization: Bearer TU_CRON_SECRET_AQUI" \
     http://localhost:3000/api/cron/daily-summary
```

Deberías ver una respuesta JSON con:
```json
{
  "success": true,
  "message": "Resumen diario generado exitosamente",
  "summary": "...",
  "stats": {
    "calendarEvents": 3,
    "notionChunks": 5,
    "gmailChunks": 2
  }
}
```

---

## 🔍 Troubleshooting

### Error: "CRON_SECRET no configurado"
- Asegúrate de que la variable de entorno `CRON_SECRET` esté configurada
- En Vercel: Settings > Environment Variables
- En local: Archivo `.env.local`

### Error: "No autorizado"
- Verifica que el header `Authorization` sea correcto: `Bearer TU_CRON_SECRET`
- Asegúrate de que el CRON_SECRET coincida con el configurado

### Error: "No se encontraron credenciales"
- El usuario debe haber iniciado sesión con Google al menos una vez
- Verificar en Supabase que exista un registro en `user_credentials`

### El resumen no aparece en la app
- Verificar que el cron job se ejecutó exitosamente
- Comprobar en Supabase que existe un registro en `daily_summaries`
- La app carga el resumen más reciente al iniciar

---

## 📝 Notas

- **Hora recomendada**: 7:00 AM en tu zona horaria local
- **Frecuencia**: Una vez al día
- **Timeout**: El endpoint puede tardar 10-30 segundos en ejecutarse
- **Logs**: Revisar los logs del servidor para debugging

---

## 🔐 Seguridad

- **Nunca** compartas tu `CRON_SECRET`
- **No** subas `.env.local` al repositorio (ya está en `.gitignore`)
- Para producción, usa variables de entorno del servicio de hosting

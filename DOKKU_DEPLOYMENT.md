# Guía de Deployment en Dokku

Esta guía te ayudará a desplegar la aplicación en tu servidor Dokku y configurar el cron job para el resumen diario.

## 📋 Pre-requisitos

- Acceso SSH al servidor Dokku (justine@192.168.80.17)
- Git instalado localmente
- La aplicación ya debe estar configurada en Dokku

## 🚀 Pasos para el Deployment

### 1. Ejecutar las migraciones de base de datos

Primero, ejecuta la migración `migration_6.sql` en Supabase para crear la tabla de preferencias de usuario:

1. Ve a tu proyecto en Supabase: https://app.supabase.com
2. Ve a la sección "SQL Editor"
3. Copia y pega el contenido de `migration_6.sql`
4. Haz clic en "Run" para ejecutar la migración

### 2. Configurar el remoto de Dokku

Si aún no has configurado el remoto de Dokku, agrégalo:

```bash
git remote add dokku dokku@192.168.80.17:asistente-ia
```

Si ya existe, verifica que la URL sea correcta:

```bash
git remote -v
```

### 3. Configurar variables de entorno en Dokku

Conéctate al servidor y configura las variables de entorno necesarias:

```bash
ssh justine@192.168.80.17
```

Una vez conectado, ejecuta:

```bash
# Variables de Supabase
dokku config:set asistente-ia NEXT_PUBLIC_SUPABASE_URL="https://tu-proyecto.supabase.co"
dokku config:set asistente-ia NEXT_PUBLIC_SUPABASE_ANON_KEY="tu-anon-key"

# Variables de Google
dokku config:set asistente-ia GEMINI_API_KEY="tu-gemini-api-key"
dokku config:set asistente-ia GOOGLE_CLIENT_ID="tu-client-id"
dokku config:set asistente-ia GOOGLE_CLIENT_SECRET="tu-client-secret"

# Variable para Notion
dokku config:set asistente-ia NOTION_CLIENT_ID="tu-notion-client-id"
dokku config:set asistente-ia NOTION_CLIENT_SECRET="tu-notion-client-secret"

# Variable para encriptación de tokens
dokku config:set asistente-ia ENCRYPTION_KEY="tu-encryption-key-32-bytes"

# Variable para el cron job
dokku config:set asistente-ia CRON_SECRET="WPpkXpr8mxvd8znAULOfuTHlQneg2LvkD8XwYRUu/C8="

# URL de la aplicación (necesaria para el cron)
dokku config:set asistente-ia APP_URL="http://tu-dominio.com"
# O si usas IP:
# dokku config:set asistente-ia APP_URL="http://192.168.80.17:puerto"

# Variable para el browser service
dokku config:set asistente-ia BROWSER_SERVICE_URL="http://browser-service:3001"
```

### 4. Instalar el plugin de Scheduler (si no está instalado)

El plugin scheduler permite ejecutar cron jobs en Dokku:

```bash
sudo dokku plugin:install https://github.com/dokku/dokku-scheduler.git scheduler
```

### 5. Desplegar la aplicación

Desde tu máquina local, ejecuta:

```bash
git push dokku master
```

Dokku automáticamente:
- Detectará el archivo `cron.txt`
- Instalará el cron job
- Desplegará la aplicación

### 6. Verificar el deployment

Conéctate al servidor y verifica:

```bash
ssh justine@192.168.80.17

# Ver el estado de la aplicación
dokku ps:report asistente-ia

# Ver los cron jobs configurados
dokku scheduler:report asistente-ia

# Ver logs
dokku logs asistente-ia --tail
```

### 7. Probar el cron job manualmente

Para verificar que el cron job funciona correctamente:

```bash
ssh justine@192.168.80.17
dokku run asistente-ia /app/.cron/dokku-cron.sh
```

Deberías ver:

```
[fecha] - Ejecutando resumen diario...
[fecha] - ✓ Resumen generado exitosamente
```

### 8. Configurar el Browser Service

El browser service debe desplegarse como una aplicación separada:

```bash
ssh justine@192.168.80.17

# Crear la aplicación browser-service
dokku apps:create browser-service

# Exponer el puerto 3001
dokku proxy:ports-set browser-service http:3001:3001

# Desde tu máquina local, crear un subtree para browser-service
git subtree push --prefix browser-service dokku-browser master

# O alternativamente, crear un repositorio separado para browser-service
```

## 🔍 Troubleshooting

### El cron no se ejecuta

Verifica que el scheduler esté instalado:
```bash
dokku plugin:list | grep scheduler
```

Verifica los logs del cron:
```bash
dokku logs asistente-ia --tail | grep CRON
```

### Error "CRON_SECRET no configurado"

Asegúrate de que la variable de entorno esté configurada:
```bash
dokku config:get asistente-ia CRON_SECRET
```

### Error de conexión a Supabase

Verifica que las variables de Supabase estén configuradas:
```bash
dokku config:show asistente-ia | grep SUPABASE
```

### El resumen no se genera

1. Verifica que la migración se ejecutó correctamente en Supabase
2. Asegúrate de que el usuario tenga `daily_summary_enabled = true`
3. Verifica que la hora configurada coincida con la hora actual
4. Revisa los logs para errores:
   ```bash
   dokku logs asistente-ia --tail
   ```

## 📝 Notas importantes

- El cron se ejecuta **cada hora** (0 * * * *)
- El endpoint filtra usuarios según su hora configurada (±30 minutos de margen)
- Cada usuario puede configurar su propia hora y zona horaria desde la interfaz
- Los logs del cron se guardan en `/var/log/daily-summary.log` dentro del contenedor

## 🔄 Actualizaciones futuras

Para actualizar la aplicación:

```bash
git add .
git commit -m "Descripción de cambios"
git push dokku master
```

Dokku automáticamente:
- Reconstruirá la imagen
- Reiniciará la aplicación
- Actualizará los cron jobs si `cron.txt` cambió

## 🔐 Seguridad

- **Nunca** compartas las variables de entorno en repositorios públicos
- **Nunca** expongas el `CRON_SECRET` públicamente
- Las variables de entorno en Dokku están cifradas y solo accesibles dentro de la aplicación

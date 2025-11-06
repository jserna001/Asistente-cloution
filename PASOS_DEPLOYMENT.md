# 🚀 Pasos para Desplegar en Dokku - GUÍA RÁPIDA

Sigue estos pasos en orden para desplegar la aplicación con el sistema de resumen diario.

## ✅ Pre-requisitos (Ya completados)

- ✓ Código commiteado en git
- ✓ Remoto dokku configurado
- ✓ Archivos de configuración creados (cron.txt, scripts, etc.)

---

## 📝 PASO 1: Ejecutar la migración en Supabase

1. Ve a https://app.supabase.com
2. Selecciona tu proyecto
3. Ve a **SQL Editor** en el menú lateral
4. Abre el archivo `migration_6.sql` de este proyecto
5. Copia todo el contenido
6. Pégalo en el SQL Editor de Supabase
7. Haz clic en **Run** o presiona `Ctrl+Enter`

**Verificar**: Deberías ver la tabla `user_preferences` creada en la sección "Table Editor"

---

## 🔧 PASO 2: Configurar el servidor Dokku

### 2.1 Conectarte al servidor

Abre una terminal y ejecuta:

```bash
ssh justine@192.168.80.17
# Contraseña: Aguacate41*
```

### 2.2 Verificar/crear la aplicación

Una vez conectado al servidor:

```bash
# Verificar si existe
dokku apps:list

# Si NO existe, crearla:
dokku apps:create asistente-ia
```

### 2.3 Instalar el plugin scheduler

```bash
# Verificar si está instalado
dokku plugin:list | grep scheduler

# Si NO está instalado:
sudo dokku plugin:install https://github.com/dokku/dokku-scheduler.git scheduler
```

### 2.4 Configurar variables de entorno

**IMPORTANTE**: Reemplaza los valores de ejemplo con tus valores reales.

```bash
# Supabase (obtener de https://app.supabase.com/project/_/settings/api)
dokku config:set asistente-ia NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"
dokku config:set asistente-ia NEXT_PUBLIC_SUPABASE_ANON_KEY="tu-anon-key-aqui"

# Gemini (obtener de https://aistudio.google.com/apikey)
dokku config:set asistente-ia GEMINI_API_KEY="tu-gemini-api-key"

# Google OAuth (obtener de https://console.cloud.google.com/apis/credentials)
dokku config:set asistente-ia GOOGLE_CLIENT_ID="tu-client-id.apps.googleusercontent.com"
dokku config:set asistente-ia GOOGLE_CLIENT_SECRET="tu-client-secret"

# Notion OAuth (obtener de https://www.notion.so/my-integrations)
dokku config:set asistente-ia NOTION_CLIENT_ID="tu-notion-client-id"
dokku config:set asistente-ia NOTION_CLIENT_SECRET="tu-notion-client-secret"

# Encryption Key (generar uno nuevo con: openssl rand -base64 32)
dokku config:set asistente-ia ENCRYPTION_KEY="$(openssl rand -base64 32)"

# Cron Secret (ya generado)
dokku config:set asistente-ia CRON_SECRET="WPpkXpr8mxvd8znAULOfuTHlQneg2LvkD8XwYRUu/C8="

# URL de la aplicación (ajustar al dominio o IP:puerto que uses)
dokku config:set asistente-ia APP_URL="http://192.168.80.17:3000"

# Browser Service (si tienes el servicio desplegado)
dokku config:set asistente-ia BROWSER_SERVICE_URL="http://browser-service:3001"
```

### 2.5 Verificar la configuración

```bash
# Ver todas las variables configuradas
dokku config:show asistente-ia
```

### 2.6 Salir del servidor

```bash
exit
```

---

## 🚢 PASO 3: Desplegar la aplicación

Desde tu **máquina local** (no en el servidor):

```bash
# Asegúrate de estar en el directorio del proyecto
cd C:\Users\justi\Desktop\Asistente\asistente-ia-nuevo

# Hacer push a Dokku
git push dokku master
```

Esto puede tardar varios minutos. Dokku automáticamente:
- Construirá la imagen Docker
- Instalará dependencias
- Detectará el archivo `cron.txt` y configurará el cron job
- Iniciará la aplicación

---

## ✅ PASO 4: Verificar el deployment

Vuelve a conectarte al servidor:

```bash
ssh justine@192.168.80.17
```

### 4.1 Verificar que la app está corriendo

```bash
dokku ps:report asistente-ia
```

Deberías ver el estado como "running".

### 4.2 Verificar el cron job

```bash
dokku scheduler:report asistente-ia
```

Deberías ver una línea como:
```
0 * * * * /app/.cron/dokku-cron.sh >> /var/log/daily-summary.log 2>&1
```

### 4.3 Ver los logs

```bash
# Logs en tiempo real
dokku logs asistente-ia --tail

# O solo logs recientes
dokku logs asistente-ia -n 100
```

### 4.4 Probar el cron manualmente

```bash
# Ejecutar el cron manualmente para verificar
dokku run asistente-ia /app/.cron/dokku-cron.sh
```

Deberías ver:
```
[fecha] - Ejecutando resumen diario...
[fecha] - ✓ Resumen generado exitosamente
```

---

## 🌐 PASO 5: Configurar el dominio o puerto (opcional)

Si quieres acceder a la aplicación desde un dominio o puerto específico:

```bash
# Opción 1: Usar un dominio
dokku domains:add asistente-ia tudominio.com

# Opción 2: Cambiar el puerto
dokku proxy:ports-set asistente-ia http:80:3000

# Opción 3: Usar HTTPS con Let's Encrypt
dokku plugin:install https://github.com/dokku/dokku-letsencrypt.git
dokku letsencrypt:enable asistente-ia
```

---

## 🎉 PASO 6: Probar la aplicación

1. Abre tu navegador
2. Ve a la URL de tu aplicación (ejemplo: http://192.168.80.17)
3. Inicia sesión con Google
4. Ve a **Settings** (configuración)
5. Configura tu hora preferida para el resumen diario
6. Haz clic en **Guardar cambios**

---

## 🔍 Troubleshooting

### Error: "Application not found"
```bash
dokku apps:create asistente-ia
```

### Error al hacer git push
```bash
# Verificar el remoto
git remote -v

# Si no está configurado:
git remote add dokku dokku@192.168.80.17:asistente-ia
```

### La aplicación no inicia
```bash
# Ver logs detallados
dokku logs asistente-ia --tail

# Reconstruir la aplicación
dokku ps:rebuild asistente-ia
```

### El cron no se ejecuta
```bash
# Verificar que el scheduler esté instalado
dokku plugin:list | grep scheduler

# Ver los cron jobs
dokku scheduler:report asistente-ia

# Ejecutar manualmente para debugging
dokku run asistente-ia /app/.cron/dokku-cron.sh
```

---

## 📚 Recursos adicionales

- [Documentación de Dokku](https://dokku.com/docs/getting-started/installation/)
- [Plugin Scheduler](https://github.com/dokku/dokku-scheduler)
- Archivo `DOKKU_DEPLOYMENT.md` para más detalles
- Archivo `.cron/README.md` para información sobre cron jobs

---

## 🔄 Actualizaciones futuras

Para actualizar la aplicación en el futuro:

```bash
# 1. Hacer cambios en el código
# 2. Commit
git add .
git commit -m "Descripción de cambios"

# 3. Push a Dokku
git push dokku master
```

Dokku automáticamente reconstruirá y redesplegará la aplicación.

#!/bin/bash

# Script para configurar el servidor Dokku
# Ejecutar este script EN EL SERVIDOR Dokku después de conectarte por SSH

echo "=== Configuración del servidor Dokku para asistente-ia ==="
echo ""

# Verificar si la aplicación existe
if ! dokku apps:exists asistente-ia 2>/dev/null; then
    echo "Creando aplicación asistente-ia..."
    dokku apps:create asistente-ia
else
    echo "✓ La aplicación asistente-ia ya existe"
fi

# Verificar si el plugin scheduler está instalado
if ! dokku plugin:list | grep -q scheduler; then
    echo "Instalando plugin scheduler..."
    sudo dokku plugin:install https://github.com/dokku/dokku-scheduler.git scheduler
else
    echo "✓ Plugin scheduler ya instalado"
fi

echo ""
echo "=== Configurando variables de entorno ==="
echo ""
echo "IMPORTANTE: Debes reemplazar los valores de ejemplo con tus valores reales"
echo ""

# Aquí el usuario deberá reemplazar los valores
cat << 'ENVVARS'
# Ejecuta estos comandos UNO POR UNO, reemplazando los valores:

# Supabase
dokku config:set asistente-ia NEXT_PUBLIC_SUPABASE_URL="https://TU-PROYECTO.supabase.co"
dokku config:set asistente-ia NEXT_PUBLIC_SUPABASE_ANON_KEY="TU-ANON-KEY"

# Google
dokku config:set asistente-ia GEMINI_API_KEY="TU-GEMINI-API-KEY"
dokku config:set asistente-ia GOOGLE_CLIENT_ID="TU-GOOGLE-CLIENT-ID"
dokku config:set asistente-ia GOOGLE_CLIENT_SECRET="TU-GOOGLE-CLIENT-SECRET"

# Notion
dokku config:set asistente-ia NOTION_CLIENT_ID="TU-NOTION-CLIENT-ID"
dokku config:set asistente-ia NOTION_CLIENT_SECRET="TU-NOTION-CLIENT-SECRET"

# Encriptación (generar con: openssl rand -base64 32)
dokku config:set asistente-ia ENCRYPTION_KEY="TU-ENCRYPTION-KEY-32-BYTES"

# Cron Secret (ya generado)
dokku config:set asistente-ia CRON_SECRET="WPpkXpr8mxvd8znAULOfuTHlQneg2LvkD8XwYRUu/C8="

# URL de la aplicación (ajustar según tu configuración)
dokku config:set asistente-ia APP_URL="http://192.168.80.17:PUERTO"

# Browser Service URL (si está en el mismo servidor)
dokku config:set asistente-ia BROWSER_SERVICE_URL="http://browser-service:3001"

ENVVARS

echo ""
echo "=== Pasos siguientes ==="
echo "1. Ejecuta los comandos de arriba para configurar las variables de entorno"
echo "2. Sal del servidor (exit)"
echo "3. Desde tu máquina local, ejecuta: git push dokku master"
echo "4. Vuelve al servidor para verificar: dokku scheduler:report asistente-ia"
echo ""

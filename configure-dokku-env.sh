#!/bin/bash

# Script para configurar las variables de entorno en Dokku
# EJECUTAR ESTE SCRIPT EN EL SERVIDOR DOKKU después de conectarte por SSH:
# ssh justine@192.168.80.17
# Luego copia y pega estos comandos

echo "Configurando variables de entorno para asistente-ia en Dokku..."
echo ""

# Supabase
dokku config:set asistente-ia \
  NEXT_PUBLIC_SUPABASE_URL="tu-supabase-url" \
  NEXT_PUBLIC_SUPABASE_ANON_KEY="tu-supabase-anon-key"

echo "✓ Supabase configurado"

# Google OAuth y Gemini
dokku config:set asistente-ia \
  GOOGLE_CLIENT_ID="tu-google-client-id" \
  GOOGLE_CLIENT_SECRET="tu-google-client-secret" \
  GOOGLE_REDIRECT_URI="http://192.168.80.17:3000/api/auth/google/callback" \
  GEMINI_API_KEY="tu-gemini-api-key"

echo "✓ Google configurado"

# Notion
dokku config:set asistente-ia \
  NOTION_CLIENT_ID="tu-notion-client-id" \
  NOTION_CLIENT_SECRET="tu-notion-client-secret" \
  NOTION_INTERNAL_INTEGRATION_TOKEN="tu-notion-internal-integration-token"

echo "✓ Notion configurado"

# Encryption y Cron
dokku config:set asistente-ia \
  ENCRYPTION_KEY="tu-encryption-key-base64" \
  CRON_SECRET="tu-cron-secret-base64"

echo "✓ Encryption y Cron configurados"

# IMPORTANTE: Ajusta esta URL según el puerto que Dokku asigne a tu app
# Después del primer deploy, verifica con: dokku proxy:ports asistente-ia
echo ""
echo "IMPORTANTE: Configura la URL de tu aplicación"
echo "Ejecuta UNO de estos comandos según tu configuración:"
echo ""
echo "# Si usas un dominio:"
echo 'dokku config:set asistente-ia APP_URL="http://tu-dominio.com"'
echo ""
echo "# Si usas IP con puerto (verificar puerto después del primer deploy):"
echo 'dokku config:set asistente-ia APP_URL="http://192.168.80.17:PUERTO"'
echo ""
echo "# Browser service (configurar después de desplegar el browser-service):"
echo 'dokku config:set asistente-ia BROWSER_SERVICE_URL="http://browser-service:3001"'
echo ""
echo "=== Configuración de variables básicas completada ==="
echo ""
echo "Siguiente paso: Sal del servidor y ejecuta 'git push dokku master' desde tu máquina local"

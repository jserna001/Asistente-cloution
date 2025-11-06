#!/bin/bash

# Script de cron para Dokku
# Este script debe ser ejecutado por el scheduler de Dokku

# Configuración
APP_URL="${APP_URL:-http://localhost:3000}"
CRON_SECRET="${CRON_SECRET}"

# Verificar que CRON_SECRET esté configurado
if [ -z "$CRON_SECRET" ]; then
  echo "ERROR: CRON_SECRET no está configurado"
  exit 1
fi

# Ejecutar el endpoint de resumen diario
echo "$(date '+%Y-%m-%d %H:%M:%S') - Ejecutando resumen diario..."

response=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  "$APP_URL/api/cron/daily-summary")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "200" ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') - ✓ Resumen generado exitosamente"
  echo "$body"
else
  echo "$(date '+%Y-%m-%d %H:%M:%S') - ✗ Error (HTTP $http_code)"
  echo "$body"
  exit 1
fi

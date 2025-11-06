#!/bin/bash
# Script de Bash para ejecutar el resumen diario en Linux/Mac
# Agregar a crontab: 0 7 * * * /path/to/linux-cron.sh

# Configuración
BASE_URL="${BASE_URL:-http://localhost:3000}"
CRON_SECRET="${CRON_SECRET}"

if [ -z "$CRON_SECRET" ]; then
    echo "Error: CRON_SECRET no está definido"
    exit 1
fi

# Hacer la solicitud al endpoint
response=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer $CRON_SECRET" \
    "$BASE_URL/api/cron/daily-summary")

# Separar el body y el status code
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" == "200" ]; then
    echo "✓ Resumen diario generado exitosamente"
    echo "$body" | jq '.'
else
    echo "Error: HTTP $http_code"
    echo "$body"
    exit 1
fi

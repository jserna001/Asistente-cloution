#!/bin/bash

# Script para diagnosticar y arreglar el problema de plantillas de onboarding
# Uso: bash scripts/fix-onboarding.sh

echo "🔍 Diagnóstico del Sistema de Onboarding"
echo "========================================"
echo ""

# Verificar variables de entorno
echo "1️⃣ Verificando variables de entorno..."
if [ -f .env.local ]; then
    if grep -q "NEXT_PUBLIC_SUPABASE_URL" .env.local && grep -q "SUPABASE_SERVICE_ROLE_KEY" .env.local; then
        echo "   ✅ Variables de entorno configuradas"
    else
        echo "   ❌ Faltan variables de entorno en .env.local"
        exit 1
    fi
else
    echo "   ❌ No se encontró .env.local"
    exit 1
fi

echo ""
echo "2️⃣ Verificando dependencias..."
if [ -d "node_modules" ]; then
    echo "   ✅ node_modules existe"
else
    echo "   ⚠️  Instalando dependencias..."
    npm install
fi

echo ""
echo "3️⃣ Ejecutando seed del catálogo de plantillas..."
npx tsx scripts/seed-template-catalog.ts

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Seed completado exitosamente"
    echo ""
    echo "📋 Próximos pasos:"
    echo "   1. Reinicia tu servidor de desarrollo (npm run dev)"
    echo "   2. Ve a /settings y reconecta Notion si es necesario"
    echo "   3. El onboarding debería mostrar las 5 plantillas"
    echo ""
else
    echo ""
    echo "❌ Error ejecutando el seed"
    echo ""
    echo "Verifica:"
    echo "  - Que migration_8.sql se haya aplicado en Supabase"
    echo "  - Que las credenciales de Supabase sean correctas"
    echo "  - Revisa los logs arriba para más detalles"
    echo ""
    exit 1
fi

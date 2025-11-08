#!/bin/bash
# Script de diagnóstico para notion-mcp-wrapper en Dokku

echo "========================================="
echo "1. Estado de la app en Dokku"
echo "========================================="
dokku ps:report notion-mcp-wrapper

echo ""
echo "========================================="
echo "2. Configuración de puertos"
echo "========================================="
dokku proxy:report notion-mcp-wrapper

echo ""
echo "========================================="
echo "3. Logs recientes de la app"
echo "========================================="
dokku logs notion-mcp-wrapper --tail 20

echo ""
echo "========================================="
echo "4. Test: curl localhost:3002/health"
echo "========================================="
curl -s http://localhost:3002/health || echo "FALLÓ: No se puede acceder a localhost:3002"

echo ""
echo "========================================="
echo "5. Test: curl localhost:80/health"
echo "========================================="
curl -s http://localhost:80/health || echo "FALLÓ: No se puede acceder a localhost:80"

echo ""
echo "========================================="
echo "6. Test: curl via dominio Dokku"
echo "========================================="
curl -s http://notion-mcp-wrapper.cloution-servidor.local/health || echo "FALLÓ: No se puede acceder via dominio"

echo ""
echo "========================================="
echo "7. Procesos corriendo en el contenedor"
echo "========================================="
dokku ps:report notion-mcp-wrapper | grep -A 5 "Processes:"

echo ""
echo "========================================="
echo "8. Variables de entorno"
echo "========================================="
dokku config:show notion-mcp-wrapper

echo ""
echo "========================================="
echo "Diagnóstico completado"
echo "========================================="

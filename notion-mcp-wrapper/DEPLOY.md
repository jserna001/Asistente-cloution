# Guía Rápida de Despliegue en Dokku

## Prerequisitos

- Servidor Dokku configurado y accesible
- Acceso SSH al servidor
- Git instalado localmente

## Pasos de Despliegue

### 1. Preparar el Servidor Dokku

Conéctate a tu servidor Dokku vía SSH:

```bash
ssh root@your-dokku-server.com
```

Crea la aplicación:

```bash
dokku apps:create notion-mcp-wrapper
```

Configura los puertos (el wrapper corre en el puerto 3002):

```bash
dokku proxy:ports-set notion-mcp-wrapper http:80:3002
```

### 2. (Opcional) Configurar SSL

Si quieres HTTPS (recomendado):

```bash
# Instalar plugin de Let's Encrypt si no lo tienes
dokku plugin:install https://github.com/dokku/dokku-letsencrypt.git

# Configurar email para Let's Encrypt
dokku letsencrypt:set notion-mcp-wrapper email your-email@example.com

# Habilitar SSL
dokku letsencrypt:enable notion-mcp-wrapper

# Auto-renovación
dokku letsencrypt:cron-job --add
```

### 3. Deploy desde Local

En tu máquina local, navega al directorio `notion-mcp-wrapper`:

```bash
cd notion-mcp-wrapper
```

Inicializa git si no existe:

```bash
git init
git add .
git commit -m "Initial commit: Notion MCP Wrapper"
```

Agrega el remote de Dokku:

```bash
git remote add dokku dokku@your-dokku-server.com:notion-mcp-wrapper
```

Despliega:

```bash
git push dokku main
```

(Si tu rama principal se llama `master`, usa `git push dokku master:main`)

### 4. Verificar el Despliegue

Verifica que el servicio esté corriendo:

```bash
# Desde tu servidor Dokku
dokku ps:report notion-mcp-wrapper

# Ver logs
dokku logs notion-mcp-wrapper -t
```

Prueba el health endpoint:

```bash
# Sin SSL
curl http://notion-mcp-wrapper.your-domain.com/health

# Con SSL
curl https://notion-mcp-wrapper.your-domain.com/health
```

Respuesta esperada:
```json
{
  "status": "ok",
  "uptime": 42.123,
  "activeClients": 0,
  "timestamp": "2025-11-07T..."
}
```

### 5. Configurar Vercel

En el dashboard de Vercel, agrega la variable de entorno:

```
NOTION_MCP_WRAPPER_URL=https://notion-mcp-wrapper.your-domain.com/mcp
```

O sin SSL:
```
NOTION_MCP_WRAPPER_URL=http://notion-mcp-wrapper.your-domain.com/mcp
```

Redespliega tu app en Vercel para que tome la nueva variable.

### 6. Probar la Integración

Una vez desplegado en ambos lados, prueba desde tu app:

1. Ve a https://asistente-cloution.vercel.app
2. Prueba con: "Busca en Notion páginas sobre marketing"
3. Revisa los logs en Vercel y Dokku

**Logs de Vercel:**
```bash
vercel logs production
```

**Logs de Dokku:**
```bash
ssh root@your-dokku-server.com
dokku logs notion-mcp-wrapper -t
```

## Actualizaciones

Para actualizar el wrapper:

```bash
cd notion-mcp-wrapper

# Hacer cambios...
git add .
git commit -m "Update: ..."

# Deploy
git push dokku main
```

Dokku automáticamente:
1. Construirá la nueva imagen Docker
2. Hará rolling deployment
3. El servicio seguirá disponible durante el update

## Comandos Útiles

```bash
# Ver estado del servicio
dokku ps:report notion-mcp-wrapper

# Reiniciar servicio
dokku ps:restart notion-mcp-wrapper

# Ver variables de entorno
dokku config:show notion-mcp-wrapper

# Limpiar builds antiguos
dokku cleanup

# Ver uso de recursos
dokku resource:report notion-mcp-wrapper
```

## Troubleshooting

### El servicio no arranca

```bash
# Ver logs detallados
dokku logs notion-mcp-wrapper -t

# Ver procesos
dokku ps:report notion-mcp-wrapper
```

### Error al hacer push

```bash
# Verificar que el remote esté bien configurado
git remote -v

# Debería mostrar:
# dokku   dokku@your-server:notion-mcp-wrapper (fetch)
# dokku   dokku@your-server:notion-mcp-wrapper (push)
```

### Purgar y recrear app

```bash
# En el servidor Dokku
dokku apps:destroy notion-mcp-wrapper

# Recrear
dokku apps:create notion-mcp-wrapper
dokku proxy:ports-set notion-mcp-wrapper http:80:3002

# Volver a desplegar desde local
git push dokku main
```

## Monitoring Producción

### Verificar clientes activos

```bash
curl https://notion-mcp-wrapper.your-domain.com/health | jq
```

### Limpiar cache manualmente

```bash
curl -X POST https://notion-mcp-wrapper.your-domain.com/admin/clear-cache
```

### Ver métricas de uso

```bash
dokku resource:limit notion-mcp-wrapper
dokku resource:report notion-mcp-wrapper
```

## Seguridad

- ✅ El wrapper NO guarda tokens en disco
- ✅ Cada usuario tiene cliente MCP aislado
- ✅ Timeout automático de clientes inactivos
- ✅ Logs no incluyen tokens completos (solo primeros 10 chars)
- ✅ HTTPS recomendado para producción

¿Problemas? Revisa el README.md principal o los logs del servicio.

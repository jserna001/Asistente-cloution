# Deployment del Browser Service (Microservicio de Automatización)

## 📋 Descripción

El `browser-service` es un microservicio separado que proporciona capacidades de automatización del navegador usando Playwright. Este servicio **NO** puede correr en Vercel debido a las limitaciones de serverless functions, por lo que debe desplegarse en un servidor con Docker.

## 🏗️ Arquitectura

```
┌─────────────────────┐
│  Vercel             │
│  (Next.js App)      │
│  - Frontend         │
│  - API Routes       │
└──────────┬──────────┘
           │ HTTP
           │
           ▼
┌─────────────────────┐
│  Browser Service    │
│  (Docker)           │
│  - Playwright       │
│  - Fastify Server   │
└─────────────────────┘
```

## 🚀 Opciones de Deployment

### Opción 1: Servidor Dokku (192.168.80.17) - Recomendado

Ya tienes un servidor Dokku configurado. Esta es la opción más sencilla.

#### Pasos:

1. **Conectar al servidor por SSH:**
   ```bash
   ssh root@192.168.80.17
   ```

2. **Crear una nueva aplicación Dokku para el browser service:**
   ```bash
   dokku apps:create browser-service
   ```

3. **Configurar el puerto:**
   ```bash
   dokku proxy:ports-add browser-service http:80:3001
   ```

4. **En tu máquina local, agregar el remote de Dokku:**
   ```bash
   cd browser-service
   git init  # Si no está inicializado
   git add .
   git commit -m "Initial browser service"
   git remote add dokku-browser dokku@192.168.80.17:browser-service
   ```

5. **Hacer el deployment:**
   ```bash
   git push dokku-browser master
   ```

6. **Verificar que está corriendo:**
   ```bash
   ssh root@192.168.80.17
   docker ps | grep browser-service
   ```

7. **Obtener la URL del servicio:**
   La URL será: `http://192.168.80.17:3001` o `http://browser-service.192.168.80.17`

### Opción 2: Railway / Render

También puedes usar Railway o Render que soportan contenedores Docker:

#### Railway:

1. Ve a [Railway](https://railway.app)
2. Crea un nuevo proyecto
3. Selecciona "Deploy from GitHub repo"
4. Selecciona el directorio `browser-service`
5. Railway detectará el Dockerfile automáticamente
6. Configura el puerto: `3001`
7. Deploy

#### Render:

1. Ve a [Render](https://render.com)
2. Crea un nuevo "Web Service"
3. Conecta tu repositorio
4. Root Directory: `browser-service`
5. Environment: `Docker`
6. Port: `3001`
7. Deploy

### Opción 3: Docker en cualquier servidor

Si tienes acceso a cualquier servidor con Docker:

```bash
# Clonar el repositorio
git clone [tu-repo]
cd asistente-ia-nuevo/browser-service

# Construir la imagen
docker build -t browser-service .

# Ejecutar el contenedor
docker run -d \
  --name browser-service \
  -p 3001:3001 \
  --restart unless-stopped \
  browser-service

# Verificar que está corriendo
docker logs browser-service
```

## ⚙️ Configuración en Vercel

Una vez que tengas el browser service corriendo, necesitas configurar la URL en Vercel:

1. Ve a tu proyecto en Vercel Dashboard
2. Settings → Environment Variables
3. Agrega una nueva variable:
   ```
   Nombre: BROWSER_SERVICE_URL
   Valor: http://192.168.80.17:3001  (o la URL de tu servicio)
   Environments: Production, Preview, Development
   ```

4. Redeploy tu aplicación en Vercel

## 🔒 Seguridad (Importante)

### Opción A: Red Privada (Recomendado)

Si tu browser service y Vercel están en la misma red privada:
- Usa URLs internas: `http://browser-service:3001`
- No expongas el puerto públicamente

### Opción B: Autenticación con Token

Si el browser service está expuesto públicamente, debes agregar autenticación:

1. **Modificar el browser service para requerir un token:**

   Edita `browser-service/index.js` y agrega:
   ```javascript
   const AUTH_TOKEN = process.env.BROWSER_SERVICE_TOKEN || 'change-me';

   server.addHook('preHandler', async (request, reply) => {
     const token = request.headers['authorization'];
     if (token !== `Bearer ${AUTH_TOKEN}`) {
       reply.code(401).send({ error: 'Unauthorized' });
     }
   });
   ```

2. **Configurar el token en Dokku/Railway/Render:**
   ```bash
   dokku config:set browser-service BROWSER_SERVICE_TOKEN=tu-token-secreto-aqui
   ```

3. **Actualizar `lib/browserService.ts` para enviar el token:**
   ```typescript
   const response = await fetch(`${BROWSER_SERVICE_URL}/session/execute`, {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'Authorization': `Bearer ${process.env.BROWSER_SERVICE_TOKEN}`
     },
     body: JSON.stringify({ ... }),
   });
   ```

4. **Agregar la variable en Vercel:**
   ```
   BROWSER_SERVICE_TOKEN=tu-token-secreto-aqui
   ```

### Opción C: IP Whitelisting

Si usas Railway/Render, puedes obtener las IPs de Vercel y hacer whitelist:
- [IPs de Vercel](https://vercel.com/docs/concepts/edge-network/headers#x-forwarded-for)

## ✅ Verificación

Para verificar que todo funciona:

1. **Probar el browser service directamente:**
   ```bash
   curl -X POST http://[tu-url]:3001/session/create \
     -H "Content-Type: application/json" \
     -d '{}'
   ```

   Deberías recibir un sessionId.

2. **Probar desde tu aplicación:**
   - Ve a tu aplicación en Vercel
   - Envía un mensaje al chat que requiera navegación web
   - Revisa los logs en Vercel para ver si se comunica correctamente

## 🐛 Troubleshooting

### Error: "ECONNREFUSED"

**Causa**: La aplicación en Vercel no puede conectarse al browser service.

**Solución**:
1. Verifica que el browser service esté corriendo: `docker ps`
2. Verifica que la URL en `BROWSER_SERVICE_URL` sea correcta
3. Si usas `localhost`, cámbiala a la IP pública o dominio

### Error: "Session not found"

**Causa**: El browser service se reinició y perdió las sesiones en memoria.

**Solución**: Esto es normal. La aplicación creará automáticamente una nueva sesión.

### Logs del Browser Service

```bash
# Si usas Docker directamente
docker logs browser-service -f

# Si usas Dokku
ssh root@192.168.80.17
dokku logs browser-service -f
```

## 📊 Monitoreo

Es recomendable monitorear el browser service porque consume recursos:

### Uso de Recursos

```bash
docker stats browser-service
```

### Health Check

Puedes agregar un endpoint de health check al browser service:

```javascript
// En browser-service/index.js
server.get('/health', async (request, reply) => {
  return { status: 'ok', sessions: sessionManager.getSessionCount() };
});
```

## 🔄 Actualizaciones

Para actualizar el browser service:

```bash
cd browser-service
git add .
git commit -m "Update browser service"
git push dokku-browser master
```

Dokku automáticamente reconstruirá y redeployará el contenedor.

---

## 📞 Soporte

Si tienes problemas:
- Revisa los logs del contenedor
- Verifica la conectividad de red entre Vercel y tu servidor
- Asegúrate de que el puerto 3001 esté abierto en el firewall

# Variables de Entorno para Vercel

Copia y pega estas variables en Vercel Dashboard antes de hacer deploy.

## 🔑 Variables Críticas

### Browser Service
```
BROWSER_SERVICE_URL=http://192.168.80.17:3001
```

### Encryption & Security
```
ENCRYPTION_KEY=tu-encryption-key-aqui
CRON_SECRET=tu-cron-secret-aqui
```

Para generar nuevas claves:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## 📦 Supabase

```
NEXT_PUBLIC_SUPABASE_URL=tu-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-supabase-service-role-key
```

**Obtener en**: Supabase Dashboard → Settings → API

## 🔐 Google OAuth

```
GOOGLE_CLIENT_ID=tu-google-client-id
GOOGLE_CLIENT_SECRET=tu-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

**Obtener en**: [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials

**NOTA**: Después del primer deploy, cambiarás `GOOGLE_REDIRECT_URI` a tu URL de Vercel.

## 📝 Notion OAuth

```
NOTION_CLIENT_ID=tu-notion-client-id
NOTION_CLIENT_SECRET=tu-notion-client-secret
NOTION_INTERNAL_INTEGRATION_TOKEN=tu-notion-internal-integration-token
```

**Obtener en**: [Notion Developers](https://www.notion.so/my-integrations)

## 🤖 Gemini AI

```
GEMINI_API_KEY=tu-gemini-api-key
```

**Obtener en**: [Google AI Studio](https://aistudio.google.com/app/apikey)

---

## ✅ Checklist

- [ ] `BROWSER_SERVICE_URL` configurada (http://192.168.80.17:3001)
- [ ] `ENCRYPTION_KEY` generada
- [ ] `CRON_SECRET` generada
- [ ] Credenciales de Supabase (URL, ANON_KEY, SERVICE_ROLE_KEY)
- [ ] Credenciales de Google OAuth (CLIENT_ID, CLIENT_SECRET)
- [ ] Credenciales de Notion (CLIENT_ID, CLIENT_SECRET, TOKEN)
- [ ] `GEMINI_API_KEY` configurada

## 📝 Notas Importantes

1. **Todas las variables deben estar configuradas** para "Production", "Preview" y "Development"
2. **Service Role Key de Supabase** es diferente al ANON_KEY - asegúrate de usar el correcto
3. **Después del deployment**, necesitarás actualizar:
   - `GOOGLE_REDIRECT_URI` con tu URL de Vercel
   - OAuth callbacks en Google Cloud Console
   - OAuth callbacks en Notion

## 🔄 Post-Deployment

Una vez deployed, obtendrás una URL como: `https://tu-proyecto.vercel.app`

Necesitarás actualizar:

1. **En Vercel (Settings → Environment Variables):**
   - Cambiar `GOOGLE_REDIRECT_URI` a: `https://tu-proyecto.vercel.app/api/auth/google/callback`
   - Redeploy

2. **En Google Cloud Console:**
   - Authorized redirect URIs: Agregar `https://tu-proyecto.vercel.app/api/auth/google/callback`

3. **En Notion:**
   - Redirect URIs: Agregar `https://tu-proyecto.vercel.app/api/auth/notion/callback`

import { NextResponse, NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const NOTION_CLIENT_ID = process.env.NOTION_CLIENT_ID;

  if (!NOTION_CLIENT_ID) {
    return NextResponse.json({ error: 'NOTION_CLIENT_ID no está definido en las variables de entorno.' }, { status: 500 });
  }

  // Determinar la URI de redirección de forma dinámica basada en el host actual
  const host = req.headers.get('host');
  const protocol = req.headers.get('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https');
  const redirectUri = `${protocol}://${host}/api/auth/notion/callback`;

  // Leer el parámetro 'from' para saber de dónde viene el usuario
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from') || 'settings'; // Default a settings

  console.log('[NOTION-REDIRECT] Host:', host);
  console.log('[NOTION-REDIRECT] Protocol:', protocol);
  console.log('[NOTION-REDIRECT] Redirect URI:', redirectUri);
  console.log('[NOTION-REDIRECT] Origin:', from);

  // Construir la URL de autorización de Notion
  const notionAuthUrl = new URL('https://api.notion.com/v1/oauth/authorize');
  notionAuthUrl.searchParams.set('client_id', NOTION_CLIENT_ID);
  notionAuthUrl.searchParams.set('redirect_uri', redirectUri);
  notionAuthUrl.searchParams.set('response_type', 'code');
  notionAuthUrl.searchParams.set('owner', 'user');
  // Pasar el origen en el state para recuperarlo en el callback
  notionAuthUrl.searchParams.set('state', from);

  // Redirigir al usuario a la URL de autorización de Notion
  return NextResponse.redirect(notionAuthUrl.toString());
}

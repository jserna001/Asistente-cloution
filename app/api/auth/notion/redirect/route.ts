import { NextResponse, NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const NOTION_CLIENT_ID = process.env.NOTION_CLIENT_ID;

  if (!NOTION_CLIENT_ID) {
    return NextResponse.json({ error: 'NOTION_CLIENT_ID no está definido en las variables de entorno.' }, { status: 500 });
  }

  // Determinar la URI de redirección basada en el entorno
  const redirectUri = process.env.NODE_ENV === 'production'
    ? 'https://asistente-justine.cloution.cloud/api/auth/notion/callback'
    : 'http://localhost:3000/api/auth/notion/callback';

  // Construir la URL de autorización de Notion
  const notionAuthUrl = new URL('https://api.notion.com/v1/oauth/authorize');
  notionAuthUrl.searchParams.set('client_id', NOTION_CLIENT_ID);
  notionAuthUrl.searchParams.set('redirect_uri', redirectUri);
  notionAuthUrl.searchParams.set('response_type', 'code');
  notionAuthUrl.searchParams.set('owner', 'user');

  // Redirigir al usuario a la URL de autorización de Notion
  return NextResponse.redirect(notionAuthUrl.toString());
}

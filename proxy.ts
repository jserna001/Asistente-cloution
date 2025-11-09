import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(req: NextRequest) {
  const res = NextResponse.next()

  // 1. Crear un cliente de Supabase para el middleware.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          req.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          req.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // 2. Obtener el usuario de forma segura.
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = req.nextUrl

  // 3. Lógica de Redirección
  // 3.1. Si el usuario no está logueado y no está en la página de login, redirigir a /login.
  if (!user && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // 3.2. Si el usuario está logueado y está en la página de login, redirigir a la raíz.
  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/', req.url))
  }

  // 3.3. Permitir acceso a /onboarding para usuarios autenticados
  // El onboarding ya maneja su propia lógica de verificación
  if (user && pathname === '/onboarding') {
    return res
  }

  // 4. Si ninguna de las condiciones anteriores se cumple, continuar con la respuesta normal.
  return res
}

// 5. Configuración del Matcher
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}

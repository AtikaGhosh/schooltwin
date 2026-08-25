import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const productionProtectedPrefixes = [
  '/home',
  '/tasks',
  '/twin',
  '/report',
  '/submissions',
  '/capture',
  '/facility-pulse',
  '/admin',
  '/pair-device',
]

export async function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID())
  const requestHeaders = new Headers(request.headers)
  const csp = contentSecurityPolicy(nonce)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  if (process.env.NEXT_PUBLIC_SCHOOLTWIN_MODE !== 'production') {
    const demoResponse = NextResponse.next({
      request: { headers: requestHeaders },
    })
    demoResponse.headers.set('Content-Security-Policy', csp)
    return demoResponse
  }

  let response = NextResponse.next({ request: { headers: requestHeaders } })
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key)
    return NextResponse.redirect(new URL('/login?error=config', request.url))

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(items) {
        for (const item of items) request.cookies.set(item.name, item.value)
        response = NextResponse.next({ request: { headers: requestHeaders } })
        for (const item of items)
          response.cookies.set(item.name, item.value, item.options)
      },
    },
  })
  const { data } = await supabase.auth.getClaims()
  const signedIn = Boolean(data?.claims?.sub)
  const path = request.nextUrl.pathname
  const protectedRoute = productionProtectedPrefixes.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  )

  if (protectedRoute && !signedIn) {
    const login = new URL('/login', request.url)
    login.searchParams.set('next', path)
    return NextResponse.redirect(login)
  }
  if (path === '/login' && signedIn)
    return NextResponse.redirect(new URL('/home', request.url))
  response.headers.set('Content-Security-Policy', csp)
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set(
    'Permissions-Policy',
    'camera=(self), microphone=(), geolocation=()',
  )
  return response
}

function contentSecurityPolicy(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development'
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const storageUrl = supabaseUrl.replace('.supabase.co', '.storage.supabase.co')
  const websocketUrl = supabaseUrl.replace(/^http/, 'ws')
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' blob: data:",
    "font-src 'self' data:",
    `connect-src 'self' ${supabaseUrl} ${storageUrl} ${websocketUrl}`,
    `media-src 'self' blob: ${storageUrl}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ')
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

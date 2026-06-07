import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

const ADMIN_IP = '188.76.183.5'

function getClientIP(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (request as any).ip ?? null
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname
  const isLoginPage = pathname.startsWith('/login')
  const isEmpleadoRoute = pathname.startsWith('/empleado')

  // ── 1. /login is always accessible from any IP ────────────────
  if (isLoginPage) {
    if (user) {
      const rol = request.cookies.get('user_rol')?.value
      if (!rol) {
        // Cookie missing: let the user log in again to re-establish role.
        return supabaseResponse
      }
      // Admin with wrong IP: stay on login so the error message is visible.
      if (rol === 'admin') {
        const clientIP = getClientIP(request)
        if (clientIP !== null && clientIP !== ADMIN_IP) {
          return supabaseResponse
        }
      }
      // Authenticated with role → redirect to their home
      const url = request.nextUrl.clone()
      url.pathname = rol === 'empleado' ? '/empleado/inicio' : '/'
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // ── 2. All other routes require authentication ─────────────────
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // ── 3. Authenticated user on a non-login route ─────────────────
  const rol = request.cookies.get('user_rol')?.value

  // Cookie missing (e.g. expired while Supabase session was still valid):
  // redirect to login so they re-authenticate and the cookie is re-set.
  if (!rol) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // ── 4. IP restriction — only for confirmed admin role ──────────
  // Employees are never subject to this check.
  // Skip if IP cannot be determined (local development without proxy headers).
  if (rol === 'admin') {
    const clientIP = getClientIP(request)
    if (clientIP !== null && clientIP !== ADMIN_IP) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('error', 'ip_restringida')
      return NextResponse.redirect(url)
    }
  }

  // ── 5. Route / role access control ────────────────────────────
  if (isEmpleadoRoute && rol !== 'empleado') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }
  if (!isEmpleadoRoute && rol === 'empleado') {
    const url = request.nextUrl.clone()
    url.pathname = '/empleado/inicio'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|logo\\.jpg|.*\\.png).*)'],
}

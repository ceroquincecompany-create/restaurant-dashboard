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

  // Not authenticated → login
  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user) {
    const rol = request.cookies.get('user_rol')?.value ?? 'admin'

    // IP restriction: admins can only access from the authorized device.
    // Skip if IP cannot be determined (local development without proxy headers).
    if (rol === 'admin') {
      const clientIP = getClientIP(request)
      if (clientIP !== null && clientIP !== ADMIN_IP) {
        if (isLoginPage) {
          // Allow staying on login page so the error message is visible — no redirect loop.
          return supabaseResponse
        }
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        url.searchParams.set('error', 'ip_restringida')
        return NextResponse.redirect(url)
      }
    }

    // Authenticated on login → redirect to correct home
    if (isLoginPage) {
      const url = request.nextUrl.clone()
      url.pathname = rol === 'empleado' ? '/empleado/inicio' : '/'
      return NextResponse.redirect(url)
    }

    // Admin trying to access /empleado routes → back to admin
    if (isEmpleadoRoute && rol !== 'empleado') {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }

    // Employee trying to access admin routes → employee home
    if (!isEmpleadoRoute && rol === 'empleado') {
      const url = request.nextUrl.clone()
      url.pathname = '/empleado/inicio'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|logo\\.jpg|.*\\.png).*)'],
}

import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

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
    // Read role cookie set during login
    const rol = request.cookies.get('user_rol')?.value ?? 'admin'

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

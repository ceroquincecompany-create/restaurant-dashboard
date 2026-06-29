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
  const { pathname, searchParams } = request.nextUrl
  const isLoginPage = pathname.startsWith('/login')
  const isTrabajoPage = pathname.startsWith('/trabajo')
  const isEmpleadoRoute = pathname.startsWith('/empleado')
  const rol = request.cookies.get('user_rol')?.value

  if (process.env.NODE_ENV === 'development') {
    console.log(`[MW] ${pathname} | user=${!!user} | rol=${rol ?? 'none'} | isLogin=${isLoginPage} | isEmpleado=${isEmpleadoRoute}`)
  }

  // ── 0. /trabajo siempre accesible (página pública) ───────────
  if (isTrabajoPage) return supabaseResponse

  // ── 1. /login siempre accesible ───────────────────────────────
  if (isLoginPage) {
    if (user) {
      // Si venimos aquí con ?error (ej. restricción IP desde el server component),
      // quedarse en /login — redirigir sería bucle infinito con (admin)/layout.tsx.
      if (searchParams.has('error')) return supabaseResponse
      // Sin cookie de rol → dejar re-autenticar
      if (!rol) return supabaseResponse
      // Con cookie → redirigir a su home
      const url = request.nextUrl.clone()
      url.pathname = rol === 'empleado' ? '/empleado/inicio' : '/'
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // ── 2. Sin sesión → /login ────────────────────────────────────
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // ── 3. Rutas /empleado/* ──────────────────────────────────────
  // Con sesión válida NUNCA redirigir a /login.
  // Solo bloquear si la cookie dice explícitamente un rol que no es empleado.
  if (isEmpleadoRoute) {
    if (rol && rol !== 'empleado') {
      // Admin intentando rutas de empleado → a su home
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // ── 4. Rutas admin ────────────────────────────────────────────
  // Cookie ausente → forzar re-login para regenerarla
  if (!rol) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }
  // Empleado intentando rutas admin → a su home
  if (rol === 'empleado') {
    const url = request.nextUrl.clone()
    url.pathname = '/empleado/inicio'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|logo\\.jpg|.*\\.png|api/).*)'],
}

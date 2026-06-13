import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY      = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY

// Chars fáciles de leer y escribir (sin 0/O, 1/l/I)
const SAFE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
function generarPassword(len = 10): string {
  let pwd = ''
  for (let i = 0; i < len; i++) {
    pwd += SAFE_CHARS[Math.floor(Math.random() * SAFE_CHARS.length)]
  }
  return pwd
}

async function verificarAdmin(): Promise<boolean> {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(SUPABASE_URL, ANON_KEY, {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    })
    const { data: { user } } = await supabase.auth.getUser()
    return !!user
  } catch { return false }
}

export async function POST(request: Request) {
  // Verificar que el llamante está autenticado
  const esAdmin = await verificarAdmin()
  if (!esAdmin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // Si no hay service_role key, devolver flag para mostrar instrucciones manuales
  if (!SERVICE_KEY) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY no configurada', manual: true },
      { status: 503 }
    )
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const body = await request.json()
  const { action, email, newEmail } = body as {
    action: 'reset_password' | 'create_user' | 'change_email'
    email?: string
    newEmail?: string
  }

  if (!action) {
    return NextResponse.json({ error: 'action requerida' }, { status: 400 })
  }

  // ── Buscar usuario por email en auth ──────────────────────
  async function buscarPorEmail(mail: string) {
    const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 })
    return users.find(u => u.email?.toLowerCase() === mail.toLowerCase()) ?? null
  }

  // ── RESETEAR CONTRASEÑA ───────────────────────────────────
  if (action === 'reset_password') {
    if (!email) return NextResponse.json({ error: 'email requerido' }, { status: 400 })

    const pwd = generarPassword()
    const existente = await buscarPorEmail(email)

    if (existente) {
      const { error } = await admin.auth.admin.updateUserById(existente.id, { password: pwd })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    } else {
      // El usuario no existe en auth todavía — lo creamos
      const { error } = await admin.auth.admin.createUser({
        email,
        password: pwd,
        email_confirm: true,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ password: pwd })
  }

  // ── CREAR ACCESO (primer acceso) ──────────────────────────
  if (action === 'create_user') {
    if (!email) return NextResponse.json({ error: 'email requerido' }, { status: 400 })

    const pwd = generarPassword()
    const existente = await buscarPorEmail(email)

    if (existente) {
      // Ya existe en auth: solo actualizamos la contraseña
      const { error } = await admin.auth.admin.updateUserById(existente.id, { password: pwd })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    } else {
      const { error } = await admin.auth.admin.createUser({
        email,
        password: pwd,
        email_confirm: true,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ password: pwd })
  }

  // ── CAMBIAR EMAIL ─────────────────────────────────────────
  if (action === 'change_email') {
    if (!email || !newEmail) return NextResponse.json({ error: 'email y newEmail requeridos' }, { status: 400 })

    const existente = await buscarPorEmail(email)
    if (!existente) {
      return NextResponse.json({ error: 'Usuario no encontrado en Supabase Auth' }, { status: 404 })
    }

    const { error } = await admin.auth.admin.updateUserById(existente.id, {
      email: newEmail,
      email_confirm: true,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'action no reconocida' }, { status: 400 })
}

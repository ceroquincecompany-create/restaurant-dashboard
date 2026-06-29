import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { parsearCierreCaja } from '@/lib/parsear-cierre-caja'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function POST(request: Request) {
  let body: { text?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const text = body?.text?.trim()
  if (!text) {
    return NextResponse.json({ error: 'Campo "text" requerido' }, { status: 400 })
  }

  const parsed = parsearCierreCaja(text)

  const db = createClient(SUPABASE_URL, SERVICE_KEY ?? ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error } = await db.from('cierres_caja').upsert(
    { ...parsed, raw_email: text.length > 50000 ? text.slice(0, 50000) : text },
    { onConflict: 'numero_sesion', ignoreDuplicates: true }
  )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, sesion: parsed.numero_sesion })
}

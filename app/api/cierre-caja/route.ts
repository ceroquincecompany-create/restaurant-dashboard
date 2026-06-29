import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { parsearCierreCaja } from '@/lib/parsear-cierre-caja'

const SUPABASE_URL    = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY        = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const WEBHOOK_SECRET  = process.env.RESEND_WEBHOOK_SECRET ?? ''
const RECIPIENT_EMAIL = 'cierres@cierres.lasofi.es'

// ─── Svix webhook signature verification ─────────────────────
function verificarFirma(rawBody: string, headers: Headers): boolean {
  if (!WEBHOOK_SECRET) return true
  const msgId = headers.get('svix-id') ?? ''
  const msgTs = headers.get('svix-timestamp') ?? ''
  const msgSig = headers.get('svix-signature') ?? ''
  if (!msgId || !msgTs || !msgSig) return false

  const ts = parseInt(msgTs, 10)
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - ts) > 300) return false

  const toVerify    = `${msgId}.${msgTs}.${rawBody}`
  const secretBytes = Buffer.from(WEBHOOK_SECRET.replace(/^whsec_/, ''), 'base64')
  const computed    = crypto.createHmac('sha256', secretBytes).update(toVerify).digest('base64')

  return msgSig
    .split(' ')
    .map(s => s.split(',')[1])
    .filter(Boolean)
    .some(s => s === computed)
}

// ─── POST handler (webhook fallback) ─────────────────────────
export async function POST(request: Request) {
  const rawBody = await request.text()

  if (!verificarFirma(rawBody, request.headers)) {
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
  }

  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const emailData = payload?.data ?? payload

  const recipients: string[] = Array.isArray(emailData?.to)
    ? emailData.to
    : typeof emailData?.to === 'string'
      ? [emailData.to]
      : []
  if (recipients.length > 0 && !recipients.some((r: string) => r.includes(RECIPIENT_EMAIL))) {
    console.warn('[cierre-caja] destinatario inesperado:', recipients)
  }

  const textBody: string =
    emailData?.text ??
    emailData?.plain_text ??
    (emailData?.html ?? '').replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, '\n') ??
    ''

  if (!textBody.trim()) {
    return NextResponse.json({ error: 'Email sin contenido de texto' }, { status: 400 })
  }

  const parsed = parsearCierreCaja(textBody)

  const db = createClient(SUPABASE_URL, SERVICE_KEY ?? ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error } = await db.from('cierres_caja').upsert(
    {
      ...parsed,
      raw_email: rawBody.length > 50000 ? rawBody.slice(0, 50000) : rawBody,
    },
    { onConflict: 'numero_sesion', ignoreDuplicates: true }
  )

  if (error) {
    console.error('[cierre-caja]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, sesion: parsed.numero_sesion })
}

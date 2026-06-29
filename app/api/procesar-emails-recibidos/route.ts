import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { parsearCierreCaja } from '@/lib/parsear-cierre-caja'

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY      = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const RESEND_API_KEY = process.env.RESEND_API_KEY ?? ''

// Palabras clave que identifican emails de cierre de caja de Qamarero
const CIERRE_SUBJECT_KEYS = ['RESUMEN DE LA SESIÓN', 'RESUMEN DE LA SESION', 'CIERRE DE SESIÓN', 'CIERRE DE SESION']
const CIERRE_FROM_KEYS    = ['qamarero']

function esCierreCaja(subject: string, from: string): boolean {
  const subjectUp = subject.toUpperCase()
  const fromLow   = from.toLowerCase()
  return (
    CIERRE_SUBJECT_KEYS.some(k => subjectUp.includes(k.toUpperCase())) ||
    CIERRE_FROM_KEYS.some(k => fromLow.includes(k))
  )
}

function textoDesdeEmail(email: ResendEmail): string {
  const text = email.text ?? email.plain_text ?? ''
  if (text.trim()) return text
  const html  = email.html ?? ''
  return html.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, '\n').trim()
}

interface ResendEmail {
  id: string
  from: string
  to: string | string[]
  subject: string
  text?: string
  plain_text?: string
  html?: string
  created_at?: string
}

export async function GET() {
  if (!RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY no configurada' }, { status: 503 })
  }

  // ── 1. Obtener emails recibidos desde Resend ─────────────────
  let emails: ResendEmail[] = []
  try {
    const res = await fetch('https://api.resend.com/emails/receiving', {
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      const body = await res.text()
      console.error('[procesar-emails] Resend API error:', res.status, body)
      return NextResponse.json(
        { error: `Resend API devolvió ${res.status}`, detail: body },
        { status: 502 }
      )
    }

    const data = await res.json()
    // Resend puede devolver { data: [...] } o directamente un array
    emails = Array.isArray(data) ? data : (data?.data ?? data?.emails ?? [])
  } catch (err: any) {
    console.error('[procesar-emails] fetch error:', err.message)
    return NextResponse.json({ error: 'Error conectando con Resend', detail: err.message }, { status: 502 })
  }

  if (emails.length === 0) {
    return NextResponse.json({ ok: true, procesados: 0, omitidos: 0, total: 0 })
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY ?? ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ── 2. Identificar emails ya procesados ──────────────────────
  const ids = emails.map(e => e.id)
  const { data: yaVistos } = await db
    .from('emails_procesados')
    .select('id_resend')
    .in('id_resend', ids)

  const yaVistosSet = new Set((yaVistos ?? []).map((r: any) => r.id_resend as string))

  // ── 3. Procesar los nuevos ───────────────────────────────────
  let procesados = 0
  let omitidos   = 0
  const errores: string[] = []

  for (const email of emails) {
    if (yaVistosSet.has(email.id)) {
      omitidos++
      continue
    }

    const subject  = email.subject ?? ''
    const remitente = Array.isArray(email.from) ? email.from[0] : (email.from ?? '')

    if (esCierreCaja(subject, remitente)) {
      // ── Parsear como cierre de caja ──────────────────────────
      const textoEmail = textoDesdeEmail(email)

      if (!textoEmail) {
        await db.from('emails_procesados').insert({
          id_resend: email.id,
          tipo: 'cierre_caja',
          asunto: subject,
          remitente,
          error: 'Email sin contenido de texto',
        })
        errores.push(`${email.id}: sin texto`)
        continue
      }

      let cierreId: number | null = null
      let errorMsg: string | null = null

      try {
        const parsed = parsearCierreCaja(textoEmail)

        const { data: cierre, error: cierreErr } = await db
          .from('cierres_caja')
          .upsert(
            {
              ...parsed,
              raw_email: textoEmail.length > 50000 ? textoEmail.slice(0, 50000) : textoEmail,
            },
            { onConflict: 'numero_sesion', ignoreDuplicates: false }
          )
          .select('id')
          .maybeSingle()

        if (cierreErr) {
          errorMsg = cierreErr.message
        } else {
          cierreId = (cierre as any)?.id ?? null
        }
      } catch (err: any) {
        errorMsg = err.message
        errores.push(`${email.id}: ${errorMsg}`)
      }

      await db.from('emails_procesados').insert({
        id_resend: email.id,
        tipo: 'cierre_caja',
        asunto: subject,
        remitente,
        cierre_id: cierreId,
        error: errorMsg,
      })

      procesados++
    } else {
      // ── Tipo desconocido — marcar igualmente para no reprocesar ─
      await db.from('emails_procesados').insert({
        id_resend: email.id,
        tipo: 'desconocido',
        asunto: subject,
        remitente,
      })
      procesados++
    }
  }

  return NextResponse.json({
    ok: true,
    total: emails.length,
    procesados,
    omitidos,
    errores: errores.length > 0 ? errores : undefined,
  })
}

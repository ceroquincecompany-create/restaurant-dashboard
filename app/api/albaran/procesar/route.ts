import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const PROMPT =
  'Extract from this delivery note/invoice: {supplier_name, invoice_number, date (ISO format YYYY-MM-DD), items:[{name, quantity, unit, unit_price, total}], total_amount}. ' +
  'If unreadable return {"error":"imagen no legible"}. Return ONLY valid JSON, no markdown.'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY no configurada' }, { status: 503 })
  }

  let body: { base64: string; mimeType: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { base64, mimeType } = body
  if (!base64 || !mimeType) {
    return NextResponse.json({ error: 'base64 y mimeType requeridos' }, { status: 400 })
  }

  try {
    let rawText: string

    if (mimeType === 'application/pdf') {
      // PDF via document content type (beta)
      const response = await (client.beta as any).messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        betas: ['pdfs-2024-09-25'],
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: base64 },
            },
            { type: 'text', text: PROMPT },
          ],
        }],
      })
      rawText = response.content[0]?.type === 'text' ? response.content[0].text : ''
    } else {
      // Image
      const validMime = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mimeType)
        ? (mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp')
        : 'image/jpeg'

      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: validMime, data: base64 },
            },
            { type: 'text', text: PROMPT },
          ],
        }],
      })
      rawText = response.content[0]?.type === 'text' ? response.content[0].text : ''
    }

    // Strip markdown code fences if present
    const clean = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(clean)
    return NextResponse.json(parsed)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    // If it's a JSON parse error from Claude's response, treat as unreadable
    if (msg.includes('JSON') || msg.includes('parse')) {
      return NextResponse.json({ error: 'imagen no legible' })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

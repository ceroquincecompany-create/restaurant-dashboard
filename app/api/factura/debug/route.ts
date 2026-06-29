import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  let body: { base64: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  if (!body?.base64) {
    return NextResponse.json({ error: 'base64 requerido' }, { status: 400 })
  }

  const buffer = Buffer.from(body.base64, 'base64')

  try {
    const { extractText } = await import('unpdf')
    const { text, totalPages } = await extractText(new Uint8Array(buffer), { mergePages: true })
    return NextResponse.json({
      ok: true,
      totalPages,
      length: text?.length ?? 0,
      text,
      lines: text?.split('\n').map((l, i) => ({ i, line: l })),
    })
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }, { status: 500 })
  }
}

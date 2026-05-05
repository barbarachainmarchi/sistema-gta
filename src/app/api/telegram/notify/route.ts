import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dispararNotificacao } from '@/lib/telegram'
import type { NotifParams } from '@/lib/telegram'

export async function POST(request: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false })
  }

  let body: Partial<NotifParams>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { tipo, usuario_nome, pagina, link_log, encomenda } = body
  if (!tipo || !usuario_nome) {
    return NextResponse.json({ error: 'tipo e usuario_nome são obrigatórios' }, { status: 400 })
  }

  const admin = createAdminClient()
  await dispararNotificacao(admin, { tipo, usuario_nome, pagina, link_log, encomenda })

  return NextResponse.json({ ok: true })
}

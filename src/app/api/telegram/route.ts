import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enviarParaBot } from '@/lib/telegram'

function adminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  return createAdminClient()
}

async function checkAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// ── GET: lista todos os destinos com seus tipos ───────────────────────────────

export async function GET() {
  const user = await checkAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = adminClient()
  if (!admin) return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 })

  const { data, error } = await admin
    .from('telegram_destinos')
    .select('*, telegram_tipos_log(tipo, ativo)')
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// ── POST: cria novo destino ───────────────────────────────────────────────────

export async function POST(request: Request) {
  const user = await checkAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = adminClient()
  if (!admin) return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 })

  const body = await request.json()
  const { nome, bot_token, chat_id } = body

  if (!nome?.trim() || !bot_token?.trim() || !chat_id?.trim()) {
    return NextResponse.json({ error: 'Campos obrigatórios: nome, bot_token, chat_id' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('telegram_destinos')
    .insert({ nome: nome.trim(), bot_token: bot_token.trim(), chat_id: chat_id.trim() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ...data, telegram_tipos_log: [] })
}

// ── PATCH: atualiza destino, toglea tipo ou testa ─────────────────────────────

export async function PATCH(request: Request) {
  const user = await checkAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = adminClient()
  if (!admin) return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 })

  const body = await request.json()
  const { action } = body

  if (action === 'update_destino') {
    const { id, nome, bot_token, chat_id, ativo } = body
    const updates: Record<string, unknown> = {}
    if (nome !== undefined)      updates.nome      = nome.trim()
    if (bot_token !== undefined) updates.bot_token = bot_token.trim()
    if (chat_id !== undefined)   updates.chat_id   = chat_id.trim()
    if (ativo !== undefined)     updates.ativo     = ativo

    const { data, error } = await admin.from('telegram_destinos').update(updates).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (action === 'toggle_tipo') {
    const { destino_id, tipo, ativo } = body
    const { error } = await admin
      .from('telegram_tipos_log')
      .upsert({ destino_id, tipo, ativo }, { onConflict: 'destino_id,tipo' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'test') {
    const { id } = body
    const { data: destino, error } = await admin.from('telegram_destinos').select('bot_token, chat_id, nome').eq('id', id).single()
    if (error || !destino) return NextResponse.json({ error: 'Destino não encontrado' }, { status: 404 })
    const ok = await enviarParaBot(destino.bot_token, destino.chat_id,
      `🔔 *TESTE DE CONEXÃO*\n\nDestino: ${destino.nome}\n✅ Integração funcionando corretamente!`)
    if (!ok) return NextResponse.json({ error: 'Falha ao enviar mensagem. Verifique token e chat ID.' }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'action inválido' }, { status: 400 })
}

// ── DELETE: remove destino ────────────────────────────────────────────────────

export async function DELETE(request: Request) {
  const user = await checkAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = adminClient()
  if (!admin) return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const { error } = await admin.from('telegram_destinos').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

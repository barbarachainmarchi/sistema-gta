import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST → registrar-se via convite (público, sem auth)
export async function POST(req: NextRequest) {
  const { token, apelido, senha } = await req.json()

  if (!token || !apelido || !senha) {
    return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
  }

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(apelido)) {
    return NextResponse.json({ error: 'Apelido inválido — use 3–20 caracteres (letras, números ou _)' }, { status: 400 })
  }

  if (senha.length < 6) {
    return NextResponse.json({ error: 'Senha deve ter pelo menos 6 caracteres' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Valida o convite
  const { data: convite } = await admin
    .from('convites')
    .select('id, expires_at, usado_em')
    .eq('token', token)
    .single()

  if (!convite) return NextResponse.json({ error: 'Link inválido' }, { status: 404 })
  if (convite.usado_em) return NextResponse.json({ error: 'Este link já foi utilizado' }, { status: 400 })
  if (new Date(convite.expires_at) < new Date()) return NextResponse.json({ error: 'Este link expirou' }, { status: 400 })

  const email = `${apelido.toLowerCase()}@gta.local`

  // Verifica se apelido já existe
  const { data: existing } = await admin
    .from('usuarios')
    .select('id')
    .eq('nome', apelido)
    .maybeSingle()

  if (existing) return NextResponse.json({ error: 'Este apelido já está em uso' }, { status: 400 })

  // Cria o usuário no auth
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  })

  if (createError) {
    if (createError.message.includes('already')) {
      return NextResponse.json({ error: 'Este apelido já está em uso' }, { status: 400 })
    }
    return NextResponse.json({ error: createError.message }, { status: 500 })
  }

  // Insere na tabela usuarios com status pendente
  const { error: insertError } = await admin
    .from('usuarios')
    .insert({ id: created.user.id, nome: apelido, status: 'pendente' })

  if (insertError) {
    await admin.auth.admin.deleteUser(created.user.id)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Marca o convite como usado
  await admin
    .from('convites')
    .update({ usado_em: new Date().toISOString() })
    .eq('token', token)

  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Garante que só usuários autenticados chamam esta rota
async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

// POST → convidar novo usuário
export async function POST(req: NextRequest) {
  const { user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { email, nome, cargo, perfil_id } = await req.json()
  if (!email || !nome) return NextResponse.json({ error: 'Email e nome são obrigatórios' }, { status: 400 })

  const admin = createAdminClient()

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/login`,
  })

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 400 })
  }

  const { error: insertError } = await admin
    .from('usuarios')
    .insert({
      id: invited.user.id,
      nome,
      cargo: cargo || null,
      perfil_id: perfil_id || null,
      status: 'ativo',
    })

  if (insertError) {
    // Desfaz o usuário criado se o insert falhar
    await admin.auth.admin.deleteUser(invited.user.id)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ id: invited.user.id })
}

// PATCH → atualizar usuário
export async function PATCH(req: NextRequest) {
  const { user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id, nome, cargo, perfil_id, status, local_trabalho_loja_id, local_trabalho_faccao_id, membro_id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

  const admin = createAdminClient()

  // Monta o objeto de update apenas com os campos enviados
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {}
  if (nome !== undefined) updates.nome = nome
  if (cargo !== undefined) updates.cargo = cargo || null
  if (perfil_id !== undefined) updates.perfil_id = perfil_id || null
  if (status !== undefined) updates.status = status
  if (local_trabalho_loja_id !== undefined) updates.local_trabalho_loja_id = local_trabalho_loja_id || null
  if (local_trabalho_faccao_id !== undefined) updates.local_trabalho_faccao_id = local_trabalho_faccao_id || null
  if (membro_id !== undefined) updates.membro_id = membro_id || null

  const { error } = await admin.from('usuarios').update(updates).eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE → remover usuário
export async function DELETE(req: NextRequest) {
  const { user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

  // Impede remover a si mesmo
  if (id === user.id) return NextResponse.json({ error: 'Você não pode remover sua própria conta' }, { status: 400 })

  const admin = createAdminClient()
  await admin.from('usuarios').delete().eq('id', id)
  const { error } = await admin.auth.admin.deleteUser(id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

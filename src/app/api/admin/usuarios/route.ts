import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

async function getPerfilNome(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<string | null> {
  const { data } = await admin
    .from('usuarios')
    .select('perfis_acesso(nome)')
    .eq('id', userId)
    .maybeSingle()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pa = (data as any)?.perfis_acesso
  return (Array.isArray(pa) ? pa[0]?.nome : pa?.nome) ?? null
}

async function getDonoSecundarioId(admin: ReturnType<typeof createAdminClient>): Promise<string | null> {
  const { data } = await admin.from('config_sistema').select('valor').eq('chave', 'dono_secundario_id').maybeSingle()
  return data?.valor || null
}

async function callerIsElevated(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<boolean> {
  const [perfilNome, donoId] = await Promise.all([getPerfilNome(admin, userId), getDonoSecundarioId(admin)])
  return perfilNome === 'Fantasma' || userId === donoId
}

// POST → criar usuário diretamente (com senha) ou via convite
export async function POST(req: NextRequest) {
  const { user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const admin = createAdminClient()

  // Criação direta com senha (novo fluxo)
  if (body.senha !== undefined) {
    const { apelido, senha, perfil_id, membro_id } = body
    if (!apelido || !senha) return NextResponse.json({ error: 'Apelido e senha são obrigatórios' }, { status: 400 })
    if (senha.length < 6) return NextResponse.json({ error: 'Senha deve ter no mínimo 6 caracteres' }, { status: 400 })

    // Bloqueia atribuição de perfil Fantasma por não-elevados
    if (perfil_id) {
      const { data: perfilAlvo } = await admin.from('perfis_acesso').select('nome').eq('id', perfil_id).maybeSingle()
      if (perfilAlvo?.nome === 'Fantasma') {
        if (!(await callerIsElevated(admin, user.id))) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
      }
    }

    const email = `${apelido}@gta.local`

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
    })

    if (createError) return NextResponse.json({ error: createError.message }, { status: 400 })

    const { error: insertError } = await admin.from('usuarios').insert({
      id: created.user.id,
      nome: apelido,
      perfil_id: perfil_id || null,
      membro_id: membro_id || null,
      status: 'ativo',
    })

    if (insertError) {
      await admin.auth.admin.deleteUser(created.user.id)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ id: created.user.id, email })
  }

  // Convite por e-mail (fluxo legado)
  const { email, nome, cargo, perfil_id } = body
  if (!email || !nome) return NextResponse.json({ error: 'Email e nome são obrigatórios' }, { status: 400 })

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/login`,
  })

  if (inviteError) return NextResponse.json({ error: inviteError.message }, { status: 400 })

  const { error: insertError } = await admin.from('usuarios').insert({
    id: invited.user.id,
    nome,
    cargo: cargo || null,
    perfil_id: perfil_id || null,
    status: 'ativo',
  })

  if (insertError) {
    await admin.auth.admin.deleteUser(invited.user.id)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ id: invited.user.id })
}

// PATCH → atualizar usuário
export async function PATCH(req: NextRequest) {
  const { user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id, nome, cargo, perfil_id, status, local_trabalho_loja_id, local_trabalho_faccao_id, membro_id, trabalho_principal } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

  const admin = createAdminClient()

  // Proteção Fantasma: verificar se alvo ou novo perfil envolve Fantasma
  const [targetPerfilNome, donoSecundarioId, elevated] = await Promise.all([
    getPerfilNome(admin, id),
    getDonoSecundarioId(admin),
    callerIsElevated(admin, user.id),
  ])

  if (targetPerfilNome === 'Fantasma' && !elevated) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  // Proteção dono secundário: só elevados podem modificar
  if (id === donoSecundarioId && !elevated) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  if (perfil_id) {
    const { data: perfilAlvo } = await admin.from('perfis_acesso').select('nome').eq('id', perfil_id).maybeSingle()
    if (perfilAlvo?.nome === 'Fantasma' && !elevated) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = { id }
  if (cargo !== undefined) updates.cargo = cargo || null
  if (perfil_id !== undefined) updates.perfil_id = perfil_id || null
  if (status !== undefined) updates.status = status
  if (local_trabalho_loja_id !== undefined) updates.local_trabalho_loja_id = local_trabalho_loja_id || null
  if (local_trabalho_faccao_id !== undefined) updates.local_trabalho_faccao_id = local_trabalho_faccao_id || null
  if (membro_id !== undefined) updates.membro_id = membro_id || null
  if (trabalho_principal !== undefined) updates.trabalho_principal = trabalho_principal || null

  if (nome !== undefined) {
    updates.nome = nome
  } else {
    const { data: existente } = await admin.from('usuarios').select('nome').eq('id', id).single()
    if (existente?.nome) {
      updates.nome = existente.nome
    } else {
      const { data: authUser } = await admin.auth.admin.getUserById(id)
      updates.nome = authUser?.user?.email?.split('@')[0] ?? id
    }
  }

  const { error } = await admin.from('usuarios').upsert(updates, { onConflict: 'id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE → remover usuário
export async function DELETE(req: NextRequest) {
  const { user } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

  if (id === user.id) return NextResponse.json({ error: 'Você não pode remover sua própria conta' }, { status: 400 })

  const admin = createAdminClient()

  // Só elevados (Fantasma ou Dono 2) podem deletar usuário Fantasma ou dono secundário
  const [targetPerfilNome, donoSecundarioId, elevated] = await Promise.all([
    getPerfilNome(admin, id),
    getDonoSecundarioId(admin),
    callerIsElevated(admin, user.id),
  ])

  if (targetPerfilNome === 'Fantasma' && !elevated) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  if (id === donoSecundarioId && !elevated) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  await admin.from('usuarios').delete().eq('id', id)
  const { error } = await admin.auth.admin.deleteUser(id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

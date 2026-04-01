import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

type Permissao = { modulo: string; pode_ver: boolean; pode_editar: boolean; pode_excluir: boolean }

// POST → criar perfil
export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { nome, descricao, permissoes } = await req.json()
  if (!nome) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })

  const admin = createAdminClient()

  const { data: novo, error } = await admin
    .from('perfis_acesso')
    .insert({ nome, descricao: descricao || null })
    .select('id, nome, descricao')
    .single()

  if (error || !novo) return NextResponse.json({ error: error?.message ?? 'Erro ao criar' }, { status: 500 })

  if (permissoes?.length > 0) {
    const { error: permError } = await admin.from('perfil_permissoes').insert(
      permissoes.map((p: Permissao) => ({
        perfil_id: novo.id,
        modulo: p.modulo,
        pode_ver: p.pode_ver,
        pode_editar: p.pode_editar,
        pode_excluir: p.pode_excluir ?? false,
      }))
    )
    if (permError) return NextResponse.json({ error: permError.message }, { status: 500 })
  }

  return NextResponse.json({ id: novo.id, nome: novo.nome, descricao: novo.descricao })
}

// PATCH → atualizar perfil
export async function PATCH(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id, nome, descricao, permissoes } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })
  if (!nome) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })

  const admin = createAdminClient()

  const { error } = await admin
    .from('perfis_acesso')
    .update({ nome, descricao: descricao || null })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await admin.from('perfil_permissoes').delete().eq('perfil_id', id)

  if (permissoes?.length > 0) {
    const { error: permError } = await admin.from('perfil_permissoes').insert(
      permissoes.map((p: Permissao) => ({
        perfil_id: id,
        modulo: p.modulo,
        pode_ver: p.pode_ver,
        pode_editar: p.pode_editar,
        pode_excluir: p.pode_excluir ?? false,
      }))
    )
    if (permError) return NextResponse.json({ error: permError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// DELETE → remover perfil
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('perfis_acesso').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

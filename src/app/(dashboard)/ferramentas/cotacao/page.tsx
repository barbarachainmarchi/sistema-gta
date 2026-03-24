import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { CotacaoListClient } from './cotacao-list-client'

export default async function CotacaoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: cotacoes },
    { data: faccoes },
    { data: lojas },
    { data: membros },
    { data: userRow },
    { data: permRow },
  ] = await Promise.all([
    supabase.from('cotacoes').select('id, titulo, fornecedor_nome, fornecedor_tipo, modo_preco, status, created_at, criado_por_nome').order('created_at', { ascending: false }),
    supabase.from('faccoes').select('id, nome, cor_tag').eq('status', 'ativo').order('nome'),
    supabase.from('lojas').select('id, nome').eq('status', 'ativo').order('nome'),
    supabase.from('membros').select('id, nome, vulgo').eq('status', 'ativo').order('nome'),
    supabase.from('usuarios').select('nome').eq('id', user.id).maybeSingle(),
    supabase.from('usuarios').select('perfis_acesso(perfil_permissoes(modulo, pode_editar))').eq('id', user.id).maybeSingle(),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const perms = (permRow as any)?.perfis_acesso?.perfil_permissoes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const podeEditar = perms == null ? true : (perms.find((p: any) => p.modulo === 'cotacao')?.pode_editar ?? false)

  return (
    <>
      <Header title="Cotação" />
      <CotacaoListClient
        userId={user.id}
        userNome={userRow?.nome ?? null}
        cotacoes={cotacoes ?? []}
        faccoes={faccoes ?? []}
        lojas={lojas ?? []}
        membros={membros ?? []}
        podeEditar={podeEditar}
      />
    </>
  )
}

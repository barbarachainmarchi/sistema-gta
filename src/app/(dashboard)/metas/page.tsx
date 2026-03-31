import { createClient }    from '@/lib/supabase/server'
import { redirect }        from 'next/navigation'
import { Header }          from '@/components/layout/header'
import { MetasClient }     from './metas-client'

export default async function MetasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: membrosData },
    { data: metaAtualData },
    { data: metasHistoricoData },
    { data: contasData },
    { data: permRow },
    { data: userRow },
  ] = await Promise.all([
    supabase.from('membros').select('id, nome, vulgo').eq('status', 'ativo').order('nome'),
    supabase
      .from('metas_semanais')
      .select('*, metas_itens_template(*), metas_membros(*, metas_membros_itens(*))')
      .eq('status', 'ativa')
      .order('semana_inicio', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('metas_semanais')
      .select('id, titulo, semana_inicio, semana_fim, status, created_at, metas_membros(id, status)')
      .neq('status', 'ativa')
      .order('semana_inicio', { ascending: false })
      .limit(20),
    supabase
      .from('financeiro_contas')
      .select('id, membro_id, saldo_sujo, saldo_limpo')
      .eq('tipo', 'membro')
      .eq('status', 'ativo'),
    supabase.from('usuarios').select('perfis_acesso(perfil_permissoes(modulo, pode_editar))').eq('id', user.id).maybeSingle(),
    supabase.from('usuarios').select('nome').eq('id', user.id).maybeSingle(),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const perms = (permRow as any)?.perfis_acesso?.perfil_permissoes
  const podeEditar  = perms == null ? true : (perms.find((p: any) => p.modulo === 'metas')?.pode_editar  ?? false)
  const podeLancar  = perms == null ? true : (perms.find((p: any) => p.modulo === 'metas')?.pode_editar  ?? false)

  return (
    <>
      <Header title="Metas Semanais" />
      <MetasClient
        userId={user.id}
        userNome={userRow?.nome ?? null}
        membros={membrosData ?? []}
        metaAtual={metaAtualData ?? null}
        metasHistorico={metasHistoricoData ?? []}
        contas={contasData ?? []}
        podeEditar={podeEditar}
        podeLancar={podeLancar}
      />
    </>
  )
}

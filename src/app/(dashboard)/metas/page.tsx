import { createClient }    from '@/lib/supabase/server'
import { redirect }        from 'next/navigation'
import { Header }          from '@/components/layout/header'
import { MetasClient }     from './metas-client'

export default async function MetasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Buscar IDs dos meus produtos para depois pegar os ingredientes
  const { data: meusProds } = await supabase
    .from('items')
    .select('id')
    .eq('eh_meu_produto', true)
    .eq('status', 'ativo')

  const prodIds = meusProds?.map(p => p.id) ?? []

  const [
    { data: membrosData },
    { data: metaAtualData },
    { data: metasHistoricoData },
    { data: contasData },
    { data: permRow },
    { data: userRow },
    { data: receitasData },
  ] = await Promise.all([
    supabase.from('membros').select('id, nome, vulgo').eq('status', 'ativo').eq('membro_proprio', true).order('nome'),
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
    prodIds.length > 0
      ? supabase.from('item_receita').select('ingrediente_id').in('item_id', prodIds)
      : Promise.resolve({ data: [] as { ingrediente_id: string }[] }),
  ])

  // Buscar nomes dos ingredientes únicos
  const ingredIds = [...new Set(receitasData?.map(r => r.ingrediente_id) ?? [])]
  let catalogoItens: { id: string; nome: string }[] = []
  if (ingredIds.length > 0) {
    const { data: ingredItems } = await supabase
      .from('items')
      .select('id, nome')
      .in('id', ingredIds)
      .eq('status', 'ativo')
      .order('nome')
    catalogoItens = ingredItems ?? []
  }

  // Itens do template da última meta encerrada (para sugestões ao criar nova meta)
  const ultimaMetaId = metasHistoricoData?.[0]?.id ?? null
  let ultimaMetaItens: { item_nome: string; quantidade: number; tipo_dinheiro: 'limpo' | 'sujo' | null }[] = []
  if (ultimaMetaId) {
    const { data: tmpl } = await supabase
      .from('metas_itens_template')
      .select('item_nome, quantidade, tipo_dinheiro')
      .eq('meta_id', ultimaMetaId)
      .order('ordem')
    ultimaMetaItens = (tmpl ?? []) as typeof ultimaMetaItens
  }

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
        catalogoItens={catalogoItens}
        ultimaMetaItens={ultimaMetaItens}
      />
    </>
  )
}

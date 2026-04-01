import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { EstoqueClient } from './estoque-client'

export default async function EstoquePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuarioRow } = await supabase
    .from('usuarios')
    .select('nome_completo, perfis_acesso(perfil_permissoes(modulo, pode_editar))')
    .eq('id', user.id)
    .maybeSingle()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const perms = (usuarioRow as any)?.perfis_acesso?.perfil_permissoes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const podeEditar = perms == null ? true : (perms.find((p: any) => p.modulo === 'estoque')?.pode_editar ?? true)
  const usuarioNome: string = (usuarioRow as any)?.nome_completo ?? user.email ?? 'Usuário'

  const [
    { data: itensData },
    { data: controladosData },
    { data: atualizacoesData },
    { data: movimentosData },
    { data: metasAtivasData },
  ] = await Promise.all([
    supabase.from('items').select('id, nome, peso, categorias_item(nome)').eq('status', 'ativo').order('nome'),
    supabase.from('estoque_itens_controlados').select('item_id, created_at'),
    supabase.from('estoque_atualizacoes').select('*').order('created_at', { ascending: false }),
    supabase.from('estoque_movimentos').select('*').order('created_at', { ascending: false }),
    supabase.from('metas_semanais').select('id, created_at').eq('status', 'ativa'),
  ])

  // Vendas entregues com itens dos últimos 120 dias
  const controladosIds = (controladosData ?? []).map(c => c.item_id)
  const since = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString()

  const { data: vendasData } = await supabase
    .from('vendas')
    .select('id, entregue_em')
    .eq('status', 'entregue')
    .not('entregue_em', 'is', null)
    .gte('entregue_em', since)

  const vendaIds = (vendasData ?? []).map(v => v.id)
  const { data: vendaItensData } = vendaIds.length > 0 && controladosIds.length > 0
    ? await supabase
        .from('venda_itens')
        .select('venda_id, item_id, quantidade')
        .in('venda_id', vendaIds)
        .in('item_id', controladosIds)
    : { data: [] }

  // Itens de metas ativas
  const metaAtivaIds = (metasAtivasData ?? []).map(m => m.id)
  const { data: metasMembrosData } = metaAtivaIds.length > 0
    ? await supabase.from('metas_membros').select('id, meta_id').in('meta_id', metaAtivaIds)
    : { data: [] }

  const membroMetaIds = (metasMembrosData ?? []).map(m => m.id)
  const { data: metasItensData } = membroMetaIds.length > 0
    ? await supabase
        .from('metas_membros_itens')
        .select('membro_meta_id, item_nome, quantidade_meta, quantidade_entregue')
        .in('membro_meta_id', membroMetaIds)
    : { data: [] }

  // Enriquecer venda_itens com entregue_em
  const vendaMap = Object.fromEntries((vendasData ?? []).map(v => [v.id, v.entregue_em]))
  const vendaItensEnriquecidos = (vendaItensData ?? []).map(vi => ({
    ...vi,
    entregue_em: vendaMap[vi.venda_id] as string,
  }))

  // Lookup: membro_meta_id → meta_created_at
  const metaIdToCreatedAt = Object.fromEntries((metasAtivasData ?? []).map(m => [m.id, m.created_at]))
  const membroMetaToMetaCreatedAt = Object.fromEntries(
    (metasMembrosData ?? []).map(mm => [mm.id, metaIdToCreatedAt[mm.meta_id]])
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const itens = (itensData ?? []).map((i: any) => ({
    ...i,
    categorias_item: Array.isArray(i.categorias_item) ? (i.categorias_item[0] ?? null) : i.categorias_item,
  }))

  return (
    <>
      <Header title="Estoque" />
      <EstoqueClient
        userId={user.id}
        usuarioNome={usuarioNome}
        podeEditar={podeEditar}
        itens={itens}
        controlados={controladosData ?? []}
        atualizacoes={atualizacoesData ?? []}
        movimentos={movimentosData ?? []}
        vendaItens={vendaItensEnriquecidos}
        metasItens={metasItensData ?? []}
        membroMetaToMetaCreatedAt={membroMetaToMetaCreatedAt}
      />
    </>
  )
}

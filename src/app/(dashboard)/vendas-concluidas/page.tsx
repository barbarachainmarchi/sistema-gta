import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { VendasClient } from '../vendas/vendas-client'

export default async function VendasConcluidasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: vendasData },
    { data: vendaItensData },
    { data: faccoesData },
    { data: itemsData },
    { data: receitasData },
    { data: estoqueData },
    { data: precosVigentesData },
    { data: lojaPrecosData },
    { data: permRow },
    { data: usuarioRow },
  ] = await Promise.all([
    supabase.from('vendas').select('*').order('created_at', { ascending: false }),
    supabase.from('venda_itens').select('*'),
    supabase.from('faccoes').select('id, nome, sigla, telefone, desconto_padrao_pct').eq('status', 'ativo').order('nome'),
    supabase.from('items').select('id, nome, tem_craft, peso, categorias_item(nome)').eq('status', 'ativo').order('nome'),
    supabase.from('item_receita').select('item_id, ingrediente_id, quantidade'),
    supabase.from('estoque').select('item_id, tipo, quantidade'),
    supabase.from('item_preco_vigente').select('item_id, preco_sujo, preco_limpo'),
    supabase.from('loja_item_precos').select('loja_id, item_id, preco, preco_sujo'),
    supabase.from('usuarios').select('perfis_acesso(perfil_permissoes(modulo, pode_editar))').eq('id', user.id).maybeSingle(),
    supabase.from('usuarios').select('nome, local_trabalho_loja_id, local_trabalho_faccao_id').eq('id', user.id).maybeSingle(),
  ])

  const meuLojaId   = usuarioRow?.local_trabalho_loja_id ?? null
  const meuFaccaoId = usuarioRow?.local_trabalho_faccao_id ?? null

  const { data: faccaoPrecosData } = meuFaccaoId
    ? await supabase.from('faccao_item_precos').select('faccao_id, item_id, preco_limpo, preco_sujo').eq('faccao_id', meuFaccaoId)
    : { data: [] }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const perms = (permRow as any)?.perfis_acesso?.perfil_permissoes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const podeEditar = perms == null ? true : (perms.find((p: any) => p.modulo === 'vendas_concluidas')?.pode_editar ?? false)

  const itensPorVenda: Record<string, typeof vendaItensData> = {}
  for (const it of vendaItensData ?? []) {
    if (!itensPorVenda[it.venda_id]) itensPorVenda[it.venda_id] = []
    itensPorVenda[it.venda_id]!.push(it)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vendas = (vendasData ?? []).map((v: any) => ({ ...v, itens: itensPorVenda[v.id] ?? [] }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (itemsData ?? []).map((item: any) => ({
    ...item,
    categorias_item: Array.isArray(item.categorias_item) ? (item.categorias_item[0] ?? null) : item.categorias_item,
  }))

  return (
    <>
      <Header title="Vendas Concluídas" />
      <VendasClient
        userId={user.id}
        userNome={usuarioRow?.nome ?? null}
        vendas={vendas}
        faccoes={faccoesData ?? []}
        allItems={items}
        receitas={receitasData ?? []}
        estoque={estoqueData ?? []}
        precosVigentes={precosVigentesData ?? []}
        lojaPrecos={lojaPrecosData ?? []}
        faccaoPrecos={faccaoPrecosData ?? []}
        meuLojaId={meuLojaId}
        meuFaccaoId={meuFaccaoId}
        filtroInicial="entregue"
        podeEditar={podeEditar}
      />
    </>
  )
}

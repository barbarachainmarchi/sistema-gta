import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { DashboardVendasClient } from './dashboard-vendas-client'

export default async function DashboardVendasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - 2)

  const [
    { data: vendasData },
    { data: vendaItensData },
    { data: faccoesData },
    { data: lojasData },
    { data: itemsData },
    { data: receitasData },
  ] = await Promise.all([
    supabase.from('vendas')
      .select('id, faccao_id, loja_id, cliente_nome, tipo_dinheiro, desconto_pct, status, created_at, entregue_em')
      .eq('status', 'entregue')
      .gte('created_at', cutoff.toISOString())
      .order('created_at', { ascending: false }),
    supabase.from('venda_itens').select('venda_id, item_id, item_nome, quantidade, preco_unit'),
    supabase.from('faccoes').select('id, nome').eq('status', 'ativo').order('nome'),
    supabase.from('lojas').select('id, nome').eq('status', 'ativo').order('nome'),
    supabase.from('items').select('id, nome').eq('status', 'ativo').order('nome'),
    supabase.from('item_receita').select('item_id, ingrediente_id, quantidade, items!item_receita_ingrediente_id_fkey(nome)'),
  ])

  const itensPorVenda: Record<string, { item_id: string | null; item_nome: string; quantidade: number; preco_unit: number }[]> = {}
  for (const it of vendaItensData ?? []) {
    if (!itensPorVenda[it.venda_id]) itensPorVenda[it.venda_id] = []
    itensPorVenda[it.venda_id].push(it)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vendas = (vendasData ?? []).map((v: any) => ({ ...v, itens: itensPorVenda[v.id] ?? [] }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const receitas = (receitasData ?? []).map((r: any) => ({
    item_id: r.item_id as string,
    ingrediente_id: r.ingrediente_id as string,
    quantidade: r.quantidade as number,
    ingrediente_nome: (r.items as { nome: string } | null)?.nome ?? '',
  }))

  return (
    <>
      <Header title="Dashboard de Vendas" />
      <DashboardVendasClient
        vendas={vendas}
        faccoes={faccoesData ?? []}
        lojas={lojasData ?? []}
        allItems={itemsData ?? []}
        receitas={receitas}
      />
    </>
  )
}

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { RelatorioAba } from '../relatorio-aba'

export default async function RelatoriosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: vendasData },
    { data: vendaItensData },
    { data: faccoesData },
    { data: lojasData },
    { data: itemsData },
    { data: permRow },
  ] = await Promise.all([
    supabase.from('vendas').select('*').order('created_at', { ascending: false }),
    supabase.from('venda_itens').select('*'),
    supabase.from('faccoes').select('id, nome').eq('status', 'ativo').order('nome'),
    supabase.from('lojas').select('id, nome').eq('status', 'ativo').order('nome'),
    supabase.from('items').select('id, nome').eq('status', 'ativo').order('nome'),
    supabase.from('usuarios').select('perfis_acesso(perfil_permissoes(modulo, pode_editar))').eq('id', user.id).maybeSingle(),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const perms = (permRow as any)?.perfis_acesso?.perfil_permissoes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const podeExcluirConcluida = perms == null ? true : (perms.find((p: any) => p.modulo === 'vendas_excluir_concluida')?.pode_editar ?? false)

  const itensPorVenda: Record<string, typeof vendaItensData> = {}
  for (const it of vendaItensData ?? []) {
    if (!itensPorVenda[it.venda_id]) itensPorVenda[it.venda_id] = []
    itensPorVenda[it.venda_id]!.push(it)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vendas = (vendasData ?? []).map((v: any) => ({ ...v, itens: itensPorVenda[v.id] ?? [] }))

  return (
    <>
      <Header title="Relatórios de Vendas" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <RelatorioAba
          vendas={vendas}
          faccoes={faccoesData ?? []}
          lojas={lojasData ?? []}
          allItems={itemsData ?? []}
          podeExcluirConcluida={podeExcluirConcluida}
        />
      </div>
    </>
  )
}

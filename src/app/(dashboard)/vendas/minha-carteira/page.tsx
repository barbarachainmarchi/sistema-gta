import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { CarteiraClient } from './carteira-client'

export default async function MinhaCarteiraPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: permRow },
    { data: usuarioRow },
    { data: vendasData },
    { data: vendaItensData },
    { data: lancsData },
    { data: contasData },
  ] = await Promise.all([
    supabase.from('usuarios').select('perfis_acesso(perfil_permissoes(modulo, pode_editar))').eq('id', user.id).maybeSingle(),
    supabase.from('usuarios').select('nome, membro_id').eq('id', user.id).maybeSingle(),
    supabase.from('vendas').select('id, cliente_nome, tipo_dinheiro, desconto_pct, status, created_at, entregue_em, criado_por, criado_por_nome, cancelamento_solicitado, cancelamento_motivo').eq('status', 'entregue').order('created_at', { ascending: false }),
    supabase.from('venda_itens').select('id, venda_id, item_nome, quantidade, preco_unit'),
    supabase.from('financeiro_lancamentos').select('id, venda_id, conta_id, valor, tipo_dinheiro, created_by, responsavel_nome').eq('tipo', 'venda'),
    supabase.from('financeiro_contas').select('id, nome, tipo, saldo_sujo, saldo_limpo, status').eq('status', 'ativo').order('nome'),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const perms = (permRow as any)?.perfis_acesso?.perfil_permissoes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const podeExcluirConcluida = perms == null ? true : (perms.find((p: any) => p.modulo === 'vendas_excluir_concluida')?.pode_editar ?? false)

  // Conta do membro logado
  const membroId = usuarioRow?.membro_id ?? null
  let meuContaId: string | null = null
  if (membroId) {
    const { data: contaMembro } = await supabase.from('financeiro_contas')
      .select('id').eq('membro_id', membroId).eq('status', 'ativo').maybeSingle()
    meuContaId = contaMembro?.id ?? null
  }

  // Transferências pendentes destinadas à minha conta
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let transferPendentes: any[] = []
  if (meuContaId) {
    const { data: solData } = await supabase
      .from('sistema_solicitacoes')
      .select('id, solicitante_nome, descricao, dados, created_at')
      .eq('tipo', 'transferencia_financeiro')
      .eq('status', 'pendente')
      .neq('solicitante_id', user.id)
    const meuId = meuContaId
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transferPendentes = (solData ?? []).filter((s: any) => s.dados?.conta_destino_id === meuId)
  }

  // Filtrar: sem perm → só próprias vendas; com perm → todas
  const itensPorVenda: Record<string, typeof vendaItensData> = {}
  for (const it of vendaItensData ?? []) {
    if (!itensPorVenda[it.venda_id]) itensPorVenda[it.venda_id] = []
    itensPorVenda[it.venda_id]!.push(it)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let vendas = (vendasData ?? []).map((v: any) => ({ ...v, itens: itensPorVenda[v.id] ?? [] }))
  if (!podeExcluirConcluida) {
    vendas = vendas.filter((v: { criado_por: string | null }) => v.criado_por === user.id)
  }

  // Filtrar lancamentos apenas das vendas visíveis
  const vendasIds = new Set(vendas.map((v: { id: string }) => v.id))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lancamentos = (lancsData ?? []).filter((l: any) => l.venda_id && vendasIds.has(l.venda_id))

  return (
    <>
      <Header title="Minha Carteira" />
      <CarteiraClient
        userId={user.id}
        userNome={usuarioRow?.nome ?? null}
        vendas={vendas}
        lancamentos={lancamentos}
        contas={contasData ?? []}
        podeExcluirConcluida={podeExcluirConcluida}
        meuContaId={meuContaId}
        transferPendentesIniciais={transferPendentes}
      />
    </>
  )
}

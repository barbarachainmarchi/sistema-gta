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
    { data: donoConfig },
    { data: servicosData },
    { data: servicoItensData },
  ] = await Promise.all([
    supabase.from('usuarios').select('perfis_acesso(perfil_permissoes(modulo, pode_editar))').eq('id', user.id).maybeSingle(),
    supabase.from('usuarios').select('nome, membro_id, local_trabalho_faccao_id').eq('id', user.id).maybeSingle(),
    supabase.from('vendas').select('id, cliente_nome, tipo_dinheiro, desconto_pct, desconto_fixo, valor_total, status, created_at, entregue_em, criado_por, criado_por_nome, entregue_por, entregue_por_nome, cancelamento_solicitado, cancelamento_motivo, faccao_id, faccoes(nome)').eq('status', 'entregue').order('created_at', { ascending: false }),
    supabase.from('venda_itens').select('id, venda_id, item_id, item_nome, quantidade, preco_unit, servico_id, servicos(nome)'),
    supabase.from('financeiro_lancamentos').select('id, venda_id, conta_id, valor, tipo_dinheiro, created_by, responsavel_nome').eq('tipo', 'venda'),
    supabase.from('financeiro_contas').select('id, nome, tipo, membro_id, saldo_sujo, saldo_limpo, status').eq('status', 'ativo').order('nome'),
    supabase.from('config_sistema').select('valor').eq('chave', 'dono_secundario_id').maybeSingle(),
    supabase.from('servicos').select('id, nome, preco_sujo, preco_limpo'),
    supabase.from('servico_itens').select('servico_id, item_id, quantidade'),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const perms = (permRow as any)?.perfis_acesso?.perfil_permissoes
  const donoId = donoConfig?.valor || null
  const isDono = perms == null || (donoId !== null && donoId === user.id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const podeExcluirConcluida = isDono ? true : (perms?.find((p: any) => p.modulo === 'vendas_excluir_concluida')?.pode_editar ?? false)

  // Membros da facção sem conta financeira (para aparecer no dropdown de transferência)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const faccaoId = (usuarioRow as any)?.local_trabalho_faccao_id ?? null
  let membrosSemConta: { membroId: string; nome: string }[] = []
  if (faccaoId) {
    const { data: membrosData } = await supabase
      .from('membros')
      .select('id, nome')
      .eq('faccao_id', faccaoId)
      .eq('status', 'ativo')
      .order('nome')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const membroIdsComConta = new Set((contasData ?? []).map((c: any) => c.membro_id).filter(Boolean))
    membrosSemConta = (membrosData ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((m: any) => !membroIdsComConta.has(m.id))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((m: any) => ({ membroId: m.id, nome: m.nome }))
  }

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

  // Filtrar: sem perm → vendas que eu entreguei (lancamento na minha conta OU criadas por mim sem lancamento); com perm → todas
  const itensPorVenda: Record<string, typeof vendaItensData> = {}
  for (const it of vendaItensData ?? []) {
    if (!itensPorVenda[it.venda_id]) itensPorVenda[it.venda_id] = []
    itensPorVenda[it.venda_id]!.push(it)
  }

  // Mapa venda_id → lancamento (para checar a qual conta o dinheiro foi)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lancPorVenda: Record<string, { conta_id: string | null }> = {}
  for (const l of lancsData ?? []) {
    if (l.venda_id) lancPorVenda[l.venda_id] = l
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let vendas = (vendasData ?? []).map((v: any) => ({
    ...v,
    faccao_nome: v.faccoes?.nome ?? null,
    itens: (itensPorVenda[v.id] ?? []).map((it: any) => ({ ...it, servico_nome: it.servicos?.nome ?? null })),
  }))
  if (!podeExcluirConcluida) {
    vendas = vendas.filter((v: { criado_por: string | null; id: string }) =>
      v.criado_por === user.id ||
      (meuContaId !== null && lancPorVenda[v.id]?.conta_id === meuContaId)
    )
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
        membrosSemContaIniciais={membrosSemConta}
        transferPendentesIniciais={transferPendentes}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        servicos={(servicosData ?? []) as any}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        servicoItens={(servicoItensData ?? []) as any}
      />
    </>
  )
}

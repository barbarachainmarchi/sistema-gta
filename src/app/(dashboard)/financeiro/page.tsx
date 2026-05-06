import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { FinanceiroClient } from './financeiro-client'

export default async function FinanceiroPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 1) dados do usuário primeiro — precisamos da facção para filtrar membros
  const { data: userInfo } = await supabase
    .from('usuarios')
    .select('nome, local_trabalho_faccao_id, perfis_acesso(perfil_permissoes(modulo, pode_editar, pode_excluir))')
    .eq('id', user.id)
    .maybeSingle()

  const faccaoId = userInfo?.local_trabalho_faccao_id ?? null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const perms = (userInfo as any)?.perfis_acesso?.perfil_permissoes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const podeEditar = perms == null ? true : (perms.find((p: any) => p.modulo === 'financeiro')?.pode_editar ?? false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const podeExcluir = perms == null ? true : (perms.find((p: any) => p.modulo === 'financeiro')?.pode_excluir ?? false)

  // 2) restante em paralelo, membros filtrados pela facção
  let membrosQuery = supabase.from('membros').select('id, nome, vulgo').eq('status', 'ativo').order('nome')
  if (faccaoId) membrosQuery = membrosQuery.eq('faccao_id', faccaoId)

  const [
    { data: contas },
    { data: lancamentos },
    { data: lavagens },
    { data: membros },
    { data: cotacoesFinaliz },
    { data: temaRow },
    { data: repassesData },
  ] = await Promise.all([
    supabase.from('financeiro_contas').select('*').order('nome'),
    supabase.from('financeiro_lancamentos')
      .select('*, cotacoes(titulo, fornecedor_nome), vendas(cliente_nome, faccoes(nome))')
      .order('created_at', { ascending: false })
      .limit(500),
    supabase.from('financeiro_lavagem').select('*').order('created_at', { ascending: false }).limit(200),
    membrosQuery,
    supabase.from('cotacoes').select('id, titulo, fornecedor_nome, fornecedor_tipo').eq('status', 'finalizada').order('created_at', { ascending: false }),
    supabase.from('config_sistema').select('valor').eq('chave', 'tema').maybeSingle(),
    supabase.from('sistema_solicitacoes').select('*').eq('tipo', 'transferencia_financeiro').order('created_at', { ascending: false }).limit(300),
  ])

  const tema = temaRow ? JSON.parse(temaRow.valor) : {}
  const tabPadrao = tema.financeiroTabPadrao ?? 'extrato'

  return (
    <>
      <Header title="Financeiro" />
      <FinanceiroClient
        userId={user.id}
        userNome={userInfo?.nome ?? null}
        contasIniciais={contas ?? []}
        lancamentosIniciais={lancamentos ?? []}
        lavagensIniciais={lavagens ?? []}
        membros={membros ?? []}
        cotacoesFinaliz={cotacoesFinaliz ?? []}
        podeEditar={podeEditar}
        podeExcluir={podeExcluir}
        tabPadrao={tabPadrao}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        repassesIniciais={(repassesData ?? []) as any[]}
      />
    </>
  )
}

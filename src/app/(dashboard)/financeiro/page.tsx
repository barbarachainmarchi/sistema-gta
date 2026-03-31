import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { FinanceiroClient } from './financeiro-client'

export default async function FinanceiroPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: contas },
    { data: lancamentos },
    { data: lavagens },
    { data: membros },
    { data: cotacoesFinaliz },
    { data: userRow },
    { data: permRow },
    { data: temaRow },
  ] = await Promise.all([
    supabase.from('financeiro_contas').select('*').order('nome'),
    supabase.from('financeiro_lancamentos')
      .select('*, cotacoes(titulo, fornecedor_nome), vendas(cliente_nome, faccoes(nome))')
      .order('created_at', { ascending: false })
      .limit(500),
    supabase.from('financeiro_lavagem').select('*').order('created_at', { ascending: false }).limit(200),
    supabase.from('membros').select('id, nome, vulgo').eq('status', 'ativo').order('nome'),
    supabase.from('cotacoes').select('id, titulo, fornecedor_nome, fornecedor_tipo').eq('status', 'finalizada').order('created_at', { ascending: false }),
    supabase.from('usuarios').select('nome').eq('id', user.id).maybeSingle(),
    supabase.from('usuarios').select('perfis_acesso(perfil_permissoes(modulo, pode_editar))').eq('id', user.id).maybeSingle(),
    supabase.from('config_sistema').select('valor').eq('chave', 'tema').maybeSingle(),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const perms = (permRow as any)?.perfis_acesso?.perfil_permissoes
  const podeEditar = perms == null ? true : (perms.find((p: any) => p.modulo === 'financeiro')?.pode_editar ?? false)
  const tema = temaRow ? JSON.parse(temaRow.valor) : {}
  const tabPadrao = tema.financeiroTabPadrao ?? 'extrato'

  return (
    <>
      <Header title="Financeiro" />
      <FinanceiroClient
        userId={user.id}
        userNome={userRow?.nome ?? null}
        contasIniciais={contas ?? []}
        lancamentosIniciais={lancamentos ?? []}
        lavagensIniciais={lavagens ?? []}
        membros={membros ?? []}
        cotacoesFinaliz={cotacoesFinaliz ?? []}
        podeEditar={podeEditar}
        tabPadrao={tabPadrao}
      />
    </>
  )
}

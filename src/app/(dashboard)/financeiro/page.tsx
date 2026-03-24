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
    { data: membros },
    { data: cotacoesFinaliz },
    { data: userRow },
  ] = await Promise.all([
    supabase.from('financeiro_contas').select('*').eq('status', 'ativo').order('nome'),
    supabase.from('financeiro_lancamentos')
      .select('*, cotacoes(titulo, fornecedor_nome, fornecedor_tipo)')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('membros').select('id, nome, vulgo').eq('status', 'ativo').order('nome'),
    supabase.from('cotacoes').select('id, titulo, fornecedor_nome, fornecedor_tipo').eq('status', 'finalizada').order('created_at', { ascending: false }),
    supabase.from('usuarios').select('nome').eq('id', user.id).maybeSingle(),
  ])

  return (
    <>
      <Header title="Financeiro" />
      <FinanceiroClient
        userId={user.id}
        userNome={userRow?.nome ?? null}
        contasIniciais={contas ?? []}
        lancamentosIniciais={lancamentos ?? []}
        membros={membros ?? []}
        cotacoesFinaliz={cotacoesFinaliz ?? []}
      />
    </>
  )
}

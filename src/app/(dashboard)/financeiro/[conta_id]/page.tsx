import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { ExtratoClient } from './extrato-client'

export default async function ExtratoPage({ params }: { params: Promise<{ conta_id: string }> }) {
  const { conta_id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: conta },
    { data: lancamentos },
    { data: todasContas },
    { data: cotacoesFinaliz },
    { data: userRow },
  ] = await Promise.all([
    supabase.from('financeiro_contas').select('*').eq('id', conta_id).single(),
    supabase.from('financeiro_lancamentos').select('*, cotacoes(titulo, fornecedor_nome)').eq('conta_id', conta_id).order('created_at', { ascending: false }),
    supabase.from('financeiro_contas').select('id, nome, subtipo').eq('status', 'ativo').neq('id', conta_id).order('nome'),
    supabase.from('cotacoes').select('id, titulo, fornecedor_nome, fornecedor_tipo').eq('status', 'finalizada').order('created_at', { ascending: false }),
    supabase.from('usuarios').select('nome').eq('id', user.id).maybeSingle(),
  ])

  if (!conta) notFound()

  return (
    <>
      <Header title={conta.nome} description="Financeiro" />
      <ExtratoClient
        userId={user.id}
        userNome={userRow?.nome ?? null}
        conta={conta}
        lancamentosIniciais={lancamentos ?? []}
        todasContas={todasContas ?? []}
        cotacoesFinaliz={cotacoesFinaliz ?? []}
      />
    </>
  )
}

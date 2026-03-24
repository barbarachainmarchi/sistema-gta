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
    { data: membros },
    { data: userRow },
  ] = await Promise.all([
    supabase.from('financeiro_contas').select('*').eq('status', 'ativo').order('nome'),
    supabase.from('membros').select('id, nome, vulgo').eq('status', 'ativo').order('nome'),
    supabase.from('usuarios').select('nome').eq('id', user.id).maybeSingle(),
  ])

  return (
    <>
      <Header title="Financeiro" />
      <FinanceiroClient
        userId={user.id}
        userNome={userRow?.nome ?? null}
        contasIniciais={contas ?? []}
        membros={membros ?? []}
      />
    </>
  )
}

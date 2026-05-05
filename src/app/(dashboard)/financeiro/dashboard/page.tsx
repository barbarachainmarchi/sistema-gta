import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { DashboardFinanceiroClient } from './dashboard-financeiro-client'

export default async function DashboardFinanceiroPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - 2)

  const { data: lancamentosData } = await supabase
    .from('financeiro_lancamentos')
    .select('id, conta_id, tipo, tipo_dinheiro, valor, categoria, data, created_at, item_descricao, descricao')
    .in('tipo', ['entrada', 'saida', 'venda'])
    .gte('created_at', cutoff.toISOString())
    .order('created_at', { ascending: false })

  return (
    <>
      <Header title="Dashboard Financeiro" />
      <DashboardFinanceiroClient lancamentos={lancamentosData ?? []} />
    </>
  )
}

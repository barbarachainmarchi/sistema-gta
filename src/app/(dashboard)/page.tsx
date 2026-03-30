import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { Header }       from '@/components/layout/header'
import { DashboardClient } from './dashboard-client'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const hoje = new Date().toISOString().split('T')[0]
  const inicioSemana = (() => {
    const d = new Date(); const day = d.getDay()
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
    return d.toISOString().split('T')[0]
  })()

  const [
    { data: usuarioRow },
    { data: disponibilidadeRow },
  ] = await Promise.all([
    supabase
      .from('usuarios')
      .select('nome, membro_id')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('usuarios_disponibilidade')
      .select('id, disponivel, observacao')
      .eq('usuario_id', user.id)
      .eq('data', hoje)
      .maybeSingle(),
  ])

  const membroId = usuarioRow?.membro_id ?? null

  const [
    { data: contaRow },
    { data: metaAtualRow },
    { data: vendasSemana },
  ] = await Promise.all([
    membroId
      ? supabase
          .from('financeiro_contas')
          .select('id, saldo_sujo, saldo_limpo')
          .eq('membro_id', membroId)
          .eq('tipo', 'membro')
          .eq('status', 'ativo')
          .maybeSingle()
      : Promise.resolve({ data: null }),

    membroId
      ? supabase
          .from('metas_semanais')
          .select('id, titulo, semana_inicio, semana_fim, metas_itens_template(*), metas_membros!inner(id, status, status_forcado, observacao, membro_id, metas_membros_itens(*))')
          .eq('status', 'ativa')
          .eq('metas_membros.membro_id', membroId)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    supabase
      .from('vendas')
      .select('id, status, created_at')
      .eq('criado_por', user.id)
      .gte('created_at', `${inicioSemana}T00:00:00`)
      .order('created_at', { ascending: false }),
  ])

  return (
    <>
      <Header title="Início" />
      <DashboardClient
        userId={user.id}
        userNome={usuarioRow?.nome ?? null}
        conta={contaRow ?? null}
        metaAtual={metaAtualRow ?? null}
        vendasSemana={vendasSemana ?? []}
        disponibilidade={disponibilidadeRow ?? null}
        hoje={hoje}
      />
    </>
  )
}

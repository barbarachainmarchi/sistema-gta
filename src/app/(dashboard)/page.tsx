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
    { data: dispTodosRow },
    { count: cotacoesAbertas },
    { count: encomendasAbertas },
  ] = await Promise.all([
    supabase
      .from('usuarios')
      .select('nome, membro_id, local_trabalho_loja_id, local_trabalho_faccao_id')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('usuarios_disponibilidade')
      .select('id, disponivel, observacao, hora_inicio, hora_fim')
      .eq('usuario_id', user.id)
      .eq('data', hoje)
      .maybeSingle(),
    supabase
      .from('usuarios_disponibilidade')
      .select('disponivel, hora_inicio, hora_fim, usuarios(nome)')
      .eq('data', hoje)
      .eq('disponivel', true)
      .order('hora_inicio', { ascending: true, nullsFirst: false }),
    supabase.from('cotacoes').select('*', { count: 'exact', head: true }).eq('status', 'rascunho'),
    supabase.from('vendas').select('*', { count: 'exact', head: true }).eq('status', 'encomenda'),
  ])

  const membroId = usuarioRow?.membro_id ?? null
  const lojaId   = usuarioRow?.local_trabalho_loja_id ?? null
  const faccaoId = usuarioRow?.local_trabalho_faccao_id ?? null

  const [
    { data: contaRow },
    { data: metaAtualRow },
    { data: vendasSemana },
    { data: lojaRow },
    { data: faccaoRow },
    { data: escalacoesPendentes },
    { data: minhasParticipacoes },
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
    lojaId   ? supabase.from('lojas').select('nome').eq('id', lojaId).maybeSingle()   : Promise.resolve({ data: null }),
    faccaoId ? supabase.from('faccoes').select('nome').eq('id', faccaoId).maybeSingle() : Promise.resolve({ data: null }),
    supabase
      .from('escalacoes')
      .select('id, tipo_nome, data_hora_prevista, modo, observacoes')
      .eq('status', 'pendente')
      .order('data_hora_prevista'),
    membroId
      ? supabase
          .from('escalacao_participantes')
          .select('id, escalacao_id, status')
          .eq('membro_id', membroId)
      : Promise.resolve({ data: [] }),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dispTodos = (dispTodosRow ?? []).map((d: any) => ({
    nome: d.usuarios?.nome ?? '?',
    hora_inicio: d.hora_inicio ?? null,
    hora_fim: d.hora_fim ?? null,
  }))

  return (
    <>
      <Header title="Início" />
      <DashboardClient
        userId={user.id}
        userNome={usuarioRow?.nome ?? null}
        lojaNome={lojaRow?.nome ?? null}
        faccaoNome={faccaoRow?.nome ?? null}
        conta={contaRow ?? null}
        metaAtual={metaAtualRow ?? null}
        vendasSemana={vendasSemana ?? []}
        disponibilidade={disponibilidadeRow ?? null}
        hoje={hoje}
        dispTodos={dispTodos}
        cotacoesAbertas={cotacoesAbertas ?? 0}
        encomendasAbertas={encomendasAbertas ?? 0}
        membroId={membroId}
        escalacoesPendentes={escalacoesPendentes ?? []}
        minhasParticipacoes={minhasParticipacoes ?? []}
      />
    </>
  )
}

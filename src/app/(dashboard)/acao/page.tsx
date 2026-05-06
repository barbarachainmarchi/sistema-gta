import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { AcaoClient } from './acao-client'

export default async function AcaoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: tiposData },
    { data: acoesData },
    { data: participantesData },
    { data: escalacoesData },
    { data: escalacaoParticipantesData },
    { data: membrosData },
    { data: usuarioRow },
    { data: competicoesData },
    { data: compEquipesData },
    { data: compEquipeMembrosData },
  ] = await Promise.all([
    supabase.from('acao_tipos').select('*').order('nome'),
    supabase.from('acoes').select('*').order('data_hora', { ascending: false }),
    supabase.from('acao_participantes').select('*'),
    supabase.from('escalacoes').select('*').order('data_hora_prevista', { ascending: false }),
    supabase.from('escalacao_participantes').select('*'),
    supabase.from('membros').select('id, nome, vulgo, status, faccao_id').eq('status', 'ativo').order('nome'),
    supabase.from('usuarios').select('membro_id, nome, perfis_acesso(perfil_permissoes(modulo, pode_editar))').eq('id', user.id).maybeSingle(),
    supabase.from('acao_competicoes').select('*').order('created_at', { ascending: false }),
    supabase.from('acao_competicao_equipes').select('*'),
    supabase.from('acao_competicao_equipe_membros').select('*'),
  ])

  // isDono = sem perfil vinculado (perms == null)
  const perms = (usuarioRow as any)?.perfis_acesso?.perfil_permissoes as { modulo: string; pode_editar: boolean }[] | null | undefined
  const podeEditar = perms == null ? true : (perms.find((p) => p.modulo === 'acao')?.pode_editar ?? false)

  return (
    <>
      <Header title="Ação" description="Registro e escalação de ações operacionais" />
      <AcaoClient
        userId={user.id}
        userNome={usuarioRow?.nome ?? null}
        membroId={usuarioRow?.membro_id ?? null}
        podeEditar={podeEditar}
        tiposIniciais={tiposData ?? []}
        acoesIniciais={acoesData ?? []}
        participantesIniciais={participantesData ?? []}
        escalacoesIniciais={escalacoesData ?? []}
        escalacaoParticipantesIniciais={escalacaoParticipantesData ?? []}
        membrosIniciais={membrosData ?? []}
        competicoesIniciais={competicoesData ?? []}
        compEquipesIniciais={compEquipesData ?? []}
        compEquipeMembrosIniciais={compEquipeMembrosData ?? []}
      />
    </>
  )
}

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { LogsClient, type Log, type Solicitacao } from './logs-client'

export default async function LogsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: logsData },
    { data: solicitacoesData },
    { data: usuarioRow },
    { data: permRow },
    { data: donoConfig },
  ] = await Promise.all([
    supabase.from('sistema_logs').select('*').order('created_at', { ascending: false }).limit(300),
    supabase.from('sistema_solicitacoes').select('*').order('created_at', { ascending: false }).limit(200),
    supabase.from('usuarios').select('nome, exclusao_suprema').eq('id', user.id).maybeSingle(),
    supabase.from('usuarios').select('perfis_acesso(perfil_permissoes(modulo, pode_editar))').eq('id', user.id).maybeSingle(),
    supabase.from('config_sistema').select('valor').eq('chave', 'dono_secundario_id').maybeSingle(),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const perms = (permRow as any)?.perfis_acesso?.perfil_permissoes
  const isDono = perms == null
  const isDonoFantasma = !isDono && donoConfig?.valor === user.id
  const podeAprovar = isDono || isDonoFantasma
    || (perms?.find((p: { modulo: string; pode_editar: boolean }) => p.modulo === 'admin_logs')?.pode_editar ?? false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const exclusaoSuprema = !!(usuarioRow as any)?.exclusao_suprema
  const podeExcluirLog = isDono || isDonoFantasma || exclusaoSuprema

  return (
    <>
      <Header title="Logs" description="Histórico e solicitações do sistema" />
      <LogsClient
        userId={user.id}
        userNome={usuarioRow?.nome ?? null}
        logsIniciais={(logsData ?? []) as Log[]}
        solicitacoesIniciais={(solicitacoesData ?? []) as Solicitacao[]}
        podeAprovar={podeAprovar}
        podeExcluirLog={podeExcluirLog}
      />
    </>
  )
}

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { PresencasClient } from './presencas-client'

export default async function PresencasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const hoje = new Date().toISOString().split('T')[0]!

  const [
    { data: membrosData },
    { data: presencasHoje },
    { data: usuarioRow },
  ] = await Promise.all([
    supabase.from('membros').select('id, nome, vulgo, status, faccao_id').eq('status', 'ativo').order('nome'),
    supabase.from('presencas').select('*').eq('data', hoje),
    supabase.from('usuarios').select('membro_id, perfis_acesso(perfil_permissoes(modulo, pode_editar))').eq('id', user.id).maybeSingle(),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const perms = (usuarioRow as any)?.perfis_acesso?.perfil_permissoes as { modulo: string; pode_editar: boolean }[] | null | undefined
  const podeEditar = perms == null ? true : (perms.find(p => p.modulo === 'acao')?.pode_editar ?? false)
  const membroId = usuarioRow?.membro_id ?? null

  return (
    <>
      <Header title="Presenças" description="Controle de presenças e ausências dos membros" />
      <PresencasClient
        userId={user.id}
        membroIdUsuario={membroId}
        membrosIniciais={membrosData ?? []}
        presencasIniciais={presencasHoje ?? []}
        hojeInicial={hoje}
        podeEditar={podeEditar}
      />
    </>
  )
}

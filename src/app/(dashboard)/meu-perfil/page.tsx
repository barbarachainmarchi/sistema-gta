import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MeuPerfilClient } from './meu-perfil-client'

export default async function MeuPerfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: usuarioRow },
    { data: lojasData },
    { data: faccoesData },
  ] = await Promise.all([
    supabase.from('usuarios').select('nome, local_trabalho_loja_id, local_trabalho_faccao_id, trabalho_principal').eq('id', user.id).maybeSingle(),
    supabase.from('lojas').select('id, nome').eq('status', 'ativo').order('nome'),
    supabase.from('faccoes').select('id, nome, tag').eq('status', 'ativo').order('nome'),
  ])

  return (
    <MeuPerfilClient
      nomeUsuario={usuarioRow?.nome ?? null}
      lojaAtual={usuarioRow?.local_trabalho_loja_id ?? null}
      faccaoAtual={usuarioRow?.local_trabalho_faccao_id ?? null}
      trabalhoPrincipalAtual={(usuarioRow?.trabalho_principal ?? null) as 'loja' | 'faccao' | null}
      lojas={(lojasData ?? []).map(l => ({ id: l.id, nome: l.nome }))}
      faccoes={(faccoesData ?? []).map(f => ({ id: f.id, nome: f.nome, tag: f.tag ?? null }))}
    />
  )
}

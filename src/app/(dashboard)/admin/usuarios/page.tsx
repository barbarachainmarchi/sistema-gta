import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { UsuariosClient } from './usuarios-client'

export default async function UsuariosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center space-y-2 max-w-sm">
          <p className="text-sm font-medium text-foreground">Configuração necessária</p>
          <p className="text-xs text-muted-foreground">
            Adicione <code className="bg-white/10 px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> no arquivo <code className="bg-white/10 px-1 rounded">.env.local</code> e reinicie o servidor.
          </p>
          <p className="text-xs text-muted-foreground">Encontre a chave em: Supabase → Settings → API → service_role</p>
        </div>
      </div>
    )
  }

  const admin = createAdminClient()

  const [
    authResult,
    { data: usuariosData },
    { data: perfis },
    { data: permissoes },
    { data: convitesData },
    { data: membrosData },
  ] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    supabase.from('usuarios').select('id, nome, cargo, perfil_id, status, membro_id, perfis_acesso(id, nome)'),
    supabase.from('perfis_acesso').select('id, nome, descricao').order('nome'),
    supabase.from('perfil_permissoes').select('perfil_id, modulo, pode_ver, pode_editar'),
    admin.from('convites').select('token, expires_at, created_at').is('usado_em', null).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }),
    supabase.from('membros').select('id, nome, vulgo, faccao_id, cargo_faccao, status, membro_proprio, data_entrada, data_saida, faccoes(nome, cor_tag)').eq('membro_proprio', true).order('nome'),
  ])

  const authUsers = authResult.data?.users ?? []

  const usuariosMap = new Map((usuariosData ?? []).map(u => [u.id, u]))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const membros = (membrosData ?? []) as any[]

  const usuarios = (authUsers ?? []).map(au => {
    const perfil = usuariosMap.get(au.id)
    return {
      id: au.id,
      email: au.email ?? '',
      nome: perfil?.nome ?? au.email?.split('@')[0] ?? '—',
      cargo: perfil?.cargo ?? null,
      perfil_id: perfil?.perfil_id ?? null,
      membro_id: perfil?.membro_id ?? null,
      perfil_nome: (Array.isArray(perfil?.perfis_acesso) ? perfil.perfis_acesso[0]?.nome : null) ?? null,
      status: (perfil?.status ?? 'ativo') as 'ativo' | 'inativo' | 'pendente',
      created_at: au.created_at,
      ultimo_acesso: au.last_sign_in_at ?? null,
    }
  })

  const perfisCompletos = (perfis ?? []).map(p => ({
    ...p,
    permissoes: (permissoes ?? [])
      .filter(pm => pm.perfil_id === p.id)
      .map(pm => ({ modulo: pm.modulo, pode_ver: pm.pode_ver, pode_editar: pm.pode_editar })),
  }))

  const convites = (convitesData ?? []).map(c => ({
    token: c.token,
    expires_at: c.expires_at,
    criado_em: c.created_at,
  }))

  return (
    <UsuariosClient
      usuarios={usuarios}
      perfis={perfisCompletos}
      convites={convites}
      currentUserId={user.id}
      membros={membros}
    />
  )
}

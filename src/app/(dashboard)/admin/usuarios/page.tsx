import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { UsuariosClient } from './usuarios-client'

export default async function UsuariosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const [
    { data: { users: authUsers } },
    { data: usuariosData },
    { data: perfis },
    { data: permissoes },
    { data: convitesData },
  ] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    supabase.from('usuarios').select('id, nome, cargo, perfil_id, status, perfis_acesso(id, nome)'),
    supabase.from('perfis_acesso').select('id, nome, descricao').order('nome'),
    supabase.from('perfil_permissoes').select('perfil_id, modulo, pode_ver, pode_editar'),
    // Convites ativos: não usados e não expirados
    admin.from('convites').select('token, expires_at, created_at').is('usado_em', null).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }),
  ])

  const usuariosMap = new Map((usuariosData ?? []).map(u => [u.id, u]))

  const usuarios = (authUsers ?? []).map(au => {
    const perfil = usuariosMap.get(au.id)
    return {
      id: au.id,
      email: au.email ?? '',
      nome: perfil?.nome ?? au.email?.split('@')[0] ?? '—',
      cargo: perfil?.cargo ?? null,
      perfil_id: perfil?.perfil_id ?? null,
      perfil_nome: (perfil?.perfis_acesso as { nome: string } | null)?.nome ?? null,
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
    />
  )
}

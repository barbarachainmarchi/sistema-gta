import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { MembrosAdminClient } from './membros-client'

export default async function MembrosAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">
          <code>SUPABASE_SERVICE_ROLE_KEY</code> não configurado.
        </p>
      </div>
    )
  }

  const admin = createAdminClient()

  const [
    { data: membrosData },
    { data: usuariosData },
    { data: lojasData },
    { data: faccoesData },
    { data: perfisData },
    { data: donoConfig },
  ] = await Promise.all([
    supabase.from('membros').select('id, nome, vulgo, cargo_faccao, status, membro_proprio, data_entrada, data_saida').eq('membro_proprio', true).order('nome'),
    admin.from('usuarios').select('id, nome, status, membro_id, perfil_id, local_trabalho_loja_id, local_trabalho_faccao_id, trabalho_principal, perfis_acesso(nome)'),
    supabase.from('lojas').select('id, nome').eq('status', 'ativo').order('nome'),
    supabase.from('faccoes').select('id, nome, tag').eq('status', 'ativo').order('nome'),
    supabase.from('perfis_acesso').select('id, nome, is_sistema').order('nome'),
    supabase.from('config_sistema').select('valor').eq('chave', 'dono_secundario_id').maybeSingle(),
  ])

  // Determina facções permitidas: apenas as do Dono e do Dono Secundário
  const donoId = donoConfig?.valor || null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const donoUser = (usuariosData ?? []).find((u: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const perfil = Array.isArray(u.perfis_acesso) ? (u.perfis_acesso as any[])[0] : u.perfis_acesso
    return perfil?.nome === 'Dono'
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const donoSecUser = donoId ? (usuariosData ?? []).find((u: any) => u.id === donoId) : null

  const allowedFaccaoIds = new Set(
    [donoUser?.local_trabalho_faccao_id, donoSecUser?.local_trabalho_faccao_id]
      .filter((id): id is string => !!id)
  )
  const faccoesTodas = (faccoesData ?? []).map(f => ({ id: f.id, nome: f.nome, tag: (f as { tag?: string | null }).tag ?? null }))
  const faccoesSelecionaveis = allowedFaccaoIds.size > 0
    ? faccoesTodas.filter(f => allowedFaccaoIds.has(f.id))
    : faccoesTodas

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const usuariosPorMembroId = new Map<string, any>(
    (usuariosData ?? [])
      .filter(u => u.membro_id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((u: any) => [u.membro_id as string, u])
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const membros = (membrosData ?? []).map((m: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const u = usuariosPorMembroId.get(m.id) as any ?? null
    return {
      id: m.id as string,
      nome: m.nome as string,
      vulgo: (m.vulgo ?? null) as string | null,
      cargo_faccao: (m.cargo_faccao ?? null) as string | null,
      status: m.status as string,
      data_entrada: (m.data_entrada ?? null) as string | null,
      data_saida: (m.data_saida ?? null) as string | null,
      usuario: u ? {
        id: u.id as string,
        nome: u.nome as string,
        status: (u.status ?? 'ativo') as 'ativo' | 'inativo' | 'pendente',
        membro_id: (u.membro_id ?? null) as string | null,
        perfil_id: (u.perfil_id ?? null) as string | null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        perfil_nome: (Array.isArray(u.perfis_acesso) ? (u.perfis_acesso as any[])[0]?.nome : (u.perfis_acesso as any)?.nome) as string | null ?? null,
        local_trabalho_loja_id: (u.local_trabalho_loja_id ?? null) as string | null,
        local_trabalho_faccao_id: (u.local_trabalho_faccao_id ?? null) as string | null,
        trabalho_principal: (u.trabalho_principal ?? null) as 'loja' | 'faccao' | null,
      } : null,
    }
  })

  const usuarios = (usuariosData ?? [])
    .filter(u => u.status !== 'pendente')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((u: any) => ({
      id: u.id as string,
      nome: u.nome as string,
      membro_id: (u.membro_id ?? null) as string | null,
    }))

  const perfis = (perfisData ?? [])
    .filter(p => !p.is_sistema)
    .map(p => ({ id: p.id, nome: p.nome }))

  return (
    <MembrosAdminClient
      membros={membros}
      usuarios={usuarios}
      lojas={(lojasData ?? []).map(l => ({ id: l.id, nome: l.nome }))}
      faccoesTodas={faccoesTodas}
      faccoesSelecionaveis={faccoesSelecionaveis}
      perfis={perfis}
    />
  )
}

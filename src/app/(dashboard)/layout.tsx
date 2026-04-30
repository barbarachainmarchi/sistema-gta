import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { ThemeProvider } from '@/components/layout/theme-provider'
import { getTema } from '@/lib/getTema'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Paraleliza: perfil do usuário (dinâmico) + tema (cacheado) + atualiza ultimo_acesso
  const [{ data: perfilRow }, tema, { data: donoConfig }] = await Promise.all([
    supabase
      .from('usuarios')
      .select('status, perfis_acesso(nome, perfil_permissoes(modulo, pode_ver))')
      .eq('id', user.id)
      .maybeSingle(),
    getTema(),
    supabase.from('config_sistema').select('valor').eq('chave', 'dono_secundario_id').maybeSingle(),
    supabase.from('usuarios').update({ ultimo_acesso: new Date().toISOString() }).eq('id', user.id),
  ])

  if (perfilRow?.status === 'pendente') redirect('/aguardando')

  const nomeSistema = tema?.nomeSistema || 'Sistema GTA'
  const categoriaCores: Record<string, string> = tema?.categoriaCores ?? {}

  // Módulos que o usuário pode ver (null = sem perfil = vê tudo)
  const isDonoSecundario = donoConfig?.valor === user.id
  type PerfilRow = { perfis_acesso: { nome?: string; perfil_permissoes: { modulo: string; pode_ver: boolean }[] } | null } | null
  const pr = perfilRow as PerfilRow
  const isFantasmaLayout = pr?.perfis_acesso?.nome === 'Fantasma'
  const permissoes = pr?.perfis_acesso?.perfil_permissoes
  // Fantasma e Dono 2 bypassam todas as restrições. Sem perfil = sem acesso (lista vazia).
  const modulosVisiveis: string[] | null = (isDonoSecundario || isFantasmaLayout)
    ? null
    : permissoes
      ? permissoes.filter(p => p.pode_ver).map(p => p.modulo)
      : []

  return (
    <ThemeProvider config={tema}>
      <div className="min-h-screen bg-background">
        <Sidebar nomeSistema={nomeSistema} modulosVisiveis={modulosVisiveis} categoriaCores={categoriaCores} />
        <main className="ml-[var(--sidebar-width)] min-h-screen flex flex-col">
          {children}
        </main>
      </div>
    </ThemeProvider>
  )
}

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

  // Paraleliza: perfil do usuário (dinâmico) + tema (cacheado)
  const [{ data: perfilRow }, tema] = await Promise.all([
    supabase
      .from('usuarios')
      .select('status, perfis_acesso(perfil_permissoes(modulo, pode_ver))')
      .eq('id', user.id)
      .maybeSingle(),
    getTema(),
  ])

  if (perfilRow?.status === 'pendente') redirect('/aguardando')

  const nomeSistema = tema?.nomeSistema || 'Sistema GTA'
  const categoriaCores: Record<string, string> = tema?.categoriaCores ?? {}

  // Módulos que o usuário pode ver (null = sem perfil = vê tudo)
  type PerfilRow = { perfis_acesso: { perfil_permissoes: { modulo: string; pode_ver: boolean }[] } | null } | null
  const pr = perfilRow as PerfilRow
  const permissoes = pr?.perfis_acesso?.perfil_permissoes
  const modulosVisiveis: string[] | null = permissoes
    ? permissoes.filter(p => p.pode_ver).map(p => p.modulo)
    : null

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

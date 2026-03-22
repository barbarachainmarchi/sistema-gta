import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { ThemeProvider } from '@/components/layout/theme-provider'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: configRow } = await supabase
    .from('config_sistema')
    .select('valor')
    .eq('chave', 'tema')
    .single()

  const tema = configRow ? JSON.parse(configRow.valor) : null

  return (
    <ThemeProvider config={tema}>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <main className="ml-[var(--sidebar-width)] min-h-screen flex flex-col">
          {children}
        </main>
      </div>
    </ThemeProvider>
  )
}

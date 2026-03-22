import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import { createClient } from '@/lib/supabase/server'

const inter = Inter({ subsets: ['latin'] })

export async function generateMetadata(): Promise<Metadata> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('config_sistema')
      .select('valor')
      .eq('chave', 'tema')
      .single()
    const tema = data ? JSON.parse(data.valor) : null
    return { title: tema?.nomeSistema || 'Sistema GTA', description: 'Sistema de gestão' }
  } catch {
    return { title: 'Sistema GTA', description: 'Sistema de gestão' }
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={inter.className}>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}

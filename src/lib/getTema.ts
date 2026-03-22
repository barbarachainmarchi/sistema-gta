import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export type Tema = {
  accentH: number
  accentS: number
  accentL: number
  nomeSistema: string
  categoriaCores?: Record<string, string>
}

export const getTema = unstable_cache(
  async (): Promise<Tema | null> => {
    const admin = createAdminClient()
    const { data } = await admin
      .from('config_sistema')
      .select('valor')
      .eq('chave', 'tema')
      .single()
    return data ? (JSON.parse(data.valor) as Tema) : null
  },
  ['config-tema'],
  { tags: ['config-tema'], revalidate: 60 }
)

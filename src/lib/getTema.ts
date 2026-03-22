import { cacheLife, cacheTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export type Tema = {
  accentH: number
  accentS: number
  accentL: number
  nomeSistema: string
  categoriaCores?: Record<string, string>
}

export async function getTema(): Promise<Tema | null> {
  'use cache'
  cacheTag('config-tema')
  cacheLife('minutes')

  const admin = createAdminClient()
  const { data } = await admin
    .from('config_sistema')
    .select('valor')
    .eq('chave', 'tema')
    .single()

  return data ? (JSON.parse(data.valor) as Tema) : null
}

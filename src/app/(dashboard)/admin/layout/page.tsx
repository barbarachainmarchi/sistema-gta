import { createClient } from '@/lib/supabase/server'
import { LayoutClient } from './layout-client'

export default async function LayoutPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('config_sistema')
    .select('valor')
    .eq('chave', 'tema')
    .single()

  const tema = data ? JSON.parse(data.valor) : {
    accentH: 0, accentS: 0, accentL: 90, nomeSistema: 'Sistema GTA'
  }

  return <LayoutClient initialTema={tema} />
}

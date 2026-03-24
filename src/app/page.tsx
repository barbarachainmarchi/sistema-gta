import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function Home() {
  const supabase = await createClient()
  const { data } = await supabase.from('config_sistema').select('valor').eq('chave', 'tema').maybeSingle()
  const tema = data ? JSON.parse(data.valor) : {}
  redirect('/' + (tema.paginaInicial ?? 'ferramentas/calculadora'))
}

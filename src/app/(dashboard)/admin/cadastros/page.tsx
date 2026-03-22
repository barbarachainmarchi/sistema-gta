import { createClient } from '@/lib/supabase/server'
import { CadastrosClient } from './cadastros-client'

export default async function CadastrosPage() {
  const supabase = await createClient()

  const [itemsResult, categoriasResult, lojasResult] = await Promise.all([
    supabase.from('items').select('*, categorias_item (id, nome)').order('nome'),
    supabase.from('categorias_item').select('*').order('nome'),
    supabase.from('lojas').select('*').order('nome'),
  ])

  return (
    <CadastrosClient
      initialItems={itemsResult.data || []}
      categorias={categoriasResult.data || []}
      lojas={lojasResult.data || []}
    />
  )
}

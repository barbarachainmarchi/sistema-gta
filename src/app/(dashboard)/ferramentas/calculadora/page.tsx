import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { CalculadoraClient } from './calculadora-client'

export default async function CalculadoraPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: itemsData },
    { data: precosData },
    { data: lojasData },
    { data: lojaPrecosData },
    { data: favoritosData },
  ] = await Promise.all([
    supabase.from('items').select('*, categorias_item(nome), item_receita(ingrediente_id, quantidade)').eq('status', 'ativo').order('nome'),
    supabase.from('item_preco_vigente').select('item_id, preco_sujo, preco_limpo'),
    supabase.from('lojas').select('id, nome').eq('status', 'ativo').order('nome'),
    supabase.from('loja_item_precos').select('loja_id, item_id, preco, preco_sujo'),
    supabase.from('usuario_favoritos').select('item_id').eq('usuario_id', user.id),
  ])

  return (
    <>
      <Header title="Calculadora" />
      <CalculadoraClient
        userId={user.id}
        items={itemsData ?? []}
        precos={precosData ?? []}
        lojas={lojasData ?? []}
        lojaPrecos={lojaPrecosData ?? []}
        favoritosIniciais={(favoritosData ?? []).map(f => f.item_id)}
      />
    </>
  )
}

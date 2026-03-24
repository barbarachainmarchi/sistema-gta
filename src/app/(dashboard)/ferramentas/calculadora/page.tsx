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
    { data: receitasData },
    { data: precosData },
    { data: lojasData },
    { data: lojaPrecosData },
    { data: favoritosData },
    { data: permRow },
  ] = await Promise.all([
    supabase.from('items').select('id, nome, tem_craft, eh_meu_produto, peso, categorias_item(nome)').eq('status', 'ativo').order('nome'),
    supabase.from('item_receita').select('item_id, ingrediente_id, quantidade'),
    supabase.from('item_preco_vigente').select('item_id, preco_sujo, preco_limpo'),
    supabase.from('lojas').select('id, nome').eq('status', 'ativo').order('nome'),
    supabase.from('loja_item_precos').select('loja_id, item_id, preco, preco_sujo'),
    supabase.from('usuario_favoritos').select('item_id').eq('usuario_id', user.id),
    supabase.from('usuarios').select('perfis_acesso(perfil_permissoes(modulo, pode_editar))').eq('id', user.id).maybeSingle(),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const perms = (permRow as any)?.perfis_acesso?.perfil_permissoes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const podeEditar = perms == null ? true : (perms.find((p: any) => p.modulo === 'calculadora')?.pode_editar ?? false)

  // Mesclar receitas nos items
  const receitasPorItem: Record<string, { ingrediente_id: string; quantidade: number }[]> = {}
  for (const r of receitasData ?? []) {
    if (!receitasPorItem[r.item_id]) receitasPorItem[r.item_id] = []
    receitasPorItem[r.item_id].push({ ingrediente_id: r.ingrediente_id, quantidade: r.quantidade })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (itemsData ?? []).map((item: any) => ({
    ...item,
    categorias_item: Array.isArray(item.categorias_item) ? (item.categorias_item[0] ?? null) : item.categorias_item,
    item_receita: receitasPorItem[item.id] ?? [],
  }))

  return (
    <>
      <Header title="Calculadora" />
      <CalculadoraClient
        userId={user.id}
        items={items}
        precos={precosData ?? []}
        lojas={lojasData ?? []}
        lojaPrecos={lojaPrecosData ?? []}
        favoritosIniciais={(favoritosData ?? []).map(f => f.item_id)}
        podeEditar={podeEditar}
      />
    </>
  )
}

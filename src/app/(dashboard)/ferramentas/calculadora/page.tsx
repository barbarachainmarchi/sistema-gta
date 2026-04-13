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
    { data: precosVigentesData },
    { data: lojasData },
    { data: lojaPrecosData },
    { data: favoritosData },
    { data: permRow },
    { data: usuarioRow },
    { data: servicosData },
    { data: servicoItensData },
  ] = await Promise.all([
    supabase.from('items').select('id, nome, tem_craft, eh_meu_produto, meu_produto_usuario_id, peso, categorias_item(nome)').eq('status', 'ativo').order('nome'),
    supabase.from('item_receita').select('item_id, ingrediente_id, quantidade'),
    supabase.from('item_preco_vigente').select('item_id, preco_sujo, preco_limpo'),
    supabase.from('lojas').select('id, nome').eq('status', 'ativo').order('nome'),
    supabase.from('loja_item_precos').select('loja_id, item_id, preco, preco_sujo'),
    supabase.from('usuario_favoritos').select('item_id').eq('usuario_id', user.id),
    supabase.from('usuarios').select('perfis_acesso(perfil_permissoes(modulo, pode_editar))').eq('id', user.id).maybeSingle(),
    supabase.from('usuarios').select('local_trabalho_loja_id, local_trabalho_faccao_id').eq('id', user.id).maybeSingle(),
    supabase.from('servicos').select('id, nome, descricao, preco_sujo, preco_limpo, desconto_pct').eq('status', 'ativo').order('nome'),
    supabase.from('servico_itens').select('servico_id, item_id, quantidade, items(nome)'),
  ])

  const meuLojaId    = usuarioRow?.local_trabalho_loja_id ?? null
  const meuFaccaoId  = usuarioRow?.local_trabalho_faccao_id ?? null

  // Buscar preços da facção do usuário (se tiver)
  const { data: faccaoPrecosData } = meuFaccaoId
    ? await supabase.from('faccao_item_precos').select('faccao_id, item_id, preco_limpo, preco_sujo').eq('faccao_id', meuFaccaoId)
    : { data: [] }

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const servicoItensMapped = (servicoItensData ?? []).map((si: any) => ({
    servico_id: si.servico_id,
    item_id: si.item_id,
    quantidade: si.quantidade,
    item_nome: Array.isArray(si.items) ? (si.items[0]?.nome ?? '') : (si.items?.nome ?? ''),
  }))

  return (
    <>
      <Header title="Calculadora" />
      <CalculadoraClient
        userId={user.id}
        items={items}
        lojas={lojasData ?? []}
        precosVigentes={precosVigentesData ?? []}
        lojaPrecos={lojaPrecosData ?? []}
        faccaoPrecos={faccaoPrecosData ?? []}
        meuLojaId={meuLojaId}
        meuFaccaoId={meuFaccaoId}
        favoritosIniciais={(favoritosData ?? []).map(f => f.item_id)}
        podeEditar={podeEditar}
        servicos={servicosData ?? []}
        servicoItens={servicoItensMapped}
      />
    </>
  )
}

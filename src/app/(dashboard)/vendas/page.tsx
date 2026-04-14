import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { VendasClient } from './vendas-client'

export default async function VendasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: vendasData },
    { data: vendaItensData },
    { data: faccoesData },
    { data: itemsData },
    { data: receitasData },
    { data: estoqueMov },
    { data: estoqueAtual },
    { data: membrosData },
    { data: lojasData },
    { data: permRow },
    { data: usuarioRow },
    { data: configOcultar },
    { data: servicosData },
    { data: servicoItensData },
    { data: favoritosData },
  ] = await Promise.all([
    supabase.from('vendas').select('*').order('created_at', { ascending: false }),
    supabase.from('venda_itens').select('*, servico_id'),
    supabase.from('faccoes').select('id, nome, sigla, telefone, desconto_padrao_pct').eq('status', 'ativo').order('nome'),
    supabase.from('items').select('id, nome, tem_craft, peso, categorias_item(nome)').eq('status', 'ativo').order('nome'),
    supabase.from('item_receita').select('item_id, ingrediente_id, quantidade'),
    supabase.from('estoque_movimentos').select('item_id, tipo, quantidade, created_at'),
    supabase.from('estoque_atualizacoes').select('item_id, quantidade, created_at').order('created_at', { ascending: false }),
    supabase.from('membros').select('id, nome, vulgo, telefone, faccao_id').eq('status', 'ativo').order('nome'),
    supabase.from('lojas').select('id, nome').eq('status', 'ativo').order('nome'),
    supabase.from('usuarios').select('perfis_acesso(perfil_permissoes(modulo, pode_editar))').eq('id', user.id).maybeSingle(),
    supabase.from('usuarios').select('nome, local_trabalho_loja_id, local_trabalho_faccao_id').eq('id', user.id).maybeSingle(),
    supabase.from('config_sistema').select('valor').eq('chave', 'ocultar_concluidos_dias').maybeSingle(),
    supabase.from('servicos').select('id, nome, descricao, preco_sujo, preco_limpo, desconto_pct, categoria').eq('status', 'ativo').order('nome'),
    supabase.from('servico_itens').select('servico_id, item_id, quantidade, items(nome, tem_craft)'),
    supabase.from('usuario_favoritos').select('item_id').eq('usuario_id', user.id),
  ])

  // Calcular saldo de estoque por item a partir das movimentações
  const ultimaAtualizacao: Record<string, { quantidade: number; created_at: string }> = {}
  for (const a of estoqueAtual ?? []) {
    const prev = ultimaAtualizacao[a.item_id]
    if (!prev || new Date(a.created_at) > new Date(prev.created_at)) {
      ultimaAtualizacao[a.item_id] = a
    }
  }
  const allMovItemIds = new Set([
    ...Object.keys(ultimaAtualizacao),
    ...(estoqueMov ?? []).map(m => m.item_id),
  ])
  const estoqueCalculado: { item_id: string; quantidade: number }[] = []
  for (const itemId of allMovItemIds) {
    const base = ultimaAtualizacao[itemId]
    const cutoff = base ? new Date(base.created_at) : null
    const movs = (estoqueMov ?? []).filter(m => m.item_id === itemId && (!cutoff || new Date(m.created_at) > cutoff))
    const entradas = movs.filter(m => m.tipo === 'entrada').reduce((s, m) => s + m.quantidade, 0)
    const saidas   = movs.filter(m => m.tipo === 'saida').reduce((s, m) => s + m.quantidade, 0)
    const saldo = (base?.quantidade ?? 0) + entradas - saidas
    estoqueCalculado.push({ item_id: itemId, quantidade: Math.max(0, saldo) })
  }

  const meuLojaId   = usuarioRow?.local_trabalho_loja_id ?? null
  const meuFaccaoId = usuarioRow?.local_trabalho_faccao_id ?? null

  const meuLoja   = meuLojaId   ? (lojasData   ?? []).find(l => l.id === meuLojaId)   ?? null : null
  const meuFaccao = meuFaccaoId ? (faccoesData  ?? []).find(f => f.id === meuFaccaoId) ?? null : null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const perms = (permRow as any)?.perfis_acesso?.perfil_permissoes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const podeEditar = perms == null ? true : (perms.find((p: any) => p.modulo === 'vendas')?.pode_editar ?? false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const podeExcluirConcluida = perms == null ? true : (perms.find((p: any) => p.modulo === 'vendas_excluir_concluida')?.pode_editar ?? false)
  const ocultarConcluidosDias = configOcultar?.valor ? parseInt(configOcultar.valor) || 0 : 7

  const itensPorVenda: Record<string, typeof vendaItensData> = {}
  for (const it of vendaItensData ?? []) {
    if (!itensPorVenda[it.venda_id]) itensPorVenda[it.venda_id] = []
    itensPorVenda[it.venda_id]!.push(it)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vendas = (vendasData ?? []).map((v: any) => ({ ...v, itens: itensPorVenda[v.id] ?? [] }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (itemsData ?? []).map((item: any) => ({
    ...item,
    categorias_item: Array.isArray(item.categorias_item) ? (item.categorias_item[0] ?? null) : item.categorias_item,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const servicoItensMapped = (servicoItensData ?? []).map((si: any) => ({
    servico_id: si.servico_id,
    item_id: si.item_id,
    quantidade: si.quantidade,
    item_nome: Array.isArray(si.items) ? (si.items[0]?.nome ?? '') : (si.items?.nome ?? ''),
    tem_craft: Array.isArray(si.items) ? (si.items[0]?.tem_craft ?? false) : (si.items?.tem_craft ?? false),
  }))

  return (
    <>
      <Header title="Vendas" />
      <VendasClient
        userId={user.id}
        userNome={usuarioRow?.nome ?? null}
        vendas={vendas}
        faccoes={faccoesData ?? []}
        allItems={items}
        receitas={receitasData ?? []}
        estoque={estoqueCalculado}
        lojas={lojasData ?? []}
        membros={membrosData ?? []}
        meuLoja={meuLoja ? { id: meuLoja.id, nome: meuLoja.nome } : null}
        meuFaccao={meuFaccao ? { id: meuFaccao.id, nome: meuFaccao.nome } : null}
        filtroInicial="todos"
        podeEditar={podeEditar}
        podeExcluirConcluida={podeExcluirConcluida}
        ocultarConcluidosDias={ocultarConcluidosDias}
        servicos={servicosData ?? []}
        servicoItens={servicoItensMapped}
        favoritosIniciais={(favoritosData ?? []).map((f: { item_id: string }) => f.item_id)}
      />
    </>
  )
}

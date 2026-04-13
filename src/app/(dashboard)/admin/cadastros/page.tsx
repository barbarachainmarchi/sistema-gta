import { createClient } from '@/lib/supabase/server'
import { CadastrosClient } from './cadastros-client'

export default async function CadastrosPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const [itemsResult, categoriasResult, lojasResult, faccoesResult, usuarioResult, servicosResult, servicoItensResult] = await Promise.all([
    supabase.from('items').select('*, categorias_item (id, nome)').order('nome'),
    supabase.from('categorias_item').select('*').order('nome'),
    supabase.from('lojas').select('id, nome, localizacao').order('nome'),
    supabase.from('faccoes').select('id, nome, tag').order('nome'),
    user ? supabase.from('usuarios').select('local_trabalho_loja_id, local_trabalho_faccao_id').eq('id', user.id).single() : Promise.resolve({ data: null }),
    supabase.from('servicos').select('*').order('nome'),
    supabase.from('servico_itens').select('id, servico_id, item_id, quantidade, items(nome, tem_craft)'),
  ])

  const u = usuarioResult.data
  let localTrabalhoLoja: { id: string; nome: string } | null = null
  let localTrabalhoFaccao: { id: string; nome: string } | null = null
  if (u?.local_trabalho_loja_id) {
    const loja = (lojasResult.data ?? []).find(l => l.id === u.local_trabalho_loja_id)
    if (loja) localTrabalhoLoja = { id: loja.id, nome: loja.nome }
  }
  if (u?.local_trabalho_faccao_id) {
    const faccao = (faccoesResult.data ?? []).find(f => f.id === u.local_trabalho_faccao_id)
    if (faccao) localTrabalhoFaccao = { id: faccao.id, nome: faccao.nome }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const servicoItens = (servicoItensResult.data ?? []).map((si: any) => ({
    id: si.id,
    servico_id: si.servico_id,
    item_id: si.item_id,
    quantidade: si.quantidade,
    item_nome: Array.isArray(si.items) ? (si.items[0]?.nome ?? '') : (si.items?.nome ?? ''),
    tem_craft: Array.isArray(si.items) ? (si.items[0]?.tem_craft ?? false) : (si.items?.tem_craft ?? false),
  }))

  return (
    <CadastrosClient
      initialItems={itemsResult.data || []}
      categorias={categoriasResult.data || []}
      lojas={lojasResult.data || []}
      faccoes={(faccoesResult.data || []).map(f => ({ id: f.id, nome: f.nome, tag: f.tag ?? null }))}
      userId={user?.id ?? ''}
      localTrabalhoLoja={localTrabalhoLoja}
      localTrabalhoFaccao={localTrabalhoFaccao}
      initialServicos={servicosResult.data || []}
      initialServicoItens={servicoItens}
    />
  )
}

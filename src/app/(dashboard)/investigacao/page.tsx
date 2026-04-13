import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { InvestigacaoClient } from './investigacao-client'

export default async function InvestigacaoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: faccoes },
    { data: membros },
    { data: veiculos },
    { data: lojas },
    { data: todosProdutos },
    { data: faccaoPrecos },
    { data: lojaMembrosRaw },
  ] = await Promise.all([
    supabase.from('faccoes').select('*').order('nome'),
    supabase.from('membros').select('*, faccoes(id, nome, cor_tag)').order('nome'),
    supabase.from('veiculos').select('*').order('placa'),
    supabase.from('lojas').select('*').order('nome'),
    supabase.from('items').select('id, nome, categorias_item(nome)').eq('status', 'ativo').order('nome'),
    supabase.from('faccao_item_precos').select('*'),
    supabase.from('loja_membros').select('membro_id, loja_id'),
  ])

  // Monta mapa membro_id → nomes das lojas onde trabalha
  const lojaPorMembro: Record<string, string[]> = {}
  for (const lm of (lojaMembrosRaw ?? [])) {
    const loja = (lojas ?? []).find(l => l.id === lm.loja_id)
    if (!loja) continue
    if (!lojaPorMembro[lm.membro_id]) lojaPorMembro[lm.membro_id] = []
    lojaPorMembro[lm.membro_id].push(loja.nome)
  }

  return (
    <InvestigacaoClient
      initialFaccoes={faccoes ?? []}
      initialMembros={membros ?? []}
      initialVeiculos={veiculos ?? []}
      initialLojas={lojas ?? []}
      todosProdutos={(todosProdutos ?? []).map((item: { id: string; nome: string; categorias_item: { nome: string } | { nome: string }[] | null }) => ({
        id: item.id,
        nome: item.nome,
        categoria: Array.isArray(item.categorias_item) ? (item.categorias_item[0]?.nome ?? null) : (item.categorias_item?.nome ?? null),
      }))}
      initialFaccaoPrecos={faccaoPrecos ?? []}
      lojaPorMembro={lojaPorMembro}
    />
  )
}

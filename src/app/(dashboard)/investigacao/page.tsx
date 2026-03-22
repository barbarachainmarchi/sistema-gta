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
    { data: meusProdutos },
    { data: precoPadrao },
    { data: faccaoPrecos },
  ] = await Promise.all([
    supabase.from('faccoes').select('*').order('nome'),
    supabase.from('membros').select('*, faccoes(id, nome, cor_tag)').order('nome'),
    supabase.from('veiculos').select('*').order('placa'),
    supabase.from('lojas').select('*').order('nome'),
    supabase.from('items').select('id, nome').eq('eh_meu_produto', true).eq('status', 'ativo').order('nome'),
    supabase.from('item_preco_vigente').select('item_id, preco_sujo, preco_limpo'),
    supabase.from('faccao_item_precos').select('*'),
  ])

  return (
    <InvestigacaoClient
      initialFaccoes={faccoes ?? []}
      initialMembros={membros ?? []}
      initialVeiculos={veiculos ?? []}
      initialLojas={lojas ?? []}
      meusProdutos={meusProdutos ?? []}
      precoPadrao={precoPadrao ?? []}
      initialFaccaoPrecos={faccaoPrecos ?? []}
    />
  )
}

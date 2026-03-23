import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { CotacaoEditor } from './cotacao-editor'

export default async function CotacaoEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: cotacao },
    { data: pessoas },
    { data: itens },
    { data: faccoes },
    { data: lojas },
    { data: membros },
    { data: faccaoPrecos },
    { data: lojaPrecos },
  ] = await Promise.all([
    supabase.from('cotacoes').select('*').eq('id', id).single(),
    supabase.from('cotacao_pessoas').select('*').eq('cotacao_id', id).order('criado_at'),
    supabase.from('cotacao_itens').select('*').eq('cotacao_id', id).order('criado_at'),
    supabase.from('faccoes').select('id, nome, cor_tag').eq('status', 'ativo').order('nome'),
    supabase.from('lojas').select('id, nome').eq('status', 'ativo').order('nome'),
    supabase.from('membros').select('id, nome, vulgo').eq('status', 'ativo').order('nome'),
    supabase.from('faccao_item_precos').select('faccao_id, item_id, preco_sujo, preco_limpo, items(nome)'),
    supabase.from('loja_item_precos').select('loja_id, item_id, preco, preco_sujo, items(nome)'),
  ])

  if (!cotacao) notFound()

  return (
    <>
      <Header title={cotacao.titulo ?? cotacao.fornecedor_nome} description="Cotação" />
      <CotacaoEditor
        cotacao={cotacao}
        pessoasIniciais={pessoas ?? []}
        itensIniciais={itens ?? []}
        faccoes={faccoes ?? []}
        lojas={lojas ?? []}
        membros={membros ?? []}
        faccaoPrecos={faccaoPrecos ?? []}
        lojaPrecos={lojaPrecos ?? []}
      />
    </>
  )
}

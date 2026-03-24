import { createClient } from '@/lib/supabase/server'
import { CadastrosClient } from './cadastros-client'

export default async function CadastrosPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const [itemsResult, categoriasResult, lojasResult, faccoesResult, usuarioResult] = await Promise.all([
    supabase.from('items').select('*, categorias_item (id, nome)').order('nome'),
    supabase.from('categorias_item').select('*').order('nome'),
    supabase.from('lojas').select('id, nome, localizacao').order('nome'),
    supabase.from('faccoes').select('id, nome, tag').order('nome'),
    user ? supabase.from('usuarios').select('local_trabalho_loja_id, local_trabalho_faccao_id').eq('id', user.id).single() : Promise.resolve({ data: null }),
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

  return (
    <CadastrosClient
      initialItems={itemsResult.data || []}
      categorias={categoriasResult.data || []}
      lojas={lojasResult.data || []}
      faccoes={(faccoesResult.data || []).map(f => ({ id: f.id, nome: f.nome, tag: f.tag ?? null }))}
      userId={user?.id ?? ''}
      localTrabalhoLoja={localTrabalhoLoja}
      localTrabalhoFaccao={localTrabalhoFaccao}
    />
  )
}

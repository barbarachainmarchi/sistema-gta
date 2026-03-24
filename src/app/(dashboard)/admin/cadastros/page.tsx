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
    user ? supabase.from('usuarios').select('local_trabalho_tipo, local_trabalho_id').eq('id', user.id).single() : Promise.resolve({ data: null }),
  ])

  // Resolve o nome do local de trabalho
  const u = usuarioResult.data
  let localTrabalho: { tipo: 'loja' | 'faccao'; id: string; nome: string } | null = null
  if (u?.local_trabalho_tipo && u?.local_trabalho_id) {
    if (u.local_trabalho_tipo === 'loja') {
      const loja = (lojasResult.data ?? []).find(l => l.id === u.local_trabalho_id)
      if (loja) localTrabalho = { tipo: 'loja', id: loja.id, nome: loja.nome }
    } else {
      const faccao = (faccoesResult.data ?? []).find(f => f.id === u.local_trabalho_id)
      if (faccao) localTrabalho = { tipo: 'faccao', id: faccao.id, nome: faccao.nome }
    }
  }

  return (
    <CadastrosClient
      initialItems={itemsResult.data || []}
      categorias={categoriasResult.data || []}
      lojas={lojasResult.data || []}
      faccoes={(faccoesResult.data || []).map(f => ({ id: f.id, nome: f.nome, tag: f.tag ?? null }))}
      userId={user?.id ?? ''}
      localTrabalho={localTrabalho}
    />
  )
}

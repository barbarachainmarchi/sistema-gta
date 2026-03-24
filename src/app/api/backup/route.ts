import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const modulo = req.nextUrl.searchParams.get('modulo') ?? 'tudo'

  const tabelas: Record<string, unknown[]> = {}

  async function q(nome: string, table: string, select = '*') {
    const { data } = await supabase.from(table).select(select).order('created_at' as never)
    tabelas[nome] = data ?? []
  }

  if (modulo === 'produtos' || modulo === 'tudo') {
    await q('categorias_item', 'categorias_item')
    await q('items', 'items')
    await q('item_receita', 'item_receita')
    await q('item_precos', 'item_precos')
    await q('item_reciclagem', 'item_reciclagem')
  }

  if (modulo === 'investigacao' || modulo === 'tudo') {
    await q('faccoes', 'faccoes')
    await q('membros', 'membros')
    await q('veiculos', 'veiculos')
    await q('lojas', 'lojas')
    await q('loja_item_precos', 'loja_item_precos')
    await q('loja_membros', 'loja_membros')
    await q('faccao_item_precos', 'faccao_item_precos')
  }

  if (modulo === 'financeiro' || modulo === 'tudo') {
    await q('financeiro_contas', 'financeiro_contas')
    await q('financeiro_lancamentos', 'financeiro_lancamentos')
    await q('financeiro_lavagem', 'financeiro_lavagem')
  }

  return NextResponse.json({
    versao: '1.0',
    modulo,
    exportado_em: new Date().toISOString(),
    tabelas,
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const { modulo, tabelas } = body as { modulo: string; tabelas: Record<string, unknown[]> }

  const resultados: Record<string, { ok: boolean; count: number; erro?: string }> = {}

  const ORDEM_UPSERT: Record<string, string[]> = {
    produtos: ['categorias_item', 'items', 'item_receita', 'item_precos', 'item_reciclagem'],
    investigacao: ['faccoes', 'membros', 'veiculos', 'lojas', 'loja_item_precos', 'loja_membros', 'faccao_item_precos'],
    financeiro: ['financeiro_contas', 'financeiro_lancamentos', 'financeiro_lavagem'],
    tudo: ['categorias_item', 'items', 'item_receita', 'item_precos', 'item_reciclagem', 'faccoes', 'membros', 'veiculos', 'lojas', 'loja_item_precos', 'loja_membros', 'faccao_item_precos', 'financeiro_contas', 'financeiro_lancamentos', 'financeiro_lavagem'],
  }

  const ordem = ORDEM_UPSERT[modulo] ?? Object.keys(tabelas)

  for (const nome of ordem) {
    const rows = tabelas[nome]
    if (!rows || rows.length === 0) { resultados[nome] = { ok: true, count: 0 }; continue }
    const { error } = await supabase.from(nome as never).upsert(rows as never[], { onConflict: 'id' })
    resultados[nome] = error ? { ok: false, count: 0, erro: error.message } : { ok: true, count: rows.length }
  }

  const temErro = Object.values(resultados).some(r => !r.ok)
  return NextResponse.json({ ok: !temErro, resultados }, { status: temErro ? 207 : 200 })
}

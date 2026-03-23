import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MapPin, Tag, Package } from 'lucide-react'
import { cn } from '@/lib/utils'

function fmt(v: number | null) {
  if (v == null) return '—'
  return `R$ ${v.toLocaleString('pt-BR')}`
}

export default async function LojaRelatorioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [
    { data: loja },
    { data: precos },
  ] = await Promise.all([
    supabase.from('lojas').select('*').eq('id', id).single(),
    supabase.from('loja_item_precos').select('*, items(nome, categorias_item(nome))').eq('loja_id', id).order('items(nome)'),
  ])

  if (!loja) notFound()

  // Agrupar por categoria
  type ItemPreco = { id: string; item_id: string; preco: number; items: { nome: string; categorias_item: { nome: string } | null } | null }
  const itens = (precos ?? []) as ItemPreco[]

  const porCategoria = itens.reduce<Record<string, ItemPreco[]>>((acc, item) => {
    const cat = item.items?.categorias_item?.nome ?? 'Sem categoria'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {})

  const categorias = Object.keys(porCategoria).sort()

  return (
    <div className="flex-1 p-6 max-w-3xl mx-auto space-y-6">
      {/* Voltar */}
      <Link href="/investigacao" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar para Investigação
      </Link>

      {/* Header da loja */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">{loja.nome}</h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {loja.localizacao && (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />{loja.localizacao}
                </span>
              )}
              {loja.tipo && (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Tag className="h-3.5 w-3.5" />{loja.tipo}
                </span>
              )}
            </div>
          </div>
          <span className={cn(
            'text-xs px-2 py-1 rounded-full font-medium shrink-0',
            loja.status === 'ativo' ? 'bg-green-500/10 text-green-400' : 'bg-zinc-500/10 text-zinc-500'
          )}>
            {loja.status === 'ativo' ? 'Ativa' : 'Inativa'}
          </span>
        </div>

        <div className="border-t border-border pt-3 flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            <strong className="text-foreground">{itens.length}</strong> {itens.length === 1 ? 'item cadastrado' : 'itens cadastrados'}
          </span>
        </div>
      </div>

      {/* Itens agrupados por categoria */}
      {itens.length === 0 ? (
        <div className="rounded-lg border border-border py-12 text-center text-sm text-muted-foreground">
          Nenhum item cadastrado para esta loja
        </div>
      ) : (
        <div className="space-y-4">
          {categorias.map(cat => (
            <section key={cat} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">{cat}</h2>
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="grid grid-cols-[1fr_120px] gap-3 px-4 py-2 bg-white/[0.02] border-b border-border text-[11px] text-muted-foreground font-medium">
                  <span>Item</span><span className="text-right">Preço</span>
                </div>
                {porCategoria[cat].map((item, idx) => (
                  <div key={item.id} className={cn('grid grid-cols-[1fr_120px] gap-3 items-center px-4 py-2.5', idx < porCategoria[cat].length - 1 && 'border-b border-border/40')}>
                    <span className="text-sm font-medium">{item.items?.nome ?? '—'}</span>
                    <span className="text-sm text-right font-medium tabular-nums">{fmt(item.preco)}</span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Search, Loader2, MessageCircle } from 'lucide-react'
import type { SbClient } from './financeiro-client'

// ── Tipos ─────────────────────────────────────────────────────────────────────

type SupplierRow = {
  faccao_id?: string
  loja_id?: string
  supplier_nome: string
  supplier_tipo: 'faccao' | 'loja'
  supplier_is_darkchat?: boolean
  preco_sujo: number | null
  preco_limpo: number | null
}

type GroupedItem = {
  item_id: string
  item_nome: string
  suppliers: SupplierRow[]
}

type DeepProd = {
  item_id: string
  item_nome: string
  preco_sujo: number | null
  preco_limpo: number | null
}

export type BrowseProdutoResult = {
  origem: string
  descricao: string
  preco: number | null
}

interface Props {
  open: boolean
  onClose: () => void
  onConfirm: (result: BrowseProdutoResult) => void
  tipoDinheiro: 'sujo' | 'limpo'
  sb: SbClient
}

function fmt(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

// ── Componente ────────────────────────────────────────────────────────────────

export function BrowseProdutoDialog({ open, onClose, onConfirm, tipoDinheiro, sb }: Props) {
  const [tab, setTab] = useState<'produto' | 'deep'>('produto')
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(false)
  const [grupos, setGrupos] = useState<GroupedItem[]>([])
  const [deepFaccao, setDeepFaccao] = useState<{ id: string; nome: string; is_darkchat: boolean; deep: string | null } | null>(null)
  const [deepProdutos, setDeepProdutos] = useState<DeepProd[]>([])
  const [deepConfirmado, setDeepConfirmado] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open) {
      setBusca('')
      setGrupos([])
      setDeepFaccao(null)
      setDeepProdutos([])
      setDeepConfirmado(false)
      setLoading(false)
    }
  }, [open])

  useEffect(() => {
    if (!open || !busca.trim()) {
      setGrupos([])
      setDeepFaccao(null)
      setDeepProdutos([])
      setDeepConfirmado(false)
      return
    }
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      if (tab === 'produto') buscarPorProduto(busca.trim())
      else buscarPorDeep(busca.trim())
    }, 350)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, tab, open])

  async function buscarPorProduto(q: string) {
    setLoading(true)
    setGrupos([])

    const { data: items } = await sb()
      .from('items')
      .select('id, nome, apelidos')
      .or(`nome.ilike.%${q}%,apelidos.ilike.%${q}%`)
      .eq('status', 'ativo')
      .limit(20)

    if (!items || items.length === 0) { setLoading(false); return }
    const itemIds = items.map((i: { id: string }) => i.id)

    const [{ data: fprices }, { data: lprices }] = await Promise.all([
      sb()
        .from('faccao_item_precos')
        .select('faccao_id, item_id, preco_limpo, preco_sujo, faccoes(id, nome, is_darkchat)')
        .in('item_id', itemIds),
      sb()
        .from('loja_item_precos')
        .select('loja_id, item_id, preco, preco_sujo, lojas(id, nome)')
        .in('item_id', itemIds),
    ])

    const map: Record<string, GroupedItem> = {}
    for (const item of items) {
      map[item.id] = { item_id: item.id, item_nome: item.nome, suppliers: [] }
    }

    for (const fp of (fprices ?? [])) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = (fp as any).faccoes
      if (!raw || !map[fp.item_id]) continue
      const fac = Array.isArray(raw) ? raw[0] : raw
      if (!fac) continue
      map[fp.item_id].suppliers.push({
        faccao_id: fp.faccao_id,
        supplier_nome: fac.nome,
        supplier_tipo: 'faccao',
        supplier_is_darkchat: fac.is_darkchat,
        preco_sujo: fp.preco_sujo,
        preco_limpo: fp.preco_limpo,
      })
    }

    for (const lp of (lprices ?? [])) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = (lp as any).lojas
      if (!raw || !map[lp.item_id]) continue
      const loja = Array.isArray(raw) ? raw[0] : raw
      if (!loja) continue
      map[lp.item_id].suppliers.push({
        loja_id: lp.loja_id,
        supplier_nome: loja.nome,
        supplier_tipo: 'loja',
        preco_sujo: lp.preco_sujo,
        preco_limpo: lp.preco,
      })
    }

    setGrupos(Object.values(map).filter(g => g.suppliers.length > 0))
    setLoading(false)
  }

  async function buscarPorDeep(q: string) {
    setLoading(true)
    setDeepFaccao(null)
    setDeepProdutos([])
    setDeepConfirmado(false)

    const { data: faccoes } = await sb()
      .from('faccoes')
      .select('id, nome, is_darkchat, deep')
      .or(`deep.ilike.%${q}%,nome.ilike.%${q}%`)
      .eq('status', 'ativo')
      .limit(1)

    const fac = (faccoes as { id: string; nome: string; is_darkchat: boolean; deep: string | null }[] | null)?.[0]
    if (!fac) { setLoading(false); return }
    setDeepFaccao(fac)

    const { data: prods } = await sb()
      .from('faccao_item_precos')
      .select('item_id, preco_limpo, preco_sujo, items(id, nome)')
      .eq('faccao_id', fac.id)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setDeepProdutos((prods ?? []).map((p: any) => ({
      item_id: p.item_id,
      item_nome: Array.isArray(p.items) ? (p.items[0]?.nome ?? '') : (p.items?.nome ?? ''),
      preco_sujo: p.preco_sujo,
      preco_limpo: p.preco_limpo,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    })).sort((a: any, b: any) => a.item_nome.localeCompare(b.item_nome)))

    setLoading(false)
  }

  function selecionar(s: SupplierRow, item_nome: string) {
    const preco = tipoDinheiro === 'sujo' ? (s.preco_sujo ?? s.preco_limpo) : (s.preco_limpo ?? s.preco_sujo)
    onConfirm({ origem: s.supplier_nome, descricao: item_nome, preco: preco ?? null })
    onClose()
  }

  function selecionarDeepProd(p: DeepProd) {
    if (!deepFaccao) return
    const preco = tipoDinheiro === 'sujo' ? (p.preco_sujo ?? p.preco_limpo) : (p.preco_limpo ?? p.preco_sujo)
    onConfirm({ origem: deepFaccao.nome, descricao: p.item_nome, preco: preco ?? null })
    onClose()
  }

  function switchTab(t: 'produto' | 'deep') {
    setTab(t)
    setBusca('')
    setGrupos([])
    setDeepFaccao(null)
    setDeepProdutos([])
    setDeepConfirmado(false)
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="px-5 pt-5 pb-3 shrink-0 border-b border-border">
          <DialogTitle>Buscar produto para compra</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0">
          <button onClick={() => switchTab('produto')}
            className={cn('flex-1 py-2.5 text-xs font-medium transition-colors flex items-center justify-center gap-1.5',
              tab === 'produto' ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
            )}>
            <Search className="h-3 w-3" /> Por produto / apelido
          </button>
          <button onClick={() => switchTab('deep')}
            className={cn('flex-1 py-2.5 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 border-l border-border',
              tab === 'deep' ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
            )}>
            <MessageCircle className="h-3 w-3" /> Deep / Darkchat
          </button>
        </div>

        {/* Search input */}
        <div className="px-4 py-3 shrink-0 border-b border-border">
          <div className="relative">
            {loading
              ? <Loader2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground animate-spin" />
              : <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            }
            <Input
              autoFocus
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder={tab === 'produto' ? 'Nome ou apelido do produto...' : 'Deep, endereço ou nome da facção...'}
              className="pl-8 h-9 text-sm"
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            Preços para dinheiro{' '}
            <span className={cn('font-medium', tipoDinheiro === 'sujo' ? 'text-orange-400' : 'text-emerald-400')}>
              {tipoDinheiro}
            </span>
          </p>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">

          {/* ── Modo Produto ── */}
          {tab === 'produto' && (
            <>
              {!busca.trim() && (
                <p className="text-xs text-muted-foreground text-center py-10">Digite o nome ou apelido do produto</p>
              )}
              {busca.trim() && !loading && grupos.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-10">Nenhum produto encontrado para &quot;{busca}&quot;</p>
              )}
              {grupos.map(g => (
                <div key={g.item_id}>
                  <p className="text-xs font-semibold text-foreground mb-1 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                    {g.item_nome}
                  </p>
                  <div className="rounded-md border border-border overflow-hidden">
                    {g.suppliers.map((s, i) => {
                      const preco = tipoDinheiro === 'sujo' ? (s.preco_sujo ?? s.preco_limpo) : (s.preco_limpo ?? s.preco_sujo)
                      return (
                        <div key={i} className={cn('flex items-center gap-2 px-3 py-2.5 hover:bg-white/[0.03] transition-colors', i > 0 && 'border-t border-border/40')}>
                          <span className={cn('text-[9px] font-bold px-1 py-0.5 rounded shrink-0',
                            s.supplier_tipo === 'faccao' ? 'bg-primary/15 text-primary' : 'bg-blue-500/15 text-blue-400'
                          )}>
                            {s.supplier_tipo === 'faccao' ? 'F' : 'L'}
                          </span>
                          <span className="text-sm flex-1 min-w-0 truncate">{s.supplier_nome}</span>
                          {s.supplier_is_darkchat && (
                            <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-cyan-500/15 text-cyan-400 shrink-0">DC</span>
                          )}
                          <span className="text-xs tabular-nums text-muted-foreground shrink-0">
                            {preco != null ? fmt(preco) : '—'}
                          </span>
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs shrink-0" onClick={() => selecionar(s, g.item_nome)}>
                            Usar
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </>
          )}

          {/* ── Modo Deep/Darkchat ── */}
          {tab === 'deep' && (
            <>
              {!busca.trim() && (
                <p className="text-xs text-muted-foreground text-center py-10">Digite o endereço deep ou nome da facção</p>
              )}
              {busca.trim() && !loading && !deepFaccao && (
                <p className="text-xs text-muted-foreground text-center py-10">Nenhuma facção encontrada para &quot;{busca}&quot;</p>
              )}
              {deepFaccao && (
                <div className="space-y-3">
                  <div className={cn('rounded-lg border p-3 space-y-1.5',
                    deepFaccao.is_darkchat ? 'border-cyan-500/30 bg-cyan-500/[0.03]' : 'border-border'
                  )}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{deepFaccao.nome}</span>
                      {deepFaccao.is_darkchat && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400">DC</span>
                      )}
                    </div>
                    {deepFaccao.deep && (
                      <p className="text-[11px] text-muted-foreground font-mono break-all">{deepFaccao.deep}</p>
                    )}
                    {!deepConfirmado && (
                      <Button size="sm" variant="outline" className="h-7 text-xs mt-1" onClick={() => setDeepConfirmado(true)}>
                        Vincular compra a {deepFaccao.nome}
                      </Button>
                    )}
                    {deepConfirmado && (
                      <p className="text-[11px] text-emerald-400">Vinculado — selecione o produto abaixo</p>
                    )}
                  </div>

                  {deepConfirmado && (
                    deepProdutos.length === 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground text-center py-4">Nenhum produto cadastrado para esta facção</p>
                        <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={() => {
                          onConfirm({ origem: deepFaccao!.nome, descricao: '', preco: null })
                          onClose()
                        }}>
                          Usar só a facção como origem
                        </Button>
                      </div>
                    ) : (
                      <div className="rounded-md border border-border overflow-hidden">
                        {deepProdutos.map((p, i) => {
                          const preco = tipoDinheiro === 'sujo' ? (p.preco_sujo ?? p.preco_limpo) : (p.preco_limpo ?? p.preco_sujo)
                          return (
                            <div key={p.item_id} className={cn('flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.03] transition-colors', i > 0 && 'border-t border-border/40')}>
                              <span className="text-sm flex-1 min-w-0 truncate">{p.item_nome}</span>
                              <span className="text-xs tabular-nums text-muted-foreground shrink-0">
                                {preco != null ? fmt(preco) : '—'}
                              </span>
                              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs shrink-0" onClick={() => selecionarDeepProd(p)}>
                                Usar
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                    )
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

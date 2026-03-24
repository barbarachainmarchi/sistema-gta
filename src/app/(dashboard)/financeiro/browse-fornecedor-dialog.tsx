'use client'

import { useState, useEffect, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Plus, Minus, Loader2, Search, Store, Users, X } from 'lucide-react'
import type { SbClient } from './financeiro-client'

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Fornecedor = { id: string; nome: string; tag?: string }
type Produto = {
  item_id: string; nome: string
  preco_limpo: number | null; preco_sujo: number | null
  percentual: number | null; tipo_preco?: 'fixo' | 'percentual'
}
type CarrinhoItem = { item_id: string; nome: string; quantidade: number; preco: number | null }

export type BrowseResult = { descricao: string; total: number | null }

interface Props {
  open: boolean
  onClose: () => void
  onConfirm: (result: BrowseResult) => void
  tipoDinheiro: 'sujo' | 'limpo'
  sb: SbClient
}

function fmt(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

// ── Componente ────────────────────────────────────────────────────────────────

export function BrowseFornecedorDialog({ open, onClose, onConfirm, tipoDinheiro, sb }: Props) {
  const [tab, setTab]               = useState<'loja' | 'faccao'>('loja')
  const [lojas, setLojas]           = useState<Fornecedor[]>([])
  const [faccoes, setFaccoes]       = useState<Fornecedor[]>([])
  const [fornecedorId, setFornecedorId] = useState<string | null>(null)
  const [produtos, setProdutos]     = useState<Produto[]>([])
  const [carrinho, setCarrinho]     = useState<CarrinhoItem[]>([])
  const [loading, setLoading]       = useState(false)
  const [loadingProd, setLoadingProd] = useState(false)
  const [busca, setBusca]           = useState('')
  const [buscaProd, setBuscaProd]   = useState('')

  // Buscar lojas e facções na abertura
  useEffect(() => {
    if (!open) return
    setLoading(true)
    setFornecedorId(null)
    setProdutos([])
    setCarrinho([])
    setBusca('')
    setBuscaProd('')
    Promise.all([
      sb().from('lojas').select('id, nome').eq('status', 'ativo').order('nome'),
      sb().from('faccoes').select('id, nome, tag').order('nome'),
    ]).then(([{ data: l }, { data: f }]) => {
      setLojas(l ?? [])
      setFaccoes((f ?? []).map(x => ({ ...x, tag: x.tag ?? undefined })))
      setLoading(false)
    })
  }, [open, sb])

  // Buscar produtos quando fornecedor selecionado
  useEffect(() => {
    if (!fornecedorId) { setProdutos([]); return }
    setLoadingProd(true)
    setBuscaProd('')
    if (tab === 'loja') {
      sb().from('loja_item_precos')
        .select('item_id, preco, preco_sujo, items(id, nome)')
        .eq('loja_id', fornecedorId)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then(({ data }) => {
          setProdutos((data ?? []).map((r: any) => ({
            item_id: r.item_id,
            nome: r.items?.nome ?? r.item_id,
            preco_limpo: r.preco ?? null,
            preco_sujo: r.preco_sujo ?? null,
            percentual: null,
          })).sort((a: Produto, b: Produto) => a.nome.localeCompare(b.nome)))
          setLoadingProd(false)
        })
    } else {
      sb().from('faccao_item_precos')
        .select('item_id, preco_limpo, preco_sujo, tipo, percentual, items(id, nome)')
        .eq('faccao_id', fornecedorId)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then(({ data }) => {
          setProdutos((data ?? []).map((r: any) => ({
            item_id: r.item_id,
            nome: r.items?.nome ?? r.item_id,
            preco_limpo: r.preco_limpo ?? null,
            preco_sujo: r.preco_sujo ?? null,
            percentual: r.tipo === 'percentual' ? r.percentual : null,
            tipo_preco: r.tipo ?? 'fixo',
          })).sort((a: Produto, b: Produto) => a.nome.localeCompare(b.nome)))
          setLoadingProd(false)
        })
    }
  }, [fornecedorId, tab, sb])

  const fornecedores = tab === 'loja' ? lojas : faccoes
  const fornecedoresFiltrados = useMemo(() => {
    if (!busca.trim()) return fornecedores
    const q = busca.toLowerCase()
    return fornecedores.filter(f => f.nome.toLowerCase().includes(q) || f.tag?.toLowerCase().includes(q))
  }, [fornecedores, busca])

  const produtosFiltrados = useMemo(() => {
    if (!buscaProd.trim()) return produtos
    const q = buscaProd.toLowerCase()
    return produtos.filter(p => p.nome.toLowerCase().includes(q))
  }, [produtos, buscaProd])

  function addAoCarrinho(p: Produto) {
    const preco = tipoDinheiro === 'sujo' ? (p.preco_sujo ?? p.preco_limpo) : (p.preco_limpo ?? p.preco_sujo)
    setCarrinho(prev => {
      const existe = prev.find(c => c.item_id === p.item_id)
      if (existe) return prev.map(c => c.item_id === p.item_id ? { ...c, quantidade: c.quantidade + 1 } : c)
      return [...prev, { item_id: p.item_id, nome: p.nome, quantidade: 1, preco }]
    })
  }

  function setQtd(item_id: string, qtd: number) {
    if (qtd <= 0) { setCarrinho(prev => prev.filter(c => c.item_id !== item_id)); return }
    setCarrinho(prev => prev.map(c => c.item_id === item_id ? { ...c, quantidade: qtd } : c))
  }

  const totalCarrinho = useMemo(() => {
    const t = carrinho.reduce((s, c) => c.preco != null ? s + c.preco * c.quantidade : s, 0)
    return carrinho.some(c => c.preco == null) ? null : t
  }, [carrinho])

  function handleConfirm() {
    if (carrinho.length === 0) return
    const descricao = carrinho.map(c => `${c.nome} ×${c.quantidade}`).join(', ')
    onConfirm({ descricao, total: totalCarrinho })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="px-5 pt-5 pb-3 shrink-0 border-b border-border">
          <DialogTitle>Buscar produtos do fornecedor</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">

          {/* ── Coluna esquerda: fornecedores ── */}
          <div className="w-56 shrink-0 border-r border-border flex flex-col">
            {/* Tabs */}
            <div className="flex border-b border-border shrink-0">
              <button onClick={() => { setTab('loja'); setFornecedorId(null) }}
                className={cn('flex-1 py-2.5 text-xs font-medium transition-colors flex items-center justify-center gap-1.5',
                  tab === 'loja' ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
                )}>
                <Store className="h-3 w-3" /> Lojas
              </button>
              <button onClick={() => { setTab('faccao'); setFornecedorId(null) }}
                className={cn('flex-1 py-2.5 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 border-l border-border',
                  tab === 'faccao' ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
                )}>
                <Users className="h-3 w-3" /> Facções
              </button>
            </div>

            <div className="px-2 py-2 shrink-0">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)}
                  className="h-7 text-xs pl-6" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : fornecedoresFiltrados.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6 px-3">Nenhum encontrado</p>
              ) : fornecedoresFiltrados.map(f => (
                <button key={f.id} onClick={() => setFornecedorId(f.id)}
                  className={cn('w-full text-left px-3 py-2.5 text-xs border-b border-border/30 transition-colors',
                    fornecedorId === f.id ? 'bg-primary/10 text-foreground font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.02]'
                  )}>
                  {f.nome}
                  {f.tag && <span className="ml-1 text-[10px] opacity-60">[{f.tag}]</span>}
                </button>
              ))}
            </div>
          </div>

          {/* ── Coluna central: produtos ── */}
          <div className="flex-1 flex flex-col overflow-hidden border-r border-border">
            <div className="px-3 py-2 shrink-0 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input placeholder="Filtrar produtos..." value={buscaProd} onChange={e => setBuscaProd(e.target.value)}
                  className="h-7 text-xs pl-6" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {!fornecedorId ? (
                <p className="text-xs text-muted-foreground text-center py-10 px-4">
                  Selecione {tab === 'loja' ? 'uma loja' : 'uma facção'} ao lado
                </p>
              ) : loadingProd ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : produtosFiltrados.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8 px-3">Nenhum produto cadastrado</p>
              ) : produtosFiltrados.map(p => {
                const preco = tipoDinheiro === 'sujo'
                  ? (p.preco_sujo ?? p.preco_limpo)
                  : (p.preco_limpo ?? p.preco_sujo)
                const noCarrinho = carrinho.find(c => c.item_id === p.item_id)
                return (
                  <div key={p.item_id} className="flex items-center gap-2 px-3 py-2.5 border-b border-border/30 hover:bg-white/[0.02] group">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{p.nome}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {preco != null ? fmt(preco) : '—'}
                        {p.percentual != null && ` (${p.percentual > 0 ? '-' : '+'}${Math.abs(p.percentual)}%)`}
                      </p>
                    </div>
                    {noCarrinho ? (
                      <span className="text-[10px] text-primary font-medium">×{noCarrinho.quantidade}</span>
                    ) : null}
                    <button onClick={() => addAoCarrinho(p)}
                      className="shrink-0 h-6 w-6 rounded flex items-center justify-center hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Coluna direita: carrinho ── */}
          <div className="w-52 shrink-0 flex flex-col">
            <div className="px-3 py-2.5 border-b border-border shrink-0">
              <p className="text-xs font-medium">Selecionados ({carrinho.length})</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {carrinho.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8 px-3">Clique em + para adicionar</p>
              ) : carrinho.map(c => (
                <div key={c.item_id} className="flex items-center gap-1.5 px-3 py-2 border-b border-border/30">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate">{c.nome}</p>
                    {c.preco != null && (
                      <p className="text-[10px] text-muted-foreground">
                        {c.quantidade} × {fmt(c.preco)} = {fmt(c.preco * c.quantidade)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button onClick={() => setQtd(c.item_id, c.quantidade - 1)}
                      className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06]">
                      <Minus className="h-2.5 w-2.5" />
                    </button>
                    <span className="text-xs w-5 text-center tabular-nums">{c.quantidade}</span>
                    <button onClick={() => setQtd(c.item_id, c.quantidade + 1)}
                      className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06]">
                      <Plus className="h-2.5 w-2.5" />
                    </button>
                    <button onClick={() => setCarrinho(prev => prev.filter(x => x.item_id !== c.item_id))}
                      className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-white/[0.06] ml-0.5">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {carrinho.length > 0 && (
              <div className="p-3 border-t border-border shrink-0 space-y-2">
                {totalCarrinho != null && (
                  <p className="text-xs font-medium tabular-nums">Total: {fmt(totalCarrinho)}</p>
                )}
                <Button size="sm" className="w-full h-7 text-xs" onClick={handleConfirm}>
                  Confirmar
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

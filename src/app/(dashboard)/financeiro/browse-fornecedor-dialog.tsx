'use client'

import { useState, useEffect, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn, norm } from '@/lib/utils'
import { Plus, Minus, Loader2, Search, Store, Users, X } from 'lucide-react'
import type { SbClient } from './financeiro-client'

// ── Tipos ─────────────────────────────────────────────────────────────────────

type FaixaOpcao = { quantidade_min: number; preco_limpo: number | null; preco_sujo: number | null }

type Produto = {
  item_id: string; nome: string
  preco_limpo: number | null; preco_sujo: number | null
  percentual: number | null; tipo_preco: 'fixo' | 'percentual'
  faixas: FaixaOpcao[]
  preco_limpo_parceria: number | null; preco_sujo_parceria: number | null
  parceria_tipo: 'percentual' | 'fixo' | null; parceria_pct: number | null
  desconto_padrao_pct: number
}

type Fornecedor = { id: string; nome: string; tag?: string }
type CarrinhoItem = { item_id: string; nome: string; quantidade: number; preco_unitario: number | null }

export type BrowseResult = { descricao: string; total: number | null }

interface Props {
  open: boolean
  onClose: () => void
  onConfirm: (result: BrowseResult) => void
  tipoDinheiro: 'sujo' | 'limpo'
  sb: SbClient
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function parseBR(v: string): number | null {
  const n = parseFloat(v.replace(/\./g, '').replace(',', '.'))
  return isNaN(n) ? null : n
}

function calcBase(p: Produto, modo: 'sujo' | 'limpo'): number | null {
  const raw = modo === 'sujo' ? (p.preco_sujo ?? p.preco_limpo) : (p.preco_limpo ?? p.preco_sujo)
  if (raw == null) return null
  return p.desconto_padrao_pct > 0 ? Math.round(raw * (1 - p.desconto_padrao_pct / 100)) : raw
}

function calcParceria(p: Produto, modo: 'sujo' | 'limpo'): number | null {
  if (p.parceria_tipo === 'percentual' && p.parceria_pct != null) {
    const base = calcBase(p, modo)
    return base != null ? Math.round(base * (1 - p.parceria_pct / 100)) : null
  }
  if (p.parceria_tipo === 'fixo') {
    return modo === 'sujo'
      ? (p.preco_sujo_parceria ?? p.preco_limpo_parceria)
      : (p.preco_limpo_parceria ?? p.preco_sujo_parceria)
  }
  return null
}

function calcFaixa(f: FaixaOpcao, modo: 'sujo' | 'limpo'): number | null {
  return modo === 'sujo' ? (f.preco_sujo ?? f.preco_limpo) : (f.preco_limpo ?? f.preco_sujo)
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
      sb().from('faccoes').select('id, nome, sigla').order('nome'),
    ]).then(([{ data: l }, { data: f }]) => {
      setLojas(l ?? [])
      setFaccoes((f ?? []).map(x => ({ id: x.id, nome: x.nome, tag: (x as { sigla?: string }).sigla ?? undefined })))
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
            percentual: null, tipo_preco: 'fixo' as const,
            faixas: [], preco_limpo_parceria: null, preco_sujo_parceria: null,
            parceria_tipo: null, parceria_pct: null, desconto_padrao_pct: 0,
          })).sort((a: Produto, b: Produto) => a.nome.localeCompare(b.nome)))
          setLoadingProd(false)
        })
    } else {
      Promise.all([
        sb().from('faccoes').select('desconto_padrao_pct').eq('id', fornecedorId).single(),
        sb().from('faccao_item_precos')
          .select('item_id, preco_limpo, preco_sujo, tipo, percentual, preco_limpo_parceria, preco_sujo_parceria, parceria_tipo, parceria_pct, items(id, nome)')
          .eq('faccao_id', fornecedorId),
        sb().from('faccao_item_preco_faixas')
          .select('item_id, quantidade_min, preco_limpo, preco_sujo')
          .eq('faccao_id', fornecedorId),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ]).then(([{ data: fData }, { data: pData }, { data: fxData }]) => {
        const descPct = (fData as any)?.desconto_padrao_pct ?? 0
        const faixasPorItem: Record<string, FaixaOpcao[]> = {}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(fxData ?? []).forEach((fx: any) => {
          if (!faixasPorItem[fx.item_id]) faixasPorItem[fx.item_id] = []
          faixasPorItem[fx.item_id].push({ quantidade_min: fx.quantidade_min, preco_limpo: fx.preco_limpo, preco_sujo: fx.preco_sujo })
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setProdutos((pData ?? []).map((r: any) => ({
          item_id: r.item_id,
          nome: r.items?.nome ?? r.item_id,
          preco_limpo: r.preco_limpo ?? null,
          preco_sujo: r.preco_sujo ?? null,
          percentual: r.tipo === 'percentual' ? r.percentual : null,
          tipo_preco: (r.tipo ?? 'fixo') as 'fixo' | 'percentual',
          faixas: (faixasPorItem[r.item_id] ?? []).sort((a: FaixaOpcao, b: FaixaOpcao) => a.quantidade_min - b.quantidade_min),
          preco_limpo_parceria: r.preco_limpo_parceria ?? null,
          preco_sujo_parceria: r.preco_sujo_parceria ?? null,
          parceria_tipo: r.parceria_tipo ?? null,
          parceria_pct: r.parceria_pct ?? null,
          desconto_padrao_pct: descPct,
        })).sort((a: Produto, b: Produto) => a.nome.localeCompare(b.nome)))
        setLoadingProd(false)
      })
    }
  }, [fornecedorId, tab, sb])

  const fornecedores = tab === 'loja' ? lojas : faccoes
  const fornecedoresFiltrados = useMemo(() => {
    if (!busca.trim()) return fornecedores
    const q = norm(busca)
    return fornecedores.filter(f => norm(f.nome).includes(q) || norm(f.tag ?? '').includes(q))
  }, [fornecedores, busca])

  const produtosFiltrados = useMemo(() => {
    if (!buscaProd.trim()) return produtos
    const q = norm(buscaProd)
    return produtos.filter(p => norm(p.nome).includes(q))
  }, [produtos, buscaProd])

  // Loja: incrementa qty se já no carrinho
  function addAoCarrinho(item_id: string, nome: string, preco: number | null) {
    setCarrinho(prev => {
      const existe = prev.find(c => c.item_id === item_id)
      if (existe) return prev.map(c => c.item_id === item_id ? { ...c, quantidade: c.quantidade + 1 } : c)
      return [...prev, { item_id, nome, quantidade: 1, preco_unitario: preco }]
    })
  }

  // Facção: seleciona tipo de preço (atualiza preço se já no carrinho)
  function selecionarPreco(item_id: string, nome: string, preco: number | null) {
    setCarrinho(prev => {
      const existe = prev.find(c => c.item_id === item_id)
      if (existe) return prev.map(c => c.item_id === item_id ? { ...c, preco_unitario: preco } : c)
      return [...prev, { item_id, nome, quantidade: 1, preco_unitario: preco }]
    })
  }

  function setQtd(item_id: string, qtd: number) {
    if (qtd <= 0) { setCarrinho(prev => prev.filter(c => c.item_id !== item_id)); return }
    setCarrinho(prev => prev.map(c => c.item_id === item_id ? { ...c, quantidade: qtd } : c))
  }

  function setPrecoUnit(item_id: string, v: string) {
    const n = parseBR(v)
    setCarrinho(prev => prev.map(c => c.item_id === item_id ? { ...c, preco_unitario: n } : c))
  }

  function setTotalItem(item_id: string, v: string) {
    const total = parseBR(v)
    setCarrinho(prev => prev.map(c => {
      if (c.item_id !== item_id) return c
      return { ...c, preco_unitario: total != null && c.quantidade > 0 ? total / c.quantidade : null }
    }))
  }

  const totalCarrinho = useMemo(() => {
    if (carrinho.some(c => c.preco_unitario == null)) return null
    return carrinho.reduce((s, c) => s + (c.preco_unitario ?? 0) * c.quantidade, 0)
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
          <div className="w-52 shrink-0 border-r border-border flex flex-col">
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
                <Input placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)} className="h-7 text-xs pl-6" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
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
                <Input placeholder="Filtrar produtos..." value={buscaProd} onChange={e => setBuscaProd(e.target.value)} className="h-7 text-xs pl-6" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {!fornecedorId ? (
                <p className="text-xs text-muted-foreground text-center py-10 px-4">
                  Selecione {tab === 'loja' ? 'uma loja' : 'uma facção'} ao lado
                </p>
              ) : loadingProd ? (
                <div className="flex items-center justify-center py-10"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
              ) : produtosFiltrados.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8 px-3">Nenhum produto cadastrado</p>
              ) : tab === 'loja' ? (
                // Loja: layout simples com botão +
                produtosFiltrados.map(p => {
                  const preco = tipoDinheiro === 'sujo' ? (p.preco_sujo ?? p.preco_limpo) : (p.preco_limpo ?? p.preco_sujo)
                  const noCarrinho = carrinho.find(c => c.item_id === p.item_id)
                  return (
                    <div key={p.item_id} className="flex items-center gap-2 px-3 py-2.5 border-b border-border/30 hover:bg-white/[0.02]">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{p.nome}</p>
                        <p className="text-[10px] text-muted-foreground">{preco != null ? fmt(preco) : '—'}</p>
                      </div>
                      {noCarrinho && <span className="text-[10px] text-primary font-medium">×{noCarrinho.quantidade}</span>}
                      <button onClick={() => addAoCarrinho(p.item_id, p.nome, preco)}
                        className="shrink-0 h-6 w-6 rounded flex items-center justify-center hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                })
              ) : (
                // Facção: chips de preço (base, parceria, faixas)
                produtosFiltrados.map(p => {
                  const base = calcBase(p, tipoDinheiro)
                  const parceria = calcParceria(p, tipoDinheiro)
                  const noCarrinho = carrinho.find(c => c.item_id === p.item_id)
                  return (
                    <div key={p.item_id} className="px-3 py-2.5 border-b border-border/30 hover:bg-white/[0.02]">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <p className="text-xs font-medium truncate flex-1">{p.nome}</p>
                        {noCarrinho && (
                          <span className="text-[10px] text-primary/80 font-medium shrink-0">×{noCarrinho.quantidade}</span>
                        )}
                      </div>
                      {p.tipo_preco === 'percentual' ? (
                        <span className="text-[10px] text-muted-foreground">
                          {p.percentual != null ? `${p.percentual > 0 ? '-' : '+'}${Math.abs(p.percentual)}% sobre tabela` : '—'}
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {/* Base */}
                          {base != null && (
                            <button
                              onClick={() => selecionarPreco(p.item_id, p.nome, base)}
                              className="text-[10px] px-2 py-0.5 rounded border border-border/60 text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors">
                              Base {fmt(base)}
                              {p.desconto_padrao_pct > 0 && <span className="ml-1 text-emerald-400/70">-{p.desconto_padrao_pct}%</span>}
                            </button>
                          )}
                          {/* Parceria */}
                          {parceria != null && (
                            <button
                              onClick={() => selecionarPreco(p.item_id, p.nome, parceria)}
                              className="text-[10px] px-2 py-0.5 rounded border border-sky-500/40 text-sky-400 hover:bg-sky-500/10 transition-colors">
                              ⭐ Parceria {fmt(parceria)}
                              {p.parceria_tipo === 'percentual' && p.parceria_pct != null && (
                                <span className="ml-1 opacity-60">-{p.parceria_pct}%</span>
                              )}
                            </button>
                          )}
                          {/* Faixas */}
                          {p.faixas.map(f => {
                            const fp = calcFaixa(f, tipoDinheiro)
                            if (fp == null) return null
                            return (
                              <button key={f.quantidade_min}
                                onClick={() => selecionarPreco(p.item_id, p.nome, fp)}
                                className="text-[10px] px-2 py-0.5 rounded border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 transition-colors">
                                📦 {f.quantidade_min}+ un: {fmt(fp)}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* ── Coluna direita: carrinho ── */}
          <div className="w-60 shrink-0 flex flex-col">
            <div className="px-3 py-2.5 border-b border-border shrink-0">
              <p className="text-xs font-medium">Selecionados ({carrinho.length})</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {carrinho.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8 px-3">
                  {tab === 'loja' ? 'Clique em + para adicionar' : 'Clique em um preço para adicionar'}
                </p>
              ) : carrinho.map(c => {
                const total = c.preco_unitario != null ? Math.round(c.preco_unitario * c.quantidade) : null
                return (
                  <div key={c.item_id} className="px-3 py-2.5 border-b border-border/30 space-y-2">
                    {/* Nome + remover */}
                    <div className="flex items-center gap-1">
                      <p className="text-xs font-medium truncate flex-1">{c.nome}</p>
                      <button onClick={() => setCarrinho(prev => prev.filter(x => x.item_id !== c.item_id))}
                        className="h-4 w-4 shrink-0 rounded flex items-center justify-center text-muted-foreground hover:text-red-400">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>

                    {/* Quantidade */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground w-7">Qtd</span>
                      <button onClick={() => setQtd(c.item_id, c.quantidade - 1)}
                        className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06]">
                        <Minus className="h-2.5 w-2.5" />
                      </button>
                      <input type="text" inputMode="numeric" value={c.quantidade}
                        onFocus={e => e.target.select()}
                        onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v > 0) setQtd(c.item_id, v) }}
                        className="text-xs w-10 text-center tabular-nums bg-transparent border border-border/50 rounded h-5 focus:outline-none focus:border-primary/60 px-1" />
                      <button onClick={() => setQtd(c.item_id, c.quantidade + 1)}
                        className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06]">
                        <Plus className="h-2.5 w-2.5" />
                      </button>
                    </div>

                    {/* Preço unitário */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground w-7 shrink-0">Un.</span>
                      <div className="relative flex-1">
                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">R$</span>
                        <input
                          type="text" inputMode="numeric"
                          value={c.preco_unitario != null ? Math.round(c.preco_unitario).toString() : ''}
                          placeholder="—"
                          onFocus={e => e.target.select()}
                          onChange={e => setPrecoUnit(c.item_id, e.target.value)}
                          className="text-[10px] w-full text-right tabular-nums bg-transparent border border-border/50 rounded h-5 focus:outline-none focus:border-primary/60 pl-6 pr-1.5"
                        />
                      </div>
                    </div>

                    {/* Total */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground w-7 shrink-0">Total</span>
                      <div className="relative flex-1">
                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">R$</span>
                        <input
                          type="text" inputMode="numeric"
                          value={total != null ? total.toString() : ''}
                          placeholder="—"
                          onFocus={e => e.target.select()}
                          onChange={e => setTotalItem(c.item_id, e.target.value)}
                          className="text-[10px] w-full text-right tabular-nums bg-transparent border border-border/50 rounded h-5 focus:outline-none focus:border-primary/60 pl-6 pr-1.5"
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {carrinho.length > 0 && (
              <div className="p-3 border-t border-border shrink-0 space-y-2">
                {totalCarrinho != null && (
                  <p className="text-xs font-semibold tabular-nums">Total: {fmt(totalCarrinho)}</p>
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

'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Plus, Minus, X, Edit2, Truck, Trash2, ChevronDown, ChevronUp,
  Package, Loader2, AlertTriangle, Check, RotateCcw, Search, Store, Users, ShoppingCart,
} from 'lucide-react'

// ── Tipos ─────────────────────────────────────────────────────────────────────

type StatusVenda = 'fabricando' | 'encomenda' | 'separado' | 'pronto' | 'entregue' | 'cancelado'

type VendaItem = {
  id: string; venda_id: string; item_id: string | null
  item_nome: string; quantidade: number; preco_unit: number; origem: 'fabricar' | 'estoque'
}
type Venda = {
  id: string; faccao_id: string | null; cliente_nome: string; cliente_telefone: string | null
  tipo_dinheiro: 'sujo' | 'limpo'; desconto_pct: number; status: StatusVenda
  data_encomenda: string | null; notas: string | null
  criado_por: string | null; criado_por_nome: string | null
  entregue_por: string | null; entregue_por_nome: string | null; entregue_em: string | null
  estoque_descontado: boolean; created_at: string; itens: VendaItem[]
}
type Faccao = { id: string; nome: string; sigla: string | null; telefone: string | null; desconto_padrao_pct: number }
type Loja   = { id: string; nome: string }
type Membro = { id: string; nome: string; vulgo: string | null; telefone: string | null; faccao_id: string | null }
type ItemSimples = { id: string; nome: string; tem_craft: boolean; peso: number | null; categorias_item: { nome: string } | null }
type Receita = { item_id: string; ingrediente_id: string; quantidade: number }
type EstoqueEntry = { item_id: string; tipo: 'materia_prima' | 'produto_final'; quantidade: number }

type CartItem = {
  item_id: string; nome: string; quantidade: number
  preco_limpo: number | null; preco_sujo: number | null
  tem_craft: boolean; origem: 'fabricar' | 'estoque'
}
type FormItem = { tempId: string; item_id: string; item_nome: string; quantidade: string; preco_unit: string; origem: 'fabricar' | 'estoque' }
type FormState = {
  faccao_id: string; cliente_nome: string; cliente_telefone: string
  tipo_dinheiro: 'sujo' | 'limpo'; desconto_pct: string; notas: string; data_encomenda: string
  status: StatusVenda; itens: FormItem[]
}

interface Props {
  userId: string; userNome: string | null
  vendas: Venda[]; faccoes: Faccao[]; lojas: Loja[]; allItems: ItemSimples[]
  receitas: Receita[]; estoque: EstoqueEntry[]; membros: Membro[]
  meuFaccao: { id: string; nome: string } | null
  meuLoja: { id: string; nome: string } | null
  filtroInicial: 'todos' | 'encomenda' | 'entregue'; podeEditar: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: number) { return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` }
function fmtData(s: string) { return new Date(s + 'T12:00:00').toLocaleDateString('pt-BR') }
function today() { return new Date().toISOString().split('T')[0] }

const STATUS_INFO: Record<StatusVenda, { label: string; cls: string }> = {
  fabricando: { label: 'Fabricando', cls: 'text-blue-400 bg-blue-500/15' },
  encomenda:  { label: 'Encomenda',  cls: 'text-yellow-400 bg-yellow-500/15' },
  separado:   { label: 'Separado',   cls: 'text-orange-400 bg-orange-500/15' },
  pronto:     { label: 'Pronto',     cls: 'text-green-400 bg-green-500/15' },
  entregue:   { label: 'Entregue',   cls: 'text-emerald-400 bg-emerald-500/15' },
  cancelado:  { label: 'Cancelado',  cls: 'text-zinc-400 bg-zinc-500/15' },
}
const STATUS_TRANSICOES: Record<StatusVenda, StatusVenda[]> = {
  fabricando: ['encomenda', 'separado', 'pronto', 'cancelado'],
  encomenda:  ['fabricando', 'separado', 'pronto', 'cancelado'],
  separado:   ['fabricando', 'encomenda', 'pronto', 'cancelado'],
  pronto:     ['separado', 'cancelado'],
  entregue:   ['pronto'],
  cancelado:  ['fabricando'],
}

// ── Seletor de Produtos (modal separado) ──────────────────────────────────────

type WpItem = { item_id: string; nome: string; tem_craft: boolean; preco_limpo: number | null; preco_sujo: number | null }

function ProductBrowserDialog({
  open, onClose, onConfirm,
  meuFaccaoId, meuFaccaoNome, meuLojaId, meuLojaName,
  tipoDinheiro, descontoPct, initialCart,
}: {
  open: boolean; onClose: () => void; onConfirm: (items: CartItem[]) => void
  meuFaccaoId: string | null; meuFaccaoNome: string | null
  meuLojaId: string | null; meuLojaName: string | null
  tipoDinheiro: 'sujo' | 'limpo'; descontoPct: number; initialCart: CartItem[]
}) {
  const sbRef = useRef<ReturnType<typeof createClient> | null>(null)
  const sb = useCallback(() => { if (!sbRef.current) sbRef.current = createClient(); return sbRef.current }, [])

  const temAmbos = !!(meuFaccaoId && meuLojaId)
  const [tab, setTab] = useState<'faccao' | 'loja'>(meuFaccaoId ? 'faccao' : 'loja')
  const [produtos, setProdutos] = useState<WpItem[]>([])
  const [loadingProd, setLoadingProd] = useState(false)
  const [buscaProd, setBuscaProd] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])

  const selectedId = tab === 'faccao' ? meuFaccaoId : meuLojaId

  // Inicializar ao abrir
  useEffect(() => {
    if (!open) return
    setCart(initialCart)
    setBuscaProd('')
    setTab(meuFaccaoId ? 'faccao' : 'loja')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Buscar produtos ao abrir / mudar tab
  useEffect(() => {
    if (!selectedId || !open) { setProdutos([]); return }
    setLoadingProd(true)
    setBuscaProd('')
    if (tab === 'faccao') {
      sb().from('faccao_item_precos')
        .select('item_id, preco_limpo, preco_sujo, items(id, nome, tem_craft)')
        .eq('faccao_id', selectedId)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then(({ data, error }) => {
          if (error) { toast.error('Erro ao carregar: ' + error.message); setLoadingProd(false); return }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setProdutos((data ?? []).map((r: any) => ({
            item_id: r.item_id, nome: r.items?.nome ?? r.item_id,
            tem_craft: r.items?.tem_craft ?? false,
            preco_limpo: r.preco_limpo, preco_sujo: r.preco_sujo,
          })).sort((a: WpItem, b: WpItem) => a.nome.localeCompare(b.nome)))
          setLoadingProd(false)
        })
    } else {
      sb().from('loja_item_precos')
        .select('item_id, preco, preco_sujo, items(id, nome, tem_craft)')
        .eq('loja_id', selectedId)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then(({ data, error }) => {
          if (error) { toast.error('Erro ao carregar: ' + error.message); setLoadingProd(false); return }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setProdutos((data ?? []).map((r: any) => ({
            item_id: r.item_id, nome: r.items?.nome ?? r.item_id,
            tem_craft: r.items?.tem_craft ?? false,
            preco_limpo: r.preco ?? null, preco_sujo: r.preco_sujo ?? null,
          })).sort((a: WpItem, b: WpItem) => a.nome.localeCompare(b.nome)))
          setLoadingProd(false)
        })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, tab, open])

  const produtosFiltrados = useMemo(() => {
    if (!buscaProd.trim()) return produtos
    const q = buscaProd.toLowerCase()
    return produtos.filter(p => p.nome.toLowerCase().includes(q))
  }, [produtos, buscaProd])

  function addToCart(p: WpItem) {
    setCart(prev => {
      const exists = prev.find(c => c.item_id === p.item_id)
      if (exists) return prev.map(c => c.item_id === p.item_id ? { ...c, quantidade: c.quantidade + 1 } : c)
      return [...prev, {
        item_id: p.item_id, nome: p.nome, quantidade: 1,
        preco_limpo: p.preco_limpo, preco_sujo: p.preco_sujo,
        tem_craft: p.tem_craft, origem: p.tem_craft ? 'fabricar' : 'estoque',
      }]
    })
  }

  function setQtd(item_id: string, qtd: number) {
    if (qtd <= 0) { setCart(prev => prev.filter(c => c.item_id !== item_id)); return }
    setCart(prev => prev.map(c => c.item_id === item_id ? { ...c, quantidade: qtd } : c))
  }

  const totalCarrinho = useMemo(() => cart.reduce((s, c) => {
    const p = tipoDinheiro === 'sujo' ? (c.preco_sujo ?? c.preco_limpo ?? 0) : (c.preco_limpo ?? 0)
    return s + c.quantidade * p
  }, 0), [cart, tipoDinheiro])

  const totalComDesconto = descontoPct > 0 ? totalCarrinho * (1 - descontoPct / 100) : totalCarrinho

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col overflow-hidden p-0 gap-0">
        <DialogHeader className="px-5 pt-4 pb-3 shrink-0 border-b border-border">
          <DialogTitle className="text-sm">Selecionar Produtos</DialogTitle>
        </DialogHeader>

        {/* Tabs só aparecem se o usuário trabalha nos dois tipos */}
        {temAmbos && (
          <div className="flex shrink-0 border-b border-border">
            <button onClick={() => setTab('faccao')}
              className={cn('flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors',
                tab === 'faccao' ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
              )}>
              <Users className="h-3 w-3" />{meuFaccaoNome ?? 'Facção'}
            </button>
            <button onClick={() => setTab('loja')}
              className={cn('flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors border-l border-border',
                tab === 'loja' ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
              )}>
              <Store className="h-3 w-3" />{meuLojaName ?? 'Loja'}
            </button>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* Painel de produtos */}
          <div className="flex-1 flex flex-col min-w-0 border-r border-border">
            <div className="px-3 py-2 shrink-0 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input placeholder="Filtrar produtos..." value={buscaProd} onChange={e => setBuscaProd(e.target.value)} className="h-7 text-xs pl-6" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {!selectedId ? (
                <p className="text-xs text-muted-foreground text-center py-10 px-4">
                  Nenhum local de trabalho configurado
                </p>
              ) : loadingProd ? (
                <div className="flex items-center justify-center py-10"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
              ) : produtosFiltrados.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8 px-3">Nenhum produto cadastrado</p>
              ) : produtosFiltrados.map(p => {
                const precoBase = tipoDinheiro === 'sujo' ? (p.preco_sujo ?? p.preco_limpo) : p.preco_limpo
                const precoFinal = descontoPct > 0 && precoBase != null ? precoBase * (1 - descontoPct / 100) : precoBase
                const noCarrinho = cart.find(c => c.item_id === p.item_id)
                return (
                  <div key={p.item_id} className={cn(
                    'flex items-center gap-2 px-3 py-2.5 border-b border-border/30 transition-colors',
                    noCarrinho ? 'bg-primary/[0.05]' : 'hover:bg-white/[0.02]'
                  )}>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{p.nome}</p>
                      <p className="text-[10px] text-muted-foreground tabular-nums">
                        {precoBase != null ? (
                          descontoPct > 0 && precoFinal != null ? (
                            <><span className="line-through opacity-50">{fmt(precoBase)}</span>{' → '}<span className="text-green-400">{fmt(precoFinal)}</span></>
                          ) : fmt(precoBase)
                        ) : '—'}
                      </p>
                    </div>
                    {noCarrinho && <span className="text-[10px] text-primary font-medium shrink-0">×{noCarrinho.quantidade}</span>}
                    <button onClick={() => addToCart(p)}
                      className="shrink-0 h-6 w-6 rounded flex items-center justify-center hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Painel direito: carrinho */}
          <div className="w-52 shrink-0 flex flex-col">
            <div className="px-3 py-2.5 border-b border-border shrink-0">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                Selecionados ({cart.length})
              </p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {cart.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8 px-3">Clique em + para adicionar</p>
              ) : cart.map(c => {
                const preco = tipoDinheiro === 'sujo' ? (c.preco_sujo ?? c.preco_limpo ?? 0) : (c.preco_limpo ?? 0)
                return (
                  <div key={c.item_id} className="px-3 py-2.5 border-b border-border/30">
                    <div className="flex items-start gap-1 mb-1.5">
                      <p className="text-xs font-medium flex-1 truncate leading-tight">{c.nome}</p>
                      <button onClick={() => setQtd(c.item_id, 0)}
                        className="h-4 w-4 flex items-center justify-center text-muted-foreground hover:text-red-400 transition-colors shrink-0">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                    {preco > 0 && (
                      <p className="text-[10px] text-muted-foreground tabular-nums mb-1.5">
                        {c.quantidade} × {fmt(preco)} = {fmt(c.quantidade * preco)}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => setQtd(c.item_id, c.quantidade - 1)}
                          className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06]">
                          <Minus className="h-2.5 w-2.5" />
                        </button>
                        <span className="text-xs w-5 text-center tabular-nums font-medium">{c.quantidade}</span>
                        <button onClick={() => setQtd(c.item_id, c.quantidade + 1)}
                          className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06]">
                          <Plus className="h-2.5 w-2.5" />
                        </button>
                      </div>
                      {/* Fab/Est */}
                      <div className="flex rounded overflow-hidden border border-border h-5 flex-1">
                        <button onClick={() => setCart(prev => prev.map(x => x.item_id === c.item_id ? { ...x, origem: 'fabricar' } : x))}
                          className={cn('flex-1 text-[9px] font-medium transition-colors',
                            c.origem === 'fabricar' ? 'bg-blue-500/20 text-blue-400' : 'text-muted-foreground hover:text-foreground'
                          )}>Fab</button>
                        <button onClick={() => setCart(prev => prev.map(x => x.item_id === c.item_id ? { ...x, origem: 'estoque' } : x))}
                          className={cn('flex-1 text-[9px] font-medium transition-colors border-l border-border',
                            c.origem === 'estoque' ? 'bg-purple-500/20 text-purple-400' : 'text-muted-foreground hover:text-foreground'
                          )}>Est</button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            {cart.length > 0 && (
              <div className="p-3 border-t border-border shrink-0 space-y-1.5">
                {descontoPct > 0 ? (
                  <>
                    <p className="text-[10px] text-muted-foreground tabular-nums line-through">{fmt(totalCarrinho)}</p>
                    <p className="text-sm font-bold text-green-400 tabular-nums">{fmt(totalComDesconto)} <span className="text-[10px] font-normal opacity-70">(-{descontoPct}%)</span></p>
                  </>
                ) : (
                  <p className="text-sm font-bold text-primary tabular-nums">{fmt(totalCarrinho)}</p>
                )}
                <Button size="sm" className="w-full h-7 text-xs" onClick={() => { onConfirm(cart); onClose() }}>
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

// ── Painel de Materiais ───────────────────────────────────────────────────────

function MaterialsPanel({ venda, receitaMap, estoqueMap, itemMap }: {
  venda: Venda
  receitaMap: Record<string, Receita[]>
  estoqueMap: Record<string, Record<string, number>>
  itemMap: Record<string, ItemSimples>
}) {
  const fabricarItens = venda.itens.filter(it => it.origem === 'fabricar' && it.item_id)
  if (fabricarItens.length === 0)
    return <p className="text-xs text-muted-foreground px-4 py-3 italic">Nenhum item para fabricar.</p>

  const ingredMap: Record<string, { nome: string; necessario: number }> = {}
  for (const it of fabricarItens) {
    for (const r of receitaMap[it.item_id!] ?? []) {
      if (!ingredMap[r.ingrediente_id])
        ingredMap[r.ingrediente_id] = { nome: itemMap[r.ingrediente_id]?.nome ?? r.ingrediente_id, necessario: 0 }
      ingredMap[r.ingrediente_id].necessario += r.quantidade * it.quantidade
    }
  }
  const ingredientes = Object.entries(ingredMap)
    .map(([id, v]) => ({ id, ...v, disponivel: estoqueMap[id]?.materia_prima ?? 0 }))
    .sort((a, b) => a.nome.localeCompare(b.nome))

  if (!ingredientes.length)
    return <p className="text-xs text-muted-foreground px-4 py-3 italic">Itens sem receita cadastrada.</p>

  return (
    <div className="divide-y divide-border/30">
      <div className="grid grid-cols-[1fr_60px_70px_24px] gap-2 px-4 py-1.5 text-[10px] text-muted-foreground font-medium bg-white/[0.02]">
        <span>Ingrediente</span><span className="text-right">Precisa</span><span className="text-right">Estoque</span><span />
      </div>
      {ingredientes.map(ing => {
        const ok = ing.disponivel >= ing.necessario
        return (
          <div key={ing.id} className={cn('grid grid-cols-[1fr_60px_70px_24px] gap-2 items-center px-4 py-2', !ok && 'bg-red-500/[0.04]')}>
            <span className="text-xs font-medium truncate">{ing.nome}</span>
            <span className="text-xs text-right tabular-nums">{ing.necessario}×</span>
            <span className={cn('text-xs text-right tabular-nums font-medium', ok ? 'text-green-400' : 'text-red-400')}>{ing.disponivel}</span>
            <span className="flex justify-center">
              {ok ? <Check className="h-3 w-3 text-green-400" /> : <AlertTriangle className="h-3 w-3 text-red-400" />}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Card de Venda ─────────────────────────────────────────────────────────────

function VendaCard({ venda, faccoes, receitaMap, estoqueMap, itemMap, podeEditar,
  onStatusChange, onEntregar, onDesfazerEntrega, onEdit, onDelete }: {
  venda: Venda
  faccoes: Faccao[]
  receitaMap: Record<string, Receita[]>; estoqueMap: Record<string, Record<string, number>>; itemMap: Record<string, ItemSimples>
  podeEditar: boolean
  onStatusChange: (id: string, s: StatusVenda) => void; onEntregar: (v: Venda) => void
  onDesfazerEntrega: (id: string) => void; onEdit: (v: Venda) => void; onDelete: (id: string) => void
}) {
  const [materiaisAberto, setMateriaisAberto] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const faccaoNome = faccoes.find(f => f.id === venda.faccao_id)?.nome ?? null
  const subtotal = venda.itens.reduce((s, it) => s + it.quantidade * it.preco_unit, 0)
  const total = subtotal * (1 - venda.desconto_pct / 100)
  const entregue = venda.status === 'entregue'
  const podeEntregar = venda.status === 'encomenda' || venda.status === 'pronto'
  const temFabricar = venda.itens.some(it => it.origem === 'fabricar')
  const ativo = !entregue && venda.status !== 'cancelado'

  return (
    <div className={cn(
      'rounded-lg border overflow-hidden flex flex-col',
      entregue ? 'border-emerald-500/20 bg-emerald-500/[0.02]' : 'border-border',
      venda.status === 'cancelado' && 'opacity-60'
    )}>
      {/* Header */}
      <div className="px-3 py-2.5 bg-white/[0.02] border-b border-border/50 flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', STATUS_INFO[venda.status].cls)}>
              {STATUS_INFO[venda.status].label}
            </span>
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium',
              venda.tipo_dinheiro === 'sujo' ? 'bg-orange-500/15 text-orange-400' : 'bg-emerald-500/15 text-emerald-400'
            )}>
              {venda.tipo_dinheiro === 'sujo' ? 'Sujo' : 'Limpo'}
            </span>
            {venda.data_encomenda && (
              <span className="text-[10px] text-muted-foreground/70">{fmtData(venda.data_encomenda)}</span>
            )}
          </div>
          <p className="text-sm font-semibold truncate">{venda.cliente_nome}</p>
          <div className="flex items-center gap-2.5 mt-0.5 text-[11px] text-muted-foreground flex-wrap">
            {faccaoNome && <span className="text-primary/70 font-medium">{faccaoNome}</span>}
            {venda.cliente_telefone && <span>{venda.cliente_telefone}</span>}
            {venda.desconto_pct > 0 && <span className="text-green-400">-{venda.desconto_pct}%</span>}
          </div>
        </div>
        <span className="text-[10px] text-muted-foreground/40 shrink-0 cursor-default"
          title={`Criado: ${venda.criado_por_nome ?? '—'}${venda.entregue_por_nome ? ` · Entregue: ${venda.entregue_por_nome}` : ''}`}>
          {venda.criado_por_nome ?? '—'}
        </span>
      </div>

      {/* Itens */}
      <div className="flex-1">
        {venda.itens.length === 0
          ? <p className="text-xs text-muted-foreground px-3 py-2.5 italic">Sem itens</p>
          : <>
              <div className="grid grid-cols-[auto_1fr_36px_66px_68px] gap-x-1.5 items-center px-3 py-1 text-[10px] text-muted-foreground/50 border-b border-border/20">
                <span /><span>Item</span><span className="text-right">Qtd</span>
                <span className="text-right">Unit.</span><span className="text-right">Total</span>
              </div>
              <div className="divide-y divide-border/20">
                {venda.itens.map(it => (
                  <div key={it.id} className="grid grid-cols-[auto_1fr_36px_66px_68px] gap-x-1.5 items-center px-3 py-1.5">
                    <span className={cn('text-[9px] font-bold px-1 py-0.5 rounded shrink-0',
                      it.origem === 'fabricar' ? 'bg-blue-500/15 text-blue-400' : 'bg-purple-500/15 text-purple-400'
                    )}>
                      {it.origem === 'fabricar' ? 'Fab' : 'Est'}
                    </span>
                    <span className="text-xs font-medium truncate">{it.item_nome}</span>
                    <span className="text-xs text-right text-muted-foreground tabular-nums">{it.quantidade}×</span>
                    <span className="text-xs text-right text-muted-foreground tabular-nums">{fmt(it.preco_unit)}</span>
                    <span className="text-xs text-right font-medium tabular-nums">{fmt(it.quantidade * it.preco_unit)}</span>
                  </div>
                ))}
              </div>
              <div className="px-3 py-2 border-t border-border/30 flex items-center justify-end gap-2">
                {venda.desconto_pct > 0 && (
                  <span className="text-xs text-muted-foreground tabular-nums line-through">{fmt(subtotal)}</span>
                )}
                <span className="text-sm font-bold tabular-nums text-primary">{fmt(total)}</span>
                {venda.desconto_pct > 0 && (
                  <span className="text-[10px] text-green-400">-{venda.desconto_pct}%</span>
                )}
              </div>
            </>
        }
      </div>

      {venda.notas && (
        <div className="px-3 py-1.5 border-t border-border/30 text-[11px] text-muted-foreground italic">{venda.notas}</div>
      )}

      {temFabricar && (
        <div className="border-t border-border/40">
          <button onClick={() => setMateriaisAberto(v => !v)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-white/[0.02] transition-colors">
            {materiaisAberto ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Materiais necessários
          </button>
          {materiaisAberto && (
            <div className="border-t border-border/30">
              <MaterialsPanel venda={venda} receitaMap={receitaMap} estoqueMap={estoqueMap} itemMap={itemMap} />
            </div>
          )}
        </div>
      )}

      {podeEditar && (
        <div className="px-3 py-2 border-t border-border/40 flex items-center gap-1.5 bg-white/[0.01] flex-wrap">
          {ativo && (
            <Select value={venda.status}
              onValueChange={v => { setLoadingStatus(true); onStatusChange(venda.id, v as StatusVenda) }}
              disabled={loadingStatus}>
              <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {([venda.status, ...STATUS_TRANSICOES[venda.status]] as StatusVenda[])
                  .filter((v, i, a) => a.indexOf(v) === i)
                  .map(s => <SelectItem key={s} value={s}>{STATUS_INFO[s].label}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {podeEntregar && (
            <Button size="sm" className="h-7 text-xs gap-1" onClick={() => onEntregar(venda)}>
              <Truck className="h-3 w-3" />Entregar
            </Button>
          )}
          {entregue && (
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => onDesfazerEntrega(venda.id)}>
              <RotateCcw className="h-3 w-3" />Desfazer
            </Button>
          )}
          {venda.status === 'cancelado' && (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onStatusChange(venda.id, 'fabricando')}>Reabrir</Button>
          )}
          <div className="ml-auto flex items-center gap-1">
            {ativo && !confirmDelete && (
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onEdit(venda)}>
                <Edit2 className="h-3 w-3" />
              </Button>
            )}
            {ativo && !confirmDelete && (
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
            {confirmDelete && (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-7 text-xs px-2"
                  onClick={() => setConfirmDelete(false)}>Não</Button>
                <Button size="sm" className="h-7 text-xs px-2.5 bg-red-500/80 hover:bg-red-500 text-white border-0"
                  onClick={() => onDelete(venda.id)}>Excluir</Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Formulário de pedido ──────────────────────────────────────────────────────

function OrderDialog({
  open, onOpenChange, editando, faccoes, lojas, membros, onMembroCreated,
  meuFaccao, meuLoja, estoqueMap, onSave, saving,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; editando: Venda | null
  faccoes: Faccao[]; lojas: Loja[]; membros: Membro[]
  onMembroCreated: (m: Membro) => void
  meuFaccao: { id: string; nome: string } | null; meuLoja: { id: string; nome: string } | null
  estoqueMap: Record<string, Record<string, number>>
  onSave: (form: FormState) => void; saving: boolean
}) {
  const sbRef = useRef<ReturnType<typeof createClient> | null>(null)
  const sb = useCallback(() => { if (!sbRef.current) sbRef.current = createClient(); return sbRef.current }, [])

  const emptyForm = (): FormState => ({
    faccao_id: '', cliente_nome: '', cliente_telefone: '', tipo_dinheiro: 'limpo',
    desconto_pct: '0', notas: '', data_encomenda: today(), status: 'fabricando', itens: []
  })

  const [form, setForm] = useState<FormState>(emptyForm)
  const [faccaoNome, setFaccaoNome] = useState('')
  const [faccaoAberta, setFaccaoAberta] = useState(false)
  const [membroNome, setMembroNome] = useState('')
  const [membroAberta, setMembroAberta] = useState(false)
  const [novoMembroTel, setNovoMembroTel] = useState('')
  const [criandoMembro, setCriandoMembro] = useState(false)
  const [cart, setCart] = useState<CartItem[]>([])
  const [browserOpen, setBrowserOpen] = useState(false)

  const prevOpen = useRef(false)
  if (open !== prevOpen.current) {
    prevOpen.current = open
    if (open) {
      if (editando) {
        setForm({
          faccao_id: editando.faccao_id ?? '',
          cliente_nome: editando.cliente_nome,
          cliente_telefone: editando.cliente_telefone ?? '',
          tipo_dinheiro: editando.tipo_dinheiro,
          desconto_pct: String(editando.desconto_pct),
          notas: editando.notas ?? '',
          data_encomenda: editando.data_encomenda ?? today(),
          status: editando.status, itens: [],
        })
        setFaccaoNome(faccoes.find(f => f.id === editando.faccao_id)?.nome ?? '')
        setMembroNome(editando.cliente_nome)
        setCart(editando.itens
          .filter(it => it.item_id)
          .map(it => ({
            item_id: it.item_id!, nome: it.item_nome, quantidade: it.quantidade,
            preco_limpo: it.preco_unit, preco_sujo: null,
            tem_craft: it.origem === 'fabricar', origem: it.origem,
          })))
      } else {
        setForm(emptyForm())
        setFaccaoNome('')
        setMembroNome('')
        setCart([])
        setNovoMembroTel('')
      }
      setFaccaoAberta(false)
      setMembroAberta(false)
    }
  }

  // Facção autocomplete
  const faccoesSugestoes = useMemo(() => {
    if (!faccaoAberta || !faccaoNome.trim()) return []
    const q = faccaoNome.toLowerCase()
    return faccoes.filter(f => f.nome.toLowerCase().includes(q) || f.sigla?.toLowerCase().includes(q)).slice(0, 6)
  }, [faccoes, faccaoNome, faccaoAberta])

  function selecionarFaccao(f: Faccao) {
    setForm(prev => ({
      ...prev, faccao_id: f.id,
      desconto_pct: f.desconto_padrao_pct > 0 ? String(f.desconto_padrao_pct) : prev.desconto_pct,
    }))
    setFaccaoNome(f.nome)
    setFaccaoAberta(false)
  }

  // Membro autocomplete (filtrado pela facção selecionada)
  const membrosSugestoes = useMemo(() => {
    if (!membroAberta || !membroNome.trim()) return []
    const q = membroNome.toLowerCase()
    const pool = form.faccao_id ? membros.filter(m => m.faccao_id === form.faccao_id) : membros
    return pool.filter(m => m.nome.toLowerCase().includes(q) || m.vulgo?.toLowerCase().includes(q)).slice(0, 8)
  }, [membros, membroNome, membroAberta, form.faccao_id])

  function selecionarMembro(m: Membro) {
    setMembroNome(m.nome)
    setForm(prev => ({ ...prev, cliente_nome: m.nome, cliente_telefone: m.telefone ?? prev.cliente_telefone }))
    setMembroAberta(false)
  }

  async function handleCadastrarMembro() {
    const nome = membroNome.trim()
    if (!nome) return
    setCriandoMembro(true)
    const tel = novoMembroTel.trim() || form.cliente_telefone.trim() || null
    const { data, error } = await sb().from('membros').insert({
      nome, telefone: tel, faccao_id: form.faccao_id || null,
    }).select('id, nome, vulgo, telefone, faccao_id').single()
    setCriandoMembro(false)
    if (error) { toast.error('Erro ao cadastrar: ' + error.message); return }
    const novo = data as Membro
    onMembroCreated(novo)
    selecionarMembro(novo)
    if (tel && !form.cliente_telefone) setForm(prev => ({ ...prev, cliente_telefone: tel }))
    setNovoMembroTel('')
    toast.success(`"${novo.nome}" cadastrado!`)
  }

  const membroNaoEncontrado = membroAberta && membroNome.trim().length > 1 && membrosSugestoes.length === 0

  function buildItens(): FormItem[] {
    return cart.map(c => ({
      tempId: c.item_id, item_id: c.item_id, item_nome: c.nome,
      quantidade: String(c.quantidade),
      preco_unit: String(form.tipo_dinheiro === 'sujo' ? (c.preco_sujo ?? c.preco_limpo ?? 0) : (c.preco_limpo ?? 0)),
      origem: c.origem,
    }))
  }

  const subtotal = cart.reduce((s, c) => {
    const p = form.tipo_dinheiro === 'sujo' ? (c.preco_sujo ?? c.preco_limpo ?? 0) : (c.preco_limpo ?? 0)
    return s + c.quantidade * p
  }, 0)
  const total = subtotal * (1 - (parseFloat(form.desconto_pct) || 0) / 100)

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-xl max-h-[92vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-5 pt-4 pb-3 shrink-0 border-b border-border">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-sm">{editando ? 'Editar Pedido' : 'Novo Pedido'}</DialogTitle>
              <div className="ml-auto flex items-center gap-2">
                <span className={cn('text-xs', form.tipo_dinheiro !== 'sujo' && 'text-emerald-400 font-medium')}>Limpo</span>
                <Switch checked={form.tipo_dinheiro === 'sujo'}
                  onCheckedChange={v => setForm(prev => ({ ...prev, tipo_dinheiro: v ? 'sujo' : 'limpo' }))} />
                <span className={cn('text-xs', form.tipo_dinheiro === 'sujo' && 'text-orange-400 font-medium')}>Sujo</span>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">

            {/* ── Cliente ── */}
            <section className="px-5 py-4 space-y-3 border-b border-border/50">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Cliente</p>
              <div className="grid grid-cols-2 gap-3">

                {/* Facção */}
                <div className="space-y-1.5 relative">
                  <Label className="text-xs">Facção / Estabelecimento</Label>
                  <Input value={faccaoNome}
                    onChange={e => { setFaccaoNome(e.target.value); setForm(prev => ({ ...prev, faccao_id: '' })); setFaccaoAberta(true) }}
                    onFocus={() => setFaccaoAberta(true)}
                    onBlur={() => setTimeout(() => setFaccaoAberta(false), 150)}
                    placeholder="Opcional..." className="h-8 text-sm" autoFocus />
                  {faccaoNome && (
                    <button type="button" onClick={() => { setFaccaoNome(''); setForm(prev => ({ ...prev, faccao_id: '' })); setMembroNome(''); setForm(prev => ({ ...prev, cliente_nome: '', faccao_id: '' })) }}
                      className="absolute right-2 top-[34px] text-muted-foreground hover:text-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  )}
                  {faccaoAberta && faccoesSugestoes.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-30 mt-1 rounded-md border border-border bg-popover shadow-md overflow-hidden">
                      {faccoesSugestoes.map(f => (
                        <button key={f.id} type="button" onMouseDown={e => { e.preventDefault(); selecionarFaccao(f) }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent text-left">
                          <span className="font-medium">{f.nome}</span>
                          {f.sigla && <span className="text-muted-foreground">[{f.sigla}]</span>}
                          {f.desconto_padrao_pct > 0 && <span className="ml-auto text-green-400">{f.desconto_padrao_pct}% desc</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Desconto */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Desconto (%)</Label>
                  <Input type="number" min="0" max="100" value={form.desconto_pct}
                    onChange={e => setForm(prev => ({ ...prev, desconto_pct: e.target.value }))}
                    className="h-8 text-sm" />
                </div>

                {/* Nome/Membro */}
                <div className="space-y-1.5 relative">
                  <Label className="text-xs">Nome / Membro <span className="text-destructive">*</span></Label>
                  <Input value={membroNome}
                    onChange={e => { setMembroNome(e.target.value); setForm(prev => ({ ...prev, cliente_nome: e.target.value })); setMembroAberta(true) }}
                    onFocus={() => setMembroAberta(true)}
                    onBlur={() => setTimeout(() => setMembroAberta(false), 250)}
                    placeholder={form.faccao_id ? 'Buscar na facção...' : 'Nome da pessoa...'}
                    className="h-8 text-sm" />
                  {membroAberta && (membrosSugestoes.length > 0 || membroNaoEncontrado) && (
                    <div className="absolute top-full left-0 right-0 z-30 mt-1 rounded-md border border-border bg-popover shadow-md overflow-hidden">
                      {membrosSugestoes.map(m => (
                        <button key={m.id} type="button" onMouseDown={e => { e.preventDefault(); selecionarMembro(m) }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent text-left">
                          <span className="font-medium">{m.nome}</span>
                          {m.vulgo && <span className="text-muted-foreground">({m.vulgo})</span>}
                          {m.telefone && <span className="ml-auto text-muted-foreground tabular-nums text-[10px]">{m.telefone}</span>}
                        </button>
                      ))}
                      {membroNaoEncontrado && (
                        <div className="border-t border-border/50 px-3 py-2.5 space-y-2 bg-muted/20">
                          <p className="text-[11px] text-muted-foreground">
                            {form.faccao_id
                              ? <>&quot;{membroNome.trim()}&quot; não está nessa facção. Adicionar à investigação?</>
                              : <>&quot;{membroNome.trim()}&quot; não encontrado. Cadastrar agora?</>
                            }
                          </p>
                          <div className="flex gap-1.5">
                            <Input
                              placeholder="Telefone (opcional)"
                              value={novoMembroTel}
                              onChange={e => setNovoMembroTel(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCadastrarMembro() } }}
                              className="h-7 text-xs flex-1"
                              onMouseDown={e => e.stopPropagation()}
                            />
                            <button type="button" disabled={criandoMembro}
                              onMouseDown={e => { e.preventDefault(); handleCadastrarMembro() }}
                              className="h-7 px-2.5 text-xs bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50 shrink-0 flex items-center gap-1">
                              {criandoMembro ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                              Adicionar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Telefone */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Telefone</Label>
                  <Input value={form.cliente_telefone}
                    onChange={e => setForm(prev => ({ ...prev, cliente_telefone: e.target.value }))}
                    placeholder="(xx) xxxxx-xxxx" className="h-8 text-sm" />
                </div>

                {/* Data */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Data</Label>
                  <Input type="date" value={form.data_encomenda}
                    onChange={e => setForm(prev => ({ ...prev, data_encomenda: e.target.value }))}
                    className="h-8 text-sm" />
                </div>

                {/* Status */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Status</Label>
                  <Select value={form.status} onValueChange={v => setForm(prev => ({ ...prev, status: v as StatusVenda }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(['fabricando', 'encomenda', 'separado', 'pronto'] as StatusVenda[]).map(s => (
                        <SelectItem key={s} value={s}>{STATUS_INFO[s].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            {/* ── Produtos ── */}
            <section className="px-5 py-4 space-y-3 border-b border-border/50">
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Produtos</p>
                {cart.length > 0 && (
                  <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full font-medium">
                    {cart.length} item{cart.length > 1 ? 's' : ''}
                  </span>
                )}
                <Button size="sm" variant="outline" className="ml-auto h-7 text-xs gap-1.5"
                  onClick={() => setBrowserOpen(true)}>
                  <ShoppingCart className="h-3 w-3" />
                  {cart.length > 0 ? 'Editar produtos' : 'Adicionar produtos'}
                </Button>
              </div>

              {cart.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4 italic">Nenhum produto adicionado</p>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="divide-y divide-border/30">
                    {cart.map(c => {
                      const preco = form.tipo_dinheiro === 'sujo' ? (c.preco_sujo ?? c.preco_limpo ?? 0) : (c.preco_limpo ?? 0)
                      const estoqueDisp = estoqueMap[c.item_id]?.produto_final ?? 0
                      return (
                        <div key={c.item_id} className="flex items-center gap-2 px-3 py-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{c.nome}</p>
                            {preco > 0 && (
                              <p className="text-[10px] text-muted-foreground tabular-nums">
                                {c.quantidade} × {fmt(preco)} = {fmt(c.quantidade * preco)}
                              </p>
                            )}
                            {c.origem === 'estoque' && (
                              <p className={cn('text-[10px]', estoqueDisp >= c.quantidade ? 'text-green-400/70' : 'text-red-400/80')}>
                                estoque: {estoqueDisp}{estoqueDisp < c.quantidade ? ' ⚠' : ''}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => setCart(prev => prev.map(x => x.item_id === c.item_id ? { ...x, quantidade: Math.max(1, x.quantidade - 1) } : x))}
                              className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06]">
                              <Minus className="h-2.5 w-2.5" />
                            </button>
                            <span className="text-xs w-5 text-center tabular-nums font-medium">{c.quantidade}</span>
                            <button onClick={() => setCart(prev => prev.map(x => x.item_id === c.item_id ? { ...x, quantidade: x.quantidade + 1 } : x))}
                              className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06]">
                              <Plus className="h-2.5 w-2.5" />
                            </button>
                          </div>
                          <div className="flex rounded overflow-hidden border border-border h-5 w-16 shrink-0">
                            <button onClick={() => setCart(prev => prev.map(x => x.item_id === c.item_id ? { ...x, origem: 'fabricar' } : x))}
                              className={cn('flex-1 text-[9px] font-medium transition-colors',
                                c.origem === 'fabricar' ? 'bg-blue-500/20 text-blue-400' : 'text-muted-foreground')}>
                              Fab
                            </button>
                            <button onClick={() => setCart(prev => prev.map(x => x.item_id === c.item_id ? { ...x, origem: 'estoque' } : x))}
                              className={cn('flex-1 text-[9px] font-medium transition-colors border-l border-border',
                                c.origem === 'estoque' ? 'bg-purple-500/20 text-purple-400' : 'text-muted-foreground')}>
                              Est
                            </button>
                          </div>
                          <button onClick={() => setCart(prev => prev.filter(x => x.item_id !== c.item_id))}
                            className="h-5 w-5 flex items-center justify-center text-muted-foreground hover:text-red-400 shrink-0">
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                  {cart.length > 0 && (
                    <div className="flex items-center justify-between px-3 py-2 border-t border-border/50 bg-white/[0.02]">
                      <span className="text-[11px] text-muted-foreground">
                        {parseFloat(form.desconto_pct) > 0 ? `Subtotal ${fmt(subtotal)} · ${form.desconto_pct}% desc` : `${cart.reduce((s, c) => s + c.quantidade, 0)} unidades`}
                      </span>
                      <span className="text-sm font-bold text-primary tabular-nums">{fmt(total)}</span>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ── Observações ── */}
            <section className="px-5 py-4 space-y-1.5">
              <Label className="text-xs">Observações</Label>
              <textarea value={form.notas}
                onChange={e => setForm(prev => ({ ...prev, notas: e.target.value }))}
                rows={2} placeholder="Notas adicionais..."
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring resize-none" />
            </section>
          </div>

          <div className="flex justify-end gap-2 px-5 py-3 border-t border-border shrink-0">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button size="sm"
              onClick={() => onSave({ ...form, itens: buildItens() })}
              disabled={saving || !form.cliente_nome.trim() || cart.length === 0}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : editando ? 'Salvar' : 'Criar Pedido'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de seleção de produtos (abre em cima do OrderDialog) */}
      <ProductBrowserDialog
        open={browserOpen}
        onClose={() => setBrowserOpen(false)}
        onConfirm={items => setCart(items)}
        meuFaccaoId={meuFaccao?.id ?? null}
        meuFaccaoNome={meuFaccao?.nome ?? null}
        meuLojaId={meuLoja?.id ?? null}
        meuLojaName={meuLoja?.nome ?? null}
        tipoDinheiro={form.tipo_dinheiro}
        descontoPct={parseFloat(form.desconto_pct) || 0}
        initialCart={cart}
      />
    </>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export function VendasClient({
  userId, userNome, vendas: vendasIniciais, faccoes, lojas, allItems,
  receitas, estoque: estoqueInicial, membros: membrosIniciais,
  meuFaccao, meuLoja, filtroInicial, podeEditar,
}: Props) {
  const sbRef = useRef<ReturnType<typeof createClient> | null>(null)
  const sb = useCallback(() => { if (!sbRef.current) sbRef.current = createClient(); return sbRef.current }, [])

  const [vendas, setVendas] = useState<Venda[]>(vendasIniciais)
  const [estoqueState, setEstoqueState] = useState<EstoqueEntry[]>(estoqueInicial)
  const [membrosState, setMembrosState] = useState<Membro[]>(membrosIniciais)
  const [formOpen, setFormOpen] = useState(false)
  const [editando, setEditando] = useState<Venda | null>(null)
  const [saving, setSaving] = useState(false)
  const [filtro, setFiltro] = useState<string>(filtroInicial)

  const itemMap = useMemo(() => Object.fromEntries(allItems.map(i => [i.id, i])), [allItems])
  const receitaMap = useMemo(() => {
    const map: Record<string, Receita[]> = {}
    receitas.forEach(r => { if (!map[r.item_id]) map[r.item_id] = []; map[r.item_id].push(r) })
    return map
  }, [receitas])
  const estoqueMap = useMemo(() => {
    const map: Record<string, Record<string, number>> = {}
    estoqueState.forEach(e => { if (!map[e.item_id]) map[e.item_id] = {}; map[e.item_id][e.tipo] = e.quantidade })
    return map
  }, [estoqueState])

  const vendasFiltradas = useMemo(() => {
    if (filtro === 'todos') return vendas.filter(v => v.status !== 'entregue')
    if (filtro === 'entregue') return vendas.filter(v => v.status === 'entregue')
    return vendas.filter(v => v.status === filtro)
  }, [vendas, filtro])

  async function handleSave(form: FormState) {
    if (!form.cliente_nome.trim() || form.itens.length === 0) return
    setSaving(true)
    try {
      if (editando) {
        const { error } = await sb().from('vendas').update({
          faccao_id: form.faccao_id || null, cliente_nome: form.cliente_nome.trim(),
          cliente_telefone: form.cliente_telefone || null, tipo_dinheiro: form.tipo_dinheiro,
          desconto_pct: parseFloat(form.desconto_pct) || 0, notas: form.notas || null,
          data_encomenda: form.data_encomenda || null, status: form.status,
        }).eq('id', editando.id)
        if (error) { toast.error('Erro ao salvar: ' + error.message); return }

        await sb().from('venda_itens').delete().eq('venda_id', editando.id)
        const novosItens = form.itens.map(it => ({
          venda_id: editando.id, item_id: it.item_id || null, item_nome: it.item_nome,
          quantidade: parseFloat(it.quantidade) || 1, preco_unit: parseFloat(it.preco_unit) || 0, origem: it.origem,
        }))
        const { data: itensData, error: itensErr } = await sb().from('venda_itens').insert(novosItens).select()
        if (itensErr) { toast.error('Erro nos itens'); return }
        setVendas(prev => prev.map(v => v.id === editando.id ? {
          ...v, faccao_id: form.faccao_id || null, cliente_nome: form.cliente_nome.trim(),
          cliente_telefone: form.cliente_telefone || null, tipo_dinheiro: form.tipo_dinheiro,
          desconto_pct: parseFloat(form.desconto_pct) || 0, notas: form.notas || null,
          data_encomenda: form.data_encomenda || null, status: form.status,
          itens: (itensData ?? []) as VendaItem[],
        } : v))
        toast.success('Pedido atualizado!')
      } else {
        const { data: venda, error: vendaErr } = await sb().from('vendas').insert({
          faccao_id: form.faccao_id || null, cliente_nome: form.cliente_nome.trim(),
          cliente_telefone: form.cliente_telefone || null, tipo_dinheiro: form.tipo_dinheiro,
          desconto_pct: parseFloat(form.desconto_pct) || 0, status: form.status,
          data_encomenda: form.data_encomenda || null, notas: form.notas || null,
          criado_por: userId, criado_por_nome: userNome,
        }).select().single()
        if (vendaErr) { toast.error('Erro ao criar: ' + vendaErr.message); return }
        const novosItens = form.itens.map(it => ({
          venda_id: (venda as Venda).id, item_id: it.item_id || null, item_nome: it.item_nome,
          quantidade: parseFloat(it.quantidade) || 1, preco_unit: parseFloat(it.preco_unit) || 0, origem: it.origem,
        }))
        const { data: itensData, error: itensErr } = await sb().from('venda_itens').insert(novosItens).select()
        if (itensErr) { toast.error('Erro nos itens'); return }
        setVendas(prev => [{ ...(venda as Venda), itens: (itensData ?? []) as VendaItem[] }, ...prev])
        toast.success('Pedido criado!')
      }
      setFormOpen(false); setEditando(null)
    } finally { setSaving(false) }
  }

  async function handleStatusChange(id: string, status: StatusVenda) {
    const { error } = await sb().from('vendas').update({ status }).eq('id', id)
    if (error) { toast.error('Erro ao mudar status'); return }
    setVendas(prev => prev.map(v => v.id === id ? { ...v, status } : v))
  }

  async function handleEntregar(venda: Venda) {
    const agora = new Date().toISOString()
    const { error } = await sb().from('vendas').update({
      status: 'entregue', entregue_por: userId, entregue_por_nome: userNome, entregue_em: agora,
    }).eq('id', venda.id)
    if (error) { toast.error('Erro ao registrar entrega'); return }
    setVendas(prev => prev.map(v => v.id === venda.id
      ? { ...v, status: 'entregue', entregue_por: userId, entregue_por_nome: userNome, entregue_em: agora } : v))
    toast.success('Entrega registrada!')
    if (!venda.estoque_descontado) await handleDescontarEstoque({ ...venda, status: 'entregue' })
    await registrarLancamentoFinanceiro(venda)
  }

  async function registrarLancamentoFinanceiro(venda: Venda) {
    const subtotal = venda.itens.reduce((s, it) => s + it.quantidade * it.preco_unit, 0)
    const totalVenda = subtotal * (1 - venda.desconto_pct / 100)
    if (totalVenda <= 0) return

    let contaId: string | null = null

    if (venda.faccao_id) {
      // Buscar conta já existente para essa facção
      const { data: contaExistente } = await sb().from('financeiro_contas')
        .select('id').eq('faccao_id', venda.faccao_id).eq('status', 'ativo').maybeSingle()
      if (contaExistente) {
        contaId = contaExistente.id
      } else {
        // Auto-criar conta para a facção
        const faccaoNome = faccoes.find(f => f.id === venda.faccao_id)?.nome ?? 'Facção'
        const { data: novaConta } = await sb().from('financeiro_contas').insert({
          nome: faccaoNome, tipo: 'faccao', faccao_id: venda.faccao_id,
          saldo_sujo: 0, saldo_limpo: 0, status: 'ativo',
        }).select('id').single()
        if (novaConta) contaId = novaConta.id
      }
    }

    await sb().from('financeiro_lancamentos').insert({
      conta_id: contaId,
      venda_id: venda.id,
      tipo: 'venda',
      tipo_dinheiro: venda.tipo_dinheiro,
      valor: totalVenda,
      descricao: `Venda: ${venda.cliente_nome}`,
      categoria: 'venda',
      data: new Date().toISOString().split('T')[0],
      vai_para_faccao: !!venda.faccao_id,
      origem: 'venda',
      created_by: userId,
    })
  }

  async function handleDelete(id: string) {
    const { error } = await sb().from('vendas').delete().eq('id', id)
    if (error) { toast.error('Erro ao excluir pedido'); return }
    setVendas(prev => prev.filter(v => v.id !== id))
    toast.success('Pedido excluído')
  }

  async function handleDesfazerEntrega(id: string) {
    const { error } = await sb().from('vendas').update({
      status: 'pronto', entregue_por: null, entregue_por_nome: null, entregue_em: null,
    }).eq('id', id)
    if (error) { toast.error('Erro ao desfazer entrega'); return }
    setVendas(prev => prev.map(v => v.id === id
      ? { ...v, status: 'pronto', entregue_por: null, entregue_por_nome: null, entregue_em: null } : v))
    toast.success('Entrega desfeita — voltou para Pronto')
  }

  async function handleDescontarEstoque(venda: Venda) {
    if (venda.estoque_descontado) { toast.info('Estoque já foi descontado'); return }
    const deducoes: Record<string, { tipo: 'materia_prima' | 'produto_final'; qtd: number }> = {}
    for (const it of venda.itens) {
      if (!it.item_id) continue
      if (it.origem === 'estoque') {
        if (!deducoes[it.item_id]) deducoes[it.item_id] = { tipo: 'produto_final', qtd: 0 }
        deducoes[it.item_id].qtd += it.quantidade
      } else {
        for (const r of receitaMap[it.item_id] ?? []) {
          if (!deducoes[r.ingrediente_id]) deducoes[r.ingrediente_id] = { tipo: 'materia_prima', qtd: 0 }
          deducoes[r.ingrediente_id].qtd += r.quantidade * it.quantidade
        }
      }
    }
    for (const [item_id, { tipo, qtd }] of Object.entries(deducoes)) {
      const atual = estoqueMap[item_id]?.[tipo] ?? 0
      const nova = Math.max(0, atual - qtd)
      await sb().from('estoque').upsert({ item_id, tipo, quantidade: nova, updated_at: new Date().toISOString() })
      setEstoqueState(prev => {
        const exists = prev.find(e => e.item_id === item_id && e.tipo === tipo)
        if (exists) return prev.map(e => e.item_id === item_id && e.tipo === tipo ? { ...e, quantidade: nova } : e)
        return [...prev, { item_id, tipo, quantidade: nova }]
      })
    }
    await sb().from('vendas').update({ estoque_descontado: true }).eq('id', venda.id)
    setVendas(prev => prev.map(v => v.id === venda.id ? { ...v, estoque_descontado: true } : v))
    toast.success('Estoque descontado!')
  }

  const filtros = [
    { key: 'todos', label: 'Ativos' },
    { key: 'encomenda', label: 'Encomendas' },
    { key: 'entregue', label: 'Concluídos' },
  ]

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 py-3 border-b border-border flex items-center gap-2 shrink-0">
        <div className="flex gap-1">
          {filtros.map(f => (
            <button key={f.key} onClick={() => setFiltro(f.key)}
              className={cn('px-3 py-1.5 rounded text-xs font-medium transition-colors',
                filtro === f.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.06]'
              )}>
              {f.label}
              {f.key === 'encomenda' && vendas.filter(v => v.status === 'encomenda').length > 0 && (
                <span className="ml-1 opacity-60">({vendas.filter(v => v.status === 'encomenda').length})</span>
              )}
            </button>
          ))}
        </div>
        {podeEditar && (
          <Button size="sm" className="h-8 text-xs gap-1 ml-auto" onClick={() => { setEditando(null); setFormOpen(true) }}>
            <Plus className="h-3.5 w-3.5" />Novo Pedido
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {vendasFiltradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Package className="h-10 w-10 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">Nenhum pedido aqui</p>
            {podeEditar && filtro === 'todos' && (
              <Button size="sm" className="h-8 text-xs gap-1" onClick={() => { setEditando(null); setFormOpen(true) }}>
                <Plus className="h-3.5 w-3.5" />Criar primeiro pedido
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
            {vendasFiltradas.map(venda => (
              <VendaCard key={venda.id} venda={venda}
                faccoes={faccoes}
                receitaMap={receitaMap} estoqueMap={estoqueMap} itemMap={itemMap}
                podeEditar={podeEditar}
                onStatusChange={handleStatusChange}
                onEntregar={handleEntregar}
                onDesfazerEntrega={handleDesfazerEntrega}
                onEdit={v => { setEditando(v); setFormOpen(true) }}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      <OrderDialog
        open={formOpen}
        onOpenChange={v => { setFormOpen(v); if (!v) setEditando(null) }}
        editando={editando}
        faccoes={faccoes} lojas={lojas}
        membros={membrosState}
        onMembroCreated={m => setMembrosState(prev => [...prev, m].sort((a, b) => a.nome.localeCompare(b.nome)))}
        meuFaccao={meuFaccao} meuLoja={meuLoja}
        estoqueMap={estoqueMap}
        onSave={handleSave} saving={saving}
      />
    </div>
  )
}

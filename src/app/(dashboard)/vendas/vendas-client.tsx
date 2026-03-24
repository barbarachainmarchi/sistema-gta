'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
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
  Plus, X, Edit2, Truck, ChevronDown, ChevronUp,
  Package, Loader2, AlertTriangle, Check, RotateCcw
} from 'lucide-react'

// ── Tipos ─────────────────────────────────────────────────────────────────────

type StatusVenda = 'fabricando' | 'encomenda' | 'separado' | 'pronto' | 'entregue' | 'cancelado'

type VendaItem = {
  id: string; venda_id: string; item_id: string | null
  item_nome: string; quantidade: number; preco_unit: number
  origem: 'fabricar' | 'estoque'
}
type Venda = {
  id: string; faccao_id: string | null; cliente_nome: string; cliente_telefone: string | null
  tipo_dinheiro: 'sujo' | 'limpo'; desconto_pct: number; status: StatusVenda
  data_encomenda: string | null; notas: string | null
  criado_por: string | null; criado_por_nome: string | null
  entregue_por: string | null; entregue_por_nome: string | null; entregue_em: string | null
  estoque_descontado: boolean; created_at: string
  itens: VendaItem[]
}
type Faccao = { id: string; nome: string; sigla: string | null; telefone: string | null; desconto_padrao_pct: number }
type ItemSimples = { id: string; nome: string; tem_craft: boolean; peso: number | null; categorias_item: { nome: string } | null }
type Receita = { item_id: string; ingrediente_id: string; quantidade: number }
type EstoqueEntry = { item_id: string; tipo: 'materia_prima' | 'produto_final'; quantidade: number }
type PrecoVigente = { item_id: string; preco_sujo: number | null; preco_limpo: number | null }
type LojaPreco = { loja_id: string; item_id: string; preco: number; preco_sujo: number | null }
type FaccaoPrecoItem = { faccao_id: string; item_id: string; preco_limpo: number | null; preco_sujo: number | null }

type FormItem = { tempId: string; item_id: string; item_nome: string; quantidade: string; preco_unit: string; origem: 'fabricar' | 'estoque' }
type FormState = {
  faccao_id: string; cliente_nome: string; cliente_telefone: string
  tipo_dinheiro: 'sujo' | 'limpo'; desconto_pct: string; notas: string; data_encomenda: string
  status: StatusVenda; itens: FormItem[]
}

interface Props {
  userId: string; userNome: string | null
  vendas: Venda[]; faccoes: Faccao[]; allItems: ItemSimples[]
  receitas: Receita[]; estoque: EstoqueEntry[]; precosVigentes: PrecoVigente[]
  lojaPrecos: LojaPreco[]; faccaoPrecos: FaccaoPrecoItem[]
  meuLojaId: string | null; meuFaccaoId: string | null
  filtroInicial: 'todos' | 'encomenda' | 'entregue'
  podeEditar: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: number) { return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` }
function fmtData(s: string) { return new Date(s + 'T12:00:00').toLocaleDateString('pt-BR') }

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

// ── Painel de Materiais ───────────────────────────────────────────────────────

function MaterialsPanel({ venda, receitaMap, estoqueMap, itemMap }: {
  venda: Venda
  receitaMap: Record<string, Receita[]>
  estoqueMap: Record<string, Record<string, number>>
  itemMap: Record<string, ItemSimples>
}) {
  const fabricarItens = venda.itens.filter(it => it.origem === 'fabricar' && it.item_id)
  if (fabricarItens.length === 0) {
    return <p className="text-xs text-muted-foreground px-4 py-3 italic">Nenhum item marcado para fabricar.</p>
  }

  // Agregar ingredientes
  const ingredMap: Record<string, { nome: string; necessario: number }> = {}
  for (const it of fabricarItens) {
    const receita = receitaMap[it.item_id!] ?? []
    for (const r of receita) {
      if (!ingredMap[r.ingrediente_id]) {
        ingredMap[r.ingrediente_id] = { nome: itemMap[r.ingrediente_id]?.nome ?? r.ingrediente_id, necessario: 0 }
      }
      ingredMap[r.ingrediente_id].necessario += r.quantidade * it.quantidade
    }
  }
  const ingredientes = Object.entries(ingredMap).map(([id, v]) => ({
    id, ...v,
    disponivel: estoqueMap[id]?.materia_prima ?? 0,
  })).sort((a, b) => a.nome.localeCompare(b.nome))

  if (ingredientes.length === 0) {
    return <p className="text-xs text-muted-foreground px-4 py-3 italic">Itens sem receita cadastrada.</p>
  }

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
            <span className={cn('text-xs text-right tabular-nums font-medium', ok ? 'text-green-400' : 'text-red-400')}>
              {ing.disponivel}
            </span>
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

function VendaCard({
  venda, userId, userNome, receitaMap, estoqueMap, itemMap, podeEditar,
  onStatusChange, onEntregar, onDesfazerEntrega, onDescontarEstoque, onEdit
}: {
  venda: Venda; userId: string; userNome: string | null
  receitaMap: Record<string, Receita[]>; estoqueMap: Record<string, Record<string, number>>; itemMap: Record<string, ItemSimples>
  podeEditar: boolean
  onStatusChange: (id: string, status: StatusVenda) => void
  onEntregar: (venda: Venda) => void
  onDesfazerEntrega: (id: string) => void
  onDescontarEstoque: (venda: Venda) => void
  onEdit: (venda: Venda) => void
}) {
  const [materiaisAberto, setMateriaisAberto] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState(false)

  const subtotal = venda.itens.reduce((s, it) => s + it.quantidade * it.preco_unit, 0)
  const descValor = subtotal * (venda.desconto_pct / 100)
  const total = subtotal - descValor

  const statusInfo = STATUS_INFO[venda.status]
  const podeEntregar = venda.status === 'encomenda' || venda.status === 'pronto'
  const entregue = venda.status === 'entregue'
  const temFabricar = venda.itens.some(it => it.origem === 'fabricar')

  return (
    <div className={cn(
      'rounded-lg border overflow-hidden flex flex-col',
      entregue ? 'border-emerald-500/20 bg-emerald-500/[0.02]' : 'border-border',
      venda.status === 'cancelado' && 'opacity-60'
    )}>
      {/* Header */}
      <div className="px-4 py-3 bg-white/[0.02] border-b border-border/50 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', statusInfo.cls)}>
              {statusInfo.label}
            </span>
            {venda.data_encomenda && venda.status === 'encomenda' && (
              <span className="text-[10px] text-yellow-400/70">{fmtData(venda.data_encomenda)}</span>
            )}
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium',
              venda.tipo_dinheiro === 'sujo' ? 'bg-orange-500/15 text-orange-400' : 'bg-emerald-500/15 text-emerald-400'
            )}>
              {venda.tipo_dinheiro === 'sujo' ? 'Sujo' : 'Limpo'}
            </span>
          </div>
          <p className="text-sm font-semibold mt-1 truncate">{venda.cliente_nome}</p>
          {(venda.cliente_telefone || venda.desconto_pct > 0) && (
            <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
              {venda.cliente_telefone && <span>📞 {venda.cliente_telefone}</span>}
              {venda.desconto_pct > 0 && <span>{venda.desconto_pct}% desc.</span>}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0 group relative">
          <span className="text-[10px] text-muted-foreground/50 group-hover:text-muted-foreground transition-colors cursor-default" title={`Criado por: ${venda.criado_por_nome ?? '—'}${venda.entregue_por_nome ? ` · Entregue por: ${venda.entregue_por_nome}` : ''}`}>
            {venda.criado_por_nome ?? '—'}
          </span>
        </div>
      </div>

      {/* Itens */}
      <div className="flex-1">
        {venda.itens.length === 0 ? (
          <p className="text-xs text-muted-foreground px-4 py-3 italic">Sem itens</p>
        ) : (
          <div className="divide-y divide-border/30">
            {venda.itens.map(it => (
              <div key={it.id} className="grid grid-cols-[1fr_50px_80px_80px] gap-2 items-center px-4 py-2">
                <div className="min-w-0">
                  <span className="text-sm font-medium truncate block">{it.item_nome}</span>
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded',
                    it.origem === 'fabricar' ? 'text-blue-400/70' : 'text-purple-400/70'
                  )}>
                    {it.origem === 'fabricar' ? 'fabricar' : 'estoque'}
                  </span>
                </div>
                <span className="text-xs text-right text-muted-foreground tabular-nums">{it.quantidade}×</span>
                <span className="text-xs text-right text-muted-foreground tabular-nums">{fmt(it.preco_unit)}</span>
                <span className="text-sm text-right font-medium tabular-nums">{fmt(it.quantidade * it.preco_unit)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Total */}
        <div className="px-4 py-2.5 border-t border-border/40 bg-white/[0.01] flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {venda.desconto_pct > 0 && <span>Subtotal {fmt(subtotal)} · desc -{fmt(descValor)}</span>}
          </div>
          <span className="text-sm font-bold tabular-nums text-primary">{fmt(total)}</span>
        </div>
      </div>

      {/* Notas */}
      {venda.notas && (
        <div className="px-4 py-2 border-t border-border/30 text-xs text-muted-foreground italic bg-white/[0.01]">
          {venda.notas}
        </div>
      )}

      {/* Materiais */}
      {temFabricar && (
        <div className="border-t border-border/40">
          <button
            onClick={() => setMateriaisAberto(v => !v)}
            className="w-full flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-white/[0.02] transition-colors"
          >
            {materiaisAberto ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Ver materiais necessários
          </button>
          {materiaisAberto && (
            <div className="border-t border-border/30">
              <MaterialsPanel venda={venda} receitaMap={receitaMap} estoqueMap={estoqueMap} itemMap={itemMap} />
            </div>
          )}
        </div>
      )}

      {/* Ações */}
      {podeEditar && (
        <div className="px-4 py-2.5 border-t border-border/40 flex items-center gap-2 bg-white/[0.01] flex-wrap">
          {/* Status */}
          {!entregue && venda.status !== 'cancelado' && (
            <Select
              value={venda.status}
              onValueChange={v => { setLoadingStatus(true); onStatusChange(venda.id, v as StatusVenda) }}
              disabled={loadingStatus}
            >
              <SelectTrigger className="h-7 text-xs w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {([venda.status, ...STATUS_TRANSICOES[venda.status]] as StatusVenda[]).filter((v, i, a) => a.indexOf(v) === i).map(s => (
                  <SelectItem key={s} value={s}>{STATUS_INFO[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Entregar */}
          {podeEntregar && (
            <Button size="sm" className="h-7 text-xs gap-1" onClick={() => onEntregar(venda)}>
              <Truck className="h-3 w-3" />Entregar
            </Button>
          )}

          {/* Desfazer entrega */}
          {entregue && (
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => onDesfazerEntrega(venda.id)}>
              <RotateCcw className="h-3 w-3" />Desfazer entrega
            </Button>
          )}

          {/* Reabrir cancelado */}
          {venda.status === 'cancelado' && (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onStatusChange(venda.id, 'fabricando')}>
              Reabrir
            </Button>
          )}

          <div className="ml-auto flex gap-1">
            {/* Descontar estoque */}
            {!venda.estoque_descontado && (venda.status === 'pronto' || entregue) && (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-orange-400 border-orange-500/30 hover:bg-orange-500/10" onClick={() => onDescontarEstoque(venda)}>
                <Package className="h-3 w-3" />Descontar estoque
              </Button>
            )}
            {/* Editar */}
            {!entregue && venda.status !== 'cancelado' && (
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onEdit(venda)}>
                <Edit2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Formulário de pedido ──────────────────────────────────────────────────────

function OrderDialog({
  open, onOpenChange, editando, faccoes, allItems, meuPrecoMap, estoqueMap,
  onSave, saving,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; editando: Venda | null
  faccoes: Faccao[]; allItems: ItemSimples[]
  meuPrecoMap: Record<string, { preco_limpo: number | null; preco_sujo: number | null }>
  estoqueMap: Record<string, Record<string, number>>
  onSave: (form: FormState) => void; saving: boolean
}) {
  const emptyForm = (): FormState => ({
    faccao_id: '', cliente_nome: '', cliente_telefone: '', tipo_dinheiro: 'limpo',
    desconto_pct: '0', notas: '', data_encomenda: '', status: 'fabricando', itens: []
  })

  const [form, setForm] = useState<FormState>(emptyForm)
  const [faccaoBusca, setFaccaoBusca] = useState('')
  const [itemBusca, setItemBusca] = useState('')
  const [itemBuscaAberta, setItemBuscaAberta] = useState(false)

  // Quando abre o dialog
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
          data_encomenda: editando.data_encomenda ?? '',
          status: editando.status,
          itens: editando.itens.map(it => ({
            tempId: it.id, item_id: it.item_id ?? '', item_nome: it.item_nome,
            quantidade: String(it.quantidade), preco_unit: String(it.preco_unit), origem: it.origem,
          }))
        })
        setFaccaoBusca(editando.cliente_nome)
      } else {
        setForm(emptyForm())
        setFaccaoBusca('')
      }
      setItemBusca('')
    }
  }

  function selecionarFaccao(f: Faccao) {
    setForm(prev => ({
      ...prev, faccao_id: f.id, cliente_nome: f.nome,
      cliente_telefone: f.telefone ?? prev.cliente_telefone,
      desconto_pct: f.desconto_padrao_pct > 0 ? String(f.desconto_padrao_pct) : prev.desconto_pct,
    }))
    setFaccaoBusca(f.nome)
  }

  function adicionarItem(item: ItemSimples) {
    const preco = form.tipo_dinheiro === 'sujo'
      ? (meuPrecoMap[item.id]?.preco_sujo ?? meuPrecoMap[item.id]?.preco_limpo ?? 0)
      : (meuPrecoMap[item.id]?.preco_limpo ?? 0)
    setForm(prev => ({
      ...prev, itens: [...prev.itens, {
        tempId: crypto.randomUUID(), item_id: item.id, item_nome: item.nome,
        quantidade: '1', preco_unit: String(preco ?? 0),
        origem: item.tem_craft ? 'fabricar' : 'estoque',
      }]
    }))
    setItemBusca(''); setItemBuscaAberta(false)
  }

  function removerItem(tempId: string) {
    setForm(prev => ({ ...prev, itens: prev.itens.filter(it => it.tempId !== tempId) }))
  }

  function updateItem(tempId: string, field: keyof FormItem, value: string) {
    setForm(prev => ({ ...prev, itens: prev.itens.map(it => it.tempId === tempId ? { ...it, [field]: value } : it) }))
  }

  const itensFiltrados = useMemo(() => {
    if (!itemBusca.trim()) return allItems.slice(0, 15)
    const q = itemBusca.toLowerCase()
    return allItems.filter(i => i.nome.toLowerCase().includes(q)).slice(0, 10)
  }, [allItems, itemBusca])

  const faccoesSugestoes = useMemo(() => {
    if (!faccaoBusca.trim()) return []
    const q = faccaoBusca.toLowerCase()
    return faccoes.filter(f => f.nome.toLowerCase().includes(q) || f.sigla?.toLowerCase().includes(q)).slice(0, 6)
  }, [faccoes, faccaoBusca])

  const subtotal = form.itens.reduce((s, it) => s + (parseFloat(it.quantidade) || 0) * (parseFloat(it.preco_unit) || 0), 0)
  const total = subtotal * (1 - (parseFloat(form.desconto_pct) || 0) / 100)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <div className="flex items-center gap-3">
            <DialogTitle className="text-sm">{editando ? 'Editar Pedido' : 'Novo Pedido'}</DialogTitle>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Limpo</span>
              <Switch
                checked={form.tipo_dinheiro === 'sujo'}
                onCheckedChange={v => setForm(prev => ({ ...prev, tipo_dinheiro: v ? 'sujo' : 'limpo' }))}
              />
              <span className="text-xs text-muted-foreground">Sujo</span>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 py-2 pr-1">

          {/* Cliente */}
          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cliente</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 relative">
                <Label className="text-xs">Facção / Nome</Label>
                <Input
                  value={faccaoBusca}
                  onChange={e => { setFaccaoBusca(e.target.value); setForm(prev => ({ ...prev, cliente_nome: e.target.value, faccao_id: '' })) }}
                  placeholder="Buscar facção ou digitar nome..."
                  className="h-8 text-sm"
                  autoFocus
                />
                {faccoesSugestoes.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-md border border-border bg-popover shadow-md overflow-hidden">
                    {faccoesSugestoes.map(f => (
                      <button key={f.id} type="button"
                        onMouseDown={e => { e.preventDefault(); selecionarFaccao(f) }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent text-left">
                        <span className="font-medium">{f.nome}</span>
                        {f.sigla && <span className="text-muted-foreground">[{f.sigla}]</span>}
                        {f.desconto_padrao_pct > 0 && <span className="ml-auto text-green-400">{f.desconto_padrao_pct}% desc</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Telefone</Label>
                <Input value={form.cliente_telefone} onChange={e => setForm(prev => ({ ...prev, cliente_telefone: e.target.value }))} placeholder="(xx) xxxxx-xxxx" className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Desconto (%)</Label>
                <Input type="number" min="0" max="100" value={form.desconto_pct} onChange={e => setForm(prev => ({ ...prev, desconto_pct: e.target.value }))} className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Status inicial</Label>
                <Select value={form.status} onValueChange={v => setForm(prev => ({ ...prev, status: v as StatusVenda }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['fabricando', 'encomenda', 'separado', 'pronto'] as StatusVenda[]).map(s => (
                      <SelectItem key={s} value={s}>{STATUS_INFO[s].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.status === 'encomenda' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Data da encomenda</Label>
                  <Input type="date" value={form.data_encomenda} onChange={e => setForm(prev => ({ ...prev, data_encomenda: e.target.value }))} className="h-8 text-sm" />
                </div>
              )}
            </div>
          </section>

          {/* Itens */}
          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Produtos</p>

            {/* Busca de item */}
            <div className="relative">
              <Input
                placeholder="Adicionar produto..."
                value={itemBusca}
                onChange={e => { setItemBusca(e.target.value); setItemBuscaAberta(true) }}
                onFocus={() => setItemBuscaAberta(true)}
                onBlur={() => setTimeout(() => setItemBuscaAberta(false), 150)}
                className="h-8 text-sm"
              />
              {itemBuscaAberta && itensFiltrados.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-md border border-border bg-popover shadow-md max-h-40 overflow-y-auto">
                  {itensFiltrados.map(item => (
                    <button key={item.id} onMouseDown={() => adicionarItem(item)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent text-left">
                      <span>{item.nome}</span>
                      {item.categorias_item?.nome && <span className="text-muted-foreground ml-1">{item.categorias_item.nome}</span>}
                      {meuPrecoMap[item.id]?.preco_limpo != null && (
                        <span className="ml-auto text-emerald-400 tabular-nums">
                          {fmt(form.tipo_dinheiro === 'sujo'
                            ? (meuPrecoMap[item.id].preco_sujo ?? meuPrecoMap[item.id].preco_limpo!)
                            : meuPrecoMap[item.id].preco_limpo!)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Linhas de itens */}
            {form.itens.length > 0 && (
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="grid grid-cols-[1fr_60px_90px_110px_28px] gap-2 px-3 py-1.5 bg-white/[0.02] text-[10px] text-muted-foreground font-medium border-b border-border/50">
                  <span>Item</span><span className="text-center">Qtd</span><span className="text-center">Preço unit.</span><span className="text-center">Fabricar / Estoque</span><span />
                </div>
                {form.itens.map(it => {
                  const estoqueDisp = estoqueMap[it.item_id]?.produto_final ?? 0
                  return (
                    <div key={it.tempId} className="border-b border-border/30 last:border-0">
                      <div className="grid grid-cols-[1fr_60px_90px_110px_28px] gap-2 items-center px-3 py-2">
                        <span className="text-xs font-medium truncate">{it.item_nome}</span>
                        <Input type="number" min="1" value={it.quantidade} onChange={e => updateItem(it.tempId, 'quantidade', e.target.value)} className="h-7 text-xs text-center px-1" />
                        <Input type="number" min="0" value={it.preco_unit} onChange={e => updateItem(it.tempId, 'preco_unit', e.target.value)} className="h-7 text-xs text-center px-1" />
                        <div className="flex rounded overflow-hidden border border-border h-7">
                          <button onClick={() => updateItem(it.tempId, 'origem', 'fabricar')}
                            className={cn('flex-1 text-[10px] font-medium transition-colors', it.origem === 'fabricar' ? 'bg-blue-500/20 text-blue-400' : 'text-muted-foreground hover:text-foreground')}>
                            Fab.
                          </button>
                          <button onClick={() => updateItem(it.tempId, 'origem', 'estoque')}
                            className={cn('flex-1 text-[10px] font-medium transition-colors border-l border-border', it.origem === 'estoque' ? 'bg-purple-500/20 text-purple-400' : 'text-muted-foreground hover:text-foreground')}>
                            Est.
                          </button>
                        </div>
                        <button onClick={() => removerItem(it.tempId)} className="flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {it.origem === 'estoque' && (
                        <div className={cn('px-3 pb-1.5 text-[10px]', estoqueDisp >= (parseFloat(it.quantidade) || 0) ? 'text-green-400/70' : 'text-red-400/80')}>
                          Estoque disponível: {estoqueDisp} un.
                          {estoqueDisp < (parseFloat(it.quantidade) || 0) && ' ⚠ insuficiente'}
                        </div>
                      )}
                    </div>
                  )
                })}
                <div className="grid grid-cols-[1fr_60px_90px_110px_28px] gap-2 px-3 py-2 bg-white/[0.02] border-t border-border/50">
                  <span className="text-xs text-muted-foreground col-span-3">
                    {parseFloat(form.desconto_pct) > 0 ? `Subtotal ${fmt(subtotal)} · Total após desc.` : 'Total'}
                  </span>
                  <span className="text-sm font-bold text-primary tabular-nums text-center">{fmt(total)}</span>
                  <span />
                </div>
              </div>
            )}
          </section>

          {/* Observações */}
          <section className="space-y-1.5">
            <Label className="text-xs">Observações</Label>
            <textarea
              value={form.notas}
              onChange={e => setForm(prev => ({ ...prev, notas: e.target.value }))}
              rows={2}
              placeholder="Notas adicionais..."
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring resize-none"
            />
          </section>
        </div>

        <div className="flex justify-end gap-2 shrink-0 pt-2 border-t border-border">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" onClick={() => onSave(form)} disabled={saving || !form.cliente_nome.trim() || form.itens.length === 0}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : editando ? 'Salvar' : 'Criar Pedido'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export function VendasClient({
  userId, userNome, vendas: vendasIniciais, faccoes, allItems, receitas, estoque: estoqueInicial,
  precosVigentes, lojaPrecos, faccaoPrecos, meuLojaId, meuFaccaoId, filtroInicial, podeEditar,
}: Props) {
  const sbRef = useRef<ReturnType<typeof createClient> | null>(null)
  const sb = useCallback(() => { if (!sbRef.current) sbRef.current = createClient(); return sbRef.current }, [])

  const [vendas, setVendas] = useState<Venda[]>(vendasIniciais)
  const [estoqueState, setEstoqueState] = useState<EstoqueEntry[]>(estoqueInicial)
  const [formOpen, setFormOpen] = useState(false)
  const [editando, setEditando] = useState<Venda | null>(null)
  const [saving, setSaving] = useState(false)
  const [filtro, setFiltro] = useState<string>(filtroInicial)

  // ── Mapas ──────────────────────────────────────────────────────────────────

  const itemMap = useMemo(() => Object.fromEntries(allItems.map(i => [i.id, i])), [allItems])

  const receitaMap = useMemo(() => {
    const map: Record<string, Receita[]> = {}
    receitas.forEach(r => { if (!map[r.item_id]) map[r.item_id] = []; map[r.item_id].push(r) })
    return map
  }, [receitas])

  const estoqueMap = useMemo(() => {
    const map: Record<string, Record<string, number>> = {}
    estoqueState.forEach(e => {
      if (!map[e.item_id]) map[e.item_id] = {}
      map[e.item_id][e.tipo] = e.quantidade
    })
    return map
  }, [estoqueState])

  const meuPrecoMap = useMemo(() => {
    const map: Record<string, { preco_limpo: number | null; preco_sujo: number | null }> = {}
    precosVigentes.forEach(p => { map[p.item_id] = { preco_limpo: p.preco_limpo, preco_sujo: p.preco_sujo } })
    if (meuLojaId) {
      lojaPrecos.filter(lp => lp.loja_id === meuLojaId).forEach(lp => {
        map[lp.item_id] = { preco_limpo: lp.preco, preco_sujo: lp.preco_sujo }
      })
    }
    if (meuFaccaoId) {
      faccaoPrecos.filter(fp => fp.faccao_id === meuFaccaoId).forEach(fp => {
        if (!meuLojaId || !lojaPrecos.some(lp => lp.loja_id === meuLojaId && lp.item_id === fp.item_id))
          map[fp.item_id] = { preco_limpo: fp.preco_limpo, preco_sujo: fp.preco_sujo }
      })
    }
    return map
  }, [precosVigentes, lojaPrecos, faccaoPrecos, meuLojaId, meuFaccaoId])

  // ── Filtro ─────────────────────────────────────────────────────────────────

  const vendasFiltradas = useMemo(() => {
    if (filtro === 'todos') return vendas.filter(v => v.status !== 'entregue' && v.status !== 'cancelado')
    if (filtro === 'entregue') return vendas.filter(v => v.status === 'entregue')
    if (filtro === 'cancelado') return vendas.filter(v => v.status === 'cancelado')
    return vendas.filter(v => v.status === filtro)
  }, [vendas, filtro])

  // ── Ações ──────────────────────────────────────────────────────────────────

  async function handleSave(form: FormState) {
    if (!form.cliente_nome.trim() || form.itens.length === 0) return
    setSaving(true)
    try {
      if (editando) {
        // Update venda
        const { error } = await sb().from('vendas').update({
          faccao_id: form.faccao_id || null,
          cliente_nome: form.cliente_nome.trim(),
          cliente_telefone: form.cliente_telefone || null,
          tipo_dinheiro: form.tipo_dinheiro,
          desconto_pct: parseFloat(form.desconto_pct) || 0,
          notas: form.notas || null,
          data_encomenda: form.data_encomenda || null,
          status: form.status,
        }).eq('id', editando.id)
        if (error) { toast.error('Erro ao salvar: ' + error.message); return }

        // Replace items
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
        // Create venda
        const { data: venda, error: vendaErr } = await sb().from('vendas').insert({
          faccao_id: form.faccao_id || null,
          cliente_nome: form.cliente_nome.trim(),
          cliente_telefone: form.cliente_telefone || null,
          tipo_dinheiro: form.tipo_dinheiro,
          desconto_pct: parseFloat(form.desconto_pct) || 0,
          status: form.status,
          data_encomenda: form.data_encomenda || null,
          notas: form.notas || null,
          criado_por: userId,
          criado_por_nome: userNome,
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
    } finally {
      setSaving(false)
    }
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
      ? { ...v, status: 'entregue', entregue_por: userId, entregue_por_nome: userNome, entregue_em: agora }
      : v
    ))
    toast.success('Entrega registrada!')
    // Desconta estoque automaticamente se não foi feito
    if (!venda.estoque_descontado) await handleDescontarEstoque({ ...venda, status: 'entregue' })
  }

  async function handleDesfazerEntrega(id: string) {
    const { error } = await sb().from('vendas').update({
      status: 'pronto', entregue_por: null, entregue_por_nome: null, entregue_em: null,
    }).eq('id', id)
    if (error) { toast.error('Erro ao desfazer entrega'); return }
    setVendas(prev => prev.map(v => v.id === id
      ? { ...v, status: 'pronto', entregue_por: null, entregue_por_nome: null, entregue_em: null }
      : v
    ))
    toast.success('Entrega desfeita — pedido voltou para Pronto')
  }

  async function handleDescontarEstoque(venda: Venda) {
    if (venda.estoque_descontado) { toast.info('Estoque já foi descontado para este pedido'); return }
    // Calcular deduções
    const deducoes: Record<string, { tipo: 'materia_prima' | 'produto_final'; qtd: number }> = {}
    for (const it of venda.itens) {
      if (!it.item_id) continue
      if (it.origem === 'estoque') {
        if (!deducoes[it.item_id]) deducoes[it.item_id] = { tipo: 'produto_final', qtd: 0 }
        deducoes[it.item_id].qtd += it.quantidade
      } else { // fabricar
        for (const r of receitaMap[it.item_id] ?? []) {
          if (!deducoes[r.ingrediente_id]) deducoes[r.ingrediente_id] = { tipo: 'materia_prima', qtd: 0 }
          deducoes[r.ingrediente_id].qtd += r.quantidade * it.quantidade
        }
      }
    }
    // Aplicar deduções
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

  // ── Render ─────────────────────────────────────────────────────────────────

  const filtros = [
    { key: 'todos', label: 'Ativos' },
    { key: 'fabricando', label: 'Fabricando' },
    { key: 'encomenda', label: 'Encomenda' },
    { key: 'separado', label: 'Separado' },
    { key: 'pronto', label: 'Pronto' },
    { key: 'entregue', label: 'Entregues' },
    { key: 'cancelado', label: 'Cancelados' },
  ]

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="px-6 py-3 border-b border-border flex items-center gap-2 flex-wrap shrink-0">
        <div className="flex gap-1 flex-wrap">
          {filtros.map(f => (
            <button key={f.key} onClick={() => setFiltro(f.key)}
              className={cn('px-3 py-1.5 rounded text-xs font-medium transition-colors',
                filtro === f.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.06]'
              )}>
              {f.label}
              {f.key !== 'todos' && f.key !== 'entregue' && f.key !== 'cancelado' && (
                <span className="ml-1 opacity-60">
                  {vendas.filter(v => v.status === f.key).length > 0 && `(${vendas.filter(v => v.status === f.key).length})`}
                </span>
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

      {/* Cards */}
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
              <VendaCard
                key={venda.id}
                venda={venda}
                userId={userId} userNome={userNome}
                receitaMap={receitaMap} estoqueMap={estoqueMap} itemMap={itemMap}
                podeEditar={podeEditar}
                onStatusChange={handleStatusChange}
                onEntregar={handleEntregar}
                onDesfazerEntrega={handleDesfazerEntrega}
                onDescontarEstoque={handleDescontarEstoque}
                onEdit={v => { setEditando(v); setFormOpen(true) }}
              />
            ))}
          </div>
        )}
      </div>

      <OrderDialog
        open={formOpen}
        onOpenChange={v => { setFormOpen(v); if (!v) setEditando(null) }}
        editando={editando}
        faccoes={faccoes}
        allItems={allItems}
        meuPrecoMap={meuPrecoMap}
        estoqueMap={estoqueMap}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  )
}

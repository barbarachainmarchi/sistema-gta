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
  Plus, X, Edit2, Truck, Trash2, ChevronDown, ChevronUp,
  Package, Loader2, AlertTriangle, Check, RotateCcw, Search,
} from 'lucide-react'
import { RelatorioAba } from './relatorio-aba'

// ── Tipos ─────────────────────────────────────────────────────────────────────

type StatusVenda = 'fabricando' | 'encomenda' | 'separado' | 'pronto' | 'entregue' | 'cancelado'

type VendaItem = {
  id: string; venda_id: string; item_id: string | null
  item_nome: string; quantidade: number; preco_unit: number; origem: 'fabricar' | 'estoque'
}
type Venda = {
  id: string; faccao_id: string | null; loja_id: string | null; cliente_nome: string; cliente_telefone: string | null
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
  preco_override: number | null
  tem_craft: boolean; origem: 'fabricar' | 'estoque'
}
type FormItem = { tempId: string; item_id: string; item_nome: string; quantidade: string; preco_unit: string; origem: 'fabricar' | 'estoque' }
type FormState = {
  faccao_id: string; loja_id: string; cliente_nome: string; cliente_telefone: string
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

function VendaCard({ venda, faccoes, lojas, receitaMap, estoqueMap, itemMap, podeEditar,
  onStatusChange, onEntregar, onDesfazerEntrega, onEdit, onDelete }: {
  venda: Venda
  faccoes: Faccao[]
  lojas: Loja[]
  receitaMap: Record<string, Receita[]>; estoqueMap: Record<string, Record<string, number>>; itemMap: Record<string, ItemSimples>
  podeEditar: boolean
  onStatusChange: (id: string, s: StatusVenda) => void; onEntregar: (v: Venda) => void
  onDesfazerEntrega: (id: string) => void; onEdit: (v: Venda) => void; onDelete: (id: string) => void
}) {
  const [materiaisAberto, setMateriaisAberto] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const faccaoNome = faccoes.find(f => f.id === venda.faccao_id)?.nome ?? null
  const lojaNome = lojas.find(l => l.id === venda.loja_id)?.nome ?? null
  const empresaNome = faccaoNome ?? lojaNome
  const empresaTipo: 'faccao' | 'loja' | null = faccaoNome ? 'faccao' : lojaNome ? 'loja' : null
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
            {empresaNome && (
              <span className={cn('font-medium text-[11px]', empresaTipo === 'loja' ? 'text-blue-400/80' : 'text-primary/70')}>
                {empresaTipo === 'loja' ? '[Loja] ' : ''}{empresaNome}
              </span>
            )}
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

// ── Formulário de pedido (novo design 3 colunas) ──────────────────────────────

function OrderDialog({
  open, onOpenChange, editando, faccoes, lojas, membros, onMembroCreated,
  meuFaccao, meuLoja, estoqueMap, receitas, allItems, onSave, saving,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; editando: Venda | null
  faccoes: Faccao[]; lojas: Loja[]; membros: Membro[]
  onMembroCreated: (m: Membro) => void
  meuFaccao: { id: string; nome: string } | null; meuLoja: { id: string; nome: string } | null
  estoqueMap: Record<string, Record<string, number>>
  receitas: Receita[]; allItems: ItemSimples[]
  onSave: (form: FormState) => void; saving: boolean
}) {
  const sbRef = useRef<ReturnType<typeof createClient> | null>(null)
  const sb = useCallback(() => { if (!sbRef.current) sbRef.current = createClient(); return sbRef.current }, [])

  const emptyForm = (): FormState => ({
    faccao_id: '', loja_id: '', cliente_nome: '', cliente_telefone: '', tipo_dinheiro: 'limpo',
    desconto_pct: '0', notas: '', data_encomenda: today(), status: 'fabricando', itens: []
  })

  const [form, setForm] = useState<FormState>(emptyForm)
  const [empresaNome, setEmpresaNome] = useState('')
  const [empresaAberta, setEmpresaAberta] = useState(false)
  const [membroNome, setMembroNome] = useState('')
  const [membroAberta, setMembroAberta] = useState(false)
  const [novoMembroTel, setNovoMembroTel] = useState('')
  const [criandoMembro, setCriandoMembro] = useState(false)
  const [cart, setCart] = useState<CartItem[]>([])
  const [meusProdutos, setMeusProdutos] = useState<WpItem[]>([])
  const [loadingProd, setLoadingProd] = useState(false)
  const [buscaProd, setBuscaProd] = useState('')

  const cartMap = useMemo(() => Object.fromEntries(cart.map(c => [c.item_id, c])), [cart])
  const descontoPct = parseFloat(form.desconto_pct) || 0

  // Load products when dialog opens
  useEffect(() => {
    if (!open) return
    const faccaoId = meuFaccao?.id
    const lojaId = meuLoja?.id
    if (!faccaoId && !lojaId) { setMeusProdutos([]); return }
    setLoadingProd(true)
    if (faccaoId) {
      sb().from('faccao_item_precos')
        .select('item_id, preco_limpo, preco_sujo, items(id, nome, tem_craft)')
        .eq('faccao_id', faccaoId)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then(({ data }) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setMeusProdutos((data ?? []).map((r: any) => ({
            item_id: r.item_id, nome: r.items?.nome ?? r.item_id,
            tem_craft: r.items?.tem_craft ?? false,
            preco_limpo: r.preco_limpo, preco_sujo: r.preco_sujo,
          })).sort((a: WpItem, b: WpItem) => a.nome.localeCompare(b.nome)))
          setLoadingProd(false)
        })
    } else {
      sb().from('loja_item_precos')
        .select('item_id, preco, preco_sujo, items(id, nome, tem_craft)')
        .eq('loja_id', lojaId!)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then(({ data }) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setMeusProdutos((data ?? []).map((r: any) => ({
            item_id: r.item_id, nome: r.items?.nome ?? r.item_id,
            tem_craft: r.items?.tem_craft ?? false,
            preco_limpo: r.preco ?? null, preco_sujo: r.preco_sujo ?? null,
          })).sort((a: WpItem, b: WpItem) => a.nome.localeCompare(b.nome)))
          setLoadingProd(false)
        })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, meuFaccao?.id, meuLoja?.id])

  const prevOpen = useRef(false)
  if (open !== prevOpen.current) {
    prevOpen.current = open
    if (open) {
      setBuscaProd('')
      if (editando) {
        setForm({
          faccao_id: editando.faccao_id ?? '',
          loja_id: editando.loja_id ?? '',
          cliente_nome: editando.cliente_nome,
          cliente_telefone: editando.cliente_telefone ?? '',
          tipo_dinheiro: editando.tipo_dinheiro,
          desconto_pct: String(editando.desconto_pct),
          notas: editando.notas ?? '',
          data_encomenda: editando.data_encomenda ?? today(),
          status: editando.status, itens: [],
        })
        const editEmpresaNome = editando.faccao_id
          ? (faccoes.find(f => f.id === editando.faccao_id)?.nome ?? '')
          : editando.loja_id ? (lojas.find(l => l.id === editando.loja_id)?.nome ?? '') : ''
        setEmpresaNome(editEmpresaNome)
        setMembroNome(editando.cliente_nome)
        setCart(editando.itens.filter(it => it.item_id).map(it => ({
          item_id: it.item_id!, nome: it.item_nome, quantidade: it.quantidade,
          preco_limpo: it.preco_unit, preco_sujo: null, preco_override: null,
          tem_craft: it.origem === 'fabricar', origem: it.origem,
        })))
      } else {
        setForm(emptyForm())
        setEmpresaNome('')
        setMembroNome('')
        setCart([])
        setNovoMembroTel('')
      }
      setEmpresaAberta(false)
      setMembroAberta(false)
    }
  }

  // Empresa autocomplete
  type EmpresaOpc = { tipo: 'faccao'; id: string; nome: string; sigla: string | null; desconto: number } | { tipo: 'loja'; id: string; nome: string }
  const empresaSugestoes = useMemo((): EmpresaOpc[] => {
    if (!empresaAberta || !empresaNome.trim()) return []
    const q = empresaNome.toLowerCase()
    const ff = faccoes.filter(f => f.nome.toLowerCase().includes(q) || f.sigla?.toLowerCase().includes(q))
      .slice(0, 5).map(f => ({ tipo: 'faccao' as const, id: f.id, nome: f.nome, sigla: f.sigla ?? null, desconto: f.desconto_padrao_pct }))
    const ll = lojas.filter(l => l.nome.toLowerCase().includes(q)).slice(0, 4)
      .map(l => ({ tipo: 'loja' as const, id: l.id, nome: l.nome }))
    return [...ff, ...ll].slice(0, 8)
  }, [faccoes, lojas, empresaNome, empresaAberta])

  function selecionarEmpresa(e: EmpresaOpc) {
    if (e.tipo === 'faccao') {
      const f = faccoes.find(f => f.id === e.id)!
      setForm(prev => ({ ...prev, faccao_id: e.id, loja_id: '', desconto_pct: f.desconto_padrao_pct > 0 ? String(f.desconto_padrao_pct) : prev.desconto_pct }))
    } else {
      setForm(prev => ({ ...prev, faccao_id: '', loja_id: e.id }))
    }
    setEmpresaNome(e.nome)
    setEmpresaAberta(false)
  }

  // Membro autocomplete
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

  // Cart helpers
  function getPrecoEfetivo(c: CartItem): number {
    if (c.preco_override != null) return c.preco_override
    return form.tipo_dinheiro === 'sujo' ? (c.preco_sujo ?? c.preco_limpo ?? 0) : (c.preco_limpo ?? 0)
  }

  function setCartQtd(item_id: string, qtd: number) {
    if (qtd <= 0) { setCart(prev => prev.filter(c => c.item_id !== item_id)); return }
    setCart(prev => {
      const exists = prev.find(c => c.item_id === item_id)
      if (exists) return prev.map(c => c.item_id === item_id ? { ...c, quantidade: qtd } : c)
      // Add from meusProdutos
      const p = meusProdutos.find(p => p.item_id === item_id)
      if (!p) return prev
      return [...prev, { item_id: p.item_id, nome: p.nome, quantidade: qtd, preco_limpo: p.preco_limpo, preco_sujo: p.preco_sujo, preco_override: null, tem_craft: p.tem_craft, origem: p.tem_craft ? 'fabricar' : 'estoque' }]
    })
  }

  function setCartPreco(item_id: string, preco: number | null) {
    setCart(prev => prev.map(c => c.item_id === item_id ? { ...c, preco_override: preco } : c))
  }

  function setCartOrigem(item_id: string, origem: 'fabricar' | 'estoque') {
    setCart(prev => prev.map(c => c.item_id === item_id ? { ...c, origem } : c))
  }

  // Produtos filtrados (search)
  const produtosFiltrados = useMemo(() => {
    if (!buscaProd.trim()) return meusProdutos
    const q = buscaProd.toLowerCase()
    return meusProdutos.filter(p => p.nome.toLowerCase().includes(q))
  }, [meusProdutos, buscaProd])

  // Ingredients panel
  const ingredientes = useMemo(() => {
    const ingredMap: Record<string, { nome: string; necessario: number }> = {}
    for (const c of cart) {
      if (!c.item_id || c.origem !== 'fabricar') continue
      for (const r of receitas.filter(r => r.item_id === c.item_id)) {
        const nome = allItems.find(i => i.id === r.ingrediente_id)?.nome ?? r.ingrediente_id
        if (!ingredMap[r.ingrediente_id]) ingredMap[r.ingrediente_id] = { nome, necessario: 0 }
        ingredMap[r.ingrediente_id].necessario += r.quantidade * c.quantidade
      }
    }
    return Object.entries(ingredMap)
      .map(([id, v]) => ({ id, ...v, disponivel: estoqueMap[id]?.materia_prima ?? 0 }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [cart, receitas, allItems, estoqueMap])

  // Totals
  const subtotal = cart.reduce((s, c) => s + c.quantidade * getPrecoEfetivo(c), 0)
  const descValor = subtotal * descontoPct / 100
  const total = subtotal - descValor

  function buildItens(): FormItem[] {
    return cart.map(c => ({
      tempId: c.item_id, item_id: c.item_id, item_nome: c.nome,
      quantidade: String(c.quantidade),
      preco_unit: String(c.preco_override ?? (form.tipo_dinheiro === 'sujo' ? (c.preco_sujo ?? c.preco_limpo ?? 0) : (c.preco_limpo ?? 0))),
      origem: c.origem,
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}
        className="max-w-[1400px] w-[95vw] h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">

        {/* Header */}
        <DialogHeader className="px-5 pt-3.5 pb-3 shrink-0 border-b border-border">
          <div className="flex items-center gap-3">
            <DialogTitle className="text-sm font-semibold">{editando ? 'Editar Pedido' : 'Novo Pedido'}</DialogTitle>
            <div className="ml-auto flex items-center gap-2">
              <span className={cn('text-xs', form.tipo_dinheiro !== 'sujo' && 'text-emerald-400 font-medium')}>Limpo</span>
              <Switch checked={form.tipo_dinheiro === 'sujo'}
                onCheckedChange={v => setForm(prev => ({ ...prev, tipo_dinheiro: v ? 'sujo' : 'limpo' }))} />
              <span className={cn('text-xs', form.tipo_dinheiro === 'sujo' && 'text-orange-400 font-medium')}>Sujo</span>
            </div>
          </div>
        </DialogHeader>

        {/* Body: 3 columns */}
        <div className="flex-1 flex overflow-hidden min-h-0">

          {/* ── Coluna 1: Info do pedido ── */}
          <div className="w-64 shrink-0 border-r border-border flex flex-col overflow-y-auto">
            <div className="p-4 space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Pedido</p>

              {/* Empresa */}
              <div className="space-y-1 relative">
                <Label className="text-xs">Facção / Loja</Label>
                <Input value={empresaNome}
                  onChange={e => { setEmpresaNome(e.target.value); setForm(prev => ({ ...prev, faccao_id: '', loja_id: '' })); setEmpresaAberta(true) }}
                  onFocus={() => setEmpresaAberta(true)}
                  onBlur={() => setTimeout(() => setEmpresaAberta(false), 150)}
                  placeholder="Buscar..." className="h-8 text-sm" />
                {empresaAberta && empresaSugestoes.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-30 mt-1 rounded-md border border-border bg-popover shadow-md overflow-hidden">
                    {empresaSugestoes.map(e => (
                      <button key={e.tipo + e.id} type="button" onMouseDown={ev => { ev.preventDefault(); selecionarEmpresa(e) }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent text-left">
                        <span className={cn('text-[9px] font-bold px-1 py-0.5 rounded shrink-0', e.tipo === 'faccao' ? 'bg-primary/15 text-primary' : 'bg-blue-500/15 text-blue-400')}>
                          {e.tipo === 'faccao' ? 'F' : 'L'}
                        </span>
                        <span className="font-medium truncate">{e.nome}</span>
                        {e.tipo === 'faccao' && e.desconto > 0 && <span className="ml-auto text-green-400 shrink-0">{e.desconto}%</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Nome / Membro */}
              <div className="space-y-1 relative">
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
                        {m.telefone && <span className="ml-auto text-muted-foreground text-[10px]">{m.telefone}</span>}
                      </button>
                    ))}
                    {membroNaoEncontrado && (
                      <div className="border-t border-border/50 px-3 py-2.5 space-y-2 bg-muted/20">
                        <p className="text-[11px] text-muted-foreground">
                          &quot;{membroNome.trim()}&quot; não encontrado. Cadastrar?
                        </p>
                        <div className="flex gap-1.5">
                          <Input placeholder="Telefone (opcional)" value={novoMembroTel}
                            onChange={e => setNovoMembroTel(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCadastrarMembro() } }}
                            className="h-7 text-xs flex-1" onMouseDown={e => e.stopPropagation()} />
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
              <div className="space-y-1">
                <Label className="text-xs">Telefone</Label>
                <Input value={form.cliente_telefone}
                  onChange={e => setForm(prev => ({ ...prev, cliente_telefone: e.target.value }))}
                  placeholder="(xx) xxxxx-xxxx" className="h-8 text-sm" />
              </div>

              {/* Desconto */}
              <div className="space-y-1">
                <Label className="text-xs">Desconto (%)</Label>
                <Input type="number" min="0" max="100" value={form.desconto_pct}
                  onChange={e => setForm(prev => ({ ...prev, desconto_pct: e.target.value }))}
                  className="h-8 text-sm" />
              </div>

              {/* Data */}
              <div className="space-y-1">
                <Label className="text-xs">Data</Label>
                <Input type="date" value={form.data_encomenda}
                  onChange={e => setForm(prev => ({ ...prev, data_encomenda: e.target.value }))}
                  className="h-8 text-sm" />
              </div>

              {/* Status */}
              <div className="space-y-1">
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

              {/* Notas */}
              <div className="space-y-1">
                <Label className="text-xs">Notas</Label>
                <textarea value={form.notas}
                  onChange={e => setForm(prev => ({ ...prev, notas: e.target.value }))}
                  rows={3} placeholder="Observações..."
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring resize-none" />
              </div>
            </div>
          </div>

          {/* ── Coluna 2: Produtos ── */}
          <div className="flex-1 flex flex-col min-w-0 border-r border-border">

            {/* Search */}
            <div className="px-3 py-2 shrink-0 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Filtrar produtos..." value={buscaProd}
                  onChange={e => setBuscaProd(e.target.value)}
                  className="h-8 text-xs pl-7" />
              </div>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[1fr_56px_68px_80px_72px_32px] gap-x-2 px-3 py-1.5 shrink-0 border-b border-border/40 text-[10px] text-muted-foreground font-medium bg-white/[0.01]">
              <span>Produto</span>
              <span className="text-right">Estoque</span>
              <span className="text-right">Qtd</span>
              <span className="text-right">Preço unit.</span>
              <span className="text-right">Subtotal</span>
              <span />
            </div>

            {/* Product list */}
            <div className="flex-1 overflow-y-auto divide-y divide-border/20">
              {!meuFaccao && !meuLoja ? (
                <p className="text-xs text-muted-foreground text-center py-12 px-4">
                  Nenhum local de trabalho configurado no seu perfil.
                </p>
              ) : loadingProd ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : produtosFiltrados.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-10">Nenhum produto encontrado</p>
              ) : produtosFiltrados.map(p => {
                const c = cartMap[p.item_id]
                const inCart = !!c
                const precoBase = form.tipo_dinheiro === 'sujo' ? (p.preco_sujo ?? p.preco_limpo) : p.preco_limpo
                const precoEfetivo = c ? (c.preco_override ?? (form.tipo_dinheiro === 'sujo' ? (c.preco_sujo ?? c.preco_limpo ?? 0) : (c.preco_limpo ?? 0))) : (precoBase ?? 0)
                const estoqueDisp = estoqueMap[p.item_id]?.produto_final ?? 0
                const qtd = c?.quantidade ?? 0
                const subtotalItem = qtd * precoEfetivo * (1 - descontoPct / 100)

                return (
                  <div key={p.item_id}
                    className={cn('grid grid-cols-[1fr_56px_68px_80px_72px_32px] gap-x-2 items-center px-3 py-2 transition-colors',
                      inCart ? 'bg-primary/[0.04]' : 'hover:bg-white/[0.02]'
                    )}>
                    {/* Nome + badges */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      {inCart && (
                        <div className="flex gap-0.5 shrink-0">
                          <button onClick={() => setCartOrigem(p.item_id, 'fabricar')}
                            className={cn('text-[9px] font-bold px-1 py-0.5 rounded transition-colors',
                              c?.origem === 'fabricar' ? 'bg-blue-500/20 text-blue-400' : 'bg-transparent text-muted-foreground hover:text-foreground'
                            )}>Fab</button>
                          <button onClick={() => setCartOrigem(p.item_id, 'estoque')}
                            className={cn('text-[9px] font-bold px-1 py-0.5 rounded transition-colors',
                              c?.origem === 'estoque' ? 'bg-purple-500/20 text-purple-400' : 'bg-transparent text-muted-foreground hover:text-foreground'
                            )}>Est</button>
                        </div>
                      )}
                      <span className={cn('text-xs font-medium truncate', inCart ? 'text-foreground' : 'text-muted-foreground')}>{p.nome}</span>
                    </div>

                    {/* Estoque */}
                    <div className="text-right">
                      {c?.origem === 'estoque' ? (
                        <span className={cn('text-[10px] tabular-nums font-medium', estoqueDisp >= qtd ? 'text-green-400' : 'text-red-400')}>
                          {estoqueDisp}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/40 tabular-nums">{estoqueDisp > 0 ? estoqueDisp : '—'}</span>
                      )}
                    </div>

                    {/* Qtd */}
                    <div className="flex justify-end">
                      <Input
                        type="number" min="0"
                        value={qtd === 0 ? '' : qtd}
                        placeholder="0"
                        onChange={e => setCartQtd(p.item_id, parseInt(e.target.value) || 0)}
                        className={cn('h-7 text-xs text-right w-full tabular-nums',
                          inCart && 'border-primary/40 bg-primary/[0.04]'
                        )} />
                    </div>

                    {/* Preço unit (editável quando no carrinho) */}
                    <div className="flex justify-end">
                      {inCart ? (
                        <Input
                          type="number" min="0"
                          value={c.preco_override != null ? c.preco_override : (precoBase ?? 0)}
                          onChange={e => {
                            const v = parseFloat(e.target.value)
                            setCartPreco(p.item_id, isNaN(v) ? null : v)
                          }}
                          className="h-7 text-xs text-right w-full tabular-nums" />
                      ) : (
                        <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                          {precoBase != null ? fmt(precoBase) : '—'}
                        </span>
                      )}
                    </div>

                    {/* Subtotal */}
                    <div className="text-right">
                      {inCart && qtd > 0 ? (
                        <span className="text-xs font-medium tabular-nums text-primary">
                          {fmt(subtotalItem)}
                        </span>
                      ) : <span className="text-[10px] text-muted-foreground/30">—</span>}
                    </div>

                    {/* Remove */}
                    <div className="flex justify-center">
                      {inCart && (
                        <button onClick={() => setCartQtd(p.item_id, 0)}
                          className="h-5 w-5 flex items-center justify-center text-muted-foreground hover:text-red-400 transition-colors rounded">
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Coluna 3: Ingredientes + Resumo ── */}
          <div className="w-72 shrink-0 flex flex-col overflow-y-auto">

            {/* Resumo */}
            <div className="p-4 border-b border-border shrink-0 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Resumo</p>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Itens</span>
                  <span className="tabular-nums">{cart.length}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{fmt(subtotal)}</span>
                </div>
                {descontoPct > 0 && (
                  <div className="flex justify-between text-xs text-green-400">
                    <span>Desconto ({descontoPct}%)</span>
                    <span className="tabular-nums">-{fmt(descValor)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold border-t border-border/50 pt-1.5 mt-1">
                  <span>Total</span>
                  <span className={cn('tabular-nums', form.tipo_dinheiro === 'sujo' ? 'text-orange-400' : 'text-primary')}>
                    {fmt(total)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium',
                  form.tipo_dinheiro === 'sujo' ? 'bg-orange-500/15 text-orange-400' : 'bg-emerald-500/15 text-emerald-400'
                )}>
                  {form.tipo_dinheiro === 'sujo' ? 'Dinheiro Sujo' : 'Dinheiro Limpo'}
                </span>
              </div>
            </div>

            {/* Ingredientes */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-4 py-2.5 border-b border-border/50">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Matérias-primas necessárias</p>
              </div>
              {ingredientes.length === 0 ? (
                <p className="text-xs text-muted-foreground px-4 py-6 text-center italic">
                  {cart.filter(c => c.origem === 'fabricar').length === 0
                    ? 'Adicione itens para fabricar para ver os ingredientes'
                    : 'Nenhuma receita cadastrada para os itens'}
                </p>
              ) : (
                <div className="divide-y divide-border/20">
                  <div className="grid grid-cols-[1fr_44px_44px_20px] gap-1 px-4 py-1.5 text-[10px] text-muted-foreground/60 font-medium">
                    <span>Ingrediente</span><span className="text-right">Precisa</span><span className="text-right">Tem</span><span />
                  </div>
                  {ingredientes.map(ing => {
                    const ok = ing.disponivel >= ing.necessario
                    return (
                      <div key={ing.id} className={cn('grid grid-cols-[1fr_44px_44px_20px] gap-1 items-center px-4 py-2', !ok && 'bg-red-500/[0.04]')}>
                        <span className="text-xs font-medium truncate">{ing.nome}</span>
                        <span className="text-xs text-right tabular-nums text-muted-foreground">{ing.necessario}</span>
                        <span className={cn('text-xs text-right tabular-nums font-medium', ok ? 'text-green-400' : 'text-red-400')}>{ing.disponivel}</span>
                        <span className="flex justify-center">
                          {ok ? <Check className="h-3 w-3 text-green-400" /> : <AlertTriangle className="h-3 w-3 text-red-400" />}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
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
          faccao_id: form.faccao_id || null, loja_id: form.loja_id || null,
          cliente_nome: form.cliente_nome.trim(),
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
          ...v, faccao_id: form.faccao_id || null, loja_id: form.loja_id || null,
          cliente_nome: form.cliente_nome.trim(),
          cliente_telefone: form.cliente_telefone || null, tipo_dinheiro: form.tipo_dinheiro,
          desconto_pct: parseFloat(form.desconto_pct) || 0, notas: form.notas || null,
          data_encomenda: form.data_encomenda || null, status: form.status,
          itens: (itensData ?? []) as VendaItem[],
        } : v))
        toast.success('Pedido atualizado!')
      } else {
        const { data: venda, error: vendaErr } = await sb().from('vendas').insert({
          faccao_id: form.faccao_id || null, loja_id: form.loja_id || null,
          cliente_nome: form.cliente_nome.trim(),
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
      const { data: contaExistente } = await sb().from('financeiro_contas')
        .select('id').eq('faccao_id', venda.faccao_id).eq('status', 'ativo').maybeSingle()
      if (contaExistente) {
        contaId = contaExistente.id
      } else {
        const faccaoNome = faccoes.find(f => f.id === venda.faccao_id)?.nome ?? 'Facção'
        const { data: novaConta } = await sb().from('financeiro_contas').insert({
          nome: faccaoNome, tipo: 'faccao', faccao_id: venda.faccao_id,
          saldo_sujo: 0, saldo_limpo: 0, status: 'ativo',
        }).select('id').single()
        if (novaConta) contaId = novaConta.id
      }
    } else if (venda.loja_id) {
      const { data: contaExistente } = await sb().from('financeiro_contas')
        .select('id').eq('loja_id', venda.loja_id).eq('status', 'ativo').maybeSingle()
      if (contaExistente) {
        contaId = contaExistente.id
      } else {
        const lojaNome = lojas.find(l => l.id === venda.loja_id)?.nome ?? 'Loja'
        const { data: novaConta } = await sb().from('financeiro_contas').insert({
          nome: lojaNome, tipo: 'loja', loja_id: venda.loja_id,
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

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tabs: Ativos | Encomendas | Concluídos | Relatório */}
      <div className="px-6 pt-3 border-b border-border shrink-0">
        <div className="flex gap-0 -mb-px items-end">
          {([
            ['todos',     'Ativos'],
            ['encomenda', 'Encomendas'],
            ['entregue',  'Concluídos'],
            ['relatorio', 'Relatório'],
          ] as const).map(([key, label]) => (
            <button key={key} onClick={() => setFiltro(key)}
              className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                filtro === key
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}>
              {label}
              {key === 'encomenda' && vendas.filter(v => v.status === 'encomenda').length > 0 && (
                <span className="ml-1 text-[10px] opacity-60">
                  ({vendas.filter(v => v.status === 'encomenda').length})
                </span>
              )}
            </button>
          ))}
          {podeEditar && filtro !== 'relatorio' && (
            <Button size="sm" className="h-8 text-xs gap-1 ml-auto mb-1" onClick={() => { setEditando(null); setFormOpen(true) }}>
              <Plus className="h-3.5 w-3.5" />Novo Pedido
            </Button>
          )}
        </div>
      </div>

      {filtro === 'relatorio' ? (
        <RelatorioAba vendas={vendas} faccoes={faccoes} lojas={lojas} allItems={allItems} />
      ) : (
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
                  lojas={lojas}
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
      )}

      <OrderDialog
        open={formOpen}
        onOpenChange={v => { setFormOpen(v); if (!v) setEditando(null) }}
        editando={editando}
        faccoes={faccoes} lojas={lojas}
        membros={membrosState}
        onMembroCreated={m => setMembrosState(prev => [...prev, m].sort((a, b) => a.nome.localeCompare(b.nome)))}
        meuFaccao={meuFaccao} meuLoja={meuLoja}
        estoqueMap={estoqueMap}
        receitas={receitas}
        allItems={allItems}
        onSave={handleSave} saving={saving}
      />
    </div>
  )
}

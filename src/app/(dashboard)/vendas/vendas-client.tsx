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
  Plus, Minus, X, Edit2, Truck, ChevronDown, ChevronUp,
  Package, Loader2, AlertTriangle, Check, RotateCcw, Search, Store, Users,
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
type Membro = { id: string; nome: string; vulgo: string | null; telefone: string | null; faccao_id: string | null }
type ItemSimples = { id: string; nome: string; tem_craft: boolean; peso: number | null; categorias_item: { nome: string } | null }
type Receita = { item_id: string; ingrediente_id: string; quantidade: number }
type EstoqueEntry = { item_id: string; tipo: 'materia_prima' | 'produto_final'; quantidade: number }

type FormItem = { tempId: string; item_id: string; item_nome: string; quantidade: string; preco_unit: string; origem: 'fabricar' | 'estoque' }
type FormState = {
  faccao_id: string; cliente_nome: string; cliente_telefone: string
  tipo_dinheiro: 'sujo' | 'limpo'; desconto_pct: string; notas: string; data_encomenda: string
  status: StatusVenda; itens: FormItem[]
}

type WorkplaceItem = {
  item_id: string; nome: string; tem_craft: boolean
  preco_limpo: number | null; preco_sujo: number | null
}

interface Props {
  userId: string; userNome: string | null
  vendas: Venda[]; faccoes: Faccao[]; allItems: ItemSimples[]
  receitas: Receita[]; estoque: EstoqueEntry[]
  membros: Membro[]
  meuFaccao: { id: string; nome: string } | null
  meuLoja: { id: string; nome: string } | null
  filtroInicial: 'todos' | 'encomenda' | 'entregue'
  podeEditar: boolean
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

// ── Painel de Materiais ───────────────────────────────────────────────────────

function MaterialsPanel({ venda, receitaMap, estoqueMap, itemMap }: {
  venda: Venda
  receitaMap: Record<string, Receita[]>
  estoqueMap: Record<string, Record<string, number>>
  itemMap: Record<string, ItemSimples>
}) {
  const fabricarItens = venda.itens.filter(it => it.origem === 'fabricar' && it.item_id)
  if (fabricarItens.length === 0)
    return <p className="text-xs text-muted-foreground px-4 py-3 italic">Nenhum item marcado para fabricar.</p>

  const ingredMap: Record<string, { nome: string; necessario: number }> = {}
  for (const it of fabricarItens) {
    for (const r of receitaMap[it.item_id!] ?? []) {
      if (!ingredMap[r.ingrediente_id])
        ingredMap[r.ingrediente_id] = { nome: itemMap[r.ingrediente_id]?.nome ?? r.ingrediente_id, necessario: 0 }
      ingredMap[r.ingrediente_id].necessario += r.quantidade * it.quantidade
    }
  }
  const ingredientes = Object.entries(ingredMap).map(([id, v]) => ({
    id, ...v, disponivel: estoqueMap[id]?.materia_prima ?? 0,
  })).sort((a, b) => a.nome.localeCompare(b.nome))

  if (ingredientes.length === 0)
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

function VendaCard({
  venda, receitaMap, estoqueMap, itemMap, podeEditar,
  onStatusChange, onEntregar, onDesfazerEntrega, onDescontarEstoque, onEdit
}: {
  venda: Venda
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
      <div className="px-4 py-3 bg-white/[0.02] border-b border-border/50 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', statusInfo.cls)}>
              {statusInfo.label}
            </span>
            {venda.data_encomenda && (
              <span className="text-[10px] text-muted-foreground/70">{fmtData(venda.data_encomenda)}</span>
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
        <span className="text-[10px] text-muted-foreground/40 shrink-0 cursor-default"
          title={`Criado por: ${venda.criado_por_nome ?? '—'}${venda.entregue_por_nome ? ` · Entregue: ${venda.entregue_por_nome}` : ''}`}>
          {venda.criado_por_nome ?? '—'}
        </span>
      </div>

      <div className="flex-1">
        {venda.itens.length === 0 ? (
          <p className="text-xs text-muted-foreground px-4 py-3 italic">Sem itens</p>
        ) : (
          <div className="divide-y divide-border/30">
            {venda.itens.map(it => (
              <div key={it.id} className="grid grid-cols-[1fr_50px_80px_80px] gap-2 items-center px-4 py-2">
                <div className="min-w-0">
                  <span className="text-sm font-medium truncate block">{it.item_nome}</span>
                  <span className={cn('text-[10px]', it.origem === 'fabricar' ? 'text-blue-400/70' : 'text-purple-400/70')}>
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
        <div className="px-4 py-2.5 border-t border-border/40 bg-white/[0.01] flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {venda.desconto_pct > 0 && `Subtotal ${fmt(subtotal)} · desc -${fmt(descValor)}`}
          </span>
          <span className="text-sm font-bold tabular-nums text-primary">{fmt(total)}</span>
        </div>
      </div>

      {venda.notas && (
        <div className="px-4 py-2 border-t border-border/30 text-xs text-muted-foreground italic bg-white/[0.01]">
          {venda.notas}
        </div>
      )}

      {temFabricar && (
        <div className="border-t border-border/40">
          <button onClick={() => setMateriaisAberto(v => !v)}
            className="w-full flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-white/[0.02] transition-colors">
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

      {podeEditar && (
        <div className="px-4 py-2.5 border-t border-border/40 flex items-center gap-2 bg-white/[0.01] flex-wrap">
          {!entregue && venda.status !== 'cancelado' && (
            <Select value={venda.status}
              onValueChange={v => { setLoadingStatus(true); onStatusChange(venda.id, v as StatusVenda) }}
              disabled={loadingStatus}>
              <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
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
              <RotateCcw className="h-3 w-3" />Desfazer entrega
            </Button>
          )}
          {venda.status === 'cancelado' && (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onStatusChange(venda.id, 'fabricando')}>
              Reabrir
            </Button>
          )}
          <div className="ml-auto flex gap-1">
            {!venda.estoque_descontado && (venda.status === 'pronto' || entregue) && (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-orange-400 border-orange-500/30 hover:bg-orange-500/10"
                onClick={() => onDescontarEstoque(venda)}>
                <Package className="h-3 w-3" />Descontar estoque
              </Button>
            )}
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

// ── Dialog de Pedido ──────────────────────────────────────────────────────────

function OrderDialog({
  open, onOpenChange, editando, faccoes, membros, onMembroCreated,
  meuFaccao, meuLoja, estoqueMap, onSave, saving,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; editando: Venda | null
  faccoes: Faccao[]; membros: Membro[]
  onMembroCreated: (m: Membro) => void
  meuFaccao: { id: string; nome: string } | null
  meuLoja: { id: string; nome: string } | null
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

  // Facção autocomplete
  const [faccaoNome, setFaccaoNome] = useState('')
  const [faccaoAberta, setFaccaoAberta] = useState(false)

  // Membro autocomplete
  const [membroNome, setMembroNome] = useState('')
  const [membroAberta, setMembroAberta] = useState(false)
  const [criandoMembro, setCriandoMembro] = useState(false)

  // Produto picker (3 painéis)
  type Workplace = { type: 'faccao' | 'loja'; id: string; nome: string }
  const workplaces = useMemo<Workplace[]>(() => {
    const list: Workplace[] = []
    if (meuFaccao) list.push({ type: 'faccao', id: meuFaccao.id, nome: meuFaccao.nome })
    if (meuLoja) list.push({ type: 'loja', id: meuLoja.id, nome: meuLoja.nome })
    return list
  }, [meuFaccao, meuLoja])

  const [selectedWorkplace, setSelectedWorkplace] = useState<Workplace | null>(null)
  const [workplaceItems, setWorkplaceItems] = useState<WorkplaceItem[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [buscaProd, setBuscaProd] = useState('')

  // Carrinho
  const [catalogoQtds, setCatalogoQtds] = useState<Record<string, number>>({})
  const [catalogoOrigem, setCatalogoOrigem] = useState<Record<string, 'fabricar' | 'estoque'>>({})
  const [catalogoPrecos, setCatalogoPrecos] = useState<Record<string, string>>({})

  // ── Inicializar ao abrir ───────────────────────────────────────────────────
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
          status: editando.status,
          itens: [],
        })
        setFaccaoNome(faccoes.find(f => f.id === editando.faccao_id)?.nome ?? '')
        setMembroNome(editando.cliente_nome)
        const qtds: Record<string, number> = {}
        const origem: Record<string, 'fabricar' | 'estoque'> = {}
        const precos: Record<string, string> = {}
        for (const it of editando.itens) {
          if (it.item_id) {
            qtds[it.item_id] = it.quantidade
            origem[it.item_id] = it.origem
            precos[it.item_id] = String(it.preco_unit)
          }
        }
        setCatalogoQtds(qtds)
        setCatalogoOrigem(origem)
        setCatalogoPrecos(precos)
      } else {
        setForm(emptyForm())
        setFaccaoNome('')
        setMembroNome('')
        setCatalogoQtds({})
        setCatalogoOrigem({})
        setCatalogoPrecos({})
      }
      setBuscaProd('')
      setFaccaoAberta(false)
      setMembroAberta(false)
      // Auto-selecionar primeiro local de trabalho
      if (workplaces.length > 0 && !selectedWorkplace) {
        setSelectedWorkplace(workplaces[0])
      }
    }
  }

  // ── Buscar produtos ao selecionar local ───────────────────────────────────
  useEffect(() => {
    if (!selectedWorkplace) { setWorkplaceItems([]); return }
    setLoadingItems(true)
    setBuscaProd('')
    if (selectedWorkplace.type === 'faccao') {
      sb().from('faccao_item_precos')
        .select('item_id, preco_limpo, preco_sujo, items(id, nome, tem_craft)')
        .eq('faccao_id', selectedWorkplace.id)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then(({ data }) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setWorkplaceItems((data ?? []).map((r: any) => ({
            item_id: r.item_id,
            nome: r.items?.nome ?? r.item_id,
            tem_craft: r.items?.tem_craft ?? false,
            preco_limpo: r.preco_limpo,
            preco_sujo: r.preco_sujo,
          })).sort((a: WorkplaceItem, b: WorkplaceItem) => a.nome.localeCompare(b.nome)))
          setLoadingItems(false)
        })
    } else {
      sb().from('loja_item_precos')
        .select('item_id, preco, preco_sujo, items(id, nome, tem_craft)')
        .eq('loja_id', selectedWorkplace.id)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then(({ data }) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setWorkplaceItems((data ?? []).map((r: any) => ({
            item_id: r.item_id,
            nome: r.items?.nome ?? r.item_id,
            tem_craft: r.items?.tem_craft ?? false,
            preco_limpo: r.preco ?? null,
            preco_sujo: r.preco_sujo ?? null,
          })).sort((a: WorkplaceItem, b: WorkplaceItem) => a.nome.localeCompare(b.nome)))
          setLoadingItems(false)
        })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWorkplace?.id, selectedWorkplace?.type])

  // ── Autocomplete facção ───────────────────────────────────────────────────
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

  // ── Autocomplete membro ───────────────────────────────────────────────────
  const membrosSugestoes = useMemo(() => {
    if (!membroAberta || !membroNome.trim()) return []
    const q = membroNome.toLowerCase()
    return membros.filter(m =>
      m.nome.toLowerCase().includes(q) || m.vulgo?.toLowerCase().includes(q)
    ).slice(0, 8)
  }, [membros, membroNome, membroAberta])

  function selecionarMembro(m: Membro) {
    setMembroNome(m.nome)
    setForm(prev => ({
      ...prev,
      cliente_nome: m.nome,
      cliente_telefone: m.telefone ?? prev.cliente_telefone,
    }))
    setMembroAberta(false)
  }

  async function handleCadastrarMembro() {
    const nome = membroNome.trim()
    if (!nome) return
    setCriandoMembro(true)
    const { data, error } = await sb().from('membros').insert({
      nome,
      telefone: form.cliente_telefone || null,
      faccao_id: form.faccao_id || null,
    }).select('id, nome, vulgo, telefone, faccao_id').single()
    setCriandoMembro(false)
    if (error) { toast.error('Erro ao cadastrar membro: ' + error.message); return }
    const novo = data as Membro
    onMembroCreated(novo)
    selecionarMembro(novo)
    toast.success(`Membro "${novo.nome}" cadastrado!`)
  }

  // ── Carrinho ──────────────────────────────────────────────────────────────
  function setQtd(item_id: string, qtd: number, item: WorkplaceItem) {
    if (qtd < 0) return
    setCatalogoQtds(prev => {
      if (qtd === 0) { const next = { ...prev }; delete next[item_id]; return next }
      return { ...prev, [item_id]: qtd }
    })
    if (qtd > 0) {
      if (!catalogoOrigem[item_id])
        setCatalogoOrigem(prev => ({ ...prev, [item_id]: item.tem_craft ? 'fabricar' : 'estoque' }))
      if (!catalogoPrecos[item_id]) {
        const p = form.tipo_dinheiro === 'sujo'
          ? (item.preco_sujo ?? item.preco_limpo ?? 0)
          : (item.preco_limpo ?? 0)
        setCatalogoPrecos(prev => ({ ...prev, [item_id]: String(p) }))
      }
    }
  }

  function removeDoCarrinho(item_id: string) {
    setCatalogoQtds(prev => { const n = { ...prev }; delete n[item_id]; return n })
    setCatalogoOrigem(prev => { const n = { ...prev }; delete n[item_id]; return n })
    setCatalogoPrecos(prev => { const n = { ...prev }; delete n[item_id]; return n })
  }

  function buildItens(): FormItem[] {
    return Object.entries(catalogoQtds)
      .filter(([, qty]) => qty > 0)
      .map(([item_id, qty]) => {
        const it = workplaceItems.find(w => w.item_id === item_id)
        const precoDefault = form.tipo_dinheiro === 'sujo'
          ? (it?.preco_sujo ?? it?.preco_limpo ?? 0)
          : (it?.preco_limpo ?? 0)
        return {
          tempId: item_id, item_id,
          item_nome: it?.nome ?? item_id,
          quantidade: String(qty),
          preco_unit: catalogoPrecos[item_id] ?? String(precoDefault),
          origem: catalogoOrigem[item_id] ?? (it?.tem_craft ? 'fabricar' : 'estoque'),
        }
      })
  }

  const carrinhoEntradas = Object.entries(catalogoQtds).filter(([, qty]) => qty > 0)
  const subtotal = carrinhoEntradas.reduce((s, [item_id, qty]) => {
    return s + qty * (parseFloat(catalogoPrecos[item_id] ?? '0') || 0)
  }, 0)
  const total = subtotal * (1 - (parseFloat(form.desconto_pct) || 0) / 100)

  const produtosFiltrados = useMemo(() => {
    if (!buscaProd.trim()) return workplaceItems
    const q = buscaProd.toLowerCase()
    return workplaceItems.filter(w => w.nome.toLowerCase().includes(q))
  }, [workplaceItems, buscaProd])

  const membroExiste = membroNome.trim() && membrosSugestoes.length === 0 && membroAberta

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-3xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">

        {/* Header */}
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

        {/* Body */}
        <div className="flex-1 flex flex-col min-h-0">

          {/* ── Cliente ─────────────────────────────────────────── */}
          <section className="px-5 py-3 shrink-0 border-b border-border/50 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Cliente</p>
            <div className="grid grid-cols-3 gap-3">

              {/* Facção (opcional) */}
              <div className="space-y-1.5 relative">
                <Label className="text-xs">Facção / Estabelecimento</Label>
                <Input value={faccaoNome}
                  onChange={e => { setFaccaoNome(e.target.value); setForm(prev => ({ ...prev, faccao_id: '' })); setFaccaoAberta(true) }}
                  onFocus={() => setFaccaoAberta(true)}
                  onBlur={() => setTimeout(() => setFaccaoAberta(false), 150)}
                  placeholder="Opcional..."
                  className="h-8 text-sm" />
                {faccaoNome && (
                  <button type="button" onClick={() => { setFaccaoNome(''); setForm(prev => ({ ...prev, faccao_id: '' })) }}
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

              {/* Nome / Membro */}
              <div className="space-y-1.5 relative">
                <Label className="text-xs">Nome / Membro <span className="text-destructive">*</span></Label>
                <Input value={membroNome}
                  onChange={e => { setMembroNome(e.target.value); setForm(prev => ({ ...prev, cliente_nome: e.target.value })); setMembroAberta(true) }}
                  onFocus={() => setMembroAberta(true)}
                  onBlur={() => setTimeout(() => setMembroAberta(false), 200)}
                  placeholder="Nome da pessoa..."
                  className="h-8 text-sm"
                  autoFocus />
                {membroAberta && (membrosSugestoes.length > 0 || membroExiste) && (
                  <div className="absolute top-full left-0 right-0 z-30 mt-1 rounded-md border border-border bg-popover shadow-md overflow-hidden">
                    {membrosSugestoes.map(m => (
                      <button key={m.id} type="button" onMouseDown={e => { e.preventDefault(); selecionarMembro(m) }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent text-left">
                        <span className="font-medium">{m.nome}</span>
                        {m.vulgo && <span className="text-muted-foreground">({m.vulgo})</span>}
                        {m.telefone && <span className="ml-auto text-muted-foreground tabular-nums">{m.telefone}</span>}
                      </button>
                    ))}
                    {membroExiste && (
                      <button type="button" onMouseDown={e => { e.preventDefault(); handleCadastrarMembro() }}
                        disabled={criandoMembro}
                        className="w-full flex items-center gap-1.5 px-3 py-2 text-xs hover:bg-accent text-left text-primary border-t border-border/50">
                        {criandoMembro ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                        Cadastrar &quot;{membroNome.trim()}&quot; como novo membro
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Telefone */}
              <div className="space-y-1.5">
                <Label className="text-xs">Telefone</Label>
                <Input value={form.cliente_telefone}
                  onChange={e => setForm(prev => ({ ...prev, cliente_telefone: e.target.value }))}
                  placeholder="(xx) xxxxx-xxxx"
                  className="h-8 text-sm" />
              </div>

              {/* Desconto */}
              <div className="space-y-1.5">
                <Label className="text-xs">Desconto (%)</Label>
                <Input type="number" min="0" max="100" value={form.desconto_pct}
                  onChange={e => setForm(prev => ({ ...prev, desconto_pct: e.target.value }))}
                  className="h-8 text-sm" />
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

          {/* ── Produtos (3 painéis) ──────────────────────────── */}
          <div className="flex-1 flex min-h-0 border-b border-border/50">

            {/* Painel esquerdo: locais de trabalho */}
            <div className="w-36 shrink-0 border-r border-border flex flex-col">
              <div className="px-3 py-2 border-b border-border shrink-0">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Produtos de</p>
              </div>
              <div className="flex-1 overflow-y-auto">
                {workplaces.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground text-center py-6 px-2 leading-relaxed">
                    Configure seu local de trabalho no perfil
                  </p>
                ) : workplaces.map(wp => (
                  <button key={wp.id} onClick={() => setSelectedWorkplace(wp)}
                    className={cn(
                      'w-full text-left px-3 py-3 text-xs border-b border-border/30 transition-colors flex items-start gap-2',
                      selectedWorkplace?.id === wp.id
                        ? 'bg-primary/10 text-foreground font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.02]'
                    )}>
                    {wp.type === 'faccao'
                      ? <Users className="h-3 w-3 mt-0.5 shrink-0" />
                      : <Store className="h-3 w-3 mt-0.5 shrink-0" />}
                    <span className="leading-tight">{wp.nome}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Painel central: produtos */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="px-3 py-2 border-b border-border shrink-0">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input placeholder="Filtrar produtos..." value={buscaProd}
                    onChange={e => setBuscaProd(e.target.value)}
                    className="h-7 text-xs pl-6" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {!selectedWorkplace ? (
                  <p className="text-xs text-muted-foreground text-center py-10 px-3">
                    Selecione um local ao lado
                  </p>
                ) : loadingItems ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : produtosFiltrados.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8 px-3">Nenhum produto cadastrado</p>
                ) : produtosFiltrados.map(item => {
                  const qty = catalogoQtds[item.item_id] ?? 0
                  const preco = form.tipo_dinheiro === 'sujo'
                    ? (item.preco_sujo ?? item.preco_limpo)
                    : item.preco_limpo
                  return (
                    <div key={item.item_id}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2.5 border-b border-border/30 transition-colors',
                        qty > 0 ? 'bg-primary/[0.05]' : 'hover:bg-white/[0.02]'
                      )}>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{item.nome}</p>
                        <p className="text-[10px] text-muted-foreground tabular-nums">
                          {preco != null ? fmt(preco) : '—'}
                        </p>
                      </div>
                      {qty > 0 && <span className="text-[10px] text-primary font-medium shrink-0">×{qty}</span>}
                      <button onClick={() => setQtd(item.item_id, qty + 1, item)}
                        className="shrink-0 h-6 w-6 rounded flex items-center justify-center hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Painel direito: carrinho */}
            <div className="w-52 shrink-0 border-l border-border flex flex-col">
              <div className="px-3 py-2.5 border-b border-border shrink-0">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Selecionados ({carrinhoEntradas.length})
                </p>
              </div>
              <div className="flex-1 overflow-y-auto">
                {carrinhoEntradas.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8 px-3">
                    Clique em + para adicionar
                  </p>
                ) : carrinhoEntradas.map(([item_id, qty]) => {
                  const item = workplaceItems.find(w => w.item_id === item_id)
                  const nome = item?.nome ?? item_id
                  const origemAtual = catalogoOrigem[item_id] ?? (item?.tem_craft ? 'fabricar' : 'estoque')
                  const estoqueDisp = estoqueMap[item_id]?.produto_final ?? 0
                  const preco = parseFloat(catalogoPrecos[item_id] ?? '0') || 0
                  return (
                    <div key={item_id} className="px-3 py-2.5 border-b border-border/30">
                      <div className="flex items-start gap-1 mb-1.5">
                        <p className="text-xs font-medium flex-1 truncate leading-tight">{nome}</p>
                        <button onClick={() => removeDoCarrinho(item_id)}
                          className="h-4 w-4 rounded flex items-center justify-center text-muted-foreground hover:text-red-400 transition-colors shrink-0">
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                      {preco > 0 && (
                        <p className="text-[10px] text-muted-foreground tabular-nums mb-1.5">
                          {qty} × {fmt(preco)} = {fmt(qty * preco)}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-0.5">
                          <button onClick={() => setQtd(item_id, qty - 1, item!)}
                            className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06]">
                            <Minus className="h-2.5 w-2.5" />
                          </button>
                          <span className="text-xs w-5 text-center tabular-nums font-medium">{qty}</span>
                          <button onClick={() => setQtd(item_id, qty + 1, item!)}
                            className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06]">
                            <Plus className="h-2.5 w-2.5" />
                          </button>
                        </div>
                        {/* Fab/Est toggle */}
                        <div className="flex rounded overflow-hidden border border-border h-5 flex-1">
                          <button onClick={() => setCatalogoOrigem(prev => ({ ...prev, [item_id]: 'fabricar' }))}
                            className={cn('flex-1 text-[9px] font-medium transition-colors',
                              origemAtual === 'fabricar' ? 'bg-blue-500/20 text-blue-400' : 'text-muted-foreground'
                            )}>
                            Fab
                          </button>
                          <button onClick={() => setCatalogoOrigem(prev => ({ ...prev, [item_id]: 'estoque' }))}
                            className={cn('flex-1 text-[9px] font-medium transition-colors border-l border-border',
                              origemAtual === 'estoque' ? 'bg-purple-500/20 text-purple-400' : 'text-muted-foreground'
                            )}>
                            Est
                          </button>
                        </div>
                      </div>
                      {origemAtual === 'estoque' && (
                        <p className={cn('text-[10px] mt-1', estoqueDisp >= qty ? 'text-green-400/70' : 'text-red-400/80')}>
                          estoque: {estoqueDisp}{estoqueDisp < qty ? ' ⚠' : ''}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
              {carrinhoEntradas.length > 0 && (
                <div className="p-3 border-t border-border shrink-0">
                  {parseFloat(form.desconto_pct) > 0 && (
                    <p className="text-[10px] text-muted-foreground tabular-nums mb-0.5">
                      Subtotal {fmt(subtotal)} · {form.desconto_pct}% desc
                    </p>
                  )}
                  <p className="text-sm font-bold text-primary tabular-nums">{fmt(total)}</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Observações ─────────────────────────────────────── */}
          <section className="px-5 py-3 shrink-0 space-y-1.5">
            <Label className="text-xs">Observações</Label>
            <textarea value={form.notas}
              onChange={e => setForm(prev => ({ ...prev, notas: e.target.value }))}
              rows={2} placeholder="Notas adicionais..."
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring resize-none" />
          </section>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-border shrink-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm"
            onClick={() => onSave({ ...form, itens: buildItens() })}
            disabled={saving || !form.cliente_nome.trim() || carrinhoEntradas.length === 0}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : editando ? 'Salvar' : 'Criar Pedido'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export function VendasClient({
  userId, userNome, vendas: vendasIniciais, faccoes, allItems,
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
    estoqueState.forEach(e => {
      if (!map[e.item_id]) map[e.item_id] = {}
      map[e.item_id][e.tipo] = e.quantidade
    })
    return map
  }, [estoqueState])

  const vendasFiltradas = useMemo(() => {
    if (filtro === 'todos') return vendas.filter(v => v.status !== 'entregue')
    if (filtro === 'entregue') return vendas.filter(v => v.status === 'entregue')
    return vendas.filter(v => v.status === filtro)
  }, [vendas, filtro])

  // ── Ações ──────────────────────────────────────────────────────────────────

  async function handleSave(form: FormState) {
    if (!form.cliente_nome.trim() || form.itens.length === 0) return
    setSaving(true)
    try {
      if (editando) {
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
          faccao_id: form.faccao_id || null,
          cliente_nome: form.cliente_nome.trim(),
          cliente_telefone: form.cliente_telefone || null,
          tipo_dinheiro: form.tipo_dinheiro,
          desconto_pct: parseFloat(form.desconto_pct) || 0,
          status: form.status,
          data_encomenda: form.data_encomenda || null,
          notas: form.notas || null,
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
      : v))
    toast.success('Entrega registrada!')
    if (!venda.estoque_descontado) await handleDescontarEstoque({ ...venda, status: 'entregue' })
  }

  async function handleDesfazerEntrega(id: string) {
    const { error } = await sb().from('vendas').update({
      status: 'pronto', entregue_por: null, entregue_por_nome: null, entregue_em: null,
    }).eq('id', id)
    if (error) { toast.error('Erro ao desfazer entrega'); return }
    setVendas(prev => prev.map(v => v.id === id
      ? { ...v, status: 'pronto', entregue_por: null, entregue_por_nome: null, entregue_em: null }
      : v))
    toast.success('Entrega desfeita — pedido voltou para Pronto')
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

  // ── Render ─────────────────────────────────────────────────────────────────

  const filtros = [
    { key: 'todos',    label: 'Ativos' },
    { key: 'encomenda', label: 'Encomendas' },
    { key: 'entregue', label: 'Concluídos' },
  ]

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 py-3 border-b border-border flex items-center gap-2 flex-wrap shrink-0">
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
              <VendaCard
                key={venda.id} venda={venda}
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
        membros={membrosState}
        onMembroCreated={m => setMembrosState(prev => [...prev, m].sort((a, b) => a.nome.localeCompare(b.nome)))}
        meuFaccao={meuFaccao}
        meuLoja={meuLoja}
        estoqueMap={estoqueMap}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  )
}

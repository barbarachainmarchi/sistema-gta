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
  Plus, X, Edit2, Truck, ChevronDown, ChevronUp,
  Package, Loader2, AlertTriangle, Check, RotateCcw, Search, ImageUp, Copy, Trash2, Layers,
} from 'lucide-react'
import { gerarImagemVenda } from '@/lib/gerarImagem'
import { uploadImgbb, getImgbbKey } from '@/lib/imgbb'

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
  cancelamento_solicitado: boolean | null; cancelamento_motivo: string | null
  cancelamento_solicitado_por: string | null
}
type Faccao = { id: string; nome: string; sigla: string | null; telefone: string | null; desconto_padrao_pct: number }
type Loja   = { id: string; nome: string }
type Membro = { id: string; nome: string; vulgo: string | null; telefone: string | null; faccao_id: string | null }
type ItemSimples = { id: string; nome: string; tem_craft: boolean; peso: number | null; categorias_item: { nome: string } | null }
type Receita = { item_id: string; ingrediente_id: string; quantidade: number }
type EstoqueEntry = { item_id: string; quantidade: number }

type Servico = { id: string; nome: string; descricao: string | null; preco_sujo: number | null; preco_limpo: number | null; desconto_pct: number }
type ServicoItemVenda = { servico_id: string; item_id: string; quantidade: number; item_nome: string; tem_craft: boolean }

type CartItem = {
  item_id: string; nome: string; quantidade: number
  preco_limpo: number | null; preco_sujo: number | null
  preco_override: number | null
  desconto_item_pct: number | null
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
  podeExcluirConcluida: boolean; ocultarConcluidosDias: number
  servicos: Servico[]; servicoItens: ServicoItemVenda[]
  favoritosIniciais: string[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: number) {
  const hasCents = v % 1 !== 0
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: hasCents ? 2 : 0, maximumFractionDigits: 2 })}`
}
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
  estoqueMap: Record<string, number>
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
    .map(([id, v]) => ({ id, ...v, disponivel: estoqueMap[id] ?? 0 }))
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

function VendaCard({ venda, faccoes, lojas, receitaMap, estoqueMap, itemMap, podeEditar, isOwner,
  onStatusChange, onEntregar, onDesfazerEntrega, onEdit, onSolicitarCancelamento, onDelete }: {
  venda: Venda
  faccoes: Faccao[]
  lojas: Loja[]
  receitaMap: Record<string, Receita[]>; estoqueMap: Record<string, number>; itemMap: Record<string, ItemSimples>
  podeEditar: boolean; isOwner: boolean
  onStatusChange: (id: string, s: StatusVenda) => void; onEntregar: (v: Venda) => void
  onDesfazerEntrega: (id: string) => void; onEdit: (v: Venda) => void
  onSolicitarCancelamento: (id: string, motivo: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [materiaisAberto, setMateriaisAberto] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [cancelamentoAberto, setCancelamentoAberto] = useState(false)
  const [motivoCancelamento, setMotivoCancelamento] = useState('')
  const [salvandoCanc, setSalvandoCanc] = useState(false)
  const [compartilhando, setCompartilhando] = useState(false)
  const [linkCopiado, setLinkCopiado] = useState(false)
  const [linkImagem, setLinkImagem] = useState<string | null>(null)

  async function handleCompartilhar() {
    setCompartilhando(true)
    try {
      const key = await getImgbbKey()
      if (!key) { toast.error('Chave imgbb não configurada — Admin > Layout'); return }
      const empresaNome = faccoes.find(f => f.id === venda.faccao_id)?.nome ?? lojas.find(l => l.id === venda.loja_id)?.nome ?? null
      const empresaTipo: 'faccao' | 'loja' | null = venda.faccao_id ? 'faccao' : venda.loja_id ? 'loja' : null
      const base64 = gerarImagemVenda({ clienteNome: venda.cliente_nome, empresaNome, empresaTipo, tipoDinheiro: venda.tipo_dinheiro, descontoPct: venda.desconto_pct, status: venda.status, dataEncomenda: venda.data_encomenda, notas: venda.notas, itens: venda.itens, entregue_por_nome: venda.entregue_por_nome })
      const url = await uploadImgbb(base64, key, `venda-${venda.cliente_nome}`)
      setLinkImagem(url)
      await navigator.clipboard.writeText(url)
      setLinkCopiado(true)
      setTimeout(() => setLinkCopiado(false), 3000)
      toast.success('Link copiado!')
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Erro ao gerar imagem') }
    finally { setCompartilhando(false) }
  }

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
          <div className="ml-auto flex items-center gap-1 flex-wrap justify-end">
            {!cancelamentoAberto && (
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                onClick={handleCompartilhar} disabled={compartilhando} title="Exportar para imgbb">
                {compartilhando ? <Loader2 className="h-3 w-3 animate-spin" /> : linkCopiado ? <Copy className="h-3 w-3 text-green-400" /> : <ImageUp className="h-3 w-3" />}
              </Button>
            )}
            {ativo && !cancelamentoAberto && (
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onEdit(venda)}>
                <Edit2 className="h-3 w-3" />
              </Button>
            )}
            {isOwner && venda.status === 'fabricando' && !cancelamentoAberto && (
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                title="Excluir pedido"
                onClick={() => onDelete(venda.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
            {isOwner && ativo && venda.status !== 'fabricando' && !venda.cancelamento_solicitado && !cancelamentoAberto && (
              <Button variant="ghost" size="sm" className="h-7 text-xs px-2 text-muted-foreground hover:text-orange-400"
                onClick={() => setCancelamentoAberto(true)}>
                <X className="h-3 w-3 mr-1" />Solicitar cancelamento
              </Button>
            )}
            {venda.cancelamento_solicitado && !cancelamentoAberto && (
              <span className="text-[10px] text-orange-400 font-medium px-1" title={venda.cancelamento_motivo ?? ''}>
                Canc. solicitado
              </span>
            )}
            {cancelamentoAberto && (
              <div className="flex items-center gap-1 w-full mt-1">
                <input
                  type="text" placeholder="Motivo do cancelamento..."
                  value={motivoCancelamento} onChange={e => setMotivoCancelamento(e.target.value)}
                  className="flex-1 h-7 text-xs rounded-md border border-input bg-background px-2 text-foreground min-w-0"
                />
                <Button size="sm" className="h-7 text-xs px-2.5 bg-orange-500/80 hover:bg-orange-500 text-white border-0"
                  disabled={salvandoCanc || !motivoCancelamento.trim()}
                  onClick={async () => {
                    setSalvandoCanc(true)
                    await onSolicitarCancelamento(venda.id, motivoCancelamento.trim())
                    setSalvandoCanc(false)
                    setCancelamentoAberto(false)
                    setMotivoCancelamento('')
                  }}>
                  {salvandoCanc ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Solicitar'}
                </Button>
                <button onClick={() => { setCancelamentoAberto(false); setMotivoCancelamento('') }}
                  className="text-xs text-muted-foreground hover:text-foreground px-1">✕</button>
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
  servicos, servicoItens, userId, favoritosIniciais,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; editando: Venda | null
  faccoes: Faccao[]; lojas: Loja[]; membros: Membro[]
  onMembroCreated: (m: Membro) => void
  meuFaccao: { id: string; nome: string } | null; meuLoja: { id: string; nome: string } | null
  estoqueMap: Record<string, number>
  receitas: Receita[]; allItems: ItemSimples[]
  onSave: (form: FormState) => void; saving: boolean
  servicos: Servico[]; servicoItens: ServicoItemVenda[]
  userId: string; favoritosIniciais: string[]
}) {
  const sbRef = useRef<ReturnType<typeof createClient> | null>(null)
  const sb = useCallback(() => { if (!sbRef.current) sbRef.current = createClient(); return sbRef.current }, [])

  const [favoritos, setFavoritos] = useState<Set<string>>(new Set(favoritosIniciais))
  const [filterCategoria, setFilterCategoria] = useState('')

  async function toggleFavorito(itemId: string) {
    const tinha = favoritos.has(itemId)
    setFavoritos(prev => { const n = new Set(prev); tinha ? n.delete(itemId) : n.add(itemId); return n })
    if (tinha) {
      await sb().from('usuario_favoritos').delete().eq('usuario_id', userId).eq('item_id', itemId)
    } else {
      await sb().from('usuario_favoritos').insert({ usuario_id: userId, item_id: itemId })
    }
  }

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
  const [faccaoDescontosItem, setFaccaoDescontosItem] = useState<Record<string, number>>({})
  const [draftOrigem, setDraftOrigem] = useState<Record<string, 'fabricar' | 'estoque'>>({})
  const [draftPreco, setDraftPreco] = useState<Record<string, number | null>>({})
  const [membroCivilParaVincular, setMembroCivilParaVincular] = useState<Membro | null>(null)
  const [vinculandoCivil, setVinculandoCivil] = useState(false)

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
          desconto_item_pct: null,
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
      setDraftOrigem({})
      setDraftPreco({})
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
      // Fetch per-item discounts for this facção
      sb().from('faccao_desconto_por_item').select('item_id, desconto_pct').eq('faccao_id', e.id)
        .then(({ data }) => {
          const map: Record<string, number> = {}
          for (const row of (data ?? [])) map[row.item_id] = row.desconto_pct
          setFaccaoDescontosItem(map)
          // Update existing cart items with per-item discounts
          setCart(prev => prev.map(c => ({ ...c, desconto_item_pct: map[c.item_id] ?? null })))
        })
    } else {
      setForm(prev => ({ ...prev, faccao_id: '', loja_id: e.id }))
      setFaccaoDescontosItem({})
      setCart(prev => prev.map(c => ({ ...c, desconto_item_pct: null })))
    }
    setEmpresaNome(e.nome)
    setEmpresaAberta(false)
  }

  // Membro autocomplete
  const membrosSugestoes = useMemo(() => {
    if (!membroAberta || !membroNome.trim()) return []
    const q = membroNome.toLowerCase()
    // Com facção: mostra membros da facção + membros sem facção (civil)
    const pool = form.faccao_id
      ? membros.filter(m => m.faccao_id === form.faccao_id || m.faccao_id === null)
      : membros
    return pool.filter(m => m.nome.toLowerCase().includes(q) || m.vulgo?.toLowerCase().includes(q)).slice(0, 8)
  }, [membros, membroNome, membroAberta, form.faccao_id])

  function selecionarMembro(m: Membro) {
    setMembroNome(m.nome)
    setForm(prev => ({ ...prev, cliente_nome: m.nome, cliente_telefone: m.telefone ?? prev.cliente_telefone }))
    setMembroAberta(false)
    // Se membro civil e há facção selecionada, perguntar se pertence
    if (m.faccao_id === null && form.faccao_id) {
      setMembroCivilParaVincular(m)
    }
  }

  async function handleVincularCivil() {
    if (!membroCivilParaVincular || !form.faccao_id) return
    setVinculandoCivil(true)
    const { error } = await sb().from('membros').update({ faccao_id: form.faccao_id }).eq('id', membroCivilParaVincular.id)
    setVinculandoCivil(false)
    if (error) { toast.error(error.message); return }
    onMembroCreated({ ...membroCivilParaVincular, faccao_id: form.faccao_id })
    toast.success('Membro vinculado à facção!')
    setMembroCivilParaVincular(null)
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
      const p = meusProdutos.find(p => p.item_id === item_id)
      if (!p) return prev
      const origemDraft = draftOrigem[item_id]
      const precoDraft = draftPreco[item_id]
      return [...prev, {
        item_id: p.item_id, nome: p.nome, quantidade: qtd,
        preco_limpo: p.preco_limpo, preco_sujo: p.preco_sujo,
        preco_override: precoDraft != null ? precoDraft : null,
        desconto_item_pct: faccaoDescontosItem[p.item_id] ?? null,
        tem_craft: p.tem_craft,
        origem: origemDraft ?? (p.tem_craft ? 'fabricar' : 'estoque'),
      }]
    })
  }

  function setCartPreco(item_id: string, preco: number | null) {
    setCart(prev => prev.map(c => c.item_id === item_id ? { ...c, preco_override: preco } : c))
  }

  function setCartOrigem(item_id: string, origem: 'fabricar' | 'estoque') {
    setCart(prev => prev.map(c => c.item_id === item_id ? { ...c, origem } : c))
  }

  function addServicoToCart(servico: Servico) {
    const itensDoServico = servicoItens.filter(si => si.servico_id === servico.id)
    if (itensDoServico.length === 0) { toast.info('Serviço sem itens configurados'); return }
    setCart(prev => {
      let next = [...prev]
      for (const si of itensDoServico) {
        const exists = next.find(c => c.item_id === si.item_id)
        if (exists) {
          next = next.map(c => c.item_id === si.item_id ? { ...c, quantidade: c.quantidade + si.quantidade } : c)
        } else {
          const prod = meusProdutos.find(p => p.item_id === si.item_id)
          next.push({
            item_id: si.item_id,
            nome: si.item_nome,
            quantidade: si.quantidade,
            preco_limpo: prod?.preco_limpo ?? 0,
            preco_sujo: prod?.preco_sujo ?? 0,
            preco_override: null,
            desconto_item_pct: servico.desconto_pct > 0 ? servico.desconto_pct : (faccaoDescontosItem[si.item_id] ?? null),
            tem_craft: si.tem_craft,
            origem: si.tem_craft ? 'fabricar' : 'estoque',
          })
        }
      }
      return next
    })
    toast.success(`${itensDoServico.length} iten${itensDoServico.length !== 1 ? 's' : ''} do combo "${servico.nome}" adicionados`)
  }

  // Mapa item_id → categoria (via allItems)
  const itemCatMap = useMemo(() => {
    const m: Record<string, string> = {}
    allItems.forEach(i => { if (i.categorias_item?.nome) m[i.id] = i.categorias_item.nome })
    return m
  }, [allItems])

  // Categorias disponíveis nos produtos do local de trabalho
  const categoriasDisponiveis = useMemo(() => {
    const cats = new Set<string>()
    meusProdutos.forEach(p => { const c = itemCatMap[p.item_id]; if (c) cats.add(c) })
    return Array.from(cats).sort()
  }, [meusProdutos, itemCatMap])

  // Produtos filtrados (search + categoria), favoritos primeiro
  const produtosFiltrados = useMemo(() => {
    let lista = meusProdutos
    if (filterCategoria) lista = lista.filter(p => itemCatMap[p.item_id] === filterCategoria)
    if (buscaProd.trim()) {
      const q = buscaProd.toLowerCase()
      lista = lista.filter(p => p.nome.toLowerCase().includes(q))
    }
    return [...lista].sort((a, b) => {
      const af = favoritos.has(a.item_id) ? 0 : 1
      const bf = favoritos.has(b.item_id) ? 0 : 1
      if (af !== bf) return af - bf
      return a.nome.localeCompare(b.nome)
    })
  }, [meusProdutos, buscaProd, filterCategoria, itemCatMap, favoritos])

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
      .map(([id, v]) => ({ id, ...v, disponivel: estoqueMap[id] ?? 0 }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [cart, receitas, allItems, estoqueMap])

  // Totals
  const subtotal = cart.reduce((s, c) => s + c.quantidade * getPrecoEfetivo(c), 0)
  const total = cart.reduce((s, c) => {
    const d = c.desconto_item_pct ?? descontoPct
    return s + c.quantidade * getPrecoEfetivo(c) * (1 - d / 100)
  }, 0)
  const descValor = subtotal - total

  function buildItens(): FormItem[] {
    return cart.map(c => ({
      tempId: c.item_id, item_id: c.item_id, item_nome: c.nome,
      quantidade: String(c.quantidade),
      preco_unit: String(c.preco_override ?? (form.tipo_dinheiro === 'sujo' ? (c.preco_sujo ?? c.preco_limpo ?? 0) : (c.preco_limpo ?? 0))),
      origem: c.origem,
    }))
  }

  return (
    <>
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
                  placeholder={form.faccao_id ? 'Nome ou vulgo (facção)...' : form.loja_id ? 'Nome ou vulgo...' : 'Nome ou vulgo...'}
                  className="h-8 text-sm" />
                {membroAberta && (membrosSugestoes.length > 0 || membroNaoEncontrado) && (
                  <div className="absolute top-full left-0 right-0 z-30 mt-1 rounded-md border border-border bg-popover shadow-md overflow-hidden">
                    {membrosSugestoes.map(m => (
                      <button key={m.id} type="button" onMouseDown={e => { e.preventDefault(); selecionarMembro(m) }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent text-left">
                        <span className="font-medium">{m.nome}</span>
                        {m.vulgo && <span className="text-muted-foreground">({m.vulgo})</span>}
                        {m.faccao_id === null && <span className="text-[10px] text-muted-foreground/50 italic">civil</span>}
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

            {/* Search + filtros */}
            <div className="px-3 py-2 shrink-0 border-b border-border space-y-1.5">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Filtrar produtos e combos..." value={buscaProd}
                  onChange={e => setBuscaProd(e.target.value)}
                  className="h-8 text-xs pl-7" />
              </div>
              {categoriasDisponiveis.length > 0 && (
                <Select value={filterCategoria || '_todas'} onValueChange={v => setFilterCategoria(v === '_todas' ? '' : v)}>
                  <SelectTrigger className="h-7 text-xs border-border/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_todas">Todas as categorias</SelectItem>
                    {categoriasDisponiveis.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Serviços / Combos */}
            {servicos.length > 0 && (() => {
              const q = buscaProd.toLowerCase()
              const servicosFiltrados = buscaProd.trim()
                ? servicos.filter(s => s.nome.toLowerCase().includes(q) || s.descricao?.toLowerCase().includes(q))
                : servicos
              if (servicosFiltrados.length === 0) return null
              return (
                <div className="shrink-0 border-b border-border bg-white/[0.01]">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <Layers className="h-3 w-3" />Combos / Serviços
                  </div>
                  <div className="flex flex-wrap gap-1.5 px-3 pb-2">
                    {servicosFiltrados.map(s => {
                      const itensCount = servicoItens.filter(si => si.servico_id === s.id).length
                      const preco = form.tipo_dinheiro === 'sujo' ? (s.preco_sujo ?? s.preco_limpo) : s.preco_limpo
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => addServicoToCart(s)}
                          title={s.descricao ?? s.nome}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border bg-background hover:bg-accent hover:border-primary/40 transition-colors text-left max-w-[200px]"
                        >
                          <Layers className="h-3 w-3 text-primary/70 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate leading-tight">{s.nome}</p>
                            <p className="text-[10px] text-muted-foreground leading-tight">
                              {itensCount} item{itensCount !== 1 ? 's' : ''}
                              {s.desconto_pct > 0 && <span className="text-green-400 ml-1">-{s.desconto_pct}%</span>}
                              {preco != null && <span className="ml-1 tabular-nums">· R${preco.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

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
                const estoqueDisp = estoqueMap[p.item_id] ?? 0
                const qtd = c?.quantidade ?? 0
                const efetivoPct = c?.desconto_item_pct ?? descontoPct
                const subtotalItem = qtd * precoEfetivo * (1 - efetivoPct / 100)

                return (
                  <div key={p.item_id}
                    className={cn('grid grid-cols-[1fr_56px_68px_80px_72px_32px] gap-x-2 items-center px-3 py-2 transition-colors',
                      inCart ? 'bg-primary/[0.04]' : 'hover:bg-white/[0.02]'
                    )}>
                    {/* Nome + badges */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <button onClick={() => toggleFavorito(p.item_id)}
                        className={cn('shrink-0 p-0.5 rounded transition-colors',
                          favoritos.has(p.item_id) ? 'text-yellow-400' : 'text-muted-foreground/30 hover:text-yellow-400'
                        )}>
                        <svg className="h-3 w-3" fill={favoritos.has(p.item_id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      </button>
                      {(() => {
                        const currentOrigem = inCart ? c?.origem : (draftOrigem[p.item_id] ?? (p.tem_craft ? 'fabricar' : 'estoque'))
                        return (
                          <div className="flex gap-0.5 shrink-0">
                            <button onClick={() => inCart ? setCartOrigem(p.item_id, 'fabricar') : setDraftOrigem(prev => ({ ...prev, [p.item_id]: 'fabricar' }))}
                              className={cn('text-[9px] font-bold px-1 py-0.5 rounded transition-colors',
                                currentOrigem === 'fabricar' ? 'bg-blue-500/20 text-blue-400' : 'bg-transparent text-muted-foreground/40 hover:text-foreground'
                              )}>Fab</button>
                            <button onClick={() => inCart ? setCartOrigem(p.item_id, 'estoque') : setDraftOrigem(prev => ({ ...prev, [p.item_id]: 'estoque' }))}
                              className={cn('text-[9px] font-bold px-1 py-0.5 rounded transition-colors',
                                currentOrigem === 'estoque' ? 'bg-purple-500/20 text-purple-400' : 'bg-transparent text-muted-foreground/40 hover:text-foreground'
                              )}>Est</button>
                          </div>
                        )
                      })()}
                      <span className={cn('text-xs font-medium truncate', inCart ? 'text-foreground' : 'text-muted-foreground')}>{p.nome}</span>
                      {faccaoDescontosItem[p.item_id] != null && (
                        <span className="shrink-0 text-[9px] font-bold px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                          -{faccaoDescontosItem[p.item_id]}%
                        </span>
                      )}
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

                    {/* Preço unit (sempre editável) */}
                    <div className="flex justify-end">
                      <Input
                        type="number" min="0" step="0.01"
                        value={inCart
                          ? (c.preco_override != null ? c.preco_override : (precoBase ?? 0))
                          : (draftPreco[p.item_id] != null ? draftPreco[p.item_id]! : (precoBase ?? 0))}
                        onChange={e => {
                          const v = parseFloat(e.target.value)
                          if (inCart) {
                            setCartPreco(p.item_id, isNaN(v) ? null : v)
                          } else {
                            setDraftPreco(prev => ({ ...prev, [p.item_id]: isNaN(v) ? null : v }))
                          }
                        }}
                        className={cn('h-7 text-xs text-right w-full tabular-nums',
                          inCart && 'border-primary/40 bg-primary/[0.04]'
                        )} />
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
              {cart.length > 0 && (
                <div className="space-y-1 border-b border-border/30 pb-2">
                  {cart.map(c => {
                    const preco = getPrecoEfetivo(c)
                    const subtotalItem = c.quantidade * preco  // sem desconto
                    return (
                      <div key={c.item_id} className="flex justify-between gap-1 leading-tight">
                        <span className="text-[11px] text-muted-foreground truncate min-w-0">{c.nome}</span>
                        <span className="text-[11px] tabular-nums shrink-0 text-muted-foreground/70 whitespace-nowrap">
                          {c.quantidade}×{fmt(preco)} = <span className="text-foreground font-medium">{fmt(subtotalItem)}</span>
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Itens</span>
                  <span className="tabular-nums">{cart.length}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{fmt(subtotal)}</span>
                </div>
                {descValor > 0 && (
                  <div className="flex justify-between text-xs text-green-400">
                    <span>Desconto{Object.keys(faccaoDescontosItem).length === 0 && descontoPct > 0 ? ` (${descontoPct}%)` : ''}</span>
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

    {/* Dialog: membro civil → vincular à facção */}
    {membroCivilParaVincular && (
      <Dialog open onOpenChange={() => setMembroCivilParaVincular(null)}>
        <DialogContent className="max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Vincular à facção?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{membroCivilParaVincular.nome}</span> não tem facção registrada.
            Pertence à facção selecionada nesta venda?
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setMembroCivilParaVincular(null)}>Não, manter civil</Button>
            <Button size="sm" onClick={handleVincularCivil} disabled={vinculandoCivil}>
              {vinculandoCivil ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Sim, vincular'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )}
    </>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export function VendasClient({
  userId, userNome, vendas: vendasIniciais, faccoes, lojas, allItems,
  receitas, estoque: estoqueInicial, membros: membrosIniciais,
  meuFaccao, meuLoja, filtroInicial, podeEditar, ocultarConcluidosDias,
  servicos, servicoItens, favoritosIniciais,
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
  const [mostrarTodosConcluidos, setMostrarTodosConcluidos] = useState(false)

  const itemMap = useMemo(() => Object.fromEntries(allItems.map(i => [i.id, i])), [allItems])
  const receitaMap = useMemo(() => {
    const map: Record<string, Receita[]> = {}
    receitas.forEach(r => { if (!map[r.item_id]) map[r.item_id] = []; map[r.item_id].push(r) })
    return map
  }, [receitas])
  const estoqueMap = useMemo(() => {
    const map: Record<string, number> = {}
    estoqueState.forEach(e => { map[e.item_id] = e.quantidade })
    return map
  }, [estoqueState])

  const vendasFiltradas = useMemo(() => {
    if (filtro === 'todos') return vendas.filter(v => v.status !== 'entregue' && v.status !== 'cancelado')
    if (filtro === 'entregue') {
      const entregues = vendas.filter(v => v.status === 'entregue')
      if (mostrarTodosConcluidos || ocultarConcluidosDias <= 0) return entregues
      const limite = new Date(Date.now() - ocultarConcluidosDias * 86400000).toISOString()
      return entregues.filter(v => (v.entregue_em ?? v.created_at) >= limite)
    }
    return vendas.filter(v => v.status === filtro)
  }, [vendas, filtro, mostrarTodosConcluidos, ocultarConcluidosDias])

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

    // Idempotência: não criar duplicata se já existe lançamento para esta venda
    const { data: jaExiste } = await sb().from('financeiro_lancamentos')
      .select('id').eq('venda_id', venda.id).maybeSingle()
    if (jaExiste) return

    // Banco = conta do entregador (pessoa que recebeu o dinheiro)
    let contaId: string | null = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: usuRow } = await sb().from('usuarios').select('membro_id').eq('id', userId).maybeSingle() as any
    const membroId: string | null = usuRow?.membro_id ?? null
    if (membroId) {
      const { data: contaExistente } = await sb().from('financeiro_contas')
        .select('id').eq('membro_id', membroId).eq('status', 'ativo').maybeSingle()
      if (contaExistente) {
        contaId = (contaExistente as { id: string }).id
      } else if (userNome) {
        const { data: novaConta } = await sb().from('financeiro_contas').insert({
          nome: userNome, tipo: 'membro', membro_id: membroId,
          saldo_sujo: 0, saldo_limpo: 0, status: 'ativo',
        }).select('id').single()
        if (novaConta) contaId = (novaConta as { id: string }).id
      }
    }

    const itensDesc = venda.itens.map(it => `${it.item_nome} (${it.quantidade})`).join(' · ')
    const { error } = await sb().from('financeiro_lancamentos').insert({
      conta_id: contaId,
      venda_id: venda.id,
      tipo: 'venda',
      tipo_dinheiro: venda.tipo_dinheiro,
      valor: totalVenda,
      descricao: `Venda: ${venda.cliente_nome}`,
      item_descricao: itensDesc || null,
      categoria: 'venda',
      data: new Date().toISOString().split('T')[0],
      vai_para_faccao: !!venda.faccao_id,
      origem: 'venda',
      created_by: userId,
      responsavel_nome: userNome,
    })
    if (error) { toast.error('Erro ao registrar no financeiro: ' + error.message); return }
  }

  async function removerLancamentosVenda(vendaId: string) {
    // Trigger financeiro_atualizar_saldo reverte o saldo automaticamente no DELETE
    const { data: lancs } = await sb().from('financeiro_lancamentos')
      .select('id').eq('venda_id', vendaId)
    if (!lancs || lancs.length === 0) return
    for (const lanc of lancs as { id: string }[]) {
      await sb().from('financeiro_lancamentos').delete().eq('id', lanc.id)
    }
  }

  async function handleDeletarVendaAtiva(id: string) {
    // Só permitido quando status ainda é 'fabricando' (inicial, sem mudança)
    const venda = vendas.find(v => v.id === id)
    if (!venda || venda.status !== 'fabricando') return
    const { error } = await sb().from('vendas').delete().eq('id', id)
    if (error) { toast.error('Erro ao excluir'); return }
    setVendas(prev => prev.filter(v => v.id !== id))
    toast.success('Pedido excluído')
  }

  async function handleSolicitarCancelamento(id: string, motivo: string) {
    const venda = vendas.find(v => v.id === id)
    const { error } = await sb().from('vendas').update({
      cancelamento_solicitado: true,
      cancelamento_motivo: motivo,
      cancelamento_solicitado_por: userId,
      cancelamento_solicitado_em: new Date().toISOString(),
    }).eq('id', id)
    if (error) { toast.error('Erro ao solicitar cancelamento'); return }
    // Cria registro em sistema_solicitacoes para aparecer em Admin > Logs
    await sb().from('sistema_solicitacoes').insert({
      tipo: 'cancelamento_venda',
      referencia_id: id,
      referencia_tipo: 'venda',
      descricao: `Cancelamento: ${venda?.cliente_nome ?? 'Venda'} (${venda?.status ?? ''})`,
      solicitante_id: userId,
      solicitante_nome: userNome,
      dados: { cliente_nome: venda?.cliente_nome, status_atual: venda?.status, motivo },
    })
    setVendas(prev => prev.map(v => v.id === id ? {
      ...v, cancelamento_solicitado: true, cancelamento_motivo: motivo,
      cancelamento_solicitado_por: userId,
    } : v))
    toast.success('Cancelamento solicitado!')
  }

  async function handleDesfazerEntrega(id: string) {
    const { error } = await sb().from('vendas').update({
      status: 'pronto', entregue_por: null, entregue_por_nome: null, entregue_em: null,
    }).eq('id', id)
    if (error) { toast.error('Erro ao desfazer entrega'); return }
    // Remover lançamento financeiro e reverter saldo — nova entrega vai recriar corretamente
    await removerLancamentosVenda(id)
    setVendas(prev => prev.map(v => v.id === id
      ? { ...v, status: 'pronto', entregue_por: null, entregue_por_nome: null, entregue_em: null } : v))
    toast.success('Entrega desfeita — voltou para Pronto')
  }

  async function handleDescontarEstoque(venda: Venda) {
    if (venda.estoque_descontado) { toast.info('Estoque já foi descontado'); return }

    const saidas: Record<string, number> = {}
    for (const it of venda.itens) {
      if (!it.item_id) continue
      if (it.origem === 'estoque') {
        saidas[it.item_id] = (saidas[it.item_id] ?? 0) + it.quantidade
      } else {
        for (const r of receitaMap[it.item_id] ?? []) {
          saidas[r.ingrediente_id] = (saidas[r.ingrediente_id] ?? 0) + r.quantidade * it.quantidade
        }
      }
    }

    const motivo = `Venda: ${venda.cliente_nome}`
    for (const [item_id, quantidade] of Object.entries(saidas)) {
      await sb().from('estoque_movimentos').insert({
        item_id, tipo: 'saida', quantidade,
        motivo, usuario_id: userId, usuario_nome: userNome ?? '',
        referencia: venda.id,
      })
    }

    await sb().from('vendas').update({ estoque_descontado: true }).eq('id', venda.id)
    setVendas(prev => prev.map(v => v.id === venda.id ? { ...v, estoque_descontado: true } : v))
    toast.success('Estoque descontado!')
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tabs: Ativos | Encomendas | Concluídos */}
      <div className="px-6 pt-3 border-b border-border shrink-0">
        <div className="flex gap-0 -mb-px items-end">
          {([
            ['todos',     'Ativos'],
            ['encomenda', 'Encomendas'],
            ['entregue',  'Concluídos'],
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
          {podeEditar && (
            <Button size="sm" className="h-8 text-xs gap-1 ml-auto mb-1" onClick={() => { setEditando(null); setFormOpen(true) }}>
              <Plus className="h-3.5 w-3.5" />Novo Pedido
            </Button>
          )}
        </div>
      </div>

      {(
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
            <>
              {filtro === 'entregue' && ocultarConcluidosDias > 0 && (
                <div className="flex items-center justify-between mb-4 text-xs text-muted-foreground">
                  <span>
                    {mostrarTodosConcluidos ? 'Mostrando todos' : `Mostrando últimos ${ocultarConcluidosDias} dias`}
                    {' '}({vendasFiltradas.length})
                  </span>
                  <button onClick={() => setMostrarTodosConcluidos(v => !v)}
                    className="text-primary hover:underline">
                    {mostrarTodosConcluidos ? 'Esconder antigos' : 'Mostrar todos'}
                  </button>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-start">
                {vendasFiltradas.map(venda => (
                  <VendaCard key={venda.id} venda={venda}
                    faccoes={faccoes}
                    lojas={lojas}
                    receitaMap={receitaMap} estoqueMap={estoqueMap} itemMap={itemMap}
                    podeEditar={podeEditar} isOwner={venda.criado_por === userId}
                    onStatusChange={handleStatusChange}
                    onEntregar={handleEntregar}
                    onDesfazerEntrega={handleDesfazerEntrega}
                    onEdit={v => { setEditando(v); setFormOpen(true) }}
                    onSolicitarCancelamento={handleSolicitarCancelamento}
                    onDelete={handleDeletarVendaAtiva}
                  />
                ))}
              </div>
            </>
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
        servicos={servicos}
        servicoItens={servicoItens}
        userId={userId}
        favoritosIniciais={favoritosIniciais}
      />
    </div>
  )
}

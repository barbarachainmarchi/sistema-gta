'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Search, Plus, Minus, RefreshCw, Package, Settings, ArrowUpCircle, ArrowDownCircle, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Item = {
  id: string
  nome: string
  peso: number | null
  categorias_item: { nome: string } | null
}

type Controlado = { item_id: string; created_at: string }

type Atualizacao = {
  id: string
  item_id: string
  quantidade: number
  criado_por: string | null
  criado_por_nome: string
  nota: string | null
  created_at: string
}

type Movimento = {
  id: string
  item_id: string
  tipo: 'entrada' | 'saida'
  quantidade: number
  motivo: string | null
  usuario_nome: string
  created_at: string
}

type VendaItem = {
  venda_id: string
  item_id: string
  quantidade: number
  entregue_em: string
}

type MetaItem = {
  membro_meta_id: string
  item_nome: string
  quantidade_meta: number
  quantidade_entregue: number
}

interface Props {
  userId: string
  usuarioNome: string
  podeEditar: boolean
  itens: Item[]
  controlados: Controlado[]
  atualizacoes: Atualizacao[]
  movimentos: Movimento[]
  vendaItens: VendaItem[]
  metasItens: MetaItem[]
  membroMetaToMetaCreatedAt: Record<string, string>
}

type Aba = 'saldos' | 'configurar'
type DialogTipo = 'atualizar' | 'entrada' | 'saida' | null

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function fmtDataCurta(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

// ── Cálculo de saldo por item ─────────────────────────────────────────────────

interface SaldoCalc {
  ultimaAtualizacao: Atualizacao | null
  base: number
  entradas: number
  saidas: number
  vendas: number
  saldo: number | null
  metasPendentes: number
}

function calcSaldo(
  itemId: string,
  itemNome: string,
  atualizacoes: Atualizacao[],
  movimentos: Movimento[],
  vendaItens: VendaItem[],
  metasItens: MetaItem[],
  membroMetaToMetaCreatedAt: Record<string, string>,
): SaldoCalc {
  const minhas = atualizacoes.filter(a => a.item_id === itemId)
  const ultima = minhas[0] ?? null // já vem ordenado desc

  if (!ultima) {
    return { ultimaAtualizacao: null, base: 0, entradas: 0, saidas: 0, vendas: 0, saldo: null, metasPendentes: 0 }
  }

  const updateDate = new Date(ultima.created_at)

  const movsSince = movimentos.filter(m => m.item_id === itemId && new Date(m.created_at) > updateDate)
  const entradas = movsSince.filter(m => m.tipo === 'entrada').reduce((s, m) => s + m.quantidade, 0)
  const saidas = movsSince.filter(m => m.tipo === 'saida').reduce((s, m) => s + m.quantidade, 0)
  const vendas = vendaItens
    .filter(v => v.item_id === itemId && new Date(v.entregue_em) > updateDate)
    .reduce((s, v) => s + v.quantidade, 0)

  const saldo = ultima.quantidade + entradas - saidas - vendas

  // Metas ativas criadas APÓS a última atualização
  const nomeNorm = itemNome.toLowerCase()
  const metasPendentes = metasItens
    .filter(mi => {
      if (mi.item_nome.toLowerCase() !== nomeNorm) return false
      const metaCreatedAt = membroMetaToMetaCreatedAt[mi.membro_meta_id]
      if (!metaCreatedAt) return false
      return new Date(metaCreatedAt) > updateDate
    })
    .reduce((s, mi) => s + Math.max(0, mi.quantidade_meta - mi.quantidade_entregue), 0)

  return { ultimaAtualizacao: ultima, base: ultima.quantidade, entradas, saidas, vendas, saldo, metasPendentes }
}

// ── Modal de ação ─────────────────────────────────────────────────────────────

function ActionDialog({ tipo, itemNome, onClose, onConfirm }: {
  tipo: DialogTipo
  itemNome: string
  onClose: () => void
  onConfirm: (valor: number, texto: string) => Promise<void>
}) {
  const [valor, setValor] = useState('')
  const [texto, setTexto] = useState('')
  const [loading, setLoading] = useState(false)

  if (!tipo) return null

  const labels = {
    atualizar: { title: 'Atualizar Saldo', label: 'Quantidade atual em estoque', btn: 'Salvar' },
    entrada:   { title: 'Registrar Entrada', label: 'Quantidade que entrou', btn: 'Registrar' },
    saida:     { title: 'Registrar Saída', label: 'Quantidade que saiu', btn: 'Registrar' },
  }

  async function handleSubmit() {
    const n = parseFloat(valor)
    if (isNaN(n) || n < 0) { toast.error('Quantidade inválida'); return }
    if (tipo !== 'atualizar' && n <= 0) { toast.error('Quantidade deve ser maior que zero'); return }
    setLoading(true)
    await onConfirm(n, texto)
    setLoading(false)
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">{labels[tipo].title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">{itemNome}</p>
        <div className="space-y-3 mt-1">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{labels[tipo].label}</label>
            <Input
              type="number"
              min="0"
              value={valor}
              onChange={e => setValor(e.target.value)}
              placeholder="0"
              autoFocus
              className="h-9"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              {tipo === 'atualizar' ? 'Nota (opcional)' : 'Motivo (opcional)'}
            </label>
            <Input
              value={texto}
              onChange={e => setTexto(e.target.value)}
              placeholder={tipo === 'atualizar' ? 'Ex: contagem física' : tipo === 'entrada' ? 'Ex: compra, produção...' : 'Ex: uso, perda...'}
              className="h-9"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={onClose}
              className="flex-1 h-9 rounded-md border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">
              Cancelar
            </button>
            <button onClick={handleSubmit} disabled={loading}
              className={cn(
                'flex-1 h-9 rounded-md text-sm font-medium transition-colors',
                tipo === 'saida'
                  ? 'bg-destructive/80 hover:bg-destructive text-destructive-foreground'
                  : tipo === 'entrada'
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-primary hover:bg-primary/80 text-primary-foreground',
                loading && 'opacity-50 cursor-not-allowed'
              )}>
              {loading ? '...' : labels[tipo].btn}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Card de item no saldos ────────────────────────────────────────────────────

function ItemSaldoCard({ item, calc, podeEditar, onAction }: {
  item: Item
  calc: SaldoCalc
  podeEditar: boolean
  onAction: (tipo: DialogTipo) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const temDetalhe = calc.ultimaAtualizacao != null

  const saldoColor = calc.saldo == null
    ? 'text-muted-foreground'
    : calc.saldo <= 0
    ? 'text-red-400'
    : calc.saldo <= 5
    ? 'text-orange-400'
    : 'text-foreground'

  return (
    <div className="border-b border-border/40 last:border-0">
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Nome + toggle */}
        <button
          onClick={() => temDetalhe && setExpanded(e => !e)}
          disabled={!temDetalhe}
          className="flex items-center gap-1.5 flex-1 min-w-0 text-left">
          {temDetalhe
            ? (expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />)
            : <span className="w-3.5" />
          }
          <div className="min-w-0">
            <span className="text-sm font-medium truncate block">{item.nome}</span>
            {item.categorias_item?.nome && (
              <span className="text-[10px] text-muted-foreground">{item.categorias_item.nome}</span>
            )}
          </div>
        </button>

        {/* Saldo + metas */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <div className={cn('text-lg font-bold tabular-nums leading-tight', saldoColor)}>
              {calc.saldo == null ? '—' : calc.saldo}
            </div>
            {calc.ultimaAtualizacao && (
              <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                {fmtDataCurta(calc.ultimaAtualizacao.created_at)} · {calc.ultimaAtualizacao.criado_por_nome}
              </div>
            )}
          </div>
          {calc.metasPendentes > 0 && (
            <div className="text-right">
              <div className="text-sm font-semibold tabular-nums text-amber-400">{calc.metasPendentes}</div>
              <div className="text-[10px] text-muted-foreground">meta</div>
            </div>
          )}
        </div>

        {/* Ações */}
        {podeEditar && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => onAction('atualizar')} title="Atualizar saldo"
              className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => onAction('entrada')} title="Registrar entrada"
              className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-emerald-400 hover:bg-emerald-400/10 transition-colors">
              <ArrowUpCircle className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => onAction('saida')} title="Registrar saída"
              className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors">
              <ArrowDownCircle className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Detalhes expandidos */}
      {expanded && calc.ultimaAtualizacao && (
        <div className="px-4 pb-3 ml-5">
          <div className="flex items-center gap-4 text-xs text-muted-foreground bg-muted/20 rounded-md px-3 py-2 flex-wrap">
            <span>base <span className="font-medium text-foreground">{calc.base}</span></span>
            {calc.entradas > 0 && <span>+entrada <span className="font-medium text-emerald-400">{calc.entradas}</span></span>}
            {calc.saidas > 0 && <span>-saída <span className="font-medium text-red-400">{calc.saidas}</span></span>}
            {calc.vendas > 0 && <span>-vendas <span className="font-medium text-orange-400">{calc.vendas}</span></span>}
            <span className="ml-auto">= <span className={cn('font-bold', saldoColor)}>{calc.saldo}</span></span>
          </div>
          {calc.ultimaAtualizacao.nota && (
            <p className="text-[11px] text-muted-foreground mt-1.5 ml-3">"{calc.ultimaAtualizacao.nota}"</p>
          )}
        </div>
      )}

      {!calc.ultimaAtualizacao && podeEditar && (
        <div className="px-4 pb-3 ml-5">
          <button onClick={() => onAction('atualizar')}
            className="text-xs text-primary/70 hover:text-primary transition-colors">
            Fazer primeira contagem →
          </button>
        </div>
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export function EstoqueClient({
  userId, usuarioNome, podeEditar,
  itens, controlados, atualizacoes, movimentos, vendaItens, metasItens, membroMetaToMetaCreatedAt,
}: Props) {
  const router = useRouter()
  const sbRef = useRef<ReturnType<typeof createClient> | null>(null)
  const sb = useCallback(() => { if (!sbRef.current) sbRef.current = createClient(); return sbRef.current }, [])

  const [aba, setAba] = useState<Aba>('saldos')
  const [busca, setBusca] = useState('')
  const [buscaConfig, setBuscaConfig] = useState('')
  const [dialogItemId, setDialogItemId] = useState<string | null>(null)
  const [dialogTipo, setDialogTipo] = useState<DialogTipo>(null)
  const [loadingConfig, setLoadingConfig] = useState<string | null>(null)

  // Maps
  const itemMap = useMemo(() => Object.fromEntries(itens.map(i => [i.id, i])), [itens])
  const controladosSet = useMemo(() => new Set(controlados.map(c => c.item_id)), [controlados])

  // Itens controlados com saldo calculado
  const itensControlados = useMemo(() => {
    return controlados
      .map(c => {
        const item = itemMap[c.item_id]
        if (!item) return null
        const calc = calcSaldo(c.item_id, item.nome, atualizacoes, movimentos, vendaItens, metasItens, membroMetaToMetaCreatedAt)
        return { item, calc }
      })
      .filter(Boolean) as { item: Item; calc: SaldoCalc }[]
  }, [controlados, itemMap, atualizacoes, movimentos, vendaItens, metasItens, membroMetaToMetaCreatedAt])

  const itensSaldoFiltrados = useMemo(() => {
    if (!busca.trim()) return itensControlados
    const q = busca.toLowerCase()
    return itensControlados.filter(({ item }) => item.nome.toLowerCase().includes(q))
  }, [itensControlados, busca])

  const itensConfigFiltrados = useMemo(() => {
    if (!buscaConfig.trim()) return itens
    const q = buscaConfig.toLowerCase()
    return itens.filter(i => i.nome.toLowerCase().includes(q))
  }, [itens, buscaConfig])

  // ── Ação: dialog ────────────────────────────────────────────────────────────

  function abrirDialog(itemId: string, tipo: DialogTipo) {
    setDialogItemId(itemId)
    setDialogTipo(tipo)
  }

  function fecharDialog() {
    setDialogItemId(null)
    setDialogTipo(null)
  }

  const confirmarAcao = useCallback(async (valor: number, texto: string) => {
    if (!dialogItemId || !dialogTipo) return
    const client = sb()

    if (dialogTipo === 'atualizar') {
      const { error } = await client.from('estoque_atualizacoes').insert({
        item_id: dialogItemId,
        quantidade: valor,
        criado_por: userId,
        criado_por_nome: usuarioNome,
        nota: texto || null,
      })
      if (error) { toast.error('Erro ao atualizar saldo'); return }
      toast.success('Saldo atualizado')
    } else {
      const { error } = await client.from('estoque_movimentos').insert({
        item_id: dialogItemId,
        tipo: dialogTipo,
        quantidade: valor,
        motivo: texto || null,
        usuario_id: userId,
        usuario_nome: usuarioNome,
      })
      if (error) { toast.error('Erro ao registrar movimento'); return }
      toast.success(dialogTipo === 'entrada' ? 'Entrada registrada' : 'Saída registrada')
    }

    fecharDialog()
    router.refresh()
  }, [dialogItemId, dialogTipo, userId, usuarioNome, sb, router])

  // ── Configurar: toggle item no controle ─────────────────────────────────────

  const toggleControle = useCallback(async (itemId: string) => {
    setLoadingConfig(itemId)
    const client = sb()
    if (controladosSet.has(itemId)) {
      const { error } = await client.from('estoque_itens_controlados').delete().eq('item_id', itemId)
      if (error) { toast.error('Erro ao remover item'); setLoadingConfig(null); return }
      toast.success('Item removido do controle')
    } else {
      const { error } = await client.from('estoque_itens_controlados').insert({
        item_id: itemId,
        criado_por_nome: usuarioNome,
      })
      if (error) { toast.error('Erro ao adicionar item'); setLoadingConfig(null); return }
      toast.success('Item adicionado ao controle')
    }
    setLoadingConfig(null)
    router.refresh()
  }, [controladosSet, usuarioNome, sb, router])

  const dialogItem = dialogItemId ? itemMap[dialogItemId] : null

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-[calc(100vh-3rem)] flex flex-col overflow-hidden">

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-border px-4 shrink-0">
        {([['saldos', 'Saldos', Package], ['configurar', 'Configurar', Settings]] as [Aba, string, React.ElementType][]).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setAba(key)}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
              aba === key
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}>
            <Icon className="h-4 w-4" />
            {label}
            {key === 'saldos' && controladosSet.size > 0 && (
              <span className="text-[10px] text-muted-foreground">({controladosSet.size})</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Aba Saldos ── */}
      {aba === 'saldos' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border shrink-0">
            <div className="relative max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Buscar item..." value={busca} onChange={e => setBusca(e.target.value)}
                className="pl-8 h-8 text-sm" />
            </div>
          </div>

          {controladosSet.size === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
              <Package className="h-10 w-10 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">Nenhum item no controle de estoque.</p>
              <button onClick={() => setAba('configurar')}
                className="text-sm text-primary hover:underline">
                Ir para Configurar →
              </button>
            </div>
          ) : itensSaldoFiltrados.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">Nenhum item encontrado.</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {/* Legenda colunas */}
              <div className="flex items-center gap-3 px-4 py-2 border-b border-border/40 bg-muted/20">
                <span className="flex-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Item</span>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground w-16 text-right">Saldo</span>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground w-12 text-right">Meta</span>
                {podeEditar && <span className="w-24" />}
              </div>
              {itensSaldoFiltrados.map(({ item, calc }) => (
                <ItemSaldoCard
                  key={item.id}
                  item={item}
                  calc={calc}
                  podeEditar={podeEditar}
                  onAction={(tipo) => abrirDialog(item.id, tipo)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Aba Configurar ── */}
      {aba === 'configurar' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border shrink-0 space-y-1">
            <div className="relative max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Buscar item..." value={buscaConfig} onChange={e => setBuscaConfig(e.target.value)}
                className="pl-8 h-8 text-sm" />
            </div>
            <p className="text-[11px] text-muted-foreground px-0.5">
              Selecione quais itens serão controlados no estoque.
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {itensConfigFiltrados.map(item => {
              const ativo = controladosSet.has(item.id)
              const carregando = loadingConfig === item.id
              return (
                <div key={item.id}
                  className="flex items-center gap-3 px-4 py-2.5 border-b border-border/30 hover:bg-muted/[0.04] transition-colors">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{item.nome}</span>
                    {item.categorias_item?.nome && (
                      <span className="text-[10px] text-muted-foreground ml-2">{item.categorias_item.nome}</span>
                    )}
                  </div>
                  <button
                    onClick={() => toggleControle(item.id)}
                    disabled={carregando || !podeEditar}
                    className={cn(
                      'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors',
                      ativo
                        ? 'border-primary/40 bg-primary/[0.06] text-primary hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40'
                        : 'border-border text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/[0.04]',
                      (carregando || !podeEditar) && 'opacity-40 cursor-not-allowed'
                    )}>
                    {carregando ? (
                      <span>...</span>
                    ) : ativo ? (
                      <><Minus className="h-3 w-3" /> Remover</>
                    ) : (
                      <><Plus className="h-3 w-3" /> Adicionar</>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Dialog de ação */}
      {dialogTipo && dialogItem && (
        <ActionDialog
          tipo={dialogTipo}
          itemNome={dialogItem.nome}
          onClose={fecharDialog}
          onConfirm={confirmarAcao}
        />
      )}
    </div>
  )
}

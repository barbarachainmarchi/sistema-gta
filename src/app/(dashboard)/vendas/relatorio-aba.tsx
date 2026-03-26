'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Trash2, Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

type VendaItem = { id: string; venda_id: string; item_id: string | null; item_nome: string; quantidade: number; preco_unit: number; origem: 'fabricar' | 'estoque' }
type Venda = { id: string; faccao_id: string | null; loja_id: string | null; cliente_nome: string; tipo_dinheiro: 'sujo' | 'limpo'; desconto_pct: number; status: string; data_encomenda: string | null; created_at: string; entregue_em: string | null; criado_por_nome: string | null; entregue_por_nome: string | null; itens: VendaItem[]; cancelamento_solicitado: boolean | null; cancelamento_motivo: string | null }
type Faccao = { id: string; nome: string }
type Loja = { id: string; nome: string }
type ItemSimples = { id: string; nome: string }

interface Props {
  vendas: Venda[]
  faccoes: Faccao[]
  lojas: Loja[]
  allItems: ItemSimples[]
  podeExcluirConcluida?: boolean
}

function fmt(v: number) { return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` }
function fmtData(s: string | null) {
  if (!s) return '—'
  const d = new Date(s.includes('T') ? s : s + 'T12:00:00')
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export function RelatorioAba({ vendas: vendasIniciais, faccoes, lojas, podeExcluirConcluida }: Props) {
  const sbRef = useRef<ReturnType<typeof createClient> | null>(null)
  const sb = useCallback(() => { if (!sbRef.current) sbRef.current = createClient(); return sbRef.current }, [])

  const [vendas, setVendas] = useState<Venda[]>(vendasIniciais)
  const [empresaFiltro, setEmpresaFiltro] = useState<string>('todos')
  const [tipoDinFiltro, setTipoDinFiltro] = useState<'todos' | 'sujo' | 'limpo'>('todos')
  const [busca, setBusca] = useState('')
  const [dataDE, setDataDE] = useState('')
  const [dataATE, setDataATE] = useState('')
  const [aba, setAba] = useState<'itens' | 'vendas'>('itens')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deletando, setDeletando] = useState(false)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  function toggleRow(id: string) {
    setExpandedRows(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  async function removerLancamentosVenda(vendaId: string) {
    const { data: lancs } = await sb().from('financeiro_lancamentos')
      .select('id, conta_id, valor, tipo_dinheiro').eq('venda_id', vendaId)
    if (!lancs || lancs.length === 0) return
    for (const lanc of lancs as { id: string; conta_id: string | null; valor: number; tipo_dinheiro: string | null }[]) {
      await sb().from('financeiro_lancamentos').delete().eq('id', lanc.id)
      if (lanc.conta_id) {
        const { data: conta } = await sb().from('financeiro_contas')
          .select('saldo_sujo, saldo_limpo').eq('id', lanc.conta_id).single()
        if (conta) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const c = conta as any
          const campo = lanc.tipo_dinheiro === 'sujo' ? 'saldo_sujo' : 'saldo_limpo'
          await sb().from('financeiro_contas')
            .update({ [campo]: Math.max(0, (c[campo] ?? 0) - lanc.valor) })
            .eq('id', lanc.conta_id)
        }
      }
    }
  }

  async function handleDelete(vendaId: string) {
    setDeletando(true)
    try {
      await removerLancamentosVenda(vendaId)
      const { error } = await sb().from('vendas').delete().eq('id', vendaId)
      if (error) { toast.error('Erro ao excluir'); return }
      setVendas(prev => prev.filter(v => v.id !== vendaId))
      toast.success('Venda excluída do sistema')
    } catch { toast.error('Erro ao excluir') }
    finally { setDeletando(false); setDeleteConfirmId(null) }
  }

  // Only entregues for the report
  const vendasEntregues = useMemo(() => vendas.filter(v => v.status === 'entregue'), [vendas])

  const vendasFiltradas = useMemo(() => {
    let list = vendasEntregues
    if (empresaFiltro !== 'todos') {
      if (empresaFiltro.startsWith('f:')) {
        const id = empresaFiltro.slice(2)
        list = list.filter(v => v.faccao_id === id)
      } else {
        const id = empresaFiltro.slice(2)
        list = list.filter(v => v.loja_id === id)
      }
    }
    if (tipoDinFiltro !== 'todos') list = list.filter(v => v.tipo_dinheiro === tipoDinFiltro)
    if (busca.trim()) {
      const q = busca.toLowerCase()
      list = list.filter(v => v.cliente_nome.toLowerCase().includes(q))
    }
    if (dataDE || dataATE) {
      list = list.filter(v => {
        const d = (v.entregue_em ?? v.created_at).split('T')[0]
        if (dataDE && d < dataDE) return false
        if (dataATE && d > dataATE) return false
        return true
      })
    }
    return list
  }, [vendasEntregues, empresaFiltro, tipoDinFiltro, busca, dataDE, dataATE])

  const totalReceita = useMemo(() => vendasFiltradas.reduce((s, v) => {
    const sub = v.itens.reduce((ss, it) => ss + it.quantidade * it.preco_unit, 0)
    return s + sub * (1 - v.desconto_pct / 100)
  }, 0), [vendasFiltradas])

  // Item breakdown
  const itensSummary = useMemo(() => {
    const map: Record<string, { nome: string; qtd: number; receita: number }> = {}
    for (const v of vendasFiltradas) {
      const fator = 1 - v.desconto_pct / 100
      for (const it of v.itens) {
        const key = it.item_id ?? it.item_nome
        if (!map[key]) map[key] = { nome: it.item_nome, qtd: 0, receita: 0 }
        map[key].qtd += it.quantidade
        map[key].receita += it.quantidade * it.preco_unit * fator
      }
    }
    return Object.values(map).sort((a, b) => b.receita - a.receita)
  }, [vendasFiltradas])

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Filtros */}
      <div className="px-6 py-3 border-b border-border shrink-0 flex flex-wrap items-center gap-3">
        <select value={empresaFiltro} onChange={e => setEmpresaFiltro(e.target.value)}
          className="h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground">
          <option value="todos">Todas empresas</option>
          <optgroup label="Facções">
            {faccoes.map(f => <option key={f.id} value={'f:' + f.id}>{f.nome}</option>)}
          </optgroup>
          <optgroup label="Lojas">
            {lojas.map(l => <option key={l.id} value={'l:' + l.id}>{l.nome}</option>)}
          </optgroup>
        </select>
        <div className="flex gap-0.5">
          {(['todos', 'limpo', 'sujo'] as const).map(t => (
            <button key={t} onClick={() => setTipoDinFiltro(t)}
              className={cn('px-2.5 h-8 text-xs rounded transition-colors',
                tipoDinFiltro === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.06]'
              )}>
              {t === 'todos' ? 'Todos' : t === 'limpo' ? 'Limpo' : 'Sujo'}
            </button>
          ))}
        </div>
        <Input placeholder="Buscar cliente..." value={busca} onChange={e => setBusca(e.target.value)} className="h-8 text-xs w-44" />
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Input type="date" value={dataDE} onChange={e => setDataDE(e.target.value)} className="h-8 text-xs w-32" title="Data de" />
          <span>—</span>
          <Input type="date" value={dataATE} onChange={e => setDataATE(e.target.value)} className="h-8 text-xs w-32" title="Data até" />
        </div>
      </div>

      {/* Stats */}
      <div className="px-6 py-3 border-b border-border shrink-0 grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-white/[0.02] px-4 py-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-1">Vendas entregues</p>
          <p className="text-2xl font-bold tabular-nums">{vendasFiltradas.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-white/[0.02] px-4 py-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-1">Receita total</p>
          <p className="text-2xl font-bold tabular-nums text-primary">{fmt(totalReceita)}</p>
        </div>
        <div className="rounded-lg border border-border bg-white/[0.02] px-4 py-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-1">Itens vendidos</p>
          <p className="text-2xl font-bold tabular-nums">{vendasFiltradas.reduce((s, v) => s + v.itens.reduce((ss, it) => ss + it.quantidade, 0), 0)}</p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="px-6 flex gap-0 border-b border-border shrink-0">
        {([['itens', 'Por Item'], ['vendas', 'Vendas Detalhadas']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setAba(key)}
            className={cn('px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              aba === key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}>
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {aba === 'itens' ? (
          <div>
            {itensSummary.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-16">Nenhuma venda entregue no filtro selecionado</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background border-b border-border">
                  <tr className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                    <th className="px-6 py-2 text-left">Item</th>
                    <th className="px-6 py-2 text-right">Qtd vendida</th>
                    <th className="px-6 py-2 text-right">Receita</th>
                    <th className="px-6 py-2 text-right">% do total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {itensSummary.map((it, i) => (
                    <tr key={i} className="hover:bg-white/[0.02]">
                      <td className="px-6 py-2.5 font-medium">{it.nome}</td>
                      <td className="px-6 py-2.5 text-right tabular-nums text-muted-foreground">{it.qtd}×</td>
                      <td className="px-6 py-2.5 text-right tabular-nums font-medium text-primary">{fmt(it.receita)}</td>
                      <td className="px-6 py-2.5 text-right tabular-nums text-muted-foreground text-xs">
                        {totalReceita > 0 ? Math.round(it.receita / totalReceita * 100) + '%' : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div>
            {vendasFiltradas.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-16">Nenhuma venda entregue no filtro selecionado</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background border-b border-border">
                  <tr className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                    <th className="px-4 py-2 text-left">Data</th>
                    <th className="px-4 py-2 text-left">Empresa</th>
                    <th className="px-4 py-2 text-left">Cliente</th>
                    <th className="px-4 py-2 text-left">Entregue por</th>
                    <th className="px-4 py-2 text-left">Itens</th>
                    <th className="px-4 py-2 text-right">Subtotal</th>
                    <th className="px-4 py-2 text-right">Total</th>
                    <th className="px-4 py-2 text-center">Tipo</th>
                    {podeExcluirConcluida && <th className="px-4 py-2 w-10" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {vendasFiltradas.map(v => {
                    const empresa = v.faccao_id
                      ? faccoes.find(f => f.id === v.faccao_id)?.nome
                      : v.loja_id
                        ? lojas.find(l => l.id === v.loja_id)?.nome
                        : null
                    const empresaTipo = v.faccao_id ? 'faccao' : v.loja_id ? 'loja' : null
                    const sub = v.itens.reduce((s, it) => s + it.quantidade * it.preco_unit, 0)
                    const total = sub * (1 - v.desconto_pct / 100)
                    const expanded = expandedRows.has(v.id)
                    return (
                      <>
                        <tr key={v.id} className={cn('hover:bg-white/[0.02] group cursor-pointer', v.cancelamento_solicitado && 'bg-orange-500/[0.03]')}
                          onClick={() => toggleRow(v.id)}>
                          <td className="px-4 py-2.5 text-muted-foreground text-xs tabular-nums whitespace-nowrap">{fmtData(v.entregue_em ?? v.created_at)}</td>
                          <td className="px-4 py-2.5">
                            {empresa ? (
                              <span className={cn('text-xs font-medium', empresaTipo === 'loja' ? 'text-blue-400' : 'text-primary/80')}>
                                {empresa}
                              </span>
                            ) : <span className="text-muted-foreground text-xs">—</span>}
                          </td>
                          <td className="px-4 py-2.5 font-medium text-sm">
                            <span>{v.cliente_nome}</span>
                            {v.cancelamento_solicitado && (
                              <span className="ml-2 text-[10px] text-orange-400 font-medium" title={v.cancelamento_motivo ?? ''}>
                                ⚠ Canc. solicitado
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground text-xs">{v.entregue_por_nome ?? '—'}</td>
                          <td className="px-4 py-2.5 text-muted-foreground text-xs">
                            <div className="flex items-center gap-1">
                              {expanded
                                ? <ChevronDown className="h-3 w-3 shrink-0 text-primary" />
                                : <ChevronRight className="h-3 w-3 shrink-0" />}
                              <span className="text-[10px]">{v.itens.length} item{v.itens.length !== 1 ? 's' : ''}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground text-xs">
                            {v.desconto_pct > 0 ? <span className="line-through">{fmt(sub)}</span> : fmt(sub)}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-medium text-primary">{fmt(total)}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium',
                              v.tipo_dinheiro === 'sujo' ? 'bg-orange-500/15 text-orange-400' : 'bg-emerald-500/15 text-emerald-400'
                            )}>
                              {v.tipo_dinheiro === 'sujo' ? 'S' : 'L'}
                            </span>
                          </td>
                          {podeExcluirConcluida && (
                            <td className="px-4 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                              <button onClick={() => setDeleteConfirmId(v.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-all">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                        {expanded && (
                          <tr key={v.id + '-itens'} className="bg-white/[0.01]">
                            <td colSpan={podeExcluirConcluida ? 9 : 8} className="px-8 pb-2.5 pt-0">
                              <div className="grid grid-cols-[1fr_48px_72px_72px] gap-x-3 text-[10px] text-muted-foreground/60 font-medium uppercase tracking-wide pb-1 border-b border-border/20">
                                <span>Item</span><span className="text-right">Qtd</span><span className="text-right">Unitário</span><span className="text-right">Total</span>
                              </div>
                              {v.itens.map(it => (
                                <div key={it.id} className="grid grid-cols-[1fr_48px_72px_72px] gap-x-3 items-center py-0.5">
                                  <span className="text-xs truncate">{it.item_nome}</span>
                                  <span className="text-xs text-right text-muted-foreground tabular-nums">{it.quantidade}×</span>
                                  <span className="text-xs text-right text-muted-foreground tabular-nums">{fmt(it.preco_unit)}</span>
                                  <span className="text-xs text-right tabular-nums font-medium">{fmt(it.quantidade * it.preco_unit)}</span>
                                </div>
                              ))}
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Confirm delete */}
      <Dialog open={!!deleteConfirmId} onOpenChange={o => { if (!o && !deletando) setDeleteConfirmId(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Excluir venda do sistema?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Esta ação remove a venda e todos os lançamentos financeiros vinculados, revertendo o saldo. Não pode ser desfeita.</p>
          {(() => {
            const v = vendas.find(x => x.id === deleteConfirmId)
            return v?.cancelamento_motivo ? (
              <p className="text-xs text-orange-400 bg-orange-500/10 rounded p-2">
                Motivo solicitado: {v.cancelamento_motivo}
              </p>
            ) : null
          })()}
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirmId(null)} disabled={deletando}>Cancelar</Button>
            <Button variant="destructive" size="sm" disabled={deletando}
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}>
              {deletando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Excluir'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

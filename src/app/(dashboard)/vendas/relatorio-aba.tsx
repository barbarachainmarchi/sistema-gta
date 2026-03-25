'use client'

import { useState, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type VendaItem = { id: string; venda_id: string; item_id: string | null; item_nome: string; quantidade: number; preco_unit: number; origem: 'fabricar' | 'estoque' }
type Venda = { id: string; faccao_id: string | null; loja_id: string | null; cliente_nome: string; tipo_dinheiro: 'sujo' | 'limpo'; desconto_pct: number; status: string; data_encomenda: string | null; created_at: string; entregue_em: string | null; criado_por_nome: string | null; entregue_por_nome: string | null; itens: VendaItem[] }
type Faccao = { id: string; nome: string }
type Loja = { id: string; nome: string }
type ItemSimples = { id: string; nome: string }

interface Props {
  vendas: Venda[]
  faccoes: Faccao[]
  lojas: Loja[]
  allItems: ItemSimples[]
}

function fmt(v: number) { return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` }
function fmtData(s: string | null) {
  if (!s) return '—'
  const d = new Date(s.includes('T') ? s : s + 'T12:00:00')
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export function RelatorioAba({ vendas, faccoes, lojas }: Props) {
  const [empresaFiltro, setEmpresaFiltro] = useState<string>('todos')
  const [tipoDinFiltro, setTipoDinFiltro] = useState<'todos' | 'sujo' | 'limpo'>('todos')
  const [busca, setBusca] = useState('')
  const [aba, setAba] = useState<'itens' | 'vendas'>('itens')

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
    return list
  }, [vendasEntregues, empresaFiltro, tipoDinFiltro, busca])

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
                    return (
                      <tr key={v.id} className="hover:bg-white/[0.02]">
                        <td className="px-4 py-2.5 text-muted-foreground text-xs tabular-nums whitespace-nowrap">{fmtData(v.entregue_em ?? v.created_at)}</td>
                        <td className="px-4 py-2.5">
                          {empresa ? (
                            <span className={cn('text-xs font-medium', empresaTipo === 'loja' ? 'text-blue-400' : 'text-primary/80')}>
                              {empresa}
                            </span>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-sm">{v.cliente_nome}</td>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs">{v.entregue_por_nome ?? '—'}</td>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs max-w-[200px]">
                          <span className="truncate block">{v.itens.map(it => `${it.quantidade}× ${it.item_nome}`).join(', ')}</span>
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
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

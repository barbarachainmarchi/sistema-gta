'use client'

import { useState, useMemo, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { ArrowUpDown } from 'lucide-react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from 'recharts'

// ── Tipos ─────────────────────────────────────────────────────────────────────

type VendaItem = { item_id: string | null; item_nome: string; quantidade: number; preco_unit: number }
type Venda = {
  id: string; faccao_id: string | null; loja_id: string | null
  cliente_nome: string; tipo_dinheiro: 'sujo' | 'limpo'
  desconto_pct: number; status: string
  created_at: string; entregue_em: string | null
  itens: VendaItem[]
}
type Faccao = { id: string; nome: string }
type Loja   = { id: string; nome: string }
type Item   = { id: string; nome: string }
type Receita = { item_id: string; ingrediente_id: string; quantidade: number; ingrediente_nome: string }

interface Props {
  vendas: Venda[]
  faccoes: Faccao[]
  lojas: Loja[]
  allItems: Item[]
  receitas: Receita[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`
}
function fmtK(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`
  return String(Math.round(v))
}
function toDate(s: string | null): string {
  return (s ?? '').split('T')[0]
}
function calcTotal(v: Venda): number {
  const sub = v.itens.reduce((s, it) => s + it.quantidade * it.preco_unit, 0)
  return sub * (1 - v.desconto_pct / 100)
}

type Shortcut = '7d' | 'mes' | 'tudo'
const SHORTCUTS: [Shortcut, string][] = [
  ['7d', 'Últimos 7 dias'], ['mes', 'Este mês'], ['tudo', 'Tudo'],
]

function calcShortcut(s: Shortcut): [string, string] {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const today = toISO(now)
  if (s === '7d') {
    const d = new Date(now); d.setDate(d.getDate() - 6)
    return [toISO(d), today]
  }
  if (s === 'mes') {
    const d = new Date(now.getFullYear(), now.getMonth(), 1)
    return [toISO(d), today]
  }
  return ['', '']
}

function getGranularity(de: string, ate: string): 'day' | 'week' | 'month' {
  if (!de || !ate) return 'month'
  const days = (new Date(ate).getTime() - new Date(de).getTime()) / 86_400_000
  if (days <= 14) return 'day'
  if (days <= 90) return 'week'
  return 'month'
}

function groupVendasByDate(vendas: Venda[], gran: 'day' | 'week' | 'month') {
  const map: Record<string, { pedidos: number; receita: number }> = {}
  for (const v of vendas) {
    const raw = toDate(v.entregue_em ?? v.created_at)
    if (!raw) continue
    const d = new Date(raw + 'T12:00:00')
    let key: string
    if (gran === 'day') {
      key = raw
    } else if (gran === 'week') {
      const clone = new Date(d); clone.setDate(d.getDate() - d.getDay())
      key = `${clone.getFullYear()}-${String(clone.getMonth() + 1).padStart(2, '0')}-${String(clone.getDate()).padStart(2, '0')}`
    } else {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    }
    if (!map[key]) map[key] = { pedidos: 0, receita: 0 }
    map[key].pedidos++
    map[key].receita += calcTotal(v)
  }
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([date, d]) => {
    const label = gran === 'month'
      ? new Date(date + '-01T12:00:00').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
      : new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    return { date, label, ...d }
  })
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7', '#ef4444']

// ── Tooltip customizado ────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const ponto = payload[0]?.payload as { pedidos: number; receita: number } | undefined
  return (
    <div className="rounded border border-border bg-card px-3 py-2 text-xs shadow-lg space-y-0.5">
      <p className="font-medium text-foreground/70 mb-1">{label}</p>
      <p style={{ color: '#6366f1' }}>Receita: {fmt(ponto?.receita ?? 0)}</p>
      <p className="text-muted-foreground">Pedidos: {ponto?.pedidos ?? 0}</p>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export function DashboardVendasClient({ vendas, faccoes, lojas, allItems, receitas }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const [shortcut, setShortcut] = useState<Shortcut>('tudo')
  const [dataDe, setDataDe] = useState('')
  const [dataAte, setDataAte] = useState('')
  const [empresaFiltro, setEmpresaFiltro] = useState('')
  const [produtoFiltro, setProdutoFiltro] = useState('')
  const [tipoDin, setTipoDin] = useState<'todos' | 'sujo' | 'limpo'>('todos')

  const [sortItens, setSortItens] = useState<'qtd' | 'receita'>('qtd')
  const [sortClientes, setSortClientes] = useState<'pedidos' | 'receita'>('receita')

  function aplicarShortcut(s: Shortcut) {
    setShortcut(s)
    if (s === 'tudo') { setDataDe(''); setDataAte(''); return }
    const [de, ate] = calcShortcut(s)
    setDataDe(de); setDataAte(ate)
  }

  // ── Filtragem ──────────────────────────────────────────────────────────────

  const vendasFiltradas = useMemo(() => {
    let list = vendas
    if (dataDe) list = list.filter(v => toDate(v.entregue_em ?? v.created_at) >= dataDe)
    if (dataAte) list = list.filter(v => toDate(v.entregue_em ?? v.created_at) <= dataAte)
    if (tipoDin !== 'todos') list = list.filter(v => v.tipo_dinheiro === tipoDin)
    if (empresaFiltro) {
      if (empresaFiltro.startsWith('f:')) list = list.filter(v => v.faccao_id === empresaFiltro.slice(2))
      else list = list.filter(v => v.loja_id === empresaFiltro.slice(2))
    }
    if (produtoFiltro) {
      list = list.filter(v => v.itens.some(it => (it.item_id ?? it.item_nome) === produtoFiltro))
    }
    return list
  }, [vendas, dataDe, dataAte, tipoDin, empresaFiltro, produtoFiltro])

  // ── Métricas ───────────────────────────────────────────────────────────────

  const totalPedidos = vendasFiltradas.length
  const totalReceita = useMemo(() => vendasFiltradas.reduce((s, v) => s + calcTotal(v), 0), [vendasFiltradas])
  const totalSujo = useMemo(() => vendasFiltradas.filter(v => v.tipo_dinheiro === 'sujo').reduce((s, v) => s + calcTotal(v), 0), [vendasFiltradas])
  const ticketMedio = totalPedidos > 0 ? totalReceita / totalPedidos : 0

  // ── Dados para gráfico de evolução ────────────────────────────────────────

  const granularidade = useMemo(() => getGranularity(dataDe, dataAte), [dataDe, dataAte])
  const evolucaoDados = useMemo(() => groupVendasByDate(vendasFiltradas, granularidade), [vendasFiltradas, granularidade])

  // ── Ranking de itens ──────────────────────────────────────────────────────

  const rankingItens = useMemo(() => {
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
    return Object.values(map)
      .sort((a, b) => sortItens === 'qtd' ? b.qtd - a.qtd : b.receita - a.receita)
      .slice(0, 15)
  }, [vendasFiltradas, sortItens])

  const topItem = useMemo(() => {
    const map: Record<string, { nome: string; qtd: number }> = {}
    for (const v of vendasFiltradas) {
      for (const it of v.itens) {
        const key = it.item_id ?? it.item_nome
        if (!map[key]) map[key] = { nome: it.item_nome, qtd: 0 }
        map[key].qtd += it.quantidade
      }
    }
    return Object.values(map).sort((a, b) => b.qtd - a.qtd)[0] ?? null
  }, [vendasFiltradas])

  // ── Ranking de clientes ───────────────────────────────────────────────────

  const rankingClientes = useMemo(() => {
    const map: Record<string, { nome: string; pedidos: number; receita: number }> = {}
    for (const v of vendasFiltradas) {
      const empresa = v.faccao_id
        ? (faccoes.find(f => f.id === v.faccao_id)?.nome ?? v.cliente_nome)
        : v.loja_id
          ? (lojas.find(l => l.id === v.loja_id)?.nome ?? v.cliente_nome)
          : v.cliente_nome
      if (!map[empresa]) map[empresa] = { nome: empresa, pedidos: 0, receita: 0 }
      map[empresa].pedidos++
      map[empresa].receita += calcTotal(v)
    }
    return Object.values(map)
      .sort((a, b) => sortClientes === 'pedidos' ? b.pedidos - a.pedidos : b.receita - a.receita)
      .slice(0, 15)
  }, [vendasFiltradas, faccoes, lojas, sortClientes])

  // ── Materiais gastos (insumos de craft) ──────────────────────────────────

  const materiaisGastos = useMemo(() => {
    // item_id → lista de ingredientes
    const receitaMap: Record<string, { ingrediente_id: string; nome: string; qtd_por_un: number }[]> = {}
    for (const r of receitas) {
      if (!receitaMap[r.item_id]) receitaMap[r.item_id] = []
      receitaMap[r.item_id].push({ ingrediente_id: r.ingrediente_id, nome: r.ingrediente_nome, qtd_por_un: r.quantidade })
    }

    const map: Record<string, { nome: string; qtd: number }> = {}
    for (const v of vendasFiltradas) {
      for (const it of v.itens) {
        if (!it.item_id) continue
        const ingredientes = receitaMap[it.item_id] ?? []
        for (const ing of ingredientes) {
          if (!map[ing.ingrediente_id]) map[ing.ingrediente_id] = { nome: ing.nome, qtd: 0 }
          map[ing.ingrediente_id].qtd += ing.qtd_por_un * it.quantidade
        }
      }
    }
    return Object.values(map).sort((a, b) => b.qtd - a.qtd)
  }, [vendasFiltradas, receitas])

  // ── Helpers de barra ──────────────────────────────────────────────────────

  function barPctItem(it: (typeof rankingItens)[0], idx: number): number {
    void idx
    const max = sortItens === 'qtd' ? (rankingItens[0]?.qtd || 1) : (rankingItens[0]?.receita || 1)
    const val = sortItens === 'qtd' ? it.qtd : it.receita
    return Math.round(val / max * 100)
  }

  function barPctCliente(c: (typeof rankingClientes)[0]): number {
    const max = sortClientes === 'pedidos' ? (rankingClientes[0]?.pedidos || 1) : (rankingClientes[0]?.receita || 1)
    const val = sortClientes === 'pedidos' ? c.pedidos : c.receita
    return Math.round(val / max * 100)
  }

  return (
    <div className="flex-1 overflow-y-auto">

      {/* ── Filtros ── */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-6 py-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-muted-foreground/60 font-medium uppercase tracking-wide shrink-0">Período</span>
          <div className="flex flex-wrap gap-1">
            {SHORTCUTS.map(([key, label]) => (
              <button key={key} onClick={() => aplicarShortcut(key)}
                className={cn('px-2.5 h-7 text-xs rounded transition-colors',
                  shortcut === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.06]'
                )}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 ml-2">
            <input type="date" value={dataDe} onChange={e => { setDataDe(e.target.value); setShortcut('tudo') }}
              className="h-7 text-xs rounded border border-input bg-background px-2 text-foreground" />
            <span className="text-muted-foreground text-xs">—</span>
            <input type="date" value={dataAte} onChange={e => { setDataAte(e.target.value); setShortcut('tudo') }}
              className="h-7 text-xs rounded border border-input bg-background px-2 text-foreground" />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={empresaFiltro} onChange={e => setEmpresaFiltro(e.target.value)}
            className="h-7 text-xs rounded border border-input bg-background px-2 text-foreground">
            <option value="">Todas as empresas</option>
            <optgroup label="Facções">{faccoes.map(f => <option key={f.id} value={'f:' + f.id}>{f.nome}</option>)}</optgroup>
            <optgroup label="Lojas">{lojas.map(l => <option key={l.id} value={'l:' + l.id}>{l.nome}</option>)}</optgroup>
          </select>
          <select value={produtoFiltro} onChange={e => setProdutoFiltro(e.target.value)}
            className="h-7 text-xs rounded border border-input bg-background px-2 text-foreground">
            <option value="">Todos os produtos</option>
            {allItems.map(it => <option key={it.id} value={it.id}>{it.nome}</option>)}
          </select>
          <div className="flex gap-0.5">
            {(['todos', 'limpo', 'sujo'] as const).map(t => (
              <button key={t} onClick={() => setTipoDin(t)}
                className={cn('px-2.5 h-7 text-xs rounded transition-colors',
                  tipoDin === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.06]'
                )}>
                {t === 'todos' ? 'Todos' : t === 'limpo' ? 'Limpo' : 'Sujo'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">

        {/* ── Cards de métricas ── */}
        <div className="grid grid-cols-5 gap-3">
          <div className="rounded-lg border border-border/60 bg-card px-4 py-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Pedidos</p>
            <p className="text-xl font-bold tabular-nums mt-1">{totalPedidos.toLocaleString('pt-BR')}</p>
          </div>
          <div className="rounded-lg border border-primary/20 bg-primary/[0.04] px-4 py-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</p>
            <p className="text-xl font-bold tabular-nums mt-1 text-primary">{fmt(totalReceita)}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-card px-4 py-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Ticket médio</p>
            <p className="text-xl font-bold tabular-nums mt-1">{totalPedidos > 0 ? fmt(ticketMedio) : '—'}</p>
          </div>
          <div className="rounded-lg border border-orange-500/20 bg-orange-500/[0.04] px-4 py-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Dinheiro sujo</p>
            <p className="text-xl font-bold tabular-nums mt-1 text-orange-400">{fmt(totalSujo)}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-card px-4 py-3 text-center overflow-hidden">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Mais vendido</p>
            <p className="text-sm font-bold mt-1 truncate" title={topItem?.nome ?? undefined}>{topItem?.nome ?? '—'}</p>
            {topItem && <p className="text-[10px] text-muted-foreground">{topItem.qtd}× un.</p>}
          </div>
        </div>

        {/* ── Itens mais vendidos | Quem mais comprou ── */}
        <div className="grid grid-cols-2 gap-6">

          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold">Itens mais vendidos</p>
              <button
                onClick={() => setSortItens(s => s === 'qtd' ? 'receita' : 'qtd')}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-white/[0.04]">
                <ArrowUpDown className="h-3 w-3" />
                {sortItens === 'qtd' ? 'Por quantidade' : 'Por valor'}
              </button>
            </div>
            {!mounted ? null : rankingItens.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
            ) : (
              <div className="space-y-2">
                {rankingItens.slice(0, 10).map((it, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="w-4 text-right text-muted-foreground/50 tabular-nums shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <span className="truncate font-medium block">{it.nome}</span>
                      <div className="h-1 rounded-full bg-white/[0.06] mt-0.5">
                        <div className="h-1 rounded-full transition-all" style={{ width: `${barPctItem(it, i)}%`, background: COLORS[i % COLORS.length] }} />
                      </div>
                    </div>
                    <span className="tabular-nums text-muted-foreground shrink-0">{it.qtd}×</span>
                    <span className="tabular-nums font-medium shrink-0 text-primary/80">{fmt(it.receita)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold">Quem mais comprou</p>
              <button
                onClick={() => setSortClientes(s => s === 'pedidos' ? 'receita' : 'pedidos')}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-white/[0.04]">
                <ArrowUpDown className="h-3 w-3" />
                {sortClientes === 'pedidos' ? 'Por pedidos' : 'Por valor'}
              </button>
            </div>
            {!mounted ? null : rankingClientes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
            ) : (
              <div className="space-y-2">
                {rankingClientes.slice(0, 10).map((c, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="w-4 text-right text-muted-foreground/50 tabular-nums shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <span className="truncate font-medium block">{c.nome}</span>
                      <div className="h-1 rounded-full bg-white/[0.06] mt-0.5">
                        <div className="h-1 rounded-full transition-all" style={{ width: `${barPctCliente(c)}%`, background: COLORS[(i + 3) % COLORS.length] }} />
                      </div>
                    </div>
                    <span className="tabular-nums text-muted-foreground shrink-0">{c.pedidos} ped.</span>
                    <span className="tabular-nums font-medium shrink-0 text-primary/80">{fmt(c.receita)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Evolução de vendas | Materiais gastos ── */}
        <div className="grid grid-cols-2 gap-6">

          <div className="rounded-lg border border-border bg-card p-5 space-y-3">
            <p className="text-sm font-semibold">Evolução de vendas</p>
            {!mounted || evolucaoDados.length === 0 ? (
              <div className="h-28 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  {!mounted ? '' : 'Sem dados no período selecionado'}
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={90}>
                <LineChart data={evolucaoDados} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} tickLine={false} axisLine={false} width={48} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="receita" name="Receita" stroke="#6366f1" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-baseline gap-2 mb-3">
              <p className="text-sm font-semibold">Materiais gastos</p>
              <span className="text-[10px] text-muted-foreground">insumos de craft no período</span>
            </div>
            {materiaisGastos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                {vendasFiltradas.length === 0
                  ? 'Sem vendas no período'
                  : 'Nenhum item vendido possui receita de craft cadastrada'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b border-border">
                    <tr className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                      <th className="px-2 py-1.5 text-left w-6">#</th>
                      <th className="px-2 py-1.5 text-left">Insumo</th>
                      <th className="px-2 py-1.5 text-right w-28">Qtd.</th>
                      <th className="px-2 py-1.5 text-left w-36">Volume</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {materiaisGastos.map((m, i) => {
                      const pct = Math.round(m.qtd / (materiaisGastos[0]?.qtd || 1) * 100)
                      return (
                        <tr key={i} className="hover:bg-white/[0.02]">
                          <td className="px-2 py-1 text-[10px] text-muted-foreground/50 tabular-nums">{i + 1}</td>
                          <td className="px-2 py-1 text-[11px] font-medium">{m.nome}</td>
                          <td className="px-2 py-1 text-right text-[11px] tabular-nums font-medium text-primary/80">
                            {m.qtd.toLocaleString('pt-BR')}×
                          </td>
                          <td className="px-2 py-1">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1 rounded-full bg-white/[0.06]">
                                <div className="h-1 rounded-full bg-primary/60" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[10px] text-muted-foreground tabular-nums w-7 text-right">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot className="border-t border-border/60">
                    <tr className="font-medium text-muted-foreground">
                      <td colSpan={2} className="px-2 py-1.5 text-[10px] uppercase">Total</td>
                      <td className="px-2 py-1.5 text-right text-[11px] tabular-nums">
                        {materiaisGastos.reduce((s, m) => s + m.qtd, 0).toLocaleString('pt-BR')}×
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── Detalhe por produto (se filtro de produto ativo) ── */}
        {produtoFiltro && (
          <div className="rounded-lg border border-border bg-card p-5">
            <p className="text-sm font-semibold mb-3">
              Pedidos com &quot;{allItems.find(i => i.id === produtoFiltro)?.nome ?? produtoFiltro}&quot;
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b border-border">
                  <tr className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                    <th className="px-3 py-2 text-left">Data</th>
                    <th className="px-3 py-2 text-left">Cliente</th>
                    <th className="px-3 py-2 text-right">Qtd</th>
                    <th className="px-3 py-2 text-right">Unit.</th>
                    <th className="px-3 py-2 text-right">Total venda</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {vendasFiltradas.map(v => {
                    const itensMatch = v.itens.filter(it => (it.item_id ?? it.item_nome) === produtoFiltro)
                    if (itensMatch.length === 0) return null
                    return itensMatch.map((it, idx) => (
                      <tr key={v.id + idx} className="hover:bg-white/[0.02]">
                        <td className="px-3 py-1.5 text-muted-foreground tabular-nums">
                          {new Date((v.entregue_em ?? v.created_at).split('T')[0] + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                        </td>
                        <td className="px-3 py-1.5 font-medium">{v.cliente_nome}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{it.quantidade}×</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{fmt(it.preco_unit)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums font-medium text-primary/80">{fmt(calcTotal(v))}</td>
                      </tr>
                    ))
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

'use client'

import { useState, useMemo, useEffect } from 'react'
import { cn } from '@/lib/utils'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, BarChart, Bar, Cell,
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

interface Props {
  vendas: Venda[]
  faccoes: Faccao[]
  lojas: Loja[]
  allItems: Item[]
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
  return (
    <div className="rounded border border-border bg-card px-3 py-2 text-xs shadow-lg space-y-0.5">
      <p className="font-medium text-foreground/70 mb-1">{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color ?? p.fill }}>
          {p.name}: {typeof p.value === 'number' && p.name?.toLowerCase().includes('receita') ? fmt(p.value) : p.value}
        </p>
      ))}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export function DashboardVendasClient({ vendas, faccoes, lojas, allItems }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const [shortcut, setShortcut] = useState<Shortcut>('tudo')
  const [dataDe, setDataDe] = useState('')
  const [dataAte, setDataAte] = useState('')
  const [empresaFiltro, setEmpresaFiltro] = useState('')
  const [produtoFiltro, setProdutoFiltro] = useState('')
  const [tipoDin, setTipoDin] = useState<'todos' | 'sujo' | 'limpo'>('todos')

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
  const totalItens   = useMemo(() => vendasFiltradas.reduce((s, v) => s + v.itens.reduce((ss, it) => ss + it.quantidade, 0), 0), [vendasFiltradas])
  const totalReceita = useMemo(() => vendasFiltradas.reduce((s, v) => s + calcTotal(v), 0), [vendasFiltradas])

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
    return Object.values(map).sort((a, b) => b.qtd - a.qtd).slice(0, 15)
  }, [vendasFiltradas])

  // ── Ranking de clientes ───────────────────────────────────────────────────

  const rankingClientes = useMemo(() => {
    const map: Record<string, { nome: string; pedidos: number; receita: number; empresa: string }> = {}
    for (const v of vendasFiltradas) {
      const empresa = v.faccao_id
        ? (faccoes.find(f => f.id === v.faccao_id)?.nome ?? v.cliente_nome)
        : v.loja_id
          ? (lojas.find(l => l.id === v.loja_id)?.nome ?? v.cliente_nome)
          : v.cliente_nome
      const key = empresa
      if (!map[key]) map[key] = { nome: empresa, pedidos: 0, receita: 0, empresa: empresa }
      map[key].pedidos++
      map[key].receita += calcTotal(v)
    }
    return Object.values(map).sort((a, b) => b.receita - a.receita).slice(0, 15)
  }, [vendasFiltradas, faccoes, lojas])

  const maxReceita = rankingItens[0]?.receita ?? 1
  const maxReceitaCliente = rankingClientes[0]?.receita ?? 1

  return (
    <div className="flex-1 overflow-y-auto">

      {/* ── Filtros ── */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-6 py-3 space-y-2">
        {/* Shortcuts de período */}
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
        {/* Outros filtros */}
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

        {/* ── KPIs ── */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Pedidos entregues', value: totalPedidos.toLocaleString('pt-BR'), sub: null },
            { label: 'Itens vendidos', value: totalItens.toLocaleString('pt-BR'), sub: null },
            { label: 'Receita total', value: fmt(totalReceita), sub: totalPedidos > 0 ? `Ticket médio: ${fmt(totalReceita / totalPedidos)}` : null },
          ].map(({ label, value, sub }) => (
            <div key={label} className="rounded-lg border border-border bg-card px-5 py-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-2">{label}</p>
              <p className="text-3xl font-bold tabular-nums">{value}</p>
              {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
            </div>
          ))}
        </div>

        {/* ── Gráfico de evolução ── */}
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-sm font-semibold mb-4">Evolução de vendas</p>
          {!mounted || evolucaoDados.length === 0 ? (
            <div className="h-48 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">
                {!mounted ? '' : 'Sem dados no período selecionado'}
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={evolucaoDados} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="receita" tickFormatter={fmtK} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} tickLine={false} axisLine={false} width={48} />
                <YAxis yAxisId="pedidos" orientation="right" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} tickLine={false} axisLine={false} width={32} />
                <Tooltip content={<ChartTooltip />} />
                <Line yAxisId="receita" type="monotone" dataKey="receita" name="Receita" stroke="#6366f1" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line yAxisId="pedidos" type="monotone" dataKey="pedidos" name="Pedidos" stroke="#22c55e" strokeWidth={1.5} dot={false} strokeDasharray="4 2" activeDot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Rankings lado a lado ── */}
        <div className="grid grid-cols-2 gap-6">

          {/* Itens mais vendidos */}
          <div className="rounded-lg border border-border bg-card p-5 space-y-4">
            <p className="text-sm font-semibold">Itens mais vendidos</p>
            {!mounted ? null : rankingItens.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={Math.min(rankingItens.length * 28 + 8, 280)}>
                  <BarChart data={rankingItens.slice(0, 10)} layout="vertical" margin={{ top: 0, right: 60, left: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="nome" width={120} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.6)' }} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                    <Bar dataKey="qtd" name="Qtd" radius={2}>
                      {rankingItens.slice(0, 10).map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="space-y-1 border-t border-border/40 pt-3">
                  {rankingItens.slice(0, 10).map((it, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="w-4 text-right text-muted-foreground/50 tabular-nums shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="truncate font-medium">{it.nome}</span>
                        </div>
                        <div className="h-1 rounded-full bg-white/[0.06] mt-0.5">
                          <div className="h-1 rounded-full" style={{ width: `${Math.round(it.receita / maxReceita * 100)}%`, background: COLORS[i % COLORS.length] }} />
                        </div>
                      </div>
                      <span className="tabular-nums text-muted-foreground shrink-0">{it.qtd}×</span>
                      <span className="tabular-nums font-medium shrink-0 text-primary/80">{fmt(it.receita)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Quem mais comprou */}
          <div className="rounded-lg border border-border bg-card p-5 space-y-4">
            <p className="text-sm font-semibold">Quem mais comprou</p>
            {!mounted ? null : rankingClientes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={Math.min(rankingClientes.length * 28 + 8, 280)}>
                  <BarChart data={rankingClientes.slice(0, 10)} layout="vertical" margin={{ top: 0, right: 60, left: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="nome" width={120} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.6)' }} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                    <Bar dataKey="receita" name="Receita" radius={2}>
                      {rankingClientes.slice(0, 10).map((_, i) => (
                        <Cell key={i} fill={COLORS[(i + 3) % COLORS.length]} fillOpacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="space-y-1 border-t border-border/40 pt-3">
                  {rankingClientes.slice(0, 10).map((c, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="w-4 text-right text-muted-foreground/50 tabular-nums shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <span className="truncate font-medium">{c.nome}</span>
                        <div className="h-1 rounded-full bg-white/[0.06] mt-0.5">
                          <div className="h-1 rounded-full" style={{ width: `${Math.round(c.receita / maxReceitaCliente * 100)}%`, background: COLORS[(i + 3) % COLORS.length] }} />
                        </div>
                      </div>
                      <span className="tabular-nums text-muted-foreground shrink-0">{c.pedidos} ped.</span>
                      <span className="tabular-nums font-medium shrink-0 text-primary/80">{fmt(c.receita)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Detalhe por produto (se filtro de produto ativo) ── */}
        {produtoFiltro && (
          <div className="rounded-lg border border-border bg-card p-5">
            <p className="text-sm font-semibold mb-3">
              Pedidos com "{allItems.find(i => i.id === produtoFiltro)?.nome ?? produtoFiltro}"
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

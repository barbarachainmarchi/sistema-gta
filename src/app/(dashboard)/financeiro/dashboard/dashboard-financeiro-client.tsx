'use client'

import { useState, useMemo, useEffect } from 'react'
import { cn } from '@/lib/utils'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, BarChart, Bar, Cell, Legend,
} from 'recharts'

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Lancamento = {
  id: string; conta_id: string
  tipo: 'entrada' | 'saida' | 'venda'
  tipo_dinheiro: 'sujo' | 'limpo' | null
  valor: number; categoria: string | null
  data: string | null; created_at: string
  item_descricao: string | null; descricao: string | null
}

interface Props { lancamentos: Lancamento[] }

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return `R$ ${Math.round(Math.abs(v)).toLocaleString('pt-BR')}`
}
function fmtK(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`
  return String(Math.round(v))
}
function toDate(l: Lancamento): string {
  return (l.data ?? l.created_at).split('T')[0]
}
function isEntrada(l: Lancamento) { return l.tipo === 'entrada' || l.tipo === 'venda' }

type Shortcut = 'hoje' | '7d' | '30d' | 'mes' | '3m' | '6m' | 'ano' | 'tudo'
const SHORTCUTS: [Shortcut, string][] = [
  ['hoje', 'Hoje'], ['7d', '7 dias'], ['mes', 'Este mês'],
  ['30d', '30 dias'], ['3m', '3 meses'], ['6m', '6 meses'],
  ['ano', '1 ano'], ['tudo', 'Tudo'],
]

function calcShortcut(s: Shortcut): [string, string] {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const today = toISO(now)
  if (s === 'hoje') return [today, today]
  if (s === '7d') { const d = new Date(now); d.setDate(d.getDate() - 6); return [toISO(d), today] }
  if (s === '30d') { const d = new Date(now); d.setDate(d.getDate() - 29); return [toISO(d), today] }
  if (s === 'mes') { return [toISO(new Date(now.getFullYear(), now.getMonth(), 1)), today] }
  if (s === '3m') { const d = new Date(now); d.setMonth(d.getMonth() - 3); return [toISO(d), today] }
  if (s === '6m') { const d = new Date(now); d.setMonth(d.getMonth() - 6); return [toISO(d), today] }
  if (s === 'ano') { const d = new Date(now); d.setFullYear(d.getFullYear() - 1); return [toISO(d), today] }
  return ['', '']
}

function getGranularity(de: string, ate: string): 'day' | 'week' | 'month' {
  if (!de || !ate) return 'month'
  const days = (new Date(ate).getTime() - new Date(de).getTime()) / 86_400_000
  if (days <= 14) return 'day'
  if (days <= 90) return 'week'
  return 'month'
}

const CHART_COLORS = ['#6366f1', '#22c55e', '#f97316', '#ec4899', '#06b6d4', '#eab308', '#8b5cf6', '#ef4444', '#10b981', '#3b82f6']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded border border-border bg-card px-3 py-2 text-xs shadow-lg space-y-0.5">
      <p className="font-medium text-foreground/70 mb-1">{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color ?? p.fill }}>
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export function DashboardFinanceiroClient({ lancamentos }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const [shortcut, setShortcut] = useState<Shortcut>('30d')
  const [dataDe, setDataDe] = useState(() => calcShortcut('30d')[0])
  const [dataAte, setDataAte] = useState(() => calcShortcut('30d')[1])
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'entradas' | 'saidas'>('todos')
  const [tipoDin, setTipoDin] = useState<'todos' | 'sujo' | 'limpo'>('todos')
  const [catsSelecionadas, setCatsSelecionadas] = useState<Set<string>>(new Set())
  const [catDropdownOpen, setCatDropdownOpen] = useState(false)

  function aplicarShortcut(s: Shortcut) {
    setShortcut(s)
    if (s === 'tudo') { setDataDe(''); setDataAte(''); return }
    const [de, ate] = calcShortcut(s)
    setDataDe(de); setDataAte(ate)
  }

  // Todas categorias únicas
  const todasCats = useMemo(() => {
    const s = new Set<string>()
    for (const l of lancamentos) s.add(l.categoria ?? 'Sem categoria')
    return [...s].sort()
  }, [lancamentos])

  // Filtragem principal
  const lancsFiltrados = useMemo(() => {
    let list = lancamentos
    if (dataDe) list = list.filter(l => toDate(l) >= dataDe)
    if (dataAte) list = list.filter(l => toDate(l) <= dataAte)
    if (tipoDin !== 'todos') list = list.filter(l => l.tipo_dinheiro === tipoDin)
    if (tipoFiltro === 'entradas') list = list.filter(l => isEntrada(l))
    else if (tipoFiltro === 'saidas') list = list.filter(l => !isEntrada(l))
    if (catsSelecionadas.size > 0) list = list.filter(l => catsSelecionadas.has(l.categoria ?? 'Sem categoria'))
    return list
  }, [lancamentos, dataDe, dataAte, tipoDin, tipoFiltro, catsSelecionadas])

  // KPIs globais
  const kpis = useMemo(() => {
    let entradasSujo = 0, entradasLimpo = 0
    let vendasSujo = 0, vendasLimpo = 0
    let gastosSujo = 0, gastosLimpo = 0
    for (const l of lancsFiltrados) {
      const sujo = l.tipo_dinheiro === 'sujo'
      const limpo = l.tipo_dinheiro === 'limpo'
      if (l.tipo === 'entrada') {
        if (sujo) entradasSujo += l.valor; else if (limpo) entradasLimpo += l.valor
      } else if (l.tipo === 'venda') {
        if (sujo) vendasSujo += l.valor; else if (limpo) vendasLimpo += l.valor
      } else {
        if (sujo) gastosSujo += l.valor; else if (limpo) gastosLimpo += l.valor
      }
    }
    return {
      entradas: { sujo: entradasSujo, limpo: entradasLimpo, total: entradasSujo + entradasLimpo },
      vendas:   { sujo: vendasSujo,   limpo: vendasLimpo,   total: vendasSujo   + vendasLimpo   },
      gastos:   { sujo: gastosSujo,   limpo: gastosLimpo,   total: gastosSujo   + gastosLimpo   },
      saldo: {
        sujo:  (entradasSujo  + vendasSujo)  - gastosSujo,
        limpo: (entradasLimpo + vendasLimpo) - gastosLimpo,
        total: (entradasSujo + entradasLimpo + vendasSujo + vendasLimpo) - (gastosSujo + gastosLimpo),
      },
    }
  }, [lancsFiltrados])

  const totalEntradas = kpis.entradas.total + kpis.vendas.total
  const totalSaidas   = kpis.gastos.total
  const saldo         = kpis.saldo.total

  // Por categoria (sem filtro de tipo para mostrar ambos)
  const porCategoria = useMemo(() => {
    const map: Record<string, { cat: string; entradas: number; saidas: number }> = {}
    const catsAtivas = catsSelecionadas.size > 0 ? catsSelecionadas : new Set(todasCats)
    for (const l of lancamentos) {
      const cat = l.categoria ?? 'Sem categoria'
      if (!catsAtivas.has(cat)) continue
      const d = toDate(l)
      if (dataDe && d < dataDe) continue
      if (dataAte && d > dataAte) continue
      if (tipoDin !== 'todos' && l.tipo_dinheiro !== tipoDin) continue
      if (!map[cat]) map[cat] = { cat, entradas: 0, saidas: 0 }
      if (isEntrada(l)) map[cat].entradas += l.valor
      else map[cat].saidas += l.valor
    }
    return Object.values(map)
      .map(c => ({ ...c, saldo: c.entradas - c.saidas }))
      .sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo))
  }, [lancamentos, catsSelecionadas, todasCats, dataDe, dataAte, tipoDin])

  // Evolução ao longo do tempo
  const granularidade = useMemo(() => getGranularity(dataDe, dataAte), [dataDe, dataAte])

  const evolucaoDados = useMemo(() => {
    const catsAtivas = catsSelecionadas.size > 0 ? catsSelecionadas : null
    const map: Record<string, { entradas: number; saidas: number; saldo: number }> = {}
    for (const l of lancsFiltrados) {
      if (catsAtivas && !catsAtivas.has(l.categoria ?? 'Sem categoria')) continue
      const raw = toDate(l)
      const d = new Date(raw + 'T12:00:00')
      let key: string
      if (granularidade === 'day') {
        key = raw
      } else if (granularidade === 'week') {
        const c = new Date(d); c.setDate(d.getDate() - d.getDay())
        key = `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, '0')}-${String(c.getDate()).padStart(2, '0')}`
      } else {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      }
      if (!map[key]) map[key] = { entradas: 0, saidas: 0, saldo: 0 }
      if (isEntrada(l)) { map[key].entradas += l.valor; map[key].saldo += l.valor }
      else { map[key].saidas += l.valor; map[key].saldo -= l.valor }
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([date, d]) => {
      const label = granularidade === 'month'
        ? new Date(date + '-01T12:00:00').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
        : new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      return { date, label, ...d }
    })
  }, [lancsFiltrados, catsSelecionadas, granularidade])

  // Multi-select de categorias: toggle
  function toggleCat(cat: string) {
    setCatsSelecionadas(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const rankingGasto  = [...porCategoria].sort((a, b) => b.saidas   - a.saidas).slice(0, 10)
  const rankingEntrada = [...porCategoria].sort((a, b) => b.entradas - a.entradas).slice(0, 10)
  const maxGasto    = rankingGasto[0]?.saidas   ?? 1
  const maxEntrada  = rankingEntrada[0]?.entradas ?? 1

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
          {/* Tipo movimentação */}
          <div className="flex gap-0.5">
            {([['todos', 'Todos'], ['entradas', 'Entradas'], ['saidas', 'Saídas']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setTipoFiltro(k)}
                className={cn('px-2.5 h-7 text-xs rounded transition-colors',
                  tipoFiltro === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.06]'
                )}>
                {l}
              </button>
            ))}
          </div>
          {/* Tipo dinheiro */}
          <div className="flex gap-0.5">
            {(['todos', 'limpo', 'sujo'] as const).map(t => (
              <button key={t} onClick={() => setTipoDin(t)}
                className={cn('px-2.5 h-7 text-xs rounded transition-colors',
                  tipoDin === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.06]'
                )}>
                {t === 'todos' ? 'Sujo+Limpo' : t === 'limpo' ? 'Limpo' : 'Sujo'}
              </button>
            ))}
          </div>
          {/* Categorias multi-select */}
          <div className="relative">
            <button
              onClick={() => setCatDropdownOpen(v => !v)}
              className={cn(
                'h-7 px-3 text-xs rounded border transition-colors flex items-center gap-1.5',
                catsSelecionadas.size > 0
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-input bg-background text-muted-foreground hover:text-foreground'
              )}
            >
              {catsSelecionadas.size === 0
                ? 'Todas as categorias'
                : `${catsSelecionadas.size} categoria${catsSelecionadas.size > 1 ? 's' : ''}`}
              <span className="text-[10px]">▼</span>
            </button>
            {catDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 z-50 rounded border border-border bg-card shadow-lg min-w-[200px] max-h-64 overflow-y-auto">
                <div className="p-1">
                  <button
                    onClick={() => { setCatsSelecionadas(new Set()); setCatDropdownOpen(false) }}
                    className="w-full text-left px-2 py-1 text-xs text-muted-foreground hover:bg-white/[0.06] rounded"
                  >
                    Limpar seleção
                  </button>
                  {todasCats.map(cat => (
                    <label key={cat} className="flex items-center gap-2 px-2 py-1 hover:bg-white/[0.06] rounded cursor-pointer">
                      <input type="checkbox" checked={catsSelecionadas.has(cat)} onChange={() => toggleCat(cat)}
                        className="h-3 w-3 accent-primary" />
                      <span className="text-xs truncate">{cat}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          {catsSelecionadas.size > 0 && (
            <div className="flex gap-1 flex-wrap">
              {[...catsSelecionadas].map(cat => (
                <span key={cat} className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary flex items-center gap-1">
                  {cat}
                  <button onClick={() => toggleCat(cat)} className="hover:text-white">×</button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6" onClick={() => setCatDropdownOpen(false)}>

        {/* ── KPIs globais ── */}
        <div className="grid grid-cols-4 gap-4">
          {([
            { label: 'Entradas',  k: kpis.entradas, color: 'text-emerald-400' },
            { label: 'Vendas',    k: kpis.vendas,   color: 'text-emerald-400' },
            { label: 'Gastos',    k: kpis.gastos,   color: 'text-red-400'     },
            { label: 'Saldo',     k: kpis.saldo,    color: kpis.saldo.total >= 0 ? 'text-emerald-400' : 'text-red-400' },
          ] as const).map(({ label, k, color }) => (
            <div key={label} className="rounded-lg border border-border bg-card px-5 py-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-2">{label}</p>
              <p className={cn('text-2xl font-bold tabular-nums', color)}>{fmt(k.total)}</p>
              <div className="flex gap-3 mt-1.5">
                <span className="text-[11px] text-muted-foreground">
                  Sujo: <span className="tabular-nums text-foreground/70">{fmt(k.sujo)}</span>
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Limpo: <span className="tabular-nums text-foreground/70">{fmt(k.limpo)}</span>
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* ── Por categoria ── */}
        {porCategoria.length > 0 && (
          <div className="rounded-lg border border-border bg-card p-5">
            <p className="text-sm font-semibold mb-4">Saldo por categoria</p>
            <div className="space-y-2">
              {porCategoria.map((c, i) => (
                <div key={c.cat} className="grid grid-cols-[1fr_100px_100px_100px] gap-3 items-center text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="truncate font-medium">{c.cat}</span>
                  </div>
                  <span className="text-right tabular-nums text-emerald-400">{fmt(c.entradas)}</span>
                  <span className="text-right tabular-nums text-red-400/80">−{fmt(c.saidas)}</span>
                  <span className={cn('text-right tabular-nums font-semibold', c.saldo >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {c.saldo >= 0 ? '+' : ''}{fmt(c.saldo)}
                  </span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-[1fr_100px_100px_100px] gap-3 mt-3 pt-3 border-t border-border/40 text-xs font-semibold">
              <span className="text-muted-foreground">Total</span>
              <span className="text-right tabular-nums text-emerald-400">{fmt(totalEntradas)}</span>
              <span className="text-right tabular-nums text-red-400/80">−{fmt(totalSaidas)}</span>
              <span className={cn('text-right tabular-nums', saldo >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                {saldo >= 0 ? '+' : ''}{fmt(saldo)}
              </span>
            </div>
          </div>
        )}

        {/* ── Gráfico de evolução ── */}
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-sm font-semibold mb-4">Entradas × Saídas ao longo do tempo</p>
          {!mounted || evolucaoDados.length === 0 ? (
            <div className="h-48 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">{!mounted ? '' : 'Sem dados no período selecionado'}</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={evolucaoDados} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} tickLine={false} axisLine={false} width={52} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
                <Line type="monotone" dataKey="entradas" name="Entradas" stroke="#22c55e" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="saidas"   name="Saídas"   stroke="#ef4444" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="saldo"    name="Saldo"    stroke="#6366f1" strokeWidth={1.5} dot={false} strokeDasharray="4 2" activeDot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Rankings lado a lado ── */}
        <div className="grid grid-cols-2 gap-6">

          {/* Maiores gastos */}
          <div className="rounded-lg border border-border bg-card p-5 space-y-4">
            <p className="text-sm font-semibold">Maiores gastos por categoria</p>
            {!mounted || rankingGasto.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={Math.min(rankingGasto.length * 28 + 8, 280)}>
                  <BarChart data={rankingGasto} layout="vertical" margin={{ top: 0, right: 60, left: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="cat" width={120} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.6)' }} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                    <Bar dataKey="saidas" name="Saídas" radius={2}>
                      {rankingGasto.map((_, i) => <Cell key={i} fill="#ef4444" fillOpacity={0.6 + i * 0.03} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="space-y-1 border-t border-border/40 pt-3">
                  {rankingGasto.map((c, i) => (
                    <div key={c.cat} className="flex items-center gap-2 text-xs">
                      <span className="w-4 text-right text-muted-foreground/50 tabular-nums shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <span className="truncate font-medium">{c.cat}</span>
                        <div className="h-1 rounded-full bg-white/[0.06] mt-0.5">
                          <div className="h-1 rounded-full bg-red-500/60" style={{ width: `${Math.round(c.saidas / maxGasto * 100)}%` }} />
                        </div>
                      </div>
                      <span className="tabular-nums text-red-400/80 shrink-0">{fmt(c.saidas)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Maiores receitas */}
          <div className="rounded-lg border border-border bg-card p-5 space-y-4">
            <p className="text-sm font-semibold">Maiores receitas por categoria</p>
            {!mounted || rankingEntrada.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={Math.min(rankingEntrada.length * 28 + 8, 280)}>
                  <BarChart data={rankingEntrada} layout="vertical" margin={{ top: 0, right: 60, left: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="cat" width={120} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.6)' }} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                    <Bar dataKey="entradas" name="Entradas" radius={2}>
                      {rankingEntrada.map((_, i) => <Cell key={i} fill="#22c55e" fillOpacity={0.6 + i * 0.03} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="space-y-1 border-t border-border/40 pt-3">
                  {rankingEntrada.map((c, i) => (
                    <div key={c.cat} className="flex items-center gap-2 text-xs">
                      <span className="w-4 text-right text-muted-foreground/50 tabular-nums shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <span className="truncate font-medium">{c.cat}</span>
                        <div className="h-1 rounded-full bg-white/[0.06] mt-0.5">
                          <div className="h-1 rounded-full bg-emerald-500/60" style={{ width: `${Math.round(c.entradas / maxEntrada * 100)}%` }} />
                        </div>
                      </div>
                      <span className="tabular-nums text-emerald-400 shrink-0">{fmt(c.entradas)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

        </div>

        {/* ── Visão de margem (quando 2+ categorias selecionadas) ── */}
        {catsSelecionadas.size >= 2 && (
          <div className="rounded-lg border border-border bg-card p-5">
            <p className="text-sm font-semibold mb-1">Comparativo entre categorias selecionadas</p>
            <p className="text-xs text-muted-foreground mb-4">
              Entradas vs. Saídas de cada categoria — útil para medir margem (ex: Vendas vs. Matéria Prima)
            </p>
            {!mounted ? null : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={porCategoria} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="cat" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} tickLine={false} axisLine={false} width={52} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
                  <Bar dataKey="entradas" name="Entradas" fill="#22c55e" fillOpacity={0.7} radius={2} />
                  <Bar dataKey="saidas"   name="Saídas"   fill="#ef4444" fillOpacity={0.7} radius={2} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

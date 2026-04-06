'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import {
  Search, Plus, Minus, RotateCcw, Package, Settings,
  ChevronDown, ArrowUp, ArrowDown, CheckCircle2, AlertTriangle,
  GripVertical, Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Item = {
  id: string
  nome: string
  peso: number | null
  categorias_item: { nome: string } | null
}

type Controlado = {
  item_id: string; created_at: string
  quantidade_real: number | null
  ordem: number | null
}

type Atualizacao = {
  id: string; item_id: string; quantidade: number
  criado_por: string | null; criado_por_nome: string; nota: string | null; created_at: string
}
type Movimento = {
  id: string; item_id: string; tipo: 'entrada' | 'saida'; quantidade: number
  motivo: string | null; usuario_nome: string; created_at: string
}
type MetaItem  = { membro_meta_id: string; item_nome: string; quantidade_meta: number; quantidade_entregue: number }

type LogEntry = {
  tipo: 'atualizacao' | 'entrada' | 'saida'
  quantidade: number; data: string
  usuario: string | null; motivo: string | null
}

interface Props {
  userId: string; usuarioNome: string; podeEditar: boolean
  itens: Item[]
  controlados: Controlado[]
  atualizacoes: Atualizacao[]
  movimentos: Movimento[]
  metasItens: MetaItem[]
  membroMetaToMetaCreatedAt: Record<string, string>
}

type Aba = 'saldos' | 'configurar'
type ActiveForm = {
  itemId: string
  tipo: 'entrada' | 'saida' | 'atualizar' | 'reset'
  qty: string; motivo: string
} | null

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtData(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function fmtDataCurta(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

// ── Cálculo de saldo ──────────────────────────────────────────────────────────

interface SaldoCalc {
  ultimaAtualizacao: Atualizacao | null
  base: number; entradas: number; saidas: number; saldo: number
  metasPendentes: number
}

function calcSaldo(
  itemId: string, itemNome: string,
  atualizacoes: Atualizacao[], movimentos: Movimento[],
  metasItens: MetaItem[],
  membroMetaToMetaCreatedAt: Record<string, string>,
): SaldoCalc {
  const ultima = atualizacoes.find(a => a.item_id === itemId) ?? null
  const cutoff = ultima ? new Date(ultima.created_at) : null

  const movsFiltrados = movimentos.filter(m =>
    m.item_id === itemId && (!cutoff || new Date(m.created_at) > cutoff)
  )
  const entradas = movsFiltrados.filter(m => m.tipo === 'entrada').reduce((s, m) => s + m.quantidade, 0)
  const saidas   = movsFiltrados.filter(m => m.tipo === 'saida').reduce((s, m) => s + m.quantidade, 0)
  const base = ultima?.quantidade ?? 0
  const saldo = base + entradas - saidas

  const nomeNorm = itemNome.toLowerCase()
  const metasPendentes = metasItens
    .filter(mi => {
      if (mi.item_nome.toLowerCase() !== nomeNorm) return false
      if (!cutoff) return true
      const d = membroMetaToMetaCreatedAt[mi.membro_meta_id]
      return d ? new Date(d) > cutoff : false
    })
    .reduce((s, mi) => s + Math.max(0, mi.quantidade_meta - mi.quantidade_entregue), 0)

  return { ultimaAtualizacao: ultima, base, entradas, saidas, saldo, metasPendentes }
}

// ── Log combinado ─────────────────────────────────────────────────────────────

function buildLog(
  itemId: string,
  atualizacoes: Atualizacao[], movimentos: Movimento[],
): LogEntry[] {
  const entries: LogEntry[] = []
  atualizacoes.filter(a => a.item_id === itemId).forEach(a =>
    entries.push({ tipo: 'atualizacao', quantidade: a.quantidade, data: a.created_at, usuario: a.criado_por_nome || null, motivo: a.nota })
  )
  movimentos.filter(m => m.item_id === itemId).forEach(m =>
    entries.push({ tipo: m.tipo, quantidade: m.quantidade, data: m.created_at, usuario: m.usuario_nome || null, motivo: m.motivo })
  )
  return entries.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
}

// ── Log Row ───────────────────────────────────────────────────────────────────

function LogRow({ entry }: { entry: LogEntry }) {
  const config = {
    atualizacao: { label: 'Base',    color: 'text-primary',     sign: '→', bg: 'bg-primary/10' },
    entrada:     { label: 'Entrada', color: 'text-emerald-400', sign: '+', bg: 'bg-emerald-400/10' },
    saida:       { label: 'Saída',   color: 'text-red-400',     sign: '−', bg: 'bg-red-400/10' },
  }[entry.tipo]

  return (
    <div className="flex items-start gap-3 px-3 py-2 border-b border-border/20 last:border-0 hover:bg-muted/[0.03] transition-colors">
      <span className={cn('text-[11px] font-bold w-4 text-center mt-0.5 shrink-0', config.color)}>
        {config.sign}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('text-sm font-semibold tabular-nums', config.color)}>{entry.quantidade}</span>
          <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', config.bg, config.color)}>{config.label}</span>
          {entry.usuario && <span className="text-xs text-muted-foreground">{entry.usuario}</span>}
          {entry.motivo && <span className="text-xs text-muted-foreground italic">"{entry.motivo}"</span>}
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">{fmtData(entry.data)}</span>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export function EstoqueClient({
  userId, usuarioNome, podeEditar,
  itens, controlados, atualizacoes, movimentos, metasItens, membroMetaToMetaCreatedAt,
}: Props) {
  const router = useRouter()
  const sbRef = useRef<ReturnType<typeof createClient> | null>(null)
  const sb = useCallback(() => { if (!sbRef.current) sbRef.current = createClient(); return sbRef.current }, [])

  const [aba, setAba] = useState<Aba>('saldos')
  const [busca, setBusca] = useState('')
  const [buscaConfig, setBuscaConfig] = useState('')
  const [activeForm, setActiveForm] = useState<ActiveForm>(null)
  const [expandedLog, setExpandedLog] = useState<Set<string>>(new Set())
  const [editReal, setEditReal] = useState<{ itemId: string; value: string } | null>(null)
  const [realLocal, setRealLocal] = useState<Record<string, number | null>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [loadingConfig, setLoadingConfig] = useState<string | null>(null)

  // Drag-and-drop
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [ordemLocal, setOrdemLocal] = useState<Record<string, number>>({})

  const itemMap = useMemo(() => Object.fromEntries(itens.map(i => [i.id, i])), [itens])
  const controladosMap = useMemo(() => Object.fromEntries(controlados.map(c => [c.item_id, c])), [controlados])
  const controladosSet = useMemo(() => new Set(controlados.map(c => c.item_id)), [controlados])

  // ── Itens controlados ordenados e calculados ──────────────────────────────

  const itensControlados = useMemo(() => {
    return controlados
      .map(c => {
        const item = itemMap[c.item_id]
        if (!item) return null
        const calc = calcSaldo(c.item_id, item.nome, atualizacoes, movimentos, metasItens, membroMetaToMetaCreatedAt)
        const real = realLocal[c.item_id] !== undefined ? realLocal[c.item_id] : c.quantidade_real
        const ordem = ordemLocal[c.item_id] !== undefined ? ordemLocal[c.item_id] : (c.ordem ?? 999)
        const log = buildLog(c.item_id, atualizacoes, movimentos)
        return { item, calc, real, ordem, log }
      })
      .filter(Boolean)
      .sort((a, b) => a!.ordem - b!.ordem) as {
        item: Item; calc: SaldoCalc; real: number | null; ordem: number; log: LogEntry[]
      }[]
  }, [controlados, itemMap, atualizacoes, movimentos, metasItens, membroMetaToMetaCreatedAt, realLocal, ordemLocal])

  const itensFiltrados = useMemo(() => {
    if (!busca.trim()) return itensControlados
    const q = busca.toLowerCase()
    return itensControlados.filter(({ item }) => item.nome.toLowerCase().includes(q))
  }, [itensControlados, busca])

  const itensConfigFiltrados = useMemo(() => {
    if (!buscaConfig.trim()) return itens
    const q = buscaConfig.toLowerCase()
    return itens.filter(i => i.nome.toLowerCase().includes(q))
  }, [itens, buscaConfig])

  // ── Salvar "Real" ─────────────────────────────────────────────────────────

  const salvarReal = useCallback(async () => {
    if (!editReal) return
    const { itemId, value } = editReal
    const n = value.trim() === '' ? null : parseFloat(value)
    if (n !== null && isNaN(n)) { toast.error('Valor inválido'); return }

    setRealLocal(prev => ({ ...prev, [itemId]: n }))
    setEditReal(null)

    const { error } = await sb().from('estoque_itens_controlados')
      .update({ quantidade_real: n })
      .eq('item_id', itemId)
    if (error) {
      toast.error('Erro ao salvar')
      setRealLocal(prev => { const r = { ...prev }; delete r[itemId]; return r })
    }
  }, [editReal, sb])

  // ── Confirmar ação (entrada / saída / atualizar base) ─────────────────────

  const confirmarAcao = useCallback(async () => {
    if (!activeForm) return
    const { itemId, tipo, qty, motivo } = activeForm
    const n = parseFloat(qty)
    if (isNaN(n) || n < 0) { toast.error('Quantidade inválida'); return }
    if (tipo !== 'atualizar' && n <= 0) { toast.error('Quantidade deve ser maior que zero'); return }

    setSaving(itemId)
    const client = sb()

    if (tipo === 'atualizar') {
      const { error } = await client.from('estoque_atualizacoes').insert({
        item_id: itemId, quantidade: n,
        criado_por: userId, criado_por_nome: usuarioNome,
        nota: motivo || null,
      })
      if (error) { toast.error('Erro ao atualizar base'); setSaving(null); return }
      toast.success('Base atualizada')
    } else {
      const { error } = await client.from('estoque_movimentos').insert({
        item_id: itemId, tipo,
        quantidade: n, motivo: motivo || null,
        usuario_id: userId, usuario_nome: usuarioNome,
      })
      if (error) { toast.error('Erro ao registrar'); setSaving(null); return }
      toast.success(tipo === 'entrada' ? 'Entrada registrada' : 'Saída registrada')
    }

    setActiveForm(null)
    setSaving(null)
    setExpandedLog(prev => new Set([...prev, itemId]))
    router.refresh()
  }, [activeForm, userId, usuarioNome, sb, router])

  // ── Reset de estoque ──────────────────────────────────────────────────────

  const confirmarReset = useCallback(async () => {
    if (!activeForm || activeForm.tipo !== 'reset') return
    const { itemId, qty } = activeForm
    const n = qty.trim() === '' ? 0 : parseFloat(qty)
    if (isNaN(n) || n < 0) { toast.error('Quantidade inválida'); return }

    setSaving(itemId)
    const client = sb()

    // Apagar todas as movimentações e bases do item
    await client.from('estoque_movimentos').delete().eq('item_id', itemId)
    await client.from('estoque_atualizacoes').delete().eq('item_id', itemId)

    // Se foi informado valor inicial, inserir como entrada
    if (n > 0) {
      await client.from('estoque_movimentos').insert({
        item_id: itemId, tipo: 'entrada', quantidade: n,
        motivo: 'Reset inicial',
        usuario_id: userId, usuario_nome: usuarioNome,
      })
    }

    toast.success('Estoque resetado')
    setActiveForm(null)
    setSaving(null)
    router.refresh()
  }, [activeForm, userId, usuarioNome, sb, router])

  // ── Toggle controle ───────────────────────────────────────────────────────

  const toggleControle = useCallback(async (itemId: string) => {
    setLoadingConfig(itemId)
    const client = sb()
    if (controladosSet.has(itemId)) {
      const { error } = await client.from('estoque_itens_controlados').delete().eq('item_id', itemId)
      if (error) { toast.error('Erro ao remover'); setLoadingConfig(null); return }
      toast.success('Item removido do controle')
    } else {
      const maxOrdem = controlados.reduce((m, c) => Math.max(m, c.ordem ?? 0), 0)
      const { error } = await client.from('estoque_itens_controlados').insert({
        item_id: itemId, criado_por_nome: usuarioNome, ordem: maxOrdem + 1,
      })
      if (error) { toast.error('Erro ao adicionar'); setLoadingConfig(null); return }
      toast.success('Item adicionado ao controle')
    }
    setLoadingConfig(null)
    router.refresh()
  }, [controladosSet, controlados, usuarioNome, sb, router])

  // ── Drag-and-drop ─────────────────────────────────────────────────────────

  const handleDragStart = useCallback((itemId: string) => {
    setDragId(itemId)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, itemId: string) => {
    e.preventDefault()
    if (dragId !== itemId) setDragOverId(itemId)
  }, [dragId])

  const handleDragLeave = useCallback(() => {
    setDragOverId(null)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return }

    const ids = itensControlados.map(i => i.item.id)
    const fromIdx = ids.indexOf(dragId)
    const toIdx = ids.indexOf(targetId)
    const newOrder = [...ids]
    newOrder.splice(fromIdx, 1)
    newOrder.splice(toIdx, 0, dragId)

    const novoOrdem: Record<string, number> = {}
    newOrder.forEach((id, idx) => { novoOrdem[id] = idx })
    setOrdemLocal(novoOrdem)
    setDragId(null)
    setDragOverId(null)

    const client = sb()
    for (const [id, idx] of Object.entries(novoOrdem)) {
      await client.from('estoque_itens_controlados').update({ ordem: idx }).eq('item_id', id)
    }
  }, [dragId, itensControlados, sb])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-[calc(100vh-3rem)] flex flex-col overflow-hidden">

      {/* Tabs */}
      <div className="flex items-center border-b border-border px-4 shrink-0">
        {([['saldos', 'Saldos', Package], ['configurar', 'Configurar', Settings]] as [Aba, string, React.ElementType][]).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setAba(key)}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
              aba === key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}>
            <Icon className="h-4 w-4" />
            {label}
            {key === 'saldos' && controladosSet.size > 0 && (
              <span className="text-[10px] text-muted-foreground ml-0.5">({controladosSet.size})</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Aba Saldos ── */}
      {aba === 'saldos' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border shrink-0">
            <div className="relative max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Buscar item..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-8 h-8 text-sm" />
            </div>
          </div>

          {controladosSet.size === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
              <Package className="h-10 w-10 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">Nenhum item no controle.</p>
              <button onClick={() => setAba('configurar')} className="text-sm text-primary hover:underline">Ir para Configurar →</button>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {itensFiltrados.map(({ item, calc, real, log }) => {
                  const diff = real != null ? calc.saldo - real : null
                  const logExpanded = expandedLog.has(item.id)
                  const isFormActive = activeForm?.itemId === item.id
                  const isSaving = saving === item.id
                  const isDragOver = dragOverId === item.id

                  const saldoColor =
                    calc.saldo <= 0 ? 'text-red-400'
                    : (real != null && calc.saldo < real) ? 'text-amber-400'
                    : 'text-emerald-400'

                  const hasDivergence = diff !== null && diff !== 0

                  return (
                    <div
                      key={item.id}
                      draggable={podeEditar}
                      onDragStart={() => handleDragStart(item.id)}
                      onDragOver={e => handleDragOver(e, item.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={e => handleDrop(e, item.id)}
                      className={cn(
                        'rounded-lg border bg-card transition-all',
                        isDragOver ? 'border-primary/60 bg-primary/[0.04] scale-[1.01]' : 'border-border/60',
                        dragId === item.id && 'opacity-50',
                      )}
                    >
                      {/* ── Cabeçalho ── */}
                      <div className="flex items-start gap-2 px-3 pt-3 pb-2">
                        {podeEditar && (
                          <GripVertical className="h-4 w-4 text-muted-foreground/30 mt-0.5 shrink-0 cursor-grab active:cursor-grabbing" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-semibold">{item.nome}</span>
                            {item.categorias_item?.nome && (
                              <span className="text-[10px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">
                                {item.categorias_item.nome}
                              </span>
                            )}
                            {calc.metasPendentes > 0 && (
                              <span className="text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                                meta: +{calc.metasPendentes}
                              </span>
                            )}
                            {hasDivergence && (
                              <span title="Divergência entre real e sistema" className="text-[10px] text-orange-400 bg-orange-400/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                                <AlertTriangle className="h-2.5 w-2.5" />
                                divergência
                              </span>
                            )}
                          </div>
                          {calc.ultimaAtualizacao && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Base em {fmtDataCurta(calc.ultimaAtualizacao.created_at)} · {calc.ultimaAtualizacao.criado_por_nome}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* ── Stats ── */}
                      <div className="px-3 pb-2 flex items-end gap-4">
                        {/* Saldo calculado */}
                        <div className="text-center">
                          <div className={cn('text-4xl font-bold tabular-nums leading-none', saldoColor)}>
                            {calc.saldo}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wide">Sistema</div>
                        </div>

                        {/* Breakdown */}
                        <div className="flex-1 text-[11px] text-muted-foreground space-y-0.5 pb-0.5">
                          {calc.ultimaAtualizacao
                            ? <div><span className="text-foreground/50">base:</span> {calc.base}</div>
                            : <div className="text-muted-foreground/50 italic">sem base definida</div>
                          }
                          {calc.entradas > 0 && <div className="text-emerald-400">+{calc.entradas} entrada</div>}
                          {calc.saidas > 0 && <div className="text-red-400">−{calc.saidas} saída</div>}
                        </div>

                        {/* Real e diff */}
                        <div className="text-center min-w-[60px]">
                          {editReal?.itemId === item.id ? (
                            <Input
                              type="number" min="0"
                              value={editReal.value}
                              onChange={e => setEditReal(prev => prev ? { ...prev, value: e.target.value } : null)}
                              onKeyDown={e => { if (e.key === 'Enter') salvarReal(); if (e.key === 'Escape') setEditReal(null) }}
                              onBlur={salvarReal}
                              autoFocus
                              className="h-7 w-16 text-center text-xs px-1"
                            />
                          ) : (
                            <button
                              onClick={() => podeEditar && setEditReal({ itemId: item.id, value: real?.toString() ?? '' })}
                              className={cn(
                                'text-2xl font-bold tabular-nums leading-none transition-colors',
                                real == null ? 'text-muted-foreground/30' : 'text-foreground/60',
                                podeEditar && 'hover:text-foreground cursor-pointer',
                              )}>
                              {real ?? '—'}
                            </button>
                          )}
                          <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wide">Real</div>
                        </div>

                        {/* Diferença */}
                        {diff !== null && (
                          <div className="text-center min-w-[50px]">
                            <div className={cn('text-xl font-bold tabular-nums leading-none', diff === 0 ? 'text-muted-foreground/40' : diff > 0 ? 'text-emerald-400' : 'text-red-400')}>
                              {diff > 0 ? '+' : ''}{diff}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wide">
                              {diff === 0 ? 'ok' : diff > 0 ? 'sobra' : 'falta'}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* ── Botões de ação ── */}
                      {podeEditar && (
                        <div className="flex items-center gap-1.5 px-3 pb-3 flex-wrap">
                          {(['entrada', 'saida'] as const).map(tipo => {
                            const isActive = isFormActive && activeForm?.tipo === tipo
                            const icons = { entrada: ArrowUp, saida: ArrowDown }
                            const labels = { entrada: 'Entrada', saida: 'Saída' }
                            const colors = {
                              entrada: isActive ? 'bg-emerald-600 text-white border-emerald-600' : 'border-border text-muted-foreground hover:border-emerald-500/50 hover:text-emerald-400',
                              saida:   isActive ? 'bg-red-600 text-white border-red-600'         : 'border-border text-muted-foreground hover:border-red-500/50 hover:text-red-400',
                            }
                            const Icon = icons[tipo]
                            return (
                              <button key={tipo}
                                onClick={() => setActiveForm(prev =>
                                  prev?.itemId === item.id && prev.tipo === tipo ? null : { itemId: item.id, tipo, qty: '', motivo: '' }
                                )}
                                className={cn('flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border transition-colors', colors[tipo])}>
                                <Icon className="h-3 w-3" />
                                {labels[tipo]}
                              </button>
                            )
                          })}
                          <button
                            onClick={() => setActiveForm(prev =>
                              prev?.itemId === item.id && prev.tipo === 'atualizar' ? null : { itemId: item.id, tipo: 'atualizar', qty: '', motivo: '' }
                            )}
                            className={cn('flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border transition-colors',
                              isFormActive && activeForm?.tipo === 'atualizar'
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'border-border text-muted-foreground hover:border-primary/50 hover:text-primary'
                            )}>
                            <RotateCcw className="h-3 w-3" />
                            Base
                          </button>
                          <button
                            onClick={() => setActiveForm(prev =>
                              prev?.itemId === item.id && prev.tipo === 'reset' ? null : { itemId: item.id, tipo: 'reset', qty: '', motivo: '' }
                            )}
                            className={cn('flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border transition-colors ml-auto',
                              isFormActive && activeForm?.tipo === 'reset'
                                ? 'bg-destructive text-white border-destructive'
                                : 'border-border text-muted-foreground/50 hover:border-destructive/50 hover:text-destructive'
                            )}>
                            <Trash2 className="h-3 w-3" />
                            Reset
                          </button>
                        </div>
                      )}

                      {/* ── Formulários inline ── */}
                      {isFormActive && activeForm && activeForm.tipo !== 'reset' && (
                        <div className="mx-3 mb-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col gap-1 flex-1 min-w-0">
                              <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
                                {activeForm.tipo === 'atualizar' ? 'Nova base (quantidade atual real)' : activeForm.tipo === 'entrada' ? 'Quantidade que entrou' : 'Quantidade que saiu'}
                              </label>
                              <Input
                                type="number" min="0" placeholder="0"
                                value={activeForm.qty}
                                onChange={e => setActiveForm(prev => prev ? { ...prev, qty: e.target.value } : null)}
                                onKeyDown={e => e.key === 'Enter' && confirmarAcao()}
                                autoFocus
                                className="h-8 w-24 text-sm"
                              />
                            </div>
                            <div className="flex flex-col gap-1 flex-1 min-w-0">
                              <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
                                {activeForm.tipo === 'atualizar' ? 'Nota (opcional)' : 'Motivo (opcional)'}
                              </label>
                              <Input
                                placeholder={activeForm.tipo === 'entrada' ? 'Ex: meta, produção...' : activeForm.tipo === 'saida' ? 'Ex: uso, perda...' : 'Ex: contagem física...'}
                                value={activeForm.motivo}
                                onChange={e => setActiveForm(prev => prev ? { ...prev, motivo: e.target.value } : null)}
                                onKeyDown={e => e.key === 'Enter' && confirmarAcao()}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="flex items-end gap-1.5 pb-0.5 shrink-0">
                              <button
                                onClick={confirmarAcao} disabled={isSaving}
                                className={cn(
                                  'h-8 px-3 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5',
                                  activeForm.tipo === 'saida' ? 'bg-red-600 hover:bg-red-500 text-white' :
                                  activeForm.tipo === 'entrada' ? 'bg-emerald-600 hover:bg-emerald-500 text-white' :
                                  'bg-primary hover:bg-primary/80 text-primary-foreground',
                                  isSaving && 'opacity-50 cursor-not-allowed'
                                )}>
                                {isSaving ? '...' : <><CheckCircle2 className="h-3.5 w-3.5" /> OK</>}
                              </button>
                              <button onClick={() => setActiveForm(null)}
                                className="h-8 px-2.5 rounded-md text-sm border border-border text-muted-foreground hover:text-foreground transition-colors">
                                ✕
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ── Form Reset ── */}
                      {isFormActive && activeForm?.tipo === 'reset' && (
                        <div className="mx-3 mb-3 rounded-lg border border-destructive/40 bg-destructive/[0.04] p-3">
                          <p className="text-xs text-destructive font-medium mb-2">
                            Apaga todo o histórico de movimentações deste item e define um novo ponto de partida.
                          </p>
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Valor inicial (0 = zerar)</label>
                              <Input
                                type="number" min="0" placeholder="0"
                                value={activeForm.qty}
                                onChange={e => setActiveForm(prev => prev ? { ...prev, qty: e.target.value } : null)}
                                onKeyDown={e => e.key === 'Enter' && confirmarReset()}
                                autoFocus
                                className="h-8 w-24 text-sm"
                              />
                            </div>
                            <div className="flex items-end gap-1.5 pb-0.5 shrink-0">
                              <button
                                onClick={confirmarReset} disabled={isSaving}
                                className={cn(
                                  'h-8 px-3 rounded-md text-sm font-medium bg-destructive hover:bg-destructive/80 text-white transition-colors flex items-center gap-1.5',
                                  isSaving && 'opacity-50 cursor-not-allowed'
                                )}>
                                {isSaving ? '...' : <><Trash2 className="h-3.5 w-3.5" /> Resetar</>}
                              </button>
                              <button onClick={() => setActiveForm(null)}
                                className="h-8 px-2.5 rounded-md text-sm border border-border text-muted-foreground hover:text-foreground transition-colors">
                                ✕
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ── Histórico ── */}
                      <div className="border-t border-border/30">
                        <button
                          onClick={() => setExpandedLog(prev => {
                            const n = new Set(prev); n.has(item.id) ? n.delete(item.id) : n.add(item.id); return n
                          })}
                          className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/[0.04] transition-colors rounded-b-lg">
                          <span>
                            Histórico
                            {log.length > 0 && <span className="ml-1 text-muted-foreground/50">({log.length})</span>}
                          </span>
                          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', logExpanded && 'rotate-180')} />
                        </button>
                        {logExpanded && (
                          <div className="border-t border-border/20">
                            {log.length === 0 ? (
                              <p className="text-xs text-muted-foreground text-center py-4">Nenhum registro.</p>
                            ) : log.map((entry, i) => <LogRow key={i} entry={entry} />)}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
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
              <Input placeholder="Buscar item..." value={buscaConfig} onChange={e => setBuscaConfig(e.target.value)} className="pl-8 h-8 text-sm" />
            </div>
            <p className="text-[11px] text-muted-foreground">Selecione quais itens serão controlados no estoque.</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {itensConfigFiltrados.map(item => {
              const ativo = controladosSet.has(item.id)
              const carregando = loadingConfig === item.id
              const controlado = controladosMap[item.id]
              return (
                <div key={item.id}
                  className="flex items-center gap-3 px-4 py-2.5 border-b border-border/30 hover:bg-muted/[0.04] transition-colors">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{item.nome}</span>
                    {item.categorias_item?.nome && (
                      <span className="text-[10px] text-muted-foreground ml-2">{item.categorias_item.nome}</span>
                    )}
                    {ativo && controlado?.quantidade_real != null && (
                      <span className="text-[10px] text-muted-foreground ml-2">· real: {controlado.quantidade_real}</span>
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
                    {carregando ? '...' : ativo ? <><Minus className="h-3 w-3" /> Remover</> : <><Plus className="h-3 w-3" /> Adicionar</>}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

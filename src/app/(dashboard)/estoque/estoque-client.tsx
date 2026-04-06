'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Search, Plus, Minus, RefreshCw, Package, Settings, ChevronDown, ArrowUp, ArrowDown, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Item = {
  id: string
  nome: string
  peso: number | null
  categorias_item: { nome: string } | null
}

type Controlado = { item_id: string; created_at: string; quantidade_esperada: number | null }

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
type ActiveForm = { itemId: string; tipo: 'entrada' | 'saida' | 'atualizar'; qty: string; motivo: string } | null

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
  base: number; entradas: number; saidas: number; saldo: number | null
  metasPendentes: number
}

function calcSaldo(
  itemId: string, itemNome: string,
  atualizacoes: Atualizacao[], movimentos: Movimento[],
  metasItens: MetaItem[],
  membroMetaToMetaCreatedAt: Record<string, string>,
): SaldoCalc {
  const ultima = atualizacoes.find(a => a.item_id === itemId) ?? null
  if (!ultima) return { ultimaAtualizacao: null, base: 0, entradas: 0, saidas: 0, saldo: null, metasPendentes: 0 }

  const updateDate = new Date(ultima.created_at)
  const movsSince = movimentos.filter(m => m.item_id === itemId && new Date(m.created_at) > updateDate)
  const entradas = movsSince.filter(m => m.tipo === 'entrada').reduce((s, m) => s + m.quantidade, 0)
  const saidas   = movsSince.filter(m => m.tipo === 'saida').reduce((s, m) => s + m.quantidade, 0)

  const nomeNorm = itemNome.toLowerCase()
  const metasPendentes = metasItens
    .filter(mi => {
      if (mi.item_nome.toLowerCase() !== nomeNorm) return false
      const d = membroMetaToMetaCreatedAt[mi.membro_meta_id]
      return d ? new Date(d) > updateDate : false
    })
    .reduce((s, mi) => s + Math.max(0, mi.quantidade_meta - mi.quantidade_entregue), 0)

  return { ultimaAtualizacao: ultima, base: ultima.quantidade, entradas, saidas, saldo: ultima.quantidade + entradas - saidas, metasPendentes }
}

// ── Log combinado por item ────────────────────────────────────────────────────

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

// ── Log row ───────────────────────────────────────────────────────────────────

function LogRow({ entry }: { entry: LogEntry }) {
  const config = {
    atualizacao: { label: 'Atualização', color: 'text-primary',     sign: '→', bg: 'bg-primary/10' },
    entrada:     { label: 'Entrada',     color: 'text-emerald-400', sign: '+', bg: 'bg-emerald-400/10' },
    saida:       { label: 'Saída',       color: 'text-red-400',     sign: '−', bg: 'bg-red-400/10' },
  }[entry.tipo]

  return (
    <div className="flex items-start gap-3 px-4 py-2.5 border-b border-border/30 last:border-0 hover:bg-muted/[0.03] transition-colors">
      <span className={cn('text-[11px] font-bold w-4 text-center mt-0.5 shrink-0', config.color)}>
        {config.sign}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('text-sm font-semibold tabular-nums', config.color)}>
            {entry.tipo === 'atualizacao' ? entry.quantidade : entry.quantidade}
          </span>
          <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', config.bg, config.color)}>
            {config.label}
          </span>
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
  const [editEsperado, setEditEsperado] = useState<{ itemId: string; value: string } | null>(null)
  const [esperadoLocal, setEsperadoLocal] = useState<Record<string, number | null>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [loadingConfig, setLoadingConfig] = useState<string | null>(null)

  const itemMap = useMemo(() => Object.fromEntries(itens.map(i => [i.id, i])), [itens])
  const controladosMap = useMemo(() => Object.fromEntries(controlados.map(c => [c.item_id, c])), [controlados])
  const controladosSet = useMemo(() => new Set(controlados.map(c => c.item_id)), [controlados])

  // ── Itens controlados com cálculo ─────────────────────────────────────────

  const itensControlados = useMemo(() =>
    controlados
      .map(c => {
        const item = itemMap[c.item_id]
        if (!item) return null
        const calc = calcSaldo(c.item_id, item.nome, atualizacoes, movimentos, metasItens, membroMetaToMetaCreatedAt)
        const esperado = esperadoLocal[c.item_id] !== undefined ? esperadoLocal[c.item_id] : c.quantidade_esperada
        const log = buildLog(c.item_id, atualizacoes, movimentos)
        return { item, calc, esperado, log }
      })
      .filter(Boolean) as { item: Item; calc: SaldoCalc; esperado: number | null; log: LogEntry[] }[],
    [controlados, itemMap, atualizacoes, movimentos, metasItens, membroMetaToMetaCreatedAt, esperadoLocal]
  )

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

  // ── Helpers de UI ──────────────────────────────────────────────────────────

  function toggleForm(itemId: string, tipo: 'entrada' | 'saida' | 'atualizar') {
    setActiveForm(prev =>
      prev?.itemId === itemId && prev.tipo === tipo ? null : { itemId, tipo, qty: '', motivo: '' }
    )
  }

  function toggleLog(itemId: string) {
    setExpandedLog(prev => {
      const n = new Set(prev)
      n.has(itemId) ? n.delete(itemId) : n.add(itemId)
      return n
    })
  }

  // ── Salvar ação ───────────────────────────────────────────────────────────

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
      if (error) { toast.error('Erro ao atualizar saldo'); setSaving(null); return }
      toast.success('Saldo atualizado')
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
    // Abre o log automaticamente para o item após registrar
    setExpandedLog(prev => new Set([...prev, itemId]))
    router.refresh()
  }, [activeForm, userId, usuarioNome, sb, router])

  // ── Salvar esperado ───────────────────────────────────────────────────────

  const salvarEsperado = useCallback(async () => {
    if (!editEsperado) return
    const { itemId, value } = editEsperado
    const n = value.trim() === '' ? null : parseFloat(value)
    if (n !== null && isNaN(n)) { toast.error('Valor inválido'); return }

    setEsperadoLocal(prev => ({ ...prev, [itemId]: n }))
    setEditEsperado(null)

    const { error } = await sb().from('estoque_itens_controlados')
      .update({ quantidade_esperada: n })
      .eq('item_id', itemId)
    if (error) {
      toast.error('Erro ao salvar esperado')
      setEsperadoLocal(prev => { const r = { ...prev }; delete r[itemId]; return r })
    }
  }, [editEsperado, sb])

  // ── Toggle controle ───────────────────────────────────────────────────────

  const toggleControle = useCallback(async (itemId: string) => {
    setLoadingConfig(itemId)
    const client = sb()
    if (controladosSet.has(itemId)) {
      const { error } = await client.from('estoque_itens_controlados').delete().eq('item_id', itemId)
      if (error) { toast.error('Erro ao remover'); setLoadingConfig(null); return }
      toast.success('Item removido do controle')
    } else {
      const { error } = await client.from('estoque_itens_controlados').insert({ item_id: itemId, criado_por_nome: usuarioNome })
      if (error) { toast.error('Erro ao adicionar'); setLoadingConfig(null); return }
      toast.success('Item adicionado ao controle')
    }
    setLoadingConfig(null)
    router.refresh()
  }, [controladosSet, usuarioNome, sb, router])

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
            <div className="flex-1 overflow-y-auto">
              {itensFiltrados.map(({ item, calc, esperado, log }) => {
                const diff = (calc.saldo != null && esperado != null) ? calc.saldo - esperado : null
                const logExpanded = expandedLog.has(item.id)
                const isFormActive = activeForm?.itemId === item.id
                const isSaving = saving === item.id

                const saldoColor = calc.saldo == null
                  ? 'text-muted-foreground'
                  : calc.saldo <= 0 ? 'text-red-400'
                  : (esperado != null && calc.saldo < esperado) ? 'text-amber-400'
                  : 'text-emerald-400'

                return (
                  <div key={item.id} className="border-b border-border/50 last:border-0">

                    {/* ── Cabeçalho do item ── */}
                    <div className="flex items-center gap-3 px-4 py-3 bg-muted/[0.02]">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{item.nome}</span>
                          {item.categorias_item?.nome && (
                            <span className="text-[10px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">
                              {item.categorias_item.nome}
                            </span>
                          )}
                          {calc.metasPendentes > 0 && (
                            <span className="text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                              meta: {calc.metasPendentes}
                            </span>
                          )}
                        </div>
                        {calc.ultimaAtualizacao && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Contado em {fmtDataCurta(calc.ultimaAtualizacao.created_at)} por {calc.ultimaAtualizacao.criado_por_nome}
                            {calc.ultimaAtualizacao.nota && ` · "${calc.ultimaAtualizacao.nota}"`}
                          </p>
                        )}
                      </div>
                      {/* Esperado editável */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[11px] text-muted-foreground">Esperado:</span>
                        {editEsperado?.itemId === item.id ? (
                          <Input
                            type="number" min="0"
                            value={editEsperado.value}
                            onChange={e => setEditEsperado(prev => prev ? { ...prev, value: e.target.value } : null)}
                            onKeyDown={e => { if (e.key === 'Enter') salvarEsperado(); if (e.key === 'Escape') setEditEsperado(null) }}
                            onBlur={salvarEsperado}
                            autoFocus
                            className="h-6 w-16 text-center text-xs px-1"
                          />
                        ) : (
                          <button
                            onClick={() => setEditEsperado({ itemId: item.id, value: esperado?.toString() ?? '' })}
                            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors border-b border-dashed border-border/60 hover:border-foreground/40 min-w-[2rem] text-center">
                            {esperado ?? '—'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* ── Stats: Real vs Esperado ── */}
                    <div className="flex items-center gap-0 px-4 py-3">
                      {/* Real */}
                      <div className="text-center min-w-[80px]">
                        <div className={cn('text-3xl font-bold tabular-nums leading-none', saldoColor)}>
                          {calc.saldo ?? '—'}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wide">Real</div>
                      </div>

                      {/* Breakdown */}
                      {calc.ultimaAtualizacao && (
                        <div className="flex-1 px-4">
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                            <span className="font-medium text-foreground/60">base: {calc.base}</span>
                            {calc.entradas > 0 && <span className="text-emerald-400">+{calc.entradas} entrada</span>}
                            {calc.saidas > 0 && <span className="text-red-400">−{calc.saidas} saída</span>}
                          </div>
                        </div>
                      )}

                      {/* Diff vs Esperado */}
                      {diff !== null && (
                        <div className="text-center min-w-[80px]">
                          <div className={cn('text-2xl font-bold tabular-nums leading-none', diff >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                            {diff >= 0 ? '+' : ''}{diff}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wide">
                            {diff >= 0 ? 'sobra' : 'falta'}
                          </div>
                        </div>
                      )}

                      {/* Esperado (display) */}
                      {esperado != null && (
                        <div className="text-center min-w-[80px]">
                          <div className="text-2xl font-semibold tabular-nums leading-none text-muted-foreground/60">{esperado}</div>
                          <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wide">Esperado</div>
                        </div>
                      )}
                    </div>

                    {/* ── Botões de ação ── */}
                    {podeEditar && (
                      <div className="flex items-center gap-2 px-4 pb-3">
                        {(['entrada', 'saida', 'atualizar'] as const).map(tipo => {
                          const isActive = isFormActive && activeForm?.tipo === tipo
                          const icons = { entrada: ArrowUp, saida: ArrowDown, atualizar: RefreshCw }
                          const labels = { entrada: 'Entrada', saida: 'Saída', atualizar: 'Atualizar saldo' }
                          const colors = {
                            entrada:   isActive ? 'bg-emerald-600 text-white border-emerald-600' : 'border-border text-muted-foreground hover:border-emerald-500/50 hover:text-emerald-400',
                            saida:     isActive ? 'bg-red-600 text-white border-red-600'     : 'border-border text-muted-foreground hover:border-red-500/50 hover:text-red-400',
                            atualizar: isActive ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/50 hover:text-primary',
                          }
                          const Icon = icons[tipo]
                          return (
                            <button key={tipo}
                              onClick={() => toggleForm(item.id, tipo)}
                              className={cn('flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors', colors[tipo])}>
                              <Icon className="h-3 w-3" />
                              {labels[tipo]}
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {/* ── Formulário inline ── */}
                    {isFormActive && activeForm && (
                      <div className="mx-4 mb-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col gap-1 flex-1 min-w-0">
                            <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
                              {activeForm.tipo === 'atualizar' ? 'Quantidade atual em estoque' : activeForm.tipo === 'entrada' ? 'Quantidade que entrou' : 'Quantidade que saiu'}
                            </label>
                            <Input
                              type="number" min="0" placeholder="0"
                              value={activeForm.qty}
                              onChange={e => setActiveForm(prev => prev ? { ...prev, qty: e.target.value } : null)}
                              onKeyDown={e => e.key === 'Enter' && confirmarAcao()}
                              autoFocus
                              className="h-8 w-28 text-sm"
                            />
                          </div>
                          <div className="flex flex-col gap-1 flex-1 min-w-0">
                            <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
                              {activeForm.tipo === 'atualizar' ? 'Nota (opcional)' : 'Motivo (opcional)'}
                            </label>
                            <Input
                              placeholder={activeForm.tipo === 'entrada' ? 'Ex: produção, compra...' : activeForm.tipo === 'saida' ? 'Ex: uso, perda...' : 'Ex: contagem física...'}
                              value={activeForm.motivo}
                              onChange={e => setActiveForm(prev => prev ? { ...prev, motivo: e.target.value } : null)}
                              onKeyDown={e => e.key === 'Enter' && confirmarAcao()}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="flex items-end gap-1.5 pb-0.5 shrink-0">
                            <button
                              onClick={confirmarAcao}
                              disabled={isSaving}
                              className={cn(
                                'h-8 px-4 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5',
                                activeForm.tipo === 'saida' ? 'bg-red-600 hover:bg-red-500 text-white' :
                                activeForm.tipo === 'entrada' ? 'bg-emerald-600 hover:bg-emerald-500 text-white' :
                                'bg-primary hover:bg-primary/80 text-primary-foreground',
                                isSaving && 'opacity-50 cursor-not-allowed'
                              )}>
                              {isSaving ? '...' : <><CheckCircle2 className="h-3.5 w-3.5" /> Registrar</>}
                            </button>
                            <button onClick={() => setActiveForm(null)}
                              className="h-8 px-3 rounded-md text-sm border border-border text-muted-foreground hover:text-foreground transition-colors">
                              ✕
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── Log ── */}
                    <div className="border-t border-border/40">
                      <button
                        onClick={() => toggleLog(item.id)}
                        className="w-full flex items-center justify-between px-4 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/[0.04] transition-colors">
                        <span>
                          Histórico
                          {log.length > 0 && <span className="ml-1 text-muted-foreground/60">({log.length})</span>}
                        </span>
                        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', logExpanded && 'rotate-180')} />
                      </button>
                      {logExpanded && (
                        <div>
                          {log.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4">Nenhum registro ainda.</p>
                          ) : (
                            log.map((entry, i) => <LogRow key={i} entry={entry} />)
                          )}
                        </div>
                      )}
                    </div>

                  </div>
                )
              })}
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
                    {ativo && controlado?.quantidade_esperada != null && (
                      <span className="text-[10px] text-muted-foreground ml-2">· esperado: {controlado.quantidade_esperada}</span>
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

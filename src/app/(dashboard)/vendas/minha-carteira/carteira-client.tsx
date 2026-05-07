'use client'

import React, { useState, useMemo, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  ArrowRightLeft, Loader2, Wallet, TrendingUp, CheckCircle2, Trash2, Users, ChevronDown, ChevronRight, Clock, Check,
} from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// ── Tipos ─────────────────────────────────────────────────────────────────────

type VendaItem = { id: string; item_nome: string; quantidade: number; preco_unit: number }
type Venda = {
  id: string; cliente_nome: string; tipo_dinheiro: 'sujo' | 'limpo'
  desconto_pct: number; status: string; created_at: string; entregue_em: string | null
  criado_por: string | null; criado_por_nome: string | null
  entregue_por: string | null; entregue_por_nome: string | null
  cancelamento_solicitado: boolean | null; cancelamento_motivo: string | null
  itens: VendaItem[]
}
type Lancamento = {
  id: string; venda_id: string | null; conta_id: string | null
  valor: number; tipo_dinheiro: 'sujo' | 'limpo' | null
  created_by: string | null; responsavel_nome: string | null
}
type Conta = {
  id: string; nome: string; tipo: string; membro_id?: string | null
  saldo_sujo: number; saldo_limpo: number; status: 'ativo' | 'inativo'
}
type MembroSemConta = { membroId: string; nome: string }
type TransferPendente = {
  id: string
  solicitante_nome: string | null
  descricao: string | null
  dados: {
    lancamento_id: string; venda_id: string
    conta_origem_id: string; conta_destino_id: string
    valor: number; tipo_dinheiro: 'sujo' | 'limpo'
    descricao: string
  } | null
  created_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return `R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}
function fmtData(s: string | null) {
  if (!s) return '—'
  const d = new Date(s.includes('T') ? s : s + 'T00:00:00')
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  userId: string
  userNome: string | null
  vendas: Venda[]
  lancamentos: Lancamento[]
  contas: Conta[]
  podeExcluirConcluida: boolean
  meuContaId: string | null
  membrosSemContaIniciais: MembroSemConta[]
  transferPendentesIniciais: TransferPendente[]
}

// ── Componente ────────────────────────────────────────────────────────────────

export function CarteiraClient({ userId, userNome, vendas: vendasIniciais, lancamentos: lancsIniciais, contas: contasIniciais, podeExcluirConcluida, meuContaId, membrosSemContaIniciais, transferPendentesIniciais }: Props) {
  const sbRef = useRef<ReturnType<typeof createClient> | null>(null)
  const sb = useCallback(() => { if (!sbRef.current) sbRef.current = createClient(); return sbRef.current }, [])

  const [vendas, setVendas] = useState<Venda[]>(vendasIniciais)
  const [lancamentos, setLancamentos] = useState<Lancamento[]>(lancsIniciais)
  const [contas, setContas] = useState<Conta[]>(contasIniciais)
  const [membrosSemConta, setMembrosSemConta] = useState<MembroSemConta[]>(membrosSemContaIniciais)

  // Filtro de vendedores (admin): 'todos' | 'meu' | userId
  const [filtroVendedor, setFiltroVendedor] = useState<string>('meu')
  const [filtroAba, setFiltroAba] = useState<'todos' | 'comigo' | 'repassado'>('todos')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  function toggleRow(id: string) {
    setExpandedRows(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  // Transfer individual
  const [transferindoVendaId, setTransferindoVendaId] = useState<string | null>(null)
  const [destSingle, setDestSingle] = useState('')

  // Transferir tudo
  const [transferTudoOpen, setTransferTudoOpen] = useState(false)
  const [destTudo, setDestTudo] = useState('')

  // Delete
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deletando, setDeletando] = useState(false)

  // Solicitar exclusão da carteira
  const [solicitarExclusaoId, setSolicitarExclusaoId] = useState<string | null>(null)
  const [motivoExclusaoCart, setMotivoExclusaoCart] = useState('')
  const [solicitandoExclusao, setSolicitandoExclusao] = useState(false)

  const [salvando, setSalvando] = useState(false)

  // Multi-select
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [transferSelecionadosOpen, setTransferSelecionadosOpen] = useState(false)
  const [destSelecionados, setDestSelecionados] = useState('')

  // Transferências pendentes para mim
  const [transferPendentes, setTransferPendentes] = useState<TransferPendente[]>(transferPendentesIniciais)
  const [aceitando, setAceitando] = useState<string | null>(null)

  const contaMap = useMemo(() => Object.fromEntries(contas.map(c => [c.id, c])), [contas])
  const lancMap = useMemo(() => {
    const m: Record<string, Lancamento> = {}
    for (const l of lancamentos) { if (l.venda_id) m[l.venda_id] = l }
    return m
  }, [lancamentos])

  // Vendedores únicos
  const vendedores = useMemo(() => {
    const seen = new Set<string>()
    const list: { id: string; nome: string }[] = []
    for (const v of vendas) {
      if (v.criado_por && !seen.has(v.criado_por)) {
        seen.add(v.criado_por)
        list.push({ id: v.criado_por, nome: v.criado_por_nome ?? v.criado_por })
      }
    }
    return list.sort((a, b) => a.nome.localeCompare(b.nome))
  }, [vendas])

  // Vendas visíveis (filtro de quem é dono)
  const vendasVisiveis = useMemo(() => {
    if (!podeExcluirConcluida) return vendas.filter(v => v.criado_por === userId)
    if (filtroVendedor === 'todos') return vendas
    if (filtroVendedor === 'meu') return vendas.filter(v => v.criado_por === userId)
    return vendas.filter(v => v.criado_por === filtroVendedor)
  }, [vendas, userId, podeExcluirConcluida, filtroVendedor])

  // "Com o vendedor" = lancamento ainda na conta do criador da venda
  const isComigo = useCallback((venda: Venda) => {
    const lanc = lancMap[venda.id]
    if (!lanc) return true // sem lancamento = ainda com o vendedor
    if (!lanc.conta_id) return true
    // Para admin vendo todos: verifica se ainda está na conta do criador
    if (podeExcluirConcluida && filtroVendedor === 'todos') return true // simplificado: mostrar todos como "com você" quando visão geral
    return lanc.conta_id === meuContaId
  }, [lancMap, meuContaId, podeExcluirConcluida, filtroVendedor])

  const vendasFiltradas = useMemo(() => {
    let list = vendasVisiveis
    if (filtroAba === 'comigo') list = list.filter(v => isComigo(v))
    if (filtroAba === 'repassado') list = list.filter(v => !isComigo(v))
    return list.sort((a, b) => (b.entregue_em ?? b.created_at).localeCompare(a.entregue_em ?? a.created_at))
  }, [vendasVisiveis, filtroAba, isComigo])

  const totalVenda = (v: Venda) => {
    const sub = v.itens.reduce((s, it) => s + it.quantidade * it.preco_unit, 0)
    return sub * (1 - v.desconto_pct / 100)
  }

  // Totais
  const comigo = useMemo(() => vendasVisiveis.filter(v => isComigo(v)), [vendasVisiveis, isComigo])
  const repassados = useMemo(() => vendasVisiveis.filter(v => !isComigo(v)), [vendasVisiveis, isComigo])
  const calcTot = (list: Venda[]) => ({
    limpo: list.filter(v => v.tipo_dinheiro === 'limpo').reduce((s, v) => s + totalVenda(v), 0),
    sujo: list.filter(v => v.tipo_dinheiro === 'sujo').reduce((s, v) => s + totalVenda(v), 0),
  })
  const totComigo = calcTot(comigo)
  const totRepassado = calcTot(repassados)
  const totTudo = { limpo: totComigo.limpo + totRepassado.limpo, sujo: totComigo.sujo + totRepassado.sujo }

  // ── Mover lancamento entre contas ───────────────────────────────────────────

  async function moverLancamento(vendaId: string, newContaId: string) {
    const lanc = lancMap[vendaId]
    if (!lanc) { toast.error('Lançamento não encontrado'); return }
    const oldContaId = lanc.conta_id
    const sujo = lanc.tipo_dinheiro === 'sujo'
    const campo = sujo ? 'saldo_sujo' : 'saldo_limpo'
    const valor = lanc.valor

    const { error } = await sb().from('financeiro_lancamentos').update({ conta_id: newContaId }).eq('id', lanc.id)
    if (error) throw new Error(error.message)

    // Trigger financeiro_atualizar_saldo cuida do DB; apenas atualizar estado local
    setContas(prev => prev.map(c => {
      if (c.id === oldContaId) return { ...c, [campo]: Math.max(0, (c[campo] ?? 0) - valor) }
      if (c.id === newContaId) return { ...c, [campo]: (c[campo] ?? 0) + valor }
      return c
    }))
    setLancamentos(prev => prev.map(l => l.id === lanc.id ? { ...l, conta_id: newContaId } : l))
  }

  async function criarSolicitacaoTransfer(vendaId: string, contaDestinoId: string, contaDestinoNome?: string) {
    const lanc = lancMap[vendaId]
    if (!lanc) throw new Error('Lançamento não encontrado')
    const venda = vendas.find(v => v.id === vendaId)
    const nomeDestino = contaDestinoNome ?? contaMap[contaDestinoId]?.nome ?? 'conta'
    const { data, error } = await sb().from('sistema_solicitacoes').insert({
      tipo: 'transferencia_financeiro',
      referencia_id: lanc.id,
      referencia_tipo: 'financeiro_lancamento',
      descricao: `Repasse: ${venda?.cliente_nome ?? 'Venda'} → ${nomeDestino}`,
      solicitante_id: userId,
      solicitante_nome: userNome,
      dados: {
        lancamento_id: lanc.id,
        venda_id: vendaId,
        conta_origem_id: lanc.conta_id,
        conta_destino_id: contaDestinoId,
        valor: lanc.valor,
        tipo_dinheiro: lanc.tipo_dinheiro,
        descricao: venda ? `Venda: ${venda.cliente_nome}` : 'Venda',
      },
    }).select().single()
    if (error) throw new Error(error.message)
    return data
  }

  async function resolveContaDestino(value: string): Promise<{ id: string; nome: string; tipo: string }> {
    if (value.startsWith('new:')) {
      const membroId = value.slice(4)
      const membro = membrosSemConta.find(m => m.membroId === membroId)
      if (!membro) throw new Error('Membro não encontrado')
      const { data, error } = await sb().from('financeiro_contas').insert({
        nome: membro.nome, tipo: 'membro', membro_id: membroId,
        saldo_sujo: 0, saldo_limpo: 0, status: 'ativo',
      }).select().single()
      if (error) throw new Error(error.message)
      const nova = data as Conta
      setContas(prev => [...prev, nova])
      setMembrosSemConta(prev => prev.filter(m => m.membroId !== membroId))
      return { id: nova.id, nome: nova.nome, tipo: nova.tipo }
    }
    const conta = contaMap[value]
    if (!conta) throw new Error('Conta não encontrada')
    return { id: conta.id, nome: conta.nome, tipo: conta.tipo }
  }

  async function handleTransferirSingle(vendaId: string) {
    if (!destSingle) { toast.error('Escolha uma conta destino'); return }
    setSalvando(true)
    try {
      const { id: contaId, nome: contaNome, tipo: contaTipo } = await resolveContaDestino(destSingle)
      if (contaTipo === 'membro') {
        await criarSolicitacaoTransfer(vendaId, contaId, contaNome)
        toast.success(`Solicitação enviada para ${contaNome} — aguardando confirmação`)
      } else {
        await moverLancamento(vendaId, contaId)
        toast.success(`Transferido para ${contaNome}`)
      }
      setTransferindoVendaId(null); setDestSingle('')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro') }
    finally { setSalvando(false) }
  }

  async function handleTransferirTudo() {
    if (!destTudo) { toast.error('Escolha uma conta destino'); return }
    if (comigo.length === 0) { toast.info('Nenhuma venda com você'); return }
    setSalvando(true)
    try {
      const { id: contaId, nome: contaNome, tipo: contaTipo } = await resolveContaDestino(destTudo)
      if (contaTipo === 'membro') {
        for (const v of comigo) await criarSolicitacaoTransfer(v.id, contaId, contaNome)
        toast.success(`${comigo.length} solicitação(ões) enviada(s) — aguardando confirmação`)
      } else {
        for (const v of comigo) await moverLancamento(v.id, contaId)
        toast.success(`${comigo.length} venda(s) transferida(s) para ${contaNome}`)
      }
      setTransferTudoOpen(false); setDestTudo('')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro') }
    finally { setSalvando(false) }
  }

  async function handleTransferirSelecionados() {
    if (!destSelecionados || selecionados.size === 0) return
    setSalvando(true)
    try {
      const { id: contaId, nome: contaNome, tipo: contaTipo } = await resolveContaDestino(destSelecionados)
      let ok = 0
      for (const vendaId of selecionados) {
        try {
          if (!podeExcluirConcluida && contaTipo === 'membro') {
            await criarSolicitacaoTransfer(vendaId, contaId, contaNome)
          } else {
            await moverLancamento(vendaId, contaId)
          }
          ok++
        } catch { /* continua com o próximo */ }
      }
      const solicitou = !podeExcluirConcluida && contaTipo === 'membro'
      toast.success(solicitou ? `${ok} solicitação(ões) enviada(s)` : `${ok} venda(s) transferida(s) para ${contaNome}`)
      setSelecionados(new Set())
      setTransferSelecionadosOpen(false)
      setDestSelecionados('')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro') }
    finally { setSalvando(false) }
  }

  async function handleAceitarTransfer(sol: TransferPendente) {
    if (!sol.dados) return
    setAceitando(sol.id)
    try {
      const { lancamento_id, conta_origem_id, conta_destino_id, valor, tipo_dinheiro } = sol.dados
      const sujo = tipo_dinheiro === 'sujo'
      const campo = sujo ? 'saldo_sujo' : 'saldo_limpo'

      // Move o lancamento; trigger financeiro_atualizar_saldo cuida do saldo no DB
      const { error: errLanc } = await sb().from('financeiro_lancamentos').update({ conta_id: conta_destino_id }).eq('id', lancamento_id)
      if (errLanc) throw new Error(errLanc.message)

      // Atualiza estado local
      setContas(prev => prev.map(c => {
        if (c.id === conta_origem_id) return { ...c, [campo]: Math.max(0, (c[campo] ?? 0) - valor) }
        if (c.id === conta_destino_id) return { ...c, [campo]: (c[campo] ?? 0) + valor }
        return c
      }))
      // Atualiza lancamento local
      setLancamentos(prev => prev.map(l => l.id === lancamento_id ? { ...l, conta_id: conta_destino_id } : l))

      // Marca solicitação como aprovada
      await sb().from('sistema_solicitacoes').update({
        status: 'aprovado', aprovador_id: userId, aprovador_nome: userNome, resolved_at: new Date().toISOString(),
      }).eq('id', sol.id)

      setTransferPendentes(prev => prev.filter(s => s.id !== sol.id))
      toast.success('Transferência aceita!')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro') }
    finally { setAceitando(null) }
  }

  async function handleRejeitarTransfer(solId: string) {
    setAceitando(solId)
    try {
      await sb().from('sistema_solicitacoes').update({
        status: 'rejeitado', aprovador_id: userId, aprovador_nome: userNome, resolved_at: new Date().toISOString(),
      }).eq('id', solId)
      setTransferPendentes(prev => prev.filter(s => s.id !== solId))
      toast.success('Transferência recusada')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro') }
    finally { setAceitando(null) }
  }

  // ── Delete ───────────────────────────────────────────────────────────────────

  async function handleDelete(vendaId: string) {
    setDeletando(true)
    try {
      // Remover lancamentos; trigger financeiro_atualizar_saldo reverte saldo no DB
      const { data: lancs } = await sb().from('financeiro_lancamentos')
        .select('id, conta_id, valor, tipo_dinheiro').eq('venda_id', vendaId)
      for (const lanc of (lancs ?? []) as { id: string; conta_id: string | null; valor: number; tipo_dinheiro: string | null }[]) {
        await sb().from('financeiro_lancamentos').delete().eq('id', lanc.id)
        if (lanc.conta_id) {
          const campo = lanc.tipo_dinheiro === 'sujo' ? 'saldo_sujo' : 'saldo_limpo'
          setContas(prev => prev.map(ct => ct.id === lanc.conta_id ? { ...ct, [campo]: Math.max(0, (ct[campo as keyof Conta] as number ?? 0) - lanc.valor) } : ct))
        }
      }
      // Remover a venda
      const { error } = await sb().from('vendas').delete().eq('id', vendaId)
      if (error) { toast.error('Erro ao excluir venda'); return }
      setVendas(prev => prev.filter(v => v.id !== vendaId))
      setLancamentos(prev => prev.filter(l => l.venda_id !== vendaId))
      toast.success('Venda excluída do sistema')
    } catch { toast.error('Erro ao excluir') }
    finally { setDeletando(false); setDeleteConfirmId(null) }
  }

  async function handleSolicitarExclusaoCarteira(vendaId: string, motivo: string) {
    const venda = vendas.find(v => v.id === vendaId)
    setSolicitandoExclusao(true)
    try {
      await sb().from('vendas').update({
        cancelamento_solicitado: true,
        cancelamento_motivo: motivo || 'Solicitado pelo vendedor via Carteira',
        cancelamento_solicitado_por: userId,
      }).eq('id', vendaId)
      await sb().from('sistema_solicitacoes').insert({
        tipo: 'cancelamento_venda',
        referencia_id: vendaId,
        referencia_tipo: 'venda',
        descricao: `Exclusão carteira: ${venda?.cliente_nome ?? 'Venda'}`,
        solicitante_id: userId,
        solicitante_nome: userNome,
        dados: { cliente_nome: venda?.cliente_nome, motivo: motivo || 'Solicitado pelo vendedor via Carteira' },
      })
      setVendas(prev => prev.map(v => v.id === vendaId
        ? { ...v, cancelamento_solicitado: true, cancelamento_motivo: motivo || 'Solicitado pelo vendedor via Carteira' } : v))
      toast.success('Solicitação enviada para aprovação dos donos')
      setSolicitarExclusaoId(null)
      setMotivoExclusaoCart('')
    } catch { toast.error('Erro ao solicitar') }
    finally { setSolicitandoExclusao(false) }
  }

  const contasAtivas = useMemo(() => contas.filter(c => c.status === 'ativo'), [contas])
  const minhaConta = meuContaId ? contaMap[meuContaId] : null
  const minhaConta_mias = minhaConta ? [minhaConta] : []
  void minhaConta_mias

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* ── Transferências pendentes para mim ── */}
        {transferPendentes.length > 0 && (
          <div className="rounded-lg border border-primary/30 bg-primary/[0.03] p-4 space-y-2">
            <p className="text-xs font-semibold flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-primary" />
              Transferências aguardando sua confirmação ({transferPendentes.length})
            </p>
            {transferPendentes.map(sol => (
              <div key={sol.id} className="flex items-center gap-3 bg-card rounded-lg border border-border px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{sol.dados?.descricao ?? sol.descricao ?? '—'}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    De: <span className="text-foreground/70">{sol.solicitante_nome ?? '—'}</span>
                    {sol.dados && (
                      <span className={cn('ml-2 font-medium',
                        sol.dados.tipo_dinheiro === 'sujo' ? 'text-orange-400' : 'text-emerald-400'
                      )}>
                        R$ {Math.abs(sol.dados.valor).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                        {' '}{sol.dados.tipo_dinheiro === 'sujo' ? '(sujo)' : '(limpo)'}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button size="sm" variant="outline" className="h-7 text-[11px] px-2 text-red-400 border-red-500/30"
                    disabled={aceitando === sol.id}
                    onClick={() => handleRejeitarTransfer(sol.id)}>
                    {aceitando === sol.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Recusar'}
                  </Button>
                  <Button size="sm" className="h-7 text-[11px] px-2 gap-1"
                    disabled={aceitando === sol.id}
                    onClick={() => handleAceitarTransfer(sol)}>
                    {aceitando === sol.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Check className="h-3 w-3" />Aceitar</>}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Total vendido</p>
            <p className="text-base font-bold tabular-nums text-primary">{fmt(totTudo.limpo + totTudo.sujo)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              <span className="text-emerald-400">L {fmt(totTudo.limpo)}</span>
              {' · '}
              <span className="text-orange-400">S {fmt(totTudo.sujo)}</span>
            </p>
          </div>
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.03] px-4 py-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Já repassado</p>
            <p className="text-base font-bold tabular-nums text-emerald-400">{fmt(totRepassado.limpo + totRepassado.sujo)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{repassados.length} venda(s)</p>
          </div>
          <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/[0.03] px-4 py-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Com você</p>
            <p className="text-base font-bold tabular-nums text-yellow-400">{fmt(totComigo.limpo + totComigo.sujo)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{comigo.length} venda(s)</p>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Total vendas</p>
            <p className="text-base font-bold tabular-nums">{vendasVisiveis.length}</p>
          </div>
        </div>

        {/* ── Filtro vendedores (admin) ── */}
        {podeExcluirConcluida && (
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground shrink-0">Carteira de:</span>
            <Select value={filtroVendedor} onValueChange={setFiltroVendedor}>
              <SelectTrigger className="h-8 text-xs w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="meu">Só a minha</SelectItem>
                <SelectItem value="todos">Todos os vendedores</SelectItem>
                {vendedores.filter(v => v.id !== userId).map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* ── Ações em massa ── */}
        {filtroVendedor !== 'todos' && (
          <div className="flex flex-wrap items-center gap-2">
            {transferTudoOpen ? (
              <div className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/20">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Transferir {comigo.length} venda(s) para:</span>
                <Select value={destTudo || 'sem'} onValueChange={v => setDestTudo(v === 'sem' ? '' : v)}>
                  <SelectTrigger className="h-7 text-xs w-40"><SelectValue placeholder="Conta..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sem">Selecione a conta...</SelectItem>
                    {contasAtivas.filter(c => c.id !== meuContaId).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                    {membrosSemConta.map(m => (
                      <SelectItem key={`new:${m.membroId}`} value={`new:${m.membroId}`}>{m.nome} (nova conta)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" className="h-7 text-xs" disabled={!destTudo || salvando} onClick={handleTransferirTudo}>
                  {salvando ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Confirmar'}
                </Button>
                <button onClick={() => { setTransferTudoOpen(false); setDestTudo('') }} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setTransferTudoOpen(true)} disabled={comigo.length === 0}>
                <ArrowRightLeft className="h-3.5 w-3.5" />
                Transferir tudo ({comigo.length})
              </Button>
            )}
          </div>
        )}

        {/* ── Transferir selecionados ── */}
        {selecionados.size > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {transferSelecionadosOpen ? (
              <div className="flex items-center gap-2 p-2 rounded-lg border border-primary/30 bg-primary/[0.03]">
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  Transferir {selecionados.size} selecionada(s) para:
                </span>
                <Select value={destSelecionados || 'sem'} onValueChange={v => setDestSelecionados(v === 'sem' ? '' : v)}>
                  <SelectTrigger className="h-7 text-xs w-40"><SelectValue placeholder="Conta..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sem">Selecione a conta...</SelectItem>
                    {contasAtivas.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                    {membrosSemConta.map(m => (
                      <SelectItem key={`new:${m.membroId}`} value={`new:${m.membroId}`}>{m.nome} (nova conta)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" className="h-7 text-xs" disabled={!destSelecionados || salvando} onClick={handleTransferirSelecionados}>
                  {salvando ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Confirmar'}
                </Button>
                <button onClick={() => { setTransferSelecionadosOpen(false); setDestSelecionados('') }} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-primary/30 text-primary/80" onClick={() => setTransferSelecionadosOpen(true)}>
                <ArrowRightLeft className="h-3.5 w-3.5" />
                Transferir selecionados ({selecionados.size})
              </Button>
            )}
            <button onClick={() => setSelecionados(new Set())} className="text-xs text-muted-foreground hover:text-foreground">
              Limpar seleção
            </button>
          </div>
        )}

        {/* ── Filtro aba ── */}
        <div className="flex gap-0.5 border-b border-border">
          {([
            ['todos', 'Todas', vendasVisiveis.length],
            ['comigo', 'Com você', comigo.length],
            ['repassado', 'Repassadas', repassados.length],
          ] as const).map(([key, label, count]) => (
            <button key={key} onClick={() => setFiltroAba(key)}
              className={cn('px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                filtroAba === key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
              )}>
              {label}
              <span className="ml-1.5 text-[10px] opacity-60">({count})</span>
            </button>
          ))}
        </div>

        {/* ── Tabela ── */}
        {vendasFiltradas.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center">
            <Wallet className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma venda encontrada</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 border-b border-border sticky top-0">
                <tr>
                  <th className="px-2 py-2 w-8">
                    <input type="checkbox"
                      className="rounded border-border cursor-pointer"
                      checked={vendasFiltradas.length > 0 && vendasFiltradas.every(v => selecionados.has(v.id))}
                      onChange={e => {
                        if (e.target.checked) setSelecionados(new Set(vendasFiltradas.map(v => v.id)))
                        else setSelecionados(new Set())
                      }}
                    />
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground w-20">Data</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Cliente</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground w-14">$</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground w-24">Valor</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground w-28">Criado por</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground w-28">Entregue por</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground w-32">Repassado para</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground w-24">Itens</th>
                  <th className="px-3 py-2 w-52"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {vendasFiltradas.map(venda => {
                  const lanc = lancMap[venda.id]
                  const conta = lanc?.conta_id ? contaMap[lanc.conta_id] : null
                  const valor = totalVenda(venda)
                  const eComigo = isComigo(venda)
                  const isTransferindo = transferindoVendaId === venda.id
                  const contaAtualId = lanc?.conta_id ?? null
                  const expanded = expandedRows.has(venda.id)
                  const colSpan = 10
                  const isSelecionado = selecionados.has(venda.id)

                  return (
                    <React.Fragment key={venda.id}>
                      <tr onClick={() => !isTransferindo && toggleRow(venda.id)} className={cn(
                        'transition-colors cursor-pointer',
                        isTransferindo ? 'bg-primary/[0.03]' : 'hover:bg-white/[0.02]',
                        isSelecionado && 'bg-primary/[0.04]',
                        venda.cancelamento_solicitado && 'bg-orange-500/[0.03]'
                      )}>
                        <td className="px-2 py-2.5" onClick={e => e.stopPropagation()}>
                          <input type="checkbox"
                            className="rounded border-border cursor-pointer"
                            checked={isSelecionado}
                            onChange={e => {
                              setSelecionados(prev => {
                                const n = new Set(prev)
                                e.target.checked ? n.add(venda.id) : n.delete(venda.id)
                                return n
                              })
                            }}
                          />
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground tabular-nums whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            {expanded
                              ? <ChevronDown className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                              : <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />}
                            {fmtData(venda.entregue_em ?? venda.created_at)}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 font-medium max-w-[160px]">
                          <span className="truncate block">{venda.cliente_nome}</span>
                          {venda.cancelamento_solicitado && (
                            <span className="text-[10px] text-orange-400" title={venda.cancelamento_motivo ?? ''}>⚠ Canc. solicitado</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded',
                            venda.tipo_dinheiro === 'sujo'
                              ? 'bg-orange-500/15 text-orange-400'
                              : 'bg-emerald-500/15 text-emerald-400'
                          )}>
                            {venda.tipo_dinheiro === 'sujo' ? 'S' : 'L'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-medium text-primary">
                          {fmt(valor)}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground text-[11px] truncate max-w-[112px]">
                          {venda.criado_por_nome ?? '—'}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground text-[11px] truncate max-w-[112px]">
                          {venda.entregue_por_nome ?? '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          {conta ? (
                            <span className="flex items-center gap-1 text-emerald-400 text-[10px] font-medium">
                              <CheckCircle2 className="h-3 w-3 shrink-0" />
                              <span className="truncate">{conta.nome}</span>
                            </span>
                          ) : eComigo ? (
                            <span className="flex items-center gap-1 text-yellow-400 text-[10px] font-medium">
                              <TrendingUp className="h-3 w-3" /><span>Com você</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground text-[10px] max-w-[160px]">
                          {venda.itens.length > 0
                            ? <span className="opacity-60 truncate block leading-4">{venda.itens.map(it => `${it.item_nome} (${it.quantidade})`).join(' · ')}</span>
                            : <span className="italic opacity-30">—</span>}
                        </td>
                        <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5 justify-end">
                            {isTransferindo ? (
                              <>
                                <Select value={destSingle || 'sem'} onValueChange={v => setDestSingle(v === 'sem' ? '' : v)}>
                                  <SelectTrigger className="h-7 text-xs w-36">
                                    <SelectValue placeholder="Conta destino..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="sem">Selecione...</SelectItem>
                                    {contasAtivas.filter(c => c.id !== contaAtualId).map(c => (
                                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                                    ))}
                                    {membrosSemConta.map(m => (
                                      <SelectItem key={`new:${m.membroId}`} value={`new:${m.membroId}`}>{m.nome} (nova conta)</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button size="sm" className="h-7 text-xs px-2.5"
                                  disabled={!destSingle || salvando}
                                  onClick={() => handleTransferirSingle(venda.id)}>
                                  {salvando ? <Loader2 className="h-3 w-3 animate-spin" /> : 'OK'}
                                </Button>
                                <button onClick={() => { setTransferindoVendaId(null); setDestSingle('') }}
                                  className="text-xs text-muted-foreground hover:text-foreground px-1">✕</button>
                              </>
                            ) : solicitarExclusaoId === venda.id ? (
                              <>
                                <input
                                  type="text"
                                  placeholder="Motivo (opcional)..."
                                  value={motivoExclusaoCart}
                                  onChange={e => setMotivoExclusaoCart(e.target.value)}
                                  className="h-7 text-xs rounded-md border border-input bg-background px-2 text-foreground w-36 min-w-0"
                                  autoFocus
                                />
                                <Button size="sm" className="h-7 text-xs px-2.5 bg-orange-500/80 hover:bg-orange-500 text-white border-0"
                                  disabled={solicitandoExclusao}
                                  onClick={() => handleSolicitarExclusaoCarteira(venda.id, motivoExclusaoCart)}>
                                  {solicitandoExclusao ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Solicitar'}
                                </Button>
                                <button onClick={() => { setSolicitarExclusaoId(null); setMotivoExclusaoCart('') }}
                                  className="text-xs text-muted-foreground hover:text-foreground px-1">✕</button>
                              </>
                            ) : (
                              <>
                                {lanc && (
                                  <button onClick={() => { setTransferindoVendaId(venda.id); setDestSingle('') }}
                                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors">
                                    <ArrowRightLeft className="h-3 w-3" />
                                    Transferir
                                  </button>
                                )}
                                {/* Solicitar exclusão (usuário comum, própria venda, sem solicitação pendente) */}
                                {!podeExcluirConcluida && venda.criado_por === userId && !venda.cancelamento_solicitado && (
                                  <button onClick={() => setSolicitarExclusaoId(venda.id)}
                                    className="p-1 rounded hover:bg-red-500/10 text-muted-foreground/40 hover:text-red-400 transition-colors"
                                    title="Solicitar exclusão desta venda">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                {!podeExcluirConcluida && venda.cancelamento_solicitado && (
                                  <span className="text-[10px] text-orange-400 font-medium" title={venda.cancelamento_motivo ?? ''}>
                                    Exclusão solicitada
                                  </span>
                                )}
                                {podeExcluirConcluida && (
                                  <button onClick={() => setDeleteConfirmId(venda.id)}
                                    className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expanded && venda.itens.length > 0 && (
                        <tr className="bg-muted/10">
                          <td colSpan={colSpan} className="px-6 py-2.5">
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-1">
                              {venda.itens.map(it => (
                                <div key={it.id} className="flex items-baseline justify-between gap-2 text-[11px]">
                                  <span className="text-muted-foreground truncate">{it.item_nome}</span>
                                  <span className="text-foreground tabular-nums shrink-0">
                                    {it.quantidade}× {fmt(it.preco_unit)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirm delete */}
      <Dialog open={!!deleteConfirmId} onOpenChange={o => { if (!o && !deletando) setDeleteConfirmId(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Excluir venda do sistema?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remove a venda e todos os lançamentos financeiros vinculados, revertendo os saldos. Não pode ser desfeita.
          </p>
          {(() => {
            const v = vendas.find(x => x.id === deleteConfirmId)
            return v?.cancelamento_solicitado ? (
              <p className="text-xs text-orange-400 bg-orange-500/10 rounded p-2">
                Motivo do cancelamento: {v.cancelamento_motivo}
              </p>
            ) : null
          })()}
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirmId(null)} disabled={deletando}>Cancelar</Button>
            <Button variant="destructive" size="sm" disabled={deletando}
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}>
              {deletando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Excluir tudo'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

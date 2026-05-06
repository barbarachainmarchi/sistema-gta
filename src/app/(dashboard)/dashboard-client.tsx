'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  TrendingUp, CheckCircle2, Clock, XCircle, Wallet, ShoppingCart,
  CalendarCheck, Target, ArrowRight, DollarSign, Users, AlertCircle,
  Zap, Check, X, Plus,
} from 'lucide-react'

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Conta = { id: string; saldo_sujo: number; saldo_limpo: number }

type PresencaHoje = { id: string; presente: boolean; motivo: string | null }

type MetaMembroItem = {
  id: string; item_nome: string
  quantidade_meta: number; quantidade_entregue: number
  tipo_dinheiro: 'limpo' | 'sujo' | null; ordem: number
}

type MetaMembro = {
  id: string; status: string
  observacao: string | null
  metas_membros_itens: MetaMembroItem[]
}

type MetaAtual = {
  id: string; titulo: string
  semana_inicio: string; semana_fim: string
  metas_membros: MetaMembro[]
}

type Venda = { id: string; status: string; created_at: string }

type Disponibilidade = { id: string; disponivel: boolean; observacao: string | null; hora_inicio: string | null; hora_fim: string | null }
type DispMembro = { nome: string; hora_inicio: string | null; hora_fim: string | null }

type EscalacaoPendente = {
  id: string; tipo_nome: string | null; data_hora_prevista: string; modo: string; observacoes: string | null
}
type MinhaParticipacao = { id: string; escalacao_id: string; status: string }

interface Props {
  userId: string
  userNome: string | null
  lojaNome: string | null
  faccaoNome: string | null
  conta: Conta | null
  metaAtual: MetaAtual | null
  vendasSemana: Venda[]
  disponibilidade: Disponibilidade | null
  hoje: string
  dispTodos: DispMembro[]
  cotacoesAbertas: number
  encomendasAbertas: number
  membroId: string | null
  escalacoesPendentes: EscalacaoPendente[]
  minhasParticipacoes: MinhaParticipacao[]
  presencaHoje: PresencaHoje | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  em_andamento: { label: 'Em andamento', icon: Clock,        cls: 'text-blue-400' },
  completo:     { label: 'Completo',     icon: CheckCircle2, cls: 'text-emerald-400' },
  incompleto:   { label: 'Incompleto',   icon: XCircle,      cls: 'text-red-400' },
  justificado:  { label: 'Justificado',  icon: CheckCircle2, cls: 'text-amber-400' },
}

function fmtMoeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtSemana(inicio: string, fim: string) {
  const fmt = (d: string) => { const [, m, dia] = d.split('-'); return `${dia}/${m}` }
  return `${fmt(inicio)} – ${fmt(fim)}`
}

function fmtEscalacao(iso: string) {
  const d = new Date(iso)
  const hoje = new Date()
  const amanha = new Date(hoje); amanha.setDate(hoje.getDate() + 1)
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === hoje.toDateString()) return `Hoje às ${hora}`
  if (d.toDateString() === amanha.toDateString()) return `Amanhã às ${hora}`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ` às ${hora}`
}

function saudacao(nome: string | null) {
  const h = new Date().getHours()
  const parte = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
  return nome ? `${parte}, ${nome.split(' ')[0]}` : parte
}

// ── Componente ────────────────────────────────────────────────────────────────

export function DashboardClient({
  userId, userNome, lojaNome, faccaoNome, conta, metaAtual, vendasSemana,
  disponibilidade: dispInicial, hoje, dispTodos, cotacoesAbertas, encomendasAbertas,
  membroId, escalacoesPendentes: escalacoesPendentesIniciais, minhasParticipacoes: minhasParticipacoesPendentes,
  presencaHoje: presencaHojeInicial,
}: Props) {
  const sb = useCallback(() => createClient(), [])

  const [disp, setDisp]             = useState<Disponibilidade | null>(dispInicial)
  const [salvandoDisp, setSalvandoDisp] = useState(false)
  const [modalHorario, setModalHorario] = useState(false)
  const [horaInicio, setHoraInicio] = useState('')
  const [horaFim, setHoraFim]       = useState('')

  const [presenca, setPresenca]       = useState<PresencaHoje | null>(presencaHojeInicial)
  const [modalAusencia, setModalAusencia] = useState(false)
  const [textoMotivo, setTextoMotivo] = useState('')
  const [salvandoPresenca, setSalvandoPresenca] = useState(false)

  const [escalacoes, setEscalacoes] = useState<EscalacaoPendente[]>(escalacoesPendentesIniciais)
  const [minhasParticipacoes, setMinhasParticipacoes] = useState<MinhaParticipacao[]>(minhasParticipacoesPendentes)
  const [respondendo, setRespondendo] = useState<string | null>(null)

  const minhaEntradaMeta = metaAtual?.metas_membros[0] ?? null

  const progresso = (() => {
    if (!minhaEntradaMeta) return 0
    const itens = minhaEntradaMeta.metas_membros_itens
    if (!itens.length) return 0
    const total = itens.reduce((s, it) => s + Math.min(it.quantidade_entregue / (it.quantidade_meta || 1), 1), 0)
    return Math.round((total / itens.length) * 100)
  })()

  const vendasCount     = vendasSemana.length
  const vendasEntregues = vendasSemana.filter(v => v.status === 'entregue').length

  async function salvarDisponivel(valor: boolean, hora_inicio: string | null, hora_fim: string | null) {
    setSalvandoDisp(true)
    try {
      const payload = { disponivel: valor, hora_inicio: hora_inicio || null, hora_fim: hora_fim || null }
      if (disp) {
        const { error } = await sb()
          .from('usuarios_disponibilidade')
          .update(payload)
          .eq('id', disp.id)
        if (error) { toast.error(error.message); return }
        setDisp(prev => prev ? { ...prev, ...payload } : prev)
      } else {
        const { data, error } = await sb()
          .from('usuarios_disponibilidade')
          .insert({ usuario_id: userId, data: hoje, ...payload })
          .select('id, disponivel, observacao, hora_inicio, hora_fim')
          .single()
        if (error) { toast.error(error.message); return }
        setDisp(data)
      }
    } finally { setSalvandoDisp(false) }
  }

  function handleClickSim() {
    if (presenca?.presente === true && disp?.disponivel === true) return
    setHoraInicio(disp?.hora_inicio ?? '')
    setHoraFim(disp?.hora_fim ?? '')
    setModalHorario(true)
  }

  function handleClickNao() {
    if (presenca?.presente === false && disp?.disponivel === false) return
    setTextoMotivo(presenca?.motivo ?? '')
    setModalAusencia(true)
  }

  async function confirmarHorario() {
    setModalHorario(false)
    if (membroId) {
      setSalvandoPresenca(true)
      try {
        if (presenca) {
          const { data: row, error } = await sb().from('presencas')
            .update({ presente: true, motivo: null, registrado_por_user_id: userId })
            .eq('id', presenca.id).select('id, presente, motivo').single()
          if (!error && row) setPresenca(row as PresencaHoje)
        } else {
          const { data: row, error } = await sb().from('presencas')
            .insert({ membro_id: membroId, data: hoje, presente: true, motivo: null, registrado_por_user_id: userId })
            .select('id, presente, motivo').single()
          if (!error && row) setPresenca(row as PresencaHoje)
        }
      } finally { setSalvandoPresenca(false) }
    }
    await salvarDisponivel(true, horaInicio, horaFim)
  }

  async function confirmarAusencia() {
    setModalAusencia(false)
    if (membroId) {
      setSalvandoPresenca(true)
      try {
        const motivo = textoMotivo.trim() || null
        if (presenca) {
          const { data: row, error } = await sb().from('presencas')
            .update({ presente: false, motivo, registrado_por_user_id: userId })
            .eq('id', presenca.id).select('id, presente, motivo').single()
          if (!error && row) setPresenca(row as PresencaHoje)
        } else {
          const { data: row, error } = await sb().from('presencas')
            .insert({ membro_id: membroId, data: hoje, presente: false, motivo, registrado_por_user_id: userId })
            .select('id, presente, motivo').single()
          if (!error && row) setPresenca(row as PresencaHoje)
        }
      } finally { setSalvandoPresenca(false) }
    }
    await salvarDisponivel(false, null, null)
  }

  const statusCfg = STATUS_META[minhaEntradaMeta?.status ?? 'em_andamento']

  // Escalações
  const partMap = Object.fromEntries(minhasParticipacoes.map(p => [p.escalacao_id, p]))
  const convocadas  = escalacoes.filter(e => partMap[e.id]?.status === 'convocado')
  const confirmadas = escalacoes.filter(e => partMap[e.id]?.status === 'confirmado')
  const reservas    = escalacoes.filter(e => partMap[e.id]?.status === 'reserva')
  const abertas     = escalacoes.filter(e => e.modo === 'aberta' && !partMap[e.id])

  async function handleResponder(partId: string, escalacaoId: string, status: 'confirmado' | 'recusado') {
    setRespondendo(partId)
    try {
      const { error } = await sb().from('escalacao_participantes').update({ status }).eq('id', partId)
      if (error) { toast.error(error.message); return }
      setMinhasParticipacoes(prev => prev.map(p => p.id === partId ? { ...p, status } : p))
      toast.success(status === 'confirmado' ? 'Presença confirmada!' : 'Convocação recusada')
    } catch { toast.error('Erro ao responder') }
    finally { setRespondendo(null) }
  }

  async function handleCandidatar(escalacaoId: string) {
    if (!membroId) return
    setRespondendo(escalacaoId)
    try {
      const { data, error } = await sb().from('escalacao_participantes').insert({
        escalacao_id: escalacaoId,
        membro_id: membroId,
        membro_nome: userNome ?? 'Desconhecido',
        status: 'candidato',
      }).select('id, escalacao_id, status').single()
      if (error) { toast.error(error.message); return }
      setMinhasParticipacoes(prev => [...prev, data as MinhaParticipacao])
      toast.success('Candidatura enviada!')
    } catch { toast.error('Erro ao se candidatar') }
    finally { setRespondendo(null) }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-5xl">

      {/* Saudação */}
      <div>
        <h2 className="text-lg font-semibold">{saudacao(userNome)}</h2>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <p className="text-xs text-muted-foreground">Aqui está o seu resumo da semana.</p>
          {lojaNome && (
            <span className="text-[11px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20">
              {lojaNome}
            </span>
          )}
          {faccaoNome && (
            <span className="text-[11px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-full border border-purple-500/20">
              {faccaoNome}
            </span>
          )}
        </div>
      </div>

      {/* Alertas */}
      {(cotacoesAbertas > 0 || encomendasAbertas > 0) && (
        <div className="space-y-2">
          {cotacoesAbertas > 0 && (
            <Link href="/ferramentas/cotacao"
              className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 hover:bg-amber-500/10 transition-colors">
              <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
              <p className="text-sm text-amber-300 flex-1">
                {cotacoesAbertas === 1
                  ? '1 cotação em aberto'
                  : `${cotacoesAbertas} cotações em aberto`}
              </p>
              <ArrowRight className="h-3.5 w-3.5 text-amber-400/60 shrink-0" />
            </Link>
          )}
          {encomendasAbertas > 0 && (
            <Link href="/encomendas"
              className="flex items-center gap-3 rounded-lg border border-sky-500/30 bg-sky-500/[0.06] px-4 py-3 hover:bg-sky-500/10 transition-colors">
              <AlertCircle className="h-4 w-4 text-sky-400 shrink-0" />
              <p className="text-sm text-sky-300 flex-1">
                {encomendasAbertas === 1
                  ? '1 encomenda em aberto'
                  : `${encomendasAbertas} encomendas em aberto`}
              </p>
              <ArrowRight className="h-3.5 w-3.5 text-sky-400/60 shrink-0" />
            </Link>
          )}
        </div>
      )}

      {/* Escalações pendentes */}
      {membroId && (convocadas.length > 0 || abertas.length > 0 || confirmadas.length > 0 || reservas.length > 0) && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/20">
            <Zap className="h-3.5 w-3.5 text-primary shrink-0" />
            <p className="text-xs font-semibold text-foreground">Escalações</p>
            <Link href="/acao" className="ml-auto text-[11px] text-primary hover:underline flex items-center gap-0.5">
              Ver todas <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-border/40">
            {convocadas.map(esc => {
              const part = partMap[esc.id]!
              const isLoading = respondendo === part.id
              return (
                <div key={esc.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{esc.tipo_nome ?? 'Escalação'}</p>
                    <p className="text-[11px] text-muted-foreground">{fmtEscalacao(esc.data_hora_prevista)}</p>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 shrink-0">Convocado</span>
                  <div className="flex gap-1.5 shrink-0">
                    <button disabled={isLoading}
                      onClick={() => handleResponder(part.id, esc.id, 'recusado')}
                      className="h-7 px-2 rounded border border-red-500/30 text-red-400 text-xs hover:bg-red-500/10 transition-colors disabled:opacity-50 flex items-center gap-1">
                      {isLoading ? <Clock className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                      Recusar
                    </button>
                    <button disabled={isLoading}
                      onClick={() => handleResponder(part.id, esc.id, 'confirmado')}
                      className="h-7 px-2 rounded bg-primary text-primary-foreground text-xs hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1">
                      {isLoading ? <Clock className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                      Confirmar
                    </button>
                  </div>
                </div>
              )
            })}
            {confirmadas.map(esc => (
              <div key={esc.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{esc.tipo_nome ?? 'Escalação'}</p>
                  <p className="text-[11px] text-muted-foreground">{fmtEscalacao(esc.data_hora_prevista)}</p>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 shrink-0">Confirmado</span>
              </div>
            ))}
            {reservas.map(esc => (
              <div key={esc.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{esc.tipo_nome ?? 'Escalação'}</p>
                  <p className="text-[11px] text-muted-foreground">{fmtEscalacao(esc.data_hora_prevista)}</p>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 shrink-0">Reserva</span>
                <span className="text-[11px] text-muted-foreground/60 shrink-0">Aguardando vaga</span>
              </div>
            ))}
            {abertas.map(esc => {
              const isLoading = respondendo === esc.id
              const jaCandidatou = !!partMap[esc.id]
              return (
                <div key={esc.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{esc.tipo_nome ?? 'Escalação'}</p>
                    <p className="text-[11px] text-muted-foreground">{fmtEscalacao(esc.data_hora_prevista)}</p>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 shrink-0">Aberta</span>
                  {jaCandidatou ? (
                    <span className="text-[11px] text-muted-foreground shrink-0">Candidatura enviada</span>
                  ) : (
                    <button disabled={isLoading}
                      onClick={() => handleCandidatar(esc.id)}
                      className="h-7 px-2.5 rounded border border-purple-500/30 text-purple-400 text-xs hover:bg-purple-500/10 transition-colors disabled:opacity-50 flex items-center gap-1 shrink-0">
                      {isLoading ? <Clock className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                      Participar
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Cards principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Meta */}
        <Link href="/metas" className="rounded-xl border border-border bg-card p-4 space-y-3 hover:border-border/60 transition-colors group block">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-medium">Meta da Semana</p>
            <Target className="h-4 w-4 text-muted-foreground" />
          </div>
          {metaAtual && minhaEntradaMeta ? (
            <>
              <div>
                <p className="text-2xl font-bold">{progresso}%</p>
                <p className="text-[11px] text-muted-foreground">{fmtSemana(metaAtual.semana_inicio, metaAtual.semana_fim)}</p>
              </div>
              <div className="space-y-1">
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', progresso >= 100 ? 'bg-emerald-500' : 'bg-primary/70')}
                    style={{ width: `${progresso}%` }}
                  />
                </div>
                <div className="flex items-center gap-1">
                  <statusCfg.icon className={cn('h-3 w-3', statusCfg.cls)} />
                  <span className={cn('text-[11px]', statusCfg.cls)}>{statusCfg.label}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Sem meta ativa</p>
              <p className="text-[11px] text-primary flex items-center gap-1 group-hover:underline">
                Criar meta <ArrowRight className="h-3 w-3" />
              </p>
            </div>
          )}
        </Link>

        {/* Saldo Sujo */}
        <Link href="/vendas/minha-carteira" className="rounded-xl border border-border bg-card p-4 space-y-3 hover:border-border/60 transition-colors block">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-medium">Saldo Sujo</p>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </div>
          {conta ? (
            <>
              <p className="text-2xl font-bold">{fmtMoeda(conta.saldo_sujo)}</p>
              <p className="text-[11px] text-muted-foreground">na sua carteira</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Sem conta vinculada</p>
          )}
        </Link>

        {/* Saldo Limpo */}
        <Link href="/vendas/minha-carteira" className="rounded-xl border border-border bg-card p-4 space-y-3 hover:border-border/60 transition-colors block">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-medium">Saldo Limpo</p>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </div>
          {conta ? (
            <>
              <p className="text-2xl font-bold">{fmtMoeda(conta.saldo_limpo)}</p>
              <p className="text-[11px] text-muted-foreground">na sua carteira</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Sem conta vinculada</p>
          )}
        </Link>

        {/* Vendas da semana */}
        <Link href="/vendas" className="rounded-xl border border-border bg-card p-4 space-y-3 hover:border-border/60 transition-colors block">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-medium">Vendas Esta Semana</p>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold">{vendasCount}</p>
          <p className="text-[11px] text-muted-foreground">
            {vendasEntregues > 0
              ? `${vendasEntregues} entregue${vendasEntregues !== 1 ? 's' : ''}`
              : 'nenhuma entregue ainda'}
          </p>
        </Link>
      </div>

      {/* Detalhes da meta */}
      {metaAtual && minhaEntradaMeta && minhaEntradaMeta.metas_membros_itens.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">ITENS DA META</p>
            <Link href="/metas" className="text-[11px] text-primary hover:underline flex items-center gap-1">
              Ver metas <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2.5">
            {[...minhaEntradaMeta.metas_membros_itens]
              .sort((a, b) => a.ordem - b.ordem)
              .map(it => {
                const pct = it.quantidade_meta > 0
                  ? Math.min(Math.round((it.quantidade_entregue / it.quantidade_meta) * 100), 100)
                  : 0
                return (
                  <div key={it.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span>{it.item_nome}{it.tipo_dinheiro ? ` (${it.tipo_dinheiro})` : ''}</span>
                      <span className="text-muted-foreground">{it.quantidade_entregue}/{it.quantidade_meta}</span>
                    </div>
                    <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', pct >= 100 ? 'bg-emerald-500' : 'bg-primary/70')}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
          </div>
          {minhaEntradaMeta.observacao && (
            <p className="text-[11px] text-muted-foreground italic border-t border-border pt-2">{minhaEntradaMeta.observacao}</p>
          )}
        </div>
      )}

      {/* Presença hoje */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <CalendarCheck className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm font-medium">Presença hoje?</p>
              <p className="text-[11px] text-muted-foreground">
                {presenca?.presente === true && disp?.hora_inicio
                  ? `${disp.hora_inicio.slice(0, 5)}${disp.hora_fim ? ` – ${disp.hora_fim.slice(0, 5)}` : ''}`
                  : presenca?.presente === false
                    ? (presenca.motivo ? `Ausente — ${presenca.motivo}` : 'Ausente sem justificativa')
                    : 'Registre sua presença de hoje.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleClickNao}
              disabled={salvandoDisp || salvandoPresenca}
              className={cn(
                'px-4 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                presenca?.presente === false
                  ? 'bg-red-500/20 text-red-400 border-red-500/30'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-border/60'
              )}
            >
              Não
            </button>
            <button
              onClick={handleClickSim}
              disabled={salvandoDisp || salvandoPresenca}
              className={cn(
                'px-4 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                presenca?.presente === true
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-border/60'
              )}
            >
              Sim
            </button>
          </div>
        </div>

        {/* Tabela de disponíveis hoje */}
        {dispTodos.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold text-muted-foreground">DISPONÍVEIS HOJE</p>
            </div>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/20 border-b border-border">
                  <tr>
                    <th className="text-left px-3 py-1.5 text-[11px] text-muted-foreground font-medium">Membro</th>
                    <th className="text-left px-3 py-1.5 text-[11px] text-muted-foreground font-medium">Horário</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {dispTodos.map((d, i) => (
                    <tr key={i} className="hover:bg-white/[0.02]">
                      <td className="px-3 py-2 text-sm">{d.nome}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {d.hora_inicio
                          ? `${d.hora_inicio.slice(0, 5)}${d.hora_fim ? ` – ${d.hora_fim.slice(0, 5)}` : ''}`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal horário disponibilidade */}
      <Dialog open={modalHorario} onOpenChange={o => { if (!o) setModalHorario(false) }}>
        <DialogContent className="max-w-xs" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Qual horário você estará disponível?</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Das</Label>
              <input type="time" value={horaInicio} onChange={e => setHoraInicio(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus:border-ring" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Até</Label>
              <input type="time" value={horaFim} onChange={e => setHoraFim(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus:border-ring" />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">Horário opcional — deixe em branco se preferir não informar.</p>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setModalHorario(false)}>Cancelar</Button>
            <Button size="sm" onClick={confirmarHorario}>Confirmar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal motivo ausência */}
      <Dialog open={modalAusencia} onOpenChange={o => { if (!o) setModalAusencia(false) }}>
        <DialogContent className="max-w-xs" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Motivo da ausência</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs">Motivo <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <textarea
              value={textoMotivo}
              onChange={e => setTextoMotivo(e.target.value)}
              placeholder="Ex: viagem, compromisso, doença..."
              rows={2}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring resize-none"
            />
            <p className="text-[11px] text-muted-foreground">Deixe em branco para ausência injustificada.</p>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setModalAusencia(false)}>Cancelar</Button>
            <Button size="sm" onClick={confirmarAusencia}>Confirmar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Acesso Rápido */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">ACESSO RÁPIDO</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: '/metas',                label: 'Metas',         icon: Target,     desc: 'Ver e criar metas' },
            { href: '/vendas',               label: 'Vendas',        icon: ShoppingCart, desc: 'Registrar venda' },
            { href: '/vendas/minha-carteira', label: 'Minha Carteira', icon: Wallet,    desc: 'Saldo e transferências' },
            { href: '/financeiro',           label: 'Financeiro',    icon: DollarSign, desc: 'Extrato e contas' },
          ].map(item => {
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href}
                className="rounded-xl border border-border bg-card p-4 hover:border-border/60 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">{item.desc}</p>
              </Link>
            )
          })}
        </div>
      </div>

    </div>
  )
}

'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  TrendingUp, CheckCircle2, Clock, XCircle, Wallet, ShoppingCart,
  CalendarCheck, Target, ArrowRight, DollarSign, BarChart2,
} from 'lucide-react'

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Conta = { id: string; saldo_sujo: number; saldo_limpo: number }

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

type Disponibilidade = { id: string; disponivel: boolean; observacao: string | null }

interface Props {
  userId: string
  userNome: string | null
  conta: Conta | null
  metaAtual: MetaAtual | null
  vendasSemana: Venda[]
  disponibilidade: Disponibilidade | null
  hoje: string
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

function saudacao(nome: string | null) {
  const h = new Date().getHours()
  const parte = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
  return nome ? `${parte}, ${nome.split(' ')[0]}` : parte
}

// ── Componente ────────────────────────────────────────────────────────────────

export function DashboardClient({
  userId, userNome, conta, metaAtual, vendasSemana,
  disponibilidade: dispInicial, hoje,
}: Props) {
  const sb = useCallback(() => createClient(), [])

  const [disp, setDisp]             = useState<Disponibilidade | null>(dispInicial)
  const [salvandoDisp, setSalvandoDisp] = useState(false)

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

  async function toggleDisponivel(valor: boolean) {
    setSalvandoDisp(true)
    try {
      if (disp) {
        const { error } = await sb()
          .from('usuarios_disponibilidade')
          .update({ disponivel: valor })
          .eq('id', disp.id)
        if (error) { toast.error(error.message); return }
        setDisp(prev => prev ? { ...prev, disponivel: valor } : prev)
      } else {
        const { data, error } = await sb()
          .from('usuarios_disponibilidade')
          .insert({ usuario_id: userId, data: hoje, disponivel: valor })
          .select('id, disponivel, observacao')
          .single()
        if (error) { toast.error(error.message); return }
        setDisp(data)
      }
    } finally { setSalvandoDisp(false) }
  }

  const statusCfg = STATUS_META[minhaEntradaMeta?.status ?? 'em_andamento']

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-5xl">

      {/* Saudação */}
      <div>
        <h2 className="text-lg font-semibold">{saudacao(userNome)}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Aqui está o seu resumo da semana.</p>
      </div>

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

      {/* Disponibilidade para Ação */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <CalendarCheck className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm font-medium">Disponível para Ação hoje?</p>
              <p className="text-[11px] text-muted-foreground">Informe sua disponibilidade para as operações de hoje.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => toggleDisponivel(false)}
              disabled={salvandoDisp}
              className={cn(
                'px-4 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                disp?.disponivel === false
                  ? 'bg-red-500/20 text-red-400 border-red-500/30'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-border/60'
              )}
            >
              Não
            </button>
            <button
              onClick={() => toggleDisponivel(true)}
              disabled={salvandoDisp}
              className={cn(
                'px-4 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                disp?.disponivel === true
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-border/60'
              )}
            >
              Sim
            </button>
          </div>
        </div>
        {disp === null && (
          <p className="text-[11px] text-muted-foreground mt-3 ml-7">Você ainda não marcou sua disponibilidade para hoje.</p>
        )}
      </div>

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

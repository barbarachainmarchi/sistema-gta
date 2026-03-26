'use client'

import { useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Check, X, Loader2, ClipboardList, ScrollText } from 'lucide-react'
import { Button } from '@/components/ui/button'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type Log = {
  id: string; tipo: string; referencia_tipo: string | null; descricao: string | null
  usuario_nome: string | null; dados: Record<string, unknown> | null; created_at: string
}

export type Solicitacao = {
  id: string
  tipo: 'cancelamento_cotacao' | 'cancelamento_venda' | 'transferencia_financeiro'
  status: 'pendente' | 'aprovado' | 'rejeitado'
  referencia_id: string | null; referencia_tipo: string | null
  descricao: string | null
  solicitante_id: string | null; solicitante_nome: string | null
  aprovador_nome: string | null
  dados: Record<string, unknown> | null
  created_at: string; resolved_at: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDt(s: string) {
  const d = new Date(s)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
    + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

const TIPO_LABEL: Record<string, string> = {
  cancelamento_cotacao: 'Cancelar cotação',
  cancelamento_venda:   'Cancelar venda',
  transferencia_financeiro: 'Transferência financeira',
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  userId: string; userNome: string | null
  logsIniciais: Log[]; solicitacoesIniciais: Solicitacao[]
  podeAprovar: boolean
}

// ── Componente ────────────────────────────────────────────────────────────────

export function LogsClient({ userId, userNome, logsIniciais, solicitacoesIniciais, podeAprovar }: Props) {
  const sbRef = useRef<ReturnType<typeof createClient> | null>(null)
  const sb = useCallback(() => { if (!sbRef.current) sbRef.current = createClient(); return sbRef.current }, [])

  const [aba, setAba] = useState<'log' | 'solicitacoes'>('solicitacoes')
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>(solicitacoesIniciais)
  const [resolvendo, setResolvendo] = useState<string | null>(null)

  async function handleResolver(sol: Solicitacao, novoStatus: 'aprovado' | 'rejeitado') {
    setResolvendo(sol.id)
    try {
      // Atualiza a solicitação
      const { error } = await sb().from('sistema_solicitacoes').update({
        status: novoStatus,
        aprovador_id: userId,
        aprovador_nome: userNome,
        resolved_at: new Date().toISOString(),
      }).eq('id', sol.id)
      if (error) throw new Error(error.message)

      // Se aprovado e é cancelamento de cotação → deleta a cotação
      if (novoStatus === 'aprovado' && sol.tipo === 'cancelamento_cotacao' && sol.referencia_id) {
        await sb().from('cotacao_itens').delete().eq('cotacao_id', sol.referencia_id)
        await sb().from('cotacao_pessoas').delete().eq('cotacao_id', sol.referencia_id)
        await sb().from('cotacoes').delete().eq('id', sol.referencia_id)
      }

      setSolicitacoes(prev => prev.map(s => s.id === sol.id
        ? { ...s, status: novoStatus, aprovador_nome: userNome, resolved_at: new Date().toISOString() }
        : s
      ))
      toast.success(novoStatus === 'aprovado' ? 'Aprovado!' : 'Rejeitado')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    } finally {
      setResolvendo(null)
    }
  }

  const pendentes  = solicitacoes.filter(s => s.status === 'pendente')
  const resolvidas = solicitacoes.filter(s => s.status !== 'pendente')

  return (
    <div className="h-[calc(100vh-3rem)] flex flex-col overflow-hidden">

      {/* ── Tabs ── */}
      <div className="flex border-b border-border shrink-0 px-6">
        {([
          ['solicitacoes', 'Solicitações', ClipboardList, pendentes.length],
          ['log',          'Log',          ScrollText, logsIniciais.length],
        ] as const).map(([key, label, Icon, count]) => (
          <button key={key} onClick={() => setAba(key)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
              aba === key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}>
            <Icon className="h-3.5 w-3.5" />
            {label}
            {count > 0 && (
              <span className={cn(
                'ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                key === 'solicitacoes' && aba !== 'solicitacoes' && pendentes.length > 0
                  ? 'bg-primary/20 text-primary'
                  : 'bg-muted text-muted-foreground'
              )}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Aba: Solicitações ── */}
      {aba === 'solicitacoes' && (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Pendentes */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-3">
              Pendentes ({pendentes.length})
            </p>
            {pendentes.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center">
                <p className="text-sm text-muted-foreground">Nenhuma solicitação pendente</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendentes.map(sol => (
                  <div key={sol.id} className="rounded-lg border border-border bg-card p-4 flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded">
                          {TIPO_LABEL[sol.tipo] ?? sol.tipo}
                        </span>
                        <span className="text-[11px] text-muted-foreground">{fmtDt(sol.created_at)}</span>
                      </div>
                      <p className="text-sm font-medium">{sol.descricao ?? '—'}</p>
                      {sol.solicitante_nome && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Solicitado por: <span className="text-foreground/70">{sol.solicitante_nome}</span>
                        </p>
                      )}
                      {sol.dados?.motivo != null && (
                        <p className="text-[11px] text-muted-foreground mt-1 italic">
                          Motivo: {String(sol.dados.motivo)}
                        </p>
                      )}
                    </div>
                    {podeAprovar && (
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-red-400 border-red-500/30 hover:border-red-500/60"
                          disabled={resolvendo === sol.id}
                          onClick={() => handleResolver(sol, 'rejeitado')}>
                          {resolvendo === sol.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                          Rejeitar
                        </Button>
                        <Button size="sm" className="h-7 text-xs gap-1"
                          disabled={resolvendo === sol.id}
                          onClick={() => handleResolver(sol, 'aprovado')}>
                          {resolvendo === sol.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          Aprovar
                        </Button>
                      </div>
                    )}
                    {!podeAprovar && (
                      <span className="text-[11px] text-muted-foreground shrink-0 self-center">Aguardando aprovação</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Resolvidas */}
          {resolvidas.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-3">
                Resolvidas ({resolvidas.length})
              </p>
              <div className="space-y-1.5">
                {resolvidas.map(sol => (
                  <div key={sol.id} className="rounded-lg border border-border/50 bg-muted/10 px-4 py-3 flex items-center gap-3">
                    <span className={cn(
                      'text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0',
                      sol.status === 'aprovado' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                    )}>
                      {sol.status === 'aprovado' ? 'Aprovado' : 'Rejeitado'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate">{sol.descricao ?? TIPO_LABEL[sol.tipo] ?? sol.tipo}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {sol.solicitante_nome} · {fmtDt(sol.created_at)}
                        {sol.aprovador_nome && ` · Resolvido por ${sol.aprovador_nome}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Aba: Log ── */}
      {aba === 'log' && (
        <div className="flex-1 overflow-y-auto p-6">
          {logsIniciais.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-12 text-center">
              <p className="text-sm text-muted-foreground">Nenhum log registrado ainda</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/30 border-b border-border">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground w-32">Data</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground w-32">Tipo</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Descrição</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground w-32">Usuário</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {logsIniciais.map(l => (
                    <tr key={l.id} className="hover:bg-white/[0.02]">
                      <td className="px-3 py-2.5 text-muted-foreground tabular-nums whitespace-nowrap">{fmtDt(l.created_at)}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{l.tipo}</td>
                      <td className="px-3 py-2.5">{l.descricao ?? '—'}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{l.usuario_nome ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

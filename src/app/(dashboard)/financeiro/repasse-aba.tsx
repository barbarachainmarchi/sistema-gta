'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import type { SbClient } from './financeiro-client'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type Repasse = {
  id: string
  status: 'pendente' | 'aprovado' | 'rejeitado'
  descricao: string | null
  solicitante_id: string | null; solicitante_nome: string | null
  aprovador_nome: string | null
  dados: Record<string, unknown> | null
  created_at: string; resolved_at: string | null
}

interface Props {
  repasses: Repasse[]
  setRepasses: React.Dispatch<React.SetStateAction<Repasse[]>>
  userId: string
  userNome: string | null
  podeExcluir: boolean
  sb: SbClient
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDt(s: string) {
  const d = new Date(s)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
    + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function fmtVal(v: unknown) {
  if (v == null) return '—'
  return `R$ ${Number(v).toLocaleString('pt-BR')}`
}

// ── Componente ────────────────────────────────────────────────────────────────

export function RepasseAba({ repasses, setRepasses, userId, userNome, podeExcluir, sb }: Props) {
  const [contestandoId, setContestandoId] = useState<string | null>(null)
  const [motivoContest, setMotivoContest] = useState('')
  const [salvandoContest, setSalvandoContest] = useState(false)
  const [deletandoId, setDeletandoId] = useState<string | null>(null)

  const pendentes  = repasses.filter(r => r.status === 'pendente')
  const resolvidos = repasses.filter(r => r.status !== 'pendente')

  async function handleExcluir(id: string) {
    setDeletandoId(id)
    const { error } = await sb().from('sistema_solicitacoes').delete().eq('id', id)
    setDeletandoId(null)
    if (error) { toast.error(error.message); return }
    setRepasses(prev => prev.filter(r => r.id !== id))
  }

  async function handleContestar() {
    if (!contestandoId) return
    setSalvandoContest(true)
    const repasse = repasses.find(r => r.id === contestandoId)
    const { error } = await sb().from('sistema_solicitacoes').update({
      dados: {
        ...(repasse?.dados ?? {}),
        contestado: true,
        contestacao_motivo: motivoContest.trim() || null,
        contestado_por: userId,
        contestado_por_nome: userNome,
        contestado_em: new Date().toISOString(),
      },
    }).eq('id', contestandoId)
    setSalvandoContest(false)
    if (error) { toast.error(error.message); return }
    setRepasses(prev => prev.map(r => r.id === contestandoId
      ? { ...r, dados: { ...(r.dados ?? {}), contestado: true, contestacao_motivo: motivoContest.trim() || null, contestado_por_nome: userNome } }
      : r
    ))
    setContestandoId(null)
    setMotivoContest('')
    toast.success('Contestação registrada')
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-8">

      {/* ── Pendentes ── */}
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-3">
          Pendentes ({pendentes.length})
        </p>
        {pendentes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">Nenhum repasse pendente</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pendentes.map(r => (
              <RepasseCard key={r.id} r={r} podeExcluir={podeExcluir} deletandoId={deletandoId}
                onExcluir={handleExcluir} onContestar={null} />
            ))}
          </div>
        )}
      </div>

      {/* ── Histórico ── */}
      {resolvidos.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-3">
            Histórico ({resolvidos.length})
          </p>
          <div className="space-y-1.5">
            {resolvidos.map(r => (
              <RepasseCard key={r.id} r={r} podeExcluir={podeExcluir} deletandoId={deletandoId}
                onExcluir={handleExcluir}
                onContestar={r.dados?.contestado ? null : () => { setContestandoId(r.id); setMotivoContest('') }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Dialog contestação ── */}
      <Dialog open={!!contestandoId} onOpenChange={v => !v && setContestandoId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Contestar repasse</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-xs text-muted-foreground">Descreva o motivo da contestação. Um administrador será notificado.</p>
            <Textarea
              placeholder="Motivo (opcional)"
              value={motivoContest}
              onChange={e => setMotivoContest(e.target.value)}
              className="text-sm resize-none"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContestandoId(null)}>Cancelar</Button>
            <Button onClick={handleContestar} disabled={salvandoContest}>
              {salvandoContest && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Contestar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Card individual ───────────────────────────────────────────────────────────

function RepasseCard({
  r, podeExcluir, deletandoId, onExcluir, onContestar,
}: {
  r: Repasse
  podeExcluir: boolean
  deletandoId: string | null
  onExcluir: (id: string) => void
  onContestar: (() => void) | null
}) {
  const isPendente = r.status === 'pendente'
  const contestado = r.dados?.contestado === true

  return (
    <div className={cn(
      'rounded-lg border bg-card px-4 py-3 flex items-start gap-3',
      isPendente ? 'border-border' : 'border-border/50 bg-muted/10',
    )}>
      {/* Status badge */}
      {!isPendente && (
        <span className={cn(
          'text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 mt-0.5',
          r.status === 'aprovado' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400',
        )}>
          {r.status === 'aprovado' ? 'Aprovado' : 'Rejeitado'}
        </span>
      )}
      {isPendente && (
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 mt-0.5 bg-amber-500/15 text-amber-400">
          Pendente
        </span>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-xs font-medium truncate">{r.descricao ?? '—'}</p>
        <p className="text-[10px] text-muted-foreground">
          {r.solicitante_nome && <span>Solicitado por {r.solicitante_nome} · </span>}
          {fmtDt(r.created_at)}
          {r.aprovador_nome && ` · Resolvido por ${r.aprovador_nome}`}
        </p>
        {r.dados?.valor != null && (
          <p className="text-[11px] text-muted-foreground/70">
            {fmtVal(r.dados.valor)}
            {r.dados.tipo_dinheiro != null && ` · ${String(r.dados.tipo_dinheiro)}`}
          </p>
        )}
        {contestado && (
          <div className="flex items-center gap-1 mt-1">
            <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
            <span className="text-[10px] text-amber-400">
              Contestado por {String(r.dados?.contestado_por_nome ?? '—')}
              {r.dados?.contestacao_motivo != null && `: ${String(r.dados.contestacao_motivo)}`}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {onContestar && !isPendente && (
          <button
            onClick={onContestar}
            className="h-6 px-2 text-[10px] rounded border border-border text-muted-foreground hover:text-amber-400 hover:border-amber-500/40 transition-colors"
            title="Contestar"
          >
            <AlertTriangle className="h-3 w-3" />
          </button>
        )}
        {podeExcluir && !isPendente && (
          <button
            onClick={() => onExcluir(r.id)}
            disabled={deletandoId === r.id}
            className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground/30 hover:text-destructive hover:bg-white/[0.06] transition-colors"
          >
            {deletandoId === r.id
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <Trash2 className="h-3 w-3" />
            }
          </button>
        )}
      </div>
    </div>
  )
}


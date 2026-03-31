'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ChevronRight, RotateCcw, Trash2 } from 'lucide-react'
import type { MetaHistorico, MetaSemanal, Membro, SbClient } from './metas-client'
import { fmtSemana } from './metas-client'

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  ativa:      { label: 'Ativa',      cls: 'text-blue-400 bg-blue-500/10' },
  encerrada:  { label: 'Encerrada',  cls: 'text-muted-foreground bg-muted/40' },
  rascunho:   { label: 'Rascunho',   cls: 'text-amber-400 bg-amber-500/10' },
}

function contarStatus(metas_membros: { status: string }[]) {
  const totais = { completo: 0, incompleto: 0, justificado: 0, em_andamento: 0 }
  for (const m of metas_membros) {
    if (m.status in totais) totais[m.status as keyof typeof totais]++
  }
  return totais
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  historico: MetaHistorico[]
  membros: Membro[]
  sb: SbClient
  setHistorico: React.Dispatch<React.SetStateAction<MetaHistorico[]>>
  setMetaAtual: React.Dispatch<React.SetStateAction<MetaSemanal | null>>
  podeEditar: boolean
}

// ── Componente ────────────────────────────────────────────────────────────────

export function HistoricoAba({ historico, membros, sb, setHistorico, setMetaAtual, podeEditar }: Props) {
  const [detalheId, setDetalheId]   = useState<string | null>(null)
  const [detalhe, setDetalhe]       = useState<MetaSemanal | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [reativando, setReativando] = useState<string | null>(null)
  const [deletando, setDeletando]   = useState<string | null>(null)
  const [confirmarDelete, setConfirmarDelete] = useState<MetaHistorico | null>(null)

  const membroMap = Object.fromEntries(membros.map(m => [m.id, m]))

  async function abrirDetalhe(id: string) {
    setDetalheId(id)
    setCarregando(true)
    try {
      const { data, error } = await sb()
        .from('metas_semanais')
        .select('*, metas_itens_template(*), metas_membros(*, metas_membros_itens(*))')
        .eq('id', id)
        .single()
      if (error) { toast.error(error.message); return }
      setDetalhe(data as MetaSemanal)
    } finally { setCarregando(false) }
  }

  async function handleReativar(meta: MetaHistorico) {
    setReativando(meta.id)
    try {
      const { error } = await sb().from('metas_semanais').update({ status: 'ativa' }).eq('id', meta.id)
      if (error) { toast.error(error.message); return }

      // Buscar a meta completa para setar como atual
      const { data } = await sb()
        .from('metas_semanais')
        .select('*, metas_itens_template(*), metas_membros(*, metas_membros_itens(*))')
        .eq('id', meta.id)
        .single()
      if (data) setMetaAtual(data as MetaSemanal)

      setHistorico(prev => prev.filter(h => h.id !== meta.id))
      toast.success('Meta reativada!')
    } finally { setReativando(null) }
  }

  async function handleDeletar(meta: MetaHistorico) {
    setDeletando(meta.id)
    setConfirmarDelete(null)
    try {
      // Child tables (metas_itens_template, metas_membros, metas_membros_itens, metas_entregas)
      // all have ON DELETE CASCADE from metas_semanais — one delete is enough.
      const { error } = await sb().from('metas_semanais').delete().eq('id', meta.id)
      if (error) { toast.error(error.message); return }
      setHistorico(prev => prev.filter(h => h.id !== meta.id))
      toast.success('Meta excluída!')
    } finally { setDeletando(null) }
  }

  if (!historico.length) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-muted-foreground">Nenhuma meta encerrada ainda.</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-2">
      <p className="text-xs text-muted-foreground mb-4">Metas das semanas anteriores (encerradas).</p>

      {historico.map(meta => {
        const totais = contarStatus(meta.metas_membros)
        const cfg    = STATUS_CFG[meta.status] ?? STATUS_CFG.encerrada

        return (
          <div key={meta.id} className="rounded-lg border border-border bg-card hover:border-border/70 transition-colors">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3 min-w-0">
                <button onClick={() => abrirDetalhe(meta.id)} className="flex items-center gap-2 min-w-0 text-left">
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{meta.titulo || `Semana ${fmtSemana(meta.semana_inicio, meta.semana_fim)}`}</p>
                    <p className="text-[11px] text-muted-foreground">{fmtSemana(meta.semana_inicio, meta.semana_fim)}</p>
                  </div>
                </button>
                <span className={cn('text-[10px] px-2 py-0.5 rounded-full', cfg.cls)}>{cfg.label}</span>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                {/* Mini resumo */}
                <div className="flex gap-3 text-[11px]">
                  {totais.completo    > 0 && <span className="text-emerald-400">{totais.completo} ✓</span>}
                  {totais.incompleto  > 0 && <span className="text-red-400">{totais.incompleto} ✗</span>}
                  {totais.justificado > 0 && <span className="text-amber-400">{totais.justificado} J</span>}
                  {totais.em_andamento > 0 && <span className="text-muted-foreground">{totais.em_andamento} …</span>}
                  <span className="text-muted-foreground">{meta.metas_membros.length} membros</span>
                </div>

                {podeEditar && meta.status === 'encerrada' && (
                  <>
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground"
                      onClick={() => handleReativar(meta)} disabled={reativando === meta.id}>
                      <RotateCcw className="h-3 w-3" /> Reativar
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-red-400/70 hover:text-red-400"
                      onClick={() => setConfirmarDelete(meta)} disabled={deletando === meta.id}>
                      <Trash2 className="h-3 w-3" /> Excluir
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })}

      {/* ── Modal detalhe histórico ── */}
      <Dialog open={!!detalheId} onOpenChange={o => { if (!o) { setDetalheId(null); setDetalhe(null) } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>
              {detalhe ? (detalhe.titulo || `Semana ${fmtSemana(detalhe.semana_inicio, detalhe.semana_fim)}`) : 'Carregando…'}
            </DialogTitle>
          </DialogHeader>

          {carregando && (
            <div className="flex justify-center py-8">
              <div className="text-sm text-muted-foreground">Carregando…</div>
            </div>
          )}

          {detalhe && !carregando && (
            <div className="space-y-4">
              {/* Template */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">TEMPLATE DA SEMANA</p>
                <div className="flex flex-wrap gap-2">
                  {detalhe.metas_itens_template.map(it => (
                    <span key={it.id} className="px-2.5 py-1 text-xs rounded-full border border-border text-muted-foreground">
                      {it.item_nome}{it.tipo_dinheiro ? ` (${it.tipo_dinheiro})` : ''}: {it.quantidade}
                    </span>
                  ))}
                </div>
              </div>

              {/* Membros */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">MEMBROS</p>
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/20 border-b border-border">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs text-muted-foreground">Membro</th>
                        <th className="text-left px-3 py-2 text-xs text-muted-foreground">Status</th>
                        <th className="text-left px-3 py-2 text-xs text-muted-foreground">Itens</th>
                        <th className="text-right px-3 py-2 text-xs text-muted-foreground">Progresso</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {[...detalhe.metas_membros].sort((a, b) => {
                        const na = membroMap[a.membro_id]?.nome ?? ''
                        const nb = membroMap[b.membro_id]?.nome ?? ''
                        return na.localeCompare(nb)
                      }).map(mm => {
                        const STATUS_DETALHE: Record<string, { label: string; cls: string }> = {
                          em_andamento: { label: 'Em andamento', cls: 'text-blue-400' },
                          completo:     { label: 'Completo',      cls: 'text-emerald-400' },
                          incompleto:   { label: 'Incompleto',    cls: 'text-red-400' },
                          justificado:  { label: 'Justificado',   cls: 'text-amber-400' },
                        }
                        const cfg2 = STATUS_DETALHE[mm.status] ?? STATUS_DETALHE.em_andamento
                        const totalMeta      = mm.metas_membros_itens.reduce((s, it) => s + it.quantidade_meta, 0)
                        const totalEntregue  = mm.metas_membros_itens.reduce((s, it) => s + it.quantidade_entregue, 0)
                        const pct = totalMeta > 0 ? Math.min(Math.round((totalEntregue / totalMeta) * 100), 100) : 0

                        return (
                          <tr key={mm.id} className="hover:bg-white/[0.02]">
                            <td className="px-3 py-2">
                              <p className="text-sm">{membroMap[mm.membro_id]?.nome ?? mm.membro_id}</p>
                              {mm.observacao && <p className="text-[10px] text-muted-foreground italic">{mm.observacao}</p>}
                            </td>
                            <td className="px-3 py-2">
                              <span className={cn('text-[11px]', cfg2.cls)}>{cfg2.label}</span>
                              {mm.status_forcado && <span className="text-[9px] text-muted-foreground ml-1">(manual)</span>}
                            </td>
                            <td className="px-3 py-2 text-[11px] text-muted-foreground">
                              {mm.metas_membros_itens.map(it =>
                                `${it.item_nome}: ${it.quantidade_entregue}/${it.quantidade_meta}`
                              ).join(' · ')}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-emerald-500' : 'bg-primary/70')}
                                    style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-[11px] text-muted-foreground w-8">{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Confirmar exclusão ── */}
      <Dialog open={!!confirmarDelete} onOpenChange={o => { if (!o) setConfirmarDelete(null) }}>
        <DialogContent className="max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Excluir semana?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Isso vai apagar permanentemente a meta{' '}
            <span className="font-medium text-foreground">
              {confirmarDelete?.titulo || (confirmarDelete ? `Semana ${fmtSemana(confirmarDelete.semana_inicio, confirmarDelete.semana_fim)}` : '')}
            </span>{' '}
            e todos os registros associados. Essa ação não pode ser desfeita.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmarDelete(null)}>Cancelar</Button>
            <Button variant="destructive" size="sm" onClick={() => confirmarDelete && handleDeletar(confirmarDelete)}
              disabled={!!deletando}>
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

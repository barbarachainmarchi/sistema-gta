'use client'

import { useState, useMemo } from 'react'
import { Trophy, Loader2, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Acao, AcaoParticipante, Membro } from './acao-shared'

interface Props {
  acoes: Acao[]
  participantes: AcaoParticipante[]
  membros: Membro[]
  podeEditar: boolean
  salvando: boolean
  onZerarRanking: () => Promise<void>
}

type PeriodoPreset = '7d' | '30d' | '90d' | 'mes' | 'custom' | 'todos'

function startOf(preset: PeriodoPreset): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  if (preset === '7d') { const d = new Date(now); d.setDate(d.getDate() - 7); return fmt(d) }
  if (preset === '30d') { const d = new Date(now); d.setDate(d.getDate() - 30); return fmt(d) }
  if (preset === '90d') { const d = new Date(now); d.setDate(d.getDate() - 90); return fmt(d) }
  if (preset === 'mes') { return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01` }
  return ''
}

const MEDALS = ['🥇', '🥈', '🥉']

export function TabRanking({ acoes, participantes, membros, podeEditar, salvando, onZerarRanking }: Props) {
  const [preset, setPreset] = useState<PeriodoPreset>('todos')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [confirmZerar, setConfirmZerar] = useState(false)

  const rangeFrom = preset === 'custom' ? customFrom : (preset === 'todos' ? '' : startOf(preset))
  const rangeTo = preset === 'custom' ? customTo : ''

  const ranking = useMemo(() => {
    const acoesValidas = acoes.filter(a => {
      if (!a.conta_pontuacao) return false
      const dt = a.data_hora.slice(0, 10)
      if (rangeFrom && dt < rangeFrom) return false
      if (rangeTo && dt > rangeTo) return false
      return true
    })
    const validIds = new Set(acoesValidas.map(a => a.id))

    const map: Record<string, { membroId: string; nome: string; pontos: number; acoes: number }> = {}
    for (const p of participantes) {
      if (!validIds.has(p.acao_id)) continue
      if (!map[p.membro_id]) {
        const m = membros.find(mb => mb.id === p.membro_id)
        map[p.membro_id] = { membroId: p.membro_id, nome: p.membro_nome ?? m?.nome ?? '—', pontos: 0, acoes: 0 }
      }
      map[p.membro_id]!.pontos += p.pontos_atribuidos
      map[p.membro_id]!.acoes += 1
    }

    return Object.values(map).sort((a, b) => b.pontos - a.pontos || b.acoes - a.acoes)
  }, [acoes, participantes, membros, rangeFrom, rangeTo])

  return (
    <div className="space-y-4">
      {/* Period filter + zerar */}
      <div className="flex items-center gap-3 flex-wrap justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={preset} onValueChange={v => setPreset(v as PeriodoPreset)}>
            <SelectTrigger className="h-8 text-xs w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todo o período</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
              <SelectItem value="mes">Este mês</SelectItem>
              <SelectItem value="custom">Período personalizado</SelectItem>
            </SelectContent>
          </Select>
          {preset === 'custom' && (
            <>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground" />
              <span className="text-xs text-muted-foreground">até</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground" />
            </>
          )}
        </div>
        {podeEditar && (
          <Button variant="outline" size="sm" className="gap-1.5 text-muted-foreground"
            onClick={() => setConfirmZerar(true)}>
            <RotateCcw className="h-3.5 w-3.5" />Zerar Ranking
          </Button>
        )}
      </div>

      {/* Ranking table */}
      {ranking.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <Trophy className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma pontuação no período selecionado</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="grid grid-cols-[32px_1fr_80px_80px] gap-2 px-4 py-2 bg-muted/30 border-b border-border text-[11px] text-muted-foreground font-medium">
            <span>#</span><span>Membro</span><span className="text-right">Ações</span><span className="text-right">Pontos</span>
          </div>
          {ranking.map((r, i) => (
            <div key={r.membroId} className={cn(
              'grid grid-cols-[32px_1fr_80px_80px] gap-2 items-center px-4 py-3',
              i > 0 && 'border-t border-border/40',
              i < 3 && 'bg-yellow-500/[0.02]'
            )}>
              <span className="text-sm font-bold text-muted-foreground/60">
                {MEDALS[i] ?? <span className="text-xs">{i + 1}</span>}
              </span>
              <span className={cn('text-sm font-medium', i === 0 && 'text-yellow-400')}>{r.nome}</span>
              <span className="text-xs text-muted-foreground text-right">{r.acoes}</span>
              <span className={cn('text-sm font-bold tabular-nums text-right',
                i === 0 ? 'text-yellow-400' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-orange-600' : 'text-foreground'
              )}>
                {r.pontos}
              </span>
            </div>
          ))}
        </div>
      )}

      {ranking.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          {ranking.length} membro(s) · {ranking.reduce((s, r) => s + r.pontos, 0)} pontos distribuídos
        </p>
      )}

      {/* Confirm zerar */}
      <Dialog open={confirmZerar} onOpenChange={o => { if (!o) setConfirmZerar(false) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Zerar o ranking?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Todos os pontos de todas as ações serão zerados permanentemente. Os registros de ação continuam existindo, apenas a pontuação é removida.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmZerar(false)} disabled={salvando}>Cancelar</Button>
            <Button variant="destructive" size="sm" disabled={salvando}
              onClick={async () => { await onZerarRanking(); setConfirmZerar(false) }}>
              {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Zerar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

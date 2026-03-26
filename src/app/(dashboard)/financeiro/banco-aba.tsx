'use client'

import { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, ArrowLeftRight, Wallet } from 'lucide-react'
import type { Conta, Lancamento } from './financeiro-client'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
function fmtData(s: string | null) {
  if (!s) return '—'
  const d = new Date(s + (s.includes('T') ? '' : 'T00:00:00'))
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

const TIPO_LABEL: Record<string, string> = {
  faccao: 'Facção', loja: 'Loja', membro: 'Membro', caixa: 'Caixa', setor: 'Setor', outro: 'Outro',
}
const TIPO_ORDER: Conta['tipo'][] = ['faccao', 'loja', 'caixa', 'setor', 'membro', 'outro']

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  contas: Conta[]
  lancamentos: Lancamento[]
}

// ── Componente ────────────────────────────────────────────────────────────────

export function BancoAba({ contas, lancamentos }: Props) {
  const [contaSel, setContaSel] = useState<string | null>(null)

  const contasAtivas = useMemo(() => contas.filter(c => c.status === 'ativo'), [contas])

  const totalSujo  = useMemo(() => contasAtivas.reduce((s, c) => s + c.saldo_sujo, 0),  [contasAtivas])
  const totalLimpo = useMemo(() => contasAtivas.reduce((s, c) => s + c.saldo_limpo, 0), [contasAtivas])

  const grupos = useMemo(() => {
    const map: Partial<Record<Conta['tipo'], Conta[]>> = {}
    for (const t of TIPO_ORDER) {
      const lista = contasAtivas.filter(c => c.tipo === t)
      if (lista.length) map[t] = lista
    }
    return map
  }, [contasAtivas])

  const contaDetalhe = contaSel ? contas.find(c => c.id === contaSel) : null
  const lancDetalhe  = useMemo(() => {
    if (!contaSel) return []
    return lancamentos.filter(l => l.conta_id === contaSel || l.conta_destino_id === contaSel)
  }, [lancamentos, contaSel])

  const contaMap = useMemo(() => Object.fromEntries(contas.map(c => [c.id, c])), [contas])

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">

      {/* ── Totais gerais ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Total Limpo</p>
          <p className="text-xl font-bold tabular-nums text-emerald-400">R$ {fmt(totalLimpo)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Total Sujo</p>
          <p className="text-xl font-bold tabular-nums text-orange-400">R$ {fmt(totalSujo)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Total Geral</p>
          <p className="text-xl font-bold tabular-nums text-foreground">R$ {fmt(totalLimpo + totalSujo)}</p>
        </div>
      </div>

      {/* ── Contas agrupadas ── */}
      {(TIPO_ORDER).filter(t => grupos[t]).map(tipo => (
        <div key={tipo}>
          <p className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-2">
            {TIPO_LABEL[tipo]}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {grupos[tipo]!.map(c => (
              <button key={c.id} onClick={() => setContaSel(c.id)}
                className="rounded-lg border border-border bg-card px-4 py-3 text-left hover:border-primary/50 hover:bg-white/[0.02] transition-colors group">
                <div className="flex items-center gap-2 mb-3">
                  <Wallet className="h-4 w-4 text-muted-foreground shrink-0" />
                  <p className="font-medium text-sm truncate">{c.nome}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">Limpo</p>
                    <p className={cn('text-sm font-bold tabular-nums', c.saldo_limpo >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      R$ {fmt(c.saldo_limpo)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">Sujo</p>
                    <p className={cn('text-sm font-bold tabular-nums', c.saldo_sujo >= 0 ? 'text-orange-400' : 'text-red-400')}>
                      R$ {fmt(c.saldo_sujo)}
                    </p>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 group-hover:text-primary transition-colors">
                  Ver movimentações →
                </p>
              </button>
            ))}
          </div>
        </div>
      ))}

      {contasAtivas.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">Nenhuma conta cadastrada</p>
        </div>
      )}

      {/* ── Modal detalhe da conta ── */}
      <Dialog open={!!contaSel} onOpenChange={o => { if (!o) setContaSel(null) }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              {contaDetalhe?.nome ?? ''}
            </DialogTitle>
          </DialogHeader>

          {contaDetalhe && (
            <div className="grid grid-cols-3 gap-3 shrink-0">
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                <p className="text-[10px] text-muted-foreground mb-0.5">Limpo</p>
                <p className="font-bold text-emerald-400 tabular-nums">R$ {fmt(contaDetalhe.saldo_limpo)}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                <p className="text-[10px] text-muted-foreground mb-0.5">Sujo</p>
                <p className="font-bold text-orange-400 tabular-nums">R$ {fmt(contaDetalhe.saldo_sujo)}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                <p className="text-[10px] text-muted-foreground mb-0.5">Total</p>
                <p className="font-bold tabular-nums">R$ {fmt(contaDetalhe.saldo_sujo + contaDetalhe.saldo_limpo)}</p>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {lancDetalhe.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma movimentação</div>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-background border-b border-border">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Data</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground w-8"></th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Descrição</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground w-14">$</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {lancDetalhe.map(l => {
                    const isEnt  = l.tipo === 'entrada' || l.tipo === 'venda'
                    const isTrans = l.tipo === 'transferencia'
                    const Icon = isEnt ? TrendingUp : isTrans ? ArrowLeftRight : TrendingDown
                    const cor  = isEnt ? 'text-emerald-400' : isTrans ? 'text-blue-400' : 'text-red-400'
                    const destNome = l.conta_destino_id ? contaMap[l.conta_destino_id]?.nome : null
                    return (
                      <tr key={l.id} className="hover:bg-white/[0.02]">
                        <td className="px-3 py-2.5 text-muted-foreground tabular-nums">
                          {fmtData(l.data ?? l.created_at)}
                        </td>
                        <td className="px-3 py-2.5"><Icon className={cn('h-3.5 w-3.5', cor)} /></td>
                        <td className="px-3 py-2.5">
                          <p className="truncate">
                            {l.item_descricao ?? l.descricao ?? '—'}
                            {isTrans && destNome && <span className="text-muted-foreground"> → {destNome}</span>}
                          </p>
                          {l.tipo === 'venda' && l.responsavel_nome && (
                            <p className="text-[10px] text-muted-foreground">vend: {l.responsavel_nome}</p>
                          )}
                          {l.categoria && <p className="text-[10px] text-muted-foreground">{l.categoria}</p>}
                        </td>
                        <td className="px-3 py-2.5">
                          {l.tipo_dinheiro && (
                            <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded',
                              l.tipo_dinheiro === 'sujo'
                                ? 'bg-orange-500/15 text-orange-400'
                                : 'bg-emerald-500/15 text-emerald-400'
                            )}>
                              {l.tipo_dinheiro === 'sujo' ? 'S' : 'L'}
                            </span>
                          )}
                        </td>
                        <td className={cn('px-3 py-2.5 text-right tabular-nums font-medium', cor)}>
                          {isEnt ? '+' : isTrans ? '±' : '-'}R$ {fmt(l.total ?? l.valor)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

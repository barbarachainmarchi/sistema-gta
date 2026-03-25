'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { TrendingUp, ArrowRightLeft } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import type { Conta, Lancamento, SbClient } from './financeiro-client'

function fmt(v: number) {
  return `R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}
function fmtData(s: string | null) {
  if (!s) return '—'
  const d = new Date(s + (s.includes('T') ? '' : 'T00:00:00'))
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

interface Props {
  userId: string
  contas: Conta[]
  setContas: React.Dispatch<React.SetStateAction<Conta[]>>
  lancamentos: Lancamento[]
  setLancamentos: React.Dispatch<React.SetStateAction<Lancamento[]>>
  sb: SbClient
}

export function MinhaCarteiraAba({ userId, contas, setContas, lancamentos, setLancamentos, sb }: Props) {
  const [transferindo, setTransferindo] = useState<string | null>(null)
  const [destConta, setDestConta] = useState('')
  const [salvando, setSalvando] = useState(false)

  // Minhas vendas = lancamentos de venda criados por mim
  const minhasVendas = useMemo(() =>
    lancamentos.filter(l => l.tipo === 'venda' && l.created_by === userId)
      .sort((a, b) => (b.data ?? b.created_at).localeCompare(a.data ?? a.created_at)),
    [lancamentos, userId]
  )

  const totalLimpo = useMemo(() =>
    minhasVendas.filter(l => l.tipo_dinheiro === 'limpo').reduce((s, l) => s + (l.total ?? l.valor), 0),
    [minhasVendas]
  )
  const totalSujo = useMemo(() =>
    minhasVendas.filter(l => l.tipo_dinheiro === 'sujo').reduce((s, l) => s + (l.total ?? l.valor), 0),
    [minhasVendas]
  )

  const contaMap = useMemo(() => Object.fromEntries(contas.map(c => [c.id, c])), [contas])
  const contasAtivas = useMemo(() => contas.filter(c => c.status === 'ativo'), [contas])

  async function handleTransferir(lanc: Lancamento) {
    if (!destConta || destConta === lanc.conta_id) { toast.error('Escolha uma conta destino diferente'); return }
    setSalvando(true)
    try {
      const valor = lanc.total ?? lanc.valor
      const sujo = lanc.tipo_dinheiro === 'sujo'
      const campoSaldo = sujo ? 'saldo_sujo' : 'saldo_limpo'

      // Atualizar conta_id do lançamento
      const { error } = await sb().from('financeiro_lancamentos').update({ conta_id: destConta }).eq('id', lanc.id)
      if (error) { toast.error('Erro: ' + error.message); return }

      // Ajustar saldo da conta origem
      if (lanc.conta_id) {
        const contaOrigem = contaMap[lanc.conta_id]
        if (contaOrigem) {
          const novoSaldoOrig = sujo
            ? { saldo_sujo: contaOrigem.saldo_sujo - valor }
            : { saldo_limpo: contaOrigem.saldo_limpo - valor }
          await sb().from('financeiro_contas').update(novoSaldoOrig).eq('id', lanc.conta_id)
          setContas(prev => prev.map(c => c.id === lanc.conta_id ? { ...c, [campoSaldo]: (c[campoSaldo] ?? 0) - valor } : c))
        }
      }

      // Ajustar saldo da conta destino
      const contaDest = contaMap[destConta]
      if (contaDest) {
        const novoSaldoDest = sujo
          ? { saldo_sujo: contaDest.saldo_sujo + valor }
          : { saldo_limpo: contaDest.saldo_limpo + valor }
        await sb().from('financeiro_contas').update(novoSaldoDest).eq('id', destConta)
        setContas(prev => prev.map(c => c.id === destConta ? { ...c, [campoSaldo]: (c[campoSaldo] ?? 0) + valor } : c))
      }

      setLancamentos(prev => prev.map(l => l.id === lanc.id ? { ...l, conta_id: destConta } : l))
      setTransferindo(null)
      setDestConta('')
      toast.success(`Transferido para ${contaDest?.nome ?? 'conta'}`)
    } finally { setSalvando(false) }
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-5 max-w-4xl">

      {/* Totais */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Minhas vendas</p>
          <p className="text-xl font-bold tabular-nums">{minhasVendas.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Total Limpo</p>
          <p className="text-xl font-bold tabular-nums text-emerald-400">{fmt(totalLimpo)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Total Sujo</p>
          <p className="text-xl font-bold tabular-nums text-orange-400">{fmt(totalSujo)}</p>
        </div>
      </div>

      {/* Lista */}
      {minhasVendas.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">Nenhuma venda registrada para você</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground w-20">Data</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Descrição</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground w-14">$</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground w-32">Conta atual</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground w-24">Valor</th>
                <th className="px-3 py-2 w-56"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {minhasVendas.map(l => {
                const conta = l.conta_id ? contaMap[l.conta_id] : null
                const valor = l.total ?? l.valor
                const isOpen = transferindo === l.id
                return (
                  <tr key={l.id} className={cn('hover:bg-white/[0.02] transition-colors', isOpen && 'bg-primary/[0.04]')}>
                    <td className="px-3 py-2.5 text-muted-foreground tabular-nums">
                      {fmtData(l.data ?? l.created_at)}
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium truncate max-w-[180px]">{l.descricao ?? l.item_descricao ?? '—'}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded',
                        l.tipo_dinheiro === 'sujo'
                          ? 'bg-orange-500/15 text-orange-400'
                          : 'bg-emerald-500/15 text-emerald-400'
                      )}>
                        {l.tipo_dinheiro === 'sujo' ? 'S' : 'L'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground truncate max-w-[128px]">
                      {conta?.nome ?? <span className="italic opacity-50">sem conta</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium text-emerald-400">
                      +{fmt(valor)}
                    </td>
                    <td className="px-3 py-2.5">
                      {isOpen ? (
                        <div className="flex items-center gap-1.5">
                          <Select value={destConta} onValueChange={setDestConta}>
                            <SelectTrigger className="h-7 text-xs w-36">
                              <SelectValue placeholder="Conta destino..." />
                            </SelectTrigger>
                            <SelectContent>
                              {contasAtivas.filter(c => c.id !== l.conta_id).map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button size="sm" className="h-7 text-xs px-2" disabled={!destConta || salvando}
                            onClick={() => handleTransferir(l)}>
                            OK
                          </Button>
                          <button onClick={() => { setTransferindo(null); setDestConta('') }}
                            className="text-xs text-muted-foreground hover:text-foreground px-1">✕</button>
                        </div>
                      ) : (
                        <button onClick={() => { setTransferindo(l.id); setDestConta('') }}
                          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors ml-auto">
                          <ArrowRightLeft className="h-3 w-3" />
                          Transferir
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <TrendingUp className="h-3.5 w-3.5" />
        <span>Total geral: <span className="text-foreground font-medium">{fmt(totalLimpo + totalSujo)}</span></span>
      </div>
    </div>
  )
}

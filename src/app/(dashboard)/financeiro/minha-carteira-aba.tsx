'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { ArrowRightLeft, Loader2, Wallet, TrendingUp, CheckCircle2 } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Conta, Lancamento, SbClient } from './financeiro-client'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return `R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}
function fmtData(s: string | null) {
  if (!s) return '—'
  const d = new Date(s + (s.includes('T') ? '' : 'T00:00:00'))
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

type FiltroAba = 'todos' | 'comigo' | 'repassado'

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  userId: string
  userNome: string | null
  contas: Conta[]
  setContas: React.Dispatch<React.SetStateAction<Conta[]>>
  lancamentos: Lancamento[]
  setLancamentos: React.Dispatch<React.SetStateAction<Lancamento[]>>
  sb: SbClient
}

// ── Componente ────────────────────────────────────────────────────────────────

export function MinhaCarteiraAba({ userId, userNome, contas, setContas, lancamentos, setLancamentos, sb }: Props) {
  const [meuContaId, setMeuContaId] = useState<string | null>(null)
  const [loadingConta, setLoadingConta] = useState(true)
  const [filtro, setFiltro] = useState<FiltroAba>('todos')

  // Transfer individual
  const [transferindoId, setTransferindoId] = useState<string | null>(null)
  const [destSingle, setDestSingle] = useState('')

  // Transferir tudo
  const [transferTudoOpen, setTransferTudoOpen] = useState(false)
  const [destTudo, setDestTudo] = useState('')

  // Transferir valor específico
  const [transferValorOpen, setTransferValorOpen] = useState(false)
  const [destValor, setDestValor] = useState('')
  const [valorInput, setValorInput] = useState('')
  const [tipoValor, setTipoValor] = useState<'sujo' | 'limpo'>('limpo')

  const [salvando, setSalvando] = useState(false)

  // Buscar conta do usuário
  useEffect(() => {
    setLoadingConta(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sb().from('usuarios').select('membro_id').eq('id', userId).maybeSingle().then(({ data }: any) => {
      const membroId = data?.membro_id
      if (membroId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sb().from('financeiro_contas').select('id').eq('membro_id', membroId).eq('status', 'ativo').maybeSingle().then(({ data: c }: any) => {
          setMeuContaId(c?.id ?? null)
          setLoadingConta(false)
        })
      } else {
        setLoadingConta(false)
      }
    })
  }, [userId, sb])

  const contaMap = useMemo(() => Object.fromEntries(contas.map(c => [c.id, c])), [contas])
  const contasAtivas = useMemo(() => contas.filter(c => c.status === 'ativo'), [contas])

  // Minhas vendas (todas, criadas por mim)
  const minhasVendas = useMemo(() =>
    lancamentos
      .filter(l => l.tipo === 'venda' && l.created_by === userId)
      .sort((a, b) => (b.data ?? b.created_at).localeCompare(a.data ?? a.created_at)),
    [lancamentos, userId]
  )

  // Classificar: "comigo" = ainda na minha conta | "repassado" = em outra conta
  const isComigo = useCallback((l: Lancamento) => !meuContaId || l.conta_id === meuContaId, [meuContaId])

  const comigo = useMemo(() => minhasVendas.filter(l => isComigo(l)), [minhasVendas, isComigo])
  const repassados = useMemo(() => minhasVendas.filter(l => !isComigo(l)), [minhasVendas, isComigo])

  const vendasFiltradas = useMemo(() => {
    if (filtro === 'comigo') return comigo
    if (filtro === 'repassado') return repassados
    return minhasVendas
  }, [filtro, comigo, repassados, minhasVendas])

  // Totais
  const calcTotal = (list: Lancamento[]) => ({
    limpo: list.filter(l => l.tipo_dinheiro === 'limpo').reduce((s, l) => s + (l.total ?? l.valor), 0),
    sujo: list.filter(l => l.tipo_dinheiro === 'sujo').reduce((s, l) => s + (l.total ?? l.valor), 0),
  })
  const totVendido = calcTotal(minhasVendas)
  const totComigo = calcTotal(comigo)
  const totRepassado = calcTotal(repassados)

  // ── Helpers de saldo ──────────────────────────────────────────────────────

  async function moverLancamento(lancId: string, oldContaId: string | null, newContaId: string, valor: number, sujo: boolean) {
    const { error } = await sb().from('financeiro_lancamentos').update({ conta_id: newContaId }).eq('id', lancId)
    if (error) throw new Error(error.message)
    const campo = sujo ? 'saldo_sujo' : 'saldo_limpo'
    if (oldContaId) {
      const orig = contaMap[oldContaId]
      if (orig) {
        await sb().from('financeiro_contas').update({ [campo]: (orig[campo] ?? 0) - valor }).eq('id', oldContaId)
        setContas(prev => prev.map(c => c.id === oldContaId ? { ...c, [campo]: (c[campo] ?? 0) - valor } : c))
      }
    }
    const dest = contaMap[newContaId]
    if (dest) {
      await sb().from('financeiro_contas').update({ [campo]: (dest[campo] ?? 0) + valor }).eq('id', newContaId)
      setContas(prev => prev.map(c => c.id === newContaId ? { ...c, [campo]: (c[campo] ?? 0) + valor } : c))
    }
    setLancamentos(prev => prev.map(l => l.id === lancId ? { ...l, conta_id: newContaId } : l))
  }

  // ── Transferir individual ──────────────────────────────────────────────────

  async function handleTransferirSingle(lanc: Lancamento) {
    if (!destSingle || destSingle === lanc.conta_id) { toast.error('Escolha uma conta destino diferente'); return }
    setSalvando(true)
    try {
      await moverLancamento(lanc.id, lanc.conta_id, destSingle, lanc.total ?? lanc.valor, lanc.tipo_dinheiro === 'sujo')
      setTransferindoId(null); setDestSingle('')
      toast.success(`Transferido para ${contaMap[destSingle]?.nome ?? 'conta'}`)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro') }
    finally { setSalvando(false) }
  }

  // ── Transferir tudo ───────────────────────────────────────────────────────

  async function handleTransferirTudo() {
    if (!destTudo) { toast.error('Escolha uma conta destino'); return }
    const lista = comigo
    if (lista.length === 0) { toast.info('Nenhuma venda com você'); return }
    setSalvando(true)
    try {
      for (const lanc of lista) {
        await moverLancamento(lanc.id, lanc.conta_id, destTudo, lanc.total ?? lanc.valor, lanc.tipo_dinheiro === 'sujo')
      }
      setTransferTudoOpen(false); setDestTudo('')
      toast.success(`${lista.length} venda(s) transferida(s) para ${contaMap[destTudo]?.nome ?? 'conta'}`)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro') }
    finally { setSalvando(false) }
  }

  // ── Transferir valor específico ───────────────────────────────────────────

  async function handleTransferirValor() {
    const valor = parseFloat(valorInput.replace(',', '.'))
    if (!destValor || isNaN(valor) || valor <= 0) { toast.error('Informe conta destino e valor válido'); return }
    if (!meuContaId) { toast.error('Sua conta não foi encontrada'); return }
    setSalvando(true)
    try {
      const sujo = tipoValor === 'sujo'
      const campo = sujo ? 'saldo_sujo' : 'saldo_limpo'
      const dataHoje = new Date().toISOString().split('T')[0]

      // Saída na minha conta
      await sb().from('financeiro_lancamentos').insert({
        conta_id: meuContaId, tipo: 'saida', tipo_dinheiro: tipoValor,
        valor, total: valor, descricao: `Repasse: ${contaMap[destValor]?.nome ?? 'conta'}`,
        categoria: 'repasse', data: dataHoje, created_by: userId,
        vai_para_faccao: false, origem: 'repasse',
      })
      const minhaConta = contaMap[meuContaId]
      if (minhaConta) {
        await sb().from('financeiro_contas').update({ [campo]: (minhaConta[campo] ?? 0) - valor }).eq('id', meuContaId)
        setContas(prev => prev.map(c => c.id === meuContaId ? { ...c, [campo]: (c[campo] ?? 0) - valor } : c))
      }

      // Entrada na conta destino
      const { data: novoLanc } = await sb().from('financeiro_lancamentos').insert({
        conta_id: destValor, tipo: 'entrada', tipo_dinheiro: tipoValor,
        valor, total: valor, descricao: `Recebido de: ${userNome ?? 'usuário'}`,
        categoria: 'repasse', data: dataHoje, created_by: userId,
        vai_para_faccao: false, origem: 'repasse',
      }).select().single()
      const contaDest = contaMap[destValor]
      if (contaDest) {
        await sb().from('financeiro_contas').update({ [campo]: (contaDest[campo] ?? 0) + valor }).eq('id', destValor)
        setContas(prev => prev.map(c => c.id === destValor ? { ...c, [campo]: (c[campo] ?? 0) + valor } : c))
      }
      if (novoLanc) setLancamentos(prev => [novoLanc as Lancamento, ...prev])

      setTransferValorOpen(false); setDestValor(''); setValorInput('')
      toast.success(`${fmt(valor)} repassado para ${contaMap[destValor]?.nome ?? 'conta'}`)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro') }
    finally { setSalvando(false) }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loadingConta) return (
    <div className="h-full flex items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  )

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* ── Stats cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Total vendido</p>
            <p className="text-base font-bold tabular-nums text-primary">{fmt(totVendido.limpo + totVendido.sujo)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              <span className="text-emerald-400">L {fmt(totVendido.limpo)}</span>
              {' · '}
              <span className="text-orange-400">S {fmt(totVendido.sujo)}</span>
            </p>
          </div>
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.03] px-4 py-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Já repassado</p>
            <p className="text-base font-bold tabular-nums text-emerald-400">{fmt(totRepassado.limpo + totRepassado.sujo)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {repassados.length} venda{repassados.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/[0.03] px-4 py-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Com você</p>
            <p className="text-base font-bold tabular-nums text-yellow-400">{fmt(totComigo.limpo + totComigo.sujo)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {comigo.length} venda{comigo.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Total vendas</p>
            <p className="text-base font-bold tabular-nums">{minhasVendas.length}</p>
          </div>
        </div>

        {/* ── Ações em massa ── */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Transferir tudo */}
          {transferTudoOpen ? (
            <div className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/20">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Transferir {comigo.length} venda(s) para:</span>
              <Select value={destTudo} onValueChange={setDestTudo}>
                <SelectTrigger className="h-7 text-xs w-40"><SelectValue placeholder="Conta..." /></SelectTrigger>
                <SelectContent>
                  {contasAtivas.filter(c => c.id !== meuContaId).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
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

          {/* Transferir valor específico */}
          {transferValorOpen ? (
            <div className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/20">
              <Input
                type="number" min="0" placeholder="Valor..."
                value={valorInput} onChange={e => setValorInput(e.target.value)}
                className="h-7 text-xs w-28" />
              <div className="flex gap-0.5">
                {(['limpo', 'sujo'] as const).map(t => (
                  <button key={t} onClick={() => setTipoValor(t)}
                    className={cn('px-2 h-7 text-[10px] rounded transition-colors font-medium',
                      tipoValor === t
                        ? (t === 'limpo' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-orange-500/20 text-orange-400')
                        : 'text-muted-foreground hover:text-foreground'
                    )}>
                    {t === 'limpo' ? 'L' : 'S'}
                  </button>
                ))}
              </div>
              <Select value={destValor} onValueChange={setDestValor}>
                <SelectTrigger className="h-7 text-xs w-40"><SelectValue placeholder="Conta..." /></SelectTrigger>
                <SelectContent>
                  {contasAtivas.filter(c => c.id !== meuContaId).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" className="h-7 text-xs" disabled={!destValor || !valorInput || salvando} onClick={handleTransferirValor}>
                {salvando ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Repassar'}
              </Button>
              <button onClick={() => { setTransferValorOpen(false); setDestValor(''); setValorInput('') }} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setTransferValorOpen(true)}>
              <Wallet className="h-3.5 w-3.5" />
              Repassar valor
            </Button>
          )}
        </div>

        {/* ── Filtro ── */}
        <div className="flex gap-0.5 border-b border-border">
          {([
            ['todos',    'Todas', minhasVendas.length],
            ['comigo',   'Com você', comigo.length],
            ['repassado','Repassadas', repassados.length],
          ] as const).map(([key, label, count]) => (
            <button key={key} onClick={() => setFiltro(key)}
              className={cn('px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                filtro === key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
              )}>
              {label}
              <span className="ml-1.5 text-[10px] opacity-60">({count})</span>
            </button>
          ))}
        </div>

        {/* ── Tabela ── */}
        {vendasFiltradas.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center">
            <p className="text-sm text-muted-foreground">
              {filtro === 'comigo' ? 'Nenhuma venda com você no momento' :
               filtro === 'repassado' ? 'Nenhuma venda repassada ainda' :
               'Nenhuma venda registrada para você'}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/30 border-b border-border sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground w-20">Data</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Cliente</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground w-14">$</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground w-24">Valor</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground w-28">Situação</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground w-32">Conta</th>
                  <th className="px-3 py-2 w-60"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {vendasFiltradas.map(l => {
                  const nomeCliente = l.descricao?.replace('Venda: ', '') ?? l.item_descricao ?? '—'
                  const conta = l.conta_id ? contaMap[l.conta_id] : null
                  const valor = l.total ?? l.valor
                  const eComigo = isComigo(l)
                  const isOpen = transferindoId === l.id

                  return (
                    <tr key={l.id} className={cn('hover:bg-white/[0.02] transition-colors', isOpen && 'bg-primary/[0.03]')}>
                      <td className="px-3 py-2.5 text-muted-foreground tabular-nums whitespace-nowrap">
                        {fmtData(l.data ?? l.created_at)}
                      </td>
                      <td className="px-3 py-2.5 font-medium max-w-[160px]">
                        <span className="truncate block">{nomeCliente}</span>
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
                      <td className="px-3 py-2.5 text-right tabular-nums font-medium text-primary">
                        {fmt(valor)}
                      </td>
                      <td className="px-3 py-2.5">
                        {eComigo ? (
                          <span className="flex items-center gap-1 text-yellow-400 text-[10px] font-medium">
                            <TrendingUp className="h-3 w-3" />Com você
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-emerald-400 text-[10px] font-medium">
                            <CheckCircle2 className="h-3 w-3" />Repassado
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground text-[11px] truncate max-w-[128px]">
                        {conta?.nome ?? <span className="italic opacity-40">sem conta</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        {isOpen ? (
                          <div className="flex items-center gap-1.5">
                            <Select value={destSingle} onValueChange={setDestSingle}>
                              <SelectTrigger className="h-7 text-xs w-36">
                                <SelectValue placeholder="Conta destino..." />
                              </SelectTrigger>
                              <SelectContent>
                                {contasAtivas.filter(c => c.id !== l.conta_id).map(c => (
                                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button size="sm" className="h-7 text-xs px-2.5"
                              disabled={!destSingle || salvando} onClick={() => handleTransferirSingle(l)}>
                              {salvando ? <Loader2 className="h-3 w-3 animate-spin" /> : 'OK'}
                            </Button>
                            <button onClick={() => { setTransferindoId(null); setDestSingle('') }}
                              className="text-xs text-muted-foreground hover:text-foreground px-1">✕</button>
                          </div>
                        ) : (
                          <button onClick={() => { setTransferindoId(l.id); setDestSingle('') }}
                            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors ml-auto">
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
      </div>
    </div>
  )
}

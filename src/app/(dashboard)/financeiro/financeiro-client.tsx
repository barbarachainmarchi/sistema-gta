'use client'

import { useState, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Plus, Wallet, Users, TrendingUp, TrendingDown, ArrowLeftRight,
  ShoppingCart, Trash2, Loader2, Minus, ChevronRight
} from 'lucide-react'

// ── Tipos ────────────────────────────────────────────────────────────────────

type Conta = {
  id: string; nome: string; tipo: 'faccao' | 'membro'
  subtipo: 'sujo' | 'limpo' | 'misto'; membro_id: string | null; saldo: number
}
type Membro  = { id: string; nome: string; vulgo: string | null }
type Cotacao = { id: string; titulo: string | null; fornecedor_nome: string; fornecedor_tipo: string }
type Lancamento = {
  id: string; conta_id: string; tipo: 'entrada' | 'saida' | 'transferencia'
  valor: number; descricao: string | null; categoria: string | null
  conta_destino_id: string | null; cotacao_id: string | null
  vai_para_faccao: boolean; acao_referencia: string | null
  created_at: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cotacoes: any
}

interface Props {
  userId: string; userNome: string | null
  contasIniciais: Conta[]; lancamentosIniciais: Lancamento[]
  membros: Membro[]; cotacoesFinaliz: Cotacao[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return `R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

const subtipoColor = { sujo: 'text-orange-400', limpo: 'text-emerald-400', misto: 'text-blue-400' }
const categoriaLabel: Record<string, string> = {
  compra: 'Compra', venda: 'Venda', reembolso: 'Reembolso', ajuste: 'Ajuste', acao: 'Ação', outro: 'Outro'
}

type Aba = 'todos' | 'entradas' | 'saidas' | 'compras'

// ── Componente ────────────────────────────────────────────────────────────────

export function FinanceiroClient({ userId, membros, contasIniciais, lancamentosIniciais, cotacoesFinaliz }: Props) {
  const sbRef = useRef<ReturnType<typeof createClient> | null>(null)
  const sb = useCallback(() => { if (!sbRef.current) sbRef.current = createClient(); return sbRef.current }, [])

  const [contas, setContas]       = useState<Conta[]>(contasIniciais)
  const [lancamentos, setLancamentos] = useState<Lancamento[]>(lancamentosIniciais)
  const [contaSel, setContaSel]   = useState<string | null>(null) // null = visão geral
  const [aba, setAba]             = useState<Aba>('todos')

  // Dialogs
  const [entradaOpen,   setEntradaOpen]   = useState(false)
  const [compraOpen,    setCompraOpen]    = useState(false)
  const [transOpen,     setTransOpen]     = useState(false)
  const [novaBolsoOpen, setNovaBolsoOpen] = useState(false)
  const [deleteId,      setDeleteId]      = useState<string | null>(null)

  // ── Mapa de contas ────────────────────────────────────────────────────────

  const contaMap = useMemo(() => Object.fromEntries(contas.map(c => [c.id, c])), [contas])

  // ── Lançamentos filtrados ─────────────────────────────────────────────────

  const lancFiltrados = useMemo(() => {
    let list = lancamentos
    if (contaSel) list = list.filter(l => l.conta_id === contaSel || l.conta_destino_id === contaSel)
    if (aba === 'entradas')  list = list.filter(l => l.tipo === 'entrada')
    if (aba === 'saidas')    list = list.filter(l => l.tipo === 'saida')
    if (aba === 'compras')   list = list.filter(l => l.categoria === 'compra')
    return list
  }, [lancamentos, contaSel, aba])

  // ── Totais ────────────────────────────────────────────────────────────────

  const { totalFac, totalMembros } = useMemo(() => ({
    totalFac:     contas.filter(c => c.tipo === 'faccao').reduce((s, c) => s + c.saldo, 0),
    totalMembros: contas.filter(c => c.tipo === 'membro').reduce((s, c) => s + c.saldo, 0),
  }), [contas])

  // ── Helpers saldo ─────────────────────────────────────────────────────────

  async function atualizarSaldo(contaId: string, delta: number) {
    const c = contaMap[contaId]
    if (!c) return
    const novo = c.saldo + delta
    await sb().from('financeiro_contas').update({ saldo: novo }).eq('id', contaId)
    setContas(prev => prev.map(x => x.id === contaId ? { ...x, saldo: novo } : x))
  }

  // ── Novo bolso ────────────────────────────────────────────────────────────

  const [bolsoForm, setBolsoForm] = useState({ nome: '', tipo: 'faccao' as 'faccao' | 'membro', subtipo: 'misto' as 'sujo'|'limpo'|'misto', membro_id: '' })
  const [criandoBolso, setCriandoBolso] = useState(false)

  async function handleCriarBolso() {
    if (!bolsoForm.nome.trim()) { toast.error('Nome obrigatório'); return }
    if (bolsoForm.tipo === 'membro' && !bolsoForm.membro_id) { toast.error('Selecione o membro'); return }
    setCriandoBolso(true)
    const { data, error } = await sb().from('financeiro_contas').insert({
      nome: bolsoForm.nome.trim(), tipo: bolsoForm.tipo, subtipo: bolsoForm.subtipo,
      membro_id: bolsoForm.tipo === 'membro' ? bolsoForm.membro_id : null, saldo: 0,
    }).select().single()
    setCriandoBolso(false)
    if (error) { toast.error(error.message); return }
    setContas(prev => [...prev, data as Conta].sort((a, b) => a.nome.localeCompare(b.nome)))
    setBolsoForm({ nome: '', tipo: 'faccao', subtipo: 'misto', membro_id: '' })
    setNovaBolsoOpen(false)
    toast.success('Bolso criado!')
  }

  // ── Entrada ───────────────────────────────────────────────────────────────

  const [entForm, setEntForm] = useState({
    conta_id: '', valor: '', descricao: '', categoria: 'outro',
    acao_referencia: '', vai_para_faccao: true,
  })
  const [salvandoEnt, setSalvandoEnt] = useState(false)

  async function handleEntrada() {
    const conta_id = entForm.conta_id || contaSel || ''
    const valor = parseFloat(entForm.valor)
    if (!conta_id) { toast.error('Selecione o bolso'); return }
    if (!valor || valor <= 0) { toast.error('Valor inválido'); return }
    setSalvandoEnt(true)
    const { data, error } = await sb().from('financeiro_lancamentos').insert({
      conta_id, tipo: 'entrada', valor,
      descricao: entForm.descricao.trim() || null,
      categoria: entForm.categoria,
      acao_referencia: entForm.categoria === 'acao' ? (entForm.acao_referencia.trim() || null) : null,
      vai_para_faccao: entForm.categoria === 'acao' ? entForm.vai_para_faccao : true,
      created_by: userId,
    }).select('*, cotacoes(titulo, fornecedor_nome, fornecedor_tipo)').single()
    if (error) { setSalvandoEnt(false); toast.error(error.message); return }
    await atualizarSaldo(conta_id, valor)
    setLancamentos(prev => [data as Lancamento, ...prev])
    setEntForm({ conta_id: '', valor: '', descricao: '', categoria: 'outro', acao_referencia: '', vai_para_faccao: true })
    setEntradaOpen(false)
    setSalvandoEnt(false)
    toast.success('Entrada registrada!')
  }

  // ── Compra (saída vinculada a cotação) ────────────────────────────────────

  const [compraForm, setCompraForm] = useState({ conta_id: '', cotacao_id: '', valor: '' })
  const [salvandoCompra, setSalvandoCompra] = useState(false)

  async function handleCompra() {
    const valor = parseFloat(compraForm.valor)
    if (!compraForm.conta_id) { toast.error('Selecione o bolso'); return }
    if (!compraForm.cotacao_id) { toast.error('Selecione a cotação'); return }
    if (!valor || valor <= 0) { toast.error('Valor inválido'); return }
    const cotacao = cotacoesFinaliz.find(c => c.id === compraForm.cotacao_id)
    setSalvandoCompra(true)
    const { data, error } = await sb().from('financeiro_lancamentos').insert({
      conta_id: compraForm.conta_id, tipo: 'saida', valor,
      descricao: `Compra: ${cotacao?.titulo ?? cotacao?.fornecedor_nome ?? ''}`,
      categoria: 'compra', cotacao_id: compraForm.cotacao_id,
      vai_para_faccao: true, created_by: userId,
    }).select('*, cotacoes(titulo, fornecedor_nome, fornecedor_tipo)').single()
    if (error) { setSalvandoCompra(false); toast.error(error.message); return }
    await atualizarSaldo(compraForm.conta_id, -valor)
    setLancamentos(prev => [data as Lancamento, ...prev])
    setCompraForm({ conta_id: '', cotacao_id: '', valor: '' })
    setCompraOpen(false)
    setSalvandoCompra(false)
    toast.success('Compra registrada!')
  }

  // ── Transferência ─────────────────────────────────────────────────────────

  const [transForm, setTransForm] = useState({ origem_id: '', destino_id: '', valor: '', descricao: '' })
  const [salvandoTrans, setSalvandoTrans] = useState(false)

  async function handleTransferencia() {
    const valor = parseFloat(transForm.valor)
    if (!transForm.origem_id || !transForm.destino_id) { toast.error('Selecione origem e destino'); return }
    if (transForm.origem_id === transForm.destino_id) { toast.error('Origem e destino iguais'); return }
    if (!valor || valor <= 0) { toast.error('Valor inválido'); return }
    setSalvandoTrans(true)
    const { data, error } = await sb().from('financeiro_lancamentos').insert({
      conta_id: transForm.origem_id, tipo: 'transferencia', valor,
      descricao: transForm.descricao.trim() || null,
      conta_destino_id: transForm.destino_id,
      vai_para_faccao: true, created_by: userId,
    }).select('*, cotacoes(titulo, fornecedor_nome, fornecedor_tipo)').single()
    if (error) { setSalvandoTrans(false); toast.error(error.message); return }
    await atualizarSaldo(transForm.origem_id, -valor)
    await atualizarSaldo(transForm.destino_id, valor)
    setLancamentos(prev => [data as Lancamento, ...prev])
    setTransForm({ origem_id: '', destino_id: '', valor: '', descricao: '' })
    setTransOpen(false)
    setSalvandoTrans(false)
    toast.success('Transferência registrada!')
  }

  // ── Deletar ───────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    const l = lancamentos.find(x => x.id === id)
    if (!l) return
    const { error } = await sb().from('financeiro_lancamentos').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    // reverter saldo
    if (l.tipo === 'entrada') await atualizarSaldo(l.conta_id, -l.valor)
    else if (l.tipo === 'saida') await atualizarSaldo(l.conta_id, l.valor)
    else if (l.tipo === 'transferencia') {
      await atualizarSaldo(l.conta_id, l.valor)
      if (l.conta_destino_id) await atualizarSaldo(l.conta_destino_id, -l.valor)
    }
    setLancamentos(prev => prev.filter(x => x.id !== id))
    setDeleteId(null)
    toast.success('Lançamento removido')
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const contaSelecionada = contaSel ? contaMap[contaSel] : null
  const faccaoContas = contas.filter(c => c.tipo === 'faccao')
  const membroContas = contas.filter(c => c.tipo === 'membro')

  return (
    <div className="h-[calc(100vh-3rem)] flex overflow-hidden">

      {/* ── Sidebar de bolsos ── */}
      <aside className="w-60 shrink-0 flex flex-col border-r border-border">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bolsos</span>
          <button onClick={() => setNovaBolsoOpen(true)}
            className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {/* Visão Geral */}
          <button onClick={() => setContaSel(null)}
            className={cn('w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors',
              !contaSel ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.03]'
            )}>
            <Wallet className="h-3.5 w-3.5 shrink-0" />
            <span className="text-sm flex-1">Visão Geral</span>
            <ChevronRight className="h-3 w-3 shrink-0 opacity-40" />
          </button>

          {faccaoContas.length > 0 && (
            <div className="mt-3">
              <p className="px-4 mb-1 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">Facção</p>
              {faccaoContas.map(c => <BolsoBtn key={c.id} conta={c} selected={contaSel === c.id} onClick={() => setContaSel(c.id)} />)}
            </div>
          )}

          {membroContas.length > 0 && (
            <div className="mt-3">
              <p className="px-4 mb-1 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">Membros</p>
              {membroContas.map(c => {
                const m = membros.find(mb => mb.id === c.membro_id)
                return <BolsoBtn key={c.id} conta={c} sub={m?.vulgo ?? m?.nome} selected={contaSel === c.id} onClick={() => setContaSel(c.id)} />
              })}
            </div>
          )}
        </div>
      </aside>

      {/* ── Painel principal ── */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-5 max-w-3xl">

          {/* Cards de resumo */}
          {!contaSelecionada ? (
            <div className="grid grid-cols-3 gap-3">
              <SaldoCard label="Facção" valor={totalFac} />
              <SaldoCard label="Membros" valor={totalMembros} />
              <SaldoCard label="Geral" valor={totalFac + totalMembros} destaque />
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-6">
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{contaSelecionada.nome}</p>
                <p className="text-xs text-muted-foreground mt-0.5 capitalize">{contaSelecionada.tipo} · <span className={subtipoColor[contaSelecionada.subtipo]}>{contaSelecionada.subtipo}</span></p>
              </div>
              <div className="ml-auto">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Saldo</p>
                <p className={cn('text-2xl font-bold tabular-nums mt-0.5', contaSelecionada.saldo >= 0 ? 'text-foreground' : 'text-red-400')}>
                  {fmtSaldo(contaSelecionada.saldo)}
                </p>
              </div>
            </div>
          )}

          {/* Ações */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setEntradaOpen(true)}>
              <TrendingUp className="h-3 w-3" />Entrada
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setCompraOpen(true)}>
              <ShoppingCart className="h-3 w-3" />Compra
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setTransOpen(true)}>
              <ArrowLeftRight className="h-3 w-3" />Transferência
            </Button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border">
            {([['todos','Todos'],['entradas','Entradas'],['saidas','Saídas'],['compras','Compras']] as [Aba,string][]).map(([key,label]) => (
              <button key={key} onClick={() => setAba(key)}
                className={cn('px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px',
                  aba === key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
                )}>{label}</button>
            ))}
            <span className="ml-auto text-[11px] text-muted-foreground self-center pr-1">{lancFiltrados.length} registros</span>
          </div>

          {/* Extrato */}
          {lancFiltrados.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-10 text-center">
              <p className="text-xs text-muted-foreground">Nenhum lançamento</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden divide-y divide-border/40">
              {lancFiltrados.map(l => {
                const isEntrada = l.tipo === 'entrada'
                const destNome = l.conta_destino_id ? contaMap[l.conta_destino_id]?.nome : null
                const origemNome = contaMap[l.conta_id]?.nome
                const cotNome = l.cotacoes ? (l.cotacoes.titulo ?? l.cotacoes.fornecedor_nome) : null
                const Icon = l.tipo === 'entrada' ? TrendingUp : l.tipo === 'transferencia' ? ArrowLeftRight : TrendingDown

                return (
                  <div key={l.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors group">
                    <div className={cn('shrink-0', isEntrada ? 'text-emerald-400' : l.tipo === 'transferencia' ? 'text-blue-400' : 'text-red-400')}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">
                          {l.descricao ||
                            (l.tipo === 'transferencia' ? `Transferência${destNome ? ` → ${destNome}` : ''}` :
                              categoriaLabel[l.categoria ?? ''] ?? l.tipo)}
                        </span>
                        {l.categoria && l.categoria !== 'outro' && (
                          <span className="text-[10px] text-muted-foreground">{categoriaLabel[l.categoria]}</span>
                        )}
                        {cotNome && <span className="text-[10px] text-muted-foreground">· {cotNome}</span>}
                        {l.acao_referencia && <span className="text-[10px] text-purple-400">#{l.acao_referencia}</span>}
                        {l.categoria === 'acao' && !l.vai_para_faccao && (
                          <span className="text-[10px] text-orange-400/70">não foi p/ facção</span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2">
                        <span>{new Date(l.created_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        {!contaSel && <span className="opacity-60">{origemNome}</span>}
                        {l.tipo === 'transferencia' && destNome && <span className="opacity-60">→ {destNome}</span>}
                      </p>
                    </div>
                    <span className={cn('text-sm font-semibold tabular-nums shrink-0',
                      isEntrada ? 'text-emerald-400' : l.tipo === 'transferencia' ? 'text-blue-400' : 'text-red-400'
                    )}>
                      {isEntrada ? '+' : l.tipo === 'transferencia' ? '' : '−'}{fmt(l.valor)}
                    </span>
                    <button onClick={() => setDeleteId(l.id)}
                      className="shrink-0 h-6 w-6 flex items-center justify-center rounded text-transparent group-hover:text-muted-foreground/40 hover:!text-destructive transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {/* ── Dialog: Novo bolso ── */}
      <Dialog open={novaBolsoOpen} onOpenChange={v => !v && setNovaBolsoOpen(false)}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">Novo Bolso</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome</Label>
              <Input value={bolsoForm.nome} onChange={e => setBolsoForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Caixa Sujo" className="h-8 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo</Label>
                <Select value={bolsoForm.tipo} onValueChange={v => setBolsoForm(f => ({ ...f, tipo: v as 'faccao'|'membro', membro_id: '' }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="faccao">Facção</SelectItem>
                    <SelectItem value="membro">Membro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Dinheiro</Label>
                <Select value={bolsoForm.subtipo} onValueChange={v => setBolsoForm(f => ({ ...f, subtipo: v as 'sujo'|'limpo'|'misto' }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="misto">Misto</SelectItem>
                    <SelectItem value="sujo">Sujo</SelectItem>
                    <SelectItem value="limpo">Limpo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {bolsoForm.tipo === 'membro' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Membro</Label>
                <Select value={bolsoForm.membro_id} onValueChange={v => setBolsoForm(f => ({ ...f, membro_id: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {membros.map(m => <SelectItem key={m.id} value={m.id}>{m.nome}{m.vulgo ? ` (${m.vulgo})` : ''}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setNovaBolsoOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleCriarBolso} disabled={criandoBolso}>
              {criandoBolso ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Criar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Entrada ── */}
      <Dialog open={entradaOpen} onOpenChange={v => !v && setEntradaOpen(false)}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">Nova Entrada</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Bolso</Label>
              <Select value={entForm.conta_id || contaSel || ''} onValueChange={v => setEntForm(f => ({ ...f, conta_id: v }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {contas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valor</Label>
              <Input type="number" placeholder="0" min="0" value={entForm.valor}
                onChange={e => setEntForm(f => ({ ...f, valor: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Categoria</Label>
              <Select value={entForm.categoria} onValueChange={v => setEntForm(f => ({ ...f, categoria: v }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="venda">Venda</SelectItem>
                  <SelectItem value="acao">Ação</SelectItem>
                  <SelectItem value="reembolso">Reembolso</SelectItem>
                  <SelectItem value="ajuste">Ajuste</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {entForm.categoria === 'acao' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Referência da Ação (número/código)</Label>
                  <Input value={entForm.acao_referencia} onChange={e => setEntForm(f => ({ ...f, acao_referencia: e.target.value }))}
                    placeholder="Ex: A-042" className="h-8 text-sm" />
                </div>
                <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <span className="text-xs">Foi para a facção?</span>
                  <Switch checked={entForm.vai_para_faccao} onCheckedChange={v => setEntForm(f => ({ ...f, vai_para_faccao: v }))} />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Descrição (opcional)</Label>
              <Input value={entForm.descricao} onChange={e => setEntForm(f => ({ ...f, descricao: e.target.value }))}
                placeholder="Ex: Venda de pistolas" className="h-8 text-sm" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEntradaOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleEntrada} disabled={salvandoEnt}>
              {salvandoEnt ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Registrar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Compra (saída via cotação) ── */}
      <Dialog open={compraOpen} onOpenChange={v => !v && setCompraOpen(false)}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-sm">Registrar Compra da Facção</DialogTitle></DialogHeader>
          <div className="space-y-4 py-1">

            {/* Cotações como lista selecionável */}
            <div className="space-y-1.5">
              <Label className="text-xs">Cotação finalizada</Label>
              {cotacoesFinaliz.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">Nenhuma cotação finalizada disponível</p>
              ) : (
                <div className="rounded-md border border-border overflow-hidden max-h-52 overflow-y-auto divide-y divide-border/40">
                  {cotacoesFinaliz.map(c => {
                    const sel = compraForm.cotacao_id === c.id
                    const tipoLabel = c.fornecedor_tipo === 'faccao' ? 'Facção' : c.fornecedor_tipo === 'loja' ? 'Loja' : 'Livre'
                    return (
                      <button key={c.id} type="button"
                        onClick={() => setCompraForm(f => ({ ...f, cotacao_id: c.id }))}
                        className={cn('w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors',
                          sel ? 'bg-primary/10' : 'hover:bg-white/[0.03]'
                        )}>
                        <div className={cn('w-1.5 h-1.5 rounded-full shrink-0 mt-0.5', sel ? 'bg-primary' : 'bg-border')} />
                        <div className="flex-1 min-w-0">
                          {c.titulo && <p className="text-sm font-medium truncate">{c.titulo}</p>}
                          <p className={cn('text-sm truncate', c.titulo ? 'text-xs text-muted-foreground' : 'font-medium')}>
                            {c.fornecedor_nome}
                          </p>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0 capitalize">{tipoLabel}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Bolso da facção</Label>
                <Select value={compraForm.conta_id} onValueChange={v => setCompraForm(f => ({ ...f, conta_id: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {faccaoContas.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome} — {c.subtipo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Valor total pago</Label>
                <Input type="number" placeholder="0" min="0" value={compraForm.valor}
                  onChange={e => setCompraForm(f => ({ ...f, valor: e.target.value }))} className="h-8 text-sm" />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setCompraOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleCompra} disabled={salvandoCompra}>
              {salvandoCompra ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Registrar saída'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Transferência ── */}
      <Dialog open={transOpen} onOpenChange={v => !v && setTransOpen(false)}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">Transferência entre Bolsos</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Origem</Label>
              <Select value={transForm.origem_id} onValueChange={v => setTransForm(f => ({ ...f, origem_id: v }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {contas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Destino</Label>
              <Select value={transForm.destino_id} onValueChange={v => setTransForm(f => ({ ...f, destino_id: v }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {contas.filter(c => c.id !== transForm.origem_id).map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valor</Label>
              <Input type="number" placeholder="0" min="0" value={transForm.valor}
                onChange={e => setTransForm(f => ({ ...f, valor: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descrição (opcional)</Label>
              <Input value={transForm.descricao} onChange={e => setTransForm(f => ({ ...f, descricao: e.target.value }))}
                placeholder="Ex: Repasse para João" className="h-8 text-sm" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setTransOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleTransferencia} disabled={salvandoTrans}>
              {salvandoTrans ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Transferir'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: confirmar delete ── */}
      <Dialog open={!!deleteId} onOpenChange={v => !v && setDeleteId(null)}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-xs">
          <DialogHeader><DialogTitle className="text-sm">Remover lançamento?</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">O saldo do bolso será revertido automaticamente.</p>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" size="sm" onClick={() => deleteId && handleDelete(deleteId)}>Remover</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Subcomponentes ─────────────────────────────────────────────────────────────

function BolsoBtn({ conta, sub, selected, onClick }: { conta: Conta; sub?: string; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={cn('w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors',
        selected ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.03]'
      )}>
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate">{conta.nome}</div>
        {sub && <div className="text-[10px] text-muted-foreground/60">{sub}</div>}
      </div>
      <span className={cn('text-xs tabular-nums font-medium shrink-0', conta.saldo >= 0 ? 'text-foreground/70' : 'text-red-400')}>
        {fmtSaldo(conta.saldo)}
      </span>
    </button>
  )
}

function SaldoCard({ label, valor, destaque }: { label: string; valor: number; destaque?: boolean }) {
  return (
    <div className={cn('rounded-lg border p-4', destaque ? 'border-primary/30 bg-primary/[0.04]' : 'border-border bg-card')}>
      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={cn('text-xl font-bold mt-1 tabular-nums', valor >= 0 ? 'text-foreground' : 'text-red-400')}>
        {fmtSaldo(valor)}
      </p>
    </div>
  )
}

function fmtSaldo(v: number) {
  return (v < 0 ? '−' : '') + `R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

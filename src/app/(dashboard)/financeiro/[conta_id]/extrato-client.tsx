'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  ArrowLeft, Plus, TrendingUp, TrendingDown, ArrowLeftRight,
  Trash2, ShoppingCart, Loader2
} from 'lucide-react'

type Conta = { id: string; nome: string; tipo: string; subtipo: string; saldo: number }
type ContaSimples = { id: string; nome: string; subtipo: string }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Lancamento = { id: string; tipo: string; valor: number; descricao: string | null; categoria: string | null; conta_destino_id: string | null; cotacao_id: string | null; created_at: string; cotacoes: any }
type CotacaoOpt = { id: string; titulo: string | null; fornecedor_nome: string; fornecedor_tipo: string }

interface Props {
  userId: string
  userNome: string | null
  conta: Conta
  lancamentosIniciais: Lancamento[]
  todasContas: ContaSimples[]
  cotacoesFinaliz: CotacaoOpt[]
}

function fmt(v: number) {
  return `R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

const tipoIcon = { entrada: TrendingUp, saida: TrendingDown, transferencia: ArrowLeftRight }
const tipoColor = { entrada: 'text-emerald-400', saida: 'text-red-400', transferencia: 'text-blue-400' }
const categoriaLabel: Record<string, string> = { compra: 'Compra', venda: 'Venda', reembolso: 'Reembolso', ajuste: 'Ajuste', outro: 'Outro' }

export function ExtratoClient({ userId, userNome, conta: contaInicial, lancamentosIniciais, todasContas, cotacoesFinaliz }: Props) {
  const router = useRouter()
  const sbRef = useRef<ReturnType<typeof createClient> | null>(null)
  const sb = useCallback(() => { if (!sbRef.current) sbRef.current = createClient(); return sbRef.current }, [])

  const [conta, setConta] = useState(contaInicial)
  const [lancamentos, setLancamentos] = useState<Lancamento[]>(lancamentosIniciais)

  // Dialog: novo lançamento
  const [lancOpen, setLancOpen] = useState(false)
  const [lancForm, setLancForm] = useState({
    tipo: 'entrada' as 'entrada' | 'saida' | 'transferencia',
    valor: '', descricao: '',
    categoria: 'outro' as string,
    conta_destino_id: '',
  })
  const [salvando, setSalvando] = useState(false)

  // Dialog: registrar compra via cotação
  const [cotacaoOpen, setCotacaoOpen] = useState(false)
  const [cotacaoSel, setCotacaoSel] = useState('')
  const [valorCotacao, setValorCotacao] = useState('')
  const [salvandoCotacao, setSalvandoCotacao] = useState(false)

  // Dialog: confirmar delete
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // ── Helpers de saldo ──────────────────────────────────────────────────────

  function deltaSaldo(tipo: string, valor: number) {
    if (tipo === 'entrada') return valor
    if (tipo === 'saida') return -valor
    return -valor // transferencia sai desta conta
  }

  // ── Novo lançamento ───────────────────────────────────────────────────────

  async function handleLancamento() {
    const valor = parseFloat(lancForm.valor)
    if (!valor || valor <= 0) { toast.error('Valor inválido'); return }
    if (lancForm.tipo === 'transferencia' && !lancForm.conta_destino_id) { toast.error('Selecione a conta destino'); return }

    setSalvando(true)
    const { data, error } = await sb().from('financeiro_lancamentos').insert({
      conta_id: conta.id,
      tipo: lancForm.tipo,
      valor,
      descricao: lancForm.descricao.trim() || null,
      categoria: lancForm.tipo !== 'transferencia' ? lancForm.categoria : null,
      conta_destino_id: lancForm.tipo === 'transferencia' ? lancForm.conta_destino_id : null,
      created_by: userId,
    }).select('*, cotacoes(titulo, fornecedor_nome)').single()

    if (error) { setSalvando(false); toast.error('Erro: ' + error.message); return }

    // Atualiza saldo desta conta
    const novoSaldo = conta.saldo + deltaSaldo(lancForm.tipo, valor)
    await sb().from('financeiro_contas').update({ saldo: novoSaldo }).eq('id', conta.id)
    setConta(c => ({ ...c, saldo: novoSaldo }))

    // Se transferência, atualiza conta destino
    if (lancForm.tipo === 'transferencia' && lancForm.conta_destino_id) {
      const { data: dest } = await sb().from('financeiro_contas').select('saldo').eq('id', lancForm.conta_destino_id).single()
      if (dest) {
        await sb().from('financeiro_contas').update({ saldo: dest.saldo + valor }).eq('id', lancForm.conta_destino_id)
      }
    }

    setLancamentos(prev => [data as Lancamento, ...prev])
    setLancForm({ tipo: 'entrada', valor: '', descricao: '', categoria: 'outro', conta_destino_id: '' })
    setLancOpen(false)
    setSalvando(false)
    toast.success('Lançamento registrado!')
  }

  // ── Registrar compra via cotação ──────────────────────────────────────────

  async function handleCotacao() {
    const valor = parseFloat(valorCotacao)
    if (!cotacaoSel) { toast.error('Selecione a cotação'); return }
    if (!valor || valor <= 0) { toast.error('Informe o valor total'); return }

    setSalvandoCotacao(true)
    const cotacao = cotacoesFinaliz.find(c => c.id === cotacaoSel)
    const { data, error } = await sb().from('financeiro_lancamentos').insert({
      conta_id: conta.id,
      tipo: 'saida',
      valor,
      descricao: `Compra: ${cotacao?.titulo ?? cotacao?.fornecedor_nome ?? ''}`,
      categoria: 'compra',
      cotacao_id: cotacaoSel,
      created_by: userId,
    }).select('*, cotacoes(titulo, fornecedor_nome)').single()

    if (error) { setSalvandoCotacao(false); toast.error('Erro: ' + error.message); return }

    const novoSaldo = conta.saldo - valor
    await sb().from('financeiro_contas').update({ saldo: novoSaldo }).eq('id', conta.id)
    setConta(c => ({ ...c, saldo: novoSaldo }))

    setLancamentos(prev => [data as Lancamento, ...prev])
    setCotacaoSel(''); setValorCotacao('')
    setCotacaoOpen(false)
    setSalvandoCotacao(false)
    toast.success('Compra registrada!')
  }

  // ── Deletar lançamento ────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    const lanc = lancamentos.find(l => l.id === id)
    if (!lanc) return

    const { error } = await sb().from('financeiro_lancamentos').delete().eq('id', id)
    if (error) { toast.error('Erro: ' + error.message); return }

    // Reverte o saldo
    const novoSaldo = conta.saldo - deltaSaldo(lanc.tipo, lanc.valor)
    await sb().from('financeiro_contas').update({ saldo: novoSaldo }).eq('id', conta.id)
    setConta(c => ({ ...c, saldo: novoSaldo }))

    setLancamentos(prev => prev.filter(l => l.id !== id))
    setDeleteId(null)
    toast.success('Lançamento removido')
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-5 max-w-3xl">

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => router.push('/financeiro')}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />Voltar
        </button>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setCotacaoOpen(true)}>
            <ShoppingCart className="h-3 w-3" />Registrar compra
          </Button>
          <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setLancOpen(true)}>
            <Plus className="h-3 w-3" />Lançamento
          </Button>
        </div>
      </div>

      {/* Card da conta */}
      <div className="rounded-lg border border-border bg-card p-5 flex items-center gap-6 flex-wrap">
        <div>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Bolso</p>
          <p className="font-semibold mt-0.5">{conta.nome}</p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Tipo</p>
          <p className="font-medium mt-0.5 capitalize">{conta.tipo} · {conta.subtipo}</p>
        </div>
        <div className="ml-auto">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Saldo</p>
          <p className={cn('text-2xl font-bold mt-0.5 tabular-nums', conta.saldo >= 0 ? 'text-foreground' : 'text-red-400')}>
            {conta.saldo < 0 && '−'}{fmt(conta.saldo)}
          </p>
        </div>
      </div>

      {/* Extrato */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Extrato</h3>
        {lancamentos.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center">
            <p className="text-xs text-muted-foreground">Nenhum lançamento ainda</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden divide-y divide-border/40">
            {lancamentos.map(l => {
              const Icon = tipoIcon[l.tipo as keyof typeof tipoIcon] ?? TrendingUp
              const positivo = l.tipo === 'entrada'
              const destNome = l.conta_destino_id ? todasContas.find(c => c.id === l.conta_destino_id)?.nome : null
              const cotacaoNome = l.cotacoes ? (l.cotacoes.titulo ?? l.cotacoes.fornecedor_nome) : null

              return (
                <div key={l.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors group">
                  <div className={cn('shrink-0', tipoColor[l.tipo as keyof typeof tipoColor])}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">
                        {l.descricao || (l.tipo === 'transferencia' ? `Transferência${destNome ? ` → ${destNome}` : ''}` : categoriaLabel[l.categoria ?? ''] ?? l.tipo)}
                      </span>
                      {l.categoria && <span className="text-[10px] text-muted-foreground capitalize">{categoriaLabel[l.categoria]}</span>}
                      {cotacaoNome && <span className="text-[10px] text-muted-foreground">· {cotacaoNome}</span>}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {new Date(l.created_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <span className={cn('text-sm font-semibold tabular-nums shrink-0', positivo ? 'text-emerald-400' : 'text-red-400')}>
                    {positivo ? '+' : '−'}{fmt(l.valor)}
                  </span>
                  <button onClick={() => setDeleteId(l.id)}
                    className="shrink-0 h-6 w-6 flex items-center justify-center rounded text-muted-foreground/0 group-hover:text-muted-foreground/40 hover:!text-destructive transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Dialog: novo lançamento */}
      <Dialog open={lancOpen} onOpenChange={v => !v && setLancOpen(false)}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">Novo Lançamento</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <Select value={lancForm.tipo} onValueChange={v => setLancForm(f => ({ ...f, tipo: v as typeof f.tipo, conta_destino_id: '' }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valor</Label>
              <Input type="number" placeholder="0" min="0" value={lancForm.valor}
                onChange={e => setLancForm(f => ({ ...f, valor: e.target.value }))}
                className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descrição (opcional)</Label>
              <Input value={lancForm.descricao} onChange={e => setLancForm(f => ({ ...f, descricao: e.target.value }))}
                placeholder="Ex: Venda de armas" className="h-8 text-sm" />
            </div>
            {lancForm.tipo !== 'transferencia' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Categoria</Label>
                <Select value={lancForm.categoria} onValueChange={v => setLancForm(f => ({ ...f, categoria: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="venda">Venda</SelectItem>
                    <SelectItem value="compra">Compra</SelectItem>
                    <SelectItem value="reembolso">Reembolso</SelectItem>
                    <SelectItem value="ajuste">Ajuste</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {lancForm.tipo === 'transferencia' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Conta destino</Label>
                <Select value={lancForm.conta_destino_id} onValueChange={v => setLancForm(f => ({ ...f, conta_destino_id: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {todasContas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome} <span className="text-muted-foreground">({c.subtipo})</span></SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setLancOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleLancamento} disabled={salvando}>
              {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Registrar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: registrar compra via cotação */}
      <Dialog open={cotacaoOpen} onOpenChange={v => !v && setCotacaoOpen(false)}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">Registrar Compra</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Cotação finalizada</Label>
              {cotacoesFinaliz.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma cotação finalizada disponível</p>
              ) : (
                <Select value={cotacaoSel} onValueChange={setCotacaoSel}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {cotacoesFinaliz.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.titulo ?? c.fornecedor_nome}
                        <span className="text-muted-foreground ml-1 capitalize">({c.fornecedor_tipo})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valor total pago</Label>
              <Input type="number" placeholder="0" min="0" value={valorCotacao}
                onChange={e => setValorCotacao(e.target.value)} className="h-8 text-sm" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setCotacaoOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleCotacao} disabled={salvandoCotacao}>
              {salvandoCotacao ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Registrar saída'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: confirmar delete */}
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

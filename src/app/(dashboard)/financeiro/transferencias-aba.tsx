'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ArrowLeftRight, Trash2, Loader2 } from 'lucide-react'
import type { Conta, Lancamento, SbClient } from './financeiro-client'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}
function fmtData(s: string | null) {
  if (!s) return '—'
  const d = new Date(s + (s.includes('T') ? '' : 'T00:00:00'))
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
function today() { return new Date().toISOString().split('T')[0] }

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  contas: Conta[]
  lancamentos: Lancamento[]
  setLancamentos: React.Dispatch<React.SetStateAction<Lancamento[]>>
  atualizarSaldo: (contaId: string, deltaSujo: number, deltaLimpo: number) => Promise<void>
  userId: string
  sb: SbClient
  podeEditar: boolean
}

// ── Componente ────────────────────────────────────────────────────────────────

export function TransferenciasAba({ contas, lancamentos, setLancamentos, atualizarSaldo, userId, sb, podeEditar }: Props) {
  const [salvando, setSalvando]   = useState(false)
  const [deleteId, setDeleteId]   = useState<string | null>(null)
  const [form, setForm] = useState({
    origem_id: '', destino_id: '',
    tipo_dinheiro: 'limpo' as 'sujo' | 'limpo',
    valor: '', data: today(), descricao: '',
  })

  const contasAtivas = useMemo(() => contas.filter(c => c.status === 'ativo'), [contas])
  const contaMap     = useMemo(() => Object.fromEntries(contas.map(c => [c.id, c])), [contas])
  const transfers    = useMemo(() => lancamentos.filter(l => l.tipo === 'transferencia'), [lancamentos])

  function setF(patch: Partial<typeof form>) { setForm(prev => ({ ...prev, ...patch })) }

  async function handleSalvar() {
    const valor = parseFloat(form.valor)
    if (!form.origem_id)                         { toast.error('Selecione a origem'); return }
    if (!form.destino_id)                        { toast.error('Selecione o destino'); return }
    if (form.origem_id === form.destino_id)      { toast.error('Origem e destino iguais'); return }
    if (!valor || valor <= 0)                    { toast.error('Valor inválido'); return }

    setSalvando(true)
    const { data, error } = await sb().from('financeiro_lancamentos').insert({
      conta_id:        form.origem_id,
      conta_destino_id: form.destino_id,
      tipo:            'transferencia',
      tipo_dinheiro:   form.tipo_dinheiro,
      valor,
      data:            form.data || null,
      descricao:       form.descricao.trim() || null,
      vai_para_faccao: true,
      created_by:      userId,
    }).select('*, cotacoes(titulo, fornecedor_nome)').single()

    if (error) { setSalvando(false); toast.error(error.message); return }

    const sujo = form.tipo_dinheiro === 'sujo'
    await atualizarSaldo(form.origem_id,  sujo ? -valor : 0, sujo ? 0 : -valor)
    await atualizarSaldo(form.destino_id, sujo ?  valor : 0, sujo ? 0 :  valor)

    setLancamentos(prev => [data as Lancamento, ...prev])
    setForm({ origem_id: '', destino_id: '', tipo_dinheiro: 'limpo', valor: '', data: today(), descricao: '' })
    setSalvando(false)
    toast.success('Transferência registrada!')
  }

  async function handleDelete(id: string) {
    const l = lancamentos.find(x => x.id === id)
    if (!l || l.tipo !== 'transferencia') return
    const { error } = await sb().from('financeiro_lancamentos').delete().eq('id', id)
    if (error) { toast.error(error.message); return }

    const sujo = l.tipo_dinheiro === 'sujo'
    await atualizarSaldo(l.conta_id, sujo ? l.valor : 0, sujo ? 0 : l.valor)
    if (l.conta_destino_id)
      await atualizarSaldo(l.conta_destino_id, sujo ? -l.valor : 0, sujo ? 0 : -l.valor)

    setLancamentos(prev => prev.filter(x => x.id !== id))
    setDeleteId(null)
    toast.success('Transferência removida')
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6 max-w-2xl">

      {/* ── Formulário ── */}
      {podeEditar && <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <h3 className="text-sm font-medium">Nova transferência</h3>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">De (origem)</Label>
            <Select value={form.origem_id || 'sem'} onValueChange={v => setF({ origem_id: v === 'sem' ? '' : v })}>
              <SelectTrigger className="text-xs h-9"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sem">Selecione...</SelectItem>
                {contasAtivas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Para (destino)</Label>
            <Select value={form.destino_id || 'sem'} onValueChange={v => setF({ destino_id: v === 'sem' ? '' : v })}>
              <SelectTrigger className="text-xs h-9"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sem">Selecione...</SelectItem>
                {contasAtivas.filter(c => c.id !== form.origem_id).map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Tipo de dinheiro</Label>
            <div className="flex rounded-lg overflow-hidden border border-border h-9">
              {(['limpo', 'sujo'] as const).map(t => (
                <button key={t} onClick={() => setF({ tipo_dinheiro: t })}
                  className={cn('flex-1 text-xs font-medium transition-colors',
                    form.tipo_dinheiro === t
                      ? t === 'limpo' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-orange-500/20 text-orange-400'
                      : 'text-muted-foreground hover:text-foreground',
                    t === 'sujo' && 'border-l border-border'
                  )}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Valor</Label>
            <Input type="number" min="0" className="h-9 text-xs" placeholder="0"
              value={form.valor} onChange={e => setF({ valor: e.target.value })} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Data</Label>
            <Input type="date" className="h-9 text-xs"
              value={form.data} onChange={e => setF({ data: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Descrição (opcional)</Label>
            <Input className="h-9 text-xs" placeholder="Motivo..."
              value={form.descricao} onChange={e => setF({ descricao: e.target.value })} />
          </div>
        </div>

        <div className="flex justify-end">
          <Button size="sm" onClick={handleSalvar} disabled={salvando} className="gap-1">
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeftRight className="h-3.5 w-3.5" />}
            Transferir
          </Button>
        </div>
      </div>}

      {/* ── Histórico ── */}
      <div>
        <h3 className="text-sm font-medium mb-3">Histórico de transferências</h3>
        {transfers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma transferência</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden divide-y divide-border/40">
            {transfers.map(l => {
              const origem  = contaMap[l.conta_id]
              const destino = l.conta_destino_id ? contaMap[l.conta_destino_id] : null
              return (
                <div key={l.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] group">
                  <ArrowLeftRight className="h-4 w-4 text-blue-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{origem?.nome ?? '?'}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-medium">{destino?.nome ?? '?'}</span>
                      {l.tipo_dinheiro && (
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium',
                          l.tipo_dinheiro === 'sujo'
                            ? 'bg-orange-500/15 text-orange-400'
                            : 'bg-emerald-500/15 text-emerald-400'
                        )}>
                          {l.tipo_dinheiro}
                        </span>
                      )}
                    </div>
                    {l.descricao && <p className="text-xs text-muted-foreground">{l.descricao}</p>}
                    <p className="text-[11px] text-muted-foreground">{fmtData(l.data ?? l.created_at)}</p>
                  </div>
                  <span className="font-medium text-sm tabular-nums">{fmt(l.valor)}</span>
                  <button onClick={() => setDeleteId(l.id)}
                    className="p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/10 text-muted-foreground hover:text-red-400">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Confirmar delete ── */}
      <Dialog open={!!deleteId} onOpenChange={o => { if (!o) setDeleteId(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Remover transferência?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Os saldos serão revertidos automaticamente.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" size="sm" onClick={() => deleteId && handleDelete(deleteId)}>
              Remover
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

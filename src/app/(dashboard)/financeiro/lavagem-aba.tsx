'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { RefreshCw, Trash2, Loader2, ArrowRight, Percent } from 'lucide-react'
import type { Conta, Lavagem, SbClient } from './financeiro-client'

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
  lavagens: Lavagem[]
  setLavagens: React.Dispatch<React.SetStateAction<Lavagem[]>>
  atualizarSaldo: (contaId: string, deltaSujo: number, deltaLimpo: number) => Promise<void>
  userId: string
  sb: SbClient
}

// ── Componente ────────────────────────────────────────────────────────────────

export function LavagemAba({ contas, lavagens, setLavagens, atualizarSaldo, userId, sb }: Props) {
  const [salvando, setSalvando] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [usarTaxa, setUsarTaxa] = useState(false)
  const [form, setForm] = useState({
    conta_id:      '',
    conversao_tipo: 'sujo_para_limpo' as 'sujo_para_limpo' | 'limpo_para_sujo',
    valor_origem:  '',
    valor_destino: '',
    taxa:          '',
    data:          today(),
    descricao:     '',
  })

  const contasAtivas = useMemo(() => contas.filter(c => c.status === 'ativo'), [contas])
  const contaMap     = useMemo(() => Object.fromEntries(contas.map(c => [c.id, c])), [contas])

  function setF(patch: Partial<typeof form>) { setForm(prev => ({ ...prev, ...patch })) }

  function onOrigChange(val: string) {
    const o = parseFloat(val) || 0
    const t = parseFloat(form.taxa) || 0
    if (usarTaxa && o && t) {
      const destino = o * (1 - t / 100)
      setF({ valor_origem: val, valor_destino: destino.toFixed(0) })
    } else {
      setF({ valor_origem: val })
    }
  }
  function onTaxaChange(val: string) {
    const t = parseFloat(val) || 0
    const o = parseFloat(form.valor_origem) || 0
    if (o && t) {
      const destino = o * (1 - t / 100)
      setF({ taxa: val, valor_destino: destino.toFixed(0) })
    } else {
      setF({ taxa: val })
    }
  }

  async function handleSalvar() {
    const origem  = parseFloat(form.valor_origem) || 0
    const destino = parseFloat(form.valor_destino) || 0
    if (!form.conta_id)       { toast.error('Selecione a conta'); return }
    if (!origem || origem <= 0)   { toast.error('Valor de origem inválido'); return }
    if (!destino || destino <= 0) { toast.error('Valor de destino inválido'); return }

    setSalvando(true)
    const { data, error } = await sb().from('financeiro_lavagem').insert({
      conta_id:       form.conta_id,
      conversao_tipo: form.conversao_tipo,
      valor_origem:   origem,
      valor_destino:  destino,
      taxa_percentual: usarTaxa ? parseFloat(form.taxa) || null : null,
      data:           form.data || null,
      descricao:      form.descricao.trim() || null,
      created_by:     userId,
    }).select().single()

    if (error) { setSalvando(false); toast.error(error.message); return }

    // Atualizar saldo
    if (form.conversao_tipo === 'sujo_para_limpo') {
      await atualizarSaldo(form.conta_id, -origem, +destino)
    } else {
      await atualizarSaldo(form.conta_id, +destino, -origem)
    }

    setLavagens(prev => [data as Lavagem, ...prev])
    setForm({ conta_id: '', conversao_tipo: 'sujo_para_limpo', valor_origem: '', valor_destino: '', taxa: '', data: today(), descricao: '' })
    setSalvando(false)
    toast.success('Lavagem registrada!')
  }

  async function handleDelete(id: string) {
    const l = lavagens.find(x => x.id === id)
    if (!l) return
    const { error } = await sb().from('financeiro_lavagem').delete().eq('id', id)
    if (error) { toast.error(error.message); return }

    // Reverter saldo
    if (l.conversao_tipo === 'sujo_para_limpo') {
      await atualizarSaldo(l.conta_id, +l.valor_origem, -l.valor_destino)
    } else {
      await atualizarSaldo(l.conta_id, -l.valor_destino, +l.valor_origem)
    }

    setLavagens(prev => prev.filter(x => x.id !== id))
    setDeleteId(null)
    toast.success('Lavagem removida')
  }

  const isSujoParaLimpo = form.conversao_tipo === 'sujo_para_limpo'

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6 max-w-2xl">

      {/* ── Formulário ── */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <h3 className="text-sm font-medium">Nova lavagem</h3>

        <div className="space-y-1">
          <Label className="text-xs">Conta</Label>
          <Select value={form.conta_id || 'sem'} onValueChange={v => setF({ conta_id: v === 'sem' ? '' : v })}>
            <SelectTrigger className="text-xs h-9"><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sem">Selecione...</SelectItem>
              {contasAtivas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Tipo de conversão */}
        <div className="space-y-1">
          <Label className="text-xs">Tipo de conversão</Label>
          <div className="flex rounded-lg overflow-hidden border border-border">
            <button
              onClick={() => setF({ conversao_tipo: 'sujo_para_limpo' })}
              className={cn('flex-1 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1.5',
                isSujoParaLimpo ? 'bg-emerald-500/20 text-emerald-400' : 'text-muted-foreground hover:text-foreground'
              )}>
              <span className="text-orange-400">Sujo</span>
              <ArrowRight className="h-3 w-3" />
              <span className="text-emerald-400">Limpo</span>
            </button>
            <button
              onClick={() => setF({ conversao_tipo: 'limpo_para_sujo' })}
              className={cn('flex-1 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 border-l border-border',
                !isSujoParaLimpo ? 'bg-orange-500/20 text-orange-400' : 'text-muted-foreground hover:text-foreground'
              )}>
              <span className="text-emerald-400">Limpo</span>
              <ArrowRight className="h-3 w-3" />
              <span className="text-orange-400">Sujo</span>
            </button>
          </div>
        </div>

        {/* Modo: valor direto ou taxa */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setUsarTaxa(false)}
            className={cn('flex-1 py-1.5 text-xs rounded-md border transition-colors',
              !usarTaxa ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground'
            )}>
            Por valor
          </button>
          <button
            onClick={() => setUsarTaxa(true)}
            className={cn('flex-1 py-1.5 text-xs rounded-md border transition-colors flex items-center justify-center gap-1',
              usarTaxa ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground'
            )}>
            <Percent className="h-3 w-3" /> Por taxa
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">
              Valor {isSujoParaLimpo ? 'sujo' : 'limpo'} (origem)
            </Label>
            <Input type="number" min="0" className="h-9 text-xs" placeholder="0"
              value={form.valor_origem} onChange={e => onOrigChange(e.target.value)} />
          </div>

          {usarTaxa ? (
            <div className="space-y-1">
              <Label className="text-xs">Taxa (%)</Label>
              <Input type="number" min="0" max="100" className="h-9 text-xs" placeholder="ex: 20"
                value={form.taxa} onChange={e => onTaxaChange(e.target.value)} />
            </div>
          ) : (
            <div className="flex items-center justify-center pt-5">
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs">
              Valor {isSujoParaLimpo ? 'limpo' : 'sujo'} (destino)
            </Label>
            <Input type="number" min="0" placeholder="0"
              className={cn('h-9 text-xs', usarTaxa && 'bg-muted/30 cursor-default')}
              value={form.valor_destino}
              onChange={e => setF({ valor_destino: e.target.value })}
              readOnly={usarTaxa} />
          </div>
        </div>

        {form.valor_origem && form.valor_destino && parseFloat(form.valor_origem) > 0 && (
          <p className="text-xs text-muted-foreground">
            Taxa efetiva:{' '}
            <span className="text-foreground font-medium">
              {((1 - parseFloat(form.valor_destino) / parseFloat(form.valor_origem)) * 100).toFixed(1)}%
            </span>
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Data</Label>
            <Input type="date" className="h-9 text-xs"
              value={form.data} onChange={e => setF({ data: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Descrição (opcional)</Label>
            <Input className="h-9 text-xs" placeholder="Observações..."
              value={form.descricao} onChange={e => setF({ descricao: e.target.value })} />
          </div>
        </div>

        <div className="flex justify-end">
          <Button size="sm" onClick={handleSalvar} disabled={salvando} className="gap-1">
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Registrar lavagem
          </Button>
        </div>
      </div>

      {/* ── Histórico ── */}
      <div>
        <h3 className="text-sm font-medium mb-3">Histórico de lavagens</h3>
        {lavagens.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma lavagem registrada</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden divide-y divide-border/40">
            {lavagens.map(l => {
              const conta  = contaMap[l.conta_id]
              const s2l    = l.conversao_tipo === 'sujo_para_limpo'
              return (
                <div key={l.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] group">
                  <RefreshCw className="h-4 w-4 text-purple-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      <span className="font-medium">{conta?.nome ?? '?'}</span>
                      <span className={cn('text-xs', s2l ? 'text-orange-400' : 'text-emerald-400')}>
                        {fmt(l.valor_origem)}
                      </span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className={cn('text-xs', s2l ? 'text-emerald-400' : 'text-orange-400')}>
                        {fmt(l.valor_destino)}
                      </span>
                      {l.taxa_percentual != null && (
                        <span className="text-[10px] text-muted-foreground">({l.taxa_percentual}%)</span>
                      )}
                    </div>
                    {l.descricao && <p className="text-xs text-muted-foreground">{l.descricao}</p>}
                    <p className="text-[11px] text-muted-foreground">{fmtData(l.data ?? l.created_at)}</p>
                  </div>
                  <div className="text-right text-xs">
                    <p className={s2l ? 'text-orange-400' : 'text-emerald-400'}>
                      {s2l ? 'Sujo → Limpo' : 'Limpo → Sujo'}
                    </p>
                  </div>
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
          <DialogHeader><DialogTitle>Remover lavagem?</DialogTitle></DialogHeader>
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

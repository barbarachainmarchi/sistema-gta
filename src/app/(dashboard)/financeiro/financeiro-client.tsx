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
import { Plus, Wallet, Users, TrendingUp, TrendingDown, Minus } from 'lucide-react'

type Conta = {
  id: string; nome: string; tipo: 'faccao' | 'membro'; subtipo: 'sujo' | 'limpo' | 'misto'
  membro_id: string | null; saldo: number; status: string
}
type Membro = { id: string; nome: string; vulgo: string | null }

interface Props {
  userId: string
  userNome: string | null
  contasIniciais: Conta[]
  membros: Membro[]
}

function fmt(v: number) {
  return `R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

const subtipoLabel = { sujo: 'Sujo', limpo: 'Limpo', misto: 'Misto' }
const subtipoColor = { sujo: 'text-orange-400', limpo: 'text-emerald-400', misto: 'text-blue-400' }

export function FinanceiroClient({ userId, membros, contasIniciais }: Props) {
  const router = useRouter()
  const sbRef = useRef<ReturnType<typeof createClient> | null>(null)
  const sb = useCallback(() => { if (!sbRef.current) sbRef.current = createClient(); return sbRef.current }, [])

  const [contas, setContas] = useState<Conta[]>(contasIniciais)
  const [novaOpen, setNovaOpen] = useState(false)
  const [criando, setCriando] = useState(false)
  const [form, setForm] = useState({
    nome: '', tipo: 'faccao' as 'faccao' | 'membro',
    subtipo: 'misto' as 'sujo' | 'limpo' | 'misto',
    membro_id: '',
  })

  async function handleCriar() {
    if (!form.nome.trim()) { toast.error('Nome obrigatório'); return }
    if (form.tipo === 'membro' && !form.membro_id) { toast.error('Selecione o membro'); return }
    setCriando(true)
    const { data, error } = await sb().from('financeiro_contas').insert({
      nome: form.nome.trim(),
      tipo: form.tipo,
      subtipo: form.subtipo,
      membro_id: form.tipo === 'membro' ? form.membro_id : null,
      saldo: 0,
    }).select().single()
    setCriando(false)
    if (error) { toast.error('Erro ao criar: ' + error.message); return }
    setContas(prev => [...prev, data as Conta].sort((a, b) => a.nome.localeCompare(b.nome)))
    setForm({ nome: '', tipo: 'faccao', subtipo: 'misto', membro_id: '' })
    setNovaOpen(false)
    toast.success('Bolso criado!')
  }

  const faccao = contas.filter(c => c.tipo === 'faccao')
  const membrosContas = contas.filter(c => c.tipo === 'membro')

  const totalFaccao = faccao.reduce((s, c) => s + c.saldo, 0)
  const totalMembros = membrosContas.reduce((s, c) => s + c.saldo, 0)

  return (
    <div className="p-6 space-y-6 max-w-4xl">

      {/* Resumo geral */}
      {contas.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Total Facção</p>
            <p className={cn('text-xl font-bold mt-1 tabular-nums', totalFaccao >= 0 ? 'text-foreground' : 'text-red-400')}>
              {totalFaccao < 0 && '−'}{fmt(totalFaccao)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Total Membros</p>
            <p className={cn('text-xl font-bold mt-1 tabular-nums', totalMembros >= 0 ? 'text-foreground' : 'text-red-400')}>
              {totalMembros < 0 && '−'}{fmt(totalMembros)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Geral</p>
            <p className={cn('text-xl font-bold mt-1 tabular-nums', (totalFaccao + totalMembros) >= 0 ? 'text-foreground' : 'text-red-400')}>
              {(totalFaccao + totalMembros) < 0 && '−'}{fmt(totalFaccao + totalMembros)}
            </p>
          </div>
        </div>
      )}

      {/* Bolsos da Facção */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />Bolsos da Facção
          </h2>
          <Button size="sm" className="h-7 text-xs gap-1" onClick={() => { setForm(f => ({ ...f, tipo: 'faccao' })); setNovaOpen(true) }}>
            <Plus className="h-3 w-3" />Novo
          </Button>
        </div>

        {faccao.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <p className="text-xs text-muted-foreground">Nenhum bolso criado ainda</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {faccao.map(c => <ContaCard key={c.id} conta={c} onClick={() => router.push(`/financeiro/${c.id}`)} />)}
          </div>
        )}
      </section>

      {/* Bolsos de Membros */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />Bolsos de Membros
          </h2>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => { setForm(f => ({ ...f, tipo: 'membro' })); setNovaOpen(true) }}>
            <Plus className="h-3 w-3" />Novo
          </Button>
        </div>

        {membrosContas.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <p className="text-xs text-muted-foreground">Nenhum bolso de membro ainda</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {membrosContas.map(c => {
              const m = membros.find(mb => mb.id === c.membro_id)
              return <ContaCard key={c.id} conta={c} sub={m ? (m.vulgo ?? m.nome) : undefined} onClick={() => router.push(`/financeiro/${c.id}`)} />
            })}
          </div>
        )}
      </section>

      {/* Dialog novo bolso */}
      <Dialog open={novaOpen} onOpenChange={v => !v && setNovaOpen(false)}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">Novo Bolso</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome</Label>
              <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Caixa Sujo" className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v as 'faccao' | 'membro', membro_id: '' }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="faccao">Facção</SelectItem>
                  <SelectItem value="membro">Membro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.tipo === 'membro' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Membro</Label>
                <Select value={form.membro_id} onValueChange={v => setForm(f => ({ ...f, membro_id: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {membros.map(m => <SelectItem key={m.id} value={m.id}>{m.nome}{m.vulgo ? ` (${m.vulgo})` : ''}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de dinheiro</Label>
              <Select value={form.subtipo} onValueChange={v => setForm(f => ({ ...f, subtipo: v as 'sujo' | 'limpo' | 'misto' }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="misto">Misto</SelectItem>
                  <SelectItem value="sujo">Sujo</SelectItem>
                  <SelectItem value="limpo">Limpo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setNovaOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleCriar} disabled={criando}>Criar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ContaCard({ conta, sub, onClick }: { conta: Conta; sub?: string; onClick: () => void }) {
  const saldoPos = conta.saldo >= 0
  return (
    <button onClick={onClick}
      className="rounded-lg border border-border bg-card hover:bg-white/[0.03] transition-colors p-4 text-left flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{conta.nome}</p>
          {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', subtipoColor[conta.subtipo])}>
          {subtipoLabel[conta.subtipo]}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        {saldoPos
          ? <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
          : conta.saldo < 0 ? <TrendingDown className="h-3.5 w-3.5 text-red-400" /> : <Minus className="h-3.5 w-3.5 text-muted-foreground" />
        }
        <span className={cn('text-lg font-bold tabular-nums', saldoPos ? 'text-foreground' : 'text-red-400')}>
          {conta.saldo < 0 && '−'}{fmt(conta.saldo)}
        </span>
      </div>
    </button>
  )
}

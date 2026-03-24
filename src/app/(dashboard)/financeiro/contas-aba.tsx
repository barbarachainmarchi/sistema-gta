'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Plus, Pencil, PowerOff, Power, Loader2, Wallet } from 'lucide-react'
import type { Conta, Membro, SbClient } from './financeiro-client'

// ── Helpers ───────────────────────────────────────────────────────────────────

const TIPO_LABEL: Record<Conta['tipo'], string> = {
  faccao: 'Facção', membro: 'Membro', caixa: 'Caixa', setor: 'Setor', outro: 'Outro',
}
const TIPOS: Conta['tipo'][] = ['faccao', 'membro', 'caixa', 'setor', 'outro']

const EMPTY_FORM = { id: null as string | null, nome: '', tipo: 'faccao' as Conta['tipo'], membro_id: '' }

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  contas: Conta[]
  setContas: React.Dispatch<React.SetStateAction<Conta[]>>
  membros: Membro[]
  sb: SbClient
  podeEditar: boolean
}

// ── Componente ────────────────────────────────────────────────────────────────

export function ContasAba({ contas, setContas, membros, sb, podeEditar }: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm]           = useState({ ...EMPTY_FORM })
  const [salvando, setSalvando]   = useState(false)
  const [filtroStatus, setFiltroStatus] = useState<'ativo' | 'inativo' | 'todos'>('ativo')

  const contasFiltradas = useMemo(() => {
    if (filtroStatus === 'todos') return contas
    return contas.filter(c => c.status === filtroStatus)
  }, [contas, filtroStatus])

  function setF(patch: Partial<typeof EMPTY_FORM>) { setForm(prev => ({ ...prev, ...patch })) }

  function abrirNova() {
    setForm({ ...EMPTY_FORM })
    setModalOpen(true)
  }
  function abrirEditar(c: Conta) {
    setForm({ id: c.id, nome: c.nome, tipo: c.tipo, membro_id: c.membro_id ?? '' })
    setModalOpen(true)
  }

  async function handleSalvar() {
    if (!form.nome.trim())                              { toast.error('Nome obrigatório'); return }
    if (form.tipo === 'membro' && !form.membro_id)      { toast.error('Selecione o membro'); return }

    setSalvando(true)
    const payload = {
      nome:      form.nome.trim(),
      tipo:      form.tipo,
      membro_id: form.tipo === 'membro' ? form.membro_id : null,
    }

    if (form.id) {
      const { error } = await sb().from('financeiro_contas').update(payload).eq('id', form.id)
      if (error) { setSalvando(false); toast.error(error.message); return }
      setContas(prev => prev.map(c => c.id === form.id ? { ...c, ...payload } : c))
      toast.success('Conta atualizada!')
    } else {
      const { data, error } = await sb().from('financeiro_contas')
        .insert({ ...payload, saldo_sujo: 0, saldo_limpo: 0, status: 'ativo' })
        .select().single()
      if (error) { setSalvando(false); toast.error(error.message); return }
      setContas(prev => [...prev, data as Conta].sort((a, b) => a.nome.localeCompare(b.nome)))
      toast.success('Conta criada!')
    }

    setSalvando(false)
    setModalOpen(false)
  }

  async function toggleStatus(conta: Conta) {
    const novoStatus = conta.status === 'ativo' ? 'inativo' : 'ativo'
    const { error } = await sb().from('financeiro_contas').update({ status: novoStatus }).eq('id', conta.id)
    if (error) { toast.error(error.message); return }
    setContas(prev => prev.map(c => c.id === conta.id ? { ...c, status: novoStatus } : c))
    toast.success(novoStatus === 'ativo' ? 'Conta reativada' : 'Conta desativada')
  }

  const membroMap = useMemo(() => Object.fromEntries(membros.map(m => [m.id, m])), [membros])

  return (
    <div className="h-full overflow-y-auto p-6 space-y-4 max-w-3xl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {(['ativo', 'inativo', 'todos'] as const).map(s => (
            <button key={s} onClick={() => setFiltroStatus(s)}
              className={cn('px-3 py-1.5 text-xs rounded-md transition-colors capitalize',
                filtroStatus === s
                  ? 'bg-primary/15 text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              )}>
              {s === 'ativo' ? 'Ativas' : s === 'inativo' ? 'Inativas' : 'Todas'}
            </button>
          ))}
        </div>
        {podeEditar && (
          <Button size="sm" className="h-8 text-xs gap-1" onClick={abrirNova}>
            <Plus className="h-3.5 w-3.5" /> Nova conta
          </Button>
        )}
      </div>

      {/* ── Lista ── */}
      {contasFiltradas.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">Nenhuma conta encontrada</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden divide-y divide-border/40">
          {contasFiltradas.map(c => {
            const membro = c.membro_id ? membroMap[c.membro_id] : null
            return (
              <div key={c.id} className={cn('flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] group',
                c.status === 'inativo' && 'opacity-50'
              )}>
                <Wallet className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{c.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {TIPO_LABEL[c.tipo]}
                    {membro && ` · ${membro.nome}${membro.vulgo ? ` (${membro.vulgo})` : ''}`}
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground shrink-0 mr-2">
                  <p><span className="text-emerald-400">L</span> {c.saldo_limpo.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                  <p><span className="text-orange-400">S</span> {c.saldo_sujo.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => abrirEditar(c)}
                    className="p-1.5 rounded hover:bg-white/[0.07] text-muted-foreground hover:text-foreground transition-colors">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => toggleStatus(c)}
                    className={cn('p-1.5 rounded transition-colors',
                      c.status === 'ativo'
                        ? 'hover:bg-red-500/10 text-muted-foreground hover:text-red-400'
                        : 'hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-400'
                    )} title={c.status === 'ativo' ? 'Desativar' : 'Reativar'}>
                    {c.status === 'ativo' ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal ── */}
      <Dialog open={modalOpen} onOpenChange={o => { if (!salvando) setModalOpen(o) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar conta' : 'Nova conta'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Nome</Label>
              <Input className="h-9 text-xs" placeholder="Ex: Caixa Principal, Caixa Membro..."
                value={form.nome} onChange={e => setF({ nome: e.target.value })} />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setF({ tipo: v as Conta['tipo'], membro_id: '' })}>
                <SelectTrigger className="text-xs h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map(t => <SelectItem key={t} value={t}>{TIPO_LABEL[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {form.tipo === 'membro' && (
              <div className="space-y-1">
                <Label className="text-xs">Membro</Label>
                <Select value={form.membro_id || 'sem'} onValueChange={v => setF({ membro_id: v === 'sem' ? '' : v })}>
                  <SelectTrigger className="text-xs h-9"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sem">Selecione...</SelectItem>
                    {membros.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nome}{m.vulgo ? ` (${m.vulgo})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSalvar} disabled={salvando}>
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : (form.id ? 'Salvar' : 'Criar')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

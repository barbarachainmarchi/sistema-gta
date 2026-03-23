'use client'

import { useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Edit2, Loader2, Plus, Check, X, Users, Car, Package, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'

const FACTION_COLORS = [
  '#6366f1','#8b5cf6','#a855f7','#ec4899',
  '#ef4444','#f97316','#eab308','#22c55e',
  '#10b981','#06b6d4','#3b82f6','#6b7280',
]

export type Faccao      = { id: string; nome: string; sigla: string | null; descricao: string | null; territorio: string | null; cor_tag: string; status: 'ativo' | 'inativo'; created_at: string; updated_at: string }
export type Membro      = { id: string; nome: string; vulgo: string | null; telefone: string | null; faccao_id: string | null; status: 'ativo' | 'inativo'; observacoes: string | null; faccoes: { id: string; nome: string; cor_tag: string } | null }
export type Veiculo     = { id: string; placa: string; modelo: string | null; cor: string | null; proprietario_tipo: 'membro' | 'faccao' | 'desconhecido' | null; proprietario_id: string | null; observacoes: string | null }
export type FaccaoPreco = { id: string; faccao_id: string; item_id: string; tipo: 'percentual' | 'fixo'; percentual: number | null; preco_sujo: number | null; preco_limpo: number | null; observacoes: string | null }
export type Produto     = { id: string; nome: string }

function fmt(v: number | null) {
  if (v == null) return '—'
  return `R$ ${v.toLocaleString('pt-BR')}`
}

interface Props {
  faccao: Faccao
  membros: Membro[]
  veiculos: Veiculo[]
  todosProdutos: Produto[]
  faccaoPrecos: FaccaoPreco[]
  open: boolean
  onClose: () => void
  onUpdateFaccao: (f: Faccao) => void
  onUpdateFaccaoPrecos: (precos: FaccaoPreco[]) => void
}

export function FaccaoDetalhe({ faccao, membros, veiculos, todosProdutos, faccaoPrecos, open, onClose, onUpdateFaccao, onUpdateFaccaoPrecos }: Props) {
  const sbRef = useRef<ReturnType<typeof createClient> | null>(null)
  const sb = useCallback(() => { if (!sbRef.current) sbRef.current = createClient(); return sbRef.current }, [])

  // ── Edição básica ──────────────────────────────────────────────────────────
  const [editando, setEditando] = useState(false)
  const [geralForm, setGeralForm] = useState({ nome: faccao.nome, sigla: faccao.sigla ?? '', descricao: faccao.descricao ?? '', territorio: faccao.territorio ?? '', cor_tag: faccao.cor_tag, status: faccao.status })
  const [geralSaving, setGeralSaving] = useState(false)

  function abrirEdicao() {
    setGeralForm({ nome: faccao.nome, sigla: faccao.sigla ?? '', descricao: faccao.descricao ?? '', territorio: faccao.territorio ?? '', cor_tag: faccao.cor_tag, status: faccao.status })
    setEditando(true)
  }

  async function handleSalvarGeral() {
    if (!geralForm.nome) { toast.error('Nome obrigatório'); return }
    setGeralSaving(true)
    const { data, error } = await sb().from('faccoes').update({
      nome: geralForm.nome, sigla: geralForm.sigla.trim() || null,
      descricao: geralForm.descricao || null, territorio: geralForm.territorio || null,
      cor_tag: geralForm.cor_tag, status: geralForm.status,
    }).eq('id', faccao.id).select().single()
    setGeralSaving(false)
    if (error) { toast.error('Erro ao salvar'); return }
    onUpdateFaccao(data as Faccao)
    setEditando(false)
    toast.success('Facção atualizada')
  }

  // ── Preços / Produtos ──────────────────────────────────────────────────────
  const [editPreco, setEditPreco] = useState<Produto | null>(null)
  const [precoForm, setPrecoForm] = useState({ tipo: 'fixo' as 'percentual' | 'fixo', percentual: '', preco_sujo: '', preco_limpo: '' })
  const [precoSaving, setPrecoSaving] = useState(false)
  const [addingPreco, setAddingPreco] = useState(false)
  const [newItemId, setNewItemId] = useState('')

  const produtosDisponiveis = todosProdutos.filter(p => !faccaoPrecos.some(fp => fp.item_id === p.id))

  function openEditPreco(produto: Produto) {
    const existing = faccaoPrecos.find(p => p.item_id === produto.id)
    setPrecoForm({ tipo: existing?.tipo ?? 'fixo', percentual: existing?.percentual?.toString() ?? '', preco_sujo: existing?.preco_sujo?.toString() ?? '', preco_limpo: existing?.preco_limpo?.toString() ?? '' })
    setEditPreco(produto)
  }

  function handleAdicionarProduto() {
    if (!newItemId) return
    const produto = todosProdutos.find(p => p.id === newItemId)
    if (!produto) return
    setAddingPreco(false); setNewItemId('')
    openEditPreco(produto)
  }

  async function handleSalvarPreco() {
    if (!editPreco) return
    setPrecoSaving(true)
    const row = {
      faccao_id: faccao.id, item_id: editPreco.id, tipo: precoForm.tipo,
      percentual: precoForm.tipo === 'percentual' && precoForm.percentual ? parseFloat(precoForm.percentual) : null,
      preco_sujo: precoForm.preco_sujo ? parseFloat(precoForm.preco_sujo) : null,
      preco_limpo: precoForm.preco_limpo ? parseFloat(precoForm.preco_limpo) : null,
    }
    const { data, error } = await sb().from('faccao_item_precos').upsert(row, { onConflict: 'faccao_id,item_id' }).select().single()
    setPrecoSaving(false)
    if (error) { toast.error('Erro ao salvar preço'); return }
    onUpdateFaccaoPrecos([...faccaoPrecos.filter(p => p.item_id !== editPreco.id), data as FaccaoPreco])
    toast.success('Preço salvo'); setEditPreco(null)
  }

  async function handleRemoverPreco(itemId: string) {
    await sb().from('faccao_item_precos').delete().eq('faccao_id', faccao.id).eq('item_id', itemId)
    onUpdateFaccaoPrecos(faccaoPrecos.filter(p => p.item_id !== itemId))
    toast.success('Produto removido')
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent aria-describedby={undefined} className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2.5">
            <span className="h-4 w-4 rounded-full shrink-0" style={{ background: faccao.cor_tag }} />
            <span>{faccao.nome}</span>
            {faccao.sigla && <span className="text-xs font-mono text-muted-foreground bg-white/[0.06] px-1.5 py-0.5 rounded border border-white/10">{faccao.sigla}</span>}
            <span className={cn('ml-auto text-[11px] px-2 py-0.5 rounded-full font-normal', faccao.status === 'ativo' ? 'bg-green-500/10 text-green-400' : 'bg-zinc-500/10 text-zinc-500')}>
              {faccao.status === 'ativo' ? 'Ativa' : 'Inativa'}
            </span>
          </DialogTitle>
          {(faccao.territorio || faccao.descricao) && (
            <div className="text-xs text-muted-foreground space-y-0.5 pt-1">
              {faccao.territorio && <p className="flex items-center gap-1"><MapPin className="h-3 w-3" />{faccao.territorio}</p>}
              {faccao.descricao && <p>{faccao.descricao}</p>}
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: Users, label: 'Membros', count: membros.length },
              { icon: Car, label: 'Veículos', count: veiculos.length },
              { icon: Package, label: 'Produtos', count: faccaoPrecos.length },
            ].map(({ icon: Icon, label, count }) => (
              <div key={label} className="rounded-lg border border-border bg-white/[0.02] p-3 text-center">
                <p className="text-2xl font-bold tabular-nums">{count}</p>
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-0.5"><Icon className="h-3 w-3" />{label}</p>
              </div>
            ))}
          </div>

          {/* Editar facção */}
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Informações</p>
            <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={editando ? () => setEditando(false) : abrirEdicao}>
              {editando ? <><X className="h-3 w-3" />Cancelar</> : <><Edit2 className="h-3 w-3" />Editar</>}
            </Button>
          </div>

          {editando && (
            <div className="rounded-lg border border-border bg-white/[0.02] p-4 space-y-3">
              <div className="grid grid-cols-[1fr_100px] gap-3">
                <div className="space-y-1"><Label className="text-xs">Nome *</Label><Input value={geralForm.nome} onChange={e => setGeralForm(f => ({ ...f, nome: e.target.value }))} className="h-8 text-sm" /></div>
                <div className="space-y-1"><Label className="text-xs">Sigla</Label><Input value={geralForm.sigla} onChange={e => setGeralForm(f => ({ ...f, sigla: e.target.value }))} placeholder="Ex: CV" className="h-8 text-sm" maxLength={10} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Território</Label><Input value={geralForm.territorio} onChange={e => setGeralForm(f => ({ ...f, territorio: e.target.value }))} className="h-8 text-sm" /></div>
                <div className="space-y-1"><Label className="text-xs">Descrição</Label><Input value={geralForm.descricao} onChange={e => setGeralForm(f => ({ ...f, descricao: e.target.value }))} className="h-8 text-sm" /></div>
              </div>
              <div>
                <Label className="text-xs">Cor</Label>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {FACTION_COLORS.map(cor => (
                    <button key={cor} onClick={() => setGeralForm(f => ({ ...f, cor_tag: cor }))}
                      className={cn('h-6 w-6 rounded border-2 transition-all flex items-center justify-center', geralForm.cor_tag === cor ? 'border-white/70 scale-110' : 'border-transparent hover:border-white/20')}
                      style={{ background: cor }}>
                      {geralForm.cor_tag === cor && <Check className="h-3 w-3 text-white drop-shadow" />}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Status</span>
                  <Switch checked={geralForm.status === 'ativo'} onCheckedChange={v => setGeralForm(f => ({ ...f, status: v ? 'ativo' : 'inativo' }))} />
                  <span className="text-xs text-muted-foreground">{geralForm.status === 'ativo' ? 'Ativa' : 'Inativa'}</span>
                </div>
                <Button size="sm" className="h-7 text-xs" onClick={handleSalvarGeral} disabled={geralSaving}>
                  {geralSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Salvar'}
                </Button>
              </div>
            </div>
          )}

          {/* Membros */}
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />Membros</p>
            {membros.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4 rounded-lg border border-border border-dashed">Nenhum membro nesta facção</p>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                {membros.map((m, idx) => (
                  <div key={m.id} className={cn('flex items-center justify-between px-3 py-2', idx < membros.length - 1 && 'border-b border-border/50')}>
                    <div>
                      <span className="text-sm font-medium">{m.nome}</span>
                      {m.vulgo && <span className="ml-1.5 text-xs text-muted-foreground">"{m.vulgo}"</span>}
                      {m.observacoes && <span className="ml-2 text-xs text-muted-foreground/60">· {m.observacoes}</span>}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {m.telefone && <span className="text-xs font-mono text-muted-foreground">{m.telefone}</span>}
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded', m.status === 'ativo' ? 'bg-green-500/10 text-green-400' : 'bg-zinc-500/10 text-zinc-500')}>
                        {m.status === 'ativo' ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Veículos */}
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5"><Car className="h-3.5 w-3.5" />Veículos</p>
            {veiculos.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4 rounded-lg border border-border border-dashed">Nenhum veículo desta facção</p>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                {veiculos.map((v, idx) => (
                  <div key={v.id} className={cn('flex items-center justify-between px-3 py-2', idx < veiculos.length - 1 && 'border-b border-border/50')}>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-semibold">{v.placa}</span>
                      {v.modelo && <span className="text-sm text-muted-foreground">{v.modelo}</span>}
                      {v.cor && <span className="text-xs text-muted-foreground">· {v.cor}</span>}
                    </div>
                    {v.observacoes && <span className="text-xs text-muted-foreground truncate max-w-[180px]">{v.observacoes}</span>}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Produtos */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Package className="h-3.5 w-3.5" />Produtos</p>
              <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => setAddingPreco(true)} disabled={produtosDisponiveis.length === 0}>
                <Plus className="h-3 w-3" />Adicionar
              </Button>
            </div>
            {faccaoPrecos.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4 rounded-lg border border-border border-dashed">Nenhum produto cadastrado</p>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="grid grid-cols-[1fr_90px_90px_70px_40px] gap-2 px-3 py-1.5 bg-white/[0.02] border-b border-border text-[10px] text-muted-foreground font-medium">
                  <span>Produto</span><span className="text-right">Sujo</span><span className="text-right">Limpo</span><span>Tipo</span><span />
                </div>
                {faccaoPrecos.map((preco, idx) => {
                  const produto = todosProdutos.find(p => p.id === preco.item_id)
                  return (
                    <div key={preco.item_id} className={cn('grid grid-cols-[1fr_90px_90px_70px_40px] gap-2 items-center px-3 py-2', idx < faccaoPrecos.length - 1 && 'border-b border-border/50')}>
                      <span className="text-sm">{produto?.nome ?? '—'}</span>
                      <span className="text-xs text-right tabular-nums">{fmt(preco.preco_sujo)}</span>
                      <span className="text-xs text-right tabular-nums">{fmt(preco.preco_limpo)}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {preco.tipo === 'percentual' ? `${preco.percentual != null && preco.percentual > 0 ? '-' : '+'}${Math.abs(preco.percentual ?? 0)}%` : 'fixo'}
                      </span>
                      <div className="flex gap-0.5">
                        <button onClick={() => openEditPreco({ id: preco.item_id, nome: produto?.nome ?? '' })} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"><Edit2 className="h-3 w-3" /></button>
                        <button onClick={() => handleRemoverPreco(preco.item_id)} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-white/[0.06]"><X className="h-3 w-3" /></button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </DialogContent>

      {/* Modal: Selecionar produto */}
      <Dialog open={addingPreco} onOpenChange={v => { if (!v) { setAddingPreco(false); setNewItemId('') } }}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-xs">
          <DialogHeader><DialogTitle className="text-sm">Adicionar produto</DialogTitle></DialogHeader>
          <Select value={newItemId} onValueChange={setNewItemId}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecionar produto..." /></SelectTrigger>
            <SelectContent>{produtosDisponiveis.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
          </Select>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setAddingPreco(false); setNewItemId('') }}>Cancelar</Button>
            <Button size="sm" onClick={handleAdicionarProduto} disabled={!newItemId}>Continuar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar preço */}
      <Dialog open={!!editPreco} onOpenChange={v => !v && setEditPreco(null)}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">Preço — {editPreco?.nome}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <Select value={precoForm.tipo} onValueChange={v => setPrecoForm(f => ({ ...f, tipo: v as 'percentual' | 'fixo' }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixo">Valor fixo (sujo/limpo)</SelectItem>
                  <SelectItem value="percentual">Percentual sobre referência</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {precoForm.tipo === 'percentual' ? (
              <div className="space-y-1.5">
                <Label className="text-xs">% (positivo = desconto, negativo = acréscimo)</Label>
                <Input type="number" placeholder="Ex: 10" value={precoForm.percentual} onChange={e => setPrecoForm(f => ({ ...f, percentual: e.target.value }))} className="h-8 text-sm" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-xs">Preço Sujo</Label><Input type="number" placeholder="0" value={precoForm.preco_sujo} onChange={e => setPrecoForm(f => ({ ...f, preco_sujo: e.target.value }))} className="h-8 text-sm" /></div>
                <div className="space-y-1.5"><Label className="text-xs">Preço Limpo</Label><Input type="number" placeholder="0" value={precoForm.preco_limpo} onChange={e => setPrecoForm(f => ({ ...f, preco_limpo: e.target.value }))} className="h-8 text-sm" /></div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditPreco(null)}>Cancelar</Button>
            <Button size="sm" onClick={handleSalvarPreco} disabled={precoSaving}>{precoSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Salvar'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}

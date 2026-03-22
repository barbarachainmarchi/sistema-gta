'use client'

import { useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Edit2, Loader2, Plus, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const FACTION_COLORS = [
  '#6366f1','#8b5cf6','#a855f7','#ec4899',
  '#ef4444','#f97316','#eab308','#22c55e',
  '#10b981','#06b6d4','#3b82f6','#6b7280',
]

export type Faccao     = { id: string; nome: string; descricao: string | null; territorio: string | null; cor_tag: string; status: 'ativo' | 'inativo'; created_at: string; updated_at: string }
export type Membro     = { id: string; nome: string; vulgo: string | null; telefone: string | null; faccao_id: string | null; status: 'ativo' | 'inativo'; observacoes: string | null; faccoes: { id: string; nome: string; cor_tag: string } | null }
export type Veiculo    = { id: string; placa: string; modelo: string | null; cor: string | null; proprietario_tipo: 'membro' | 'faccao' | 'desconhecido' | null; proprietario_id: string | null; observacoes: string | null }
export type FaccaoPreco = { id: string; faccao_id: string; item_id: string; tipo: 'percentual' | 'fixo'; percentual: number | null; preco_sujo: number | null; preco_limpo: number | null; observacoes: string | null }
export type PrecoPadrao = { item_id: string; preco_sujo: number | null; preco_limpo: number | null }
export type MeuProduto  = { id: string; nome: string }

function fmt(v: number | null) {
  if (v == null) return '—'
  return `R$ ${v.toLocaleString('pt-BR')}`
}

function calcPreco(padrao: number | null, tipo: string, percentual: number | null, fixo: number | null): number | null {
  if (tipo === 'percentual' && padrao != null && percentual != null) return padrao * (1 - percentual / 100)
  if (tipo === 'fixo' && fixo != null) return fixo
  return null
}

interface Props {
  faccao: Faccao
  membros: Membro[]
  veiculos: Veiculo[]
  meusProdutos: MeuProduto[]
  precoPadrao: PrecoPadrao[]
  faccaoPrecos: FaccaoPreco[]
  open: boolean
  onClose: () => void
  onUpdateFaccao: (f: Faccao) => void
  onUpdateFaccaoPrecos: (precos: FaccaoPreco[]) => void
}

export function FaccaoDetalhe({ faccao, membros, veiculos, meusProdutos, precoPadrao, faccaoPrecos, open, onClose, onUpdateFaccao, onUpdateFaccaoPrecos }: Props) {
  const sbRef = useRef<ReturnType<typeof createClient> | null>(null)
  const sb = useCallback(() => { if (!sbRef.current) sbRef.current = createClient(); return sbRef.current }, [])

  // ── Aba Geral ──────────────────────────────────────────────────────────────
  const [geralForm, setGeralForm] = useState({ nome: faccao.nome, descricao: faccao.descricao ?? '', territorio: faccao.territorio ?? '', cor_tag: faccao.cor_tag, status: faccao.status })
  const [geralSaving, setGeralSaving] = useState(false)
  const geralChanged = geralForm.nome !== faccao.nome || geralForm.descricao !== (faccao.descricao ?? '') || geralForm.territorio !== (faccao.territorio ?? '') || geralForm.cor_tag !== faccao.cor_tag || geralForm.status !== faccao.status

  async function handleSalvarGeral() {
    if (!geralForm.nome) { toast.error('Nome obrigatório'); return }
    setGeralSaving(true)
    const { data, error } = await sb().from('faccoes').update({ nome: geralForm.nome, descricao: geralForm.descricao || null, territorio: geralForm.territorio || null, cor_tag: geralForm.cor_tag, status: geralForm.status }).eq('id', faccao.id).select().single()
    setGeralSaving(false)
    if (error) { toast.error('Erro ao salvar'); return }
    onUpdateFaccao(data as Faccao)
    toast.success('Facção atualizada')
  }

  // ── Aba Preços ─────────────────────────────────────────────────────────────
  const [editPreco, setEditPreco] = useState<MeuProduto | null>(null)
  const [precoForm, setPrecoForm] = useState({ tipo: 'fixo' as 'percentual' | 'fixo', percentual: '', preco_sujo: '', preco_limpo: '' })
  const [precoSaving, setPrecoSaving] = useState(false)

  function openEditPreco(produto: MeuProduto) {
    const existing = faccaoPrecos.find(p => p.item_id === produto.id)
    setPrecoForm({
      tipo: existing?.tipo ?? 'fixo',
      percentual: existing?.percentual?.toString() ?? '',
      preco_sujo: existing?.preco_sujo?.toString() ?? '',
      preco_limpo: existing?.preco_limpo?.toString() ?? '',
    })
    setEditPreco(produto)
  }

  async function handleSalvarPreco() {
    if (!editPreco) return
    setPrecoSaving(true)
    const row = {
      faccao_id: faccao.id,
      item_id: editPreco.id,
      tipo: precoForm.tipo,
      percentual: precoForm.tipo === 'percentual' && precoForm.percentual ? parseFloat(precoForm.percentual) : null,
      preco_sujo: precoForm.tipo === 'fixo' && precoForm.preco_sujo ? parseFloat(precoForm.preco_sujo) : null,
      preco_limpo: precoForm.tipo === 'fixo' && precoForm.preco_limpo ? parseFloat(precoForm.preco_limpo) : null,
    }
    const { data, error } = await sb().from('faccao_item_precos').upsert({ ...row }, { onConflict: 'faccao_id,item_id' }).select().single()
    setPrecoSaving(false)
    if (error) { toast.error('Erro ao salvar preço'); return }
    const updated = faccaoPrecos.filter(p => p.item_id !== editPreco.id)
    onUpdateFaccaoPrecos([...updated, data as FaccaoPreco])
    toast.success('Preço salvo')
    setEditPreco(null)
  }

  async function handleRemoverPreco(itemId: string) {
    await sb().from('faccao_item_precos').delete().eq('faccao_id', faccao.id).eq('item_id', itemId)
    onUpdateFaccaoPrecos(faccaoPrecos.filter(p => p.item_id !== itemId))
    toast.success('Preço removido')
  }

  const membrosCount = membros.length
  const veiculosCount = veiculos.length

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full shrink-0" style={{ background: faccao.cor_tag }} />
            {faccao.nome}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="geral" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="shrink-0">
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="membros">Membros ({membrosCount})</TabsTrigger>
            <TabsTrigger value="veiculos">Veículos ({veiculosCount})</TabsTrigger>
            <TabsTrigger value="precos">Preços</TabsTrigger>
          </TabsList>

          {/* ── Geral ──────────────────────────────────────────────────────── */}
          <TabsContent value="geral" className="overflow-y-auto flex-1 mt-3 space-y-4 pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome *</Label>
                <Input value={geralForm.nome} onChange={e => setGeralForm(f => ({ ...f, nome: e.target.value }))} className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Território</Label>
                <Input value={geralForm.territorio} onChange={e => setGeralForm(f => ({ ...f, territorio: e.target.value }))} placeholder="Ex: Zona Sul, Grove St..." className="h-8 text-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descrição</Label>
              <Input value={geralForm.descricao} onChange={e => setGeralForm(f => ({ ...f, descricao: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Cor de identificação</Label>
              <div className="flex flex-wrap gap-2">
                {FACTION_COLORS.map(cor => (
                  <button key={cor} onClick={() => setGeralForm(f => ({ ...f, cor_tag: cor }))}
                    className={cn('h-7 w-7 rounded-md border-2 transition-all flex items-center justify-center', geralForm.cor_tag === cor ? 'border-white/60 scale-110' : 'border-transparent hover:border-white/20')}
                    style={{ background: cor }}>
                    {geralForm.cor_tag === cor && <Check className="h-3 w-3 text-white drop-shadow" />}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Status</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{geralForm.status === 'ativo' ? 'Ativa' : 'Inativa'}</span>
                <Switch checked={geralForm.status === 'ativo'} onCheckedChange={v => setGeralForm(f => ({ ...f, status: v ? 'ativo' : 'inativo' }))} />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={handleSalvarGeral} disabled={!geralChanged || geralSaving}>
                {geralSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Salvar'}
              </Button>
            </div>
          </TabsContent>

          {/* ── Membros ─────────────────────────────────────────────────────── */}
          <TabsContent value="membros" className="overflow-y-auto flex-1 mt-3">
            {membros.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum membro nesta facção</p>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                {membros.map((m, idx) => (
                  <div key={m.id} className={cn('flex items-center justify-between px-4 py-2.5', idx < membros.length - 1 && 'border-b border-border/60')}>
                    <div>
                      <span className="text-sm font-medium">{m.nome}</span>
                      {m.vulgo && <span className="ml-2 text-xs text-muted-foreground">"{m.vulgo}"</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      {m.telefone && <span className="text-xs text-muted-foreground font-mono">{m.telefone}</span>}
                      <span className={cn('text-[11px] px-1.5 py-0.5 rounded', m.status === 'ativo' ? 'bg-green-500/10 text-green-400' : 'bg-zinc-500/10 text-zinc-500')}>{m.status === 'ativo' ? 'Ativo' : 'Inativo'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Veículos ────────────────────────────────────────────────────── */}
          <TabsContent value="veiculos" className="overflow-y-auto flex-1 mt-3">
            {veiculos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum veículo desta facção</p>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                {veiculos.map((v, idx) => (
                  <div key={v.id} className={cn('flex items-center justify-between px-4 py-2.5', idx < veiculos.length - 1 && 'border-b border-border/60')}>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-medium">{v.placa}</span>
                      {v.modelo && <span className="text-sm text-muted-foreground">{v.modelo}</span>}
                      {v.cor && <span className="text-xs text-muted-foreground">· {v.cor}</span>}
                    </div>
                    {v.observacoes && <span className="text-xs text-muted-foreground truncate max-w-[200px]">{v.observacoes}</span>}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Preços ──────────────────────────────────────────────────────── */}
          <TabsContent value="precos" className="overflow-y-auto flex-1 mt-3">
            {meusProdutos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum produto cadastrado como seu</p>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-[1fr_100px_100px_120px_120px_32px] gap-2 px-3 py-2 bg-white/[0.02] border-b border-border">
                  <span className="text-[11px] text-muted-foreground font-medium">Produto</span>
                  <span className="text-[11px] text-muted-foreground text-right">Padrão S</span>
                  <span className="text-[11px] text-muted-foreground text-right">Padrão L</span>
                  <span className="text-[11px] text-muted-foreground text-right">Parceria S</span>
                  <span className="text-[11px] text-muted-foreground text-right">Parceria L</span>
                  <span />
                </div>
                {meusProdutos.map((produto, idx) => {
                  const padrao = precoPadrao.find(p => p.item_id === produto.id)
                  const parceria = faccaoPrecos.find(p => p.item_id === produto.id)
                  const parceiraS = parceria ? calcPreco(padrao?.preco_sujo ?? null, parceria.tipo, parceria.percentual, parceria.preco_sujo) : null
                  const parceiraL = parceria ? calcPreco(padrao?.preco_limpo ?? null, parceria.tipo, parceria.percentual, parceria.preco_limpo) : null

                  return (
                    <div key={produto.id} className={cn('grid grid-cols-[1fr_100px_100px_120px_120px_32px] gap-2 items-center px-3 py-2.5', idx < meusProdutos.length - 1 && 'border-b border-border/60')}>
                      <div>
                        <span className="text-sm">{produto.nome}</span>
                        {parceria && (
                          <span className="ml-2 text-[10px] text-muted-foreground">
                            {parceria.tipo === 'percentual'
                              ? `${parceria.percentual && parceria.percentual > 0 ? '-' : '+'}${Math.abs(parceria.percentual ?? 0)}%`
                              : 'fixo'}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-right text-muted-foreground">{fmt(padrao?.preco_sujo ?? null)}</span>
                      <span className="text-xs text-right text-muted-foreground">{fmt(padrao?.preco_limpo ?? null)}</span>
                      <span className={cn('text-xs text-right font-medium', parceiraS != null && 'text-primary')}>{fmt(parceiraS)}</span>
                      <span className={cn('text-xs text-right font-medium', parceiraL != null && 'text-primary')}>{fmt(parceiraL)}</span>
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => openEditPreco(produto)} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors">
                          <Edit2 className="h-3 w-3" />
                        </button>
                        {parceria && (
                          <button onClick={() => handleRemoverPreco(produto.id)} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-white/[0.06] transition-colors">
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>

      {/* Modal: Editar preço de parceria */}
      <Dialog open={!!editPreco} onOpenChange={v => !v && setEditPreco(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Preço de parceria — {editPreco?.nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <Select value={precoForm.tipo} onValueChange={v => setPrecoForm(f => ({ ...f, tipo: v as 'percentual' | 'fixo' }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixo">Valor fixo</SelectItem>
                  <SelectItem value="percentual">Percentual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {precoForm.tipo === 'percentual' ? (
              <div className="space-y-1.5">
                <Label className="text-xs">% (positivo = desconto, negativo = acréscimo)</Label>
                <Input type="number" placeholder="Ex: 10 para 10% de desconto" value={precoForm.percentual} onChange={e => setPrecoForm(f => ({ ...f, percentual: e.target.value }))} className="h-8 text-sm" />
                {precoForm.percentual && (() => {
                  const p = parseFloat(precoForm.percentual)
                  const padraoItem = precoPadrao.find(pp => pp.item_id === editPreco?.id)
                  return (
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {padraoItem?.preco_sujo != null && <p>Sujo: {fmt(padraoItem.preco_sujo * (1 - p / 100))}</p>}
                      {padraoItem?.preco_limpo != null && <p>Limpo: {fmt(padraoItem.preco_limpo * (1 - p / 100))}</p>}
                    </div>
                  )
                })()}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Preço Sujo</Label>
                  <Input type="number" placeholder="0" value={precoForm.preco_sujo} onChange={e => setPrecoForm(f => ({ ...f, preco_sujo: e.target.value }))} className="h-8 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Preço Limpo</Label>
                  <Input type="number" placeholder="0" value={precoForm.preco_limpo} onChange={e => setPrecoForm(f => ({ ...f, preco_limpo: e.target.value }))} className="h-8 text-sm" />
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditPreco(null)}>Cancelar</Button>
            <Button size="sm" onClick={handleSalvarPreco} disabled={precoSaving}>
              {precoSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}

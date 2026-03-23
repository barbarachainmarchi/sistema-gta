'use client'

import { useState, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Edit2, Loader2, Plus, Check, X, Users, Car, Package, MapPin, Search, ImageUp, Copy, Trash2 } from 'lucide-react'
import { gerarImagemFaccao } from '@/lib/gerarImagem'
import { uploadImgbb, getImgbbKey } from '@/lib/imgbb'
import { cn } from '@/lib/utils'

const FACTION_COLORS = [
  '#6366f1','#8b5cf6','#a855f7','#ec4899',
  '#ef4444','#f97316','#eab308','#22c55e',
  '#10b981','#06b6d4','#3b82f6','#6b7280',
]

export type Faccao      = { id: string; nome: string; sigla: string | null; descricao: string | null; territorio: string | null; cor_tag: string; deep: string | null; status: 'ativo' | 'inativo'; created_at: string; updated_at: string }
export type Membro      = { id: string; nome: string; vulgo: string | null; telefone: string | null; instagram: string | null; deep: string | null; faccao_id: string | null; cargo_faccao: string | null; status: 'ativo' | 'inativo'; observacoes: string | null; membro_proprio: boolean; data_entrada: string | null; data_saida: string | null; faccoes: { id: string; nome: string; cor_tag: string } | null }
export type Veiculo     = { id: string; placa: string | null; modelo: string | null; cor: string | null; proprietario_tipo: 'membro' | 'faccao' | 'desconhecido' | null; proprietario_id: string | null; observacoes: string | null }
export type FaccaoPreco = { id: string; faccao_id: string; item_id: string; tipo: 'percentual' | 'fixo'; percentual: number | null; preco_sujo: number | null; preco_limpo: number | null; observacoes: string | null }
export type Produto     = { id: string; nome: string }

function fmt(v: number | null) {
  if (v == null) return '—'
  return `R$ ${v.toLocaleString('pt-BR')}`
}

const emptyMembroForm = { nome: '', vulgo: '', telefone: '', cargo_faccao: '', status: 'ativo' as 'ativo' | 'inativo', observacoes: '' }
const emptyVeiculoForm = { placa: '', modelo: '', cor: '', proprietario_tipo: 'faccao' as 'membro' | 'faccao' | 'desconhecido', proprietario_id: '', observacoes: '' }

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
  onMembroSaved: (m: Membro, isNew: boolean) => void
  onMembroDeleted: (id: string) => void
  onVeiculoSaved: (v: Veiculo, isNew: boolean) => void
  onVeiculoDeleted: (id: string) => void
}

export function FaccaoDetalhe({ faccao, membros, veiculos, todosProdutos, faccaoPrecos, open, onClose, onUpdateFaccao, onUpdateFaccaoPrecos, onMembroSaved, onMembroDeleted, onVeiculoSaved, onVeiculoDeleted }: Props) {
  const sbRef = useRef<ReturnType<typeof createClient> | null>(null)
  const sb = useCallback(() => { if (!sbRef.current) sbRef.current = createClient(); return sbRef.current }, [])

  // ── Edição básica ──────────────────────────────────────────────────────────
  const [editando, setEditando] = useState(false)
  const [geralForm, setGeralForm] = useState({ nome: faccao.nome, sigla: faccao.sigla ?? '', descricao: faccao.descricao ?? '', territorio: faccao.territorio ?? '', deep: faccao.deep ?? '', cor_tag: faccao.cor_tag, status: faccao.status })
  const [geralSaving, setGeralSaving] = useState(false)

  function abrirEdicao() {
    setGeralForm({ nome: faccao.nome, sigla: faccao.sigla ?? '', descricao: faccao.descricao ?? '', territorio: faccao.territorio ?? '', deep: faccao.deep ?? '', cor_tag: faccao.cor_tag, status: faccao.status })
    setEditando(true)
  }

  async function handleSalvarGeral() {
    if (!geralForm.nome) { toast.error('Nome obrigatório'); return }
    setGeralSaving(true)
    const { data, error } = await sb().from('faccoes').update({
      nome: geralForm.nome, sigla: geralForm.sigla.trim() || null,
      descricao: geralForm.descricao || null, territorio: geralForm.territorio || null,
      deep: geralForm.deep || null,
      cor_tag: geralForm.cor_tag, status: geralForm.status,
    }).eq('id', faccao.id).select().single()
    setGeralSaving(false)
    if (error) { toast.error('Erro ao salvar'); return }
    onUpdateFaccao(data as Faccao)
    setEditando(false)
    toast.success('Facção atualizada')
  }

  // ── Compartilhar imagem ────────────────────────────────────────────────────
  const [compartilhando, setCompartilhando] = useState(false)
  const [linkImagem, setLinkImagem] = useState<string | null>(null)
  const [linkCopiado, setLinkCopiado] = useState(false)

  async function handleCompartilhar() {
    setCompartilhando(true)
    try {
      const key = await getImgbbKey()
      if (!key) { toast.error('Chave imgbb não configurada — veja Admin > Integrações'); setCompartilhando(false); return }
      const base64 = gerarImagemFaccao({ nome: faccao.nome, sigla: faccao.sigla, cor: faccao.cor_tag, territorio: faccao.territorio, status: faccao.status, membros, veiculos, faccaoPrecos, todosProdutos })
      const url = await uploadImgbb(base64, key, `faccao-${faccao.nome}`)
      setLinkImagem(url)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar imagem')
    } finally {
      setCompartilhando(false)
    }
  }

  function copiarLink() {
    if (!linkImagem) return
    navigator.clipboard.writeText(linkImagem)
    setLinkCopiado(true)
    setTimeout(() => setLinkCopiado(false), 2000)
    toast.success('Link copiado!')
  }

  // ── Busca por seção ────────────────────────────────────────────────────────
  const [buscaMembro, setBuscaMembro] = useState('')
  const [buscaVeiculo, setBuscaVeiculo] = useState('')
  const [buscaProduto, setBuscaProduto] = useState('')

  const membrosFiltrados = useMemo(() => membros.filter(m =>
    !buscaMembro || m.nome.toLowerCase().includes(buscaMembro.toLowerCase()) ||
    m.vulgo?.toLowerCase().includes(buscaMembro.toLowerCase()) ||
    m.telefone?.includes(buscaMembro)
  ), [membros, buscaMembro])

  const veiculosFiltrados = useMemo(() => veiculos.filter(v => {
    if (!buscaVeiculo) return true
    const q = buscaVeiculo.toLowerCase()
    const dono = v.proprietario_tipo === 'membro' ? membros.find(m => m.id === v.proprietario_id)?.nome : undefined
    return v.placa?.toLowerCase().includes(q) || v.modelo?.toLowerCase().includes(q) || dono?.toLowerCase().includes(q)
  }), [veiculos, buscaVeiculo, membros])

  const veiculosPorMembro = useMemo(() => {
    const map: Record<string, Veiculo[]> = {}
    veiculos.filter(v => v.proprietario_tipo === 'membro' && v.proprietario_id).forEach(v => {
      const id = v.proprietario_id!
      if (!map[id]) map[id] = []
      map[id].push(v)
    })
    return map
  }, [veiculos])

  const precosFiltrados = useMemo(() => faccaoPrecos.filter(p => {
    if (!buscaProduto) return true
    const produto = todosProdutos.find(x => x.id === p.item_id)
    return produto?.nome.toLowerCase().includes(buscaProduto.toLowerCase())
  }), [faccaoPrecos, buscaProduto, todosProdutos])

  // ── CRUD Membros ───────────────────────────────────────────────────────────
  const [membroDialog, setMembroDialog] = useState<{ membro: Membro | null } | null>(null) // null = fechado, { membro: null } = novo, { membro: m } = editar
  const [membroForm, setMembroForm] = useState(emptyMembroForm)
  const [membroSaving, setMembroSaving] = useState(false)
  const [confirmDeleteMembro, setConfirmDeleteMembro] = useState<Membro | null>(null)

  function abrirNovoMembro() {
    setMembroForm(emptyMembroForm)
    setMembroDialog({ membro: null })
  }

  function abrirEditarMembro(m: Membro) {
    setMembroForm({ nome: m.nome, vulgo: m.vulgo ?? '', telefone: m.telefone ?? '', cargo_faccao: m.cargo_faccao ?? '', status: m.status, observacoes: m.observacoes ?? '' })
    setMembroDialog({ membro: m })
  }

  async function handleSalvarMembro() {
    if (!membroForm.nome.trim()) { toast.error('Nome obrigatório'); return }
    setMembroSaving(true)
    const payload = {
      nome: membroForm.nome.trim(),
      vulgo: membroForm.vulgo.trim() || null,
      telefone: membroForm.telefone.trim() || null,
      cargo_faccao: membroForm.cargo_faccao.trim() || null,
      status: membroForm.status,
      observacoes: membroForm.observacoes.trim() || null,
      faccao_id: faccao.id,
    }
    const isNew = !membroDialog?.membro
    let data: Membro | null = null
    if (isNew) {
      const res = await sb().from('membros').insert(payload).select('*, faccoes(id, nome, cor_tag)').single()
      if (res.error) { toast.error('Erro ao criar membro'); setMembroSaving(false); return }
      data = res.data as Membro
    } else {
      const res = await sb().from('membros').update(payload).eq('id', membroDialog!.membro!.id).select('*, faccoes(id, nome, cor_tag)').single()
      if (res.error) { toast.error('Erro ao salvar membro'); setMembroSaving(false); return }
      data = res.data as Membro
    }
    setMembroSaving(false)
    onMembroSaved(data!, isNew)
    setMembroDialog(null)
    toast.success(isNew ? 'Membro adicionado' : 'Membro atualizado')
  }

  async function handleDeletarMembro(m: Membro) {
    const { error } = await sb().from('membros').delete().eq('id', m.id)
    if (error) { toast.error('Erro ao excluir membro'); return }
    onMembroDeleted(m.id)
    setConfirmDeleteMembro(null)
    toast.success('Membro excluído')
  }

  // ── CRUD Veículos ──────────────────────────────────────────────────────────
  const [veiculoDialog, setVeiculoDialog] = useState<{ veiculo: Veiculo | null } | null>(null)
  const [veiculoForm, setVeiculoForm] = useState(emptyVeiculoForm)
  const [veiculoSaving, setVeiculoSaving] = useState(false)
  const [confirmDeleteVeiculo, setConfirmDeleteVeiculo] = useState<Veiculo | null>(null)

  function abrirNovoVeiculo() {
    setVeiculoForm(emptyVeiculoForm)
    setVeiculoDialog({ veiculo: null })
  }

  function abrirEditarVeiculo(v: Veiculo) {
    setVeiculoForm({ placa: v.placa ?? '', modelo: v.modelo ?? '', cor: v.cor ?? '', proprietario_tipo: v.proprietario_tipo ?? 'faccao', proprietario_id: v.proprietario_id ?? '', observacoes: v.observacoes ?? '' })
    setVeiculoDialog({ veiculo: v })
  }

  async function handleSalvarVeiculo() {
    setVeiculoSaving(true)
    const payload = {
      placa: veiculoForm.placa.trim() || null,
      modelo: veiculoForm.modelo.trim() || null,
      cor: veiculoForm.cor.trim() || null,
      proprietario_tipo: veiculoForm.proprietario_tipo,
      proprietario_id: veiculoForm.proprietario_tipo === 'membro' && veiculoForm.proprietario_id ? veiculoForm.proprietario_id : veiculoForm.proprietario_tipo === 'faccao' ? faccao.id : null,
      observacoes: veiculoForm.observacoes.trim() || null,
    }
    const isNew = !veiculoDialog?.veiculo
    let data: Veiculo | null = null
    if (isNew) {
      const res = await sb().from('veiculos').insert(payload).select().single()
      if (res.error) { toast.error('Erro ao criar veículo'); setVeiculoSaving(false); return }
      data = res.data as Veiculo
    } else {
      const res = await sb().from('veiculos').update(payload).eq('id', veiculoDialog!.veiculo!.id).select().single()
      if (res.error) { toast.error('Erro ao salvar veículo'); setVeiculoSaving(false); return }
      data = res.data as Veiculo
    }
    setVeiculoSaving(false)
    onVeiculoSaved(data!, isNew)
    setVeiculoDialog(null)
    toast.success(isNew ? 'Veículo adicionado' : 'Veículo atualizado')
  }

  async function handleDeletarVeiculo(v: Veiculo) {
    const { error } = await sb().from('veiculos').delete().eq('id', v.id)
    if (error) { toast.error('Erro ao excluir veículo'); return }
    onVeiculoDeleted(v.id)
    setConfirmDeleteVeiculo(null)
    toast.success('Veículo excluído')
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
      <DialogContent aria-describedby={undefined} className="max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0 pb-2 border-b border-border">
          <div className="flex items-center gap-3">
            <span className="h-5 w-5 rounded-full shrink-0" style={{ background: faccao.cor_tag }} />
            <DialogTitle className="text-lg">{faccao.nome}</DialogTitle>
            {faccao.sigla && <span className="text-xs font-mono text-muted-foreground bg-white/[0.06] px-1.5 py-0.5 rounded border border-white/10">{faccao.sigla}</span>}
            <span className={cn('text-[11px] px-2 py-0.5 rounded-full', faccao.status === 'ativo' ? 'bg-green-500/10 text-green-400' : 'bg-zinc-500/10 text-zinc-500')}>
              {faccao.status === 'ativo' ? 'Ativa' : 'Inativa'}
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              {linkImagem && (
                <div className="flex items-center gap-1 rounded border border-border bg-white/[0.04] px-2 h-7 max-w-[220px]">
                  <span className="text-[11px] text-muted-foreground truncate flex-1">{linkImagem}</span>
                  <button onClick={copiarLink} title="Copiar link" className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                    {linkCopiado ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              )}
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={handleCompartilhar} disabled={compartilhando} title="Gerar imagem e enviar para imgbb">
                {compartilhando ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImageUp className="h-3 w-3" />}
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={editando ? () => setEditando(false) : abrirEdicao}>
                {editando ? <><X className="h-3 w-3" />Cancelar</> : <><Edit2 className="h-3 w-3" />Editar</>}
              </Button>
            </div>
          </div>
          {(faccao.territorio || faccao.descricao || faccao.deep) && (
            <div className="text-xs text-muted-foreground flex flex-wrap gap-3 pt-1 pl-8">
              {faccao.territorio && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{faccao.territorio}</span>}
              {faccao.descricao && <span>{faccao.descricao}</span>}
              {faccao.deep && <span className="font-mono text-[11px] bg-white/[0.05] px-1.5 py-0.5 rounded border border-white/10">{faccao.deep}</span>}
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* Form de edição inline */}
          {editando && (
            <div className="rounded-lg border border-border bg-white/[0.02] p-4 space-y-3">
              <div className="grid grid-cols-[1fr_120px] gap-3">
                <div className="space-y-1"><Label className="text-xs">Nome *</Label><Input value={geralForm.nome} onChange={e => setGeralForm(f => ({ ...f, nome: e.target.value }))} className="h-8 text-sm" /></div>
                <div className="space-y-1"><Label className="text-xs">Sigla</Label><Input value={geralForm.sigla} onChange={e => setGeralForm(f => ({ ...f, sigla: e.target.value }))} placeholder="Ex: CV" className="h-8 text-sm" maxLength={10} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1"><Label className="text-xs">Território</Label><Input value={geralForm.territorio} onChange={e => setGeralForm(f => ({ ...f, territorio: e.target.value }))} className="h-8 text-sm" /></div>
                <div className="space-y-1"><Label className="text-xs">Descrição</Label><Input value={geralForm.descricao} onChange={e => setGeralForm(f => ({ ...f, descricao: e.target.value }))} className="h-8 text-sm" /></div>
                <div className="space-y-1"><Label className="text-xs">Deep</Label><Input value={geralForm.deep} onChange={e => setGeralForm(f => ({ ...f, deep: e.target.value }))} placeholder="Endereço deep web..." className="h-8 text-sm" /></div>
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
                  <Switch checked={geralForm.status === 'ativo'} onCheckedChange={v => setGeralForm(f => ({ ...f, status: v ? 'ativo' : 'inativo' }))} />
                  <span className="text-xs text-muted-foreground">{geralForm.status === 'ativo' ? 'Ativa' : 'Inativa'}</span>
                </div>
                <Button size="sm" className="h-7 text-xs" onClick={handleSalvarGeral} disabled={geralSaving}>
                  {geralSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Salvar alterações'}
                </Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-6 items-start">
          {/* Membros - coluna esquerda */}
          <section className="space-y-2">
            <div className="flex items-center gap-3">
              <p className="text-sm font-semibold flex items-center gap-2 shrink-0"><Users className="h-4 w-4 text-muted-foreground" />Membros</p>
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input placeholder="Buscar por nome, vulgo ou telefone..." value={buscaMembro} onChange={e => setBuscaMembro(e.target.value)} className="pl-7 h-7 text-xs" />
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 shrink-0" onClick={abrirNovoMembro}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            {membrosFiltrados.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-5 rounded-lg border border-border border-dashed">
                {buscaMembro ? 'Nenhum resultado' : 'Nenhum membro nesta facção'}
              </p>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="grid grid-cols-[1fr_90px_80px_50px_44px] gap-2 px-3 py-1.5 bg-white/[0.02] border-b border-border text-[10px] text-muted-foreground font-medium">
                  <span>Nome / Vulgo</span><span>Cargo</span><span>Telefone</span><span>Status</span><span />
                </div>
                {membrosFiltrados.map((m, idx) => (
                  <div key={m.id} className={cn('grid grid-cols-[1fr_90px_80px_50px_44px] gap-2 items-center px-3 py-2.5', idx < membrosFiltrados.length - 1 && 'border-b border-border/40')}>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="min-w-0">
                        <span className="text-sm font-medium">{m.nome}</span>
                        {m.vulgo && <span className="ml-1.5 text-xs text-muted-foreground">"{m.vulgo}"</span>}
                      </div>
                      {(veiculosPorMembro[m.id] ?? []).map(v => (
                        <span key={v.id} title={`${v.placa ?? 'S/P'}${v.modelo ? ` — ${v.modelo}` : ''}${v.cor ? ` (${v.cor})` : ''}`} className="shrink-0 cursor-default">
                          <Car className="h-3 w-3 text-muted-foreground hover:text-foreground transition-colors" />
                        </span>
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground truncate">{m.cargo_faccao ?? '—'}</span>
                    <span className="text-xs font-mono text-muted-foreground">{m.telefone ?? '—'}</span>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded w-fit', m.status === 'ativo' ? 'bg-green-500/10 text-green-400' : 'bg-zinc-500/10 text-zinc-500')}>
                      {m.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </span>
                    <div className="flex gap-0.5">
                      <button onClick={() => abrirEditarMembro(m)} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"><Edit2 className="h-3 w-3" /></button>
                      <button onClick={() => setConfirmDeleteMembro(m)} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-white/[0.06]"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Veículos + Produtos - coluna direita */}
          <div className="space-y-6">
          <section className="space-y-2">
            <div className="flex items-center gap-3">
              <p className="text-sm font-semibold flex items-center gap-2 shrink-0"><Car className="h-4 w-4 text-muted-foreground" />Veículos</p>
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input placeholder="Buscar por placa ou modelo..." value={buscaVeiculo} onChange={e => setBuscaVeiculo(e.target.value)} className="pl-7 h-7 text-xs" />
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 shrink-0" onClick={abrirNovoVeiculo}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            {veiculosFiltrados.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-5 rounded-lg border border-border border-dashed">
                {buscaVeiculo ? 'Nenhum resultado' : 'Nenhum veículo desta facção'}
              </p>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="grid grid-cols-[90px_1fr_60px_1fr_44px] gap-2 px-3 py-1.5 bg-white/[0.02] border-b border-border text-[10px] text-muted-foreground font-medium">
                  <span>Placa</span><span>Modelo</span><span>Cor</span><span>Proprietário</span><span />
                </div>
                {veiculosFiltrados.map((v, idx) => {
                  const dono = v.proprietario_tipo === 'membro' ? membros.find(m => m.id === v.proprietario_id) : null
                  return (
                  <div key={v.id} className={cn('grid grid-cols-[90px_1fr_60px_1fr_44px] gap-2 items-center px-3 py-2.5', idx < veiculosFiltrados.length - 1 && 'border-b border-border/40')}>
                    <span className="font-mono text-sm font-semibold">{v.placa ?? '—'}</span>
                    <span className="text-sm text-muted-foreground truncate">{v.modelo ?? '—'}</span>
                    <span className="text-sm text-muted-foreground">{v.cor ?? '—'}</span>
                    <span className="text-xs truncate">{dono ? dono.nome : v.proprietario_tipo === 'faccao' ? 'Facção' : '—'}</span>
                    <div className="flex gap-0.5">
                      <button onClick={() => abrirEditarVeiculo(v)} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"><Edit2 className="h-3 w-3" /></button>
                      <button onClick={() => setConfirmDeleteVeiculo(v)} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-white/[0.06]"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Produtos */}
          <section className="space-y-2">
            <div className="flex items-center gap-3">
              <p className="text-sm font-semibold flex items-center gap-2 shrink-0"><Package className="h-4 w-4 text-muted-foreground" />Produtos</p>
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input placeholder="Buscar produto..." value={buscaProduto} onChange={e => setBuscaProduto(e.target.value)} className="pl-7 h-7 text-xs" />
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 ml-auto shrink-0" onClick={() => setAddingPreco(true)} disabled={produtosDisponiveis.length === 0}>
                <Plus className="h-3 w-3" />Adicionar
              </Button>
            </div>
            {precosFiltrados.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-5 rounded-lg border border-border border-dashed">
                {buscaProduto ? 'Nenhum resultado' : 'Nenhum produto cadastrado'}
              </p>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="grid grid-cols-[1fr_100px_100px_80px_44px] gap-3 px-4 py-1.5 bg-white/[0.02] border-b border-border text-[10px] text-muted-foreground font-medium">
                  <span>Produto</span><span className="text-right">Sujo</span><span className="text-right">Limpo</span><span>Tipo</span><span />
                </div>
                {precosFiltrados.map((preco, idx) => {
                  const produto = todosProdutos.find(p => p.id === preco.item_id)
                  return (
                    <div key={preco.item_id} className={cn('grid grid-cols-[1fr_100px_100px_80px_44px] gap-3 items-center px-4 py-2.5', idx < precosFiltrados.length - 1 && 'border-b border-border/40')}>
                      <span className="text-sm font-medium">{produto?.nome ?? '—'}</span>
                      <span className="text-sm text-right tabular-nums">{fmt(preco.preco_sujo)}</span>
                      <span className="text-sm text-right tabular-nums">{fmt(preco.preco_limpo)}</span>
                      <span className="text-xs text-muted-foreground">
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
          </div>{/* end coluna direita */}
          </div>{/* end grid 2 colunas */}
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

      {/* Modal: Membro (add/edit) */}
      <Dialog open={!!membroDialog} onOpenChange={v => !v && setMembroDialog(null)}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">{membroDialog?.membro ? 'Editar membro' : 'Novo membro'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome *</Label>
                <Input value={membroForm.nome} onChange={e => setMembroForm(f => ({ ...f, nome: e.target.value }))} className="h-8 text-sm" placeholder="Nome ingame" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Vulgo</Label>
                <Input value={membroForm.vulgo} onChange={e => setMembroForm(f => ({ ...f, vulgo: e.target.value }))} className="h-8 text-sm" placeholder="Apelido" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Telefone</Label>
                <Input value={membroForm.telefone} onChange={e => setMembroForm(f => ({ ...f, telefone: e.target.value }))} className="h-8 text-sm" placeholder="Ex: 555-1234" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Cargo</Label>
                <Input value={membroForm.cargo_faccao} onChange={e => setMembroForm(f => ({ ...f, cargo_faccao: e.target.value }))} className="h-8 text-sm" placeholder="Ex: Soldado" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Observações</Label>
              <Input value={membroForm.observacoes} onChange={e => setMembroForm(f => ({ ...f, observacoes: e.target.value }))} className="h-8 text-sm" placeholder="Notas..." />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={membroForm.status === 'ativo'} onCheckedChange={v => setMembroForm(f => ({ ...f, status: v ? 'ativo' : 'inativo' }))} />
              <span className="text-xs text-muted-foreground">{membroForm.status === 'ativo' ? 'Ativo' : 'Inativo'}</span>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setMembroDialog(null)}>Cancelar</Button>
            <Button size="sm" onClick={handleSalvarMembro} disabled={membroSaving}>
              {membroSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Confirmar exclusão de membro */}
      <Dialog open={!!confirmDeleteMembro} onOpenChange={v => !v && setConfirmDeleteMembro(null)}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-xs">
          <DialogHeader><DialogTitle className="text-sm">Excluir membro</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Tem certeza que deseja excluir <strong className="text-foreground">{confirmDeleteMembro?.nome}</strong>? Esta ação não pode ser desfeita.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmDeleteMembro(null)}>Cancelar</Button>
            <Button variant="destructive" size="sm" onClick={() => confirmDeleteMembro && handleDeletarMembro(confirmDeleteMembro)}>Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Veículo (add/edit) */}
      <Dialog open={!!veiculoDialog} onOpenChange={v => !v && setVeiculoDialog(null)}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">{veiculoDialog?.veiculo ? 'Editar veículo' : 'Novo veículo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Placa</Label>
                <Input value={veiculoForm.placa} onChange={e => setVeiculoForm(f => ({ ...f, placa: e.target.value }))} className="h-8 text-sm font-mono" placeholder="ABC1234" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Modelo</Label>
                <Input value={veiculoForm.modelo} onChange={e => setVeiculoForm(f => ({ ...f, modelo: e.target.value }))} className="h-8 text-sm" placeholder="Ex: Sultan" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Cor</Label>
                <Input value={veiculoForm.cor} onChange={e => setVeiculoForm(f => ({ ...f, cor: e.target.value }))} className="h-8 text-sm" placeholder="Ex: Preto" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Proprietário</Label>
              <Select value={veiculoForm.proprietario_tipo} onValueChange={v => setVeiculoForm(f => ({ ...f, proprietario_tipo: v as typeof f.proprietario_tipo, proprietario_id: '' }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="faccao">Facção ({faccao.nome})</SelectItem>
                  <SelectItem value="membro">Membro específico</SelectItem>
                  <SelectItem value="desconhecido">Desconhecido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {veiculoForm.proprietario_tipo === 'membro' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Membro</Label>
                <Select value={veiculoForm.proprietario_id} onValueChange={v => setVeiculoForm(f => ({ ...f, proprietario_id: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecionar membro..." /></SelectTrigger>
                  <SelectContent>
                    {membros.map(m => <SelectItem key={m.id} value={m.id}>{m.nome}{m.vulgo ? ` "${m.vulgo}"` : ''}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Observações</Label>
              <Input value={veiculoForm.observacoes} onChange={e => setVeiculoForm(f => ({ ...f, observacoes: e.target.value }))} className="h-8 text-sm" placeholder="Notas..." />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setVeiculoDialog(null)}>Cancelar</Button>
            <Button size="sm" onClick={handleSalvarVeiculo} disabled={veiculoSaving}>
              {veiculoSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Confirmar exclusão de veículo */}
      <Dialog open={!!confirmDeleteVeiculo} onOpenChange={v => !v && setConfirmDeleteVeiculo(null)}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-xs">
          <DialogHeader><DialogTitle className="text-sm">Excluir veículo</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Excluir <strong className="text-foreground">{confirmDeleteVeiculo?.modelo ?? confirmDeleteVeiculo?.placa ?? 'este veículo'}</strong>?</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmDeleteVeiculo(null)}>Cancelar</Button>
            <Button variant="destructive" size="sm" onClick={() => confirmDeleteVeiculo && handleDeletarVeiculo(confirmDeleteVeiculo)}>Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}

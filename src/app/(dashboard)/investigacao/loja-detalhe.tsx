'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Edit2, Loader2, Plus, X, Package, Users, MapPin, Tag, Search, Car, ImageUp, Copy, Check, Layers } from 'lucide-react'
import { gerarImagemLoja } from '@/lib/gerarImagem'
import { uploadImgbb, getImgbbKey } from '@/lib/imgbb'
import { cn, norm } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Membro, Produto, Veiculo, Servico } from './faccao-detalhe'

type Loja = { id: string; nome: string; localizacao: string | null; tipo: string | null; status: 'ativo' | 'inativo' }
type LojaItem = { id: string; item_id: string; preco: number; preco_sujo: number | null; items: { id: string; nome: string; categorias_item: { nome: string } | null } | null }
type LojaFuncionario = { id: string; membro_id: string; cargo: string | null; membros: { id: string; nome: string; vulgo: string | null; telefone: string | null; faccoes: { nome: string; cor_tag: string } | null } | null }

function fmt(v: number) { return `R$ ${v.toLocaleString('pt-BR')}` }

interface Props {
  loja: Loja
  todosProdutos: Produto[]
  todosMembros: Membro[]
  todosVeiculos: Veiculo[]
  todoServicos: Servico[]
  open: boolean
  onClose: () => void
  onUpdateLoja: (l: Loja) => void
}

export function LojaDetalhe({ loja, todosProdutos, todosMembros, todosVeiculos, todoServicos, open, onClose, onUpdateLoja }: Props) {
  const sbRef = useRef<ReturnType<typeof createClient> | null>(null)
  const sb = useCallback(() => { if (!sbRef.current) sbRef.current = createClient(); return sbRef.current }, [])

  // ── Dados lazy ─────────────────────────────────────────────────────────────
  const [itens, setItens] = useState<LojaItem[]>([])
  const [funcionarios, setFuncionarios] = useState<LojaFuncionario[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [lojaServicosIds, setLojaServicosIds] = useState<string[]>([])
  const [servicoAddOpen, setServicoAddOpen] = useState(false)
  const [novoServicoId, setNovoServicoId] = useState('')
  const [servicoSaving, setServicoSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoadingData(true)
    Promise.all([
      sb().from('loja_item_precos').select('id, item_id, preco, preco_sujo, items(id, nome, categorias_item(nome))').eq('loja_id', loja.id).order('items(nome)'),
      sb().from('loja_membros').select('id, membro_id, cargo, membros(id, nome, vulgo, telefone, faccoes(nome, cor_tag))').eq('loja_id', loja.id),
      sb().from('loja_servicos').select('servico_id').eq('loja_id', loja.id),
    ]).then(([itensRes, funcRes, servicosRes]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setItens((itensRes.data ?? []) as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setFuncionarios((funcRes.data ?? []) as any)
      setLojaServicosIds((servicosRes.data ?? []).map((r: { servico_id: string }) => r.servico_id))
      setLoadingData(false)
    })
  }, [open, loja.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAdicionarServico() {
    if (!novoServicoId) return
    setServicoSaving(true)
    const { error } = await sb().from('loja_servicos').insert({ loja_id: loja.id, servico_id: novoServicoId })
    setServicoSaving(false)
    if (error) { toast.error('Erro ao adicionar serviço'); return }
    setLojaServicosIds(prev => [...prev, novoServicoId])
    setNovoServicoId('')
    setServicoAddOpen(false)
    toast.success('Serviço adicionado')
  }

  async function handleRemoverServico(servicoId: string) {
    await sb().from('loja_servicos').delete().eq('loja_id', loja.id).eq('servico_id', servicoId)
    setLojaServicosIds(prev => prev.filter(id => id !== servicoId))
    toast.success('Serviço removido')
  }

  // ── Edição básica ──────────────────────────────────────────────────────────
  const [editando, setEditando] = useState(false)
  const [lojaForm, setLojaForm] = useState({ nome: loja.nome, localizacao: loja.localizacao ?? '', tipo: loja.tipo ?? '', status: loja.status })
  const [lojaSaving, setLojaSaving] = useState(false)

  function abrirEdicao() {
    setLojaForm({ nome: loja.nome, localizacao: loja.localizacao ?? '', tipo: loja.tipo ?? '', status: loja.status })
    setEditando(true)
  }

  async function handleSalvarLoja() {
    if (!lojaForm.nome) { toast.error('Nome obrigatório'); return }
    setLojaSaving(true)
    const { data, error } = await sb().from('lojas').update({ nome: lojaForm.nome, localizacao: lojaForm.localizacao || null, tipo: lojaForm.tipo || null, status: lojaForm.status }).eq('id', loja.id).select().single()
    setLojaSaving(false)
    if (error) { toast.error('Erro ao salvar'); return }
    onUpdateLoja(data as Loja)
    setEditando(false)
    toast.success('Loja atualizada')
  }

  // ── Itens ─────────────────────────────────────────────────────────────────
  const [addItem, setAddItem] = useState(false)
  const [newItemId, setNewItemId] = useState('')
  const [buscaNovoItem, setBuscaNovoItem] = useState('')
  const [newItemPreco, setNewItemPreco] = useState('')
  const [newItemPrecoSujo, setNewItemPrecoSujo] = useState('')
  const [editItem, setEditItem] = useState<LojaItem | null>(null)
  const [editItemPreco, setEditItemPreco] = useState('')
  const [editItemPrecoSujo, setEditItemPrecoSujo] = useState('')
  const [savingItem, setSavingItem] = useState(false)
  const [buscaItem, setBuscaItem] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas')
  const [extraProdutos, setExtraProdutos] = useState<Produto[]>([])
  const [criandoItem, setCriandoItem] = useState(false)

  const todosProds = useMemo(() => [...todosProdutos, ...extraProdutos], [todosProdutos, extraProdutos])
  const itensDisponiveis = todosProds.filter(p => !itens.some(i => i.item_id === p.id))

  async function handleCriarItem() {
    if (!buscaNovoItem.trim() || criandoItem) return
    setCriandoItem(true)
    try {
      const { data, error } = await sb().from('items').insert({ nome: buscaNovoItem.trim(), status: 'ativo', eh_compravel: true }).select('id, nome').single()
      if (error) throw error
      setExtraProdutos(prev => [...prev, { id: (data as { id: string; nome: string }).id, nome: (data as { id: string; nome: string }).nome }])
      setNewItemId((data as { id: string; nome: string }).id)
      setBuscaNovoItem((data as { id: string; nome: string }).nome)
    } catch { toast.error('Erro ao cadastrar item') }
    finally { setCriandoItem(false) }
  }

  const categoriasUnicas = useMemo(() => {
    const cats = new Set(itens.map(i => i.items?.categorias_item?.nome ?? 'Sem categoria'))
    return ['todas', ...Array.from(cats).sort()]
  }, [itens])

  const itensFiltrados = useMemo(() => {
    return itens.filter(i => {
      const matchCat = categoriaFiltro === 'todas' || (i.items?.categorias_item?.nome ?? 'Sem categoria') === categoriaFiltro
      const matchBusca = !buscaItem || norm(i.items?.nome).includes(norm(buscaItem))
      return matchCat && matchBusca
    })
  }, [itens, categoriaFiltro, buscaItem])

  async function handleSalvarItem() {
    if (!newItemId || !newItemPreco) return
    setSavingItem(true)
    const { data, error } = await sb().from('loja_item_precos').upsert({ loja_id: loja.id, item_id: newItemId, preco: parseFloat(newItemPreco), preco_sujo: newItemPrecoSujo ? parseFloat(newItemPrecoSujo) : null }, { onConflict: 'loja_id,item_id' }).select('id, item_id, preco, preco_sujo, items(id, nome, categorias_item(nome))').single()
    setSavingItem(false)
    if (error) { toast.error('Erro ao salvar'); return }
    await sb().from('items').update({ eh_compravel: true }).eq('id', newItemId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setItens(prev => [...prev.filter(i => i.item_id !== newItemId), data as any])
    setAddItem(false); setNewItemId(''); setBuscaNovoItem(''); setNewItemPreco(''); setNewItemPrecoSujo('')
    toast.success('Item adicionado')
  }

  async function handleEditarItem() {
    if (!editItem || !editItemPreco) return
    setSavingItem(true)
    const { data, error } = await sb().from('loja_item_precos').update({ preco: parseFloat(editItemPreco), preco_sujo: editItemPrecoSujo ? parseFloat(editItemPrecoSujo) : null }).eq('id', editItem.id).select('id, item_id, preco, preco_sujo, items(id, nome, categorias_item(nome))').single()
    setSavingItem(false)
    if (error) { toast.error('Erro ao salvar'); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setItens(prev => prev.map(i => i.id === editItem.id ? data as any : i))
    setEditItem(null); setEditItemPreco(''); setEditItemPrecoSujo('')
    toast.success('Preço atualizado')
  }

  async function handleRemoverItem(item: LojaItem) {
    await sb().from('loja_item_precos').delete().eq('id', item.id)
    const [{ count: cLoja }, { count: cFac }] = await Promise.all([
      sb().from('loja_item_precos').select('*', { count: 'exact', head: true }).eq('item_id', item.item_id),
      sb().from('faccao_item_precos').select('*', { count: 'exact', head: true }).eq('item_id', item.item_id),
    ])
    if ((cLoja ?? 0) === 0 && (cFac ?? 0) === 0) await sb().from('items').update({ eh_compravel: false }).eq('id', item.item_id)
    setItens(prev => prev.filter(i => i.id !== item.id))
    toast.success('Item removido')
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
      const base64 = gerarImagemLoja({ nome: loja.nome, localizacao: loja.localizacao, tipo: loja.tipo, status: loja.status, itens, funcionarios })
      const url = await uploadImgbb(base64, key, `loja-${loja.nome}`)
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

  // ── Funcionários ───────────────────────────────────────────────────────────
  const [addFunc, setAddFunc] = useState(false)
  const [newFuncId, setNewFuncId] = useState('')
  const [newFuncBusca, setNewFuncBusca] = useState('')
  const [newFuncCargo, setNewFuncCargo] = useState('')
  const [savingFunc, setSavingFunc] = useState(false)
  const [buscaFunc, setBuscaFunc] = useState('')

  const membrosDisponiveis = todosMembros.filter(m => !funcionarios.some(f => f.membro_id === m.id))

  const veiculosPorMembro = useMemo(() => {
    const map: Record<string, Veiculo[]> = {}
    todosVeiculos.filter(v => v.proprietario_tipo === 'membro' && v.proprietario_id).forEach(v => {
      const id = v.proprietario_id!
      if (!map[id]) map[id] = []
      map[id].push(v)
    })
    return map
  }, [todosVeiculos])

  const funcionariosFiltrados = useMemo(() => {
    if (!buscaFunc) return funcionarios
    const q = norm(buscaFunc)
    return funcionarios.filter(f => norm(f.membros?.nome).includes(q) || norm(f.membros?.vulgo).includes(q) || norm(f.cargo).includes(q))
  }, [funcionarios, buscaFunc])

  async function handleSalvarFunc() {
    if (!newFuncId) return
    setSavingFunc(true)
    const { data, error } = await sb().from('loja_membros').insert({ loja_id: loja.id, membro_id: newFuncId, cargo: newFuncCargo || null }).select('id, membro_id, cargo, membros(id, nome, vulgo, faccoes(nome, cor_tag))').single()
    setSavingFunc(false)
    if (error) { toast.error('Erro ao adicionar'); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setFuncionarios(prev => [...prev, data as any])
    setAddFunc(false); setNewFuncId(''); setNewFuncBusca(''); setNewFuncCargo('')
    toast.success('Funcionário adicionado')
  }

  async function handleRemoverFunc(id: string) {
    await sb().from('loja_membros').delete().eq('id', id)
    setFuncionarios(prev => prev.filter(f => f.id !== id))
    toast.success('Funcionário removido')
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent aria-describedby={undefined} className="max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <span className="flex-1">{loja.nome}</span>
            <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-normal', loja.status === 'ativo' ? 'bg-green-500/10 text-green-400' : 'bg-zinc-500/10 text-zinc-500')}>
              {loja.status === 'ativo' ? 'Ativa' : 'Inativa'}
            </span>
            {linkImagem && (
              <div className="flex items-center gap-1 rounded border border-border bg-white/[0.04] px-2 h-7 max-w-[200px]">
                <span className="text-[11px] text-muted-foreground truncate flex-1">{linkImagem}</span>
                <button onClick={copiarLink} title="Copiar link" className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                  {linkCopiado ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
            )}
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleCompartilhar} disabled={compartilhando || loadingData} title="Gerar imagem e enviar para imgbb">
              {compartilhando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageUp className="h-3.5 w-3.5" />}
            </Button>
          </DialogTitle>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {loja.localizacao && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{loja.localizacao}</span>}
            {loja.tipo && <span className="flex items-center gap-1"><Tag className="h-3 w-3" />{loja.tipo}</span>}
          </div>
        </DialogHeader>

        {loadingData ? (
          <div className="flex-1 flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-1">
            {/* Editar loja */}
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Informações</p>
              <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={editando ? () => setEditando(false) : abrirEdicao}>
                {editando ? <><X className="h-3 w-3" />Cancelar</> : <><Edit2 className="h-3 w-3" />Editar</>}
              </Button>
            </div>

            {editando && (
              <div className="rounded-lg border border-border bg-white/[0.02] p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">Nome *</Label><Input value={lojaForm.nome} onChange={e => setLojaForm(f => ({ ...f, nome: e.target.value }))} className="h-8 text-sm" /></div>
                  <div className="space-y-1"><Label className="text-xs">Localização</Label><Input value={lojaForm.localizacao} onChange={e => setLojaForm(f => ({ ...f, localizacao: e.target.value }))} className="h-8 text-sm" /></div>
                  <div className="space-y-1"><Label className="text-xs">Tipo</Label><Input value={lojaForm.tipo} onChange={e => setLojaForm(f => ({ ...f, tipo: e.target.value }))} placeholder="Ex: Armas, Drogas..." className="h-8 text-sm" /></div>
                  <div className="flex items-end gap-2 pb-0.5">
                    <Switch checked={lojaForm.status === 'ativo'} onCheckedChange={v => setLojaForm(f => ({ ...f, status: v ? 'ativo' : 'inativo' }))} />
                    <span className="text-xs text-muted-foreground">{lojaForm.status === 'ativo' ? 'Ativa' : 'Inativa'}</span>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button size="sm" className="h-7 text-xs" onClick={handleSalvarLoja} disabled={lojaSaving}>
                    {lojaSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Salvar'}
                  </Button>
                </div>
              </div>
            )}

            {/* Itens + Funcionários lado a lado */}
            <div className="grid grid-cols-2 gap-6 items-start mt-5">
            <section>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Package className="h-3.5 w-3.5" />Itens ({itens.length})</p>
                <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => setAddItem(true)}>
                  <Plus className="h-3 w-3" />Adicionar
                </Button>
              </div>

              {addItem && (
                <div className="mb-2 space-y-2">
                  <div className="flex gap-2 flex-wrap items-start">
                    <div className="relative flex-1 min-w-[160px]">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                      <Input
                        autoFocus
                        placeholder="Buscar item..."
                        value={buscaNovoItem}
                        onChange={e => { setBuscaNovoItem(e.target.value); setNewItemId('') }}
                        className={cn('h-8 text-sm pl-8', newItemId && 'border-primary')}
                      />
                      {buscaNovoItem && !newItemId && (
                        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                          {itensDisponiveis.filter(p => norm(p.nome).includes(norm(buscaNovoItem))).length === 0
                            ? (
                              <button onClick={handleCriarItem} disabled={criandoItem}
                                className="w-full text-left px-3 py-2 text-xs text-primary hover:bg-accent transition-colors flex items-center gap-1.5 disabled:opacity-50">
                                {criandoItem ? <Loader2 className="h-3 w-3 animate-spin shrink-0" /> : <Plus className="h-3 w-3 shrink-0" />}
                                Cadastrar &ldquo;{buscaNovoItem}&rdquo;
                              </button>
                            )
                            : itensDisponiveis
                                .filter(p => norm(p.nome).includes(norm(buscaNovoItem)))
                                .map(p => (
                                  <button key={p.id} className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors" onClick={() => { setNewItemId(p.id); setBuscaNovoItem(p.nome) }}>
                                    {p.nome}
                                  </button>
                                ))
                          }
                        </div>
                      )}
                    </div>
                    <Input type="number" placeholder="Sujo (opcional)" className="w-28 h-8 text-sm" value={newItemPrecoSujo} onChange={e => setNewItemPrecoSujo(e.target.value)} />
                    <Input type="number" placeholder="Limpo *" className="w-24 h-8 text-sm" value={newItemPreco} onChange={e => setNewItemPreco(e.target.value)} />
                    <Button size="sm" className="h-8 px-3" onClick={handleSalvarItem} disabled={savingItem || !newItemId || !newItemPreco}><Plus className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="sm" className="h-8 px-3" onClick={() => { setAddItem(false); setNewItemId(''); setBuscaNovoItem(''); setNewItemPreco(''); setNewItemPrecoSujo('') }}><X className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              )}

              {itens.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4 rounded-lg border border-border border-dashed">Nenhum item cadastrado</p>
              ) : (
                <>
                  {/* Busca + filtro de categoria */}
                  <div className="flex flex-col gap-2 mb-3">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input placeholder="Buscar item..." className="h-8 pl-8 text-sm" value={buscaItem} onChange={e => setBuscaItem(e.target.value)} />
                    </div>
                    {categoriasUnicas.length > 2 && (
                      <div className="flex gap-1.5 flex-wrap">
                        {categoriasUnicas.map(cat => (
                          <button key={cat} onClick={() => setCategoriaFiltro(cat)} className={cn('text-[11px] px-2.5 py-1 rounded-full border transition-colors', categoriaFiltro === cat ? 'bg-accent text-accent-foreground border-accent' : 'border-border text-muted-foreground hover:text-foreground hover:border-border/80')}>
                            {cat === 'todas' ? 'Todas' : cat}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {itensFiltrados.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhum item encontrado</p>
                  ) : (
                    <div className="rounded-lg border border-border overflow-hidden">
                      {itensFiltrados.map((item, idx) => (
                        <div key={item.id} className={cn('flex items-center gap-2 px-3 py-2', idx < itensFiltrados.length - 1 && 'border-b border-border/50')}>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm">{item.items?.nome ?? '—'}</span>
                            {item.items?.categorias_item?.nome && (
                              <span className="ml-2 text-[11px] text-muted-foreground">{item.items.categorias_item.nome}</span>
                            )}
                          </div>
                          {editItem?.id === item.id ? (
                            <>
                              <Input type="number" placeholder="Sujo" className="w-24 h-7 text-sm" value={editItemPrecoSujo} onChange={e => setEditItemPrecoSujo(e.target.value)} />
                              <Input type="number" placeholder="Limpo" className="w-24 h-7 text-sm" value={editItemPreco} onChange={e => setEditItemPreco(e.target.value)} autoFocus />
                              <button onClick={handleEditarItem} disabled={savingItem} className="h-6 w-6 rounded flex items-center justify-center text-green-400 hover:bg-white/[0.06]">
                                {savingItem ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                              </button>
                              <button onClick={() => { setEditItem(null); setEditItemPreco(''); setEditItemPrecoSujo('') }} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:bg-white/[0.06]"><X className="h-3 w-3" /></button>
                            </>
                          ) : (
                            <>
                              <div className="flex flex-col items-end shrink-0">
                                {item.preco_sujo != null && <span className="text-[11px] text-muted-foreground">S: <span className="text-foreground font-medium tabular-nums">{fmt(item.preco_sujo)}</span></span>}
                                <span className="text-[11px] text-muted-foreground">L: <span className="text-sm font-medium tabular-nums">{fmt(item.preco)}</span></span>
                              </div>
                              <button onClick={() => { setEditItem(item); setEditItemPreco(item.preco.toString()); setEditItemPrecoSujo(item.preco_sujo?.toString() ?? '') }} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"><Edit2 className="h-3 w-3" /></button>
                              <button onClick={() => handleRemoverItem(item)} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-white/[0.06]"><X className="h-3 w-3" /></button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>

            {/* Funcionários */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />Funcionários ({funcionarios.length})</p>
                <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => setAddFunc(true)} disabled={membrosDisponiveis.length === 0}>
                  <Plus className="h-3 w-3" />Adicionar
                </Button>
              </div>

              {addFunc && (
                <div className="flex gap-2 mb-2 flex-wrap items-start">
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      autoFocus
                      placeholder="Buscar membro..."
                      value={newFuncBusca}
                      onChange={e => { setNewFuncBusca(e.target.value); if (!e.target.value) setNewFuncId('') }}
                      className={cn('h-8 text-sm pl-8', newFuncId && 'border-primary')}
                      autoComplete="off"
                    />
                    {newFuncBusca && !newFuncId && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {membrosDisponiveis.filter(m => norm(m.nome).includes(norm(newFuncBusca)) || norm(m.vulgo).includes(norm(newFuncBusca))).length === 0
                          ? <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum membro encontrado</p>
                          : membrosDisponiveis.filter(m => norm(m.nome).includes(norm(newFuncBusca)) || norm(m.vulgo).includes(norm(newFuncBusca))).map(m => (
                            <button key={m.id} className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors" onMouseDown={e => { e.preventDefault(); setNewFuncId(m.id); setNewFuncBusca(m.nome + (m.vulgo ? ` "${m.vulgo}"` : '')) }}>
                              {m.nome}{m.vulgo ? ` "${m.vulgo}"` : ''}
                            </button>
                          ))
                        }
                      </div>
                    )}
                  </div>
                  <Input placeholder="Cargo (opcional)" className="w-32 h-8 text-sm" value={newFuncCargo} onChange={e => setNewFuncCargo(e.target.value)} />
                  <Button size="sm" className="h-8 px-3" onClick={handleSalvarFunc} disabled={savingFunc || !newFuncId}><Plus className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="sm" className="h-8 px-3" onClick={() => { setAddFunc(false); setNewFuncId(''); setNewFuncBusca(''); setNewFuncCargo('') }}><X className="h-3.5 w-3.5" /></Button>
                </div>
              )}

              {funcionarios.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4 rounded-lg border border-border border-dashed">Nenhum funcionário cadastrado</p>
              ) : (
                <>
                  <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input placeholder="Buscar funcionário..." className="h-8 pl-8 text-sm" value={buscaFunc} onChange={e => setBuscaFunc(e.target.value)} />
                  </div>
                  {funcionariosFiltrados.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhum funcionário encontrado</p>
                  ) : (
                    <div className="rounded-lg border border-border overflow-hidden">
                      {funcionariosFiltrados.map((f, idx) => (
                        <div key={f.id} className={cn('flex items-center gap-3 px-3 py-2.5', idx < funcionariosFiltrados.length - 1 && 'border-b border-border/50')}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-medium">{f.membros?.nome ?? '—'}</span>
                              {f.membros?.vulgo && <span className="text-xs text-muted-foreground">"{f.membros.vulgo}"</span>}
                              {f.cargo && <span className="text-xs text-muted-foreground">· {f.cargo}</span>}
                              {(veiculosPorMembro[f.membro_id] ?? []).map(v => (
                                <span key={v.id} title={`${v.placa ?? 'S/P'}${v.modelo ? ` — ${v.modelo}` : ''}${v.cor ? ` (${v.cor})` : ''}`} className="shrink-0 cursor-default">
                                  <Car className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
                                </span>
                              ))}
                            </div>
                            {f.membros?.telefone && (
                              <span className="text-xs font-mono text-muted-foreground">{f.membros.telefone}</span>
                            )}
                          </div>
                          {f.membros?.faccoes && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded shrink-0" style={{ background: f.membros.faccoes.cor_tag + '22', color: f.membros.faccoes.cor_tag }}>
                              {f.membros.faccoes.nome}
                            </span>
                          )}
                          <button onClick={() => handleRemoverFunc(f.id)} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-white/[0.06]"><X className="h-3 w-3" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>
            </div>{/* end grid itens + funcionários */}

            {/* ── Serviços / Combos ── */}
            <div className="mt-5 border-t border-border pt-4 space-y-2">
              <div className="flex items-center gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" />Serviços / Combos ({lojaServicosIds.length})
                </p>
                <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => setServicoAddOpen(true)} disabled={todoServicos.filter(s => !lojaServicosIds.includes(s.id)).length === 0}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              {servicoAddOpen && (
                <div className="flex gap-2 items-center">
                  <Select value={novoServicoId} onValueChange={setNovoServicoId}>
                    <SelectTrigger className="flex-1 h-8 text-sm"><SelectValue placeholder="Selecionar serviço..." /></SelectTrigger>
                    <SelectContent>
                      {todoServicos.filter(s => !lojaServicosIds.includes(s.id)).map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" className="h-8 px-3" onClick={handleAdicionarServico} disabled={!novoServicoId || servicoSaving}>
                    {servicoSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 px-3" onClick={() => { setServicoAddOpen(false); setNovoServicoId('') }}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
              {lojaServicosIds.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4 rounded-lg border border-border border-dashed">
                  Nenhum serviço/combo vinculado
                </p>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden divide-y divide-border/50">
                  {lojaServicosIds.map(sid => {
                    const s = todoServicos.find(x => x.id === sid)
                    if (!s) return null
                    return (
                      <div key={sid} className="flex items-center gap-2 px-3 py-2">
                        <Layers className="h-3 w-3 text-primary/50 shrink-0" />
                        <span className="text-xs font-medium flex-1 min-w-0 truncate">{s.nome}</span>
                        {s.preco_limpo != null && <span className="text-xs tabular-nums text-muted-foreground">{fmt(s.preco_limpo)}</span>}
                        {s.desconto_pct > 0 && <span className="text-xs text-emerald-400 shrink-0">-{s.desconto_pct}%</span>}
                        <button onClick={() => handleRemoverServico(sid)} className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground/40 hover:text-destructive hover:bg-white/[0.06] transition-colors shrink-0">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

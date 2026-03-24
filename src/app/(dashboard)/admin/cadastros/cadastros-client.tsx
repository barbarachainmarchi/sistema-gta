'use client'

import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Plus, Search, Edit2, Trash2, X, Package, Wrench, ShoppingBag, Loader2, Tag, MapPin, Recycle, Weight } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Item = {
  id: string
  nome: string
  descricao: string | null
  categoria_id: string | null
  peso: number | null
  status: 'ativo' | 'inativo'
  tem_craft: boolean
  eh_meu_produto: boolean
  eh_compravel: boolean
  tem_reciclagem: boolean
  created_at: string
  updated_at: string
  categorias_item: { id: string; nome: string } | null
}

type Categoria = { id: string; nome: string; descricao: string | null; created_at: string }
type Loja = { id: string; nome: string; localizacao: string | null }

type ReceitaIngrediente = { id?: string; ingrediente_id: string; ingrediente_nome: string; quantidade: number }
type ReciclagemResultado = { id?: string; resultado_id: string; resultado_nome: string; quantidade: number }
type PrecoHistorico = { id?: string; preco_sujo: number | null; preco_limpo: number | null; data_inicio: string }
type LojaPreco = { id?: string; loja_id: string; preco: number }

type ItemForm = {
  nome: string; descricao: string; categoria_id: string; peso: string
  status: 'ativo' | 'inativo'; tem_craft: boolean; eh_meu_produto: boolean; eh_compravel: boolean; tem_reciclagem: boolean
  receita: ReceitaIngrediente[]; reciclagem: ReciclagemResultado[]; precos: PrecoHistorico[]; loja_precos: LojaPreco[]
}

const emptyItemForm: ItemForm = {
  nome: '', descricao: '', categoria_id: '', peso: '', status: 'ativo',
  tem_craft: false, eh_meu_produto: false, eh_compravel: false, tem_reciclagem: false,
  receita: [], reciclagem: [], precos: [], loja_precos: [],
}

interface Props {
  initialItems: Item[]
  categorias: Categoria[]
  lojas: Loja[]
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function CadastrosClient({ initialItems, categorias: initialCategorias, lojas }: Props) {
  const sbRef = useRef<ReturnType<typeof createClient> | null>(null)
  const sb = useCallback(() => { if (!sbRef.current) sbRef.current = createClient(); return sbRef.current }, [])

  const [activeTab, setActiveTab] = useState('items')
  const [items, setItems] = useState<Item[]>(initialItems)
  const [categorias, setCategorias] = useState<Categoria[]>(initialCategorias)

  const [confirmDelete, setConfirmDelete] = useState<{ id: string; nome: string; type: 'item' | 'categoria' } | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function executeDelete() {
    if (!confirmDelete) return
    setDeleting(true)
    const table = confirmDelete.type === 'item' ? 'items' : 'categorias_item'
    const { error } = await sb().from(table).delete().eq('id', confirmDelete.id)
    if (error) {
      toast.error('Erro ao excluir — verifique se não há registros vinculados')
    } else {
      toast.success('Excluído com sucesso')
      if (confirmDelete.type === 'item') setItems(p => p.filter(i => i.id !== confirmDelete.id))
      if (confirmDelete.type === 'categoria') setCategorias(p => p.filter(c => c.id !== confirmDelete.id))
    }
    setDeleting(false)
    setConfirmDelete(null)
  }

  return (
    <>
      <Header title="Cadastros" description="Itens e categorias">
        {activeTab === 'items' && (
          <BtnNovoItem
            onCreated={item => setItems(p => [...p, item].sort((a,b) => a.nome.localeCompare(b.nome)))}
            categorias={categorias}
            lojas={lojas}
            allItems={items}
            sb={sb}
          />
        )}
        {activeTab === 'categorias' && (
          <BtnNovaCategoria onCreated={c => setCategorias(p => [...p, c])} sb={sb} />
        )}
      </Header>

      <div className="flex-1 p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="items" className="gap-1.5">
              <Package className="h-3.5 w-3.5" />Itens
            </TabsTrigger>
            <TabsTrigger value="categorias" className="gap-1.5">
              <Tag className="h-3.5 w-3.5" />Categorias
            </TabsTrigger>
          </TabsList>

          <TabsContent value="items">
            <ItemsTab
              items={items}
              categorias={categorias}
              lojas={lojas}
              sb={sb}
              onUpdated={updated => setItems(p => p.map(i => i.id === updated.id ? updated : i))}
              onDelete={(id, nome) => setConfirmDelete({ id, nome, type: 'item' })}
              onItemCreated={novo => setItems(p => [...p, novo].sort((a,b) => a.nome.localeCompare(b.nome)))}
            />
          </TabsContent>

          <TabsContent value="categorias">
            <CategoriasTab
              categorias={categorias}
              sb={sb}
              onUpdated={updated => setCategorias(p => p.map(c => c.id === updated.id ? updated : c))}
              onDelete={(id, nome) => setConfirmDelete({ id, nome, type: 'categoria' })}
            />
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={open => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir &quot;{confirmDelete?.nome}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
              {confirmDelete?.type === 'item' && ' Receitas, preços e histórico vinculados também serão excluídos.'}
              {confirmDelete?.type === 'categoria' && ' Itens desta categoria perderão a categoria, mas não serão excluídos.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={executeDelete}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ─── ABA ITENS ────────────────────────────────────────────────────────────────

function ItemsTab({ items, categorias, lojas, sb, onUpdated, onDelete, onItemCreated }: {
  items: Item[]
  categorias: Categoria[]
  lojas: Loja[]
  sb: () => ReturnType<typeof createClient>
  onUpdated: (item: Item) => void
  onDelete: (id: string, nome: string) => void
  onItemCreated: (item: Item) => void
}) {
  const [search, setSearch] = useState('')
  const [filterTipo, setFilterTipo] = useState('todos')
  const [filterStatus, setFilterStatus] = useState('ativo')
  const [filterCategoria, setFilterCategoria] = useState('todas')
  const [editingItem, setEditingItem] = useState<Item | null>(null)

  const filtered = useMemo(() => items.filter(item => {
    const matchSearch = item.nome.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'todos' || item.status === filterStatus
    const matchCategoria = filterCategoria === 'todas' || item.categoria_id === filterCategoria
    const matchTipo = filterTipo === 'todos'
      || (filterTipo === 'craft' && item.tem_craft)
      || (filterTipo === 'meu_produto' && item.eh_meu_produto)
      || (filterTipo === 'compravel' && item.eh_compravel)
      || (filterTipo === 'reciclagem' && item.tem_reciclagem)
    return matchSearch && matchStatus && matchCategoria && matchTipo
  }), [items, search, filterStatus, filterCategoria, filterTipo])

  return (
    <>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar item..."
              className="pl-8 h-9 text-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger className="w-[130px] h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              <SelectItem value="craft">Craft</SelectItem>
              <SelectItem value="meu_produto">Venda</SelectItem>
              <SelectItem value="compravel">Compra</SelectItem>
              <SelectItem value="reciclagem">Reciclagem</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterCategoria} onValueChange={setFilterCategoria}>
            <SelectTrigger className="w-[150px] h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas categorias</SelectItem>
              {categorias.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[110px] h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="inativo">Inativos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <p className="text-xs text-muted-foreground">{filtered.length} item{filtered.length !== 1 ? 's' : ''}</p>

        <div className="rounded-md border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border">
                <TableHead className="text-xs">Nome</TableHead>
                <TableHead className="text-xs">Categoria</TableHead>
                <TableHead className="text-xs w-[70px]">Peso</TableHead>
                <TableHead className="text-xs">Tipos</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="w-[70px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-10 text-sm">
                    Nenhum item encontrado
                  </TableCell>
                </TableRow>
              ) : filtered.map(item => (
                <TableRow key={item.id} className="group border-border">
                  <TableCell className="font-medium text-sm">{item.nome}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{item.categorias_item?.nome || '—'}</TableCell>
                  <TableCell className="text-muted-foreground text-xs tabular-nums">
                    {item.peso != null ? `${item.peso} kg` : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {item.tem_craft && <TipoBadge label="Craft" icon={Wrench} color="text-orange-400 bg-orange-400/10" />}
                      {item.eh_meu_produto && <TipoBadge label="Venda" icon={ShoppingBag} color="text-emerald-400 bg-emerald-400/10" />}
                      {item.eh_compravel && <TipoBadge label="Compra" icon={Package} color="text-sky-400 bg-sky-400/10" />}
                      {item.tem_reciclagem && <TipoBadge label="Reciclagem" icon={Recycle} color="text-violet-400 bg-violet-400/10" />}
                      {!item.tem_craft && !item.eh_meu_produto && !item.eh_compravel && !item.tem_reciclagem && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell><StatusBadge status={item.status} /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingItem(item)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => onDelete(item.id, item.nome)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {editingItem && (
        <ItemDialog
          item={editingItem}
          categorias={categorias}
          lojas={lojas}
          allItems={items}
          sb={sb}
          onClose={() => setEditingItem(null)}
          onSaved={updated => { onUpdated(updated); setEditingItem(null) }}
          onItemCreated={onItemCreated}
        />
      )}
    </>
  )
}

// ─── BOTÃO NOVO ITEM ──────────────────────────────────────────────────────────

function BtnNovoItem({ onCreated, categorias, lojas, allItems, sb }: {
  onCreated: (item: Item) => void
  categorias: Categoria[]
  lojas: Loja[]
  allItems: Item[]
  sb: () => ReturnType<typeof createClient>
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size="sm" className="h-8 text-xs" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5 mr-1" />Novo Item
      </Button>
      {open && (
        <ItemDialog
          item={null}
          categorias={categorias}
          lojas={lojas}
          allItems={allItems}
          sb={sb}
          onClose={() => setOpen(false)}
          onSaved={item => { onCreated(item); setOpen(false) }}
          onItemCreated={onCreated}
        />
      )}
    </>
  )
}

// ─── DIALOG DE ITEM ───────────────────────────────────────────────────────────

function ItemDialog({ item, categorias, lojas, allItems: allItemsProp, sb, onClose, onSaved, onItemCreated }: {
  item: Item | null
  categorias: Categoria[]
  lojas: Loja[]
  allItems: Item[]
  sb: () => ReturnType<typeof createClient>
  onClose: () => void
  onSaved: (item: Item) => void
  onItemCreated?: (item: Item) => void
}) {
  // Local copy so newly-created sub-items appear immediately in combobox
  const [localItems, setLocalItems] = useState(allItemsProp)
  useEffect(() => setLocalItems(allItemsProp), [allItemsProp])

  function handleSubItemCreated(novo: Item) {
    setLocalItems(p => [...p, novo].sort((a,b) => a.nome.localeCompare(b.nome)))
    onItemCreated?.(novo)
  }

  const [form, setForm] = useState<ItemForm>(item ? {
    nome: item.nome, descricao: item.descricao || '', categoria_id: item.categoria_id || '',
    peso: item.peso != null ? String(item.peso) : '',
    status: item.status, tem_craft: item.tem_craft, eh_meu_produto: item.eh_meu_produto,
    eh_compravel: item.eh_compravel, tem_reciclagem: item.tem_reciclagem,
    receita: [], reciclagem: [], precos: [], loja_precos: [],
  } : { ...emptyItemForm })

  const [activeFormTab, setActiveFormTab] = useState('geral')
  const [loading, setLoading] = useState(item !== null)
  const [saving, setSaving] = useState(false)
  const [newIng, setNewIng] = useState({ ingrediente_id: '', quantidade: '' })
  const [newRec, setNewRec] = useState({ resultado_id: '', quantidade: '' })
  const [criarSubItemNome, setCriarSubItemNome] = useState<{ nome: string; target: 'ing' | 'rec' } | null>(null)
  const [newPreco, setNewPreco] = useState({ preco_sujo: '', preco_limpo: '', data_inicio: new Date().toISOString().split('T')[0] })
  const [newLoja, setNewLoja] = useState({ loja_id: '', preco: '' })

  useState(() => {
    if (!item) return
    Promise.all([
      sb().from('item_receita').select('id, ingrediente_id, quantidade, items!item_receita_ingrediente_id_fkey(nome)').eq('item_id', item.id),
      sb().from('item_reciclagem').select('id, resultado_id, quantidade, items!item_reciclagem_resultado_id_fkey(nome)').eq('item_id', item.id),
      sb().from('item_precos').select('id, preco_sujo, preco_limpo, data_inicio').eq('item_id', item.id).order('data_inicio', { ascending: false }),
      sb().from('loja_item_precos').select('id, loja_id, preco').eq('item_id', item.id),
    ]).then(([receitaRes, reciclagemRes, precosRes, lojasRes]) => {
      setForm(prev => ({
        ...prev,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        receita: (receitaRes.data || []).map((r: any) => ({ id: r.id, ingrediente_id: r.ingrediente_id, ingrediente_nome: r.items?.nome || '', quantidade: r.quantidade })),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        reciclagem: (reciclagemRes.data || []).map((r: any) => ({ id: r.id, resultado_id: r.resultado_id, resultado_nome: r.items?.nome || '', quantidade: r.quantidade })),
        precos: precosRes.data || [],
        loja_precos: lojasRes.data || [],
      }))
      setLoading(false)
    })
  })

  function setFlag(flag: 'tem_craft' | 'eh_meu_produto' | 'eh_compravel' | 'tem_reciclagem', value: boolean) {
    setForm(prev => ({ ...prev, [flag]: value }))
    if (value) {
      if (flag === 'tem_craft') setActiveFormTab('craft')
      if (flag === 'eh_meu_produto') setActiveFormTab('preco')
      if (flag === 'eh_compravel') setActiveFormTab('lojas')
      if (flag === 'tem_reciclagem') setActiveFormTab('reciclagem')
    }
  }

  function addIngrediente() {
    if (!newIng.ingrediente_id || !newIng.quantidade) return
    const found = localItems.find(i => i.id === newIng.ingrediente_id)
    if (!found) return
    setForm(prev => ({
      ...prev,
      receita: [
        ...prev.receita.filter(r => r.ingrediente_id !== newIng.ingrediente_id),
        { ingrediente_id: newIng.ingrediente_id, ingrediente_nome: found.nome, quantidade: Number(newIng.quantidade) }
      ]
    }))
    setNewIng({ ingrediente_id: '', quantidade: '' })
  }

  function addReciclagem() {
    if (!newRec.resultado_id || !newRec.quantidade) return
    const found = localItems.find(i => i.id === newRec.resultado_id)
    if (!found) return
    setForm(prev => ({
      ...prev,
      reciclagem: [
        ...prev.reciclagem.filter(r => r.resultado_id !== newRec.resultado_id),
        { resultado_id: newRec.resultado_id, resultado_nome: found.nome, quantidade: Number(newRec.quantidade) }
      ]
    }))
    setNewRec({ resultado_id: '', quantidade: '' })
  }

  function addPreco() {
    if (!newPreco.data_inicio || (!newPreco.preco_sujo && !newPreco.preco_limpo)) return
    setForm(prev => ({
      ...prev,
      precos: [
        { preco_sujo: newPreco.preco_sujo ? Number(newPreco.preco_sujo) : null, preco_limpo: newPreco.preco_limpo ? Number(newPreco.preco_limpo) : null, data_inicio: newPreco.data_inicio },
        ...prev.precos,
      ]
    }))
    setNewPreco({ preco_sujo: '', preco_limpo: '', data_inicio: new Date().toISOString().split('T')[0] })
  }

  function addLojaPreco() {
    if (!newLoja.loja_id || !newLoja.preco) return
    setForm(prev => ({
      ...prev,
      loja_precos: [
        ...prev.loja_precos.filter(l => l.loja_id !== newLoja.loja_id),
        { loja_id: newLoja.loja_id, preco: Number(newLoja.preco) }
      ]
    }))
    setNewLoja({ loja_id: '', preco: '' })
  }

  async function handleSave() {
    if (!form.nome.trim()) { toast.error('Nome é obrigatório'); return }
    setSaving(true)
    try {
      const payload = {
        nome: form.nome.trim(), descricao: form.descricao.trim() || null,
        categoria_id: form.categoria_id || null, status: form.status,
        peso: form.peso !== '' ? parseFloat(form.peso) : null,
        tem_craft: form.tem_craft, eh_meu_produto: form.eh_meu_produto,
        eh_compravel: form.eh_compravel, tem_reciclagem: form.tem_reciclagem,
        updated_at: new Date().toISOString(),
      }

      let savedItem: Item
      if (item) {
        const { data, error } = await sb().from('items').update(payload).eq('id', item.id).select('*, categorias_item(id, nome)').single()
        if (error) throw error
        savedItem = data as Item
      } else {
        const { data, error } = await sb().from('items').insert(payload).select('*, categorias_item(id, nome)').single()
        if (error) throw error
        savedItem = data as Item
      }

      const id = savedItem.id

      if (form.tem_craft) {
        const { error: e1 } = await sb().from('item_receita').delete().eq('item_id', id)
        if (e1) throw new Error('Erro ao limpar receita: ' + e1.message)
        if (form.receita.length > 0) {
          const { error: e2 } = await sb().from('item_receita').insert(form.receita.map(r => ({ item_id: id, ingrediente_id: r.ingrediente_id, quantidade: r.quantidade })))
          if (e2) throw new Error('Erro ao salvar receita: ' + e2.message)
        }
      }

      if (form.eh_meu_produto) {
        const novos = form.precos.filter(p => !p.id)
        if (novos.length > 0) {
          const { error: e3 } = await sb().from('item_precos').insert(novos.map(p => ({ item_id: id, preco_sujo: p.preco_sujo, preco_limpo: p.preco_limpo, data_inicio: p.data_inicio })))
          if (e3) throw new Error('Erro ao salvar preços: ' + e3.message)
        }
      }

      if (form.eh_compravel) {
        const { error: e4 } = await sb().from('loja_item_precos').delete().eq('item_id', id)
        if (e4) throw new Error('Erro ao limpar preços de loja: ' + e4.message)
        if (form.loja_precos.length > 0) {
          const { error: e5 } = await sb().from('loja_item_precos').insert(form.loja_precos.map(l => ({ item_id: id, loja_id: l.loja_id, preco: l.preco })))
          if (e5) throw new Error('Erro ao salvar preços de loja: ' + e5.message)
        }
      }

      if (form.tem_reciclagem) {
        const { error: e6 } = await sb().from('item_reciclagem').delete().eq('item_id', id)
        if (e6) throw new Error('Erro ao limpar reciclagem: ' + e6.message)
        if (form.reciclagem.length > 0) {
          const { error: e7 } = await sb().from('item_reciclagem').insert(form.reciclagem.map(r => ({ item_id: id, resultado_id: r.resultado_id, quantidade: r.quantidade })))
          if (e7) throw new Error('Erro ao salvar reciclagem: ' + e7.message)
        }
      }

      toast.success(item ? 'Item atualizado!' : 'Item criado!')
      onSaved(savedItem)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const ingredientesDisponiveis = localItems.filter(i => !item || i.id !== item.id)

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">{item ? `Editar — ${item.nome}` : 'Novo Item'}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <Tabs value={activeFormTab} onValueChange={setActiveFormTab}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="geral" className="text-xs">Geral</TabsTrigger>
                <TabsTrigger value="craft" className="text-xs" disabled={!form.tem_craft}>
                  <span className={cn(!form.tem_craft && 'opacity-40')}>Craft</span>
                </TabsTrigger>
                <TabsTrigger value="preco" className="text-xs" disabled={!form.eh_meu_produto}>
                  <span className={cn(!form.eh_meu_produto && 'opacity-40')}>Preço</span>
                </TabsTrigger>
                <TabsTrigger value="lojas" className="text-xs" disabled={!form.eh_compravel}>
                  <span className={cn(!form.eh_compravel && 'opacity-40')}>Lojas</span>
                </TabsTrigger>
                <TabsTrigger value="reciclagem" className="text-xs" disabled={!form.tem_reciclagem}>
                  <span className={cn(!form.tem_reciclagem && 'opacity-40')}>Reciclar</span>
                </TabsTrigger>
              </TabsList>

              {/* ── GERAL ── */}
              <TabsContent value="geral" className="space-y-4 pt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs">Nome *</Label>
                    <Input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Nome do item" className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Categoria</Label>
                    <Select value={form.categoria_id || '_none'} onValueChange={v => setForm(p => ({ ...p, categoria_id: v === '_none' ? '' : v }))}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Sem categoria</SelectItem>
                        {categorias.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1"><Weight className="h-3 w-3" />Peso (kg)</Label>
                    <Input type="number" step="0.001" min="0" value={form.peso} onChange={e => setForm(p => ({ ...p, peso: e.target.value }))} placeholder="Ex: 0.5" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Status</Label>
                    <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v as 'ativo' | 'inativo' }))}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="inativo">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs">Descrição</Label>
                    <Textarea value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} placeholder="Opcional" rows={2} className="text-sm resize-none" />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Características</p>
                  <FlagRow icon={<Wrench className="h-3.5 w-3.5 text-orange-400" />} label="Tem Craft" desc="Pode ser fabricado com ingredientes" checked={form.tem_craft} onChange={v => setFlag('tem_craft', v)} />
                  <FlagRow icon={<ShoppingBag className="h-3.5 w-3.5 text-emerald-400" />} label="Meu Produto" desc="Aparece nas vendas com preço configurado" checked={form.eh_meu_produto} onChange={v => setFlag('eh_meu_produto', v)} />
                  <FlagRow icon={<Package className="h-3.5 w-3.5 text-sky-400" />} label="Comprável" desc="Encontrado em lojas — preços pela Investigação" checked={form.eh_compravel} onChange={v => setFlag('eh_compravel', v)} />
                  <FlagRow icon={<Recycle className="h-3.5 w-3.5 text-violet-400" />} label="Reciclável" desc="Pode ser reciclado — cadastre o que se obtém" checked={form.tem_reciclagem} onChange={v => setFlag('tem_reciclagem', v)} />
                </div>
              </TabsContent>

              {/* ── CRAFT ── */}
              <TabsContent value="craft" className="space-y-3 pt-3">
                <div className="flex gap-2">
                  <ItemCombobox
                    allItems={ingredientesDisponiveis}
                    selectedId={newIng.ingrediente_id}
                    onSelect={id => setNewIng(p => ({ ...p, ingrediente_id: id }))}
                    onCriar={nome => setCriarSubItemNome({ nome, target: 'ing' })}
                    placeholder="Ingrediente..."
                    className="flex-1"
                  />
                  <Input type="number" placeholder="Qtd" className="w-20 h-9 text-sm" value={newIng.quantidade}
                    onChange={e => setNewIng(p => ({ ...p, quantidade: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addIngrediente() } }}
                  />
                  <Button type="button" size="sm" className="h-9 px-3" onClick={addIngrediente}><Plus className="h-4 w-4" /></Button>
                </div>
                {form.receita.length === 0
                  ? <EmptyState text="Nenhum ingrediente adicionado" />
                  : <div className="space-y-1.5">{form.receita.map(r => {
                    const ing = localItems.find(i => i.id === r.ingrediente_id)
                    const pesoTotal = ing?.peso != null ? ing.peso * r.quantidade : null
                    return (
                      <RowItem key={r.ingrediente_id}
                        label={r.ingrediente_nome}
                        value={`${r.quantidade}x${pesoTotal != null ? ` · ${pesoTotal.toFixed(2)} kg` : ''}`}
                        onRemove={() => setForm(p => ({ ...p, receita: p.receita.filter(x => x.ingrediente_id !== r.ingrediente_id) }))} />
                    )
                  })}</div>
                }
                {form.receita.length > 0 && (() => {
                  const pesoTotal = form.receita.reduce((acc, r) => {
                    const ing = localItems.find(i => i.id === r.ingrediente_id)
                    return ing?.peso != null ? acc + ing.peso * r.quantidade : acc
                  }, 0)
                  return pesoTotal > 0 ? (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 pt-1">
                      <Weight className="h-3 w-3" />Peso total do craft: <strong>{pesoTotal.toFixed(3)} kg</strong>
                    </p>
                  ) : null
                })()}
              </TabsContent>

              {/* ── PREÇO ── */}
              <TabsContent value="preco" className="space-y-3 pt-3">
                <div className="rounded-lg border border-border bg-muted/10 p-3 space-y-3">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Novo Reajuste</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Sujo</Label>
                      <Input type="number" placeholder="0" className="h-9 text-sm" value={newPreco.preco_sujo} onChange={e => setNewPreco(p => ({ ...p, preco_sujo: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Limpo</Label>
                      <Input type="number" placeholder="0" className="h-9 text-sm" value={newPreco.preco_limpo} onChange={e => setNewPreco(p => ({ ...p, preco_limpo: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Vigência</Label>
                      <Input type="date" className="h-9 text-sm" value={newPreco.data_inicio} onChange={e => setNewPreco(p => ({ ...p, data_inicio: e.target.value }))} />
                    </div>
                  </div>
                  <Button type="button" size="sm" className="w-full h-8 text-xs" onClick={addPreco}>
                    <Plus className="h-3.5 w-3.5 mr-1" />Adicionar
                  </Button>
                </div>
                {form.precos.length === 0
                  ? <EmptyState text="Nenhum preço cadastrado" />
                  : <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">Histórico (mais recente primeiro)</p>
                    {form.precos.map((p, i) => (
                      <div key={i} className={cn('rounded-md px-3 py-2 flex items-center gap-2', i === 0 ? 'bg-white/5 border border-border' : 'bg-muted/30')}>
                        <span className="text-xs text-muted-foreground tabular-nums w-20 shrink-0">
                          {new Date(p.data_inicio + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </span>
                        <div className="flex gap-4 text-xs flex-1">
                          {p.preco_sujo != null && <span>Sujo <strong>R${p.preco_sujo.toLocaleString('pt-BR')}</strong></span>}
                          {p.preco_limpo != null && <span>Limpo <strong>R${p.preco_limpo.toLocaleString('pt-BR')}</strong></span>}
                        </div>
                        {i === 0 && <span className="text-[10px] text-emerald-400 font-medium shrink-0">Vigente</span>}
                        <button
                          type="button"
                          onClick={async () => {
                            if (p.id) {
                              const { error } = await sb().from('item_precos').delete().eq('id', p.id)
                              if (error) { toast.error('Erro ao deletar preço'); return }
                            }
                            setForm(prev => ({ ...prev, precos: prev.precos.filter((_, j) => j !== i) }))
                          }}
                          className="shrink-0 h-5 w-5 flex items-center justify-center rounded text-muted-foreground/40 hover:text-destructive hover:bg-white/[0.06] transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                }
              </TabsContent>

              {/* ── RECICLAGEM ── */}
              <TabsContent value="reciclagem" className="space-y-3 pt-3">
                <p className="text-xs text-muted-foreground">
                  O que se obtém ao reciclar <strong>{form.nome || 'este item'}</strong>. Útil para calcular o retorno na Ferramenta de Cálculo.
                </p>
                <div className="flex gap-2">
                  <ItemCombobox
                    allItems={localItems.filter(i => !item || i.id !== item.id)}
                    selectedId={newRec.resultado_id}
                    onSelect={id => setNewRec(p => ({ ...p, resultado_id: id }))}
                    onCriar={nome => setCriarSubItemNome({ nome, target: 'rec' })}
                    placeholder="Item obtido..."
                    className="flex-1"
                  />
                  <Input type="number" placeholder="Qtd" className="w-20 h-9 text-sm" value={newRec.quantidade}
                    onChange={e => setNewRec(p => ({ ...p, quantidade: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addReciclagem() } }}
                  />
                  <Button type="button" size="sm" className="h-9 px-3" onClick={addReciclagem}><Plus className="h-4 w-4" /></Button>
                </div>
                {form.reciclagem.length === 0
                  ? <EmptyState text="Nenhum resultado de reciclagem cadastrado" />
                  : <div className="space-y-1.5">{form.reciclagem.map(r => (
                    <RowItem key={r.resultado_id} label={r.resultado_nome} value={`${r.quantidade}x`}
                      onRemove={() => setForm(p => ({ ...p, reciclagem: p.reciclagem.filter(x => x.resultado_id !== r.resultado_id) }))} />
                  ))}</div>
                }
              </TabsContent>

              {/* ── LOJAS ── */}
              <TabsContent value="lojas" className="space-y-3 pt-3">
                {lojas.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                    <MapPin className="h-8 w-8 text-muted-foreground/30" />
                    <p className="text-sm font-medium text-muted-foreground">Nenhuma loja cadastrada</p>
                    <p className="text-xs text-muted-foreground max-w-[240px]">
                      As lojas são descobertas e cadastradas no módulo de <strong>Investigação</strong>.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <Select value={newLoja.loja_id} onValueChange={v => setNewLoja(p => ({ ...p, loja_id: v }))}>
                        <SelectTrigger className="flex-1 h-9 text-sm"><SelectValue placeholder="Selecionar loja..." /></SelectTrigger>
                        <SelectContent>
                          {lojas.map(l => (
                            <SelectItem key={l.id} value={l.id}>
                              {l.nome}{l.localizacao ? ` — ${l.localizacao}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input type="number" placeholder="Preço" className="w-24 h-9 text-sm" value={newLoja.preco} onChange={e => setNewLoja(p => ({ ...p, preco: e.target.value }))} />
                      <Button type="button" size="sm" className="h-9 px-3" onClick={addLojaPreco}><Plus className="h-4 w-4" /></Button>
                    </div>
                    {form.loja_precos.length === 0
                      ? <EmptyState text="Nenhuma loja vinculada" />
                      : <div className="space-y-1.5">{form.loja_precos.map(l => {
                        const loja = lojas.find(lo => lo.id === l.loja_id)
                        return (
                          <RowItem key={l.loja_id} label={loja?.nome || l.loja_id}
                            value={`R$ ${l.preco.toLocaleString('pt-BR')}`}
                            onRemove={() => setForm(p => ({ ...p, loja_precos: p.loja_precos.filter(x => x.loja_id !== l.loja_id) }))} />
                        )
                      })}</div>
                    }
                  </>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}

        <DialogFooter className="shrink-0 pt-2 border-t border-border mt-2">
          <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || loading} className="h-8 text-xs">
            {saving ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Salvando...</> : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>

      {criarSubItemNome && (
        <CriarItemRapidoDialog
          nomeInicial={criarSubItemNome.nome}
          categorias={categorias}
          sb={sb}
          onClose={() => setCriarSubItemNome(null)}
          onCriado={novoItem => {
            handleSubItemCreated(novoItem)
            const target = criarSubItemNome.target
            setCriarSubItemNome(null)
            if (target === 'ing') setNewIng(p => ({ ...p, ingrediente_id: novoItem.id }))
            if (target === 'rec') setNewRec(p => ({ ...p, resultado_id: novoItem.id }))
          }}
        />
      )}
    </Dialog>
  )
}

// ─── ITEM COMBOBOX ────────────────────────────────────────────────────────────

function ItemCombobox({ allItems, selectedId, onSelect, onCriar, placeholder, className }: {
  allItems: Item[]
  selectedId: string
  onSelect: (id: string) => void
  onCriar: (nome: string) => void
  placeholder?: string
  className?: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedNome = allItems.find(i => i.id === selectedId)?.nome ?? ''
  const filtered = useMemo(() =>
    query.trim()
      ? allItems.filter(i => i.nome.toLowerCase().includes(query.toLowerCase()))
      : [],
    [allItems, query]
  )

  function selectItem(it: Item) {
    onSelect(it.id)
    setQuery('')
    setOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return
    if (e.key === 'Tab' && filtered.length === 1) { e.preventDefault(); selectItem(filtered[0]) }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, filtered.length > 0 ? filtered.length - 1 : 0)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)) }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered.length > 0) selectItem(filtered[highlighted])
      else if (query.trim()) onCriar(query.trim())
    }
    if (e.key === 'Escape') { setOpen(false); setQuery('') }
  }

  return (
    <div className={cn('relative', className)}>
      <Input
        ref={inputRef}
        value={open ? query : selectedNome}
        placeholder={placeholder}
        className="h-9 text-sm"
        onChange={e => { setQuery(e.target.value); setOpen(true); setHighlighted(0) }}
        onFocus={() => { setOpen(true); setQuery(''); setHighlighted(0) }}
        onBlur={() => setTimeout(() => setOpen(false), 160)}
        onKeyDown={handleKeyDown}
      />
      {open && query.trim() && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border border-border bg-popover shadow-lg max-h-48 overflow-y-auto">
          {filtered.length > 0 ? filtered.map((it, i) => (
            <button
              key={it.id}
              className={cn('w-full text-left flex items-center justify-between px-3 py-2 text-sm hover:bg-accent transition-colors', i === highlighted && 'bg-accent')}
              onMouseDown={e => { e.preventDefault(); selectItem(it) }}
            >
              <span>{it.nome}</span>
              <span className="flex items-center gap-2 text-[10px] text-muted-foreground shrink-0">
                {it.peso != null && <span className="flex items-center gap-0.5"><Weight className="h-2.5 w-2.5" />{it.peso} kg</span>}
                {filtered.length === 1 && <span>Tab ↵</span>}
              </span>
            </button>
          )) : (
            <button
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors"
              onMouseDown={e => { e.preventDefault(); onCriar(query.trim()) }}
            >
              <span className="text-primary font-medium">+ Cadastrar</span>
              <span className="text-muted-foreground"> &quot;{query}&quot;</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── CRIAR ITEM RÁPIDO ────────────────────────────────────────────────────────

function CriarItemRapidoDialog({ nomeInicial, categorias, sb, onClose, onCriado }: {
  nomeInicial: string
  categorias: Categoria[]
  sb: () => ReturnType<typeof createClient>
  onClose: () => void
  onCriado: (item: Item) => void
}) {
  const [nome, setNome] = useState(nomeInicial)
  const [categoriaId, setCategoriaId] = useState('')
  const [peso, setPeso] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleCriar() {
    if (!nome.trim()) return
    setSaving(true)
    const { data, error } = await sb().from('items').insert({
      nome: nome.trim(),
      categoria_id: categoriaId || null,
      peso: peso !== '' ? parseFloat(peso) : null,
      status: 'ativo', tem_craft: false, eh_meu_produto: false, eh_compravel: false, tem_reciclagem: false,
      updated_at: new Date().toISOString(),
    }).select('*, categorias_item(id, nome)').single()
    setSaving(false)
    if (error) { toast.error('Erro ao criar item'); return }
    toast.success(`"${nome}" criado!`)
    onCriado(data as Item)
  }

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-xs" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="text-sm">Cadastrar novo item</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome *</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} className="h-8 text-sm" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Categoria</Label>
              <Select value={categoriaId || '_none'} onValueChange={v => setCategoriaId(v === '_none' ? '' : v)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sem categoria</SelectItem>
                  {categorias.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><Weight className="h-3 w-3" />Peso (kg)</Label>
              <Input type="number" step="0.001" min="0" value={peso} onChange={e => setPeso(e.target.value)} placeholder="0.000" className="h-8 text-sm" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} className="h-7 text-xs">Cancelar</Button>
          <Button size="sm" onClick={handleCriar} disabled={saving || !nome.trim()} className="h-7 text-xs">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Cadastrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── ABA CATEGORIAS ──────────────────────────────────────────────────────────

function CategoriasTab({ categorias, sb, onUpdated, onDelete }: {
  categorias: Categoria[]
  sb: () => ReturnType<typeof createClient>
  onUpdated: (c: Categoria) => void
  onDelete: (id: string, nome: string) => void
}) {
  const [editing, setEditing] = useState<Categoria | null>(null)
  return (
    <>
      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border">
              <TableHead className="text-xs">Nome</TableHead>
              <TableHead className="text-xs">Descrição</TableHead>
              <TableHead className="w-[70px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {categorias.length === 0
              ? <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-10 text-sm">Nenhuma categoria</TableCell></TableRow>
              : categorias.map(c => (
                <TableRow key={c.id} className="group border-border">
                  <TableCell className="font-medium text-sm">{c.nome}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.descricao || '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(c)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => onDelete(c.id, c.nome)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            }
          </TableBody>
        </Table>
      </div>
      {editing && (
        <CategoriaDialog
          categoria={editing}
          sb={sb}
          onClose={() => setEditing(null)}
          onSaved={c => { onUpdated(c); setEditing(null) }}
        />
      )}
    </>
  )
}

function BtnNovaCategoria({ onCreated, sb }: {
  onCreated: (c: Categoria) => void
  sb: () => ReturnType<typeof createClient>
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size="sm" className="h-8 text-xs" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5 mr-1" />Nova Categoria
      </Button>
      {open && (
        <CategoriaDialog
          categoria={null}
          sb={sb}
          onClose={() => setOpen(false)}
          onSaved={c => { onCreated(c); setOpen(false) }}
        />
      )}
    </>
  )
}

function CategoriaDialog({ categoria, sb, onClose, onSaved }: {
  categoria: Categoria | null
  sb: () => ReturnType<typeof createClient>
  onClose: () => void
  onSaved: (c: Categoria) => void
}) {
  const [nome, setNome] = useState(categoria?.nome || '')
  const [descricao, setDescricao] = useState(categoria?.descricao || '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!nome.trim()) { toast.error('Nome é obrigatório'); return }
    setSaving(true)
    try {
      if (categoria) {
        const { data, error } = await sb().from('categorias_item').update({ nome: nome.trim(), descricao: descricao.trim() || null }).eq('id', categoria.id).select().single()
        if (error) throw error
        onSaved(data as Categoria)
      } else {
        const { data, error } = await sb().from('categorias_item').insert({ nome: nome.trim(), descricao: descricao.trim() || null }).select().single()
        if (error) throw error
        onSaved(data as Categoria)
      }
      toast.success(categoria ? 'Categoria atualizada!' : 'Categoria criada!')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">{categoria ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome *</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Descrição</Label>
            <Input value={descricao} onChange={e => setDescricao(e.target.value)} className="h-9" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="h-8 text-xs">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Utilitários ─────────────────────────────────────────────────────────────

function TipoBadge({ label, icon: Icon, color }: { label: string; icon: React.ElementType; color: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded font-medium', color)}>
      <Icon className="h-2.5 w-2.5" />{label}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-medium',
      status === 'ativo' ? 'text-emerald-400 bg-emerald-400/10' : 'text-muted-foreground bg-white/5'
    )}>
      {status}
    </span>
  )
}

function FlagRow({ icon, label, desc, checked, onChange }: {
  icon: React.ReactNode; label: string; desc: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        {icon}
        <div>
          <p className="text-sm font-medium leading-none">{label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

function RowItem({ label, value, onRemove }: { label: string; value: string; onRemove: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-white/[0.03] border border-border px-3 py-2">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium tabular-nums text-muted-foreground">{value}</span>
        <button onClick={onRemove} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground text-center py-6">{text}</p>
}

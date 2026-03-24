'use client'

import { useState, useCallback, useRef, useMemo } from 'react'
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
  Plus, Minus, Trash2, Edit2, Check, X, Users, ArrowLeft,
  ImageUp, Copy, Loader2, UserPlus, ChevronDown, ChevronUp, Eye
} from 'lucide-react'
import { uploadImgbb, getImgbbKey } from '@/lib/imgbb'

// ── Tipos ────────────────────────────────────────────────────────────────────

type Cotacao = {
  id: string; titulo: string | null; fornecedor_tipo: string; fornecedor_id: string | null
  fornecedor_nome: string; modo_preco: 'sujo' | 'limpo'; status: 'rascunho' | 'finalizada' | 'cancelada'
  criado_por_nome: string | null; created_by: string | null
}
type Pessoa  = { id: string; cotacao_id: string; nome: string; membro_id: string | null }
type Item    = { id: string; cotacao_id: string; pessoa_id: string | null; item_nome: string; item_id: string | null; quantidade: number; preco_unit: number; adicionado_por_nome: string | null }
type Faccao  = { id: string; nome: string; cor_tag: string }
type Loja    = { id: string; nome: string }
type Membro  = { id: string; nome: string; vulgo: string | null }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FaccaoPreco = { faccao_id: string; item_id: string; preco_sujo: number | null; preco_limpo: number | null; items: any }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LojaPreco   = { loja_id: string; item_id: string; preco: number; preco_sujo: number | null; items: any }
type SimpleItem  = { id: string; nome: string; peso: number | null }

interface Props {
  userId: string
  userNome: string | null
  cotacao: Cotacao
  pessoasIniciais: Pessoa[]
  itensIniciais: Item[]
  faccoes: Faccao[]; lojas: Loja[]; membros: Membro[]
  faccaoPrecos: FaccaoPreco[]; lojaPrecos: LojaPreco[]
  allItems: SimpleItem[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}
function fmtKg(kg: number) { return `${kg % 1 === 0 ? kg : kg.toFixed(2)} kg` }

// ── Canvas: gerar imagem ──────────────────────────────────────────────────────

function gerarImagemCotacao(params: {
  cotacao: Cotacao; pessoas: Pessoa[]
  itensPorPessoa: Record<string, Item[]>
  itensAgregados: { nome: string; totalQty: number; totalPreco: number; porPessoa: { nome: string; qty: number }[]; peso: number | null }[]
  modo: 'detalhe' | 'totais'
}): string {
  const { cotacao, pessoas, itensPorPessoa, itensAgregados, modo } = params
  const W = 900; const PAD = 32; const LINE = 22; const SECGAP = 14

  let linhas = 0
  if (modo === 'detalhe') {
    pessoas.forEach(p => { linhas += 2 + (itensPorPessoa[p.id] ?? []).length + 1 })
  } else {
    linhas += itensAgregados.length + 4 + pessoas.length + 3
  }

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = Math.max(80 + linhas * LINE + SECGAP * pessoas.length + 60, 300)
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#0f0f0f'; ctx.fillRect(0, 0, W, canvas.height)
  ctx.fillStyle = '#1c1c1c'; ctx.fillRect(0, 0, W, 70)
  ctx.fillStyle = '#3b82f6'; ctx.fillRect(0, 0, 4, 70)
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 22px system-ui, sans-serif'
  ctx.fillText(cotacao.titulo ?? cotacao.fornecedor_nome, PAD, 32)
  ctx.fillStyle = '#6b7280'; ctx.font = '14px system-ui, sans-serif'
  ctx.fillText(`${cotacao.fornecedor_nome} · preço ${cotacao.modo_preco}`, PAD, 54)

  let y = 90

  if (modo === 'detalhe') {
    for (const pessoa of pessoas) {
      const itens = itensPorPessoa[pessoa.id] ?? []
      const sub = itens.reduce((s, it) => s + it.quantidade * it.preco_unit, 0)
      ctx.fillStyle = '#1c1c1c'; ctx.fillRect(PAD, y, W - PAD * 2, LINE + 8)
      ctx.fillStyle = '#e5e7eb'; ctx.font = 'bold 14px system-ui, sans-serif'
      ctx.fillText(`👤 ${pessoa.nome}`, PAD + 10, y + LINE - 4)
      ctx.fillStyle = '#3b82f6'
      ctx.fillText(fmt(sub), W - PAD - ctx.measureText(fmt(sub)).width, y + LINE - 4)
      y += LINE + 12
      ctx.fillStyle = '#374151'; ctx.font = '11px system-ui, sans-serif'
      ctx.fillText('Item', PAD + 10, y); ctx.fillText('Qtd', PAD + 420, y); ctx.fillText('Unit.', PAD + 510, y); ctx.fillText('Total', W - PAD - 60, y)
      y += LINE - 4
      ctx.strokeStyle = '#374151'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke(); y += 8
      for (const it of itens) {
        ctx.fillStyle = '#9ca3af'; ctx.font = '13px system-ui, sans-serif'
        ctx.fillText(it.item_nome, PAD + 10, y); ctx.fillText(`${it.quantidade}×`, PAD + 420, y); ctx.fillText(fmt(it.preco_unit), PAD + 510, y)
        ctx.fillStyle = '#e5e7eb'; ctx.fillText(fmt(it.quantidade * it.preco_unit), W - PAD - ctx.measureText(fmt(it.quantidade * it.preco_unit)).width, y)
        y += LINE
      }
      if (itens.length === 0) { ctx.fillStyle = '#6b7280'; ctx.font = 'italic 13px system-ui, sans-serif'; ctx.fillText('Sem itens', PAD + 10, y); y += LINE }
      y += SECGAP
    }
  } else {
    const grandTotal = Object.values(itensPorPessoa).flat().reduce((s, it) => s + it.quantidade * it.preco_unit, 0)
    ctx.fillStyle = '#e5e7eb'; ctx.font = 'bold 15px system-ui, sans-serif'; ctx.fillText('Pedido Total', PAD, y); y += LINE + 4
    ctx.fillStyle = '#374151'; ctx.font = '11px system-ui, sans-serif'
    ctx.fillText('Item', PAD + 10, y); ctx.fillText('Qtd', PAD + 350, y); ctx.fillText('Total', PAD + 450, y); ctx.fillText('Quem pediu', PAD + 570, y)
    y += LINE - 4
    ctx.strokeStyle = '#374151'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke(); y += 8
    for (const ag of itensAgregados) {
      ctx.fillStyle = '#9ca3af'; ctx.font = '13px system-ui, sans-serif'
      ctx.fillText(ag.nome, PAD + 10, y); ctx.fillText(`${ag.totalQty}×`, PAD + 350, y)
      ctx.fillStyle = '#e5e7eb'; ctx.fillText(fmt(ag.totalPreco), PAD + 450, y)
      ctx.fillStyle = '#6b7280'
      const por = ag.porPessoa.map(p => `${p.nome}: ${p.qty}`).join(', ')
      ctx.fillText(por, PAD + 570, y)
      y += LINE
    }
    y += 8; ctx.strokeStyle = '#374151'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke(); y += 14
    ctx.fillStyle = '#3b82f6'; ctx.font = 'bold 16px system-ui, sans-serif'
    ctx.fillText('Total Geral', PAD + 10, y); ctx.fillText(fmt(grandTotal), W - PAD - ctx.measureText(fmt(grandTotal)).width, y); y += LINE + SECGAP
    ctx.fillStyle = '#e5e7eb'; ctx.font = 'bold 15px system-ui, sans-serif'; ctx.fillText('Por Pessoa', PAD, y); y += LINE + 4
    for (const p of pessoas) {
      const sub = (itensPorPessoa[p.id] ?? []).reduce((s, it) => s + it.quantidade * it.preco_unit, 0)
      ctx.fillStyle = '#9ca3af'; ctx.font = '13px system-ui, sans-serif'; ctx.fillText(`👤 ${p.nome}`, PAD + 10, y)
      ctx.fillStyle = '#e5e7eb'; ctx.fillText(fmt(sub), W - PAD - ctx.measureText(fmt(sub)).width, y); y += LINE
    }
  }

  return canvas.toDataURL('image/png').replace('data:image/png;base64,', '')
}

// ── Componente principal ──────────────────────────────────────────────────────

export function CotacaoEditor({ userId, userNome, cotacao: cotacaoInicial, pessoasIniciais, itensIniciais, faccoes, lojas, membros, faccaoPrecos, lojaPrecos, allItems }: Props) {
  const router = useRouter()
  const sbRef = useRef<ReturnType<typeof createClient> | null>(null)
  const sb = useCallback(() => { if (!sbRef.current) sbRef.current = createClient(); return sbRef.current }, [])

  const [cotacao, setCotacao] = useState(cotacaoInicial)
  const [pessoas, setPessoas] = useState<Pessoa[]>(pessoasIniciais)
  const [itens, setItens] = useState<Item[]>(itensIniciais)

  // Quem pode editar: qualquer um se rascunho, só o criador se finalizada
  const podeEditar = cotacao.status === 'rascunho' || cotacao.created_by === userId

  // Compartilhar
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewModo, setPreviewModo] = useState<'detalhe' | 'totais'>('totais')
  const [gerando, setGerando] = useState(false)
  const [linkImagem, setLinkImagem] = useState<string | null>(null)
  const [linkCopiado, setLinkCopiado] = useState(false)

  // Deletar cotação
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [deletando, setDeletando] = useState(false)

  // Add pessoa
  const [novaPessoaOpen, setNovaPessoaOpen] = useState(false)
  const [novaPessoaForm, setNovaPessoaForm] = useState({ nome: '', membro_id: '' })
  const [salvandoPessoa, setSalvandoPessoa] = useState(false)

  // Add item
  const [addItemPessoa, setAddItemPessoa] = useState<string | null>(null)
  const [itemForm, setItemForm] = useState({ nome: '', item_id: '', qty: '1', preco: '' })
  const [salvandoItem, setSalvandoItem] = useState(false)
  const [itemBusca, setItemBusca] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)

  // Cardápio (batch add via catálogo)
  const [cardapioQtds, setCardapioQtds] = useState<Record<string, number>>({})

  // Edit item inline
  const [editandoItemId, setEditandoItemId] = useState<string | null>(null)
  const [editItemForm, setEditItemForm] = useState({ qty: '', preco: '' })

  // Collapse pessoas
  const [colapsadas, setColapsadas] = useState<Set<string>>(new Set())

  // ── Mapa de itens por id (para peso) ──────────────────────────────────────

  const itemPesoMap = useMemo(() => Object.fromEntries(allItems.map(i => [i.id, i.peso])), [allItems])

  // ── Catálogo do fornecedor ────────────────────────────────────────────────

  const catalogo = useMemo(() => {
    if (cotacao.fornecedor_tipo === 'faccao' && cotacao.fornecedor_id) {
      return faccaoPrecos.filter(fp => fp.faccao_id === cotacao.fornecedor_id).map(fp => ({
        item_id: fp.item_id,
        nome: (fp.items as { nome: string } | null)?.nome ?? fp.item_id,
        preco: cotacao.modo_preco === 'sujo' ? (fp.preco_sujo ?? fp.preco_limpo ?? 0) : (fp.preco_limpo ?? 0),
      }))
    }
    if (cotacao.fornecedor_tipo === 'loja' && cotacao.fornecedor_id) {
      return lojaPrecos.filter(lp => lp.loja_id === cotacao.fornecedor_id).map(lp => ({
        item_id: lp.item_id,
        nome: (lp.items as { nome: string } | null)?.nome ?? lp.item_id,
        preco: cotacao.modo_preco === 'sujo' ? (lp.preco_sujo ?? lp.preco) : lp.preco,
      }))
    }
    return []
  }, [cotacao, faccaoPrecos, lojaPrecos])

  const catalogoFiltrado = useMemo(() => {
    if (!itemBusca.trim()) return catalogo
    return catalogo.filter(c => c.nome.toLowerCase().includes(itemBusca.toLowerCase()))
  }, [catalogo, itemBusca])

  // ── Derivados ──────────────────────────────────────────────────────────────

  const itensPorPessoa = useMemo(() => {
    const map: Record<string, Item[]> = {}
    itens.forEach(it => { const pid = it.pessoa_id ?? '__sem__'; if (!map[pid]) map[pid] = []; map[pid].push(it) })
    return map
  }, [itens])

  const totalGeral = useMemo(() => itens.reduce((s, it) => s + it.quantidade * it.preco_unit, 0), [itens])

  // Itens agregados (para resumo e imagem de totais)
  const itensAgregados = useMemo(() => {
    const map: Record<string, { nome: string; item_id: string | null; totalQty: number; totalPreco: number; porPessoa: { nome: string; qty: number }[] }> = {}
    itens.forEach(it => {
      if (!map[it.item_nome]) map[it.item_nome] = { nome: it.item_nome, item_id: it.item_id, totalQty: 0, totalPreco: 0, porPessoa: [] }
      map[it.item_nome].totalQty += it.quantidade
      map[it.item_nome].totalPreco += it.quantidade * it.preco_unit
      const pessoa = pessoas.find(p => p.id === it.pessoa_id)
      if (pessoa) {
        const pp = map[it.item_nome].porPessoa.find(p => p.nome === pessoa.nome)
        if (pp) pp.qty += it.quantidade
        else map[it.item_nome].porPessoa.push({ nome: pessoa.nome, qty: it.quantidade })
      }
    })
    return Object.values(map)
      .map(ag => ({
        ...ag,
        peso: ag.item_id ? (itemPesoMap[ag.item_id] ?? null) : null,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [itens, pessoas, itemPesoMap])

  // ── Ações ──────────────────────────────────────────────────────────────────

  async function handleAddPessoa() {
    if (!novaPessoaForm.nome.trim()) { toast.error('Nome obrigatório'); return }
    setSalvandoPessoa(true)
    const { data, error } = await sb().from('cotacao_pessoas').insert({
      cotacao_id: cotacao.id, nome: novaPessoaForm.nome.trim(),
      membro_id: novaPessoaForm.membro_id || null,
    }).select().single()
    setSalvandoPessoa(false)
    if (error) { toast.error('Erro ao adicionar pessoa'); return }
    setPessoas(prev => [...prev, data as Pessoa])
    setNovaPessoaForm({ nome: '', membro_id: '' })
    setNovaPessoaOpen(false)
  }

  async function handleDeletePessoa(id: string) {
    await sb().from('cotacao_pessoas').delete().eq('id', id)
    setPessoas(prev => prev.filter(p => p.id !== id))
    setItens(prev => prev.filter(it => it.pessoa_id !== id))
  }

  function abrirAddItem(pessoaId: string) {
    setAddItemPessoa(pessoaId); setItemForm({ nome: '', item_id: '', qty: '1', preco: '' }); setItemBusca(''); setCardapioQtds({})
  }

  async function handleAddCardapio() {
    const toAdd = Object.entries(cardapioQtds).filter(([, qty]) => qty > 0)
    if (toAdd.length === 0) return
    setSalvandoItem(true)
    const adicionados: Item[] = []
    for (const [item_id, qty] of toAdd) {
      const cat = catalogo.find(c => c.item_id === item_id)
      if (!cat) continue
      const { data, error } = await sb().from('cotacao_itens').insert({
        cotacao_id: cotacao.id, pessoa_id: addItemPessoa,
        item_nome: cat.nome, item_id,
        quantidade: qty, preco_unit: cat.preco,
        adicionado_por: userId, adicionado_por_nome: userNome,
      }).select().single()
      if (error) { toast.error('Erro ao adicionar: ' + error.message); setSalvandoItem(false); return }
      adicionados.push(data as Item)
    }
    setSalvandoItem(false)
    setItens(prev => [...prev, ...adicionados])
    setCardapioQtds({}); setAddItemPessoa(null)
  }

  function selecionarCatalogo(cat: { item_id: string; nome: string; preco: number }) {
    setItemForm(f => ({ ...f, nome: cat.nome, item_id: cat.item_id, preco: String(cat.preco) }))
    setItemBusca(cat.nome); setDropdownOpen(false)
  }

  async function handleAddItem() {
    if (!itemForm.nome.trim()) { toast.error('Nome do item obrigatório'); return }
    const qty = parseFloat(itemForm.qty); const preco = parseFloat(itemForm.preco)
    if (!qty || qty <= 0) { toast.error('Quantidade inválida'); return }
    if (isNaN(preco) || preco < 0) { toast.error('Preço inválido'); return }
    setSalvandoItem(true)
    const { data, error } = await sb().from('cotacao_itens').insert({
      cotacao_id: cotacao.id, pessoa_id: addItemPessoa,
      item_nome: itemForm.nome.trim(), item_id: itemForm.item_id || null,
      quantidade: qty, preco_unit: preco,
      adicionado_por: userId, adicionado_por_nome: userNome,
    }).select().single()
    setSalvandoItem(false)
    if (error) { toast.error('Erro ao adicionar item'); return }
    setItens(prev => [...prev, data as Item])
    setItemForm({ nome: '', item_id: '', qty: '1', preco: '' }); setItemBusca('')
  }

  async function handleDeleteItem(id: string) {
    await sb().from('cotacao_itens').delete().eq('id', id)
    setItens(prev => prev.filter(it => it.id !== id))
  }

  function abrirEditItem(it: Item) {
    setEditandoItemId(it.id); setEditItemForm({ qty: String(it.quantidade), preco: String(it.preco_unit) })
  }

  async function handleSalvarEditItem(id: string) {
    const qty = parseFloat(editItemForm.qty); const preco = parseFloat(editItemForm.preco)
    if (!qty || qty <= 0) { toast.error('Quantidade inválida'); return }
    if (isNaN(preco) || preco < 0) { toast.error('Preço inválido'); return }
    const { data, error } = await sb().from('cotacao_itens').update({ quantidade: qty, preco_unit: preco }).eq('id', id).select().single()
    if (error) { toast.error('Erro ao salvar'); return }
    setItens(prev => prev.map(it => it.id === id ? data as Item : it))
    setEditandoItemId(null)
  }

  async function handleFinalizar() {
    await sb().from('cotacoes').update({ status: 'finalizada' }).eq('id', cotacao.id)
    setCotacao(c => ({ ...c, status: 'finalizada' })); toast.success('Cotação finalizada')
  }

  async function handleDeletar() {
    setDeletando(true)
    // Deletar itens e pessoas manualmente (caso o cascade não esteja ativo via RLS)
    await sb().from('cotacao_itens').delete().eq('cotacao_id', cotacao.id)
    await sb().from('cotacao_pessoas').delete().eq('cotacao_id', cotacao.id)
    const { error } = await sb().from('cotacoes').delete().eq('id', cotacao.id)
    setDeletando(false)
    if (error) { toast.error('Erro ao excluir: ' + error.message); return }
    toast.success('Cotação excluída')
    router.push('/ferramentas/cotacao')
  }

  async function handleGerarImagem() {
    setGerando(true)
    try {
      const key = await getImgbbKey()
      if (!key) { toast.error('Chave imgbb não configurada — Admin > Integrações'); return }
      const base64 = gerarImagemCotacao({ cotacao, pessoas, itensPorPessoa, itensAgregados, modo: previewModo })
      const url = await uploadImgbb(base64, key, `cotacao-${cotacao.fornecedor_nome}`)
      setLinkImagem(url); toast.success('Imagem gerada!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar imagem')
    } finally {
      setGerando(false)
    }
  }

  function copiarLink() {
    if (!linkImagem) return
    navigator.clipboard.writeText(linkImagem)
    setLinkCopiado(true); setTimeout(() => setLinkCopiado(false), 2000); toast.success('Link copiado!')
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto p-6 space-y-6 pb-16">

        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => router.push('/ferramentas/cotacao')} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />Voltar
          </button>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => { setPreviewModo('detalhe'); setPreviewOpen(true) }} disabled={pessoas.length === 0}>
              <Eye className="h-3 w-3" />Detalhe
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => { setPreviewModo('totais'); setPreviewOpen(true) }} disabled={pessoas.length === 0}>
              <Eye className="h-3 w-3" />Totais
            </Button>
            {cotacao.status === 'rascunho' && (
              <Button size="sm" className="h-7 text-xs" onClick={handleFinalizar}>
                <Check className="h-3 w-3 mr-1" />Finalizar
              </Button>
            )}
            {podeEditar && (
              <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => setConfirmDeleteOpen(true)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Info da cotação */}
        <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-4 flex-wrap text-sm">
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Fornecedor</p>
            <p className="font-medium mt-0.5">{cotacao.fornecedor_nome}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Tipo</p>
            <p className="font-medium mt-0.5 capitalize">{cotacao.fornecedor_tipo}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Preço</p>
            <p className="font-medium mt-0.5 capitalize">{cotacao.modo_preco}</p>
          </div>
          {cotacao.criado_por_nome && (
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Criado por</p>
              <p className="font-medium mt-0.5">{cotacao.criado_por_nome}</p>
            </div>
          )}
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Status</p>
            <p className={cn('font-medium mt-0.5 capitalize', cotacao.status === 'rascunho' ? 'text-yellow-400' : 'text-green-400')}>{cotacao.status}</p>
          </div>
          <div className="ml-auto">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Total Geral</p>
            <p className="text-lg font-bold mt-0.5 tabular-nums">{fmt(totalGeral)}</p>
          </div>
        </div>

        {/* Pessoas */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />Pessoas ({pessoas.length})
            </h3>
            {podeEditar && (
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setNovaPessoaOpen(true)}>
                <UserPlus className="h-3.5 w-3.5" />Adicionar pessoa
              </Button>
            )}
          </div>

          {pessoas.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <p className="text-xs text-muted-foreground">Adicione pessoas para montar o pedido</p>
            </div>
          )}

          {pessoas.map(pessoa => {
            const pessoaItens = itensPorPessoa[pessoa.id] ?? []
            const subtotal = pessoaItens.reduce((s, it) => s + it.quantidade * it.preco_unit, 0)
            const colapsada = colapsadas.has(pessoa.id)

            return (
              <div key={pessoa.id} className="rounded-lg border border-border overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-3 bg-white/[0.02] border-b border-border">
                  <button onClick={() => setColapsadas(prev => { const n = new Set(prev); colapsada ? n.delete(pessoa.id) : n.add(pessoa.id); return n })}
                    className="text-muted-foreground hover:text-foreground transition-colors">
                    {colapsada ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                  </button>
                  <span className="text-sm font-semibold flex-1">{pessoa.nome}</span>
                  <span className="text-sm font-semibold tabular-nums text-primary">{fmt(subtotal)}</span>
                  {podeEditar && (
                    <button onClick={() => handleDeletePessoa(pessoa.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {!colapsada && (
                  <div>
                    {pessoaItens.length > 0 && (
                      <div className="divide-y divide-border/40">
                        <div className="grid grid-cols-[1fr_70px_100px_100px_64px] gap-2 px-4 py-1.5 text-[10px] text-muted-foreground font-medium bg-white/[0.01]">
                          <span>Item</span><span className="text-right">Qtd</span><span className="text-right">Unit.</span><span className="text-right">Total</span><span />
                        </div>
                        {pessoaItens.map(it => (
                          <div key={it.id} className="grid grid-cols-[1fr_70px_100px_100px_64px] gap-2 items-center px-4 py-2.5">
                            <div>
                              <span className="text-sm font-medium">{it.item_nome}</span>
                              {it.adicionado_por_nome && (
                                <span className="block text-[10px] text-muted-foreground/60">por {it.adicionado_por_nome}</span>
                              )}
                            </div>
                            {editandoItemId === it.id ? (
                              <>
                                <Input value={editItemForm.qty} onChange={e => setEditItemForm(f => ({ ...f, qty: e.target.value }))} className="h-7 text-xs text-right" type="number" />
                                <Input value={editItemForm.preco} onChange={e => setEditItemForm(f => ({ ...f, preco: e.target.value }))} className="h-7 text-xs text-right" type="number" />
                                <span className="text-sm text-right tabular-nums font-medium">{fmt((parseFloat(editItemForm.qty) || 0) * (parseFloat(editItemForm.preco) || 0))}</span>
                                <div className="flex gap-0.5 justify-end">
                                  <button onClick={() => handleSalvarEditItem(it.id)} className="h-6 w-6 rounded flex items-center justify-center text-green-400 hover:bg-white/[0.06]"><Check className="h-3 w-3" /></button>
                                  <button onClick={() => setEditandoItemId(null)} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:bg-white/[0.06]"><X className="h-3 w-3" /></button>
                                </div>
                              </>
                            ) : (
                              <>
                                <span className="text-sm text-right tabular-nums text-muted-foreground">{it.quantidade}×</span>
                                <span className="text-sm text-right tabular-nums text-muted-foreground">{fmt(it.preco_unit)}</span>
                                <span className="text-sm text-right tabular-nums font-medium">{fmt(it.quantidade * it.preco_unit)}</span>
                                <div className="flex gap-0.5 justify-end">
                                  {podeEditar && (
                                      <>
                                        <button onClick={() => abrirEditItem(it)} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"><Edit2 className="h-3 w-3" /></button>
                                        <button onClick={() => handleDeleteItem(it.id)} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-white/[0.06]"><Trash2 className="h-3 w-3" /></button>
                                      </>
                                    )}
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {podeEditar && (
                      addItemPessoa === pessoa.id ? (
                        catalogo.length > 0 ? (
                          /* ── Cardápio ── */
                          <div className="border-t border-border/40">
                            <div className="px-3 py-2 border-b border-border/40">
                              <Input placeholder="Filtrar itens..." value={itemBusca} onChange={e => setItemBusca(e.target.value)} className="h-7 text-xs" autoFocus />
                            </div>
                            <div className="max-h-60 overflow-y-auto">
                              <div className="grid grid-cols-[1fr_80px_100px] text-[10px] text-muted-foreground font-medium px-3 py-1.5 bg-white/[0.03] sticky top-0 border-b border-border/20">
                                <span>Item</span><span className="text-right">Preço</span><span className="text-right">Quantidade</span>
                              </div>
                              {catalogoFiltrado.map(cat => {
                                const qty = cardapioQtds[cat.item_id] ?? 0
                                return (
                                  <div key={cat.item_id} className={cn('grid grid-cols-[1fr_80px_100px] items-center px-3 py-1.5 border-b border-border/20 last:border-0', qty > 0 && 'bg-primary/[0.04]')}>
                                    <span className="text-xs truncate pr-2">{cat.nome}</span>
                                    <span className="text-xs text-right text-muted-foreground tabular-nums">{fmt(cat.preco)}</span>
                                    <div className="flex items-center gap-0.5 justify-end">
                                      {qty > 0 && (
                                        <button onClick={() => setCardapioQtds(prev => { const n = {...prev}; n[cat.item_id] <= 1 ? delete n[cat.item_id] : (n[cat.item_id] -= 1); return n })}
                                          className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors">
                                          <Minus className="h-2.5 w-2.5" />
                                        </button>
                                      )}
                                      <input type="number" min="0" value={qty || ''} placeholder="0"
                                        onChange={e => { const v = parseInt(e.target.value) || 0; setCardapioQtds(prev => { const n = {...prev}; v <= 0 ? delete n[cat.item_id] : (n[cat.item_id] = v); return n }) }}
                                        className="h-5 w-9 text-center text-xs bg-transparent border border-border/40 rounded outline-none focus:border-ring" />
                                      <button onClick={() => setCardapioQtds(prev => ({ ...prev, [cat.item_id]: (prev[cat.item_id] ?? 0) + 1 }))}
                                        className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                                        <Plus className="h-2.5 w-2.5" />
                                      </button>
                                    </div>
                                  </div>
                                )
                              })}
                              {catalogoFiltrado.length === 0 && (
                                <p className="text-xs text-muted-foreground text-center py-4">Nenhum item encontrado</p>
                              )}
                            </div>
                            <div className="flex items-center justify-between px-3 py-2 border-t border-border/40 bg-white/[0.01]">
                              <span className="text-xs text-muted-foreground">
                                {Object.keys(cardapioQtds).length > 0 ? `${Object.keys(cardapioQtds).length} item(s) selecionado(s)` : 'Nenhum item selecionado'}
                              </span>
                              <div className="flex items-center gap-2">
                                <button onClick={() => { setAddItemPessoa(null); setCardapioQtds({}) }} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Cancelar</button>
                                <Button size="sm" className="h-7 text-xs" onClick={handleAddCardapio} disabled={salvandoItem || Object.keys(cardapioQtds).length === 0}>
                                  {salvandoItem ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Confirmar pedido'}
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* ── Form manual (sem catálogo) ── */
                          <div className="border-t border-border/40 p-3 bg-white/[0.01] space-y-2">
                            <div className="relative">
                              <Input placeholder="Nome do item..." value={itemBusca}
                                onChange={e => { setItemBusca(e.target.value); setItemForm(f => ({ ...f, nome: e.target.value, item_id: '' })) }}
                                className="h-7 text-sm" autoFocus />
                            </div>
                            <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center">
                              <Input placeholder="Qtd" type="number" value={itemForm.qty} onChange={e => setItemForm(f => ({ ...f, qty: e.target.value }))} className="h-7 text-sm" />
                              <Input placeholder="Preço unit." type="number" value={itemForm.preco} onChange={e => setItemForm(f => ({ ...f, preco: e.target.value }))} className="h-7 text-sm" />
                              <Button size="sm" className="h-7 text-xs" onClick={handleAddItem} disabled={salvandoItem}>
                                {salvandoItem ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                              </Button>
                              <button onClick={() => setAddItemPessoa(null)} className="text-muted-foreground hover:text-foreground transition-colors"><X className="h-4 w-4" /></button>
                            </div>
                          </div>
                        )
                      ) : (
                        <button onClick={() => abrirAddItem(pessoa.id)}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-white/[0.02] transition-colors border-t border-border/40">
                          <Plus className="h-3 w-3" />Adicionar item
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Resumo de itens (agregado) */}
        {itensAgregados.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Resumo da Compra</h3>
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="grid grid-cols-[1fr_70px_90px_1fr] gap-3 px-4 py-1.5 bg-white/[0.02] border-b border-border text-[10px] text-muted-foreground font-medium">
                <span>Item</span><span className="text-right">Qtd total</span><span className="text-right">Peso total</span><span>Quem pediu</span>
              </div>
              {itensAgregados.map((ag, idx) => {
                const pesoTotal = ag.peso != null ? ag.peso * ag.totalQty : null
                return (
                  <div key={ag.nome} className={cn('grid grid-cols-[1fr_70px_90px_1fr] gap-3 items-center px-4 py-2.5', idx < itensAgregados.length - 1 && 'border-b border-border/40')}>
                    <span className="text-sm font-medium">{ag.nome}</span>
                    <span className="text-sm text-right tabular-nums font-semibold">{ag.totalQty}×</span>
                    <span className="text-sm text-right tabular-nums text-muted-foreground">
                      {pesoTotal != null ? fmtKg(pesoTotal) : '—'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {ag.porPessoa.map(p => `${p.nome}: ${p.qty}`).join(' · ')}
                    </span>
                  </div>
                )
              })}
              <div className="grid grid-cols-[1fr_70px_90px_1fr] gap-3 items-center px-4 py-2.5 bg-white/[0.02] border-t border-border">
                <span className="text-xs font-semibold text-muted-foreground">Total</span>
                <span className="text-sm text-right tabular-nums font-bold text-primary">{fmt(totalGeral)}</span>
                <span className="text-sm text-right tabular-nums text-muted-foreground">
                  {(() => {
                    const pesoTotalGeral = itensAgregados.reduce((s, ag) => ag.peso != null ? s + ag.peso * ag.totalQty : s, 0)
                    return pesoTotalGeral > 0 ? fmtKg(pesoTotalGeral) : '—'
                  })()}
                </span>
                <span />
              </div>
            </div>
          </section>
        )}

      </div>

      {/* ── Modal: Preview ── */}
      <Dialog open={previewOpen} onOpenChange={v => !v && setPreviewOpen(false)}>
        <DialogContent aria-describedby={undefined} className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-sm">
                {previewModo === 'detalhe' ? 'Detalhe por pessoa' : 'Totais da compra'}
              </DialogTitle>
              <div className="ml-auto flex items-center gap-2">
                {linkImagem && (
                  <div className="flex items-center gap-1 rounded border border-border bg-white/[0.04] px-2 h-7 max-w-[180px]">
                    <span className="text-[11px] text-muted-foreground truncate flex-1">{linkImagem}</span>
                    <button onClick={copiarLink} className="shrink-0 text-muted-foreground hover:text-foreground">
                      {linkCopiado ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                )}
                <Button size="sm" className="h-7 text-xs gap-1" onClick={handleGerarImagem} disabled={gerando}>
                  {gerando ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImageUp className="h-3 w-3" />}
                  Gerar imagem
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            {/* Cabeçalho da cotação */}
            <div className="rounded-lg bg-white/[0.03] border border-border p-3 flex items-center gap-3 flex-wrap text-xs">
              <span className="font-semibold">{cotacao.titulo ?? cotacao.fornecedor_nome}</span>
              <span className="text-muted-foreground">{cotacao.fornecedor_nome}</span>
              <span className="text-muted-foreground">preço {cotacao.modo_preco}</span>
              <span className="ml-auto font-bold text-primary text-sm">{fmt(totalGeral)}</span>
            </div>

            {previewModo === 'detalhe' ? (
              /* Detalhe: por pessoa */
              <div className="space-y-3">
                {pessoas.map(pessoa => {
                  const pessoaItens = itensPorPessoa[pessoa.id] ?? []
                  const sub = pessoaItens.reduce((s, it) => s + it.quantidade * it.preco_unit, 0)
                  return (
                    <div key={pessoa.id} className="rounded-lg border border-border overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 bg-white/[0.03] border-b border-border">
                        <span className="text-sm font-semibold">{pessoa.nome}</span>
                        <span className="text-sm font-semibold text-primary tabular-nums">{fmt(sub)}</span>
                      </div>
                      {pessoaItens.length === 0 ? (
                        <p className="text-xs text-muted-foreground px-4 py-3">Sem itens</p>
                      ) : (
                        <div className="divide-y divide-border/40">
                          {pessoaItens.map(it => (
                            <div key={it.id} className="grid grid-cols-[1fr_60px_90px_90px] gap-2 items-center px-4 py-2">
                              <span className="text-sm">{it.item_nome}</span>
                              <span className="text-xs text-right text-muted-foreground">{it.quantidade}×</span>
                              <span className="text-xs text-right text-muted-foreground">{fmt(it.preco_unit)}</span>
                              <span className="text-sm text-right font-medium tabular-nums">{fmt(it.quantidade * it.preco_unit)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              /* Totais: agregado + por pessoa */
              <div className="space-y-4">
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="grid grid-cols-[1fr_60px_90px_1fr] gap-3 px-4 py-1.5 bg-white/[0.02] border-b border-border text-[10px] text-muted-foreground font-medium">
                    <span>Item</span><span className="text-right">Qtd</span><span className="text-right">Total</span><span>Quem pediu</span>
                  </div>
                  {itensAgregados.map((ag, idx) => (
                    <div key={ag.nome} className={cn('grid grid-cols-[1fr_60px_90px_1fr] gap-3 items-center px-4 py-2.5', idx < itensAgregados.length - 1 && 'border-b border-border/40')}>
                      <div>
                        <span className="text-sm font-medium">{ag.nome}</span>
                        {ag.peso != null && <span className="ml-2 text-xs text-muted-foreground">{fmtKg(ag.peso * ag.totalQty)}</span>}
                      </div>
                      <span className="text-sm text-right tabular-nums font-semibold">{ag.totalQty}×</span>
                      <span className="text-sm text-right tabular-nums font-medium">{fmt(ag.totalPreco)}</span>
                      <span className="text-xs text-muted-foreground">{ag.porPessoa.map(p => `${p.nome}: ${p.qty}`).join(' · ')}</span>
                    </div>
                  ))}
                  <div className="grid grid-cols-[1fr_60px_90px_1fr] gap-3 items-center px-4 py-2.5 bg-white/[0.02] border-t border-border">
                    <span className="text-xs font-semibold text-muted-foreground col-span-2">Total Geral</span>
                    <span className="text-sm text-right tabular-nums font-bold text-primary">{fmt(totalGeral)}</span>
                    <span />
                  </div>
                </div>

                {pessoas.length > 1 && (
                  <div className="rounded-lg border border-border p-4 space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Por pessoa</p>
                    {pessoas.map(p => {
                      const sub = (itensPorPessoa[p.id] ?? []).reduce((s, it) => s + it.quantidade * it.preco_unit, 0)
                      return (
                        <div key={p.id} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{p.nome}</span>
                          <span className="font-medium tabular-nums">{fmt(sub)}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Adicionar pessoa ── */}
      <Dialog open={novaPessoaOpen} onOpenChange={v => { if (!v) { setNovaPessoaOpen(false); setNovaPessoaForm({ nome: '', membro_id: '' }) } }}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-xs">
          <DialogHeader><DialogTitle className="text-sm">Adicionar pessoa</DialogTitle></DialogHeader>
          <div className="py-1 space-y-1.5">
            <Label className="text-xs">Nome</Label>
            <div className="relative">
              <Input
                value={novaPessoaForm.nome}
                onChange={e => setNovaPessoaForm({ nome: e.target.value, membro_id: '' })}
                placeholder="Digite o nome..."
                className="h-8 text-sm"
                onKeyDown={e => e.key === 'Enter' && handleAddPessoa()}
                autoFocus
              />
              {novaPessoaForm.nome.trim().length > 0 && (() => {
                const sugs = membros.filter(m =>
                  m.nome.toLowerCase().includes(novaPessoaForm.nome.toLowerCase()) ||
                  (m.vulgo?.toLowerCase().includes(novaPessoaForm.nome.toLowerCase()))
                ).slice(0, 6)
                return sugs.length > 0 ? (
                  <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-md border border-border bg-popover shadow-md overflow-hidden">
                    {sugs.map(m => (
                      <button key={m.id} type="button"
                        onMouseDown={e => { e.preventDefault(); setNovaPessoaForm({ nome: m.nome, membro_id: m.id }) }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent text-left">
                        <span className="font-medium">{m.nome}</span>
                        {m.vulgo && <span className="text-muted-foreground">"{m.vulgo}"</span>}
                      </button>
                    ))}
                  </div>
                ) : null
              })()}
            </div>
            {novaPessoaForm.membro_id && (
              <p className="text-[10px] text-muted-foreground pl-0.5">
                Vinculado: {membros.find(m => m.id === novaPessoaForm.membro_id)?.nome}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setNovaPessoaOpen(false); setNovaPessoaForm({ nome: '', membro_id: '' }) }}>Cancelar</Button>
            <Button size="sm" onClick={handleAddPessoa} disabled={salvandoPessoa}>
              {salvandoPessoa ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Adicionar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Confirmar exclusão ── */}
      <Dialog open={confirmDeleteOpen} onOpenChange={v => !v && setConfirmDeleteOpen(false)}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-xs">
          <DialogHeader><DialogTitle className="text-sm">Excluir cotação</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Tem certeza? Todos os itens e pessoas desta cotação serão excluídos.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" size="sm" onClick={handleDeletar} disabled={deletando}>
              {deletando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Excluir'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

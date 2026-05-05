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
import { cn, norm } from '@/lib/utils'
import {
  Plus, Minus, Trash2, Edit2, Check, X, Users, ArrowLeft,
  ImageUp, Copy, Loader2, UserPlus, ChevronDown, ChevronUp, Eye, XCircle, Layers,
} from 'lucide-react'
import { uploadImgbb, getImgbbKey } from '@/lib/imgbb'

// ── Tipos ────────────────────────────────────────────────────────────────────

type Cotacao = {
  id: string; titulo: string | null; fornecedor_tipo: string; fornecedor_id: string | null
  fornecedor_nome: string; modo_preco: 'sujo' | 'limpo'; status: 'rascunho' | 'finalizada' | 'cancelada'
  criado_por_nome: string | null; created_by: string | null
}
type Pessoa  = { id: string; cotacao_id: string; nome: string; membro_id: string | null; pago?: boolean; pago_por?: string | null }
type Item    = { id: string; cotacao_id: string; pessoa_id: string | null; item_nome: string; item_id: string | null; quantidade: number; preco_unit: number; adicionado_por_nome: string | null; tipo_preco?: 'sujo' | 'limpo' | null }
type Faccao  = { id: string; nome: string; cor_tag: string }
type Loja    = { id: string; nome: string }
type Membro  = { id: string; nome: string; vulgo: string | null }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FaccaoPreco = { faccao_id: string; item_id: string; preco_sujo: number | null; preco_limpo: number | null; items: any }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LojaPreco   = { loja_id: string; item_id: string; preco: number; preco_sujo: number | null; items: any }
type SimpleItem  = { id: string; nome: string; peso: number | null }
type FaixaPreco  = { faccao_id: string; item_id: string; quantidade_min: number; preco_sujo: number | null; preco_limpo: number | null }
type Servico     = { id: string; nome: string }
type ServicoItem = { servico_id: string; item_id: string; quantidade: number; item_nome: string }

interface Props {
  userId: string
  userNome: string | null
  cotacao: Cotacao
  pessoasIniciais: Pessoa[]
  itensIniciais: Item[]
  faccoes: Faccao[]; lojas: Loja[]; membros: Membro[]
  faccaoPrecos: FaccaoPreco[]; lojaPrecos: LojaPreco[]
  allItems: SimpleItem[]
  faixasPrecos: FaixaPreco[]
  servicos: Servico[]
  servicoItens: ServicoItem[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number) {
  const rounded = Math.round(v)
  const neg = rounded < 0 ? '-' : ''
  const abs = Math.abs(rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${neg}R$ ${abs}`
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

export function CotacaoEditor({ userId, userNome, cotacao: cotacaoInicial, pessoasIniciais, itensIniciais, faccoes, lojas, membros, faccaoPrecos, lojaPrecos, allItems, faixasPrecos, servicos, servicoItens }: Props) {
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

  // Solicitar cancelamento (quando já finalizada)
  const [solicitarCancelOpen, setSolicitarCancelOpen] = useState(false)
  const [motivoCancel, setMotivoCancel] = useState('')
  const [enviandoSolicit, setEnviandoSolicit] = useState(false)

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

  // Tipo de preço ao adicionar itens (sujo/limpo)
  const [addItemTipoPreco, setAddItemTipoPreco] = useState<'sujo' | 'limpo'>(cotacao.modo_preco)

  // Aba do catálogo: itens individuais ou kits/serviços
  const [catalogoTab, setCatalogoTab] = useState<'itens' | 'kits'>('itens')
  const [kitQtds, setKitQtds] = useState<Record<string, number>>({})
  const [kitBusca, setKitBusca] = useState('')

  // Edição inline de pago_por
  const [pagoEditId, setPagoEditId] = useState<string | null>(null)
  const [pagoEditValue, setPagoEditValue] = useState('')

  // ── Mapa de itens por id (para peso) ──────────────────────────────────────

  const itemPesoMap = useMemo(() => Object.fromEntries(allItems.map(i => [i.id, i.peso])), [allItems])

  // ── Membros filtrados para o dialog de adicionar pessoa ───────────────────

  const membrosDialog = useMemo(() => {
    const q = norm(novaPessoaForm.nome).trim()
    return q ? membros.filter(m =>
      norm(m.nome).includes(q) || norm(m.vulgo).includes(q)
    ) : membros
  }, [membros, novaPessoaForm.nome])

  // ── Catálogo do fornecedor ────────────────────────────────────────────────

  // Mapa: faccao_id+item_id → faixas ordenadas
  const faixasMap = useMemo(() => {
    const map: Record<string, FaixaPreco[]> = {}
    for (const f of faixasPrecos) {
      const key = `${f.faccao_id}:${f.item_id}`
      if (!map[key]) map[key] = []
      map[key].push(f)
    }
    return map
  }, [faixasPrecos])

  function resolverPrecoComFaixas(fp: FaccaoPreco, quantidade: number, tipo: 'sujo' | 'limpo'): number {
    const key = `${fp.faccao_id}:${fp.item_id}`
    const faixas = (faixasMap[key] ?? []).sort((a, b) => b.quantidade_min - a.quantidade_min)
    const faixa = faixas.find(f => quantidade >= f.quantidade_min)
    if (faixa) {
      return tipo === 'sujo' ? (faixa.preco_sujo ?? faixa.preco_limpo ?? 0) : (faixa.preco_limpo ?? 0)
    }
    return tipo === 'sujo' ? (fp.preco_sujo ?? fp.preco_limpo ?? 0) : (fp.preco_limpo ?? 0)
  }

  const catalogo = useMemo(() => {
    if (cotacao.fornecedor_tipo === 'faccao' && cotacao.fornecedor_id) {
      return faccaoPrecos.filter(fp => fp.faccao_id === cotacao.fornecedor_id).map(fp => ({
        item_id: fp.item_id,
        nome: (fp.items as { nome: string } | null)?.nome ?? fp.item_id,
        preco: addItemTipoPreco === 'sujo' ? (fp.preco_sujo ?? fp.preco_limpo ?? 0) : (fp.preco_limpo ?? 0),
        fp,
      }))
    }
    if (cotacao.fornecedor_tipo === 'loja' && cotacao.fornecedor_id) {
      return lojaPrecos.filter(lp => lp.loja_id === cotacao.fornecedor_id).map(lp => ({
        item_id: lp.item_id,
        nome: (lp.items as { nome: string } | null)?.nome ?? lp.item_id,
        preco: addItemTipoPreco === 'sujo' ? (lp.preco_sujo ?? lp.preco) : lp.preco,
        fp: null,
      }))
    }
    return []
  }, [cotacao, faccaoPrecos, lojaPrecos, addItemTipoPreco])

  const catalogoFiltrado = useMemo(() => {
    if (!itemBusca.trim()) return catalogo
    return catalogo.filter(c => norm(c.nome).includes(norm(itemBusca)))
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
    setAddItemPessoa(pessoaId); setItemForm({ nome: '', item_id: '', qty: '1', preco: '' }); setItemBusca(''); setCardapioQtds({}); setCatalogoTab('itens'); setKitQtds({}); setKitBusca('')
  }

  async function handleAddCardapio() {
    const toAdd = Object.entries(cardapioQtds).filter(([, qty]) => qty > 0)
    if (toAdd.length === 0) return
    setSalvandoItem(true)
    const adicionados: Item[] = []
    for (const [item_id, qty] of toAdd) {
      const cat = catalogo.find(c => c.item_id === item_id)
      if (!cat) continue
      // Resolve preço considerando faixas por quantidade
      const preco_unit = cat.fp ? resolverPrecoComFaixas(cat.fp as FaccaoPreco, qty, addItemTipoPreco) : cat.preco
      const { data, error } = await sb().from('cotacao_itens').insert({
        cotacao_id: cotacao.id, pessoa_id: addItemPessoa,
        item_nome: cat.nome, item_id,
        quantidade: qty, preco_unit,
        adicionado_por: userId, adicionado_por_nome: userNome,
        tipo_preco: addItemTipoPreco,
      }).select().single()
      if (error) { toast.error('Erro ao adicionar: ' + error.message); setSalvandoItem(false); return }
      adicionados.push(data as Item)
    }
    setSalvandoItem(false)
    setItens(prev => [...prev, ...adicionados])
    setCardapioQtds({}); setAddItemPessoa(null)
  }

  async function handleAddKits() {
    const toAdd = Object.entries(kitQtds).filter(([, qty]) => qty > 0)
    if (toAdd.length === 0) return
    setSalvandoItem(true)
    const adicionados: Item[] = []
    // Mapa item_id → preço do catálogo atual
    const precoMap: Record<string, number> = {}
    for (const c of catalogo) precoMap[c.item_id] = c.fp ? resolverPrecoComFaixas(c.fp as FaccaoPreco, 1, addItemTipoPreco) : c.preco
    for (const [servico_id, kitQty] of toAdd) {
      const srv = servicos.find(s => s.id === servico_id)
      if (!srv) continue
      const itensDoKit = servicoItens.filter(si => si.servico_id === servico_id)
      for (const si of itensDoKit) {
        const qty = si.quantidade * kitQty
        const preco_unit = precoMap[si.item_id] ?? 0
        const { data, error } = await sb().from('cotacao_itens').insert({
          cotacao_id: cotacao.id, pessoa_id: addItemPessoa,
          item_nome: si.item_nome || allItems.find(i => i.id === si.item_id)?.nome || si.item_id,
          item_id: si.item_id,
          quantidade: qty, preco_unit,
          adicionado_por: userId, adicionado_por_nome: userNome,
          tipo_preco: addItemTipoPreco,
        }).select().single()
        if (error) { toast.error('Erro ao adicionar: ' + error.message); setSalvandoItem(false); return }
        adicionados.push(data as Item)
      }
    }
    setSalvandoItem(false)
    setItens(prev => [...prev, ...adicionados])
    setKitQtds({}); setAddItemPessoa(null)
    toast.success('Kit(s) adicionado(s)')
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
      tipo_preco: addItemTipoPreco,
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

  async function handleTogglePago(pessoaId: string, pago: boolean) {
    setPessoas(prev => prev.map(p => p.id === pessoaId ? { ...p, pago } : p))
    await sb().from('cotacao_pessoas').update({ pago }).eq('id', pessoaId)
  }

  async function handleSalvarPagoPor(pessoaId: string, pago_por: string) {
    const v = pago_por.trim() || null
    setPessoas(prev => prev.map(p => p.id === pessoaId ? { ...p, pago_por: v } : p))
    await sb().from('cotacao_pessoas').update({ pago_por: v }).eq('id', pessoaId)
  }

  async function handleAddMembro(m: Membro) {
    setSalvandoPessoa(true)
    const { data, error } = await sb().from('cotacao_pessoas').insert({
      cotacao_id: cotacao.id, nome: m.nome, membro_id: m.id,
    }).select().single()
    setSalvandoPessoa(false)
    if (error) { toast.error('Erro ao adicionar pessoa'); return }
    setPessoas(prev => [...prev, data as Pessoa])
    setNovaPessoaForm({ nome: '', membro_id: '' })
    setNovaPessoaOpen(false)
  }

  async function handleFinalizar() {
    await sb().from('cotacoes').update({ status: 'finalizada' }).eq('id', cotacao.id)
    setCotacao(c => ({ ...c, status: 'finalizada' })); toast.success('Cotação finalizada')
  }

  async function handleSolicitarCancelamento() {
    setEnviandoSolicit(true)
    const { error } = await sb().from('sistema_solicitacoes').insert({
      tipo: 'cancelamento_cotacao',
      referencia_id: cotacao.id,
      referencia_tipo: 'cotacao',
      descricao: `Cancelamento: ${cotacao.fornecedor_nome}`,
      solicitante_id: userId,
      solicitante_nome: userNome,
      dados: { fornecedor_nome: cotacao.fornecedor_nome, motivo: motivoCancel.trim() || null, status_atual: cotacao.status },
    })
    setEnviandoSolicit(false)
    if (error) { toast.error('Erro ao enviar solicitação'); return }
    setSolicitarCancelOpen(false); setMotivoCancel('')
    toast.success('Solicitação enviada! Aguarde aprovação de um administrador.')
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
            {podeEditar && cotacao.status === 'rascunho' && (
              <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => setConfirmDeleteOpen(true)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
            {podeEditar && cotacao.status !== 'rascunho' && (
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground" onClick={() => setSolicitarCancelOpen(true)}>
                <XCircle className="h-3 w-3" />Solicitar cancelamento
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
                <div className="flex flex-col">
                  <div className="flex items-center gap-3 px-4 py-3 bg-white/[0.02] border-b border-border">
                    <button onClick={() => setColapsadas(prev => { const n = new Set(prev); colapsada ? n.delete(pessoa.id) : n.add(pessoa.id); return n })}
                      className="text-muted-foreground hover:text-foreground transition-colors">
                      {colapsada ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                    </button>
                    <span className="text-sm font-semibold flex-1">{pessoa.nome}</span>
                    {/* Pago toggle */}
                    <button
                      onClick={() => handleTogglePago(pessoa.id, !(pessoa.pago ?? false))}
                      title={pessoa.pago ? 'Marcar como pendente' : 'Marcar como pago'}
                      className={cn('flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors',
                        (pessoa.pago ?? false)
                          ? 'bg-green-400/10 text-green-400 hover:bg-green-400/20'
                          : 'text-muted-foreground/40 hover:text-muted-foreground hover:bg-white/[0.04]'
                      )}>
                      {(pessoa.pago ?? false) ? <Check className="h-2.5 w-2.5" /> : <span>$</span>}
                      {(pessoa.pago ?? false) ? 'Pago' : 'Pendente'}
                    </button>
                    <span className="text-sm font-semibold tabular-nums text-primary">{fmt(subtotal)}</span>
                    {podeEditar && (
                      <button onClick={() => handleDeletePessoa(pessoa.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {/* Linha de pago_por (quando pago = true) */}
                  {(pessoa.pago ?? false) && (
                    <div className="flex items-center gap-2 px-4 py-1.5 bg-green-400/[0.03] border-b border-border text-[10px]">
                      <span className="text-muted-foreground shrink-0">Recebido por:</span>
                      {pagoEditId === pessoa.id ? (
                        <input
                          value={pagoEditValue}
                          onChange={e => setPagoEditValue(e.target.value)}
                          onBlur={() => { handleSalvarPagoPor(pessoa.id, pagoEditValue); setPagoEditId(null) }}
                          onKeyDown={e => { if (e.key === 'Enter') { handleSalvarPagoPor(pessoa.id, pagoEditValue); setPagoEditId(null) } if (e.key === 'Escape') setPagoEditId(null) }}
                          placeholder="Nome de quem recebeu..."
                          className="flex-1 bg-transparent border-b border-border outline-none text-foreground placeholder:text-muted-foreground/40"
                          autoFocus
                        />
                      ) : (
                        <button
                          onClick={() => { setPagoEditId(pessoa.id); setPagoEditValue(pessoa.pago_por ?? '') }}
                          className="flex-1 text-left text-muted-foreground hover:text-foreground transition-colors truncate">
                          {pessoa.pago_por ?? <span className="italic opacity-50">clique para informar</span>}
                        </button>
                      )}
                    </div>
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
                              {it.tipo_preco && (
                                <span className={cn('ml-1.5 px-1 rounded text-[9px] font-semibold', it.tipo_preco === 'sujo' ? 'bg-orange-400/20 text-orange-400' : 'bg-emerald-400/20 text-emerald-400')}>
                                  {it.tipo_preco === 'sujo' ? 'S' : 'L'}
                                </span>
                              )}
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
                            {/* Cabeçalho com abas + filtro L/S */}
                            <div className="px-3 py-2 border-b border-border/40 flex items-center gap-2">
                              <div className="flex items-center gap-0.5 bg-muted/20 rounded p-0.5 border border-border/30 shrink-0">
                                <button onClick={() => setCatalogoTab('itens')}
                                  className={cn('px-2 py-0.5 rounded text-[10px] font-medium transition-colors', catalogoTab === 'itens' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground')}>
                                  Itens
                                </button>
                                <button onClick={() => setCatalogoTab('kits')}
                                  className={cn('flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-medium transition-colors', catalogoTab === 'kits' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground')}>
                                  <Layers className="h-2.5 w-2.5" />Kits
                                </button>
                              </div>
                              {catalogoTab === 'itens' ? (
                                <Input placeholder="Filtrar itens..." value={itemBusca} onChange={e => setItemBusca(e.target.value)} className="h-7 text-xs flex-1" autoFocus />
                              ) : (
                                <Input placeholder="Filtrar kits..." value={kitBusca} onChange={e => setKitBusca(e.target.value)} className="h-7 text-xs flex-1" autoFocus />
                              )}
                              <div className="flex items-center gap-0.5 bg-muted/20 rounded p-0.5 border border-border/30 shrink-0">
                                <button onClick={() => setAddItemTipoPreco('limpo')}
                                  className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors', addItemTipoPreco === 'limpo' ? 'bg-emerald-400/20 text-emerald-400' : 'text-muted-foreground hover:text-foreground')}>L</button>
                                <button onClick={() => setAddItemTipoPreco('sujo')}
                                  className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors', addItemTipoPreco === 'sujo' ? 'bg-orange-400/20 text-orange-400' : 'text-muted-foreground hover:text-foreground')}>S</button>
                              </div>
                            </div>

                            {catalogoTab === 'itens' ? (
                              <>
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
                              </>
                            ) : (
                              /* ── Aba Kits ── */
                              <>
                                <div className="max-h-60 overflow-y-auto">
                                  {servicos.filter(s => !kitBusca.trim() || norm(s.nome).includes(norm(kitBusca))).map(srv => {
                                    const qty = kitQtds[srv.id] ?? 0
                                    const itensDoKit = servicoItens.filter(si => si.servico_id === srv.id)
                                    return (
                                      <div key={srv.id} className={cn('px-3 py-2 border-b border-border/20 last:border-0', qty > 0 && 'bg-primary/[0.04]')}>
                                        <div className="flex items-center gap-2">
                                          <Layers className="h-3 w-3 text-muted-foreground shrink-0" />
                                          <span className="text-xs flex-1 truncate">{srv.nome}</span>
                                          <span className="text-[10px] text-muted-foreground shrink-0">{itensDoKit.length} item(s)</span>
                                          <div className="flex items-center gap-0.5">
                                            {qty > 0 && (
                                              <button onClick={() => setKitQtds(prev => { const n = {...prev}; n[srv.id] <= 1 ? delete n[srv.id] : (n[srv.id] -= 1); return n })}
                                                className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors">
                                                <Minus className="h-2.5 w-2.5" />
                                              </button>
                                            )}
                                            <input type="number" min="0" value={qty || ''} placeholder="0"
                                              onChange={e => { const v = parseInt(e.target.value) || 0; setKitQtds(prev => { const n = {...prev}; v <= 0 ? delete n[srv.id] : (n[srv.id] = v); return n }) }}
                                              className="h-5 w-9 text-center text-xs bg-transparent border border-border/40 rounded outline-none focus:border-ring" />
                                            <button onClick={() => setKitQtds(prev => ({ ...prev, [srv.id]: (prev[srv.id] ?? 0) + 1 }))}
                                              className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                                              <Plus className="h-2.5 w-2.5" />
                                            </button>
                                          </div>
                                        </div>
                                        {qty > 0 && itensDoKit.length > 0 && (
                                          <div className="mt-1 pl-5 space-y-0.5">
                                            {itensDoKit.map(si => (
                                              <div key={si.item_id} className="flex items-center justify-between text-[10px] text-muted-foreground">
                                                <span className="truncate">{si.item_nome || allItems.find(i => i.id === si.item_id)?.nome || si.item_id}</span>
                                                <span className="shrink-0 tabular-nums ml-2">{si.quantidade * qty}×</span>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                  {servicos.filter(s => !kitBusca.trim() || norm(s.nome).includes(norm(kitBusca))).length === 0 && (
                                    <p className="text-xs text-muted-foreground text-center py-4">Nenhum kit encontrado</p>
                                  )}
                                </div>
                                <div className="flex items-center justify-between px-3 py-2 border-t border-border/40 bg-white/[0.01]">
                                  <span className="text-xs text-muted-foreground">
                                    {Object.keys(kitQtds).length > 0 ? `${Object.keys(kitQtds).length} kit(s) selecionado(s)` : 'Nenhum kit selecionado'}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => { setAddItemPessoa(null); setKitQtds({}) }} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Cancelar</button>
                                    <Button size="sm" className="h-7 text-xs" onClick={handleAddKits} disabled={salvandoItem || Object.keys(kitQtds).length === 0}>
                                      {salvandoItem ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Adicionar kits'}
                                    </Button>
                                  </div>
                                </div>
                              </>
                            )}
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
        <DialogContent aria-describedby={undefined} className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">Adicionar pessoa</DialogTitle></DialogHeader>
          <div className="py-1 space-y-2">
            <Input
              value={novaPessoaForm.nome}
              onChange={e => setNovaPessoaForm({ nome: e.target.value, membro_id: '' })}
              placeholder="Buscar ou digitar nome..."
              className="h-8 text-sm"
              onKeyDown={e => e.key === 'Enter' && handleAddPessoa()}
              autoFocus
            />
            {membros.length > 0 && (
              <div className="rounded-md border border-border max-h-52 overflow-y-auto">
                {membrosDialog.length > 0 ? membrosDialog.map(m => (
                  <button key={m.id} type="button"
                    onClick={() => handleAddMembro(m)}
                    disabled={salvandoPessoa}
                    className={cn('w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent text-left border-b border-border/30 last:border-0 transition-colors',
                      novaPessoaForm.membro_id === m.id && 'bg-primary/10'
                    )}>
                    <span className="font-medium flex-1">{m.nome}</span>
                    {m.vulgo && <span className="text-muted-foreground">"{m.vulgo}"</span>}
                  </button>
                )) : (
                  <p className="text-xs text-muted-foreground text-center py-3">Nenhum membro encontrado</p>
                )}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setNovaPessoaOpen(false); setNovaPessoaForm({ nome: '', membro_id: '' }) }}>Cancelar</Button>
            <Button size="sm" onClick={handleAddPessoa} disabled={salvandoPessoa || !novaPessoaForm.nome.trim()}>
              {salvandoPessoa ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Adicionar nome digitado'}
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

      {/* ── Dialog: Solicitar cancelamento (finalizada) ── */}
      <Dialog open={solicitarCancelOpen} onOpenChange={v => { if (!v) { setSolicitarCancelOpen(false); setMotivoCancel('') } }}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">Solicitar cancelamento</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Esta cotação já está <strong>{cotacao.status}</strong>. Um administrador precisará aprovar o cancelamento.</p>
          <div className="space-y-1">
            <Label className="text-xs">Motivo (opcional)</Label>
            <Input
              placeholder="Por que deseja cancelar?"
              value={motivoCancel}
              onChange={e => setMotivoCancel(e.target.value)}
              className="text-xs"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setSolicitarCancelOpen(false); setMotivoCancel('') }}>Voltar</Button>
            <Button size="sm" onClick={handleSolicitarCancelamento} disabled={enviandoSolicit}>
              {enviandoSolicit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Enviar solicitação'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

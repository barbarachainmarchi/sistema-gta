'use client'

import { useState, useMemo, useCallback, useRef, memo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Search, Star, Package, Plus, X, Minus, Copy, Check, Image, Layers } from 'lucide-react'
import { getImgbbKey, uploadImgbb } from '@/lib/imgbb'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Item = {
  id: string
  nome: string
  tem_craft: boolean
  eh_meu_produto: boolean
  meu_produto_usuario_id: string | null
  peso: number | null
  categorias_item: { nome: string } | null
  item_receita: { ingrediente_id: string; quantidade: number }[]
}

type Loja = { id: string; nome: string }
type LojaPreco = { loja_id: string; item_id: string; preco: number; preco_sujo: number | null }
type FaccaoPreco = { faccao_id: string; item_id: string; preco_limpo: number | null; preco_sujo: number | null }
type PrecoVigente = { item_id: string; preco_sujo: number | null; preco_limpo: number | null }
type Servico = { id: string; nome: string; descricao: string | null; preco_sujo: number | null; preco_limpo: number | null; desconto_pct: number; eh_meu_servico: boolean }
type ServicoItemCalc = { servico_id: string; item_id: string; quantidade: number; item_nome: string }

interface Props {
  userId: string
  items: Item[]
  precosVigentes: PrecoVigente[]
  lojas: Loja[]
  lojaPrecos: LojaPreco[]
  faccaoPrecos: FaccaoPreco[]
  meuLojaId: string | null
  meuFaccaoId: string | null
  favoritosIniciais: string[]
  podeEditar?: boolean
  servicos: Servico[]
  servicoItens: ServicoItemCalc[]
}

type BatchEntry = { item_id: string; quantidade: number; loja_id: string }
type Aba = 'favoritos' | 'meus' | 'todos'
type Modo = 'simples' | 'producao'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtKg(kg: number) {
  if (kg === 0) return '—'
  return `${kg % 1 === 0 ? kg : kg.toFixed(2)} kg`
}
function fmtNum(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

// ── Item com botão + ──────────────────────────────────────────────────────────

const ItemBtn = memo(function ItemBtn({ item, isInBatch, isFavorito, isMeu, precoLimpo, precoSujo, onAdd, onToggleFav, podeEditar }: {
  item: Item
  isInBatch: boolean
  isFavorito: boolean
  isMeu: boolean
  precoLimpo: number | null
  precoSujo: number | null
  onAdd: (id: string) => void
  onToggleFav: (id: string, e: React.MouseEvent) => void
  podeEditar: boolean
}) {
  return (
    <div className={cn(
      'flex items-center gap-1.5 px-3 py-2.5 border-b border-border/30 transition-colors',
      isInBatch && 'bg-primary/[0.06]'
    )}>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium leading-tight truncate">{item.nome}</div>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {item.categorias_item?.nome && (
            <span className="text-[10px] text-muted-foreground">{item.categorias_item.nome}</span>
          )}
          {isMeu && <span className="text-[10px] text-emerald-500/70">meu</span>}
        </div>
        {(precoLimpo != null || precoSujo != null) && (
          <div className="flex items-center gap-2 mt-0.5">
            {precoLimpo != null && (
              <span className="text-[10px] text-emerald-400/70 tabular-nums">{fmt(precoLimpo)} L</span>
            )}
            {precoSujo != null && (
              <span className="text-[10px] text-orange-400/60 tabular-nums">{fmt(precoSujo)} S</span>
            )}
          </div>
        )}
      </div>
      <button
        onMouseDown={e => e.preventDefault()}
        onClick={e => podeEditar && onToggleFav(item.id, e)}
        disabled={!podeEditar}
        className={cn('shrink-0 p-0.5 rounded transition-colors',
          isFavorito ? 'text-yellow-400' : 'text-muted-foreground/40 hover:text-yellow-400',
          !podeEditar && 'opacity-40 cursor-default'
        )}>
        <Star className="h-3.5 w-3.5" fill={isFavorito ? 'currentColor' : 'none'} />
      </button>
      <button
        onClick={() => onAdd(item.id)}
        disabled={isInBatch}
        className={cn(
          'shrink-0 h-6 w-6 rounded flex items-center justify-center transition-colors',
          isInBatch
            ? 'text-primary/40 cursor-default'
            : 'text-muted-foreground hover:text-primary hover:bg-primary/10'
        )}>
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  )
})

// ── Geração de imagem canvas ──────────────────────────────────────────────────

function gerarCanvas(linhas: { text: string; indent?: boolean; bold?: boolean; dim?: boolean; color?: string }[]): HTMLCanvasElement {
  const W = 540
  const PAD = 24
  const LINE_H = 22
  const H = PAD * 2 + linhas.length * LINE_H + 10
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  // Fundo
  ctx.fillStyle = '#0d0d14'
  ctx.fillRect(0, 0, W, H)

  // Barra lateral primária
  ctx.fillStyle = '#6366f1'
  ctx.fillRect(0, 0, 3, H)

  // Texto
  linhas.forEach((linha, i) => {
    const y = PAD + i * LINE_H + LINE_H * 0.72
    const x = PAD + (linha.indent ? 16 : 0)
    ctx.font = linha.bold ? 'bold 13px ui-monospace, monospace' : '13px ui-monospace, monospace'
    ctx.fillStyle = linha.color ?? (linha.dim ? '#64748b' : '#e2e8f0')
    ctx.fillText(linha.text, x, y)
  })

  return canvas
}

// ── Componente principal ──────────────────────────────────────────────────────

export function CalculadoraClient({
  userId, items, precosVigentes, lojas, lojaPrecos, faccaoPrecos,
  meuLojaId, meuFaccaoId, favoritosIniciais, podeEditar = true,
  servicos, servicoItens,
}: Props) {
  const sbRef = useRef<ReturnType<typeof createClient> | null>(null)
  const sb = useCallback(() => { if (!sbRef.current) sbRef.current = createClient(); return sbRef.current }, [])

  const [busca, setBusca] = useState('')
  const [aba, setAba] = useState<Aba>('meus')
  const [filterCategoria, setFilterCategoria] = useState('')
  const [batch, setBatch] = useState<BatchEntry[]>([])
  const [favoritos, setFavoritos] = useState<Set<string>>(new Set(favoritosIniciais))
  const [lojasPorIng, setLojasPorIng] = useState<Record<string, string>>({})
  const [servicosSelecionados, setServicosSelecionados] = useState<Servico[]>([])
  const [modoSujo, setModoSujo] = useState(false)
  const [modo, setModo] = useState<Modo>('simples')
  const [copied, setCopied] = useState(false)
  const [imgbbLoading, setImgbbLoading] = useState(false)

  const favoritosRef = useRef(favoritos)
  favoritosRef.current = favoritos

  // ── Mapas ─────────────────────────────────────────────────────────────────

  const itemMap = useMemo(() => Object.fromEntries(items.map(i => [i.id, i])), [items])
  const lojaMap = useMemo(() => Object.fromEntries(lojas.map(l => [l.id, l])), [lojas])

  const meuPrecoMap = useMemo(() => {
    const map: Record<string, { preco_limpo: number | null; preco_sujo: number | null }> = {}
    precosVigentes.forEach(p => { map[p.item_id] = { preco_limpo: p.preco_limpo, preco_sujo: p.preco_sujo } })
    if (meuLojaId) {
      lojaPrecos.filter(lp => lp.loja_id === meuLojaId).forEach(lp => {
        map[lp.item_id] = { preco_limpo: lp.preco, preco_sujo: lp.preco_sujo }
      })
    }
    if (meuFaccaoId) {
      faccaoPrecos.filter(fp => fp.faccao_id === meuFaccaoId).forEach(fp => {
        if (!meuLojaId || !lojaPrecos.some(lp => lp.loja_id === meuLojaId && lp.item_id === fp.item_id)) {
          map[fp.item_id] = { preco_limpo: fp.preco_limpo, preco_sujo: fp.preco_sujo }
        }
      })
    }
    return map
  }, [precosVigentes, lojaPrecos, faccaoPrecos, meuLojaId, meuFaccaoId])

  // "Meus" = itens do local de trabalho atual; sem local = itens marcados como meu produto
  const meusItemIds = useMemo(() => {
    const ids = new Set<string>()
    if (meuLojaId) {
      lojaPrecos.filter(lp => lp.loja_id === meuLojaId).forEach(lp => ids.add(lp.item_id))
    } else if (meuFaccaoId) {
      faccaoPrecos.filter(fp => fp.faccao_id === meuFaccaoId).forEach(fp => ids.add(fp.item_id))
    } else {
      items.forEach(i => { if (i.eh_meu_produto || i.meu_produto_usuario_id === userId) ids.add(i.id) })
    }
    return ids
  }, [lojaPrecos, faccaoPrecos, meuLojaId, meuFaccaoId, items, userId])

  const lojaPrecoPorItem = useMemo(() => {
    const map: Record<string, LojaPreco[]> = {}
    lojaPrecos.forEach(lp => {
      if (!map[lp.item_id]) map[lp.item_id] = []
      map[lp.item_id].push(lp)
    })
    return map
  }, [lojaPrecos])

  const categoriasCalc = useMemo(() => {
    const cats = new Set<string>()
    items.forEach(i => { if (i.categorias_item?.nome) cats.add(i.categorias_item.nome) })
    return Array.from(cats).sort()
  }, [items])

  // Lista filtrada — TODOS os itens ativos, favoritos primeiro
  const itensFiltrados = useMemo(() => {
    let lista = items
    if (aba === 'favoritos') lista = lista.filter(i => favoritos.has(i.id))
    if (aba === 'meus') lista = lista.filter(i => meusItemIds.has(i.id))
    if (filterCategoria) lista = lista.filter(i => i.categorias_item?.nome === filterCategoria)
    if (busca.trim()) {
      const q = busca.toLowerCase()
      lista = lista.filter(i =>
        i.nome.toLowerCase().includes(q) || i.categorias_item?.nome.toLowerCase().includes(q)
      )
    }
    if (aba !== 'favoritos') {
      lista = [...lista].sort((a, b) => {
        const af = favoritos.has(a.id) ? 0 : 1
        const bf = favoritos.has(b.id) ? 0 : 1
        if (af !== bf) return af - bf
        return a.nome.localeCompare(b.nome)
      })
    }
    return lista
  }, [items, aba, favoritos, busca, meusItemIds, filterCategoria])

  const batchIds = useMemo(() => new Set(batch.map(b => b.item_id)), [batch])

  // ── Callbacks ─────────────────────────────────────────────────────────────

  const toggleFavorito = useCallback(async (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const tinha = favoritosRef.current.has(itemId)
    setFavoritos(prev => { const n = new Set(prev); tinha ? n.delete(itemId) : n.add(itemId); return n })
    if (tinha) {
      const { error } = await sb().from('usuario_favoritos').delete().eq('usuario_id', userId).eq('item_id', itemId)
      if (error) { toast.error('Erro ao remover favorito'); setFavoritos(prev => { const n = new Set(prev); n.add(itemId); return n }) }
    } else {
      const { error } = await sb().from('usuario_favoritos').insert({ usuario_id: userId, item_id: itemId })
      if (error) { toast.error('Erro ao favoritar'); setFavoritos(prev => { const n = new Set(prev); n.delete(itemId); return n }) }
    }
  }, [userId, sb])

  const addToBatch = useCallback((itemId: string) => {
    setBatch(prev => prev.some(b => b.item_id === itemId) ? prev : [...prev, { item_id: itemId, quantidade: 1, loja_id: '' }])
  }, [])
  const removeFromBatch = useCallback((itemId: string) => {
    setBatch(prev => prev.filter(b => b.item_id !== itemId))
  }, [])
  const setQtd = useCallback((itemId: string, qtd: number) => {
    if (qtd <= 0) { setBatch(prev => prev.filter(b => b.item_id !== itemId)); return }
    setBatch(prev => prev.map(b => b.item_id === itemId ? { ...b, quantidade: qtd } : b))
  }, [])
  const setLoja = useCallback((itemId: string, lojaId: string) => {
    setBatch(prev => prev.map(b => b.item_id === itemId ? { ...b, loja_id: lojaId === 'sem' ? '' : lojaId } : b))
  }, [])

  // Preço efetivo por item do batch
  const getPrecoItem = useCallback((entry: BatchEntry): number | null => {
    if (entry.loja_id) {
      const lp = lojaPrecos.find(l => l.loja_id === entry.loja_id && l.item_id === entry.item_id)
      if (lp) return modoSujo && lp.preco_sujo != null ? lp.preco_sujo : lp.preco
    }
    const p = meuPrecoMap[entry.item_id]
    if (!p) return null
    return modoSujo ? (p.preco_sujo ?? p.preco_limpo) : (p.preco_limpo ?? p.preco_sujo)
  }, [lojaPrecos, meuPrecoMap, modoSujo])

  const addServico = useCallback((servico: Servico) => {
    const itens = servicoItens.filter(si => si.servico_id === servico.id)
    if (itens.length === 0 && !servico.eh_meu_servico) { toast.info('Serviço sem itens configurados'); return }
    if (itens.length > 0) {
      setBatch(prev => {
        let next = [...prev]
        for (const si of itens) {
          const exists = next.find(b => b.item_id === si.item_id)
          if (exists) {
            next = next.map(b => b.item_id === si.item_id ? { ...b, quantidade: b.quantidade + si.quantidade } : b)
          } else {
            next.push({ item_id: si.item_id, quantidade: si.quantidade, loja_id: '' })
          }
        }
        return next
      })
    }
    setServicosSelecionados(prev => prev.some(s => s.id === servico.id) ? prev : [...prev, servico])
    toast.success(itens.length > 0
      ? `${itens.length} iten${itens.length !== 1 ? 's' : ''} do kit "${servico.nome}" adicionados`
      : `Kit "${servico.nome}" adicionado`)
  }, [servicoItens])

  const servicosFiltrados = useMemo(() => {
    let lista = servicos
    if (aba === 'meus') lista = lista.filter(s => s.eh_meu_servico || servicoItens.some(si => si.servico_id === s.id && meusItemIds.has(si.item_id)))
    if (busca.trim()) {
      const q = busca.toLowerCase()
      lista = lista.filter(s => s.nome.toLowerCase().includes(q) || s.descricao?.toLowerCase().includes(q))
    }
    return lista
  }, [servicos, busca, aba, servicoItens, meusItemIds])

  // ── Ingredientes agregados ────────────────────────────────────────────────

  const ingredientesAgregados = useMemo(() => {
    const map: Record<string, {
      ingrediente: Item | null
      totalQty: number
      totalPeso: number
      lojasDisponiveis: LojaPreco[]
    }> = {}
    for (const { item_id, quantidade } of batch) {
      const item = itemMap[item_id]
      if (!item?.item_receita?.length) continue
      for (const r of item.item_receita) {
        const qtd = r.quantidade * quantidade
        if (!map[r.ingrediente_id]) {
          map[r.ingrediente_id] = {
            ingrediente: itemMap[r.ingrediente_id] ?? null,
            totalQty: 0, totalPeso: 0,
            lojasDisponiveis: lojaPrecoPorItem[r.ingrediente_id] ?? [],
          }
        }
        map[r.ingrediente_id].totalQty += qtd
        map[r.ingrediente_id].totalPeso += (itemMap[r.ingrediente_id]?.peso ?? 0) * qtd
      }
    }
    return Object.entries(map)
      .map(([id, v]) => ({ ingrediente_id: id, ...v }))
      .sort((a, b) => (a.ingrediente?.nome ?? '').localeCompare(b.ingrediente?.nome ?? ''))
  }, [batch, itemMap, lojaPrecoPorItem])

  // ── Totais ────────────────────────────────────────────────────────────────

  const totais = useMemo(() => {
    let custoItens = 0, pesoProdutos = 0, custoItensCompleto = batch.length > 0
    for (const entry of batch) {
      const preco = getPrecoItem(entry)
      if (preco == null) custoItensCompleto = false
      else custoItens += preco * entry.quantidade
      pesoProdutos += (itemMap[entry.item_id]?.peso ?? 0) * entry.quantidade
    }

    let custoIng = 0, custoIngCompleto = ingredientesAgregados.length > 0
    for (const ing of ingredientesAgregados) {
      const lojaId = lojasPorIng[ing.ingrediente_id]
      const lp = lojaId ? ing.lojasDisponiveis.find(l => l.loja_id === lojaId) : null
      const precoUnit = lp ? (modoSujo && lp.preco_sujo != null ? lp.preco_sujo : lp.preco) : null
      if (precoUnit == null) custoIngCompleto = false
      else custoIng += precoUnit * ing.totalQty
    }

    return { custoItens, pesoProdutos, custoItensCompleto, custoIng, custoIngCompleto }
  }, [batch, getPrecoItem, itemMap, ingredientesAgregados, lojasPorIng, modoSujo])

  // ── Copiar texto ──────────────────────────────────────────────────────────

  const gerarLinhasResumo = useCallback(() => {
    const linhas: { text: string; indent?: boolean; bold?: boolean; dim?: boolean; color?: string }[] = []
    linhas.push({ text: 'CALCULADORA', bold: true })
    linhas.push({ text: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }), dim: true })
    linhas.push({ text: '' })

    for (const entry of batch) {
      const item = itemMap[entry.item_id]
      if (!item) continue
      const lojaNome = entry.loja_id ? (lojaMap[entry.loja_id]?.nome ?? '') : ''
      const preco = getPrecoItem(entry)
      const total = preco != null ? fmt(preco * entry.quantidade) : '—'
      const prefix = lojaNome ? `[${lojaNome}] ` : ''
      linhas.push({ text: `${prefix}${item.nome}  ×${entry.quantidade}  ${total}` })
    }

    linhas.push({ text: '' })
    if (totais.custoItens > 0) {
      linhas.push({ text: `TOTAL: ${fmt(totais.custoItens)}`, bold: true })
    }
    if (totais.pesoProdutos > 0) {
      linhas.push({ text: `Peso: ${fmtKg(totais.pesoProdutos)}`, dim: true })
    }

    if (modo === 'producao' && ingredientesAgregados.length > 0) {
      linhas.push({ text: '' })
      linhas.push({ text: '─── Ingredientes ───', dim: true })
      for (const ing of ingredientesAgregados) {
        const lojaId = lojasPorIng[ing.ingrediente_id]
        const lp = lojaId ? ing.lojasDisponiveis.find(l => l.loja_id === lojaId) : null
        const precoUnit = lp ? (modoSujo && lp.preco_sujo != null ? lp.preco_sujo : lp.preco) : null
        const custo = precoUnit != null ? `  ${fmt(precoUnit * ing.totalQty)}` : ''
        const peso = ing.totalPeso > 0 ? ` (${fmtKg(ing.totalPeso)})` : ''
        linhas.push({
          text: `${ing.ingrediente?.nome ?? ing.ingrediente_id}: ${fmtNum(ing.totalQty)}×${peso}${custo}`,
          indent: true,
        })
      }
      if (totais.custoIng > 0) {
        linhas.push({ text: '' })
        linhas.push({ text: `Custo ingredientes: ${fmt(totais.custoIng)}`, bold: true })
      }
    }

    return linhas
  }, [batch, itemMap, lojaMap, getPrecoItem, totais, modo, ingredientesAgregados, lojasPorIng, modoSujo])

  const copiarTexto = useCallback(() => {
    const linhas = gerarLinhasResumo()
    const texto = linhas.map(l => l.text).join('\n')
    navigator.clipboard.writeText(texto).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [gerarLinhasResumo])

  // ── Enviar para imgbb ─────────────────────────────────────────────────────

  const enviarImgbb = useCallback(async () => {
    if (batch.length === 0) return
    setImgbbLoading(true)
    try {
      const key = await getImgbbKey()
      if (!key) { toast.error('Chave imgbb não configurada', { description: 'Acesse Admin → Integrações para configurar.' }); return }
      const linhas = gerarLinhasResumo()
      const canvas = gerarCanvas(linhas)
      const base64 = canvas.toDataURL('image/png').split(',')[1]
      const url = await uploadImgbb(base64, key, 'calculadora')
      await navigator.clipboard.writeText(url)
      toast.success('URL copiada!')
    } catch (e: unknown) {
      toast.error('Erro ao enviar imagem', { description: e instanceof Error ? e.message : undefined })
    } finally {
      setImgbbLoading(false)
    }
  }, [batch.length, gerarLinhasResumo])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-[calc(100vh-3rem)] flex overflow-hidden">

      {/* ── Col 1: Lista de itens ── */}
      <aside className="w-72 shrink-0 flex flex-col border-r border-border">
        <div className="p-3 border-b border-border space-y-1.5">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Buscar item..." value={busca} onChange={e => setBusca(e.target.value)}
              className="pl-8 h-8 text-sm" />
          </div>
          {categoriasCalc.length > 0 && (
            <Select value={filterCategoria || '_todas'} onValueChange={v => setFilterCategoria(v === '_todas' ? '' : v)}>
              <SelectTrigger className="h-7 text-xs border-border/50"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_todas">Todas as categorias</SelectItem>
                {categoriasCalc.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex border-b border-border shrink-0">
          {([['favoritos', '★'], ['meus', 'Meus'], ['todos', 'Todos']] as [Aba, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setAba(key)}
              className={cn('flex-1 py-2 text-[11px] font-medium transition-colors border-b-2',
                aba === key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
              )}>{label}</button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          {/* Seção de serviços/kits */}
          {servicosFiltrados.length > 0 && (aba === 'todos' || aba === 'meus') && (
            <div className="border-b border-border">
              <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-white/[0.01]">
                <Layers className="h-3 w-3" />Kits / Serviços
              </div>
              {servicosFiltrados.map(s => {
                const preco = modoSujo ? (s.preco_sujo ?? s.preco_limpo) : s.preco_limpo
                const itensCount = servicoItens.filter(si => si.servico_id === s.id).length
                return (
                  <div key={s.id} className="flex items-center gap-1.5 px-3 py-2.5 border-b border-border/30 hover:bg-white/[0.02] transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium leading-tight truncate">{s.nome}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">{itensCount} item{itensCount !== 1 ? 's' : ''}</span>
                        {s.desconto_pct > 0 && <span className="text-[10px] text-green-400">-{s.desconto_pct}%</span>}
                        {preco != null && <span className={cn('text-[10px] tabular-nums', modoSujo ? 'text-orange-400/70' : 'text-emerald-400/70')}>{fmt(preco)}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => addServico(s)}
                      className="shrink-0 h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      title={`Adicionar kit ${s.nome}`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Itens */}
          {itensFiltrados.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8 px-4">
              {aba === 'favoritos' ? 'Nenhum favorito' : aba === 'meus' ? 'Nenhum item seu' : 'Nenhum item encontrado'}
            </p>
          ) : itensFiltrados.map(item => (
            <ItemBtn
              key={item.id} item={item}
              isInBatch={batchIds.has(item.id)}
              isFavorito={favoritos.has(item.id)}
              isMeu={meusItemIds.has(item.id)}
              precoLimpo={meuPrecoMap[item.id]?.preco_limpo ?? null}
              precoSujo={meuPrecoMap[item.id]?.preco_sujo ?? null}
              onAdd={addToBatch} onToggleFav={toggleFavorito}
              podeEditar={podeEditar}
            />
          ))}
        </div>
      </aside>

      {/* ── Col 2: Itens selecionados ── */}
      <div className="w-[460px] shrink-0 flex flex-col border-r border-border bg-muted/[0.03] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Selecionados{batch.length > 0 && <span className="text-foreground ml-1">({batch.length})</span>}
          </h3>
          {batch.length > 0 && (
            <button onClick={() => { setBatch([]); setLojasPorIng({}); setServicosSelecionados([]) }}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1">
              <X className="h-3 w-3" /> Limpar
            </button>
          )}
        </div>

        {batch.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
            <Package className="h-10 w-10 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">Adicione itens da lista</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto flex flex-col">
            <div className="flex-1 divide-y divide-border/40">
              {batch.map(entry => {
                const item = itemMap[entry.item_id]
                const lojasItem = lojaPrecoPorItem[entry.item_id] ?? []
                const preco = getPrecoItem(entry)
                const total = preco != null ? preco * entry.quantidade : null
                const peso = item?.peso != null ? item.peso * entry.quantidade : null

                return (
                  <div key={entry.item_id} className="flex items-center gap-2 px-3 py-2 border-b border-border/30">
                    {/* Loja */}
                    {lojasItem.length > 0 && (
                      <Select value={entry.loja_id || 'sem'} onValueChange={v => setLoja(entry.item_id, v)}>
                        <SelectTrigger className="h-7 text-[10px] border-border/50 px-1.5 w-[88px] shrink-0">
                          <SelectValue placeholder="— loja —" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sem">— sem —</SelectItem>
                          {lojasItem.map(l => (
                            <SelectItem key={l.loja_id} value={l.loja_id}>
                              {lojaMap[l.loja_id]?.nome ?? l.loja_id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {/* Nome */}
                    <span className="flex-1 min-w-0 text-sm font-medium truncate">{item?.nome ?? '—'}</span>
                    {/* Qtd */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button onClick={() => setQtd(entry.item_id, entry.quantidade - 1)}
                        className="h-6 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors">
                        <Minus className="h-2.5 w-2.5" />
                      </button>
                      <Input type="number" value={entry.quantidade}
                        onChange={e => setQtd(entry.item_id, Math.max(1, parseInt(e.target.value) || 1))}
                        className="h-6 w-10 text-center text-xs px-0.5" />
                      <button onClick={() => setQtd(entry.item_id, entry.quantidade + 1)}
                        className="h-6 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors">
                        <Plus className="h-2.5 w-2.5" />
                      </button>
                    </div>
                    {/* Preço total */}
                    <div className="flex items-center gap-1.5 shrink-0 min-w-[100px] justify-end">
                      {peso != null && peso > 0 && (
                        <span className="text-[10px] text-muted-foreground/50 tabular-nums">{fmtKg(peso)}</span>
                      )}
                      {total != null ? (
                        <span className={cn('tabular-nums font-semibold text-sm', modoSujo ? 'text-orange-400' : 'text-emerald-400')}>
                          {fmt(total)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/30 text-sm">—</span>
                      )}
                    </div>
                    {/* Remover */}
                    <button onClick={() => removeFromBatch(entry.item_id)}
                      className="shrink-0 h-5 w-5 rounded flex items-center justify-center text-muted-foreground/30 hover:text-destructive transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )
              })}
            </div>

            <div className="px-3 py-3 border-t border-border/60 bg-muted/[0.04] shrink-0 space-y-1">
              {totais.custoItens > 0 ? (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className={cn('font-bold tabular-nums', modoSujo ? 'text-orange-400' : 'text-emerald-400')}>
                    {fmt(totais.custoItens)}
                    {!totais.custoItensCompleto && <span className="text-[10px] font-normal text-muted-foreground ml-1">*parcial</span>}
                  </span>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground/40 text-center">sem preços cadastrados</div>
              )}
              {totais.pesoProdutos > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Peso total</span>
                  <span className="tabular-nums">{fmtKg(totais.pesoProdutos)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Col 3: Resumo ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0 gap-3">
          <div className="flex bg-muted/40 rounded-md p-0.5 gap-0.5">
            {(['simples', 'producao'] as Modo[]).map(m => (
              <button key={m} onClick={() => setModo(m)}
                className={cn(
                  'px-3 py-1 rounded text-xs font-medium transition-colors',
                  modo === m ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}>
                {m === 'simples' ? 'Simples' : 'Produção'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Label className="text-[11px] text-muted-foreground">Sujo</Label>
              <Switch checked={modoSujo} onCheckedChange={setModoSujo} />
            </div>

            {batch.length > 0 && (
              <>
                <button onClick={copiarTexto}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-1.5 py-1 rounded hover:bg-white/[0.06]">
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>

                <button
                  onClick={enviarImgbb}
                  disabled={imgbbLoading}
                  title="Gerar imagem e enviar para imgbb (copia URL)"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-1.5 py-1 rounded hover:bg-white/[0.06] disabled:opacity-40">
                  {imgbbLoading ? <span className="text-[10px]">...</span> : <Image className="h-3.5 w-3.5" />}
                </button>
              </>
            )}
          </div>
        </div>


        {batch.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-muted-foreground text-center px-4">Adicione itens para ver o resumo</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-5">

            {/* Itens */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2.5">Itens</p>
              <div className="space-y-2">
                {batch.map(entry => {
                  const item = itemMap[entry.item_id]
                  const lojaNome = entry.loja_id ? (lojaMap[entry.loja_id]?.nome ?? '') : ''
                  const preco = getPrecoItem(entry)
                  const total = preco != null ? preco * entry.quantidade : null
                  const pesoItem = item?.peso != null ? item.peso * entry.quantidade : null

                  return (
                    <div key={entry.item_id} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        {lojaNome && (
                          <span className="text-[10px] text-muted-foreground shrink-0 bg-muted/50 px-1.5 py-0.5 rounded font-medium">
                            {lojaNome}
                          </span>
                        )}
                        <span className="text-sm font-medium truncate">{item?.nome ?? '—'}</span>
                        <span className="text-xs text-muted-foreground shrink-0">×{entry.quantidade}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {pesoItem != null && pesoItem > 0 && (
                          <span className="text-[10px] text-muted-foreground/60 tabular-nums">{fmtKg(pesoItem)}</span>
                        )}
                        {total != null ? (
                          <span className={cn('text-sm tabular-nums font-semibold', modoSujo ? 'text-orange-400' : 'text-emerald-400')}>
                            {fmt(total)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/30 text-sm">—</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Totais itens */}
            <div className="pt-3 border-t border-border/60 space-y-1.5">
              {totais.custoItens > 0 && (
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-muted-foreground">Total</span>
                  <span className={cn('tabular-nums', modoSujo ? 'text-orange-400' : 'text-emerald-400')}>
                    {fmt(totais.custoItens)}
                    {!totais.custoItensCompleto && <span className="text-[10px] font-normal text-muted-foreground ml-1">*parcial</span>}
                  </span>
                </div>
              )}
              {totais.pesoProdutos > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Peso total</span>
                  <span className="tabular-nums">{fmtKg(totais.pesoProdutos)}</span>
                </div>
              )}
            </div>

            {/* Ingredientes — modo produção */}
            {modo === 'producao' && ingredientesAgregados.length > 0 && (
              <div className="pt-3 border-t border-border/60">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2.5">
                  Ingredientes necessários
                </p>
                <div className="space-y-1">
                  {ingredientesAgregados.map(ing => {
                    const lojaId = lojasPorIng[ing.ingrediente_id]
                    const lp = lojaId ? ing.lojasDisponiveis.find(l => l.loja_id === lojaId) : null
                    const precoUnit = lp ? (modoSujo && lp.preco_sujo != null ? lp.preco_sujo : lp.preco) : null
                    const subtotal = precoUnit != null ? precoUnit * ing.totalQty : null

                    return (
                      <div key={ing.ingrediente_id} className="flex items-center gap-1.5 text-xs min-w-0">
                        {/* Nome + qtd + peso */}
                        <div className="flex items-center gap-1 min-w-0 flex-1">
                          <span className="text-foreground/80 truncate">{ing.ingrediente?.nome ?? ing.ingrediente_id}</span>
                          <span className="text-muted-foreground shrink-0">{fmtNum(ing.totalQty)}×</span>
                          {ing.totalPeso > 0 && (
                            <span className="text-muted-foreground/50 shrink-0">{fmtKg(ing.totalPeso)}</span>
                          )}
                        </div>
                        {/* Loja inline — depois do nome */}
                        {ing.lojasDisponiveis.length > 0 && (
                          <Select
                            value={lojasPorIng[ing.ingrediente_id] ?? 'sem'}
                            onValueChange={v => setLojasPorIng(prev => ({ ...prev, [ing.ingrediente_id]: v === 'sem' ? '' : v }))}
                          >
                            <SelectTrigger className="h-6 text-[10px] border-border/50 px-1.5 shrink-0 w-[72px]">
                              <SelectValue placeholder="loja" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sem">— sem —</SelectItem>
                              {ing.lojasDisponiveis.map(l => {
                                const p = modoSujo && l.preco_sujo != null ? l.preco_sujo : l.preco
                                return (
                                  <SelectItem key={l.loja_id} value={l.loja_id}>
                                    {lojaMap[l.loja_id]?.nome ?? l.loja_id} ({fmt(p)})
                                  </SelectItem>
                                )
                              })}
                            </SelectContent>
                          </Select>
                        )}
                        {/* Custo */}
                        <span className={cn('tabular-nums shrink-0', subtotal != null ? 'text-foreground/70' : 'text-muted-foreground/30')}>
                          {subtotal != null ? fmt(subtotal) : '—'}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Total ingredientes */}
                {totais.custoIng > 0 && (
                  <div className="mt-3 pt-2 border-t border-border/40 flex justify-between text-xs font-semibold">
                    <span className="text-muted-foreground">Custo ingredientes</span>
                    <span className={cn('tabular-nums', modoSujo ? 'text-orange-400' : 'text-emerald-400')}>
                      {fmt(totais.custoIng)}
                      {!totais.custoIngCompleto && <span className="text-[10px] font-normal text-muted-foreground ml-1">*parcial</span>}
                    </span>
                  </div>
                )}
              </div>
            )}

            {modo === 'producao' && ingredientesAgregados.length === 0 && (
              <div className="pt-3 border-t border-border/60">
                <p className="text-xs text-muted-foreground">Nenhum item selecionado tem receita cadastrada.</p>
              </div>
            )}

            {/* Comparativo de kits */}
            {servicosSelecionados.length > 0 && (
              <div className="pt-3 border-t border-border/60">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2.5">Kits selecionados</p>
                <div className="space-y-3">
                  {servicosSelecionados.map(servico => {
                    const itensKit = servicoItens.filter(si => si.servico_id === servico.id)
                    let somaItens = 0; let completo = itensKit.length > 0
                    for (const si of itensKit) {
                      const batchEntry = batch.find(b => b.item_id === si.item_id)
                      if (!batchEntry) { completo = false; continue }
                      const preco = getPrecoItem(batchEntry)
                      if (preco == null) { completo = false; continue }
                      somaItens += preco * si.quantidade
                    }
                    const kitPreco = modoSujo ? (servico.preco_sujo ?? servico.preco_limpo) : (servico.preco_limpo ?? servico.preco_sujo)
                    const diferenca = kitPreco != null && completo && somaItens > 0 ? kitPreco - somaItens : null
                    const pct = diferenca != null && somaItens > 0 ? (diferenca / somaItens * 100) : null
                    return (
                      <div key={servico.id} className="space-y-1 text-xs">
                        <div className="flex items-center gap-1 font-semibold text-foreground/80">
                          <Layers className="h-3 w-3 shrink-0" />
                          <span className="truncate">{servico.nome}</span>
                          <button onClick={() => setServicosSelecionados(prev => prev.filter(s => s.id !== servico.id))}
                            className="ml-auto shrink-0 text-muted-foreground/40 hover:text-destructive transition-colors">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                        {itensKit.length > 0 && completo && (
                          <div className="flex justify-between text-muted-foreground">
                            <span>Soma dos itens</span>
                            <span className="tabular-nums">{fmt(somaItens)}</span>
                          </div>
                        )}
                        {kitPreco != null && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Preço do kit</span>
                            <span className={cn('tabular-nums font-semibold', modoSujo ? 'text-orange-400' : 'text-emerald-400')}>{fmt(kitPreco)}</span>
                          </div>
                        )}
                        {diferenca != null && pct != null && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{diferenca < 0 ? 'Desconto' : 'Acréscimo'}</span>
                            <span className={cn('tabular-nums font-semibold', diferenca < 0 ? 'text-green-400' : 'text-red-400')}>
                              {diferenca < 0 ? '-' : '+'}{fmt(Math.abs(diferenca))} ({Math.abs(pct).toFixed(1)}%)
                            </span>
                          </div>
                        )}
                        {itensKit.length === 0 && (
                          <p className="text-muted-foreground/50 italic">Serviço sem itens</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState, useMemo, useCallback, useRef, memo, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Search, Star, Package, Plus, X, Minus, Copy, Check, Image, Layers, SlidersHorizontal, ChevronDown } from 'lucide-react'
import { getImgbbKey, uploadImgbb } from '@/lib/imgbb'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ── Config de fonte ───────────────────────────────────────────────────────────

const CALC_FONTE_KEY = 'calculadora-fonte'

type FonteConfig = {
  tamanho: number           // 11–20 (col 1: lista)
  tamanhoSelecionados: number // 11–20 (col 2: selecionados)
  negrito: boolean
  corNome: string           // '' = padrão do tema
  corValor: string          // '' = usa verde/laranja padrão
  mostrarLojas: boolean     // exibir select de loja nos selecionados
}

const FONTE_PADRAO: FonteConfig = { tamanho: 13, tamanhoSelecionados: 13, negrito: false, corNome: '', corValor: '', mostrarLojas: true }

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Item = {
  id: string
  nome: string
  tem_craft: boolean
  eh_meu_produto: boolean
  meu_produto_usuario_id: string | null
  peso: number | null
  apelidos: string | null
  categorias_item: { nome: string } | null
  item_receita: { ingrediente_id: string; quantidade: number }[]
}

type Loja = { id: string; nome: string }
type LojaPreco = { loja_id: string; item_id: string; preco: number; preco_sujo: number | null }
type FaccaoPreco = { faccao_id: string; item_id: string; preco_limpo: number | null; preco_sujo: number | null }
type PrecoVigente = { item_id: string; preco_sujo: number | null; preco_limpo: number | null }
type Servico = { id: string; nome: string; descricao: string | null; preco_sujo: number | null; preco_limpo: number | null; desconto_pct: number; eh_meu_servico: boolean; categoria: string | null }
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
  favoritosServicosIniciais: string[]
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

function matchBusca(texto: string, apelidos: string | null | undefined, q: string): boolean {
  if (texto.toLowerCase().includes(q)) return true
  if (apelidos) {
    return apelidos.toLowerCase().split(',').some(a => a.trim().includes(q))
  }
  return false
}

// ── Item compacto (linha única) ───────────────────────────────────────────────

const ItemBtn = memo(function ItemBtn({ item, isInBatch, isFavorito, precoLimpo, precoSujo, onAdd, onToggleFav, podeEditar, fonte }: {
  item: Item
  isInBatch: boolean
  isFavorito: boolean
  precoLimpo: number | null
  precoSujo: number | null
  onAdd: (id: string) => void
  onToggleFav: (id: string, e: React.MouseEvent) => void
  podeEditar: boolean
  fonte: FonteConfig
}) {
  const preco = precoLimpo ?? precoSujo
  const isSujoOnly = precoLimpo == null && precoSujo != null
  const nomeStyle = {
    fontSize: `${fonte.tamanho}px`,
    fontWeight: fonte.negrito ? 600 : 500,
    ...(fonte.corNome ? { color: fonte.corNome } : {}),
  }
  const valorColor = fonte.corValor || (isSujoOnly ? '#fb923c' : '#34d399')
  return (
    <div className={cn(
      'group flex items-center gap-1.5 px-3 py-1.5 border-b border-border/30 transition-colors hover:bg-white/[0.015]',
      isInBatch && 'bg-primary/[0.06]'
    )}>
      <button
        onMouseDown={e => e.preventDefault()}
        onClick={e => podeEditar && onToggleFav(item.id, e)}
        disabled={!podeEditar}
        className={cn('shrink-0 p-0.5 rounded transition-colors',
          isFavorito ? 'text-yellow-400' : 'text-muted-foreground/25 hover:text-yellow-400',
          !podeEditar && 'opacity-0 pointer-events-none'
        )}>
        <Star className="h-3 w-3" fill={isFavorito ? 'currentColor' : 'none'} />
      </button>

      <span className="flex-1 min-w-0 truncate" style={nomeStyle}>{item.nome}</span>

      {item.apelidos && (
        <span className="text-[9px] text-primary/30 shrink-0" title={`Apelidos: ${item.apelidos}`}>✦</span>
      )}
      {preco != null && (
        <span className="text-xs tabular-nums shrink-0" style={{ color: valorColor, opacity: 0.75 }}>
          {fmt(preco)}
        </span>
      )}

      <button
        onClick={() => onAdd(item.id)}
        disabled={isInBatch}
        className={cn(
          'shrink-0 h-5 w-5 rounded flex items-center justify-center transition-colors',
          isInBatch
            ? 'text-primary/30 cursor-default'
            : 'text-muted-foreground hover:text-primary hover:bg-primary/10'
        )}>
        <Plus className="h-3 w-3" />
      </button>
    </div>
  )
})

// ── Combo / Kit (linha única, mesmo padrão do item) ──────────────────────────

const ComboBtn = memo(function ComboBtn({ servico, isFavorito, modoSujo, itensCount, onAdd, onToggleFav, podeEditar, fonte }: {
  servico: Servico
  isFavorito: boolean
  modoSujo: boolean
  itensCount: number
  onAdd: (s: Servico) => void
  onToggleFav: (id: string, e: React.MouseEvent) => void
  podeEditar: boolean
  fonte: FonteConfig
}) {
  const preco = modoSujo ? (servico.preco_sujo ?? servico.preco_limpo) : servico.preco_limpo
  const nomeStyle = {
    fontSize: `${fonte.tamanho}px`,
    fontWeight: fonte.negrito ? 600 : 500,
    ...(fonte.corNome ? { color: fonte.corNome } : {}),
  }
  const valorColor = fonte.corValor || (modoSujo ? '#fb923c' : '#34d399')
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border/30 transition-colors hover:bg-white/[0.015]">
      <button
        onMouseDown={e => e.preventDefault()}
        onClick={e => podeEditar && onToggleFav(servico.id, e)}
        disabled={!podeEditar}
        className={cn('shrink-0 p-0.5 rounded transition-colors',
          isFavorito ? 'text-yellow-400' : 'text-muted-foreground/25 hover:text-yellow-400',
          !podeEditar && 'opacity-0 pointer-events-none'
        )}>
        <Star className="h-3 w-3" fill={isFavorito ? 'currentColor' : 'none'} />
      </button>
      <Layers className="h-3 w-3 shrink-0 text-muted-foreground/30" />
      <span className="flex-1 min-w-0 truncate" style={nomeStyle}>{servico.nome}</span>
      {servico.desconto_pct > 0 && (
        <span className="text-[10px] text-green-400/80 shrink-0">-{servico.desconto_pct}%</span>
      )}
      {preco != null && (
        <span className="text-xs tabular-nums shrink-0" style={{ color: valorColor, opacity: 0.75 }}>
          {fmt(preco)}
        </span>
      )}
      <button
        onClick={() => onAdd(servico)}
        title={itensCount > 0 ? `Adicionar ${itensCount} iten${itensCount !== 1 ? 's' : ''}` : 'Adicionar combo'}
        className="shrink-0 h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
        <Plus className="h-3 w-3" />
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

  ctx.fillStyle = '#0d0d14'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#6366f1'
  ctx.fillRect(0, 0, 3, H)

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
  meuLojaId, meuFaccaoId, favoritosIniciais, favoritosServicosIniciais,
  podeEditar = true, servicos, servicoItens,
}: Props) {
  const sbRef = useRef<ReturnType<typeof createClient> | null>(null)
  const sb = useCallback(() => { if (!sbRef.current) sbRef.current = createClient(); return sbRef.current }, [])

  const [busca, setBusca] = useState('')
  const [aba, setAba] = useState<Aba>('meus')
  const [filterCategoria, setFilterCategoria] = useState('')
  const [filterLoja, setFilterLoja] = useState('')
  const [batch, setBatch] = useState<BatchEntry[]>([])
  const [favoritos, setFavoritos] = useState<Set<string>>(new Set(favoritosIniciais))
  const [favoritosServicos, setFavoritosServicos] = useState<Set<string>>(new Set(favoritosServicosIniciais))
  const [lojasPorIng, setLojasPorIng] = useState<Record<string, string>>({})
  const [servicosSelecionados, setServicosSelecionados] = useState<Servico[]>([])
  const [modoSujo, setModoSujo] = useState(false)
  const [modo, setModo] = useState<Modo>('simples')
  const [copied, setCopied] = useState(false)
  const [imgbbLoading, setImgbbLoading] = useState(false)
  const [fonte, setFonte] = useState<FonteConfig>(FONTE_PADRAO)
  const [fonteModalAberto, setFonteModalAberto] = useState(false)
  const [ingExpandido, setIngExpandido] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CALC_FONTE_KEY)
      if (saved) setFonte({ ...FONTE_PADRAO, ...JSON.parse(saved) })
    } catch { /* ignore */ }
  }, [])

  function salvarFonte(nova: FonteConfig) {
    setFonte(nova)
    localStorage.setItem(CALC_FONTE_KEY, JSON.stringify(nova))
  }

  const favoritosRef = useRef(favoritos)
  favoritosRef.current = favoritos
  const favoritosServicosRef = useRef(favoritosServicos)
  favoritosServicosRef.current = favoritosServicos

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

  const lojasComPrecos = useMemo(() => {
    const ids = new Set(lojaPrecos.map(lp => lp.loja_id))
    return lojas.filter(l => ids.has(l.id))
  }, [lojas, lojaPrecos])

  // Categorias presentes na aba atual (sem filtro de categoria, mas com filtro de aba/loja)
  const categoriasNaAba = useMemo(() => {
    let lista = items
    if (aba === 'favoritos') lista = lista.filter(i => favoritos.has(i.id))
    if (aba === 'meus') lista = lista.filter(i => meusItemIds.has(i.id))
    if (filterLoja === '_faccao') lista = lista.filter(i => faccaoPrecos.some(fp => fp.item_id === i.id))
    else if (filterLoja) lista = lista.filter(i => lojaPrecoPorItem[i.id]?.some(lp => lp.loja_id === filterLoja))
    const cats = new Set<string>()
    lista.forEach(i => { if (i.categorias_item?.nome) cats.add(i.categorias_item.nome) })
    // Incluir categorias de serviços da aba atual
    if (!filterLoja) {
      let servLista = servicos
      if (aba === 'favoritos') servLista = servLista.filter(s => favoritosServicos.has(s.id))
      if (aba === 'meus') servLista = servLista.filter(s => s.eh_meu_servico || servicoItens.some(si => si.servico_id === s.id && meusItemIds.has(si.item_id)))
      servLista.forEach(s => { if (s.categoria) cats.add(s.categoria) })
    }
    return Array.from(cats).sort()
  }, [items, aba, favoritos, meusItemIds, filterLoja, faccaoPrecos, lojaPrecoPorItem, servicos, favoritosServicos, servicoItens])

  // Limpa filtro de categoria quando troca de aba e a categoria não existe mais
  useEffect(() => {
    if (filterCategoria && !categoriasNaAba.includes(filterCategoria)) {
      setFilterCategoria('')
    }
  }, [aba]) // eslint-disable-line react-hooks/exhaustive-deps

  const itensFiltrados = useMemo(() => {
    let lista = items
    if (aba === 'favoritos') lista = lista.filter(i => favoritos.has(i.id))
    if (aba === 'meus') lista = lista.filter(i => meusItemIds.has(i.id))
    if (filterCategoria) lista = lista.filter(i => i.categorias_item?.nome === filterCategoria)
    if (filterLoja === '_faccao') {
      lista = lista.filter(i => faccaoPrecos.some(fp => fp.item_id === i.id))
    } else if (filterLoja) {
      lista = lista.filter(i => lojaPrecoPorItem[i.id]?.some(lp => lp.loja_id === filterLoja))
    }
    if (busca.trim()) {
      const q = busca.toLowerCase()
      lista = lista.filter(i => matchBusca(i.nome, i.apelidos, q))
    }
    return lista
  }, [items, aba, favoritos, busca, meusItemIds, filterCategoria, filterLoja, lojaPrecoPorItem, faccaoPrecos])

  const batchIds = useMemo(() => new Set(batch.map(b => b.item_id)), [batch])

  const servicosFiltrados = useMemo(() => {
    if (filterLoja) return []  // combos não têm loja; ocultar quando filtro de loja ativo
    let lista = servicos
    if (aba === 'favoritos') lista = lista.filter(s => favoritosServicos.has(s.id))
    if (aba === 'meus') lista = lista.filter(s => s.eh_meu_servico || servicoItens.some(si => si.servico_id === s.id && meusItemIds.has(si.item_id)))
    if (filterCategoria) lista = lista.filter(s => s.categoria === filterCategoria)
    if (busca.trim()) {
      const q = busca.toLowerCase()
      lista = lista.filter(s => s.nome.toLowerCase().includes(q) || s.descricao?.toLowerCase().includes(q))
    }
    return lista
  }, [servicos, busca, aba, servicoItens, meusItemIds, favoritosServicos, filterLoja, filterCategoria])

  // Lista unificada de itens + combos, ordenada (favoritos primeiro, depois alfabético)
  const listaUnificada = useMemo(() => {
    type Entry =
      | { tipo: 'item'; id: string; nome: string; isFav: boolean; data: Item }
      | { tipo: 'servico'; id: string; nome: string; isFav: boolean; data: Servico }
    const itens: Entry[] = itensFiltrados.map(i => ({ tipo: 'item' as const, id: i.id, nome: i.nome, isFav: favoritos.has(i.id), data: i }))
    const servs: Entry[] = servicosFiltrados.map(s => ({ tipo: 'servico' as const, id: s.id, nome: s.nome, isFav: favoritosServicos.has(s.id), data: s }))
    return [...itens, ...servs].sort((a, b) => {
      const af = a.isFav ? 0 : 1
      const bf = b.isFav ? 0 : 1
      if (af !== bf) return af - bf
      return a.nome.localeCompare(b.nome)
    })
  }, [itensFiltrados, servicosFiltrados, favoritos, favoritosServicos])

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

  const toggleFavoritoServico = useCallback(async (servicoId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const tinha = favoritosServicosRef.current.has(servicoId)
    setFavoritosServicos(prev => { const n = new Set(prev); tinha ? n.delete(servicoId) : n.add(servicoId); return n })
    if (tinha) {
      const { error } = await sb().from('usuario_favoritos_servicos').delete().eq('usuario_id', userId).eq('servico_id', servicoId)
      if (error) { toast.error('Erro ao remover favorito'); setFavoritosServicos(prev => { const n = new Set(prev); n.add(servicoId); return n }) }
    } else {
      const { error } = await sb().from('usuario_favoritos_servicos').insert({ usuario_id: userId, servico_id: servicoId })
      if (error) { toast.error('Erro ao favoritar'); setFavoritosServicos(prev => { const n = new Set(prev); n.delete(servicoId); return n }) }
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

  // ── Copiar / Imagem ───────────────────────────────────────────────────────

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

  const temFiltroAtivo = filterCategoria !== '' || filterLoja !== ''

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-[calc(100vh-3rem)] flex overflow-hidden">

      {/* ── Col 1: Lista de itens ── */}
      <aside className="w-[35%] shrink-0 flex flex-col border-r border-border">

        {/* Filtros */}
        <div className="p-2.5 border-b border-border space-y-2">
          {/* Busca */}
          <div className="flex gap-1.5">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Buscar por nome ou apelido..." value={busca} onChange={e => setBusca(e.target.value)}
                className="pl-8 h-8 text-sm" />
            </div>
            <button
              onClick={() => setFonteModalAberto(true)}
              title="Configurar fonte"
              className="shrink-0 h-8 w-8 rounded border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border transition-colors">
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Chips de categoria — apenas as que têm itens na aba atual */}
          {categoriasNaAba.length > 0 && (
            <div className="flex gap-1 overflow-x-auto scrollbar-none pb-0.5">
              <button
                onClick={() => setFilterCategoria('')}
                className={cn('shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors',
                  filterCategoria === ''
                    ? 'bg-primary/15 border-primary/40 text-primary'
                    : 'border-border/50 text-muted-foreground hover:border-border hover:text-foreground'
                )}>Todas</button>
              {categoriasNaAba.map(c => (
                <button key={c}
                  onClick={() => setFilterCategoria(c === filterCategoria ? '' : c)}
                  className={cn('shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors',
                    filterCategoria === c
                      ? 'bg-primary/15 border-primary/40 text-primary'
                      : 'border-border/50 text-muted-foreground hover:border-border hover:text-foreground'
                  )}>{c}</button>
              ))}
            </div>
          )}

          {/* Filtro loja / facção */}
          <div className="flex items-center gap-1.5">
            <Select value={filterLoja || '_todas'} onValueChange={v => setFilterLoja(v === '_todas' ? '' : v)}>
              <SelectTrigger className="h-7 text-xs border-border/50 flex-1"><SelectValue placeholder="Loja / Facção" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_todas">Todas as origens</SelectItem>
                {meuFaccaoId && <SelectItem value="_faccao">Minha facção</SelectItem>}
                {lojasComPrecos.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            {temFiltroAtivo && (
              <button
                onClick={() => { setFilterCategoria(''); setFilterLoja('') }}
                title="Limpar filtros"
                className="shrink-0 h-7 px-2 rounded border border-border/50 text-[10px] text-muted-foreground hover:text-foreground hover:border-border transition-colors flex items-center gap-0.5">
                <X className="h-3 w-3" /> Limpar
              </button>
            )}
          </div>
        </div>

        {/* Abas */}
        <div className="flex border-b border-border shrink-0">
          {([['favoritos', '★ Favoritos'], ['meus', 'Meus'], ['todos', 'Todos']] as [Aba, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setAba(key)}
              className={cn('flex-1 py-1.5 text-[11px] font-medium transition-colors border-b-2',
                aba === key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
              )}>{label}</button>
          ))}
        </div>

        {/* Lista unificada: itens + combos misturados, ordenados */}
        <div className="flex-1 overflow-y-auto">
          {listaUnificada.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8 px-4">
              {aba === 'favoritos' ? 'Nenhum favorito' : aba === 'meus' ? 'Nenhum item seu' : 'Nenhum item encontrado'}
            </p>
          ) : listaUnificada.map(entry => {
            if (entry.tipo === 'servico') {
              const itensCount = servicoItens.filter(si => si.servico_id === entry.id).length
              return (
                <ComboBtn
                  key={entry.id}
                  servico={entry.data}
                  isFavorito={entry.isFav}
                  modoSujo={modoSujo}
                  itensCount={itensCount}
                  onAdd={addServico}
                  onToggleFav={toggleFavoritoServico}
                  podeEditar={podeEditar}
                  fonte={fonte}
                />
              )
            }
            return (
              <ItemBtn
                key={entry.id}
                item={entry.data}
                isInBatch={batchIds.has(entry.id)}
                isFavorito={entry.isFav}
                precoLimpo={meuPrecoMap[entry.id]?.preco_limpo ?? null}
                precoSujo={meuPrecoMap[entry.id]?.preco_sujo ?? null}
                onAdd={addToBatch}
                onToggleFav={toggleFavorito}
                podeEditar={podeEditar}
                fonte={fonte}
              />
            )
          })}
        </div>
      </aside>

      {/* ── Col 2: Orçamento ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground shrink-0">
              Orçamento{batch.length > 0 && <span className="text-foreground ml-1">({batch.length})</span>}
            </h3>
            <div className="flex bg-muted/40 rounded-md p-0.5 gap-0.5 shrink-0">
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
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {batch.length > 0 && (
              <button onClick={() => { setBatch([]); setLojasPorIng({}); setServicosSelecionados([]) }}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1">
                <X className="h-3 w-3" /> Limpar
              </button>
            )}
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
                <button onClick={enviarImgbb} disabled={imgbbLoading}
                  title="Gerar imagem e enviar para imgbb (copia URL)"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-1.5 py-1 rounded hover:bg-white/[0.06] disabled:opacity-40">
                  {imgbbLoading ? <span className="text-[10px]">...</span> : <Image className="h-3.5 w-3.5" />}
                </button>
              </>
            )}
          </div>
        </div>

        {batch.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
            <Package className="h-10 w-10 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">Adicione itens da lista</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto flex flex-col">

            {/* Itens editáveis */}
            <div className="flex-1">
              {batch.map(entry => {
                const item = itemMap[entry.item_id]
                const lojasItem = lojaPrecoPorItem[entry.item_id] ?? []
                const preco = getPrecoItem(entry)
                const total = preco != null ? preco * entry.quantidade : null
                const peso = item?.peso != null ? item.peso * entry.quantidade : null

                return (
                  <div key={entry.item_id} className="flex items-center gap-2 px-4 py-2.5 border-b border-border/30 hover:bg-white/[0.01]">
                    {fonte.mostrarLojas && lojasItem.length > 0 && (
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
                    <span className="flex-1 min-w-0 truncate" style={{
                      fontSize: `${fonte.tamanhoSelecionados}px`,
                      fontWeight: fonte.negrito ? 600 : 500,
                      ...(fonte.corNome ? { color: fonte.corNome } : {}),
                    }}>{item?.nome ?? '—'}</span>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button onClick={() => setQtd(entry.item_id, entry.quantidade - 1)}
                        className="h-7 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors">
                        <Minus className="h-3 w-3" />
                      </button>
                      <Input type="number" value={entry.quantidade}
                        onChange={e => setQtd(entry.item_id, Math.max(1, parseInt(e.target.value) || 1))}
                        className="h-7 w-16 text-center text-sm px-0.5" />
                      <button onClick={() => setQtd(entry.item_id, entry.quantidade + 1)}
                        className="h-7 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors">
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 min-w-[120px] justify-end">
                      {peso != null && peso > 0 && (
                        <span className="text-[10px] text-muted-foreground/50 tabular-nums">{fmtKg(peso)}</span>
                      )}
                      {total != null ? (
                        <span className="tabular-nums font-semibold" style={{
                          fontSize: `${fonte.tamanhoSelecionados}px`,
                          color: fonte.corValor || (modoSujo ? '#fb923c' : '#34d399'),
                        }}>{fmt(total)}</span>
                      ) : (
                        <span className="text-muted-foreground/30 text-sm">—</span>
                      )}
                    </div>
                    <button onClick={() => removeFromBatch(entry.item_id)}
                      className="shrink-0 h-5 w-5 rounded flex items-center justify-center text-muted-foreground/30 hover:text-destructive transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Totais */}
            <div className="px-4 py-3 border-t border-border/60 bg-muted/[0.04] shrink-0 space-y-1">
              {totais.custoItens > 0 ? (
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-muted-foreground">Total</span>
                  <span className={cn('tabular-nums', modoSujo ? 'text-orange-400' : 'text-emerald-400')}>
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

            {/* Kits selecionados */}
            {servicosSelecionados.length > 0 && (
              <div className="px-4 py-3 border-t border-border/60 space-y-3 shrink-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Kits selecionados</p>
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
                          <span>Soma dos itens</span><span className="tabular-nums">{fmt(somaItens)}</span>
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
                      {itensKit.length === 0 && <p className="text-muted-foreground/50 italic">Serviço sem itens</p>}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Ingredientes colapsáveis — modo produção */}
            {modo === 'producao' && (
              <div className="border-t border-border/60 shrink-0">
                <button
                  onClick={() => setIngExpandido(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors">
                  <span>
                    Ingredientes necessários
                    {ingredientesAgregados.length > 0 && <span className="ml-1 normal-case font-normal">({ingredientesAgregados.length})</span>}
                  </span>
                  <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', ingExpandido && 'rotate-180')} />
                </button>

                {ingExpandido && (
                  <div className="px-4 pb-4 space-y-1">
                    {ingredientesAgregados.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhum item tem receita cadastrada.</p>
                    ) : (
                      <>
                        {ingredientesAgregados.map(ing => {
                          const lojaId = lojasPorIng[ing.ingrediente_id]
                          const lp = lojaId ? ing.lojasDisponiveis.find(l => l.loja_id === lojaId) : null
                          const precoUnit = lp ? (modoSujo && lp.preco_sujo != null ? lp.preco_sujo : lp.preco) : null
                          const subtotal = precoUnit != null ? precoUnit * ing.totalQty : null
                          return (
                            <div key={ing.ingrediente_id} className="flex items-center gap-1.5 text-xs min-w-0">
                              <div className="flex items-center gap-1 min-w-0 flex-1">
                                <span className="text-foreground/80 truncate">{ing.ingrediente?.nome ?? ing.ingrediente_id}</span>
                                <span className="text-muted-foreground shrink-0">{fmtNum(ing.totalQty)}×</span>
                                {ing.totalPeso > 0 && (
                                  <span className="text-muted-foreground/50 shrink-0">{fmtKg(ing.totalPeso)}</span>
                                )}
                              </div>
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
                              <span className={cn('tabular-nums shrink-0', subtotal != null ? 'text-foreground/70' : 'text-muted-foreground/30')}>
                                {subtotal != null ? fmt(subtotal) : '—'}
                              </span>
                            </div>
                          )
                        })}
                        {totais.custoIng > 0 && (
                          <div className="mt-2 pt-2 border-t border-border/40 flex justify-between text-xs font-semibold">
                            <span className="text-muted-foreground">Custo ingredientes</span>
                            <span className={cn('tabular-nums', modoSujo ? 'text-orange-400' : 'text-emerald-400')}>
                              {fmt(totais.custoIng)}
                              {!totais.custoIngCompleto && <span className="text-[10px] font-normal text-muted-foreground ml-1">*parcial</span>}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </div>

      {/* ── Modal de configuração de fonte ── */}
      <Dialog open={fonteModalAberto} onOpenChange={setFonteModalAberto}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-sm">Configurar exibição</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">

            {/* Tamanho — Lista */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Letra — Lista</Label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => salvarFonte({ ...fonte, tamanho: Math.max(10, fonte.tamanho - 1) })}
                  className="h-7 w-7 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors">
                  <Minus className="h-3 w-3" />
                </button>
                <span className="text-sm tabular-nums w-12 text-center">{fonte.tamanho}px</span>
                <button
                  onClick={() => salvarFonte({ ...fonte, tamanho: Math.min(20, fonte.tamanho + 1) })}
                  className="h-7 w-7 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors">
                  <Plus className="h-3 w-3" />
                </button>
                <span className="ml-2 truncate" style={{ fontSize: `${fonte.tamanho}px`, fontWeight: fonte.negrito ? 600 : 400 }}>
                  Preview
                </span>
              </div>
            </div>

            {/* Tamanho — Orçamento */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Letra — Orçamento</Label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => salvarFonte({ ...fonte, tamanhoSelecionados: Math.max(10, fonte.tamanhoSelecionados - 1) })}
                  className="h-7 w-7 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors">
                  <Minus className="h-3 w-3" />
                </button>
                <span className="text-sm tabular-nums w-12 text-center">{fonte.tamanhoSelecionados}px</span>
                <button
                  onClick={() => salvarFonte({ ...fonte, tamanhoSelecionados: Math.min(20, fonte.tamanhoSelecionados + 1) })}
                  className="h-7 w-7 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors">
                  <Plus className="h-3 w-3" />
                </button>
                <span className="ml-2 truncate" style={{ fontSize: `${fonte.tamanhoSelecionados}px`, fontWeight: fonte.negrito ? 600 : 400 }}>
                  Preview
                </span>
              </div>
            </div>

            {/* Negrito */}
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Negrito</Label>
              <Switch
                checked={fonte.negrito}
                onCheckedChange={v => salvarFonte({ ...fonte, negrito: v })}
              />
            </div>

            {/* Mostrar lojas nos selecionados */}
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Mostrar lojas nos selecionados</Label>
              <Switch
                checked={fonte.mostrarLojas}
                onCheckedChange={v => salvarFonte({ ...fonte, mostrarLojas: v })}
              />
            </div>

            {/* Cor do nome */}
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Cor do nome</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={fonte.corNome || '#cbd5e1'}
                  onChange={e => salvarFonte({ ...fonte, corNome: e.target.value })}
                  className="h-7 w-10 rounded border border-border cursor-pointer bg-transparent"
                />
                {fonte.corNome && (
                  <button
                    onClick={() => salvarFonte({ ...fonte, corNome: '' })}
                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                    Padrão
                  </button>
                )}
              </div>
            </div>

            {/* Cor dos valores */}
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Cor dos valores</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={fonte.corValor || '#34d399'}
                  onChange={e => salvarFonte({ ...fonte, corValor: e.target.value })}
                  className="h-7 w-10 rounded border border-border cursor-pointer bg-transparent"
                />
                {fonte.corValor && (
                  <button
                    onClick={() => salvarFonte({ ...fonte, corValor: '' })}
                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                    Padrão
                  </button>
                )}
              </div>
            </div>

            {/* Reset geral */}
            {(fonte.tamanho !== FONTE_PADRAO.tamanho || fonte.tamanhoSelecionados !== FONTE_PADRAO.tamanhoSelecionados || fonte.negrito !== FONTE_PADRAO.negrito || fonte.corNome || fonte.corValor || !fonte.mostrarLojas) && (
              <Button
                variant="outline"
                size="sm"
                className="w-full h-7 text-xs"
                onClick={() => salvarFonte(FONTE_PADRAO)}>
                Restaurar padrões
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

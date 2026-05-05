'use client'

import { useState, useMemo, useCallback, useRef, memo, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Search, Star, Package, Plus, X, Minus, Copy, Check, Image, Layers, SlidersHorizontal, GripVertical, ArrowDownUp, ChevronDown, ChevronUp, Pencil } from 'lucide-react'
import { getImgbbKey, uploadImgbb } from '@/lib/imgbb'
import { cn, norm } from '@/lib/utils'
import { toast } from 'sonner'

// ── Config de fonte ───────────────────────────────────────────────────────────

const CALC_FONTE_KEY = 'calculadora-fonte'
const CALC_COL_WIDTHS_KEY = 'calculadora-col-widths'

type FonteConfig = {
  tamanho: number              // col 1: lista
  tamanhoSelecionados: number  // col 2: selecionados
  tamanhoResumo: number        // col 3: resumo + ingredientes
  negrito: boolean             // col 1
  negritoSelecionados: boolean // col 2
  corNome: string              // col 1 — '' = padrão do tema
  corNomeSelecionados: string  // col 2
  corValor: string             // col 1 — '' = verde/laranja padrão
  corValorSelecionados: string // col 2
  mostrarLojas: boolean
}

type ColWidths = { col1: number; col3: number }
const DEFAULT_COL_WIDTHS: ColWidths = { col1: 380, col3: 288 }

const FONTE_PADRAO: FonteConfig = { tamanho: 15, tamanhoSelecionados: 13, tamanhoResumo: 11, negrito: false, negritoSelecionados: false, corNome: '', corNomeSelecionados: '', corValor: '', corValorSelecionados: '', mostrarLojas: true }

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
  meuFaccaoNome?: string | null
  meuLojaNome?: string | null
  favoritosIniciais: string[]
  favoritosServicosIniciais: string[]
  podeEditar?: boolean
  servicos: Servico[]
  servicoItens: ServicoItemCalc[]
}

type BatchEntry = { item_id: string; quantidade: number; loja_id: string }
type ComboEntry = { servico_id: string; quantidade: number }
type Aba = 'favoritos' | 'meus' | 'todos'

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
  if (norm(texto).includes(q)) return true
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
      'group flex items-center gap-1.5 px-3 py-2.5 border-b border-border/30 transition-colors hover:bg-white/[0.015]',
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
    <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-border/30 transition-colors hover:bg-white/[0.015]">
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
      {itensCount > 0 && (
        <span className="text-[9px] text-muted-foreground/40 shrink-0">{itensCount}i</span>
      )}
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
  meuLojaId, meuFaccaoId, meuFaccaoNome, meuLojaNome,
  favoritosIniciais, favoritosServicosIniciais,
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
  const [modoSujo, setModoSujo] = useState(false)
  const [copied, setCopied] = useState(false)
  const [imgbbLoading, setImgbbLoading] = useState(false)
  const [imgbbResumoLoading, setImgbbResumoLoading] = useState(false)
  const [fonte, setFonte] = useState<FonteConfig>(FONTE_PADRAO)
  const [fonteModalAberto, setFonteModalAberto] = useState(false)
  const [modoCusto, setModoCusto] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [sortBatch, setSortBatch] = useState<'none' | 'name' | 'qty'>('none')
  const [qtdInputs, setQtdInputs] = useState<Record<string, string>>({})
  const [comboBatch, setComboBatch] = useState<ComboEntry[]>([])
  const [comboQtdInputs, setComboQtdInputs] = useState<Record<string, string>>({})
  const [combosExpandidos, setCombosExpandidos] = useState<Set<string>>(new Set())
  const [modoServico, setModoServico] = useState<'faccao' | 'loja'>(
    meuFaccaoId ? 'faccao' : 'loja'
  )
  // preço manual por item no orçamento
  const [precoManualAtivo, setPrecoManualAtivo] = useState<Record<string, boolean>>({})
  const [precoManualValor, setPrecoManualValor] = useState<Record<string, string>>({})
  // preço manual por ingrediente no resumo
  const [precoManualIngAtivo, setPrecoManualIngAtivo] = useState<Record<string, boolean>>({})
  const [precoManualIngValor, setPrecoManualIngValor] = useState<Record<string, string>>({})
  // larguras das colunas
  const [colWidths, setColWidths] = useState<ColWidths>(DEFAULT_COL_WIDTHS)
  // itens riscados no resumo
  const [riscadosResumo, setRiscadosResumo] = useState<Set<string>>(new Set())

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CALC_FONTE_KEY)
      if (saved) setFonte({ ...FONTE_PADRAO, ...JSON.parse(saved) })
    } catch { /* ignore */ }
    try {
      const savedW = localStorage.getItem(CALC_COL_WIDTHS_KEY)
      if (savedW) setColWidths({ ...DEFAULT_COL_WIDTHS, ...JSON.parse(savedW) })
    } catch { /* ignore */ }
  }, [])

  function salvarFonte(nova: FonteConfig) {
    setFonte(nova)
    localStorage.setItem(CALC_FONTE_KEY, JSON.stringify(nova))
  }

  // ── Resize de colunas ─────────────────────────────────────────────────────

  const colWidthsRef = useRef(colWidths)
  colWidthsRef.current = colWidths

  function startResize(which: 'col1' | 'col3', e: React.MouseEvent) {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = which === 'col1' ? colWidths.col1 : colWidths.col3
    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX
      const newWidth = which === 'col1'
        ? Math.max(220, Math.min(620, startWidth + delta))
        : Math.max(220, Math.min(500, startWidth - delta))
      setColWidths(prev => ({ ...prev, [which]: newWidth }))
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      localStorage.setItem(CALC_COL_WIDTHS_KEY, JSON.stringify(colWidthsRef.current))
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
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
    const ambos = Boolean(meuLojaId && meuFaccaoId)
    const mostrarLoja = meuLojaId && (!ambos || modoServico === 'loja')
    const mostrarFaccao = meuFaccaoId && (!ambos || modoServico === 'faccao')
    if (mostrarLoja) {
      lojaPrecos.filter(lp => lp.loja_id === meuLojaId).forEach(lp => {
        map[lp.item_id] = { preco_limpo: lp.preco, preco_sujo: lp.preco_sujo }
      })
    }
    if (mostrarFaccao) {
      faccaoPrecos.filter(fp => fp.faccao_id === meuFaccaoId).forEach(fp => {
        if (!mostrarLoja || !lojaPrecos.some(lp => lp.loja_id === meuLojaId && lp.item_id === fp.item_id)) {
          map[fp.item_id] = { preco_limpo: fp.preco_limpo, preco_sujo: fp.preco_sujo }
        }
      })
    }
    return map
  }, [precosVigentes, lojaPrecos, faccaoPrecos, meuLojaId, meuFaccaoId, modoServico])

  const meusItemIds = useMemo(() => {
    const ids = new Set<string>()
    const ambos = Boolean(meuLojaId && meuFaccaoId)
    if (meuLojaId && (!ambos || modoServico === 'loja')) {
      lojaPrecos.filter(lp => lp.loja_id === meuLojaId).forEach(lp => ids.add(lp.item_id))
    } else if (meuFaccaoId && (!ambos || modoServico === 'faccao')) {
      faccaoPrecos.filter(fp => fp.faccao_id === meuFaccaoId).forEach(fp => ids.add(fp.item_id))
    } else {
      items.forEach(i => { if (i.eh_meu_produto || i.meu_produto_usuario_id === userId) ids.add(i.id) })
    }
    return ids
  }, [lojaPrecos, faccaoPrecos, meuLojaId, meuFaccaoId, items, userId, modoServico])

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
    if (!filterLoja) {
      let servLista = servicos
      if (aba === 'favoritos') servLista = servLista.filter(s => favoritosServicos.has(s.id))
      if (aba === 'meus') servLista = servLista.filter(s => s.eh_meu_servico || servicoItens.some(si => si.servico_id === s.id && meusItemIds.has(si.item_id)))
      servLista.forEach(s => { if (s.categoria) cats.add(s.categoria) })
    }
    return Array.from(cats).sort()
  }, [items, aba, favoritos, meusItemIds, filterLoja, faccaoPrecos, lojaPrecoPorItem, servicos, favoritosServicos, servicoItens])

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
      const q = norm(busca)
      lista = lista.filter(i => matchBusca(i.nome, i.apelidos, q))
    }
    return lista
  }, [items, aba, favoritos, busca, meusItemIds, filterCategoria, filterLoja, lojaPrecoPorItem, faccaoPrecos])

  const batchIds = useMemo(() => new Set(batch.map(b => b.item_id)), [batch])

  // Lista unificada de itens + combos para o Orçamento (Col 2), ordenada junto
  const unifiedDisplayList = useMemo(() => {
    type UE =
      | { tipo: 'item'; id: string; nome: string; quantidade: number; data: BatchEntry }
      | { tipo: 'combo'; id: string; nome: string; quantidade: number; data: ComboEntry; servico: Servico }
    const its: UE[] = batch.map(b => ({ tipo: 'item' as const, id: b.item_id, nome: itemMap[b.item_id]?.nome ?? '', quantidade: b.quantidade, data: b }))
    const combos: UE[] = comboBatch.flatMap(c => {
      const srv = servicos.find(s => s.id === c.servico_id)
      if (!srv) return []
      return [{ tipo: 'combo' as const, id: c.servico_id, nome: srv.nome, quantidade: c.quantidade, data: c, servico: srv }]
    })
    const all: UE[] = [...its, ...combos]
    if (sortBatch === 'name') return all.sort((a, b) => a.nome.localeCompare(b.nome))
    if (sortBatch === 'qty') return all.sort((a, b) => b.quantidade - a.quantidade)
    return all
  }, [batch, comboBatch, itemMap, servicos, sortBatch])

  // Resumo (Col 3): quantidades somadas — itens avulsos + componentes de combos
  const resumoItens = useMemo(() => {
    const map = new Map<string, { nome: string; quantidade: number }>()
    for (const entry of batch) {
      const nome = itemMap[entry.item_id]?.nome ?? entry.item_id
      const cur = map.get(entry.item_id) ?? { nome, quantidade: 0 }
      map.set(entry.item_id, { nome, quantidade: cur.quantidade + entry.quantidade })
    }
    for (const combo of comboBatch) {
      for (const si of servicoItens.filter(s => s.servico_id === combo.servico_id)) {
        const nome = itemMap[si.item_id]?.nome ?? si.item_nome
        const cur = map.get(si.item_id) ?? { nome, quantidade: 0 }
        map.set(si.item_id, { nome, quantidade: cur.quantidade + si.quantidade * combo.quantidade })
      }
    }
    const result = Array.from(map.entries()).map(([id, v]) => ({
      item_id: id, ...v,
      pesoTotal: (itemMap[id]?.peso ?? 0) * v.quantidade,
    }))
    if (sortBatch === 'name') result.sort((a, b) => a.nome.localeCompare(b.nome))
    else if (sortBatch === 'qty') result.sort((a, b) => b.quantidade - a.quantidade)
    return result
  }, [batch, comboBatch, sortBatch, itemMap, servicoItens])

  const servicosFiltrados = useMemo(() => {
    if (filterLoja) return []
    let lista = servicos
    if (aba === 'favoritos') lista = lista.filter(s => favoritosServicos.has(s.id))
    if (aba === 'meus') lista = lista.filter(s => s.eh_meu_servico || servicoItens.some(si => si.servico_id === s.id && meusItemIds.has(si.item_id)))
    if (filterCategoria) lista = lista.filter(s => s.categoria === filterCategoria)
    if (busca.trim()) {
      const q = norm(busca)
      lista = lista.filter(s => norm(s.nome).includes(q) || norm(s.descricao).includes(q))
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
    setQtdInputs(prev => prev[itemId] !== undefined ? prev : { ...prev, [itemId]: '1' })
  }, [])
  const removeFromBatch = useCallback((itemId: string) => {
    setBatch(prev => prev.filter(b => b.item_id !== itemId))
    setQtdInputs(prev => { const n = { ...prev }; delete n[itemId]; return n })
    setPrecoManualAtivo(prev => { const n = { ...prev }; delete n[itemId]; return n })
    setPrecoManualValor(prev => { const n = { ...prev }; delete n[itemId]; return n })
  }, [])
  const reorderBatch = useCallback((fromId: string, toId: string) => {
    if (fromId === toId) return
    setBatch(prev => {
      const fromIdx = prev.findIndex(b => b.item_id === fromId)
      const toIdx = prev.findIndex(b => b.item_id === toId)
      if (fromIdx === -1 || toIdx === -1) return prev
      const next = [...prev]
      const [item] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, item)
      return next
    })
  }, [])
  const setQtd = useCallback((itemId: string, qtd: number) => {
    if (qtd <= 0) {
      setBatch(prev => prev.filter(b => b.item_id !== itemId))
      setQtdInputs(prev => { const n = { ...prev }; delete n[itemId]; return n })
      return
    }
    setBatch(prev => prev.map(b => b.item_id === itemId ? { ...b, quantidade: qtd } : b))
    setQtdInputs(prev => ({ ...prev, [itemId]: String(qtd) }))
  }, [])
  const setLoja = useCallback((itemId: string, lojaId: string) => {
    setBatch(prev => prev.map(b => b.item_id === itemId ? { ...b, loja_id: lojaId === 'sem' ? '' : lojaId } : b))
  }, [])

  const getPrecoItem = useCallback((entry: BatchEntry): number | null => {
    if (precoManualAtivo[entry.item_id]) {
      const v = parseFloat((precoManualValor[entry.item_id] ?? '').replace(',', '.'))
      return isNaN(v) ? null : v
    }
    if (entry.loja_id) {
      const lp = lojaPrecos.find(l => l.loja_id === entry.loja_id && l.item_id === entry.item_id)
      if (lp) return modoSujo && lp.preco_sujo != null ? lp.preco_sujo : lp.preco
    }
    const p = meuPrecoMap[entry.item_id]
    if (!p) return null
    return modoSujo ? (p.preco_sujo ?? p.preco_limpo) : (p.preco_limpo ?? p.preco_sujo)
  }, [lojaPrecos, meuPrecoMap, modoSujo, precoManualAtivo, precoManualValor])

  const addServico = useCallback((servico: Servico) => {
    const itens = servicoItens.filter(si => si.servico_id === servico.id)
    if (itens.length === 0 && !servico.eh_meu_servico) { toast.info('Serviço sem itens configurados'); return }
    setComboBatch(prev => {
      const existing = prev.find(c => c.servico_id === servico.id)
      if (existing) {
        const newQty = existing.quantidade + 1
        setComboQtdInputs(pq => ({ ...pq, [servico.id]: String(newQty) }))
        return prev.map(c => c.servico_id === servico.id ? { ...c, quantidade: newQty } : c)
      }
      setComboQtdInputs(pq => ({ ...pq, [servico.id]: '1' }))
      return [...prev, { servico_id: servico.id, quantidade: 1 }]
    })
    toast.success(`Kit "${servico.nome}" adicionado`)
  }, [servicoItens])

  const explodir = useCallback((servicoId: string) => {
    const combo = comboBatch.find(c => c.servico_id === servicoId)
    if (!combo) return
    const itens = servicoItens.filter(si => si.servico_id === servicoId)
    if (itens.length > 0) {
      setBatch(prev => {
        let next = [...prev]
        for (const si of itens) {
          const qtdTotal = si.quantidade * combo.quantidade
          const exists = next.find(b => b.item_id === si.item_id)
          if (exists) {
            next = next.map(b => b.item_id === si.item_id ? { ...b, quantidade: b.quantidade + qtdTotal } : b)
          } else {
            next.push({ item_id: si.item_id, quantidade: qtdTotal, loja_id: '' })
          }
        }
        return next
      })
      setQtdInputs(prev => {
        const n = { ...prev }
        for (const si of itens) {
          if (n[si.item_id] === undefined) n[si.item_id] = String(si.quantidade * combo.quantidade)
        }
        return n
      })
    }
    setComboBatch(prev => prev.filter(c => c.servico_id !== servicoId))
    setComboQtdInputs(prev => { const n = { ...prev }; delete n[servicoId]; return n })
  }, [comboBatch, servicoItens])

  const setComboQtd = useCallback((servicoId: string, qtd: number) => {
    if (qtd <= 0) {
      setComboBatch(prev => prev.filter(c => c.servico_id !== servicoId))
      setComboQtdInputs(prev => { const n = { ...prev }; delete n[servicoId]; return n })
      return
    }
    setComboBatch(prev => prev.map(c => c.servico_id === servicoId ? { ...c, quantidade: qtd } : c))
    setComboQtdInputs(prev => ({ ...prev, [servicoId]: String(qtd) }))
  }, [])

  const removeFromComboBatch = useCallback((servicoId: string) => {
    setComboBatch(prev => prev.filter(c => c.servico_id !== servicoId))
    setComboQtdInputs(prev => { const n = { ...prev }; delete n[servicoId]; return n })
  }, [])

  // ── Ingredientes agregados ────────────────────────────────────────────────

  const ingredientesAgregados = useMemo(() => {
    const map: Record<string, {
      ingrediente: Item | null
      totalQty: number
      totalPeso: number
      lojasDisponiveis: LojaPreco[]
    }> = {}
    const addIngredientes = (item_id: string, quantidade: number) => {
      const item = itemMap[item_id]
      if (!item?.item_receita?.length) return
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
    for (const { item_id, quantidade } of batch) {
      if (!riscadosResumo.has(item_id)) addIngredientes(item_id, quantidade)
    }
    for (const combo of comboBatch) {
      for (const si of servicoItens.filter(s => s.servico_id === combo.servico_id)) {
        if (!riscadosResumo.has(si.item_id)) addIngredientes(si.item_id, si.quantidade * combo.quantidade)
      }
    }
    return Object.entries(map)
      .map(([id, v]) => ({ ingrediente_id: id, ...v }))
      .sort((a, b) => (a.ingrediente?.nome ?? '').localeCompare(b.ingrediente?.nome ?? ''))
  }, [batch, comboBatch, itemMap, lojaPrecoPorItem, servicoItens, riscadosResumo])

  // ── Totais ────────────────────────────────────────────────────────────────

  const totais = useMemo(() => {
    let custoItens = 0, pesoProdutos = 0, custoItensCompleto = (batch.length + comboBatch.length) > 0
    for (const entry of batch) {
      const preco = getPrecoItem(entry)
      if (preco == null) custoItensCompleto = false
      else custoItens += preco * entry.quantidade
      pesoProdutos += (itemMap[entry.item_id]?.peso ?? 0) * entry.quantidade
    }
    for (const combo of comboBatch) {
      const srv = servicos.find(s => s.id === combo.servico_id)
      if (srv) {
        const kitPreco = modoSujo ? (srv.preco_sujo ?? srv.preco_limpo) : (srv.preco_limpo ?? srv.preco_sujo)
        if (kitPreco == null) custoItensCompleto = false
        else custoItens += kitPreco * combo.quantidade
        for (const si of servicoItens.filter(s => s.servico_id === combo.servico_id)) {
          pesoProdutos += (itemMap[si.item_id]?.peso ?? 0) * si.quantidade * combo.quantidade
        }
      } else { custoItensCompleto = false }
    }

    let custoIng = 0, custoIngCompleto = ingredientesAgregados.length > 0
    for (const ing of ingredientesAgregados) {
      let precoUnit: number | null = null
      if (precoManualIngAtivo[ing.ingrediente_id]) {
        const v = parseFloat((precoManualIngValor[ing.ingrediente_id] ?? '').replace(',', '.'))
        precoUnit = isNaN(v) ? null : v
      } else {
        const lojaId = lojasPorIng[ing.ingrediente_id]
        const lp = lojaId ? ing.lojasDisponiveis.find(l => l.loja_id === lojaId) : null
        precoUnit = lp ? (modoSujo && lp.preco_sujo != null ? lp.preco_sujo : lp.preco) : null
      }
      if (precoUnit == null) custoIngCompleto = false
      else custoIng += precoUnit * ing.totalQty
    }

    return { custoItens, pesoProdutos, custoItensCompleto, custoIng, custoIngCompleto }
  }, [batch, comboBatch, getPrecoItem, itemMap, servicos, servicoItens, ingredientesAgregados, lojasPorIng, modoSujo, precoManualIngAtivo, precoManualIngValor])

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
    for (const combo of comboBatch) {
      const srv = servicos.find(s => s.id === combo.servico_id)
      if (!srv) continue
      const kitPreco = modoSujo ? (srv.preco_sujo ?? srv.preco_limpo) : (srv.preco_limpo ?? srv.preco_sujo)
      const total = kitPreco != null ? fmt(kitPreco * combo.quantidade) : '—'
      linhas.push({ text: `[Kit] ${srv.nome}  ×${combo.quantidade}  ${total}` })
    }

    linhas.push({ text: '' })
    if (totais.custoItens > 0) {
      linhas.push({ text: `TOTAL: ${fmt(totais.custoItens)}`, bold: true })
    }
    if (totais.pesoProdutos > 0) {
      linhas.push({ text: `Peso: ${fmtKg(totais.pesoProdutos)}`, dim: true })
    }

    if (ingredientesAgregados.length > 0) {
      linhas.push({ text: '' })
      linhas.push({ text: '─── Ingredientes ───', dim: true })
      for (const ing of ingredientesAgregados) {
        const manAtivo = precoManualIngAtivo[ing.ingrediente_id]
        const manV = manAtivo ? parseFloat((precoManualIngValor[ing.ingrediente_id] ?? '').replace(',', '.')) : NaN
        const lojaId = lojasPorIng[ing.ingrediente_id]
        const lp = lojaId ? ing.lojasDisponiveis.find(l => l.loja_id === lojaId) : null
        const precoUnit = manAtivo && !isNaN(manV) ? manV : lp ? (modoSujo && lp.preco_sujo != null ? lp.preco_sujo : lp.preco) : null
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
  }, [batch, comboBatch, servicos, itemMap, lojaMap, getPrecoItem, totais, ingredientesAgregados, lojasPorIng, modoSujo, precoManualIngAtivo, precoManualIngValor])

  const gerarLinhasResumoCompacto = useCallback(() => {
    const linhas: { text: string; indent?: boolean; bold?: boolean; dim?: boolean; color?: string }[] = []
    linhas.push({ text: 'ORÇAMENTO', bold: true })
    linhas.push({ text: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }), dim: true })
    linhas.push({ text: '' })

    for (const entry of batch) {
      const item = itemMap[entry.item_id]
      if (!item) continue
      linhas.push({ text: `${item.nome}  ×${entry.quantidade}` })
    }
    for (const combo of comboBatch) {
      const srv = servicos.find(s => s.id === combo.servico_id)
      if (!srv) continue
      linhas.push({ text: `[Kit] ${srv.nome}  ×${combo.quantidade}` })
    }

    if (ingredientesAgregados.length > 0) {
      linhas.push({ text: '' })
      linhas.push({ text: '─── Ingredientes ───', dim: true })
      for (const ing of ingredientesAgregados) {
        const manAtivo = precoManualIngAtivo[ing.ingrediente_id]
        const manV = manAtivo ? parseFloat((precoManualIngValor[ing.ingrediente_id] ?? '').replace(',', '.')) : NaN
        const lojaId = lojasPorIng[ing.ingrediente_id]
        const lp = lojaId ? ing.lojasDisponiveis.find(l => l.loja_id === lojaId) : null
        const precoUnit = manAtivo && !isNaN(manV) ? manV : lp ? (modoSujo && lp.preco_sujo != null ? lp.preco_sujo : lp.preco) : null
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
  }, [batch, comboBatch, servicos, itemMap, ingredientesAgregados, lojasPorIng, modoSujo, totais, precoManualIngAtivo, precoManualIngValor])

  const gerarLinhasPedido = useCallback(() => {
    const linhas: { text: string; indent?: boolean; bold?: boolean; dim?: boolean; color?: string }[] = []
    linhas.push({ text: 'PEDIDO', bold: true })
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
    for (const combo of comboBatch) {
      const srv = servicos.find(s => s.id === combo.servico_id)
      if (!srv) continue
      const kitPreco = modoSujo ? (srv.preco_sujo ?? srv.preco_limpo) : (srv.preco_limpo ?? srv.preco_sujo)
      const total = kitPreco != null ? fmt(kitPreco * combo.quantidade) : '—'
      linhas.push({ text: `[Kit] ${srv.nome}  ×${combo.quantidade}  ${total}` })
    }
    linhas.push({ text: '' })
    if (totais.custoItens > 0) linhas.push({ text: `TOTAL: ${fmt(totais.custoItens)}`, bold: true })
    if (totais.pesoProdutos > 0) linhas.push({ text: `Peso: ${fmtKg(totais.pesoProdutos)}`, dim: true })
    return linhas
  }, [batch, comboBatch, servicos, itemMap, lojaMap, getPrecoItem, totais, modoSujo])

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
      const linhas = gerarLinhasPedido()
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
  }, [batch.length, gerarLinhasPedido])

  const enviarImgbbResumo = useCallback(async () => {
    if (batch.length === 0) return
    setImgbbResumoLoading(true)
    try {
      const key = await getImgbbKey()
      if (!key) { toast.error('Chave imgbb não configurada', { description: 'Acesse Admin → Integrações para configurar.' }); return }
      const linhas = gerarLinhasResumoCompacto()
      const canvas = gerarCanvas(linhas)
      const base64 = canvas.toDataURL('image/png').split(',')[1]
      const url = await uploadImgbb(base64, key, 'calculadora-resumo')
      await navigator.clipboard.writeText(url)
      toast.success('URL copiada!')
    } catch (e: unknown) {
      toast.error('Erro ao enviar imagem', { description: e instanceof Error ? e.message : undefined })
    } finally {
      setImgbbResumoLoading(false)
    }
  }, [batch.length, gerarLinhasResumoCompacto])

  const temFiltroAtivo = filterCategoria !== '' || filterLoja !== ''

  function limparTudo() {
    setBatch([])
    setLojasPorIng({})
    setComboBatch([])
    setComboQtdInputs({})
    setQtdInputs({})
    setPrecoManualAtivo({})
    setPrecoManualValor({})
    setPrecoManualIngAtivo({})
    setPrecoManualIngValor({})
    setRiscadosResumo(new Set())
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-[calc(100vh-3rem)] flex overflow-hidden select-none">

      {/* ── Col 1: Lista de itens ── */}
      <aside style={{ width: colWidths.col1 + 'px' }} className="shrink-0 flex flex-col border-r border-border">

        {/* Filtros compactos — 2 linhas */}
        <div className="px-2 pt-2 pb-1.5 border-b border-border space-y-1.5">

          {/* Linha 1: Busca + Settings + Modo */}
          <div className="flex gap-1.5 items-center">
            <div className="relative flex-1 min-w-0">
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
            {(meuLojaId || meuFaccaoId) && (
              <div className="flex items-center gap-0.5 bg-muted/20 rounded p-0.5 border border-border/30 shrink-0">
                {meuFaccaoId && (
                  <button
                    onClick={() => setModoServico('faccao')}
                    className={cn('px-2 py-0.5 rounded text-[11px] font-medium transition-colors truncate max-w-[80px]',
                      modoServico === 'faccao' ? 'bg-purple-500/20 text-purple-300' : 'text-muted-foreground hover:text-foreground'
                    )}>
                    {meuFaccaoNome ?? 'Facção'}
                  </button>
                )}
                {meuLojaId && (
                  <button
                    onClick={() => setModoServico('loja')}
                    className={cn('px-2 py-0.5 rounded text-[11px] font-medium transition-colors truncate max-w-[80px]',
                      modoServico === 'loja' ? 'bg-blue-500/20 text-blue-300' : 'text-muted-foreground hover:text-foreground'
                    )}>
                    {meuLojaNome ?? 'Loja'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Linha 2: Chips de categoria + filtro loja */}
          {(categoriasNaAba.length > 0 || modoCusto || temFiltroAtivo) && (
            <div className="flex items-center gap-1 min-w-0">
              <div className="flex gap-1 overflow-x-auto scrollbar-none flex-1 min-w-0 pb-0.5">
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
              {modoCusto && (
                <Select value={filterLoja || '_todas'} onValueChange={v => setFilterLoja(v === '_todas' ? '' : v)}>
                  <SelectTrigger className="h-7 text-[10px] border-border/50 shrink-0 w-[100px]"><SelectValue placeholder="Loja" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_todas">Todas</SelectItem>
                    {meuFaccaoId && <SelectItem value="_faccao">Minha facção</SelectItem>}
                    {lojasComPrecos.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {temFiltroAtivo && (
                <button
                  onClick={() => { setFilterCategoria(''); setFilterLoja('') }}
                  title="Limpar filtros"
                  className="shrink-0 h-7 w-7 rounded border border-border/50 text-[10px] text-muted-foreground hover:text-foreground hover:border-border transition-colors flex items-center justify-center">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
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

      {/* Handle resize col1 */}
      <div
        className="w-1 shrink-0 cursor-col-resize -ml-px hover:bg-primary/40 transition-colors z-10"
        onMouseDown={e => startResize('col1', e)}
      />

      {/* ── Col 2: Orçamento ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0 gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground shrink-0">
            Orçamento{(batch.length + comboBatch.length) > 0 && <span className="text-foreground ml-1">({batch.length + comboBatch.length})</span>}
          </h3>

          <div className="flex items-center gap-2 shrink-0">
            {/* Toggle Produção / Custo */}
            <div className="flex items-center gap-0.5 bg-muted/20 rounded p-0.5 border border-border/30">
              <button
                onClick={() => { setModoCusto(false); setFilterLoja('') }}
                className={cn('px-2 py-0.5 rounded text-[11px] font-medium transition-colors',
                  !modoCusto ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'
                )}>Produção</button>
              <button
                onClick={() => setModoCusto(true)}
                className={cn('px-2 py-0.5 rounded text-[11px] font-medium transition-colors',
                  modoCusto ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'
                )}>Custo</button>
            </div>
            {/* Ordenação */}
            {(batch.length + comboBatch.length) > 0 && (
              <div className="flex items-center gap-0.5 bg-muted/20 rounded p-0.5 border border-border/30">
                <button
                  onClick={() => setSortBatch(sortBatch === 'name' ? 'none' : 'name')}
                  title="Ordenar por nome"
                  className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors',
                    sortBatch === 'name' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'
                  )}>A‑Z</button>
                <button
                  onClick={() => setSortBatch(sortBatch === 'qty' ? 'none' : 'qty')}
                  title="Ordenar por quantidade"
                  className={cn('p-0.5 rounded transition-colors',
                    sortBatch === 'qty' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                  )}>
                  <ArrowDownUp className="h-3 w-3" />
                </button>
              </div>
            )}
            {(batch.length + comboBatch.length) > 0 && (
              <button onClick={limparTudo}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1">
                <X className="h-3 w-3" /> Limpar
              </button>
            )}
            <div className="flex items-center gap-1.5">
              <Label className="text-[11px] text-muted-foreground">Sujo</Label>
              <Switch checked={modoSujo} onCheckedChange={setModoSujo} />
            </div>
            {(batch.length + comboBatch.length) > 0 && (
              <>
                <button onClick={copiarTexto}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-1.5 py-1 rounded hover:bg-white/[0.06]">
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                <button onClick={enviarImgbb} disabled={imgbbLoading}
                  title="Gerar imagem do pedido (copia URL)"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-1.5 py-1 rounded hover:bg-white/[0.06] disabled:opacity-40">
                  {imgbbLoading ? <span className="text-[10px]">...</span> : <Image className="h-3.5 w-3.5" />}
                </button>
              </>
            )}
          </div>
        </div>

        {(batch.length + comboBatch.length) === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
            <Package className="h-10 w-10 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">Adicione itens da lista</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto flex flex-col">

            {/* Lista unificada: itens avulsos + combos, ordenados juntos */}
            <div className="flex-1">
              {unifiedDisplayList.map(entry => {

                if (entry.tipo === 'combo') {
                  const combo = entry.data
                  const srv = entry.servico
                  const kitPreco = modoSujo ? (srv.preco_sujo ?? srv.preco_limpo) : (srv.preco_limpo ?? srv.preco_sujo)
                  const total = kitPreco != null ? kitPreco * combo.quantidade : null
                  const itensKit = servicoItens.filter(si => si.servico_id === combo.servico_id)
                  const expandido = combosExpandidos.has(combo.servico_id)
                  return (
                    <div key={`combo-${combo.servico_id}`} className="border-b border-border/30">
                      <div className="flex items-center gap-2 px-2 py-2.5 hover:bg-white/[0.01] bg-primary/[0.015]">
                        <Layers className="h-3.5 w-3.5 text-primary/30 shrink-0" />
                        <span className="flex-1 min-w-0 truncate" style={{
                          fontSize: `${fonte.tamanhoSelecionados}px`,
                          fontWeight: fonte.negritoSelecionados ? 600 : 500,
                          ...(fonte.corNomeSelecionados ? { color: fonte.corNomeSelecionados } : {}),
                        }}>{srv.nome}</span>
                        {/* Expand/collapse */}
                        {itensKit.length > 0 && (
                          <button
                            onClick={() => setCombosExpandidos(prev => { const n = new Set(prev); expandido ? n.delete(combo.servico_id) : n.add(combo.servico_id); return n })}
                            title={expandido ? 'Ocultar itens' : `Ver ${itensKit.length} iten${itensKit.length !== 1 ? 's' : ''}`}
                            className={cn('shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border transition-colors',
                              expandido
                                ? 'border-primary/30 text-primary/70 bg-primary/[0.06]'
                                : 'border-border/40 text-muted-foreground/50 hover:text-foreground hover:border-border'
                            )}>
                            {expandido ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                            <span>{itensKit.length}i</span>
                          </button>
                        )}
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button onClick={() => setComboQtd(combo.servico_id, combo.quantidade - 1)}
                            className="h-7 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors">
                            <Minus className="h-3 w-3" />
                          </button>
                          <Input type="number"
                            value={comboQtdInputs[combo.servico_id] ?? String(combo.quantidade)}
                            onChange={e => setComboQtdInputs(prev => ({ ...prev, [combo.servico_id]: e.target.value }))}
                            onBlur={() => {
                              const raw = comboQtdInputs[combo.servico_id]
                              if (raw === undefined) return
                              const v = parseInt(raw)
                              if (!raw.trim() || isNaN(v)) setComboQtdInputs(prev => ({ ...prev, [combo.servico_id]: String(combo.quantidade) }))
                              else setComboQtd(combo.servico_id, v)
                            }}
                            className="h-7 w-14 text-center text-sm px-0.5" />
                          <button onClick={() => setComboQtd(combo.servico_id, combo.quantidade + 1)}
                            className="h-7 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors">
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="flex flex-col items-end shrink-0 min-w-[110px]">
                          {kitPreco != null && combo.quantidade > 1 && (
                            <span className="text-[9px] text-muted-foreground/40 tabular-nums">{combo.quantidade} × {fmt(kitPreco)}</span>
                          )}
                          {total != null ? (
                            <span className="tabular-nums font-semibold" style={{
                              fontSize: `${fonte.tamanhoSelecionados}px`,
                              color: fonte.corValorSelecionados || (modoSujo ? '#fb923c' : '#34d399'),
                            }}>{fmt(total)}</span>
                          ) : <span className="text-muted-foreground/30 text-sm">—</span>}
                        </div>
                        {itensKit.length > 0 && (
                          <button onClick={() => explodir(combo.servico_id)}
                            title={`Converter em ${itensKit.length} iten${itensKit.length !== 1 ? 's' : ''} avulsos`}
                            className="shrink-0 h-6 rounded px-1.5 flex items-center justify-center text-[10px] text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-colors border border-border/30 font-mono">
                            ↗
                          </button>
                        )}
                        <button onClick={() => removeFromComboBatch(combo.servico_id)}
                          className="shrink-0 h-5 w-5 rounded flex items-center justify-center text-muted-foreground/30 hover:text-destructive transition-colors">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      {/* Subitens colapsáveis */}
                      {expandido && itensKit.map(si => (
                        <div key={si.item_id} className="flex items-center gap-2 pl-8 pr-2 py-1.5 bg-white/[0.01] border-t border-border/20">
                          <span className="flex-1 min-w-0 truncate text-muted-foreground/70" style={{ fontSize: `${fonte.tamanhoSelecionados - 1}px` }}>
                            {itemMap[si.item_id]?.nome ?? si.item_nome}
                          </span>
                          <span className="text-[10px] text-muted-foreground/40 tabular-nums shrink-0">
                            {si.quantidade * combo.quantidade}×
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                }

                // item avulso
                const bEntry = entry.data
                const item = itemMap[bEntry.item_id]
                const lojasItem = lojaPrecoPorItem[bEntry.item_id] ?? []
                const preco = getPrecoItem(bEntry)
                const total = preco != null ? preco * bEntry.quantidade : null
                const peso = item?.peso != null ? item.peso * bEntry.quantidade : null
                const manualAtivo = precoManualAtivo[bEntry.item_id] ?? false
                return (
                  <div key={`item-${bEntry.item_id}`}
                    draggable={sortBatch === 'none'}
                    onDragStart={e => { e.dataTransfer.setData('text/plain', bEntry.item_id); setDraggingId(bEntry.item_id) }}
                    onDragEnd={() => setDraggingId(null)}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); const fromId = e.dataTransfer.getData('text/plain'); reorderBatch(fromId, bEntry.item_id) }}
                    className={cn('flex items-center gap-2 px-2 py-2.5 border-b border-border/30 hover:bg-white/[0.01]', draggingId === bEntry.item_id && 'opacity-40')}>
                    <GripVertical className={cn('h-3.5 w-3.5 shrink-0', sortBatch === 'none' ? 'text-muted-foreground/20 cursor-grab' : 'text-transparent')} />

                    {/* Seletor de loja (com opção Manual) */}
                    {modoCusto && fonte.mostrarLojas && lojasItem.length > 0 && (
                      <Select
                        value={manualAtivo ? '_manual' : (bEntry.loja_id || 'sem')}
                        onValueChange={v => {
                          if (v === '_manual') {
                            const cur = getPrecoItem(bEntry)
                            setPrecoManualValor(prev => ({ ...prev, [bEntry.item_id]: cur != null ? String(cur) : '' }))
                            setPrecoManualAtivo(prev => ({ ...prev, [bEntry.item_id]: true }))
                            setLoja(bEntry.item_id, 'sem')
                          } else {
                            setPrecoManualAtivo(prev => ({ ...prev, [bEntry.item_id]: false }))
                            setLoja(bEntry.item_id, v)
                          }
                        }}>
                        <SelectTrigger className="h-7 text-[10px] border-border/50 px-1.5 w-[88px] shrink-0">
                          <SelectValue placeholder="— loja —" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sem">— sem —</SelectItem>
                          {lojasItem.map(l => (
                            <SelectItem key={l.loja_id} value={l.loja_id}>{lojaMap[l.loja_id]?.nome ?? l.loja_id}</SelectItem>
                          ))}
                          <SelectItem value="_manual">✏ Manual</SelectItem>
                        </SelectContent>
                      </Select>
                    )}

                    <span className="flex-1 min-w-0 truncate" style={{
                      fontSize: `${fonte.tamanhoSelecionados}px`,
                      fontWeight: fonte.negritoSelecionados ? 600 : 500,
                      ...(fonte.corNomeSelecionados ? { color: fonte.corNomeSelecionados } : {}),
                    }}>{item?.nome ?? '—'}</span>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button onClick={() => setQtd(bEntry.item_id, bEntry.quantidade - 1)}
                        className="h-7 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors">
                        <Minus className="h-3 w-3" />
                      </button>
                      <Input type="number"
                        value={qtdInputs[bEntry.item_id] ?? String(bEntry.quantidade)}
                        onChange={e => setQtdInputs(prev => ({ ...prev, [bEntry.item_id]: e.target.value }))}
                        onBlur={() => {
                          const raw = qtdInputs[bEntry.item_id]
                          if (raw === undefined) return
                          const v = parseInt(raw)
                          if (!raw.trim() || isNaN(v)) setQtdInputs(prev => ({ ...prev, [bEntry.item_id]: String(bEntry.quantidade) }))
                          else setQtd(bEntry.item_id, v)
                        }}
                        className="h-7 w-14 text-center text-sm px-0.5" />
                      <button onClick={() => setQtd(bEntry.item_id, bEntry.quantidade + 1)}
                        className="h-7 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors">
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Preço: manual ativo = input, senão = display + lápis */}
                    {manualAtivo ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[9px] text-muted-foreground/50">R$</span>
                        <Input
                          type="text"
                          value={precoManualValor[bEntry.item_id] ?? ''}
                          onChange={e => setPrecoManualValor(prev => ({ ...prev, [bEntry.item_id]: e.target.value }))}
                          placeholder="0,00"
                          className="h-7 w-20 text-right text-xs px-1 tabular-nums"
                          autoFocus
                        />
                        <button
                          onClick={() => setPrecoManualAtivo(prev => ({ ...prev, [bEntry.item_id]: false }))}
                          title="Cancelar preço manual"
                          className="shrink-0 h-5 w-5 rounded flex items-center justify-center text-muted-foreground/40 hover:text-destructive transition-colors">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 shrink-0">
                        <div className="flex flex-col items-end min-w-[100px]">
                          {preco != null && bEntry.quantidade > 1 && (
                            <span className="text-[9px] text-muted-foreground/40 tabular-nums">{bEntry.quantidade} × {fmt(preco)}</span>
                          )}
                          {peso != null && peso > 0 && (
                            <span className="text-[9px] text-muted-foreground/40 tabular-nums">{fmtKg(peso)}</span>
                          )}
                          {total != null ? (
                            <span className="tabular-nums font-semibold" style={{
                              fontSize: `${fonte.tamanhoSelecionados}px`,
                              color: fonte.corValorSelecionados || (modoSujo ? '#fb923c' : '#34d399'),
                            }}>{fmt(total)}</span>
                          ) : <span className="text-muted-foreground/30 text-sm">—</span>}
                        </div>
                        {/* Lápis para items sem loja (em modo custo) */}
                        {modoCusto && lojasItem.length === 0 && (
                          <button
                            onClick={() => {
                              const cur = getPrecoItem(bEntry)
                              setPrecoManualValor(prev => ({ ...prev, [bEntry.item_id]: cur != null ? String(cur) : '' }))
                              setPrecoManualAtivo(prev => ({ ...prev, [bEntry.item_id]: true }))
                            }}
                            title="Inserir preço manualmente"
                            className="shrink-0 h-5 w-5 rounded flex items-center justify-center text-muted-foreground/20 hover:text-foreground transition-colors">
                            <Pencil className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    )}

                    <button onClick={() => removeFromBatch(bEntry.item_id)}
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

          </div>
        )}
      </div>

      {/* Handle resize col2-col3 */}
      <div
        className="w-1 shrink-0 cursor-col-resize hover:bg-primary/40 transition-colors z-10"
        onMouseDown={e => startResize('col3', e)}
      />

      {/* ── Col 3: Resumo + Ingredientes ── */}
      <div style={{ width: colWidths.col3 + 'px' }} className="shrink-0 border-l border-border flex flex-col overflow-hidden bg-muted/[0.02]">

        {/* Header */}
        <div className="px-3 py-3 border-b border-border shrink-0 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Resumo</p>
          {(batch.length + comboBatch.length) > 0 && (
            <button onClick={enviarImgbbResumo} disabled={imgbbResumoLoading}
              title="Gerar imagem do resumo + materiais (copia URL)"
              className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40">
              {imgbbResumoLoading ? <span className="text-[10px]">...</span> : <Image className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>

        {(batch.length + comboBatch.length) === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[11px] text-muted-foreground/40 text-center px-3">Vazio</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto flex flex-col">

            {/* Itens consolidados com quantidade e peso */}
            <div
              className="px-3 py-3 space-y-1 border-b border-border/50 select-text"
              onCopy={e => {
                const sel = window.getSelection()?.toString().trim()
                if (!sel) return
                const linhas = resumoItens
                  .filter(item => sel.includes(item.nome))
                  .map(item => `${item.nome} ${item.quantidade}×`)
                if (linhas.length > 0) {
                  e.preventDefault()
                  e.clipboardData.setData('text/plain', linhas.join('\n'))
                }
              }}
            >
              {resumoItens.map(entry => {
                const riscado = riscadosResumo.has(entry.item_id)
                return (
                  <div
                    key={entry.item_id}
                    className="flex items-baseline justify-between gap-1 min-w-0 cursor-pointer"
                    onClick={() => {
                      if ((window.getSelection()?.toString() ?? '') !== '') return
                      setRiscadosResumo(prev => {
                        const next = new Set(prev)
                        if (next.has(entry.item_id)) next.delete(entry.item_id)
                        else next.add(entry.item_id)
                        return next
                      })
                    }}
                  >
                    <span
                      className="text-foreground/70 truncate transition-all"
                      style={{
                        fontSize: `${fonte.tamanhoResumo}px`,
                        textDecoration: riscado ? 'line-through' : 'none',
                        opacity: riscado ? 0.4 : 1,
                      }}
                    >{entry.nome}</span>
                    <span
                      className="text-muted-foreground shrink-0 tabular-nums text-right transition-all"
                      style={{
                        fontSize: `${fonte.tamanhoResumo}px`,
                        textDecoration: riscado ? 'line-through' : 'none',
                        opacity: riscado ? 0.4 : 1,
                      }}
                    >
                      {entry.quantidade}×{entry.pesoTotal > 0 ? ` · ${fmtKg(entry.pesoTotal)}` : ''}
                    </span>
                  </div>
                )
              })}
              {resumoItens.some(e => e.pesoTotal > 0) && (
                <div className="flex justify-between pt-1 border-t border-border/30 mt-1" style={{ fontSize: `${fonte.tamanhoResumo}px` }}>
                  <span className="text-muted-foreground">Peso</span>
                  <span className="tabular-nums text-muted-foreground">{fmtKg(resumoItens.reduce((a, e) => a + e.pesoTotal, 0))}</span>
                </div>
              )}
            </div>

            {/* Ingredientes */}
            <div className="flex flex-col border-t border-border/40">
              <div className="px-3 py-2 border-b border-border/30">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Materiais
                  {ingredientesAgregados.length > 0 && <span className="ml-1 normal-case font-normal opacity-60">({ingredientesAgregados.length})</span>}
                </p>
              </div>
              <div className="px-3 py-2.5 space-y-2">
                {ingredientesAgregados.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground/40">Nenhum item com receita.</p>
                ) : (
                  <>
                    {ingredientesAgregados.map(ing => {
                      const manAtivo = precoManualIngAtivo[ing.ingrediente_id] ?? false
                      const manV = manAtivo ? parseFloat((precoManualIngValor[ing.ingrediente_id] ?? '').replace(',', '.')) : NaN
                      const lojaId = lojasPorIng[ing.ingrediente_id]
                      const lp = lojaId ? ing.lojasDisponiveis.find(l => l.loja_id === lojaId) : null
                      const lojaPrecoUnit = lp ? (modoSujo && lp.preco_sujo != null ? lp.preco_sujo : lp.preco) : null
                      const precoUnit = manAtivo && !isNaN(manV) ? manV : lojaPrecoUnit
                      const subtotal = precoUnit != null ? precoUnit * ing.totalQty : null
                      return (
                        <div key={ing.ingrediente_id} className="space-y-0.5">
                          <div className="flex items-baseline justify-between gap-1 min-w-0">
                            <span className="text-foreground/80 truncate" style={{ fontSize: `${fonte.tamanhoResumo}px` }}>{ing.ingrediente?.nome ?? ing.ingrediente_id}</span>
                            <span className="text-muted-foreground shrink-0 tabular-nums text-right" style={{ fontSize: `${fonte.tamanhoResumo}px` }}>
                              {fmtNum(ing.totalQty)}×{ing.totalPeso > 0 ? ` · ${fmtKg(ing.totalPeso)}` : ''}
                            </span>
                          </div>
                          {modoCusto && (
                            <div className="flex items-center gap-1">
                              {!manAtivo && ing.lojasDisponiveis.length > 0 && (
                                <Select
                                  value={lojasPorIng[ing.ingrediente_id] ?? 'sem'}
                                  onValueChange={v => setLojasPorIng(prev => ({ ...prev, [ing.ingrediente_id]: v === 'sem' ? '' : v }))}
                                >
                                  <SelectTrigger className="h-5 text-[9px] border-border/50 px-1 flex-1">
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
                              {manAtivo ? (
                                <div className="flex items-center gap-1 flex-1">
                                  <span className="text-[9px] text-muted-foreground/50">R$</span>
                                  <Input
                                    type="text"
                                    value={precoManualIngValor[ing.ingrediente_id] ?? ''}
                                    onChange={e => setPrecoManualIngValor(prev => ({ ...prev, [ing.ingrediente_id]: e.target.value }))}
                                    placeholder="0,00"
                                    className="h-5 flex-1 text-right text-[10px] px-1 tabular-nums"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => setPrecoManualIngAtivo(prev => ({ ...prev, [ing.ingrediente_id]: false }))}
                                    className="h-4 w-4 flex items-center justify-center text-muted-foreground/40 hover:text-destructive transition-colors shrink-0">
                                    <X className="h-2.5 w-2.5" />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <span className={cn('text-[10px] tabular-nums shrink-0', subtotal != null ? 'text-foreground/60' : 'text-muted-foreground/30')}>
                                    {subtotal != null ? fmt(subtotal) : '—'}
                                  </span>
                                  <button
                                    onClick={() => {
                                      setPrecoManualIngValor(prev => ({ ...prev, [ing.ingrediente_id]: precoUnit != null ? String(precoUnit) : '' }))
                                      setPrecoManualIngAtivo(prev => ({ ...prev, [ing.ingrediente_id]: true }))
                                    }}
                                    title="Inserir preço manualmente"
                                    className="h-4 w-4 flex items-center justify-center text-muted-foreground/20 hover:text-foreground transition-colors shrink-0">
                                    <Pencil className="h-2.5 w-2.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {/* Total custo ingredientes */}
                    {modoCusto && totais.custoIng > 0 && (
                      <div className="pt-2 border-t border-border/40 flex justify-between font-semibold" style={{ fontSize: `${fonte.tamanhoResumo}px` }}>
                        <span className="text-muted-foreground">Total</span>
                        <span className={cn('tabular-nums', modoSujo ? 'text-orange-400' : 'text-emerald-400')}>
                          {fmt(totais.custoIng)}
                        </span>
                      </div>
                    )}
                    {/* Peso total dos materiais */}
                    {ingredientesAgregados.some(i => i.totalPeso > 0) && (
                      <div className="flex justify-between" style={{ fontSize: `${fonte.tamanhoResumo}px` }}>
                        <span className="text-muted-foreground">Peso mat.</span>
                        <span className="tabular-nums text-muted-foreground">{fmtKg(ingredientesAgregados.reduce((s, i) => s + i.totalPeso, 0))}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

          </div>
        )}
      </div>

      {/* ── Modal de configuração de fonte ── */}
      <Dialog open={fonteModalAberto} onOpenChange={setFonteModalAberto}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Configurar exibição</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-1 max-h-[70vh] overflow-y-auto pr-1">

            {/* ── Lista (Col 1) ── */}
            <div className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border-b border-border/40 pb-1">Lista</p>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tamanho da letra</Label>
                <div className="flex items-center gap-3">
                  <button onClick={() => salvarFonte({ ...fonte, tamanho: Math.max(10, fonte.tamanho - 1) })}
                    className="h-7 w-7 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="text-sm tabular-nums w-12 text-center">{fonte.tamanho}px</span>
                  <button onClick={() => salvarFonte({ ...fonte, tamanho: Math.min(20, fonte.tamanho + 1) })}
                    className="h-7 w-7 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                    <Plus className="h-3 w-3" />
                  </button>
                  <span className="ml-2 truncate" style={{ fontSize: `${fonte.tamanho}px`, fontWeight: fonte.negrito ? 600 : 400 }}>Preview</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Negrito</Label>
                <Switch checked={fonte.negrito} onCheckedChange={v => salvarFonte({ ...fonte, negrito: v })} />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Cor do nome</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={fonte.corNome || '#cbd5e1'}
                    onChange={e => salvarFonte({ ...fonte, corNome: e.target.value })}
                    className="h-7 w-10 rounded border border-border cursor-pointer bg-transparent" />
                  {fonte.corNome && (
                    <button onClick={() => salvarFonte({ ...fonte, corNome: '' })}
                      className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">Padrão</button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Cor dos valores</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={fonte.corValor || '#34d399'}
                    onChange={e => salvarFonte({ ...fonte, corValor: e.target.value })}
                    className="h-7 w-10 rounded border border-border cursor-pointer bg-transparent" />
                  {fonte.corValor && (
                    <button onClick={() => salvarFonte({ ...fonte, corValor: '' })}
                      className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">Padrão</button>
                  )}
                </div>
              </div>
            </div>

            {/* ── Orçamento (Col 2) ── */}
            <div className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border-b border-border/40 pb-1">Orçamento</p>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tamanho da letra</Label>
                <div className="flex items-center gap-3">
                  <button onClick={() => salvarFonte({ ...fonte, tamanhoSelecionados: Math.max(10, fonte.tamanhoSelecionados - 1) })}
                    className="h-7 w-7 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="text-sm tabular-nums w-12 text-center">{fonte.tamanhoSelecionados}px</span>
                  <button onClick={() => salvarFonte({ ...fonte, tamanhoSelecionados: Math.min(20, fonte.tamanhoSelecionados + 1) })}
                    className="h-7 w-7 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                    <Plus className="h-3 w-3" />
                  </button>
                  <span className="ml-2 truncate" style={{ fontSize: `${fonte.tamanhoSelecionados}px`, fontWeight: fonte.negritoSelecionados ? 600 : 400 }}>Preview</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Negrito</Label>
                <Switch checked={fonte.negritoSelecionados} onCheckedChange={v => salvarFonte({ ...fonte, negritoSelecionados: v })} />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Cor do nome</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={fonte.corNomeSelecionados || '#cbd5e1'}
                    onChange={e => salvarFonte({ ...fonte, corNomeSelecionados: e.target.value })}
                    className="h-7 w-10 rounded border border-border cursor-pointer bg-transparent" />
                  {fonte.corNomeSelecionados && (
                    <button onClick={() => salvarFonte({ ...fonte, corNomeSelecionados: '' })}
                      className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">Padrão</button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Cor dos valores</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={fonte.corValorSelecionados || '#34d399'}
                    onChange={e => salvarFonte({ ...fonte, corValorSelecionados: e.target.value })}
                    className="h-7 w-10 rounded border border-border cursor-pointer bg-transparent" />
                  {fonte.corValorSelecionados && (
                    <button onClick={() => salvarFonte({ ...fonte, corValorSelecionados: '' })}
                      className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">Padrão</button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Mostrar lojas</Label>
                <Switch checked={fonte.mostrarLojas} onCheckedChange={v => salvarFonte({ ...fonte, mostrarLojas: v })} />
              </div>
            </div>

            {/* ── Resumo (Col 3) ── */}
            <div className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border-b border-border/40 pb-1">Resumo</p>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tamanho da letra</Label>
                <div className="flex items-center gap-3">
                  <button onClick={() => salvarFonte({ ...fonte, tamanhoResumo: Math.max(8, fonte.tamanhoResumo - 1) })}
                    className="h-7 w-7 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="text-sm tabular-nums w-12 text-center">{fonte.tamanhoResumo}px</span>
                  <button onClick={() => salvarFonte({ ...fonte, tamanhoResumo: Math.min(18, fonte.tamanhoResumo + 1) })}
                    className="h-7 w-7 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                    <Plus className="h-3 w-3" />
                  </button>
                  <span className="ml-2 truncate text-foreground/70" style={{ fontSize: `${fonte.tamanhoResumo}px` }}>Preview</span>
                </div>
              </div>
            </div>

            {/* Reset geral */}
            {(fonte.tamanho !== FONTE_PADRAO.tamanho || fonte.tamanhoSelecionados !== FONTE_PADRAO.tamanhoSelecionados || fonte.tamanhoResumo !== FONTE_PADRAO.tamanhoResumo || fonte.negrito || fonte.negritoSelecionados || fonte.corNome || fonte.corNomeSelecionados || fonte.corValor || fonte.corValorSelecionados || !fonte.mostrarLojas) && (
              <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={() => salvarFonte(FONTE_PADRAO)}>
                Restaurar padrões
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

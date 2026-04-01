'use client'

import { useState, useMemo, useCallback, useRef, memo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Search, Star, Package, Plus, X, Minus, Copy, Check } from 'lucide-react'
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
}

type BatchEntry = { item_id: string; quantidade: number; loja_id: string }
type Aba = 'favoritos' | 'meus' | 'todos'
type Modo = 'simples' | 'producao'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}
function fmtKg(kg: number) {
  if (kg === 0) return '—'
  return `${kg % 1 === 0 ? kg : kg.toFixed(2)} kg`
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

// ── Componente principal ──────────────────────────────────────────────────────

export function CalculadoraClient({
  userId, items, precosVigentes, lojas, lojaPrecos, faccaoPrecos,
  meuLojaId, meuFaccaoId, favoritosIniciais, podeEditar = true,
}: Props) {
  const sbRef = useRef<ReturnType<typeof createClient> | null>(null)
  const sb = useCallback(() => { if (!sbRef.current) sbRef.current = createClient(); return sbRef.current }, [])

  const [busca, setBusca] = useState('')
  const [aba, setAba] = useState<Aba>('todos')
  const [batch, setBatch] = useState<BatchEntry[]>([])
  const [favoritos, setFavoritos] = useState<Set<string>>(new Set(favoritosIniciais))
  const [modoSujo, setModoSujo] = useState(false)
  const [modo, setModo] = useState<Modo>('simples')
  const [copied, setCopied] = useState(false)

  const favoritosRef = useRef(favoritos)
  favoritosRef.current = favoritos

  // ── Mapas ─────────────────────────────────────────────────────────────────

  const itemMap = useMemo(() => Object.fromEntries(items.map(i => [i.id, i])), [items])
  const lojaMap = useMemo(() => Object.fromEntries(lojas.map(l => [l.id, l])), [lojas])

  // Preços padrão: prioridade loja/facção do usuário; fallback = item_preco_vigente
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
    const ids = new Set(Object.keys(meuPrecoMap))
    items.forEach(i => { if (i.meu_produto_usuario_id === userId) ids.add(i.id) })
    return ids
  }, [meuPrecoMap, items, userId])

  // Lojas disponíveis por item
  const lojaPrecoPorItem = useMemo(() => {
    const map: Record<string, LojaPreco[]> = {}
    lojaPrecos.forEach(lp => {
      if (!map[lp.item_id]) map[lp.item_id] = []
      map[lp.item_id].push(lp)
    })
    return map
  }, [lojaPrecos])

  // Lista de itens filtrada — TODOS os ativos (não só tem_craft)
  const itensFiltrados = useMemo(() => {
    let lista = items
    if (aba === 'favoritos') lista = lista.filter(i => favoritos.has(i.id))
    if (aba === 'meus') lista = lista.filter(i => meusItemIds.has(i.id))
    if (busca.trim()) {
      const q = busca.toLowerCase()
      lista = lista.filter(i =>
        i.nome.toLowerCase().includes(q) || i.categorias_item?.nome.toLowerCase().includes(q)
      )
    }
    return lista
  }, [items, aba, favoritos, busca, meusItemIds])

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

  // Preço efetivo de um item do batch
  const getPrecoItem = useCallback((entry: BatchEntry): number | null => {
    if (entry.loja_id) {
      const lp = lojaPrecos.find(l => l.loja_id === entry.loja_id && l.item_id === entry.item_id)
      if (lp) return modoSujo && lp.preco_sujo != null ? lp.preco_sujo : lp.preco
    }
    const p = meuPrecoMap[entry.item_id]
    if (!p) return null
    return modoSujo ? (p.preco_sujo ?? p.preco_limpo) : (p.preco_limpo ?? p.preco_sujo)
  }, [lojaPrecos, meuPrecoMap, modoSujo])

  // ── Ingredientes agregados ────────────────────────────────────────────────

  const ingredientesAgregados = useMemo(() => {
    const map: Record<string, { ingrediente: Item | null; totalQty: number; totalPeso: number }> = {}
    for (const { item_id, quantidade } of batch) {
      const item = itemMap[item_id]
      if (!item?.item_receita?.length) continue
      for (const r of item.item_receita) {
        const qtd = r.quantidade * quantidade
        if (!map[r.ingrediente_id]) {
          map[r.ingrediente_id] = {
            ingrediente: itemMap[r.ingrediente_id] ?? null,
            totalQty: 0, totalPeso: 0,
          }
        }
        map[r.ingrediente_id].totalQty += qtd
        map[r.ingrediente_id].totalPeso += (itemMap[r.ingrediente_id]?.peso ?? 0) * qtd
      }
    }
    return Object.entries(map)
      .map(([id, v]) => ({ ingrediente_id: id, ...v }))
      .sort((a, b) => (a.ingrediente?.nome ?? '').localeCompare(b.ingrediente?.nome ?? ''))
  }, [batch, itemMap])

  // ── Totais ────────────────────────────────────────────────────────────────

  const totais = useMemo(() => {
    let custoTotal = 0, pesoProdutos = 0
    let custoCompleto = batch.length > 0
    for (const entry of batch) {
      const preco = getPrecoItem(entry)
      if (preco == null) custoCompleto = false
      else custoTotal += preco * entry.quantidade
      pesoProdutos += (itemMap[entry.item_id]?.peso ?? 0) * entry.quantidade
    }
    return { custoTotal, pesoProdutos, custoCompleto }
  }, [batch, getPrecoItem, itemMap])

  // ── Copiar resumo ─────────────────────────────────────────────────────────

  const copiarResumo = useCallback(() => {
    const linhas: string[] = ['=== CALCULADORA ===', '']
    for (const entry of batch) {
      const item = itemMap[entry.item_id]
      if (!item) continue
      const lojaNome = entry.loja_id ? (lojaMap[entry.loja_id]?.nome ?? '') : ''
      const preco = getPrecoItem(entry)
      const total = preco != null ? fmt(preco * entry.quantidade) : '—'
      const lojaPrefix = lojaNome ? `[${lojaNome}] ` : ''
      linhas.push(`${lojaPrefix}${item.nome} × ${entry.quantidade} = ${total}`)
    }
    linhas.push('')
    if (totais.custoTotal > 0) linhas.push(`TOTAL: ${fmt(totais.custoTotal)}`)
    if (totais.pesoProdutos > 0) linhas.push(`PESO: ${fmtKg(totais.pesoProdutos)}`)
    if (modo === 'producao' && ingredientesAgregados.length > 0) {
      linhas.push('', '--- Ingredientes ---')
      for (const ing of ingredientesAgregados) {
        const nome = ing.ingrediente?.nome ?? ing.ingrediente_id
        const peso = ing.totalPeso > 0 ? ` (${fmtKg(ing.totalPeso)})` : ''
        linhas.push(`${nome}: ${ing.totalQty}×${peso}`)
      }
    }
    navigator.clipboard.writeText(linhas.join('\n')).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [batch, itemMap, lojaMap, getPrecoItem, totais, modo, ingredientesAgregados])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-[calc(100vh-3rem)] flex overflow-hidden">

      {/* ── Col 1: Lista de itens ── */}
      <aside className="w-72 shrink-0 flex flex-col border-r border-border">
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar item..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
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
      <div className="w-80 shrink-0 flex flex-col border-r border-border bg-muted/[0.03] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Selecionados{batch.length > 0 && <span className="text-foreground ml-1">({batch.length})</span>}
          </h3>
          {batch.length > 0 && (
            <button onClick={() => setBatch([])}
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
                  <div key={entry.item_id} className="px-3 py-2.5 space-y-1.5">
                    {/* Linha 1: loja + nome + remover */}
                    <div className="flex items-center gap-1.5">
                      {lojasItem.length > 0 && (
                        <Select value={entry.loja_id || 'sem'} onValueChange={v => setLoja(entry.item_id, v)}>
                          <SelectTrigger className="h-6 text-[10px] border-border/60 px-2 w-auto max-w-[96px] shrink-0">
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
                      <span className="flex-1 text-sm font-medium truncate min-w-0">{item?.nome ?? '—'}</span>
                      <button onClick={() => removeFromBatch(entry.item_id)}
                        className="shrink-0 h-5 w-5 rounded flex items-center justify-center text-muted-foreground/40 hover:text-destructive transition-colors">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                    {/* Linha 2: controles qtd + total */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => setQtd(entry.item_id, entry.quantidade - 1)}
                          className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors">
                          <Minus className="h-3 w-3" />
                        </button>
                        <Input type="number" value={entry.quantidade}
                          onChange={e => setQtd(entry.item_id, Math.max(1, parseInt(e.target.value) || 1))}
                          className="h-6 w-12 text-center text-xs px-1" />
                        <button onClick={() => setQtd(entry.item_id, entry.quantidade + 1)}
                          className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors">
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 ml-auto text-xs">
                        {peso != null && peso > 0 && (
                          <span className="text-[10px] text-muted-foreground/60 tabular-nums">{fmtKg(peso)}</span>
                        )}
                        {total != null ? (
                          <span className={cn('tabular-nums font-semibold', modoSujo ? 'text-orange-400' : 'text-emerald-400')}>
                            {fmt(total)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/30">—</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Total rápido */}
            <div className="px-3 py-3 border-t border-border/60 bg-muted/[0.04] shrink-0 space-y-1">
              {totais.custoTotal > 0 ? (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className={cn('font-bold tabular-nums', modoSujo ? 'text-orange-400' : 'text-emerald-400')}>
                    {fmt(totais.custoTotal)}
                    {!totais.custoCompleto && (
                      <span className="text-[10px] font-normal text-muted-foreground ml-1">*parcial</span>
                    )}
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
          {/* Toggle simples / produção */}
          <div className="flex bg-muted/40 rounded-md p-0.5 gap-0.5">
            {(['simples', 'producao'] as Modo[]).map(m => (
              <button key={m} onClick={() => setModo(m)}
                className={cn(
                  'px-3 py-1 rounded text-xs font-medium transition-colors',
                  modo === m
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}>
                {m === 'simples' ? 'Simples' : 'Produção'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Label className="text-[11px] text-muted-foreground">Sujo</Label>
              <Switch checked={modoSujo} onCheckedChange={setModoSujo} />
            </div>
            {batch.length > 0 && (
              <button onClick={copiarResumo}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                {copied
                  ? <Check className="h-3.5 w-3.5 text-emerald-400" />
                  : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? 'Copiado!' : 'Copiar'}</span>
              </button>
            )}
          </div>
        </div>

        {batch.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-muted-foreground text-center px-4">
              Adicione itens para ver o resumo
            </p>
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

            {/* Totais */}
            <div className="pt-3 border-t border-border/60 space-y-1.5">
              {totais.custoTotal > 0 && (
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-muted-foreground">Total</span>
                  <span className={cn('tabular-nums', modoSujo ? 'text-orange-400' : 'text-emerald-400')}>
                    {fmt(totais.custoTotal)}
                    {!totais.custoCompleto && (
                      <span className="text-[10px] font-normal text-muted-foreground ml-1">*parcial</span>
                    )}
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
                <div className="space-y-1.5">
                  {ingredientesAgregados.map(ing => (
                    <div key={ing.ingrediente_id} className="flex items-center justify-between text-xs">
                      <span className="text-foreground/80">{ing.ingrediente?.nome ?? ing.ingrediente_id}</span>
                      <div className="flex items-center gap-2 text-muted-foreground shrink-0">
                        {ing.totalPeso > 0 && (
                          <span className="tabular-nums">{fmtKg(ing.totalPeso)}</span>
                        )}
                        <span className="tabular-nums font-medium text-foreground/70">{ing.totalQty}×</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {modo === 'producao' && ingredientesAgregados.length === 0 && (
              <div className="pt-3 border-t border-border/60">
                <p className="text-xs text-muted-foreground">
                  Nenhum item selecionado tem receita cadastrada.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState, useMemo, useCallback, useRef, memo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Search, Star, Package, Plus, X, Minus } from 'lucide-react'
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

type BatchEntry = { item_id: string; quantidade: number }
type Aba = 'favoritos' | 'meus' | 'todos'

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
          {item.item_receita.length === 0 && (
            <span className="text-[10px] text-orange-500/60">sem receita</span>
          )}
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
      <button onMouseDown={e => e.preventDefault()} onClick={e => podeEditar && onToggleFav(item.id, e)}
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

export function CalculadoraClient({ userId, items, precosVigentes, lojas, lojaPrecos, faccaoPrecos, meuLojaId, meuFaccaoId, favoritosIniciais, podeEditar = true }: Props) {
  const sbRef = useRef<ReturnType<typeof createClient> | null>(null)
  const sb = useCallback(() => { if (!sbRef.current) sbRef.current = createClient(); return sbRef.current }, [])

  const [busca, setBusca] = useState('')
  const [aba, setAba] = useState<Aba>('todos')
  const [batch, setBatch] = useState<BatchEntry[]>([])
  const [favoritos, setFavoritos] = useState<Set<string>>(new Set(favoritosIniciais))
  const [lojasPorIng, setLojasPorIng] = useState<Record<string, string>>({})
  const [modoSujo, setModoSujo] = useState(false)
  const [desconto, setDesconto] = useState('')

  const favoritosRef = useRef(favoritos)
  favoritosRef.current = favoritos

  // ── Mapas ─────────────────────────────────────────────────────────────────

  const itemMap   = useMemo(() => Object.fromEntries(items.map(i => [i.id, i])), [items])
  const lojaMap   = useMemo(() => Object.fromEntries(lojas.map(l => [l.id, l])), [lojas])

  // Preços de venda: prioridade loja/facção do usuário; fallback = item_preco_vigente (global)
  const meuPrecoMap = useMemo(() => {
    const map: Record<string, { preco_limpo: number | null; preco_sujo: number | null }> = {}
    // Primeiro preenche com preços vigentes globais (fallback)
    precosVigentes.forEach(p => { map[p.item_id] = { preco_limpo: p.preco_limpo, preco_sujo: p.preco_sujo } })
    // Depois sobrescreve com preços específicos da loja do usuário
    if (meuLojaId) {
      lojaPrecos.filter(lp => lp.loja_id === meuLojaId).forEach(lp => {
        map[lp.item_id] = { preco_limpo: lp.preco, preco_sujo: lp.preco_sujo }
      })
    }
    // E da facção do usuário (só onde não há preço de loja)
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
    // Também inclui itens manualmente marcados pelo usuário (extras sem preço na loja/facção)
    items.forEach(i => { if (i.meu_produto_usuario_id === userId) ids.add(i.id) })
    return ids
  }, [meuPrecoMap, items, userId])

  const lojaPrecoPorItem = useMemo(() => {
    const map: Record<string, LojaPreco[]> = {}
    lojaPrecos.forEach(lp => { if (!map[lp.item_id]) map[lp.item_id] = []; map[lp.item_id].push(lp) })
    return map
  }, [lojaPrecos])

  const itensCraft    = useMemo(() => items.filter(i => i.tem_craft), [items])
  const itensFiltrados = useMemo(() => {
    // "Meus" mostra todos os itens do usuário (com ou sem craft) — para testar preços
    let lista = aba === 'meus' ? items.filter(i => meusItemIds.has(i.id)) : itensCraft
    if (aba === 'favoritos') lista = lista.filter(i => favoritos.has(i.id))
    if (busca.trim()) {
      const q = busca.toLowerCase()
      lista = lista.filter(i =>
        i.nome.toLowerCase().includes(q) || i.categorias_item?.nome.toLowerCase().includes(q)
      )
    }
    return lista
  }, [itensCraft, aba, favoritos, busca, meusItemIds])

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

  const addToBatch    = useCallback((itemId: string) => {
    setBatch(prev => prev.some(b => b.item_id === itemId) ? prev : [...prev, { item_id: itemId, quantidade: 1 }])
  }, [])
  const removeFromBatch = useCallback((itemId: string) => {
    setBatch(prev => prev.filter(b => b.item_id !== itemId))
  }, [])
  const setQtd = useCallback((itemId: string, qtd: number) => {
    if (qtd <= 0) { setBatch(prev => prev.filter(b => b.item_id !== itemId)); return }
    setBatch(prev => prev.map(b => b.item_id === itemId ? { ...b, quantidade: qtd } : b))
  }, [])

  // ── Ingredientes agregados ────────────────────────────────────────────────

  const ingredientesAgregados = useMemo(() => {
    const map: Record<string, {
      ingrediente: Item | null; totalQty: number; totalPeso: number; lojasDisponiveis: LojaPreco[]
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
        map[r.ingrediente_id].totalQty  += qtd
        map[r.ingrediente_id].totalPeso += (itemMap[r.ingrediente_id]?.peso ?? 0) * qtd
      }
    }
    return Object.entries(map)
      .map(([id, v]) => ({ ingrediente_id: id, ...v }))
      .sort((a, b) => (a.ingrediente?.nome ?? '').localeCompare(b.ingrediente?.nome ?? ''))
  }, [batch, itemMap, lojaPrecoPorItem])

  // ── Totais ────────────────────────────────────────────────────────────────

  const totais = useMemo(() => {
    let pesoProdutos = 0, pesoIngredientes = 0, custoTotal = 0
    let custoCompleto = ingredientesAgregados.length > 0
    for (const { item_id, quantidade } of batch)
      pesoProdutos += (itemMap[item_id]?.peso ?? 0) * quantidade
    for (const ing of ingredientesAgregados) {
      pesoIngredientes += ing.totalPeso
      const lojaId = lojasPorIng[ing.ingrediente_id]
      const lp = lojaId ? ing.lojasDisponiveis.find(l => l.loja_id === lojaId) : null
      const precoUnit = lp ? (modoSujo && lp.preco_sujo != null ? lp.preco_sujo : lp.preco) : null
      if (precoUnit == null) custoCompleto = false
      else custoTotal += precoUnit * ing.totalQty
    }
    return { pesoProdutos, pesoIngredientes, custoTotal, custoCompleto }
  }, [batch, itemMap, ingredientesAgregados, lojasPorIng, modoSujo])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-[calc(100vh-3rem)] flex overflow-hidden">

      {/* ── Col 1: Lista de itens ── */}
      <aside className="w-72 shrink-0 flex flex-col border-r border-border">
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)}
              className="pl-8 h-8 text-sm" />
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
              {aba === 'favoritos' ? 'Nenhum favorito' : 'Nenhum item com craft'}
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

      {/* ── Col 2: Itens a produzir + Preços ── */}
      <div className="flex-1 flex flex-col border-r border-border bg-muted/[0.03] overflow-y-auto">
        {batch.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
            <Package className="h-10 w-10 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">Clique em + nos itens para adicionar à produção</p>
          </div>
        ) : (
          <div className="p-4 space-y-5">

            {/* Itens a produzir */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Itens a produzir</h3>
                <button onClick={() => { setBatch([]); setLojasPorIng({}) }}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1">
                  <X className="h-3 w-3" /> Limpar
                </button>
              </div>
              <div className="divide-y divide-border/40">
                {batch.map(({ item_id, quantidade }) => {
                  const item = itemMap[item_id]
                  return (
                    <div key={item_id} className="flex items-center gap-2 py-2.5">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{item?.nome ?? '—'}</div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {item?.peso != null && (
                            <span className="text-[10px] text-muted-foreground">
                              {fmtKg(item.peso * quantidade)} produzidos
                            </span>
                          )}
                          {meuPrecoMap[item_id]?.preco_limpo != null && (
                            <span className="text-[10px] text-emerald-400/80 tabular-nums">
                              {quantidade > 1 ? `${quantidade} × ` : ''}{fmt(meuPrecoMap[item_id].preco_limpo! * quantidade)} L
                            </span>
                          )}
                          {meuPrecoMap[item_id]?.preco_sujo != null && (
                            <span className="text-[10px] text-orange-400/70 tabular-nums">
                              {quantidade > 1 ? `${quantidade} × ` : ''}{fmt(meuPrecoMap[item_id].preco_sujo! * quantidade)} S
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button onClick={() => setQtd(item_id, quantidade - 1)}
                          className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors">
                          <Minus className="h-3 w-3" />
                        </button>
                        <Input type="number" value={quantidade}
                          onChange={e => setQtd(item_id, Math.max(1, parseInt(e.target.value) || 1))}
                          className="h-6 w-12 text-center text-xs px-1" />
                        <button onClick={() => setQtd(item_id, quantidade + 1)}
                          className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors">
                          <Plus className="h-3 w-3" />
                        </button>
                        <button onClick={() => removeFromBatch(item_id)}
                          className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-white/[0.06] transition-colors ml-0.5">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Resumo de pesos */}
            {(totais.pesoProdutos > 0 || totais.pesoIngredientes > 0) && (
              <div className="pt-3 border-t border-border/40 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Peso produzido</span>
                  <span className="font-medium tabular-nums">
                    {totais.pesoProdutos > 0 ? fmtKg(totais.pesoProdutos) : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Peso ingredientes</span>
                  <span className="font-medium tabular-nums">
                    {totais.pesoIngredientes > 0 ? fmtKg(totais.pesoIngredientes) : '—'}
                  </span>
                </div>
              </div>
            )}

            {/* Preços de venda */}
            {batch.some(b => meusItemIds.has(b.item_id) && meuPrecoMap[b.item_id]) && (() => {
              const linhas = batch
                .filter(b => meusItemIds.has(b.item_id) && meuPrecoMap[b.item_id])
                .map(({ item_id, quantidade }) => ({
                  nome:         itemMap[item_id]!.nome,
                  quantidade,
                  unitSujo:     meuPrecoMap[item_id]?.preco_sujo ?? null,
                  unitLimpo:    meuPrecoMap[item_id]?.preco_limpo ?? null,
                  totalSujo:    meuPrecoMap[item_id]?.preco_sujo  != null ? meuPrecoMap[item_id]!.preco_sujo!  * quantidade : null,
                  totalLimpo:   meuPrecoMap[item_id]?.preco_limpo != null ? meuPrecoMap[item_id]!.preco_limpo! * quantidade : null,
                }))
              const somaSujo  = linhas.reduce((s, l) => l.totalSujo  != null ? s + l.totalSujo  : s, 0)
              const somaLimpo = linhas.reduce((s, l) => l.totalLimpo != null ? s + l.totalLimpo : s, 0)
              const pct   = parseFloat(desconto)
              const fator = !isNaN(pct) && pct > 0 ? (1 - pct / 100) : null

              return (
                <div className="pt-3 border-t border-border/40 space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Preços de Venda
                  </h3>

                  {/* Linhas por item */}
                  {linhas.map((l, i) => (
                    <div key={i} className="space-y-1">
                      <p className="text-xs font-medium text-foreground/80">{l.nome}</p>
                      <div className="grid grid-cols-2 gap-x-4 text-xs text-muted-foreground">
                        {l.unitLimpo != null && (
                          <div className="flex items-center gap-1 tabular-nums">
                            <span>{l.quantidade}</span>
                            <span className="text-muted-foreground/50">×</span>
                            <span>{fmt(l.unitLimpo)}</span>
                            <span className="text-muted-foreground/50">=</span>
                            <span className="text-emerald-400 font-medium">
                              {l.totalLimpo != null ? fmt(l.totalLimpo) : '—'}
                            </span>
                            <span className="text-muted-foreground/50 text-[10px]">L</span>
                          </div>
                        )}
                        {l.unitSujo != null && (
                          <div className="flex items-center gap-1 tabular-nums">
                            <span>{l.quantidade}</span>
                            <span className="text-muted-foreground/50">×</span>
                            <span>{fmt(l.unitSujo)}</span>
                            <span className="text-muted-foreground/50">=</span>
                            <span className="text-orange-400 font-medium">
                              {l.totalSujo != null ? fmt(l.totalSujo) : '—'}
                            </span>
                            <span className="text-muted-foreground/50 text-[10px]">S</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Totais gerais (só se mais de 1 item) */}
                  {linhas.length > 1 && (
                    <div className="pt-2 border-t border-border/40 flex gap-6 text-sm">
                      {somaLimpo > 0 && (
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase mb-0.5">Total Limpo</p>
                          <p className="font-bold text-emerald-400 tabular-nums">{fmt(somaLimpo)}</p>
                        </div>
                      )}
                      {somaSujo > 0 && (
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase mb-0.5">Total Sujo</p>
                          <p className="font-bold text-orange-400 tabular-nums">{fmt(somaSujo)}</p>
                        </div>
                      )}
                      {totais.custoTotal > 0 && somaLimpo > 0 && (
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase mb-0.5">Margem</p>
                          <p className={cn('font-bold tabular-nums',
                            (somaLimpo - totais.custoTotal) >= 0 ? 'text-emerald-400' : 'text-red-400'
                          )}>
                            {fmt(somaLimpo - totais.custoTotal)}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Desconto */}
                  <div className="pt-2 border-t border-border/40 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Desconto</span>
                    <Input type="number" placeholder="0" min="0" max="100"
                      value={desconto} onChange={e => setDesconto(e.target.value)}
                      className="h-7 w-16 text-sm text-right" />
                    <span className="text-xs text-muted-foreground">%</span>
                    {fator != null && somaLimpo > 0 && (
                      <span className="text-sm font-bold text-primary tabular-nums ml-auto">
                        {fmt(somaLimpo * fator)}
                      </span>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>
        )}
      </div>

      {/* ── Col 3: Ingredientes ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Ingredientes necessários
          </h3>
          <div className="flex items-center gap-2">
            {totais.custoTotal > 0 && (
              <span className="text-sm font-semibold tabular-nums text-primary">{fmt(totais.custoTotal)}</span>
            )}
            <Label className="text-xs text-muted-foreground">Sujo</Label>
            <Switch checked={modoSujo} onCheckedChange={setModoSujo} />
          </div>
        </div>

        {batch.length === 0 || ingredientesAgregados.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-muted-foreground text-center px-4">
              {batch.length === 0
                ? 'Adicione itens para ver os ingredientes'
                : 'Nenhum item selecionado tem receita cadastrada'}
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="divide-y divide-border/40">
              {ingredientesAgregados.map(ing => {
                const lojaId = lojasPorIng[ing.ingrediente_id]
                const lp = lojaId ? ing.lojasDisponiveis.find(l => l.loja_id === lojaId) : null
                const precoUnit = lp ? (modoSujo && lp.preco_sujo != null ? lp.preco_sujo : lp.preco) : null
                const subtotal = precoUnit != null ? precoUnit * ing.totalQty : null
                const pesoUnit = ing.ingrediente?.peso

                return (
                  <div key={ing.ingrediente_id} className="px-4 py-2 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="text-xs font-medium truncate">{ing.ingrediente?.nome ?? ing.ingrediente_id}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{ing.totalQty}×</span>
                        {pesoUnit != null && pesoUnit > 0 && (
                          <span className="text-[10px] text-muted-foreground/60 shrink-0">{fmtKg(ing.totalPeso)}</span>
                        )}
                      </div>
                      <span className={cn('text-xs tabular-nums font-medium shrink-0',
                        subtotal != null ? 'text-foreground' : 'text-muted-foreground'
                      )}>
                        {subtotal != null ? fmt(subtotal) : '—'}
                      </span>
                    </div>
                    {ing.lojasDisponiveis.length > 0 && (
                      <Select
                        value={lojasPorIng[ing.ingrediente_id] ?? 'sem'}
                        onValueChange={v => setLojasPorIng(prev => ({
                          ...prev, [ing.ingrediente_id]: v === 'sem' ? '' : v
                        }))}
                      >
                        <SelectTrigger className="h-6 text-[10px] text-muted-foreground border-0 shadow-none px-0 w-auto gap-1 hover:text-foreground">
                          <SelectValue placeholder="— loja —" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sem">— sem loja —</SelectItem>
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
                  </div>
                )
              })}
            </div>

            {totais.pesoIngredientes > 0 && (
              <div className="px-4 py-3 border-t border-border bg-white/[0.02]">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Peso total ingredientes</span>
                  <span className="font-medium text-foreground tabular-nums">{fmtKg(totais.pesoIngredientes)}</span>
                </div>
                {!totais.custoCompleto && totais.custoTotal > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    * custo parcial (algumas lojas não selecionadas)
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

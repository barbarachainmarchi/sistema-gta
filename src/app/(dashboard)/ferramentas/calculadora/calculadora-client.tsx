'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Search, Star, Package, Plus, X, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ── Tipos ────────────────────────────────────────────────────────────────────

type Item = {
  id: string
  nome: string
  tem_craft: boolean
  eh_meu_produto: boolean
  peso: number | null
  categorias_item: { nome: string } | null
  item_receita: { ingrediente_id: string; quantidade: number }[]
}

type PrecoVigente = { item_id: string; preco_sujo: number | null; preco_limpo: number | null }
type Loja = { id: string; nome: string }
type LojaPreco = { loja_id: string; item_id: string; preco: number; preco_sujo: number | null }

interface Props {
  userId: string
  items: Item[]
  precos: PrecoVigente[]
  lojas: Loja[]
  lojaPrecos: LojaPreco[]
  favoritosIniciais: string[]
}

type BatchEntry = { item_id: string; quantidade: number }

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function fmtKg(kg: number) {
  if (kg === 0) return '—'
  return `${kg % 1 === 0 ? kg : kg.toFixed(2)} kg`
}

type Aba = 'favoritos' | 'meus' | 'todos'

// ── Componente ───────────────────────────────────────────────────────────────

export function CalculadoraClient({ userId, items, precos, lojas, lojaPrecos, favoritosIniciais }: Props) {
  const sbRef = useRef<ReturnType<typeof createClient> | null>(null)
  const sb = useCallback(() => { if (!sbRef.current) sbRef.current = createClient(); return sbRef.current }, [])

  const [busca, setBusca] = useState('')
  const [aba, setAba] = useState<Aba>('todos')
  const [batch, setBatch] = useState<BatchEntry[]>([])
  const [favoritos, setFavoritos] = useState<Set<string>>(new Set(favoritosIniciais))
  const [lojasPorIng, setLojasPorIng] = useState<Record<string, string>>({})
  const [modoSujo, setModoSujo] = useState(false)

  // ── Mapas ──────────────────────────────────────────────────────────────────

  const itemMap = useMemo(() => Object.fromEntries(items.map(i => [i.id, i])), [items])
  const lojaMap = useMemo(() => Object.fromEntries(lojas.map(l => [l.id, l])), [lojas])
  const precoMap = useMemo(() => Object.fromEntries(precos.map(p => [p.item_id, p])), [precos])

  const lojaPrecoPorItem = useMemo(() => {
    const map: Record<string, LojaPreco[]> = {}
    lojaPrecos.forEach(lp => { if (!map[lp.item_id]) map[lp.item_id] = []; map[lp.item_id].push(lp) })
    return map
  }, [lojaPrecos])

  // ── Apenas itens com craft ─────────────────────────────────────────────────

  const itensCraft = useMemo(() => items.filter(i => i.tem_craft), [items])

  const itensFiltrados = useMemo(() => {
    let lista = itensCraft
    if (aba === 'favoritos') lista = lista.filter(i => favoritos.has(i.id))
    if (aba === 'meus') lista = lista.filter(i => i.eh_meu_produto)
    if (busca.trim()) {
      const q = busca.toLowerCase()
      lista = lista.filter(i => i.nome.toLowerCase().includes(q) || i.categorias_item?.nome.toLowerCase().includes(q))
    }
    return lista
  }, [itensCraft, aba, favoritos, busca])

  const batchIds = useMemo(() => new Set(batch.map(b => b.item_id)), [batch])

  // ── Favoritar ──────────────────────────────────────────────────────────────

  async function toggleFavorito(itemId: string, e: React.MouseEvent) {
    e.stopPropagation()
    const tinha = favoritos.has(itemId)
    setFavoritos(prev => { const n = new Set(prev); tinha ? n.delete(itemId) : n.add(itemId); return n })
    if (tinha) {
      const { error } = await sb().from('usuario_favoritos').delete().eq('usuario_id', userId).eq('item_id', itemId)
      if (error) { toast.error('Erro ao remover favorito'); setFavoritos(prev => { const n = new Set(prev); n.add(itemId); return n }) }
    } else {
      const { error } = await sb().from('usuario_favoritos').insert({ usuario_id: userId, item_id: itemId })
      if (error) { toast.error('Erro ao favoritar'); setFavoritos(prev => { const n = new Set(prev); n.delete(itemId); return n }) }
    }
  }

  // ── Batch ──────────────────────────────────────────────────────────────────

  function addToBatch(itemId: string) {
    setBatch(prev => {
      if (prev.some(b => b.item_id === itemId)) return prev
      return [...prev, { item_id: itemId, quantidade: 1 }]
    })
  }

  function removeFromBatch(itemId: string) {
    setBatch(prev => prev.filter(b => b.item_id !== itemId))
  }

  function setQtd(itemId: string, qtd: number) {
    if (qtd <= 0) { removeFromBatch(itemId); return }
    setBatch(prev => prev.map(b => b.item_id === itemId ? { ...b, quantidade: qtd } : b))
  }

  // ── Ingredientes agregados ─────────────────────────────────────────────────

  const ingredientesAgregados = useMemo(() => {
    const map: Record<string, { ingrediente: Item | null; totalQty: number; totalPeso: number; lojasDisponiveis: LojaPreco[] }> = {}

    for (const { item_id, quantidade } of batch) {
      const item = itemMap[item_id]
      if (!item?.item_receita) continue
      for (const r of item.item_receita) {
        const qtd = r.quantidade * quantidade
        if (!map[r.ingrediente_id]) {
          map[r.ingrediente_id] = {
            ingrediente: itemMap[r.ingrediente_id] ?? null,
            totalQty: 0,
            totalPeso: 0,
            lojasDisponiveis: lojaPrecoPorItem[r.ingrediente_id] ?? [],
          }
        }
        map[r.ingrediente_id].totalQty += qtd
        map[r.ingrediente_id].totalPeso += (itemMap[r.ingrediente_id]?.peso ?? 0) * qtd
      }
    }

    return Object.entries(map).map(([id, v]) => ({ ingrediente_id: id, ...v }))
      .sort((a, b) => (a.ingrediente?.nome ?? '').localeCompare(b.ingrediente?.nome ?? ''))
  }, [batch, itemMap, lojaPrecoPorItem])

  // ── Cálculos de totais ─────────────────────────────────────────────────────

  const totais = useMemo(() => {
    let pesoProdutos = 0
    let pesoIngredientes = 0
    let custoTotal = 0
    let custoCompleto = ingredientesAgregados.length > 0

    for (const { item_id, quantidade } of batch) {
      pesoProdutos += (itemMap[item_id]?.peso ?? 0) * quantidade
    }

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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-[calc(100vh-3rem)] flex overflow-hidden">

      {/* ── Lista de itens ── */}
      <aside className="w-64 shrink-0 flex flex-col border-r border-border">
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Buscar item..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-8 h-8 text-sm" />
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
              {aba === 'favoritos' ? 'Nenhum favorito com craft' : 'Nenhum item com craft encontrado'}
            </p>
          ) : itensFiltrados.map(item => (
            <button key={item.id} onClick={() => addToBatch(item.id)}
              className={cn('w-full flex items-center gap-2 px-3 py-2.5 border-b border-border/30 hover:bg-white/[0.03] text-left transition-colors',
                batchIds.has(item.id) && 'bg-primary/[0.06] border-l-2 border-l-primary'
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium leading-tight truncate">{item.nome}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {item.categorias_item?.nome && <span className="text-[10px] text-muted-foreground">{item.categorias_item.nome}</span>}
                  {item.eh_meu_produto && <span className="text-[10px] text-emerald-500/70">meu</span>}
                </div>
              </div>
              <button onMouseDown={e => e.preventDefault()} onClick={e => toggleFavorito(item.id, e)}
                className={cn('shrink-0 p-0.5 rounded transition-colors', favoritos.has(item.id) ? 'text-yellow-400' : 'text-muted-foreground/40 hover:text-yellow-400')}>
                <Star className="h-3.5 w-3.5" fill={favoritos.has(item.id) ? 'currentColor' : 'none'} />
              </button>
            </button>
          ))}
        </div>
      </aside>

      {/* ── Painel direito ── */}
      <main className="flex-1 overflow-y-auto">

        {batch.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
            <Package className="h-10 w-10 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">Clique nos itens para adicionar à produção</p>
          </div>
        ) : (
          <div className="p-6 space-y-6 max-w-3xl">

            {/* Itens a produzir */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Itens a produzir</h3>
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="grid grid-cols-[1fr_120px_40px] gap-3 px-4 py-1.5 bg-white/[0.02] border-b border-border text-[10px] text-muted-foreground font-medium">
                  <span>Item</span><span className="text-center">Quantidade</span><span />
                </div>
                {batch.map(({ item_id, quantidade }) => {
                  const item = itemMap[item_id]
                  return (
                    <div key={item_id} className="grid grid-cols-[1fr_120px_40px] gap-3 items-center px-4 py-2.5 border-b border-border/40 last:border-0">
                      <div>
                        <span className="text-sm font-medium">{item?.nome ?? '—'}</span>
                        {item?.categorias_item?.nome && (
                          <span className="ml-2 text-xs text-muted-foreground">{item.categorias_item.nome}</span>
                        )}
                        {item?.peso != null && (
                          <span className="ml-2 text-xs text-muted-foreground">{fmtKg(item.peso * quantidade)} produzidos</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 justify-center">
                        <button onClick={() => setQtd(item_id, quantidade - 1)}
                          className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors">
                          <Minus className="h-3 w-3" />
                        </button>
                        <Input
                          type="number"
                          value={quantidade}
                          onChange={e => setQtd(item_id, Math.max(1, parseInt(e.target.value) || 1))}
                          className="h-7 w-14 text-center text-sm px-1"
                        />
                        <button onClick={() => setQtd(item_id, quantidade + 1)}
                          className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors">
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <button onClick={() => removeFromBatch(item_id)}
                        className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-white/[0.06] transition-colors mx-auto">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* Ingredientes necessários */}
            {ingredientesAgregados.length > 0 && (
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Ingredientes necessários</h3>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Preço sujo</Label>
                    <Switch checked={modoSujo} onCheckedChange={setModoSujo} />
                  </div>
                </div>

                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="grid grid-cols-[1fr_70px_80px_160px_90px_90px] gap-2 px-4 py-1.5 bg-white/[0.02] border-b border-border text-[10px] text-muted-foreground font-medium">
                    <span>Ingrediente</span>
                    <span className="text-right">Qtd</span>
                    <span className="text-right">Peso</span>
                    <span>Loja</span>
                    <span className="text-right">Unit.</span>
                    <span className="text-right">Total</span>
                  </div>

                  {ingredientesAgregados.map(ing => {
                    const lojaId = lojasPorIng[ing.ingrediente_id]
                    const lp = lojaId ? ing.lojasDisponiveis.find(l => l.loja_id === lojaId) : null
                    const precoUnit = lp ? (modoSujo && lp.preco_sujo != null ? lp.preco_sujo : lp.preco) : null
                    const subtotal = precoUnit != null ? precoUnit * ing.totalQty : null

                    return (
                      <div key={ing.ingrediente_id} className="grid grid-cols-[1fr_70px_80px_160px_90px_90px] gap-2 items-center px-4 py-2.5 border-b border-border/40 last:border-0">
                        <span className="text-sm font-medium truncate">{ing.ingrediente?.nome ?? ing.ingrediente_id}</span>
                        <span className="text-sm text-right tabular-nums text-muted-foreground">{ing.totalQty}×</span>
                        <span className="text-sm text-right tabular-nums text-muted-foreground">
                          {ing.totalPeso > 0 ? fmtKg(ing.totalPeso) : '—'}
                        </span>
                        <div>
                          {ing.lojasDisponiveis.length > 0 ? (
                            <Select
                              value={lojasPorIng[ing.ingrediente_id] ?? 'sem'}
                              onValueChange={v => setLojasPorIng(prev => ({ ...prev, [ing.ingrediente_id]: v === 'sem' ? '' : v }))}
                            >
                              <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="— loja —" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="sem">— sem loja —</SelectItem>
                                {ing.lojasDisponiveis.map(l => {
                                  const p = modoSujo && l.preco_sujo != null ? l.preco_sujo : l.preco
                                  return (
                                    <SelectItem key={l.loja_id} value={l.loja_id}>
                                      {lojaMap[l.loja_id]?.nome ?? l.loja_id}
                                      <span className="ml-1 text-muted-foreground">({fmt(p)})</span>
                                    </SelectItem>
                                  )
                                })}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-xs text-muted-foreground">sem preço</span>
                          )}
                        </div>
                        <span className="text-sm text-right tabular-nums text-muted-foreground">
                          {precoUnit != null ? fmt(precoUnit) : '—'}
                        </span>
                        <span className={cn('text-sm text-right tabular-nums font-medium', subtotal != null ? 'text-foreground' : 'text-muted-foreground')}>
                          {subtotal != null ? fmt(subtotal) : '—'}
                        </span>
                      </div>
                    )
                  })}

                  {/* Linha de totais */}
                  <div className="grid grid-cols-[1fr_70px_80px_160px_90px_90px] gap-2 items-center px-4 py-2.5 bg-white/[0.02] border-t border-border">
                    <span className="text-xs font-semibold text-muted-foreground col-span-2">Total</span>
                    <span className="text-sm text-right tabular-nums font-medium">
                      {totais.pesoIngredientes > 0 ? fmtKg(totais.pesoIngredientes) : '—'}
                    </span>
                    <span />
                    <span />
                    <span className={cn('text-sm text-right tabular-nums font-semibold', totais.custoTotal > 0 ? 'text-foreground' : 'text-muted-foreground')}>
                      {totais.custoTotal > 0 ? fmt(totais.custoTotal) : '—'}
                    </span>
                  </div>
                </div>
              </section>
            )}

            {/* Cards de resumo */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-border bg-white/[0.02] p-4">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Peso produzido</p>
                <p className="text-xl font-bold mt-1">{totais.pesoProdutos > 0 ? fmtKg(totais.pesoProdutos) : '—'}</p>
              </div>
              <div className="rounded-lg border border-border bg-white/[0.02] p-4">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Peso ingredientes</p>
                <p className="text-xl font-bold mt-1">{totais.pesoIngredientes > 0 ? fmtKg(totais.pesoIngredientes) : '—'}</p>
              </div>
              <div className="rounded-lg border border-border bg-white/[0.02] p-4">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Custo total</p>
                <p className="text-xl font-bold mt-1">{totais.custoTotal > 0 ? fmt(totais.custoTotal) : '—'}</p>
                {!totais.custoCompleto && totais.custoTotal > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-1">parcial</p>
                )}
              </div>
            </div>

            {/* Nosso preço de venda — só aparece se todos os itens do batch forem meus produtos */}
            {batch.every(b => itemMap[b.item_id]?.eh_meu_produto) && batch.length > 0 && (() => {
              const totalVendaSujo = batch.reduce((s, { item_id, quantidade }) => {
                const p = precoMap[item_id]?.preco_sujo
                return p != null ? s + p * quantidade : s
              }, 0)
              const totalVendaLimpo = batch.reduce((s, { item_id, quantidade }) => {
                const p = precoMap[item_id]?.preco_limpo
                return p != null ? s + p * quantidade : s
              }, 0)
              if (totalVendaSujo === 0 && totalVendaLimpo === 0) return null
              const margem = totais.custoTotal > 0 ? totalVendaSujo - totais.custoTotal : null
              return (
                <section className="rounded-lg border border-border bg-white/[0.02] p-4 space-y-3">
                  <h3 className="text-sm font-semibold">Receita de Venda (nossos preços)</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {totalVendaSujo > 0 && (
                      <div>
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Sujo</p>
                        <p className="text-lg font-semibold tabular-nums">{fmt(totalVendaSujo)}</p>
                        {margem != null && (
                          <p className={cn('text-xs mt-0.5', margem >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                            margem {margem >= 0 ? '+' : ''}{fmt(margem)} ({Math.round(margem / totais.custoTotal * 100)}%)
                          </p>
                        )}
                      </div>
                    )}
                    {totalVendaLimpo > 0 && (
                      <div>
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Limpo</p>
                        <p className="text-lg font-semibold tabular-nums">{fmt(totalVendaLimpo)}</p>
                        {totais.custoTotal > 0 && (
                          <p className={cn('text-xs mt-0.5', (totalVendaLimpo - totais.custoTotal) >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                            margem {fmt(totalVendaLimpo - totais.custoTotal)} ({Math.round((totalVendaLimpo - totais.custoTotal) / totais.custoTotal * 100)}%)
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </section>
              )
            })()}

          </div>
        )}
      </main>
    </div>
  )
}

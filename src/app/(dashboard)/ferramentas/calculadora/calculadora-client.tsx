'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Search, Star, Package, Calculator, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ── Tipos ────────────────────────────────────────────────────────────────────

type Item = {
  id: string
  nome: string
  tem_craft: boolean
  eh_meu_produto: boolean
  eh_compravel: boolean
  peso: number | null
  categorias_item: { nome: string } | null
  item_receita: { ingrediente_id: string; quantidade: number }[]
}

type PrecoVigente = {
  item_id: string
  preco_sujo: number | null
  preco_limpo: number | null
}

type Loja = { id: string; nome: string }

type LojaPreco = {
  loja_id: string
  item_id: string
  preco: number
  preco_sujo: number | null
}

interface Props {
  userId: string
  items: Item[]
  precos: PrecoVigente[]
  lojas: Loja[]
  lojaPrecos: LojaPreco[]
  favoritosIniciais: string[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined) {
  if (v == null) return '—'
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function fmtPeso(kg: number) {
  if (kg === 0) return '—'
  return `${kg.toFixed(2)} kg`
}

type Aba = 'favoritos' | 'meus' | 'todos'

// ── Componente ───────────────────────────────────────────────────────────────

export function CalculadoraClient({ userId, items, precos, lojas, lojaPrecos, favoritosIniciais }: Props) {
  const sbRef = useRef<ReturnType<typeof createClient> | null>(null)
  const sb = useCallback(() => { if (!sbRef.current) sbRef.current = createClient(); return sbRef.current }, [])

  const [busca, setBusca] = useState('')
  const [aba, setAba] = useState<Aba>('todos')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [favoritos, setFavoritos] = useState<Set<string>>(new Set(favoritosIniciais))
  const [lojasPorIng, setLojasPorIng] = useState<Record<string, string>>({}) // ingrediente_id → loja_id
  const [modoSujo, setModoSujo] = useState(false)

  // ── Mapas ──────────────────────────────────────────────────────────────────

  const itemMap = useMemo(() => Object.fromEntries(items.map(i => [i.id, i])), [items])
  const lojaMap = useMemo(() => Object.fromEntries(lojas.map(l => [l.id, l])), [lojas])
  const precoMap = useMemo(() => Object.fromEntries(precos.map(p => [p.item_id, p])), [precos])

  // loja_item_precos agrupado por item_id
  const lojaPrecoPorItem = useMemo(() => {
    const map: Record<string, LojaPreco[]> = {}
    lojaPrecos.forEach(lp => {
      if (!map[lp.item_id]) map[lp.item_id] = []
      map[lp.item_id].push(lp)
    })
    return map
  }, [lojaPrecos])

  // ── Filtro da lista ────────────────────────────────────────────────────────

  const itensFiltrados = useMemo(() => {
    let lista = items
    if (aba === 'favoritos') lista = lista.filter(i => favoritos.has(i.id))
    if (aba === 'meus') lista = lista.filter(i => i.eh_meu_produto)
    if (busca.trim()) {
      const q = busca.toLowerCase()
      lista = lista.filter(i => i.nome.toLowerCase().includes(q) || i.categorias_item?.nome.toLowerCase().includes(q))
    }
    return lista
  }, [items, aba, favoritos, busca])

  // ── Favoritar ──────────────────────────────────────────────────────────────

  async function toggleFavorito(itemId: string, e: React.MouseEvent) {
    e.stopPropagation()
    const tinha = favoritos.has(itemId)
    setFavoritos(prev => {
      const next = new Set(prev)
      tinha ? next.delete(itemId) : next.add(itemId)
      return next
    })
    if (tinha) {
      const { error } = await sb().from('usuario_favoritos').delete().eq('usuario_id', userId).eq('item_id', itemId)
      if (error) { toast.error('Erro ao remover favorito'); setFavoritos(prev => { const n = new Set(prev); n.add(itemId); return n }) }
    } else {
      const { error } = await sb().from('usuario_favoritos').insert({ usuario_id: userId, item_id: itemId })
      if (error) { toast.error('Erro ao favoritar'); setFavoritos(prev => { const n = new Set(prev); n.delete(itemId); return n }) }
    }
  }

  // ── Item selecionado ───────────────────────────────────────────────────────

  const selectedItem = selectedId ? itemMap[selectedId] : null

  const receita = useMemo(() => {
    if (!selectedItem?.item_receita) return []
    return selectedItem.item_receita.map(r => ({
      ...r,
      ingrediente: itemMap[r.ingrediente_id] ?? null,
      lojasDisponiveis: lojaPrecoPorItem[r.ingrediente_id] ?? [],
    }))
  }, [selectedItem, itemMap, lojaPrecoPorItem])

  // Quando troca de item, reseta seleção de lojas
  function selecionarItem(id: string) {
    setSelectedId(id)
    setLojasPorIng({})
  }

  // ── Cálculos ───────────────────────────────────────────────────────────────

  const calculos = useMemo(() => {
    let totalPeso = 0
    let totalCusto = 0
    let custoCompleto = true // false se algum ingrediente não tem loja selecionada

    const linhas = receita.map(r => {
      const ing = r.ingrediente
      const peso = (ing?.peso ?? 0) * r.quantidade
      totalPeso += peso

      const lojaId = lojasPorIng[r.ingrediente_id]
      const lp = lojaId ? r.lojasDisponiveis.find(l => l.loja_id === lojaId) : null
      const precoUnit = lp ? (modoSujo && lp.preco_sujo != null ? lp.preco_sujo : lp.preco) : null
      const subtotal = precoUnit != null ? precoUnit * r.quantidade : null

      if (subtotal == null) custoCompleto = false
      else totalCusto += subtotal

      return { ...r, peso, precoUnit, subtotal }
    })

    return { linhas, totalPeso, totalCusto, custoCompleto }
  }, [receita, lojasPorIng, modoSujo])

  const precoVigente = selectedId ? precoMap[selectedId] : null
  const precoVendaSujo = precoVigente?.preco_sujo
  const precoVendaLimpo = precoVigente?.preco_limpo
  const margem = calculos.custoCompleto && calculos.totalCusto > 0 && precoVendaSujo != null
    ? precoVendaSujo - calculos.totalCusto
    : null

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-[calc(100vh-3rem)] flex overflow-hidden">

      {/* ── Lista de itens ── */}
      <aside className="w-72 shrink-0 flex flex-col border-r border-border">
        {/* Busca */}
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

        {/* Abas */}
        <div className="flex border-b border-border shrink-0">
          {([['favoritos', '★ Favoritos'], ['meus', 'Meus'], ['todos', 'Todos']] as [Aba, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setAba(key)}
              className={cn(
                'flex-1 py-2 text-[11px] font-medium transition-colors border-b-2',
                aba === key
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {itensFiltrados.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8 px-4">
              {aba === 'favoritos' ? 'Nenhum favorito ainda — clique na ★ para favoritar' : 'Nenhum item encontrado'}
            </p>
          ) : (
            itensFiltrados.map(item => (
              <button
                key={item.id}
                onClick={() => selecionarItem(item.id)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2.5 border-b border-border/30 hover:bg-white/[0.03] text-left transition-colors',
                  selectedId === item.id && 'bg-primary/[0.06] border-l-2 border-l-primary'
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium leading-tight truncate">{item.nome}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {item.categorias_item?.nome && (
                      <span className="text-[10px] text-muted-foreground truncate">{item.categorias_item.nome}</span>
                    )}
                    {item.tem_craft && <span className="text-[10px] text-primary/60 shrink-0">craft</span>}
                    {item.eh_meu_produto && <span className="text-[10px] text-emerald-500/70 shrink-0">meu</span>}
                  </div>
                </div>
                <button
                  onMouseDown={e => e.preventDefault()}
                  onClick={e => toggleFavorito(item.id, e)}
                  className={cn(
                    'shrink-0 p-0.5 rounded transition-colors',
                    favoritos.has(item.id) ? 'text-yellow-400' : 'text-muted-foreground/40 hover:text-yellow-400'
                  )}
                >
                  <Star className="h-3.5 w-3.5" fill={favoritos.has(item.id) ? 'currentColor' : 'none'} />
                </button>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* ── Painel da calculadora ── */}
      <main className="flex-1 overflow-y-auto p-6">
        {!selectedItem ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
            <Calculator className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Selecione um item para calcular</p>
          </div>
        ) : (
          <div className="max-w-2xl space-y-6">

            {/* Header do item */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-semibold">{selectedItem.nome}</h2>
                  {selectedItem.categorias_item?.nome && (
                    <span className="text-xs text-muted-foreground bg-white/[0.06] px-2 py-0.5 rounded border border-white/10">
                      {selectedItem.categorias_item.nome}
                    </span>
                  )}
                  {selectedItem.eh_meu_produto && (
                    <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">Meu produto</span>
                  )}
                </div>
                {selectedItem.peso != null && (
                  <p className="text-sm text-muted-foreground mt-1">Peso unitário: {selectedItem.peso} kg</p>
                )}
              </div>
              <button
                onMouseDown={e => e.preventDefault()}
                onClick={e => toggleFavorito(selectedItem.id, e)}
                className={cn('shrink-0 p-1.5 rounded transition-colors', favoritos.has(selectedItem.id) ? 'text-yellow-400' : 'text-muted-foreground hover:text-yellow-400')}
                title={favoritos.has(selectedItem.id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
              >
                <Star className="h-5 w-5" fill={favoritos.has(selectedItem.id) ? 'currentColor' : 'none'} />
              </button>
            </div>

            {/* Receita de craft */}
            {selectedItem.tem_craft && receita.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    Receita de Craft
                  </h3>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Preço sujo</Label>
                    <Switch checked={modoSujo} onCheckedChange={setModoSujo} />
                  </div>
                </div>

                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="grid grid-cols-[1fr_60px_80px_180px_90px_90px] gap-2 px-4 py-2 bg-white/[0.02] border-b border-border text-[10px] text-muted-foreground font-medium">
                    <span>Ingrediente</span>
                    <span className="text-right">Qtd</span>
                    <span className="text-right">Peso</span>
                    <span>Loja</span>
                    <span className="text-right">Unit.</span>
                    <span className="text-right">Total</span>
                  </div>

                  {calculos.linhas.map((linha, idx) => (
                    <div
                      key={linha.ingrediente_id}
                      className={cn(
                        'grid grid-cols-[1fr_60px_80px_180px_90px_90px] gap-2 items-center px-4 py-2.5',
                        idx < calculos.linhas.length - 1 && 'border-b border-border/40'
                      )}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-sm font-medium truncate">{linha.ingrediente?.nome ?? linha.ingrediente_id}</span>
                        {linha.ingrediente?.eh_compravel && (
                          <span className="text-[10px] text-muted-foreground/60 shrink-0">comprável</span>
                        )}
                      </div>

                      <span className="text-sm text-right tabular-nums text-muted-foreground">{linha.quantidade}×</span>

                      <span className="text-sm text-right tabular-nums text-muted-foreground">
                        {linha.ingrediente?.peso != null ? fmtPeso(linha.peso) : '—'}
                      </span>

                      <div>
                        {linha.lojasDisponiveis.length > 0 ? (
                          <Select
                            value={lojasPorIng[linha.ingrediente_id] ?? 'sem'}
                            onValueChange={v => setLojasPorIng(prev => ({ ...prev, [linha.ingrediente_id]: v === 'sem' ? '' : v }))}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="Selecionar loja..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sem">— sem loja —</SelectItem>
                              {linha.lojasDisponiveis.map(lp => {
                                const precoExibir = modoSujo && lp.preco_sujo != null ? lp.preco_sujo : lp.preco
                                return (
                                  <SelectItem key={lp.loja_id} value={lp.loja_id}>
                                    {lojaMap[lp.loja_id]?.nome ?? lp.loja_id}
                                    <span className="ml-1 text-muted-foreground">({fmt(precoExibir)})</span>
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
                        {linha.precoUnit != null ? fmt(linha.precoUnit) : '—'}
                      </span>
                      <span className={cn('text-sm text-right tabular-nums font-medium', linha.subtotal != null ? 'text-foreground' : 'text-muted-foreground')}>
                        {linha.subtotal != null ? fmt(linha.subtotal) : '—'}
                      </span>
                    </div>
                  ))}

                  {/* Linha de totais */}
                  <div className="grid grid-cols-[1fr_60px_80px_180px_90px_90px] gap-2 items-center px-4 py-2.5 bg-white/[0.02] border-t border-border">
                    <span className="text-xs font-semibold text-muted-foreground col-span-2">Total</span>
                    <span className="text-sm text-right tabular-nums font-medium">
                      {calculos.totalPeso > 0 ? fmtPeso(calculos.totalPeso) : '—'}
                    </span>
                    <span />
                    <span />
                    <span className={cn('text-sm text-right tabular-nums font-semibold', calculos.totalCusto > 0 ? 'text-foreground' : 'text-muted-foreground')}>
                      {calculos.totalCusto > 0 ? fmt(calculos.totalCusto) : '—'}
                    </span>
                  </div>
                </div>

                {!calculos.custoCompleto && calculos.totalCusto > 0 && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <ChevronRight className="h-3 w-3" />
                    Custo parcial — alguns ingredientes sem loja selecionada
                  </p>
                )}
              </section>
            )}

            {selectedItem.tem_craft && receita.length === 0 && (
              <div className="rounded-lg border border-dashed border-border p-6 text-center">
                <p className="text-xs text-muted-foreground">Receita de craft não cadastrada</p>
              </div>
            )}

            {!selectedItem.tem_craft && (
              <div className="rounded-lg border border-dashed border-border p-6 text-center">
                <p className="text-xs text-muted-foreground">Este item não tem receita de craft</p>
              </div>
            )}

            {/* Nosso preço de venda */}
            {selectedItem.eh_meu_produto && (
              <section className="rounded-lg border border-border bg-white/[0.02] p-4 space-y-3">
                <h3 className="text-sm font-semibold">Nosso Preço de Venda</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Sujo</p>
                    <p className="text-lg font-semibold tabular-nums">{fmt(precoVendaSujo)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Limpo</p>
                    <p className="text-lg font-semibold tabular-nums">{fmt(precoVendaLimpo)}</p>
                  </div>
                </div>

                {/* Margem */}
                {calculos.totalCusto > 0 && (
                  <div className="pt-2 border-t border-border space-y-1.5">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Margem (vs custo de craft)</p>
                    <div className="grid grid-cols-2 gap-4">
                      {precoVendaSujo != null && (
                        <div>
                          <p className="text-xs text-muted-foreground">Sujo</p>
                          <p className={cn('text-sm font-semibold tabular-nums', margem != null && margem >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                            {margem != null ? fmt(margem) : '—'}
                            {margem != null && calculos.totalCusto > 0 && (
                              <span className="ml-1 text-xs font-normal">
                                ({Math.round(margem / calculos.totalCusto * 100)}%)
                              </span>
                            )}
                          </p>
                        </div>
                      )}
                      {precoVendaLimpo != null && calculos.totalCusto > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground">Limpo</p>
                          {(() => {
                            const ml = precoVendaLimpo - calculos.totalCusto
                            return (
                              <p className={cn('text-sm font-semibold tabular-nums', ml >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                                {fmt(ml)}
                                <span className="ml-1 text-xs font-normal">({Math.round(ml / calculos.totalCusto * 100)}%)</span>
                              </p>
                            )
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </section>
            )}

          </div>
        )}
      </main>
    </div>
  )
}

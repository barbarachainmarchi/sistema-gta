'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Plus, TrendingUp, TrendingDown, ArrowLeftRight, Trash2, Pencil, Loader2, ShoppingCart,
} from 'lucide-react'
import type { Conta, Lancamento, Cotacao, SbClient } from './financeiro-client'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return `R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}
function fmtNum(v: number | null | undefined) {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}
function fmtData(s: string | null) {
  if (!s) return '—'
  const d = new Date(s + (s.includes('T') ? '' : 'T00:00:00'))
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
function today() {
  return new Date().toISOString().split('T')[0]
}
function impactSaldo(l: Lancamento): { deltaSujo: number; deltaLimpo: number } {
  const v = l.valor
  const sujo  = l.tipo_dinheiro === 'sujo'
  if (l.tipo === 'entrada' || l.tipo === 'venda')
    return { deltaSujo: sujo ? v : 0, deltaLimpo: sujo ? 0 : v }
  if (l.tipo === 'saida')
    return { deltaSujo: sujo ? -v : 0, deltaLimpo: sujo ? 0 : -v }
  return { deltaSujo: 0, deltaLimpo: 0 }
}

// ── Tipos internos ────────────────────────────────────────────────────────────

type FiltroTipo = 'todos' | 'entradas' | 'saidas' | 'vendas' | 'transferencias'
type FiltroDinheiro = 'todos' | 'sujo' | 'limpo'

const EMPTY_FORM = {
  id: null as string | null,
  tipo_mov: 'entrada' as 'entrada' | 'saida',
  is_compra: false,
  data: today(),
  tipo_dinheiro: 'limpo' as 'sujo' | 'limpo',
  origem_tipo: '' as '' | 'faccao' | 'loja' | 'pessoa',
  item_descricao: '',
  categoria: '',
  preco: '',
  quantidade: '',
  total: '',
  conta_id: '',
  cotacao_id: '',
  descricao: '',
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  contas: Conta[]
  lancamentos: Lancamento[]
  setLancamentos: React.Dispatch<React.SetStateAction<Lancamento[]>>
  atualizarSaldo: (contaId: string, deltaSujo: number, deltaLimpo: number) => Promise<void>
  userId: string
  cotacoesFinaliz: Cotacao[]
  sb: SbClient
}

// ── Componente ────────────────────────────────────────────────────────────────

export function ExtratoAba({ contas, lancamentos, setLancamentos, atualizarSaldo, userId, cotacoesFinaliz, sb }: Props) {
  const [modalOpen, setModalOpen]   = useState(false)
  const [form, setForm]             = useState({ ...EMPTY_FORM })
  const [salvando, setSalvando]     = useState(false)
  const [deleteId, setDeleteId]     = useState<string | null>(null)

  // Filtros
  const [filtroTipo, setFiltroTipo]           = useState<FiltroTipo>('todos')
  const [filtroDinheiro, setFiltroDinheiro]   = useState<FiltroDinheiro>('todos')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroDataDe, setFiltroDataDe]       = useState('')
  const [filtroDataAte, setFiltroDataAte]     = useState('')

  const contaMap = useMemo(() => Object.fromEntries(contas.map(c => [c.id, c])), [contas])

  // Histórico para datalist
  const histDescricao = useMemo(() => [...new Set(lancamentos.map(l => l.item_descricao).filter(Boolean))], [lancamentos])
  const histCategoria = useMemo(() => [...new Set(lancamentos.map(l => l.categoria).filter(Boolean))], [lancamentos])

  // Resumo
  const resumo = useMemo(() => {
    let entradasSujo = 0, entradasLimpo = 0, gastosSujo = 0, gastosLimpo = 0
    lancamentos.forEach(l => {
      const v = l.valor
      if (l.tipo === 'entrada' || l.tipo === 'venda') {
        if (l.tipo_dinheiro === 'sujo')  entradasSujo  += v
        else                             entradasLimpo += v
      } else if (l.tipo === 'saida') {
        if (l.tipo_dinheiro === 'sujo')  gastosSujo  += v
        else                             gastosLimpo += v
      }
    })
    return { entradasSujo, entradasLimpo, gastosSujo, gastosLimpo }
  }, [lancamentos])

  // Filtros aplicados
  const lancFiltrados = useMemo(() => {
    return lancamentos.filter(l => {
      if (filtroTipo === 'entradas'      && l.tipo !== 'entrada')      return false
      if (filtroTipo === 'saidas'        && l.tipo !== 'saida')        return false
      if (filtroTipo === 'vendas'        && l.tipo !== 'venda')        return false
      if (filtroTipo === 'transferencias'&& l.tipo !== 'transferencia') return false
      if (filtroDinheiro !== 'todos'     && l.tipo_dinheiro !== filtroDinheiro) return false
      if (filtroCategoria && !l.categoria?.toLowerCase().includes(filtroCategoria.toLowerCase())) return false
      const dataL = l.data ?? l.created_at.split('T')[0]
      if (filtroDataDe  && dataL < filtroDataDe)  return false
      if (filtroDataAte && dataL > filtroDataAte) return false
      return true
    })
  }, [lancamentos, filtroTipo, filtroDinheiro, filtroCategoria, filtroDataDe, filtroDataAte])

  // ── Auto-cálculo ─────────────────────────────────────────────────────────

  function setF(patch: Partial<typeof EMPTY_FORM>) {
    setForm(prev => ({ ...prev, ...patch }))
  }

  function onPrecoChange(val: string) {
    const p = parseFloat(val) || 0
    const q = parseFloat(form.quantidade) || 0
    setF({ preco: val, ...(p && q ? { total: String(p * q) } : {}) })
  }
  function onQtdChange(val: string) {
    const q = parseFloat(val) || 0
    const p = parseFloat(form.preco) || 0
    const t = parseFloat(form.total) || 0
    if (p && q) { setF({ quantidade: val, total: String(p * q) }); return }
    if (t && q) { setF({ quantidade: val, preco: String(t / q) }); return }
    setF({ quantidade: val })
  }
  function onTotalChange(val: string) {
    const t = parseFloat(val) || 0
    const q = parseFloat(form.quantidade) || 0
    const p = parseFloat(form.preco) || 0
    if (q && t) { setF({ total: val, preco: String(t / q) }); return }
    if (p && t) { setF({ total: val, quantidade: String(t / p) }); return }
    setF({ total: val })
  }

  // ── Abrir modal ──────────────────────────────────────────────────────────

  function abrirNovo() {
    setForm({ ...EMPTY_FORM })
    setModalOpen(true)
  }
  function abrirEditar(l: Lancamento) {
    setForm({
      id: l.id,
      tipo_mov: l.tipo === 'saida' ? 'saida' : 'entrada',
      is_compra: !!l.cotacao_id,
      data: l.data ?? today(),
      tipo_dinheiro: l.tipo_dinheiro ?? 'limpo',
      origem_tipo: l.origem_tipo ?? '',
      item_descricao: l.item_descricao ?? '',
      categoria: l.categoria ?? '',
      preco: l.preco != null ? String(l.preco) : '',
      quantidade: l.quantidade != null ? String(l.quantidade) : '',
      total: l.total != null ? String(l.total) : String(l.valor),
      conta_id: l.conta_id,
      cotacao_id: l.cotacao_id ?? '',
      descricao: l.descricao ?? '',
    })
    setModalOpen(true)
  }

  // ── Salvar ───────────────────────────────────────────────────────────────

  async function handleSalvar() {
    const valorNum = parseFloat(form.total) || (parseFloat(form.preco) * parseFloat(form.quantidade)) || 0
    if (!valorNum || valorNum <= 0) { toast.error('Informe o total'); return }
    if (!form.conta_id)             { toast.error('Selecione o responsável'); return }
    if (form.is_compra && !form.cotacao_id) { toast.error('Selecione a cotação'); return }

    const tipo_db = form.tipo_mov === 'saida' ? 'saida' : 'entrada'
    const payload = {
      conta_id:       form.conta_id,
      tipo:           tipo_db,
      tipo_dinheiro:  form.tipo_dinheiro,
      valor:          valorNum,
      data:           form.data || null,
      origem_tipo:    form.origem_tipo || null,
      item_descricao: form.item_descricao.trim() || null,
      descricao:      form.descricao.trim() || null,
      categoria:      form.categoria.trim() || null,
      preco:          parseFloat(form.preco) || null,
      quantidade:     parseFloat(form.quantidade) || null,
      total:          valorNum,
      cotacao_id:     form.is_compra ? form.cotacao_id || null : null,
      created_by:     userId,
    }

    setSalvando(true)

    if (form.id) {
      // Editar: reverter impacto antigo, aplicar novo
      const old = lancamentos.find(l => l.id === form.id)
      if (old) {
        const { deltaSujo: ds, deltaLimpo: dl } = impactSaldo(old)
        await atualizarSaldo(old.conta_id, -ds, -dl)
        // Se mudou de conta, reverter na conta antiga; se mesma conta, ok
      }
      const { data, error } = await sb()
        .from('financeiro_lancamentos').update(payload).eq('id', form.id)
        .select('*, cotacoes(titulo, fornecedor_nome)').single()
      if (error) { setSalvando(false); toast.error(error.message); return }
      const novo: Lancamento = data as Lancamento
      const { deltaSujo, deltaLimpo } = impactSaldo(novo)
      await atualizarSaldo(novo.conta_id, deltaSujo, deltaLimpo)
      setLancamentos(prev => prev.map(l => l.id === form.id ? novo : l))
      toast.success('Lançamento atualizado!')
    } else {
      // Novo
      const { data, error } = await sb()
        .from('financeiro_lancamentos').insert(payload)
        .select('*, cotacoes(titulo, fornecedor_nome)').single()
      if (error) { setSalvando(false); toast.error(error.message); return }
      const novo: Lancamento = data as Lancamento
      const { deltaSujo, deltaLimpo } = impactSaldo(novo)
      await atualizarSaldo(novo.conta_id, deltaSujo, deltaLimpo)
      setLancamentos(prev => [novo, ...prev])
      toast.success(tipo_db === 'entrada' ? 'Entrada registrada!' : 'Gasto registrado!')
    }

    setSalvando(false)
    setModalOpen(false)
  }

  // ── Deletar ──────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    const l = lancamentos.find(x => x.id === id)
    if (!l) return
    const { error } = await sb().from('financeiro_lancamentos').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    const { deltaSujo, deltaLimpo } = impactSaldo(l)
    await atualizarSaldo(l.conta_id, -deltaSujo, -deltaLimpo)
    setLancamentos(prev => prev.filter(x => x.id !== id))
    setDeleteId(null)
    toast.success('Removido')
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* ── Resumo ── */}
      <div className="shrink-0 px-6 pt-5 pb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ResumoCard label="Entradas Limpo" valor={resumo.entradasLimpo} cor="emerald" />
        <ResumoCard label="Entradas Sujo"  valor={resumo.entradasSujo}  cor="yellow" />
        <ResumoCard label="Gastos Limpo"   valor={resumo.gastosLimpo}   cor="red" negativo />
        <ResumoCard label="Gastos Sujo"    valor={resumo.gastosSujo}    cor="orange" negativo />
      </div>

      {/* ── Filtros + botão ── */}
      <div className="shrink-0 px-6 pb-3 flex flex-wrap items-end gap-2">
        {/* Tipo */}
        <Select value={filtroTipo} onValueChange={v => setFiltroTipo(v as FiltroTipo)}>
          <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="entradas">Entradas</SelectItem>
            <SelectItem value="saidas">Gastos</SelectItem>
            <SelectItem value="vendas">Vendas</SelectItem>
            <SelectItem value="transferencias">Transferências</SelectItem>
          </SelectContent>
        </Select>

        {/* Dinheiro */}
        <Select value={filtroDinheiro} onValueChange={v => setFiltroDinheiro(v as FiltroDinheiro)}>
          <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Sujo + Limpo</SelectItem>
            <SelectItem value="sujo">Sujo</SelectItem>
            <SelectItem value="limpo">Limpo</SelectItem>
          </SelectContent>
        </Select>

        <Input placeholder="Categoria..." className="h-8 w-36 text-xs"
          value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} />
        <Input type="date" className="h-8 w-36 text-xs"
          value={filtroDataDe} onChange={e => setFiltroDataDe(e.target.value)} />
        <Input type="date" className="h-8 w-36 text-xs"
          value={filtroDataAte} onChange={e => setFiltroDataAte(e.target.value)} />

        <span className="text-xs text-muted-foreground ml-1">{lancFiltrados.length} registros</span>

        <Button size="sm" className="h-8 text-xs gap-1 ml-auto" onClick={abrirNovo}>
          <Plus className="h-3.5 w-3.5" /> Adicionar movimentação
        </Button>
      </div>

      {/* ── Tabela ── */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        {lancFiltrados.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center">
            <p className="text-sm text-muted-foreground">Nenhum lançamento</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground w-16">Data</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground w-8"></th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground w-14">$</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Item / Descrição</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground w-28">Categoria</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground w-24">Qtd</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground w-24">Preço</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground w-28">Total</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground w-28">Responsável</th>
                  <th className="px-3 py-2 w-14"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {lancFiltrados.map(l => {
                  const conta = contaMap[l.conta_id]
                  const isEntrada = l.tipo === 'entrada' || l.tipo === 'venda'
                  const isTrans   = l.tipo === 'transferencia'
                  const isVenda   = l.tipo === 'venda'
                  const destNome  = l.conta_destino_id ? contaMap[l.conta_destino_id]?.nome : null
                  const Icon = isEntrada ? TrendingUp : isTrans ? ArrowLeftRight : TrendingDown
                  const iconCor = isEntrada ? 'text-emerald-400' : isTrans ? 'text-blue-400' : 'text-red-400'
                  return (
                    <tr key={l.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-3 py-2.5 text-muted-foreground tabular-nums">
                        {fmtData(l.data ?? l.created_at)}
                      </td>
                      <td className="px-3 py-2.5">
                        <Icon className={cn('h-3.5 w-3.5', iconCor)} />
                      </td>
                      <td className="px-3 py-2.5">
                        {l.tipo_dinheiro ? (
                          <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded',
                            l.tipo_dinheiro === 'sujo'
                              ? 'bg-orange-500/15 text-orange-400'
                              : 'bg-emerald-500/15 text-emerald-400'
                          )}>
                            {l.tipo_dinheiro === 'sujo' ? 'S' : 'L'}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-2.5 max-w-[200px]">
                        <p className="truncate font-medium">
                          {l.item_descricao ?? l.descricao ?? (l.cotacoes ? `Compra: ${l.cotacoes.titulo ?? l.cotacoes.fornecedor_nome}` : '—')}
                        </p>
                        {isTrans && destNome && (
                          <p className="text-[10px] text-muted-foreground">→ {destNome}</p>
                        )}
                        {isVenda && <p className="text-[10px] text-blue-400">venda</p>}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground truncate max-w-[112px]">
                        {l.categoria ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                        {fmtNum(l.quantidade)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                        {l.preco != null ? fmt(l.preco) : '—'}
                      </td>
                      <td className={cn('px-3 py-2.5 text-right tabular-nums font-medium',
                        isEntrada ? 'text-emerald-400' : isTrans ? 'text-foreground' : 'text-red-400'
                      )}>
                        {isEntrada ? '+' : isTrans ? '' : '-'}{fmt(l.total ?? l.valor)}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground truncate max-w-[112px]">
                        {conta?.nome ?? '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!isVenda && (
                            <button onClick={() => abrirEditar(l)}
                              className="p-1 rounded hover:bg-white/[0.07] text-muted-foreground hover:text-foreground transition-colors">
                              <Pencil className="h-3 w-3" />
                            </button>
                          )}
                          <button onClick={() => setDeleteId(l.id)}
                            className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal movimentação ── */}
      <Dialog open={modalOpen} onOpenChange={o => { if (!salvando) setModalOpen(o) }}>
        <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar lançamento' : 'Nova movimentação'}</DialogTitle>
          </DialogHeader>

          {/* Toggle entrada / gasto */}
          <div className="flex rounded-lg overflow-hidden border border-border">
            <button
              className={cn('flex-1 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2',
                form.tipo_mov === 'entrada' ? 'bg-emerald-500/20 text-emerald-400' : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setF({ tipo_mov: 'entrada', is_compra: false })}>
              <TrendingUp className="h-4 w-4" /> Entrada
            </button>
            <button
              className={cn('flex-1 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2 border-l border-border',
                form.tipo_mov === 'saida' ? 'bg-red-500/20 text-red-400' : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setF({ tipo_mov: 'saida' })}>
              <TrendingDown className="h-4 w-4" /> Gasto
            </button>
          </div>

          {/* Compra de cotação (só para saída) */}
          {form.tipo_mov === 'saida' && (
            <button
              onClick={() => setF({ is_compra: !form.is_compra })}
              className={cn('flex items-center gap-2 text-xs px-3 py-2 rounded-lg border transition-colors',
                form.is_compra
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground'
              )}>
              <ShoppingCart className="h-3.5 w-3.5" />
              Vincular à cotação
            </button>
          )}

          {form.is_compra && form.tipo_mov === 'saida' && (
            <div className="space-y-1">
              <Label className="text-xs">Cotação</Label>
              <Select value={form.cotacao_id} onValueChange={v => setF({ cotacao_id: v })}>
                <SelectTrigger className="text-xs h-9"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {cotacoesFinaliz.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.titulo ?? c.fornecedor_nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Data</Label>
              <Input type="date" className="h-9 text-xs" value={form.data} onChange={e => setF({ data: e.target.value })} />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Tipo de dinheiro</Label>
              <div className="flex rounded-lg overflow-hidden border border-border h-9">
                {(['limpo', 'sujo'] as const).map(t => (
                  <button key={t} onClick={() => setF({ tipo_dinheiro: t })}
                    className={cn('flex-1 text-xs font-medium transition-colors',
                      form.tipo_dinheiro === t
                        ? t === 'limpo' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-orange-500/20 text-orange-400'
                        : 'text-muted-foreground hover:text-foreground',
                      t === 'sujo' && 'border-l border-border'
                    )}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Origem</Label>
            <Select value={form.origem_tipo || 'nenhum'} onValueChange={v => setF({ origem_tipo: v === 'nenhum' ? '' : v as 'faccao' | 'loja' | 'pessoa' })}>
              <SelectTrigger className="text-xs h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">Não informar</SelectItem>
                <SelectItem value="faccao">Facção</SelectItem>
                <SelectItem value="loja">Loja</SelectItem>
                <SelectItem value="pessoa">Pessoa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Item / Descrição</Label>
            <Input list="hist-descricao" className="h-9 text-xs" placeholder="Ex: Fuzil, Entrega, Aluguel..."
              value={form.item_descricao} onChange={e => setF({ item_descricao: e.target.value })} />
            <datalist id="hist-descricao">
              {histDescricao.map(d => <option key={d!} value={d!} />)}
            </datalist>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Categoria</Label>
            <Input list="hist-categoria" className="h-9 text-xs" placeholder="Ex: Armamento, Logística..."
              value={form.categoria} onChange={e => setF({ categoria: e.target.value })} />
            <datalist id="hist-categoria">
              {histCategoria.map(c => <option key={c!} value={c!} />)}
            </datalist>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Preço unit.</Label>
              <Input type="number" min="0" className="h-9 text-xs" placeholder="0"
                value={form.preco} onChange={e => onPrecoChange(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Quantidade</Label>
              <Input type="number" min="0" className="h-9 text-xs" placeholder="0"
                value={form.quantidade} onChange={e => onQtdChange(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Total</Label>
              <Input type="number" min="0" className="h-9 text-xs" placeholder="0"
                value={form.total} onChange={e => onTotalChange(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Responsável (quem {form.tipo_mov === 'entrada' ? 'recebeu' : 'pagou'})</Label>
            <Select value={form.conta_id || 'sem'} onValueChange={v => setF({ conta_id: v === 'sem' ? '' : v })}>
              <SelectTrigger className="text-xs h-9"><SelectValue placeholder="Selecione a conta..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sem">Selecione...</SelectItem>
                {contas.filter(c => c.status === 'ativo').map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSalvar} disabled={salvando}>
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : (form.id ? 'Salvar' : 'Registrar')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Confirmar delete ── */}
      <Dialog open={!!deleteId} onOpenChange={o => { if (!o) setDeleteId(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Remover lançamento?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">O saldo será revertido automaticamente.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" size="sm" onClick={() => deleteId && handleDelete(deleteId)}>
              Remover
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function ResumoCard({ label, valor, cor, negativo }: {
  label: string; valor: number; cor: string; negativo?: boolean
}) {
  const colors: Record<string, string> = {
    emerald: 'text-emerald-400', yellow: 'text-yellow-400',
    red: 'text-red-400', orange: 'text-orange-400',
  }
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <p className={cn('text-lg font-bold tabular-nums', colors[cor])}>
        {negativo ? '-' : ''}{Math.abs(valor).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
      </p>
    </div>
  )
}

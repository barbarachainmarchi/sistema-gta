'use client'

import { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Loader2, Target, Plus, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MetaSemanal, MembroMeta, MembroMetaItem, Membro, ContaMembro, SbClient } from './metas-client'
import { progressoMembro, fmtSemana } from './metas-client'

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CFG = {
  em_andamento: { label: 'Em andamento', cls: 'bg-blue-500/15 text-blue-400' },
  completo:     { label: 'Completo',      cls: 'bg-emerald-500/15 text-emerald-400' },
  incompleto:   { label: 'Incompleto',    cls: 'bg-red-500/15 text-red-400' },
  justificado:  { label: 'Justificado',   cls: 'bg-amber-500/15 text-amber-400' },
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

type FormItem = { id?: string; item_nome: string; quantidade_meta: string; tipo_dinheiro: 'limpo' | 'sujo' | '' }

function isDinheiro(it: MembroMetaItem) {
  return it.tipo_dinheiro != null || it.item_nome.toLowerCase().includes('dinheiro')
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  metaAtual: MetaSemanal | null
  membros: Membro[]
  contas: ContaMembro[]
  sb: SbClient
  userId: string; userNome: string | null
  setMetaAtual: React.Dispatch<React.SetStateAction<MetaSemanal | null>>
  podeEditar: boolean; podeLancar: boolean
  onAbrirNovaMeta: () => void
  catalogoItens: { id: string; nome: string }[]
}

// ── Componente ────────────────────────────────────────────────────────────────

export function VisaoGeralAba({ metaAtual, membros, contas, sb, userId, userNome, setMetaAtual, podeEditar, podeLancar, onAbrirNovaMeta, catalogoItens }: Props) {
  const membroMap = useMemo(() => Object.fromEntries(membros.map(m => [m.id, m])), [membros])
  const contaMap  = useMemo(() => {
    const m: Record<string, ContaMembro> = {}
    for (const c of contas) if (c.membro_id) m[c.membro_id] = c
    return m
  }, [contas])

  // ── Editar meta do membro ──────────────────────────────────────────────────
  const [editando, setEditando]   = useState<MembroMeta | null>(null)
  const [formItens, setFormItens] = useState<FormItem[]>([])
  const [salvandoEdit, setSalvandoEdit] = useState(false)

  function abrirEditar(mm: MembroMeta) {
    setEditando(mm)
    setFormItens(mm.metas_membros_itens.map(it => ({
      id: it.id, item_nome: it.item_nome,
      quantidade_meta: String(it.quantidade_meta),
      tipo_dinheiro: it.tipo_dinheiro ?? '',
    })))
  }
  function setFI(i: number, p: Partial<FormItem>) { setFormItens(prev => prev.map((x, j) => j === i ? { ...x, ...p } : x)) }
  function removeFI(i: number) { setFormItens(prev => prev.filter((_, j) => j !== i)) }
  function addFI() { setFormItens(prev => [...prev, { item_nome: '', quantidade_meta: '', tipo_dinheiro: '' }]) }

  async function handleSalvarEdit() {
    if (!editando) return
    const validos = formItens.filter(it => it.item_nome.trim() && Number(it.quantidade_meta) > 0)
    if (!validos.length) { toast.error('Adicione pelo menos um item'); return }
    setSalvandoEdit(true)
    try {
      await sb().from('metas_membros_itens').delete().eq('membro_meta_id', editando.id)
      const rows = validos.map((it, i) => ({
        membro_meta_id: editando.id, item_nome: it.item_nome.trim(),
        quantidade_meta: Number(it.quantidade_meta), quantidade_entregue: 0,
        tipo_dinheiro: it.tipo_dinheiro || null, ordem: i,
      }))
      const { data: novosItens, error } = await sb().from('metas_membros_itens').insert(rows).select('*')
      if (error) { toast.error(error.message); return }
      setMetaAtual(prev => {
        if (!prev) return prev
        return {
          ...prev,
          metas_membros: prev.metas_membros.map(mm =>
            mm.id === editando.id ? { ...mm, metas_membros_itens: (novosItens ?? []) as MembroMetaItem[] } : mm
          ),
        }
      })
      toast.success('Meta atualizada!')
      setEditando(null)
    } finally { setSalvandoEdit(false) }
  }

  // ── Lançar entrega ─────────────────────────────────────────────────────────
  const [lancandoMm, setLancandoMm] = useState<MembroMeta | null>(null)
  const [itemSel, setItemSel]       = useState('')
  const [qtdStr, setQtdStr]         = useState('')
  const [respNome, setRespNome]     = useState('')
  const [nota, setNota]             = useState('')
  const [salvando, setSalvando]     = useState(false)

  function abrirLancar(mm: MembroMeta) {
    setLancandoMm(mm)
    setItemSel(mm.metas_membros_itens[0]?.id ?? '')
    setQtdStr('')
    setRespNome('')
    setNota('')
  }

  async function handleLancar() {
    if (!lancandoMm || !itemSel || !qtdStr) { toast.error('Preencha item e quantidade'); return }
    const qtd = Number(qtdStr)
    if (qtd <= 0) { toast.error('Quantidade inválida'); return }
    const it = lancandoMm.metas_membros_itens.find(x => x.id === itemSel)
    if (!it) return

    setSalvando(true)
    try {
      // Registrar entrega
      const { error: errE } = await sb().from('metas_entregas').insert({
        membro_meta_id: lancandoMm.id, membro_meta_item_id: it.id,
        quantidade: qtd, tipo_dinheiro: it.tipo_dinheiro ?? null,
        responsavel_recebimento_nome: respNome.trim() || null,
        nota: nota.trim() || null, lancado_por_nome: userNome,
      })
      if (errE) { toast.error(errE.message); return }

      // Atualizar quantidade_entregue
      const novaQtd = it.quantidade_entregue + qtd
      const { error: errI } = await sb().from('metas_membros_itens')
        .update({ quantidade_entregue: novaQtd }).eq('id', it.id)
      if (errI) { toast.error(errI.message); return }

      // Registrar entrada no estoque
      const itemCatalogo = catalogoItens.find(c => c.nome.toLowerCase() === it.item_nome.toLowerCase())
      if (itemCatalogo) {
        const membroNome = membros.find(m => m.id === lancandoMm.membro_id)?.nome ?? lancandoMm.membro_id
        await sb().from('estoque_movimentos').insert({
          item_id: itemCatalogo.id, tipo: 'entrada', quantidade: qtd,
          motivo: `Meta: ${membroNome}`,
          usuario_id: userId, usuario_nome: userNome ?? '',
          referencia: lancandoMm.id,
        })
      }

      // Verificar se todos os itens foram concluídos → auto-completo
      const itensAtualizados = lancandoMm.metas_membros_itens.map(x =>
        x.id === it.id ? { ...x, quantidade_entregue: novaQtd } : x
      )
      const todosCompletos = itensAtualizados.every(x => x.quantidade_entregue >= x.quantidade_meta)
      let novoStatus = lancandoMm.status
      if (todosCompletos && !lancandoMm.status_forcado) {
        novoStatus = 'completo'
        await sb().from('metas_membros').update({ status: 'completo' }).eq('id', lancandoMm.id)
      }

      // Atualizar state
      setMetaAtual(prev => {
        if (!prev) return prev
        return {
          ...prev,
          metas_membros: prev.metas_membros.map(mm =>
            mm.id === lancandoMm.id
              ? { ...mm, status: novoStatus as MembroMeta['status'], metas_membros_itens: itensAtualizados }
              : mm
          ),
        }
      })

      toast.success('Entrega registrada!')
      setLancandoMm(null)
    } finally { setSalvando(false) }
  }

  // ── Alterar status manual ──────────────────────────────────────────────────
  async function handleAlterarStatus(mm: MembroMeta, novoStatus: MembroMeta['status']) {
    const { error } = await sb().from('metas_membros').update({
      status: novoStatus, status_forcado: true,
    }).eq('id', mm.id)
    if (error) { toast.error(error.message); return }
    setMetaAtual(prev => {
      if (!prev) return prev
      return { ...prev, metas_membros: prev.metas_membros.map(x => x.id === mm.id ? { ...x, status: novoStatus, status_forcado: true } : x) }
    })
    toast.success('Status alterado')
  }

  // ── Sem meta ───────────────────────────────────────────────────────────────
  if (!metaAtual) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center gap-4">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Target className="h-8 w-8 text-primary/50" />
        </div>
        <div>
          <p className="text-sm font-medium">Nenhuma meta ativa</p>
          <p className="text-xs text-muted-foreground mt-1">Crie uma meta para a semana atual e acompanhe o progresso dos membros.</p>
        </div>
        {podeEditar && (
          <Button size="sm" onClick={onAbrirNovaMeta} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Criar Meta da Semana
          </Button>
        )}
      </div>
    )
  }

  // Ordenar metas_membros por progresso desc
  const mmOrdenados = [...metaAtual.metas_membros].sort((a, b) => progressoMembro(b) - progressoMembro(a))
  // Membros sem meta
  const membrosSemMeta = membros.filter(m => !metaAtual.metas_membros.find(mm => mm.membro_id === m.id))

  const itSel = lancandoMm?.metas_membros_itens.find(x => x.id === itemSel)

  return (
    <div className="h-full overflow-y-auto p-6">

      {/* ── Cards dos membros ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">

        {mmOrdenados.map(mm => {
          const membro   = membroMap[mm.membro_id]
          const conta    = contaMap[mm.membro_id]
          const prog     = progressoMembro(mm)
          const cfg      = STATUS_CFG[mm.status]
          const itens    = [...mm.metas_membros_itens].sort((a, b) => a.ordem - b.ordem)

          return (
            <div key={mm.id} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3 hover:border-border/70 transition-colors">

              {/* Header do card */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-semibold text-primary">{(membro?.nome ?? '?')[0].toUpperCase()}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{membro?.nome ?? mm.membro_id}</p>
                    {membro?.vulgo && <p className="text-[11px] text-muted-foreground truncate">{membro.vulgo}</p>}
                  </div>
                </div>
                <span className={cn('text-[10px] px-2 py-0.5 rounded-full shrink-0', cfg.cls)}>{cfg.label}</span>
              </div>

              {/* Barra de progresso geral */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px] text-muted-foreground">Progresso geral</span>
                  <span className="text-[11px] font-semibold">{prog}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500',
                      prog >= 100 ? 'bg-emerald-500' : prog >= 60 ? 'bg-blue-500' : prog >= 30 ? 'bg-amber-500' : 'bg-red-500'
                    )}
                    style={{ width: `${Math.min(prog, 100)}%` }}
                  />
                </div>
              </div>

              {/* Itens */}
              {itens.length > 0 && (
                <div className="space-y-1.5">
                  {itens.map(it => {
                    const pct = Math.min(Math.round((it.quantidade_entregue / (it.quantidade_meta || 1)) * 100), 100)
                    return (
                      <div key={it.id}>
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="flex items-center gap-1 min-w-0">
                            <span className="text-[11px] truncate text-muted-foreground">{it.item_nome}</span>
                            {it.tipo_dinheiro && (
                              <span className={cn('text-[9px] px-1 rounded', it.tipo_dinheiro === 'limpo' ? 'text-emerald-400 bg-emerald-500/10' : 'text-orange-400 bg-orange-500/10')}>
                                {it.tipo_dinheiro[0].toUpperCase()}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                            {isDinheiro(it) ? `${fmt(it.quantidade_entregue)}/${fmt(it.quantidade_meta)}` : `${it.quantidade_entregue}/${it.quantidade_meta}`}
                          </span>
                        </div>
                        <div className="h-1 bg-muted rounded-full overflow-hidden">
                          <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-emerald-500' : 'bg-primary/70')}
                            style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Saldo */}
              {conta && (conta.saldo_limpo > 0 || conta.saldo_sujo > 0) && (
                <div className="pt-2 border-t border-border/50">
                  <p className="text-[10px] text-muted-foreground mb-0.5">Saldo na carteira</p>
                  <div className="flex gap-3">
                    {conta.saldo_limpo > 0 && <span className="text-[11px] text-emerald-400">L {fmt(conta.saldo_limpo)}</span>}
                    {conta.saldo_sujo  > 0 && <span className="text-[11px] text-orange-400">S {fmt(conta.saldo_sujo)}</span>}
                  </div>
                </div>
              )}

              {/* Ações */}
              <div className="flex gap-1.5 pt-1 border-t border-border/50">
                {podeLancar && itens.length > 0 && (
                  <Button size="sm" variant="outline" className="h-7 text-[11px] flex-1 gap-1" onClick={() => abrirLancar(mm)}>
                    <Plus className="h-3 w-3" /> Lançar
                  </Button>
                )}
                {podeEditar && (
                  <Button size="sm" variant="ghost" className="h-7 text-[11px] px-2 text-muted-foreground hover:text-foreground" onClick={() => abrirEditar(mm)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
                {podeEditar && (
                  <Select onValueChange={v => handleAlterarStatus(mm, v as MembroMeta['status'])}>
                    <SelectTrigger className="h-7 text-[11px] w-auto px-2">
                      <span className="text-muted-foreground">Status</span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="em_andamento">Em andamento</SelectItem>
                      <SelectItem value="completo">Forçar completo</SelectItem>
                      <SelectItem value="incompleto">Forçar incompleto</SelectItem>
                      <SelectItem value="justificado">Justificado</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          )
        })}

        {/* Membros sem meta (destaque discreto) */}
        {membrosSemMeta.length > 0 && (
          <div className="col-span-full">
            <p className="text-[11px] text-muted-foreground mt-2">
              Sem meta: {membrosSemMeta.map(m => m.nome).join(', ')}
              {podeEditar && <span className="text-primary/70 ml-1">(use "Aplicar a todos" no cabeçalho)</span>}
            </p>
          </div>
        )}

        {mmOrdenados.length === 0 && membrosSemMeta.length === 0 && (
          <div className="col-span-full flex flex-col items-center py-12 text-center gap-2">
            <p className="text-sm text-muted-foreground">Nenhum membro na meta ainda</p>
            {podeEditar && <p className="text-xs text-muted-foreground/60">Clique em "Aplicar a todos" para distribuir a meta para os membros ativos.</p>}
          </div>
        )}
      </div>

      {/* ── Modal editar meta do membro ── */}
      <Dialog open={!!editando} onOpenChange={o => { if (!salvandoEdit && !o) setEditando(null) }}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Editar Meta — {membroMap[editando?.membro_id ?? '']?.nome}</DialogTitle>
          </DialogHeader>
          {editando && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Substitui todos os itens da meta deste membro. Entregas já registradas são mantidas.</p>
              <datalist id="visao-geral-itens-list">
                {catalogoItens.map(item => <option key={item.id} value={item.nome} />)}
              </datalist>
              {formItens.map((it, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input className="h-8 text-xs flex-1" placeholder="Item" list="visao-geral-itens-list"
                    value={it.item_nome} onChange={e => setFI(i, { item_nome: e.target.value })} />
                  <Input className="h-8 text-xs w-24" placeholder="Meta" type="number" min="0"
                    value={it.quantidade_meta} onChange={e => setFI(i, { quantidade_meta: e.target.value })} />
                  <Select value={it.tipo_dinheiro || 'none'} onValueChange={v => setFI(i, { tipo_dinheiro: v === 'none' ? '' : v as 'limpo' | 'sujo' })}>
                    <SelectTrigger className="h-8 text-xs w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      <SelectItem value="limpo">Limpo</SelectItem>
                      <SelectItem value="sujo">Sujo</SelectItem>
                    </SelectContent>
                  </Select>
                  <button onClick={() => removeFI(i)} className="p-1 text-muted-foreground hover:text-red-400">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button onClick={addFI} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <Plus className="h-3 w-3" /> Adicionar item
              </button>
              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button variant="outline" size="sm" onClick={() => setEditando(null)} disabled={salvandoEdit}>Cancelar</Button>
                <Button size="sm" onClick={handleSalvarEdit} disabled={salvandoEdit}>
                  {salvandoEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Modal lançar entrega ── */}
      <Dialog open={!!lancandoMm} onOpenChange={o => { if (!salvando && !o) setLancandoMm(null) }}>
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>
              Lançar Entrega — {membroMap[lancandoMm?.membro_id ?? '']?.nome}
            </DialogTitle>
          </DialogHeader>

          {lancandoMm && (
            <div className="space-y-4">
              {/* Item */}
              <div className="space-y-1.5">
                <Label className="text-xs">Item</Label>
                <Select value={itemSel} onValueChange={setItemSel}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {lancandoMm.metas_membros_itens.map(it => (
                      <SelectItem key={it.id} value={it.id}>
                        {it.item_nome}{it.tipo_dinheiro ? ` (${it.tipo_dinheiro})` : ''} — {it.quantidade_entregue}/{it.quantidade_meta}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Quantidade */}
              <div className="space-y-1.5">
                <Label className="text-xs">{itSel && isDinheiro(itSel) ? 'Valor (R$)' : 'Quantidade'}</Label>
                <Input type="number" min="0" className="h-9 text-sm" placeholder="0"
                  value={qtdStr} onChange={e => setQtdStr(e.target.value)} />
                {itSel && itSel.quantidade_meta > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Faltam: {Math.max(0, itSel.quantidade_meta - itSel.quantidade_entregue - (Number(qtdStr) || 0))} unidades
                  </p>
                )}
              </div>

              {/* Responsável (só dinheiro) */}
              {itSel && isDinheiro(itSel) && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Responsável pelo recebimento</Label>
                  <Input className="h-9 text-sm" placeholder="Quem recebeu o dinheiro"
                    value={respNome} onChange={e => setRespNome(e.target.value)} />
                </div>
              )}

              {/* Nota */}
              <div className="space-y-1.5">
                <Label className="text-xs">Observação (opcional)</Label>
                <Input className="h-9 text-sm" placeholder="Ex: parcial, com atraso..."
                  value={nota} onChange={e => setNota(e.target.value)} />
              </div>

              <div className="flex justify-end gap-2 pt-1 border-t border-border">
                <Button variant="outline" size="sm" onClick={() => setLancandoMm(null)} disabled={salvando}>Cancelar</Button>
                <Button size="sm" onClick={handleLancar} disabled={salvando}>
                  {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Registrar Entrega'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  )
}


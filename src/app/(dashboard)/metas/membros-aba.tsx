'use client'

import { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Loader2, Plus, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MetaSemanal, MembroMeta, MembroMetaItem, Membro, ContaMembro, SbClient } from './metas-client'
import { progressoMembro } from './metas-client'

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CFG = {
  em_andamento: { label: 'Em andamento', cls: 'text-blue-400 bg-blue-500/10' },
  completo:     { label: 'Completo',      cls: 'text-emerald-400 bg-emerald-500/10' },
  incompleto:   { label: 'Incompleto',    cls: 'text-red-400 bg-red-500/10' },
  justificado:  { label: 'Justificado',   cls: 'text-amber-400 bg-amber-500/10' },
}

function fmt(n: number) { return n.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) }
function isDinheiro(it: MembroMetaItem) {
  return it.tipo_dinheiro != null || it.item_nome.toLowerCase().includes('dinheiro')
}

type FormItem = { id?: string; item_nome: string; quantidade_meta: string; tipo_dinheiro: 'limpo' | 'sujo' | '' }

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  metaAtual: MetaSemanal | null
  membros: Membro[]
  contas: ContaMembro[]
  sb: SbClient
  userId: string; userNome: string | null
  setMetaAtual: React.Dispatch<React.SetStateAction<MetaSemanal | null>>
  podeEditar: boolean; podeLancar: boolean
  catalogoItens: { id: string; nome: string }[]
}

// ── Componente ────────────────────────────────────────────────────────────────

export function MembrosAba({ metaAtual, membros, contas, sb, userId, userNome, setMetaAtual, podeEditar, podeLancar, catalogoItens }: Props) {
  const membroMap = useMemo(() => Object.fromEntries(membros.map(m => [m.id, m])), [membros])
  const contaMap  = useMemo(() => {
    const m: Record<string, ContaMembro> = {}
    for (const c of contas) if (c.membro_id) m[c.membro_id] = c
    return m
  }, [contas])

  const [expandido, setExpandido] = useState<Set<string>>(new Set())
  const toggleExp = (id: string) => setExpandido(prev => {
    const s = new Set(prev)
    s.has(id) ? s.delete(id) : s.add(id)
    return s
  })

  // ── Editar meta do membro ──────────────────────────────────────────────────
  const [editando, setEditando]     = useState<MembroMeta | null>(null)
  const [formItens, setFormItens]   = useState<FormItem[]>([])
  const [salvando, setSalvando]     = useState(false)

  function abrirEditar(mm: MembroMeta) {
    setEditando(mm)
    setFormItens(
      mm.metas_membros_itens.map(it => ({
        id: it.id, item_nome: it.item_nome,
        quantidade_meta: String(it.quantidade_meta),
        tipo_dinheiro: it.tipo_dinheiro ?? '',
      }))
    )
  }
  function addFormItem() { setFormItens(prev => [...prev, { item_nome: '', quantidade_meta: '', tipo_dinheiro: '' }]) }
  function setFI(i: number, p: Partial<FormItem>) { setFormItens(prev => prev.map((x, j) => j === i ? { ...x, ...p } : x)) }
  function removeFI(i: number) { setFormItens(prev => prev.filter((_, j) => j !== i)) }

  async function handleSalvarMeta() {
    if (!editando) return
    const validos = formItens.filter(it => it.item_nome.trim() && Number(it.quantidade_meta) > 0)
    if (!validos.length) { toast.error('Adicione pelo menos um item'); return }

    setSalvando(true)
    try {
      // Apagar itens antigos e reinserir (full replace)
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
            mm.id === editando.id
              ? { ...mm, metas_membros_itens: (novosItens ?? []) as MembroMetaItem[] }
              : mm
          ),
        }
      })
      toast.success('Meta do membro atualizada!')
      setEditando(null)
    } finally { setSalvando(false) }
  }

  // ── Lançar entrega ─────────────────────────────────────────────────────────
  const [lancandoMm, setLancandoMm]   = useState<MembroMeta | null>(null)
  const [itemSel, setItemSel]         = useState('')
  const [qtdStr, setQtdStr]           = useState('')
  const [respNome, setRespNome]       = useState('')
  const [nota, setNota]               = useState('')
  const [salvandoL, setSalvandoL]     = useState(false)

  function abrirLancar(mm: MembroMeta) {
    setLancandoMm(mm)
    setItemSel(mm.metas_membros_itens[0]?.id ?? '')
    setQtdStr(''); setRespNome(''); setNota('')
  }

  async function handleLancar() {
    if (!lancandoMm || !itemSel || !qtdStr) { toast.error('Preencha item e quantidade'); return }
    const qtd = Number(qtdStr)
    if (qtd <= 0) { toast.error('Quantidade inválida'); return }
    const it = lancandoMm.metas_membros_itens.find(x => x.id === itemSel)
    if (!it) return

    setSalvandoL(true)
    try {
      await sb().from('metas_entregas').insert({
        membro_meta_id: lancandoMm.id, membro_meta_item_id: it.id,
        quantidade: qtd, tipo_dinheiro: it.tipo_dinheiro ?? null,
        responsavel_recebimento_nome: respNome.trim() || null,
        nota: nota.trim() || null, lancado_por_nome: userNome,
      })

      const novaQtd = it.quantidade_entregue + qtd
      await sb().from('metas_membros_itens').update({ quantidade_entregue: novaQtd }).eq('id', it.id)

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

      const itensAtualizados = lancandoMm.metas_membros_itens.map(x =>
        x.id === it.id ? { ...x, quantidade_entregue: novaQtd } : x
      )
      const todosCompletos = itensAtualizados.every(x => x.quantidade_entregue >= x.quantidade_meta)
      let novoStatus = lancandoMm.status
      if (todosCompletos && !lancandoMm.status_forcado) {
        novoStatus = 'completo'
        await sb().from('metas_membros').update({ status: 'completo' }).eq('id', lancandoMm.id)
      }

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
    } finally { setSalvandoL(false) }
  }

  // ── Observação ─────────────────────────────────────────────────────────────
  async function handleSalvarObs(mm: MembroMeta, obs: string) {
    await sb().from('metas_membros').update({ observacao: obs || null }).eq('id', mm.id)
    setMetaAtual(prev => {
      if (!prev) return prev
      return { ...prev, metas_membros: prev.metas_membros.map(x => x.id === mm.id ? { ...x, observacao: obs || null } : x) }
    })
  }

  // ── Sem meta ───────────────────────────────────────────────────────────────
  if (!metaAtual) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-muted-foreground">Nenhuma meta ativa. Crie uma meta na aba Visão Geral.</p>
      </div>
    )
  }

  const mmOrdenados = [...metaAtual.metas_membros].sort((a, b) => {
    const ma = membroMap[a.membro_id]?.nome ?? ''
    const mb = membroMap[b.membro_id]?.nome ?? ''
    return ma.localeCompare(mb)
  })

  const itSel = lancandoMm?.metas_membros_itens.find(x => x.id === itemSel)

  return (
    <div className="h-full overflow-y-auto">

      {/* ── Tabela ── */}
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-card border-b border-border z-10">
          <tr>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground w-8" />
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Membro</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Status</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground w-48">Progresso</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Saldo</th>
            <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {mmOrdenados.map(mm => {
            const membro = membroMap[mm.membro_id]
            const conta  = contaMap[mm.membro_id]
            const prog   = progressoMembro(mm)
            const cfg    = STATUS_CFG[mm.status]
            const exp    = expandido.has(mm.id)

            return (
              <>
                <tr key={mm.id} className={cn('hover:bg-white/[0.02] transition-colors', exp && 'bg-white/[0.015]')}>
                  {/* Expand */}
                  <td className="px-4 py-2.5">
                    <button onClick={() => toggleExp(mm.id)} className="text-muted-foreground hover:text-foreground transition-colors">
                      {exp ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </button>
                  </td>

                  {/* Membro */}
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-sm">{membro?.nome ?? mm.membro_id}</p>
                    {membro?.vulgo && <p className="text-[11px] text-muted-foreground">{membro.vulgo}</p>}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-2.5">
                    <span className={cn('text-[10px] px-2 py-0.5 rounded-full', cfg.cls)}>{cfg.label}</span>
                    {mm.status_forcado && <span className="text-[9px] text-muted-foreground ml-1">manual</span>}
                  </td>

                  {/* Progresso */}
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full', prog >= 100 ? 'bg-emerald-500' : prog >= 60 ? 'bg-blue-500' : 'bg-amber-500')}
                          style={{ width: `${Math.min(prog, 100)}%` }} />
                      </div>
                      <span className="text-[11px] text-muted-foreground w-8 text-right">{prog}%</span>
                    </div>
                  </td>

                  {/* Saldo */}
                  <td className="px-4 py-2.5 text-[11px]">
                    {conta ? (
                      <span className="text-muted-foreground">
                        {conta.saldo_limpo > 0 && <span className="text-emerald-400 mr-2">L {fmt(conta.saldo_limpo)}</span>}
                        {conta.saldo_sujo  > 0 && <span className="text-orange-400">S {fmt(conta.saldo_sujo)}</span>}
                        {conta.saldo_limpo === 0 && conta.saldo_sujo === 0 && '—'}
                      </span>
                    ) : '—'}
                  </td>

                  {/* Ações */}
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {podeLancar && mm.metas_membros_itens.length > 0 && (
                        <button onClick={() => abrirLancar(mm)}
                          className="flex items-center gap-1 px-2 py-1 text-[11px] rounded bg-primary/10 hover:bg-primary/20 text-primary transition-colors">
                          <Plus className="h-3 w-3" /> Lançar
                        </button>
                      )}
                      {podeEditar && (
                        <button onClick={() => abrirEditar(mm)}
                          className="p-1.5 rounded hover:bg-white/[0.07] text-muted-foreground hover:text-foreground transition-colors">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>

                {/* Linha expandida — itens detalhados */}
                {exp && (
                  <tr key={`${mm.id}-exp`} className="bg-muted/10">
                    <td colSpan={6} className="px-8 py-3">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-3">
                        {mm.metas_membros_itens.map(it => {
                          const pct = Math.min(Math.round((it.quantidade_entregue / (it.quantidade_meta || 1)) * 100), 100)
                          return (
                            <div key={it.id} className="rounded-lg border border-border/50 bg-card p-2.5">
                              <div className="flex items-center gap-1 mb-1.5">
                                <span className="text-xs font-medium truncate">{it.item_nome}</span>
                                {it.tipo_dinheiro && (
                                  <span className={cn('text-[9px] px-1 rounded', it.tipo_dinheiro === 'limpo' ? 'text-emerald-400 bg-emerald-500/10' : 'text-orange-400 bg-orange-500/10')}>
                                    {it.tipo_dinheiro[0].toUpperCase()}
                                  </span>
                                )}
                              </div>
                              <div className="h-1 bg-muted rounded-full overflow-hidden mb-1">
                                <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-emerald-500' : 'bg-primary/70')}
                                  style={{ width: `${pct}%` }} />
                              </div>
                              <div className="flex justify-between text-[10px] text-muted-foreground">
                                <span>{isDinheiro(it) ? fmt(it.quantidade_entregue) : it.quantidade_entregue}</span>
                                <span className="font-medium">{pct}%</span>
                                <span>{isDinheiro(it) ? fmt(it.quantidade_meta) : it.quantidade_meta}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      {mm.observacao && (
                        <p className="text-[11px] text-muted-foreground italic">Obs: {mm.observacao}</p>
                      )}
                      {podeEditar && (
                        <ObsInput value={mm.observacao ?? ''} onSave={obs => handleSalvarObs(mm, obs)} />
                      )}
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </tbody>
      </table>

      {mmOrdenados.length === 0 && (
        <div className="flex items-center justify-center py-16">
          <p className="text-sm text-muted-foreground">Nenhum membro na meta. Use "Aplicar a todos" no cabeçalho.</p>
        </div>
      )}

      {/* ── Modal editar meta do membro ── */}
      <Dialog open={!!editando} onOpenChange={o => { if (!salvando && !o) setEditando(null) }}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Editar Meta — {membroMap[editando?.membro_id ?? '']?.nome}</DialogTitle>
          </DialogHeader>

          {editando && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Substitui todos os itens da meta deste membro. As entregas já registradas são mantidas.</p>

              <datalist id="membros-aba-itens-list">
                {catalogoItens.map(item => <option key={item.id} value={item.nome} />)}
              </datalist>

              {formItens.map((it, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input className="h-8 text-xs flex-1" placeholder="Item" list="membros-aba-itens-list" value={it.item_nome} onChange={e => setFI(i, { item_nome: e.target.value })} />
                  <Input className="h-8 text-xs w-24" placeholder="Meta" type="number" min="0" value={it.quantidade_meta} onChange={e => setFI(i, { quantidade_meta: e.target.value })} />
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

              <button onClick={addFormItem} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <Plus className="h-3 w-3" /> Adicionar item
              </button>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button variant="outline" size="sm" onClick={() => setEditando(null)} disabled={salvando}>Cancelar</Button>
                <Button size="sm" onClick={handleSalvarMeta} disabled={salvando}>
                  {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Modal lançar entrega ── */}
      <Dialog open={!!lancandoMm} onOpenChange={o => { if (!salvandoL && !o) setLancandoMm(null) }}>
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Lançar Entrega — {membroMap[lancandoMm?.membro_id ?? '']?.nome}</DialogTitle>
          </DialogHeader>

          {lancandoMm && (
            <div className="space-y-4">
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

              <div className="space-y-1.5">
                <Label className="text-xs">{itSel && isDinheiro(itSel) ? 'Valor (R$)' : 'Quantidade'}</Label>
                <Input type="number" min="0" className="h-9 text-sm" placeholder="0"
                  value={qtdStr} onChange={e => setQtdStr(e.target.value)} />
                {itSel && itSel.quantidade_meta > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Faltam: {Math.max(0, itSel.quantidade_meta - itSel.quantidade_entregue - (Number(qtdStr) || 0))}
                  </p>
                )}
              </div>

              {itSel && isDinheiro(itSel) && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Responsável pelo recebimento</Label>
                  <Input className="h-9 text-sm" placeholder="Quem recebeu"
                    value={respNome} onChange={e => setRespNome(e.target.value)} />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">Observação (opcional)</Label>
                <Input className="h-9 text-sm" value={nota} onChange={e => setNota(e.target.value)} />
              </div>

              <div className="flex justify-end gap-2 pt-1 border-t border-border">
                <Button variant="outline" size="sm" onClick={() => setLancandoMm(null)} disabled={salvandoL}>Cancelar</Button>
                <Button size="sm" onClick={handleLancar} disabled={salvandoL}>
                  {salvandoL ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Registrar'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Subcomponente ObsInput ────────────────────────────────────────────────────

function ObsInput({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value)
  const [dirty, setDirty] = useState(false)
  return (
    <div className="flex items-center gap-2 mt-2">
      <Input className="h-7 text-xs flex-1" placeholder="Adicionar observação..."
        value={v} onChange={e => { setV(e.target.value); setDirty(true) }} />
      {dirty && (
        <Button size="sm" className="h-7 text-[11px]" onClick={() => { onSave(v); setDirty(false) }}>Salvar obs</Button>
      )}
    </div>
  )
}

'use client'

import React, { useState, useMemo } from 'react'
import { Plus, Trash2, Loader2, Trophy, ChevronDown, ChevronRight, X, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type {
  Competicao, CompEquipe, CompEquipeMembro,
  Acao, AcaoParticipante, AcaoTipo, Membro, CompForm,
  CompTipo, CompItem, CatalogItem,
} from './acao-shared'
import {
  emptyCompForm, TEAM_COLORS, calcTeamProgress, getCompLabel, fmtDatetime,
  MembroSelector,
} from './acao-shared'

interface Props {
  competicoes: Competicao[]
  compEquipes: CompEquipe[]
  compEquipeMembros: CompEquipeMembro[]
  compTipos: CompTipo[]
  compItens: CompItem[]
  catalogItems: CatalogItem[]
  acoes: Acao[]
  participantes: AcaoParticipante[]
  tipos: AcaoTipo[]
  membros: Membro[]
  salvando: boolean
  podeEditar: boolean
  onSave: (form: CompForm) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
  onEncerrar: (id: string, vencedorId: string | null) => Promise<void>
  onAdicionarMembro: (equipeId: string, membroId: string, membroNome: string) => Promise<void>
  onRemoverMembro: (membroEquipeId: string) => Promise<void>
}

export function TabCompeticoes({
  competicoes, compEquipes, compEquipeMembros,
  compTipos, compItens, catalogItems,
  acoes, participantes, tipos, membros,
  salvando, podeEditar,
  onSave, onDelete, onEncerrar, onAdicionarMembro, onRemoverMembro,
}: Props) {
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<CompForm>(emptyCompForm)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [filtroStatus, setFiltroStatus] = useState<'ativa' | 'encerrada' | 'todos'>('ativa')
  const [addMembroEquipeId, setAddMembroEquipeId] = useState<string | null>(null)
  const [addMembroIds, setAddMembroIds] = useState<string[]>([])

  const visiveis = useMemo(() =>
    filtroStatus === 'todos' ? competicoes : competicoes.filter(c => c.status === filtroStatus),
    [competicoes, filtroStatus]
  )

  function toggleExpand(id: string) {
    setExpandedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  function membrosJaAlocados(competicaoId: string) {
    const equipeIds = new Set(compEquipes.filter(e => e.competicao_id === competicaoId).map(e => e.id))
    return new Set(compEquipeMembros.filter(m => equipeIds.has(m.equipe_id)).map(m => m.membro_id))
  }

  async function handleSave() {
    const ok = await onSave(form)
    if (ok) { setFormOpen(false); setForm(emptyCompForm) }
  }

  async function handleSaveAndNext() {
    const ok = await onSave(form)
    if (ok) setForm(emptyCompForm)
  }

  function handleEncerrarComp(comp: Competicao) {
    const equipes = compEquipes.filter(e => e.competicao_id === comp.id)
    const scores = equipes.map(e => ({
      equipe: e,
      progresso: calcTeamProgress(comp, e.id, acoes, participantes),
    })).sort((a, b) => b.progresso - a.progresso)
    const vencedor = scores[0]
    onEncerrar(comp.id, vencedor?.equipe.id ?? null)
  }

  async function handleAddMembro(equipeId: string) {
    const equipe = compEquipes.find(e => e.id === equipeId)
    for (const mId of addMembroIds) {
      const m = membros.find(mb => mb.id === mId)
      if (m) await onAdicionarMembro(equipeId, mId, m.nome)
    }
    setAddMembroEquipeId(null)
    setAddMembroIds([])
    void equipe
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 justify-between flex-wrap">
        <div className="flex gap-0.5">
          {(['ativa', 'encerrada', 'todos'] as const).map(s => (
            <button key={s} onClick={() => setFiltroStatus(s)}
              className={cn('px-3 py-1.5 text-xs rounded-md font-medium transition-colors',
                filtroStatus === s ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]'
              )}>
              {s === 'todos' ? 'Todas' : s === 'ativa' ? 'Ativas' : 'Encerradas'}
            </button>
          ))}
        </div>
        {podeEditar && (
          <Button size="sm" className="gap-1.5" onClick={() => { setForm(emptyCompForm); setFormOpen(true) }}>
            <Plus className="h-3.5 w-3.5" />Nova Competição
          </Button>
        )}
      </div>

      {visiveis.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <Trophy className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma competição encontrada</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visiveis.map(comp => {
            const equipes = compEquipes.filter(e => e.competicao_id === comp.id)
            const expanded = expandedIds.has(comp.id)
            const isAtiva = comp.status === 'ativa'
            const prazoPassed = comp.prazo ? new Date(comp.prazo) < new Date() : false
            const scores = equipes.map(e => ({
              equipe: e,
              progresso: calcTeamProgress(comp, e.id, acoes, participantes),
            })).sort((a, b) => b.progresso - a.progresso)
            const maxScore = Math.max(...scores.map(s => s.progresso), comp.meta_valor ?? 1, 1)
            const alreadyAllocated = membrosJaAlocados(comp.id)
            const membroDisponiveis = membros.filter(m => !alreadyAllocated.has(m.id))

            const cTipos = compTipos.filter(ct => ct.competicao_id === comp.id)
            const cItens = compItens.filter(ci => ci.competicao_id === comp.id)
            const nomesItens = cItens.map(ci => catalogItems.find(i => i.id === ci.item_id)?.nome ?? '?')

            return (
              <div key={comp.id} className="rounded-lg border border-border overflow-hidden">
                <div className="flex items-start gap-3 px-4 py-3">
                  <button onClick={() => toggleExpand(comp.id)} className="mt-0.5 shrink-0 text-muted-foreground/50 hover:text-foreground">
                    {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </button>
                  <div className="flex-1 min-w-0" onClick={() => toggleExpand(comp.id)} role="button">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{comp.nome}</span>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium',
                        comp.status === 'ativa' ? 'bg-emerald-500/15 text-emerald-400' :
                        comp.status === 'encerrada' ? 'bg-muted text-muted-foreground' :
                        'bg-red-500/15 text-red-400'
                      )}>
                        {comp.status === 'ativa' ? 'Ativa' : comp.status === 'encerrada' ? 'Encerrada' : 'Cancelada'}
                      </span>
                      {prazoPassed && isAtiva && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 font-medium">Prazo expirado</span>
                      )}
                      {comp.vencedor_equipe_nome && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400 font-medium">
                          🏆 {comp.vencedor_equipe_nome}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{getCompLabel(comp, nomesItens.length > 0 ? nomesItens : undefined)}</p>
                    {/* Tipos vinculados */}
                    {cTipos.length > 0 ? (
                      <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                        {cTipos.map(ct => {
                          const t = tipos.find(x => x.id === ct.tipo_id)
                          return ct.pontos_valor > 0 ? `${t?.nome ?? '?'} (${ct.pontos_valor}pts)` : (t?.nome ?? '?')
                        }).join(' · ')}
                      </p>
                    ) : comp.tipo_acao_nome ? (
                      <p className="text-[11px] text-muted-foreground/60 mt-0.5">Ação: {comp.tipo_acao_nome}</p>
                    ) : null}
                    {/* Progress bars */}
                    <div className="mt-2 space-y-1.5">
                      {scores.map(({ equipe, progresso }) => {
                        const pct = Math.min(100, (progresso / maxScore) * 100)
                        const unidade = comp.modo_progresso === 'item' ? (nomesItens[0] ?? comp.item_nome ?? 'itens') : 'pts'
                        return (
                          <div key={equipe.id}>
                            <div className="flex items-center justify-between text-[11px] mb-0.5">
                              <span className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full" style={{ background: equipe.cor }} />
                                <span>{equipe.nome}</span>
                              </span>
                              <span className="tabular-nums font-medium">
                                {progresso}
                                {comp.meta_valor && <span className="text-muted-foreground"> / {comp.meta_valor}</span>}
                                <span className="text-muted-foreground ml-1">{unidade}</span>
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-border overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: equipe.cor }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  {podeEditar && (
                    <div className="flex items-center gap-1 shrink-0">
                      {isAtiva && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleEncerrarComp(comp)}>
                          Encerrar
                        </Button>
                      )}
                      <button onClick={() => setConfirmDeleteId(comp.id)}
                        className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Expanded: equipes + membros */}
                {expanded && (
                  <div className="border-t border-border/40 px-4 py-3 bg-muted/10">
                    {comp.descricao && <p className="text-xs text-muted-foreground italic mb-3">{comp.descricao}</p>}
                    <div className="grid gap-3 sm:grid-cols-2">
                      {equipes.map(equipe => {
                        const equipeMembs = compEquipeMembros.filter(m => m.equipe_id === equipe.id)
                        const isAddingHere = addMembroEquipeId === equipe.id

                        return (
                          <div key={equipe.id} className="rounded-md border border-border bg-card p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold flex items-center gap-1.5">
                                <span className="h-2.5 w-2.5 rounded-full" style={{ background: equipe.cor }} />
                                {equipe.nome}
                              </span>
                              {podeEditar && isAtiva && !isAddingHere && (
                                <button onClick={() => { setAddMembroEquipeId(equipe.id); setAddMembroIds([]) }}
                                  className="text-[11px] text-primary hover:underline">+ Membro</button>
                              )}
                            </div>
                            {equipeMembs.length === 0 ? (
                              <p className="text-[11px] text-muted-foreground italic">Sem membros</p>
                            ) : (
                              <div className="space-y-0.5">
                                {equipeMembs.map(em => (
                                  <div key={em.id} className="flex items-center justify-between text-xs">
                                    <span>{em.membro_nome}</span>
                                    {podeEditar && isAtiva && (
                                      <button onClick={() => onRemoverMembro(em.id)}
                                        className="text-muted-foreground/40 hover:text-red-400 transition-colors">
                                        <X className="h-3 w-3" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            {isAddingHere && (
                              <div className="space-y-2 pt-1 border-t border-border/40">
                                <MembroSelector membros={membroDisponiveis} selected={addMembroIds} onChange={setAddMembroIds} />
                                <div className="flex gap-1.5">
                                  <Button size="sm" className="h-6 text-[11px] px-2" disabled={addMembroIds.length === 0 || salvando}
                                    onClick={() => handleAddMembro(equipe.id)}>
                                    {salvando ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Adicionar'}
                                  </Button>
                                  <button onClick={() => { setAddMembroEquipeId(null); setAddMembroIds([]) }}
                                    className="text-[11px] text-muted-foreground hover:text-foreground px-1">Cancelar</button>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    {/* Ações vinculadas */}
                    {(() => {
                      const compAcoes = acoes.filter(a => a.competicao_id === comp.id)
                      if (compAcoes.length === 0) return null
                      return (
                        <div className="mt-3 pt-3 border-t border-border/40">
                          <p className="text-[11px] font-medium text-muted-foreground mb-2">{compAcoes.length} ação(ões) vinculada(s)</p>
                          <div className="space-y-1">
                            {compAcoes.map(a => {
                              const equipe = compEquipes.find(e => e.id === a.equipe_id)
                              const itemNome = a.item_id ? (catalogItems.find(i => i.id === a.item_id)?.nome ?? null) : null
                              return (
                                <div key={a.id} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                  {equipe && <span className="h-1.5 w-1.5 rounded-full" style={{ background: equipe.cor }} />}
                                  <span>{fmtDatetime(a.data_hora)}</span>
                                  {equipe && <span className="text-foreground/60">{equipe.nome}</span>}
                                  {comp.modo_progresso === 'item' && a.quantidade_item != null && (
                                    <span className="text-primary font-medium">
                                      +{a.quantidade_item} {itemNome ?? nomesItens[0] ?? comp.item_nome ?? 'itens'}
                                    </span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Nova competição dialog */}
      <Dialog open={formOpen} onOpenChange={o => { if (!o && !salvando) { setFormOpen(false); setForm(emptyCompForm) } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Competição</DialogTitle></DialogHeader>
          <CompFormFields form={form} setForm={setForm} tipos={tipos} membros={membros} catalogItems={catalogItems} />
          <div className="flex justify-between pt-2">
            <Button variant="outline" size="sm" onClick={() => { setFormOpen(false); setForm(emptyCompForm) }} disabled={salvando}>Cancelar</Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleSaveAndNext} disabled={salvando}>
                {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Salvar e criar outra'}
              </Button>
              <Button size="sm" onClick={handleSave} disabled={salvando}>
                {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Criar Competição'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!confirmDeleteId} onOpenChange={o => { if (!o) setConfirmDeleteId(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Excluir competição?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            A competição e todas as equipes serão removidas. As ações vinculadas perdem a referência mas não são excluídas.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmDeleteId(null)} disabled={salvando}>Cancelar</Button>
            <Button variant="destructive" size="sm" disabled={salvando}
              onClick={async () => { if (confirmDeleteId && await onDelete(confirmDeleteId)) setConfirmDeleteId(null) }}>
              {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Excluir'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Formulário de competição ──────────────────────────────────────────────────

function CompFormFields({ form, setForm, tipos, membros, catalogItems }: {
  form: CompForm
  setForm: React.Dispatch<React.SetStateAction<CompForm>>
  tipos: AcaoTipo[]
  membros: Membro[]
  catalogItems: CatalogItem[]
}) {
  function setEquipe(i: number, patch: Partial<CompForm['equipes'][number]>) {
    setForm(f => {
      const equipes = [...f.equipes]
      equipes[i] = { ...equipes[i]!, ...patch }
      return { ...f, equipes }
    })
  }

  function addEquipe() {
    setForm(f => ({
      ...f,
      equipes: [...f.equipes, { nome: `Equipe ${f.equipes.length + 1}`, cor: TEAM_COLORS[f.equipes.length % TEAM_COLORS.length]!, membros: [] }],
    }))
  }

  function removeEquipe(i: number) {
    setForm(f => ({ ...f, equipes: f.equipes.filter((_, idx) => idx !== i) }))
  }

  function addTipo() {
    setForm(f => ({ ...f, tipos: [...f.tipos, { tipo_id: '', pontos_valor: '0' }] }))
  }

  function setTipo(i: number, patch: Partial<CompForm['tipos'][number]>) {
    setForm(f => {
      const tipos = [...f.tipos]
      tipos[i] = { ...tipos[i]!, ...patch }
      return { ...f, tipos }
    })
  }

  function removeTipo(i: number) {
    setForm(f => ({ ...f, tipos: f.tipos.filter((_, idx) => idx !== i) }))
  }

  function toggleItem(itemId: string) {
    setForm(f => ({
      ...f,
      itens: f.itens.includes(itemId) ? f.itens.filter(id => id !== itemId) : [...f.itens, itemId],
    }))
  }

  const jaAlocados = useMemo(() => {
    const s = new Set<string>()
    form.equipes.forEach(e => e.membros.forEach(m => s.add(m)))
    return s
  }, [form.equipes])

  const tiposJaSelecionados = new Set(form.tipos.map(t => t.tipo_id).filter(Boolean))

  return (
    <div className="space-y-5 py-2">
      {/* Básico */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>Nome *</Label>
          <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
            placeholder="Nome da competição" className="mt-1" />
        </div>
        <div className="sm:col-span-2">
          <Label>Descrição</Label>
          <Textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
            placeholder="Descrição opcional..." rows={2} className="mt-1 resize-none" />
        </div>
      </div>

      {/* Tipos de ação permitidos */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Tipos de ação permitidos *</Label>
          <button type="button" onClick={addTipo}
            className="text-xs text-primary hover:underline flex items-center gap-1">
            <Plus className="h-3 w-3" />Adicionar tipo
          </button>
        </div>
        <div className="space-y-2">
          {form.tipos.map((t, i) => {
            const disponiveis = tipos.filter(tp => tp.ativo && (!tiposJaSelecionados.has(tp.id) || tp.id === t.tipo_id))
            return (
              <div key={i} className="flex items-center gap-2">
                <Select value={t.tipo_id || 'none'} onValueChange={v => setTipo(i, { tipo_id: v === 'none' ? '' : v })}>
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue placeholder="Selecione o tipo..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecione...</SelectItem>
                    {disponiveis.map(tp => <SelectItem key={tp.id} value={tp.id}>{tp.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs text-muted-foreground">pts:</span>
                  <Input type="number" min="0" value={t.pontos_valor}
                    onChange={e => setTipo(i, { pontos_valor: e.target.value })}
                    className="h-8 text-xs w-20" />
                </div>
                {form.tipos.length > 1 && (
                  <button type="button" onClick={() => removeTipo(i)}
                    className="text-muted-foreground hover:text-red-400 shrink-0">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-1">Ações desses tipos alimentam o placar da competição.</p>
      </div>

      {/* Modo de progresso */}
      <div>
        <Label>O que conta como progresso?</Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {(['pontuacao', 'item'] as const).map(m => (
            <button key={m} type="button" onClick={() => setForm(f => ({ ...f, modo_progresso: m, itens: [] }))}
              className={cn('py-2.5 rounded-lg border text-sm font-medium transition-colors',
                form.modo_progresso === m ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'
              )}>
              {m === 'pontuacao' ? '★ Pontuação' : '📦 Quantidade de item'}
            </button>
          ))}
        </div>
        {form.modo_progresso === 'item' && (
          <div className="mt-3">
            <Label className="text-sm">Itens da competição *</Label>
            <p className="text-xs text-muted-foreground mt-0.5 mb-2">Selecione os itens do catálogo que contam como progresso.</p>
            {catalogItems.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhum item encontrado no catálogo.</p>
            ) : (
              <div className="max-h-40 overflow-y-auto rounded-md border border-border divide-y divide-border/30">
                {catalogItems.map(item => {
                  const sel = form.itens.includes(item.id)
                  return (
                    <button key={item.id} type="button" onClick={() => toggleItem(item.id)}
                      className={cn('w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors',
                        sel ? 'bg-primary/10' : 'hover:bg-white/[0.04]'
                      )}>
                      <div className={cn('h-3.5 w-3.5 rounded border shrink-0 flex items-center justify-center',
                        sel ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                      )}>
                        {sel && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                      </div>
                      <span className={cn(sel && 'text-primary')}>{item.nome}</span>
                    </button>
                  )
                })}
              </div>
            )}
            {form.itens.length > 0 && (
              <p className="text-xs text-primary mt-1">{form.itens.length} item(ns) selecionado(s)</p>
            )}
          </div>
        )}
      </div>

      {/* Tipo de encerramento */}
      <div>
        <Label>Como a competição encerra?</Label>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {([
            ['prazo', 'Por prazo', 'Termina em uma data/hora'],
            ['meta', 'Por meta', 'Termina quando atingir X'],
            ['prazo_ou_meta', 'Prazo ou meta', 'O que vier primeiro'],
          ] as const).map(([val, label, desc]) => (
            <button key={val} type="button" onClick={() => setForm(f => ({ ...f, tipo_encerramento: val }))}
              className={cn('py-2.5 px-3 rounded-lg border text-left transition-colors',
                form.tipo_encerramento === val ? 'border-primary bg-primary/10' : 'border-border hover:border-muted-foreground'
              )}>
              <p className={cn('text-xs font-semibold', form.tipo_encerramento === val ? 'text-primary' : 'text-foreground')}>{label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {form.tipo_encerramento !== 'meta' && (
            <div>
              <Label>Prazo *</Label>
              <input type="datetime-local" value={form.prazo} onChange={e => setForm(f => ({ ...f, prazo: e.target.value }))}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground" />
            </div>
          )}
          {form.tipo_encerramento !== 'prazo' && (
            <div>
              <Label>Meta ({form.modo_progresso === 'item' ? 'itens' : 'pontos'}) *</Label>
              <Input type="number" min="1" value={form.meta_valor}
                onChange={e => setForm(f => ({ ...f, meta_valor: e.target.value }))}
                placeholder="Ex: 100" className="mt-1" />
            </div>
          )}
        </div>
      </div>

      {/* Equipes */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Equipes ({form.equipes.length})</Label>
          <button type="button" onClick={addEquipe}
            className="text-xs text-primary hover:underline flex items-center gap-1">
            <Plus className="h-3 w-3" />Adicionar equipe
          </button>
        </div>
        <div className="space-y-3">
          {form.equipes.map((equipe, i) => {
            const disponiveis = membros.filter(m => !jaAlocados.has(m.id) || equipe.membros.includes(m.id))
            return (
              <div key={i} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1 shrink-0">
                    {TEAM_COLORS.map(cor => (
                      <button key={cor} type="button" onClick={() => setEquipe(i, { cor })}
                        className={cn('h-4 w-4 rounded-full transition-transform', equipe.cor === cor && 'ring-2 ring-offset-1 ring-offset-background scale-110')}
                        style={{ background: cor }} />
                    ))}
                  </div>
                  <Input value={equipe.nome} onChange={e => setEquipe(i, { nome: e.target.value })}
                    placeholder="Nome da equipe" className="h-7 text-xs flex-1" />
                  {form.equipes.length > 2 && (
                    <button type="button" onClick={() => removeEquipe(i)} className="text-muted-foreground hover:text-red-400">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <details>
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                    Membros ({equipe.membros.length})
                  </summary>
                  <div className="mt-2">
                    <MembroSelector membros={disponiveis} selected={equipe.membros}
                      onChange={ids => setEquipe(i, { membros: ids })} />
                  </div>
                </details>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

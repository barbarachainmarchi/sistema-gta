'use client'

import React, { useState, useMemo } from 'react'
import { Plus, Trash2, Loader2, Calendar, Users, ChevronDown, ChevronRight, Edit2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Acao, AcaoParticipante, AcaoTipo, Membro, AcaoForm, Competicao, CompEquipe, CompTipo, CompItem, CatalogItem } from './acao-shared'
import { emptyAcaoForm, fmtDatetime, toDateLocal, toTimeLocal, AcaoFormFields } from './acao-shared'

interface Props {
  acoes: Acao[]
  participantes: AcaoParticipante[]
  tipos: AcaoTipo[]
  membros: Membro[]
  competicoes: Competicao[]
  compEquipes: CompEquipe[]
  compTipos: CompTipo[]
  compItens: CompItem[]
  catalogItems: CatalogItem[]
  salvando: boolean
  podeEditar: boolean
  userFaccaoId?: string | null
  lancamentosAcao: Record<string, { id: string; valor: number }>
  onSaveAcao: (form: AcaoForm, escalacaoId?: string) => Promise<boolean>
  onEditAcao: (id: string, form: AcaoForm) => Promise<boolean>
  onDeleteAcao: (id: string) => Promise<boolean>
  onToggleContaPontuacao: (acao: Acao) => Promise<void>
}

export function TabRegistros({
  acoes, participantes, tipos, membros,
  competicoes, compEquipes, compTipos, compItens, catalogItems,
  salvando, podeEditar, userFaccaoId, lancamentosAcao,
  onSaveAcao, onEditAcao, onDeleteAcao, onToggleContaPontuacao,
}: Props) {
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<AcaoForm>(emptyAcaoForm)
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroFrom, setFiltroFrom] = useState('')
  const [filtroTo, setFiltroTo] = useState('')
  const [filtroBusca, setFiltroBusca] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const partsByAcao = useMemo(() => {
    const m: Record<string, AcaoParticipante[]> = {}
    for (const p of participantes) {
      if (!m[p.acao_id]) m[p.acao_id] = []
      m[p.acao_id]!.push(p)
    }
    return m
  }, [participantes])

  const acoesFiltradas = useMemo(() => {
    return acoes.filter(a => {
      if (filtroTipo !== 'todos' && a.tipo_id !== filtroTipo) return false
      if (filtroFrom && a.data_hora.slice(0, 10) < filtroFrom) return false
      if (filtroTo && a.data_hora.slice(0, 10) > filtroTo) return false
      if (filtroBusca) {
        const q = filtroBusca.toLowerCase()
        const parts = partsByAcao[a.id] ?? []
        if (
          !parts.some(p => p.membro_nome.toLowerCase().includes(q)) &&
          !(a.tipo_nome?.toLowerCase().includes(q)) &&
          !(a.observacoes?.toLowerCase().includes(q))
        ) return false
      }
      return true
    })
  }, [acoes, filtroTipo, filtroFrom, filtroTo, filtroBusca, partsByAcao])

  function toggleExpand(id: string) {
    setExpandedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  function abrirNovo() {
    setForm(emptyAcaoForm)
    setEditingId(null)
    setFormOpen(true)
  }

  function abrirEditar(acao: Acao) {
    const parts = partsByAcao[acao.id] ?? []
    const lanc = lancamentosAcao[acao.id]
    setForm({
      tipo_id: acao.tipo_id ?? '',
      data: toDateLocal(acao.data_hora),
      hora: toTimeLocal(acao.data_hora),
      participantes: parts.map(p => p.membro_id),
      para_caixa_faccao: acao.para_caixa_faccao,
      valor_financeiro: lanc ? String(lanc.valor) : '',
      tipo_dinheiro: acao.tipo_dinheiro ?? 'sujo',
      observacoes: acao.observacoes ?? '',
      conta_pontuacao: acao.conta_pontuacao,
      resultado: acao.resultado ?? '',
      competicao_id: acao.competicao_id ?? '',
      equipe_id: acao.equipe_id ?? '',
      quantidade_item: acao.quantidade_item != null ? String(acao.quantidade_item) : '',
      item_id: acao.item_id ?? '',
    })
    setEditingId(acao.id)
    setFormOpen(true)
  }

  function fecharForm() {
    setFormOpen(false)
    setEditingId(null)
    setForm(emptyAcaoForm)
  }

  async function handleSave() {
    const ok = editingId
      ? await onEditAcao(editingId, form)
      : await onSaveAcao(form)
    if (ok) fecharForm()
  }

  return (
    <div className="space-y-4">
      {/* Header + filters */}
      <div className="flex items-center gap-2 flex-wrap justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="h-8 text-xs w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {tipos.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <input type="date" value={filtroFrom} onChange={e => setFiltroFrom(e.target.value)}
            className="h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground" />
          <span className="text-xs text-muted-foreground">até</span>
          <input type="date" value={filtroTo} onChange={e => setFiltroTo(e.target.value)}
            className="h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground" />
          <Input placeholder="Buscar membro, tipo..." value={filtroBusca}
            onChange={e => setFiltroBusca(e.target.value)} className="h-8 text-xs w-44" />
        </div>
        {podeEditar && (
          <Button size="sm" className="gap-1.5" onClick={abrirNovo}>
            <Plus className="h-3.5 w-3.5" />Novo Registro
          </Button>
        )}
      </div>

      {/* List */}
      {acoesFiltradas.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <Calendar className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma ação registrada</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          {acoesFiltradas.map((acao, idx) => {
            const parts = partsByAcao[acao.id] ?? []
            const tipo = tipos.find(t => t.id === acao.tipo_id)
            const expanded = expandedIds.has(acao.id)
            const totalPontos = acao.conta_pontuacao ? parts.reduce((s, p) => s + p.pontos_atribuidos, 0) : 0

            return (
              <React.Fragment key={acao.id}>
                <div onClick={() => toggleExpand(acao.id)}
                  className={cn('flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors',
                    idx > 0 && 'border-t border-border/40'
                  )}>
                  <div className="shrink-0 text-muted-foreground/50">
                    {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{acao.tipo_nome ?? '—'}</span>
                      {acao.resultado === 'vencida' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-medium">✓ Vencida</span>
                      )}
                      {acao.resultado === 'perdida' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 font-medium">✗ Perdida</span>
                      )}
                      {acao.para_caixa_faccao && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                          Caixa facção{lancamentosAcao[acao.id] ? ` · R$ ${lancamentosAcao[acao.id].valor.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}` : ''}
                        </span>
                      )}
                      {tipo?.conta_pontuacao && (
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium',
                          acao.conta_pontuacao ? 'bg-yellow-500/15 text-yellow-400' : 'bg-muted text-muted-foreground'
                        )}>
                          {acao.conta_pontuacao ? `★ ${totalPontos} pts` : '★ sem pts'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      <span>{fmtDatetime(acao.data_hora)}</span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />{parts.length}
                      </span>
                      {acao.observacoes && <span className="truncate max-w-[200px]">{acao.observacoes}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    {podeEditar && tipo?.conta_pontuacao && (
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="text-muted-foreground">Pts</span>
                        <Switch checked={acao.conta_pontuacao} onCheckedChange={() => onToggleContaPontuacao(acao)}
                          className="scale-75" />
                      </div>
                    )}
                    {podeEditar && (
                      <>
                        <button onClick={() => abrirEditar(acao)}
                          className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06]">
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setConfirmDeleteId(acao.id)}
                          className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {expanded && parts.length > 0 && (
                  <div className="px-4 py-3 bg-muted/10 border-t border-border/40">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {parts.map(p => (
                        <div key={p.id} className="flex items-center justify-between text-xs bg-card rounded px-2 py-1.5 border border-border/40">
                          <span className="truncate">{p.membro_nome}</span>
                          {acao.conta_pontuacao && p.pontos_atribuidos > 0 && (
                            <span className="text-yellow-400 font-medium shrink-0 ml-2">+{p.pontos_atribuidos}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </React.Fragment>
            )
          })}
        </div>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={formOpen} onOpenChange={o => { if (!o && !salvando) fecharForm() }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Registro de Ação' : 'Novo Registro de Ação'}</DialogTitle>
          </DialogHeader>
          <AcaoFormFields
            form={form} setForm={setForm} tipos={tipos} membros={membros}
            competicoes={competicoes} compEquipes={compEquipes}
            compTipos={compTipos} compItens={compItens} catalogItems={catalogItems}
            userFaccaoId={userFaccaoId}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={fecharForm} disabled={salvando}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={salvando}>
              {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : editingId ? 'Salvar' : 'Registrar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!confirmDeleteId} onOpenChange={o => { if (!o) setConfirmDeleteId(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Excluir este registro?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">O registro e todos os pontos atribuídos serão removidos permanentemente.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmDeleteId(null)} disabled={salvando}>Cancelar</Button>
            <Button variant="destructive" size="sm" disabled={salvando}
              onClick={async () => { if (confirmDeleteId && await onDeleteAcao(confirmDeleteId)) setConfirmDeleteId(null) }}>
              {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Excluir'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

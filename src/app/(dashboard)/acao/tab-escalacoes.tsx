'use client'

import React, { useState, useMemo } from 'react'
import { Plus, Trash2, Loader2, Calendar, Users, ChevronDown, ChevronRight, Check, X, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Escalacao, EscalacaoParticipante, EscalacaoForm, AcaoForm, AcaoTipo, Membro, Acao } from './acao-shared'
import {
  emptyEscalacaoForm, emptyAcaoForm, fmtDatetime, toDatetimeLocal,
  ESCALACAO_STATUS_CFG, PART_STATUS_CFG, MembroSelector, AcaoFormFields,
} from './acao-shared'

interface Props {
  escalacoes: Escalacao[]
  escalacaoParticipantes: EscalacaoParticipante[]
  tipos: AcaoTipo[]
  membros: Membro[]
  acoes: Acao[]
  userId: string
  membroId: string | null
  salvando: boolean
  podeEditar: boolean
  onSaveEscalacao: (form: EscalacaoForm) => Promise<boolean>
  onDeleteEscalacao: (id: string) => Promise<boolean>
  onCandidatar: (escalacaoId: string) => Promise<void>
  onResponderConvocacao: (partId: string, status: 'confirmado' | 'recusado') => Promise<void>
  onCancelarEscalacao: (id: string) => Promise<void>
  onSaveAcaoFromEscalacao: (form: AcaoForm, escalacaoId: string) => Promise<boolean>
}

export function TabEscalacoes({
  escalacoes, escalacaoParticipantes, tipos, membros, salvando, podeEditar,
  userId, membroId,
  onSaveEscalacao, onDeleteEscalacao, onCandidatar, onResponderConvocacao,
  onCancelarEscalacao, onSaveAcaoFromEscalacao,
}: Props) {
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<EscalacaoForm>(emptyEscalacaoForm)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [convertendoId, setConvertendoId] = useState<string | null>(null)
  const [acaoForm, setAcaoForm] = useState<AcaoForm>(emptyAcaoForm)
  const [respondendo, setRespondendo] = useState<string | null>(null)

  const partsByEsc = useMemo(() => {
    const m: Record<string, EscalacaoParticipante[]> = {}
    for (const p of escalacaoParticipantes) {
      if (!m[p.escalacao_id]) m[p.escalacao_id] = []
      m[p.escalacao_id]!.push(p)
    }
    return m
  }, [escalacaoParticipantes])

  function toggleExpand(id: string) {
    setExpandedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  async function handleSave() {
    const ok = await onSaveEscalacao(form)
    if (ok) { setFormOpen(false); setForm(emptyEscalacaoForm) }
  }

  function abrirConverter(esc: Escalacao) {
    const tipo = tipos.find(t => t.id === esc.tipo_id)
    const parts = partsByEsc[esc.id] ?? []
    // Pré-selecionar confirmados + convocados (não recusados)
    const preSelected = parts
      .filter(p => p.status !== 'recusado')
      .map(p => p.membro_id)
    setAcaoForm({
      tipo_id: esc.tipo_id ?? '',
      data_hora: toDatetimeLocal(esc.data_hora_prevista),
      participantes: preSelected,
      para_caixa_faccao: false,
      observacoes: esc.observacoes ?? '',
      conta_pontuacao: tipo?.conta_pontuacao ?? false,
      competicao_id: '',
      equipe_id: '',
      quantidade_item: '',
    })
    setConvertendoId(esc.id)
  }

  async function handleConverter() {
    if (!convertendoId) return
    const ok = await onSaveAcaoFromEscalacao(acaoForm, convertendoId)
    if (ok) { setConvertendoId(null); setAcaoForm(emptyAcaoForm) }
  }

  async function handleResponder(partId: string, status: 'confirmado' | 'recusado') {
    setRespondendo(partId)
    await onResponderConvocacao(partId, status)
    setRespondendo(null)
  }

  // Filtros
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'pendente' | 'convertida' | 'cancelada'>('todos')
  const escalacoesVisiveis = useMemo(() =>
    filtroStatus === 'todos' ? escalacoes : escalacoes.filter(e => e.status === filtroStatus),
    [escalacoes, filtroStatus]
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 justify-between flex-wrap">
        <div className="flex gap-0.5">
          {(['todos', 'pendente', 'convertida', 'cancelada'] as const).map(s => (
            <button key={s} onClick={() => setFiltroStatus(s)}
              className={cn('px-3 py-1.5 text-xs rounded-md font-medium transition-colors',
                filtroStatus === s ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]'
              )}>
              {s === 'todos' ? 'Todas' : ESCALACAO_STATUS_CFG[s].label}
            </button>
          ))}
        </div>
        {podeEditar && (
          <Button size="sm" className="gap-1.5" onClick={() => { setForm(emptyEscalacaoForm); setFormOpen(true) }}>
            <Plus className="h-3.5 w-3.5" />Nova Escalação
          </Button>
        )}
      </div>

      {/* List */}
      {escalacoesVisiveis.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <Calendar className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma escalação encontrada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {escalacoesVisiveis.map(esc => {
            const parts = partsByEsc[esc.id] ?? []
            const expanded = expandedIds.has(esc.id)
            const statusCfg = ESCALACAO_STATUS_CFG[esc.status]
            const confirmados = parts.filter(p => p.status === 'confirmado').length
            const candidatos = parts.filter(p => p.status === 'candidato').length
            // Participação do usuário atual
            const minhaPart = membroId ? parts.find(p => p.membro_id === membroId) : null
            const podeCandidar = esc.modo === 'aberta' && esc.status === 'pendente' && !minhaPart && membroId

            return (
              <div key={esc.id} className="rounded-lg border border-border overflow-hidden">
                {/* Card header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <button onClick={() => toggleExpand(esc.id)} className="shrink-0 text-muted-foreground/50 hover:text-foreground transition-colors">
                    {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </button>
                  <div className="flex-1 min-w-0" onClick={() => toggleExpand(esc.id)} role="button">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{esc.tipo_nome ?? '—'}</span>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', statusCfg.cls)}>
                        {statusCfg.label}
                      </span>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded',
                        esc.modo === 'aberta' ? 'bg-purple-500/15 text-purple-400' : 'bg-blue-500/15 text-blue-400'
                      )}>
                        {esc.modo === 'aberta' ? 'Inscrição aberta' : 'Manual'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      <span>{fmtDatetime(esc.data_hora_prevista)}</span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {parts.length} {esc.modo === 'aberta' && candidatos > 0 ? `(${candidatos} candidato(s))` : ''}
                        {confirmados > 0 && <span className="text-emerald-400">· {confirmados} confirmado(s)</span>}
                      </span>
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {podeCandidar && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-purple-400 border-purple-500/30"
                        onClick={() => onCandidatar(esc.id)}>
                        <Plus className="h-3 w-3" />Candidatar
                      </Button>
                    )}
                    {minhaPart && minhaPart.status !== 'confirmado' && minhaPart.status !== 'recusado' && esc.status === 'pendente' && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="h-7 text-xs text-red-400 border-red-500/30 px-2"
                          disabled={respondendo === minhaPart.id}
                          onClick={() => handleResponder(minhaPart.id, 'recusado')}>
                          {respondendo === minhaPart.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                        </Button>
                        <Button size="sm" className="h-7 text-xs px-2 gap-1"
                          disabled={respondendo === minhaPart.id}
                          onClick={() => handleResponder(minhaPart.id, 'confirmado')}>
                          {respondendo === minhaPart.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          Confirmar
                        </Button>
                      </div>
                    )}
                    {minhaPart?.status === 'confirmado' && esc.status === 'pendente' && (
                      <span className="text-xs text-emerald-400 font-medium">✓ Confirmado</span>
                    )}
                    {minhaPart?.status === 'recusado' && (
                      <span className="text-xs text-muted-foreground">Recusado</span>
                    )}
                    {podeEditar && esc.status === 'pendente' && (
                      <>
                        <Button size="sm" className="h-7 text-xs gap-1" onClick={() => abrirConverter(esc)}>
                          <ArrowRight className="h-3 w-3" />Converter
                        </Button>
                        <button onClick={() => onCancelarEscalacao(esc.id)}
                          className="h-7 px-2 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-white/[0.06]">
                          Cancelar
                        </button>
                      </>
                    )}
                    {podeEditar && (
                      <button onClick={() => setConfirmDeleteId(esc.id)}
                        className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded: participants */}
                {expanded && (
                  <div className="border-t border-border/40 px-4 py-3 bg-muted/10 space-y-1.5">
                    {esc.observacoes && (
                      <p className="text-xs text-muted-foreground italic mb-2">{esc.observacoes}</p>
                    )}
                    {parts.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhum participante ainda.</p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {parts.map(p => {
                          const cfg = PART_STATUS_CFG[p.status]
                          const isMe = p.membro_id === membroId
                          return (
                            <div key={p.id} className={cn('flex items-center justify-between text-xs bg-card rounded px-2 py-1.5 border border-border/40',
                              isMe && 'border-primary/30'
                            )}>
                              <span className={cn('truncate', isMe && 'font-medium')}>{p.membro_nome}</span>
                              <span className={cn('text-[10px] px-1 py-0.5 rounded shrink-0 ml-2', cfg.cls)}>{cfg.label}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Nova Escalação dialog */}
      <Dialog open={formOpen} onOpenChange={o => { if (!o && !salvando) { setFormOpen(false); setForm(emptyEscalacaoForm) } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Escalação</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Tipo de ação *</Label>
              <Select value={form.tipo_id || 'none'} onValueChange={v => setForm(f => ({ ...f, tipo_id: v === 'none' ? '' : v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione o tipo..." /></SelectTrigger>
                <SelectContent>
                  {tipos.filter(t => t.ativo).map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data e hora previstas *</Label>
              <input type="datetime-local" value={form.data_hora_prevista}
                onChange={e => setForm(f => ({ ...f, data_hora_prevista: e.target.value }))}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm text-foreground" />
            </div>
            <div>
              <Label>Modo de participação</Label>
              <div className="mt-2 flex gap-2">
                {(['manual', 'aberta'] as const).map(m => (
                  <button key={m} type="button" onClick={() => setForm(f => ({ ...f, modo: m, participantes: [] }))}
                    className={cn('flex-1 py-2 rounded-lg border text-sm font-medium transition-colors',
                      form.modo === m ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground'
                    )}>
                    {m === 'manual' ? 'Seleção manual' : 'Inscrição aberta'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {form.modo === 'manual' ? 'Admin define quem será convocado.' : 'Membros se candidatam por conta própria.'}
              </p>
            </div>
            {form.modo === 'manual' && (
              <div>
                <Label>Convocar membros</Label>
                <div className="mt-1">
                  <MembroSelector membros={membros} selected={form.participantes}
                    onChange={ids => setForm(f => ({ ...f, participantes: ids }))} />
                </div>
              </div>
            )}
            <div>
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                placeholder="Observações opcionais..." rows={2} className="mt-1 resize-none" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => { setFormOpen(false); setForm(emptyEscalacaoForm) }} disabled={salvando}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={salvando}>
              {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Criar Escalação'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Converter em Ação dialog */}
      <Dialog open={!!convertendoId} onOpenChange={o => { if (!o && !salvando) { setConvertendoId(null); setAcaoForm(emptyAcaoForm) } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Converter em Registro de Ação</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground -mt-1">Revise e ajuste os dados antes de registrar.</p>
          <AcaoFormFields form={acaoForm} setForm={setAcaoForm} tipos={tipos} membros={membros} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => { setConvertendoId(null); setAcaoForm(emptyAcaoForm) }} disabled={salvando}>Cancelar</Button>
            <Button size="sm" onClick={handleConverter} disabled={salvando}>
              {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Registrar Ação'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!confirmDeleteId} onOpenChange={o => { if (!o) setConfirmDeleteId(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Excluir escalação?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">A escalação e todos os registros de participação serão removidos.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmDeleteId(null)} disabled={salvando}>Cancelar</Button>
            <Button variant="destructive" size="sm" disabled={salvando}
              onClick={async () => { if (confirmDeleteId && await onDeleteEscalacao(confirmDeleteId)) setConfirmDeleteId(null) }}>
              {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Excluir'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

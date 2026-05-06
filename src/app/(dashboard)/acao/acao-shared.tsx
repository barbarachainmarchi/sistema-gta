'use client'

import React, { useState } from 'react'
import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

// ── Types ──────────────────────────────────────────────────────────────────────

export type AcaoTipo = {
  id: string; nome: string
  min_participantes: number; max_participantes: number | null
  descricao: string | null; regras: string | null
  conta_pontuacao: boolean; pontos_valor: number
  ativo: boolean; created_at: string
}

export type Acao = {
  id: string; tipo_id: string | null; tipo_nome: string | null
  data_hora: string; observacoes: string | null
  para_caixa_faccao: boolean; conta_pontuacao: boolean
  tipo_dinheiro: 'sujo' | 'limpo'
  competicao_id: string | null; equipe_id: string | null
  quantidade_item: number | null; item_id: string | null
  created_by: string | null; created_by_nome: string | null; created_at: string
}

export type AcaoParticipante = {
  id: string; acao_id: string; membro_id: string; membro_nome: string
  pontos_atribuidos: number
}

export type Escalacao = {
  id: string; tipo_id: string | null; tipo_nome: string | null
  data_hora_prevista: string; modo: 'aberta' | 'manual'
  observacoes: string | null; status: 'pendente' | 'convertida' | 'cancelada'
  acao_id: string | null; created_by: string | null; created_by_nome: string | null; created_at: string
}

export type EscalacaoParticipante = {
  id: string; escalacao_id: string; membro_id: string; membro_nome: string
  status: 'convocado' | 'confirmado' | 'recusado' | 'candidato' | 'reserva'
}

export type Membro = {
  id: string; nome: string; vulgo: string | null; status: string; faccao_id: string | null
}

export type Competicao = {
  id: string; nome: string; descricao: string | null
  tipo_acao_id: string | null; tipo_acao_nome: string | null
  modo_progresso: 'pontuacao' | 'item'
  item_nome: string | null
  tipo_encerramento: 'prazo' | 'meta' | 'prazo_ou_meta'
  prazo: string | null
  meta_valor: number | null
  status: 'ativa' | 'encerrada' | 'cancelada'
  vencedor_equipe_id: string | null; vencedor_equipe_nome: string | null
  created_by: string | null; created_by_nome: string | null; created_at: string
}

export type CompEquipe = {
  id: string; competicao_id: string; nome: string; cor: string
}

export type CompEquipeMembro = {
  id: string; equipe_id: string; membro_id: string; membro_nome: string
}

export type CompTipo = {
  id: string; competicao_id: string; tipo_id: string; pontos_valor: number
}

export type CompItem = {
  id: string; competicao_id: string; item_id: string
}

export type CatalogItem = {
  id: string; nome: string
}

// ── Form types ─────────────────────────────────────────────────────────────────

export type TipoForm = {
  nome: string; min_participantes: string; max_participantes: string
  descricao: string; regras: string
  conta_pontuacao: boolean; pontos_valor: string; ativo: boolean
}

export const emptyTipoForm: TipoForm = {
  nome: '', min_participantes: '1', max_participantes: '',
  descricao: '', regras: '', conta_pontuacao: false, pontos_valor: '0', ativo: true,
}

export type AcaoForm = {
  tipo_id: string; data_hora: string; participantes: string[]
  para_caixa_faccao: boolean; valor_financeiro: string; tipo_dinheiro: 'sujo' | 'limpo'
  observacoes: string; conta_pontuacao: boolean
  competicao_id: string; equipe_id: string; quantidade_item: string; item_id: string
}

export const emptyAcaoForm: AcaoForm = {
  tipo_id: '', data_hora: '', participantes: [],
  para_caixa_faccao: false, valor_financeiro: '', tipo_dinheiro: 'sujo',
  observacoes: '', conta_pontuacao: false,
  competicao_id: '', equipe_id: '', quantidade_item: '', item_id: '',
}

export type EscalacaoForm = {
  tipo_id: string; data_hora_prevista: string; modo: 'manual' | 'aberta'
  participantes: string[]; reservas: string[]; observacoes: string
}

export const emptyEscalacaoForm: EscalacaoForm = {
  tipo_id: '', data_hora_prevista: '', modo: 'manual', participantes: [], reservas: [], observacoes: '',
}

export type CompForm = {
  nome: string; descricao: string
  tipos: { tipo_id: string; pontos_valor: string }[]
  modo_progresso: 'pontuacao' | 'item'
  itens: string[]
  tipo_encerramento: 'prazo' | 'meta' | 'prazo_ou_meta'
  prazo: string
  meta_valor: string
  equipes: { nome: string; cor: string; membros: string[] }[]
}

export const TEAM_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

export const emptyCompForm: CompForm = {
  nome: '', descricao: '',
  tipos: [{ tipo_id: '', pontos_valor: '0' }],
  modo_progresso: 'pontuacao',
  itens: [],
  tipo_encerramento: 'prazo',
  prazo: '',
  meta_valor: '',
  equipes: [
    { nome: 'Equipe A', cor: TEAM_COLORS[0]!, membros: [] },
    { nome: 'Equipe B', cor: TEAM_COLORS[1]!, membros: [] },
  ],
}

// ── Status configs ─────────────────────────────────────────────────────────────

export const ESCALACAO_STATUS_CFG = {
  pendente:   { label: 'Pendente',   cls: 'bg-yellow-500/15 text-yellow-400' },
  convertida: { label: 'Convertida', cls: 'bg-emerald-500/15 text-emerald-400' },
  cancelada:  { label: 'Cancelada',  cls: 'bg-muted text-muted-foreground' },
} as const

export const PART_STATUS_CFG = {
  convocado:  { label: 'Convocado',  cls: 'bg-blue-500/15 text-blue-400' },
  confirmado: { label: 'Confirmado', cls: 'bg-emerald-500/15 text-emerald-400' },
  recusado:   { label: 'Recusado',   cls: 'bg-red-500/15 text-red-400' },
  candidato:  { label: 'Candidato',  cls: 'bg-purple-500/15 text-purple-400' },
  reserva:    { label: 'Reserva',    cls: 'bg-orange-500/15 text-orange-400' },
} as const

// ── Helpers ───────────────────────────────────────────────────────────────────

export function fmtDatetime(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function toDatetimeLocal(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function calcTeamProgress(
  comp: Competicao,
  equipeId: string,
  acoes: Acao[],
  participantes: AcaoParticipante[],
): number {
  const compAcoes = acoes.filter(a => a.competicao_id === comp.id && a.equipe_id === equipeId)
  if (comp.modo_progresso === 'item') {
    return compAcoes.reduce((s, a) => s + (a.quantidade_item ?? 0), 0)
  }
  const ids = new Set(compAcoes.filter(a => a.conta_pontuacao).map(a => a.id))
  return participantes.filter(p => ids.has(p.acao_id)).reduce((s, p) => s + p.pontos_atribuidos, 0)
}

export function getCompLabel(comp: Competicao, nomesItens?: string[]): string {
  const parts: string[] = []
  if (comp.tipo_encerramento !== 'meta') {
    parts.push(`Prazo: ${fmtDatetime(comp.prazo)}`)
  }
  if (comp.tipo_encerramento !== 'prazo') {
    const unidade = comp.modo_progresso === 'item'
      ? (nomesItens?.join(', ') || comp.item_nome || 'itens')
      : 'pontos'
    parts.push(`Meta: ${comp.meta_valor} ${unidade}`)
  }
  return parts.join(' · ')
}

// ── MembroSelector ─────────────────────────────────────────────────────────────

interface MembroSelectorProps {
  membros: Membro[]
  selected: string[]
  onChange: (ids: string[]) => void
  faccaoId?: string | null
}

export function MembroSelector({ membros, selected, onChange, faccaoId }: MembroSelectorProps) {
  const [busca, setBusca] = useState('')

  const filtrados = membros.filter(m =>
    !busca ||
    m.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (m.vulgo?.toLowerCase().includes(busca.toLowerCase()) ?? false)
  )

  const dafaccao = faccaoId ? filtrados.filter(m => m.faccao_id === faccaoId) : filtrados
  const outros   = faccaoId ? filtrados.filter(m => m.faccao_id !== faccaoId) : []

  function renderMembro(m: Membro) {
    const sel = selected.includes(m.id)
    return (
      <button key={m.id} type="button"
        onClick={() => onChange(sel ? selected.filter(id => id !== m.id) : [...selected, m.id])}
        className={cn('w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors',
          sel ? 'bg-primary/10' : 'hover:bg-white/[0.04]'
        )}>
        <div className={cn('h-3.5 w-3.5 rounded border shrink-0 flex items-center justify-center',
          sel ? 'bg-primary border-primary' : 'border-muted-foreground/40'
        )}>
          {sel && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
        </div>
        <span className={cn('flex-1 truncate', sel && 'text-primary')}>{m.nome}</span>
        {m.vulgo && <span className="text-muted-foreground shrink-0 text-[11px]">"{m.vulgo}"</span>}
      </button>
    )
  }

  return (
    <div className="space-y-2">
      {/* Chips dos selecionados */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map(id => {
            const m = membros.find(mb => mb.id === id)
            return (
              <span key={id} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">
                {m?.nome ?? id}
                <button type="button" onClick={() => onChange(selected.filter(s => s !== id))}
                  className="text-primary/60 hover:text-primary ml-0.5 shrink-0">
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            )
          })}
          <span className="inline-flex items-center text-[11px] text-muted-foreground px-1">
            {selected.length} membro{selected.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      <Input placeholder="Buscar membro..." value={busca} onChange={e => setBusca(e.target.value)} className="h-8 text-xs" />
      <div className="max-h-40 overflow-y-auto rounded-md border border-border divide-y divide-border/30">
        {filtrados.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Nenhum membro encontrado</p>
        ) : faccaoId ? (
          <>
            {dafaccao.length > 0 && (
              <>
                <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider bg-muted/20 sticky top-0">
                  Facção ({dafaccao.length})
                </div>
                {dafaccao.map(renderMembro)}
              </>
            )}
            {outros.length > 0 && (
              <>
                <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider bg-muted/20 sticky top-0">
                  Outros ({outros.length})
                </div>
                {outros.map(renderMembro)}
              </>
            )}
          </>
        ) : (
          filtrados.map(renderMembro)
        )}
      </div>
    </div>
  )
}

// ── AcaoFormFields ─────────────────────────────────────────────────────────────

interface AcaoFormFieldsProps {
  form: AcaoForm
  setForm: React.Dispatch<React.SetStateAction<AcaoForm>>
  tipos: AcaoTipo[]
  membros: Membro[]
  competicoes?: Competicao[]
  compEquipes?: CompEquipe[]
  compTipos?: CompTipo[]
  compItens?: CompItem[]
  catalogItems?: CatalogItem[]
  userFaccaoId?: string | null
}

export function AcaoFormFields({
  form, setForm, tipos, membros,
  competicoes = [], compEquipes = [], compTipos = [], compItens = [], catalogItems = [],
  userFaccaoId,
}: AcaoFormFieldsProps) {
  const tipoAtual = tipos.find(t => t.id === form.tipo_id)

  function handleTipoChange(tipoId: string) {
    setForm(f => ({ ...f, tipo_id: tipoId, competicao_id: '', equipe_id: '', item_id: '' }))
  }

  // Competitions active that include this action type (multi-tipo or legacy single-tipo)
  const competicoesAtivas = competicoes.filter(c =>
    c.status === 'ativa' && (
      c.tipo_acao_id === form.tipo_id ||
      compTipos.some(ct => ct.competicao_id === c.id && ct.tipo_id === form.tipo_id)
    )
  )
  const compAtual = competicoesAtivas.find(c => c.id === form.competicao_id)
  const equipesDaComp = compEquipes.filter(e => e.competicao_id === form.competicao_id)

  // Items allowed for the selected competition
  const itensDaComp = compItens.filter(ci => ci.competicao_id === form.competicao_id)
  const itensDaCompComNome = itensDaComp.map(ci => ({
    ...ci,
    nome: catalogItems.find(i => i.id === ci.item_id)?.nome ?? '?',
  }))

  return (
    <div className="space-y-4 py-2">
      <div>
        <Label>Tipo de ação *</Label>
        <Select value={form.tipo_id || 'none'} onValueChange={v => handleTipoChange(v === 'none' ? '' : v)}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione o tipo..." /></SelectTrigger>
          <SelectContent>
            {tipos.filter(t => t.ativo).map(t => (
              <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {tipoAtual?.descricao && <p className="text-xs text-muted-foreground mt-1">{tipoAtual.descricao}</p>}
      </div>
      <div>
        <Label>Data e hora *</Label>
        <input type="datetime-local" value={form.data_hora}
          onChange={e => setForm(f => ({ ...f, data_hora: e.target.value }))}
          className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm text-foreground" />
      </div>
      <div>
        <Label>Participantes *</Label>
        <div className="mt-1">
          <MembroSelector membros={membros} selected={form.participantes}
            onChange={ids => setForm(f => ({ ...f, participantes: ids }))}
            faccaoId={userFaccaoId} />
        </div>
      </div>

      {/* Competição (aparece apenas se há competições ativas para o tipo) */}
      {form.tipo_id && competicoesAtivas.length > 0 && (
        <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-3 space-y-3">
          <p className="text-xs font-semibold text-primary">Vincular à competição</p>
          <Select value={form.competicao_id || 'none'} onValueChange={v => setForm(f => ({ ...f, competicao_id: v === 'none' ? '' : v, equipe_id: '', item_id: '' }))}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sem competição" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem competição</SelectItem>
              {competicoesAtivas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          {form.competicao_id && (
            <Select value={form.equipe_id || 'none'} onValueChange={v => setForm(f => ({ ...f, equipe_id: v === 'none' ? '' : v }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione a equipe..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Selecione a equipe...</SelectItem>
                {equipesDaComp.map(e => (
                  <SelectItem key={e.id} value={e.id}>
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full inline-block" style={{ background: e.cor }} />
                      {e.nome}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {compAtual?.modo_progresso === 'item' && form.equipe_id && (
            <div className="space-y-2">
              {itensDaCompComNome.length > 0 && (
                <div>
                  <Label className="text-xs">Item *</Label>
                  <Select value={form.item_id || 'none'} onValueChange={v => setForm(f => ({ ...f, item_id: v === 'none' ? '' : v }))}>
                    <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Selecione o item..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Selecione o item...</SelectItem>
                      {itensDaCompComNome.map(i => <SelectItem key={i.item_id} value={i.item_id}>{i.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label className="text-xs">Quantidade *</Label>
                <Input type="number" min="1" value={form.quantidade_item}
                  onChange={e => setForm(f => ({ ...f, quantidade_item: e.target.value }))}
                  className="mt-1 h-8 text-xs w-32" />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-lg border border-border p-3 gap-2">
          <div>
            <p className="text-sm font-medium">Caixa da facção</p>
            <p className="text-xs text-muted-foreground">Registrar entrada no financeiro</p>
          </div>
          <Switch checked={form.para_caixa_faccao} onCheckedChange={v => setForm(f => ({ ...f, para_caixa_faccao: v, valor_financeiro: '' }))} />
        </div>
        {form.para_caixa_faccao && (
          <>
            <div>
              <Label>Valor doado para o caixa (R$) *</Label>
              <Input type="number" min="1" step="1" value={form.valor_financeiro}
                onChange={e => setForm(f => ({ ...f, valor_financeiro: e.target.value }))}
                placeholder="Ex: 5000" className="mt-1 w-40" />
            </div>
            <div>
              <Label>Tipo de dinheiro</Label>
              <div className="flex gap-2 mt-1">
                {(['sujo', 'limpo'] as const).map(t => (
                  <button key={t} type="button" onClick={() => setForm(f => ({ ...f, tipo_dinheiro: t }))}
                    className={cn('flex-1 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                      form.tipo_dinheiro === t
                        ? t === 'sujo' ? 'border-orange-500/50 bg-orange-500/15 text-orange-400' : 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    )}>
                    {t === 'sujo' ? 'Sujo' : 'Limpo'}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      <div>
        <Label>Observações</Label>
        <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
          placeholder="Observações opcionais..." rows={2} className="mt-1 resize-none" />
      </div>
    </div>
  )
}

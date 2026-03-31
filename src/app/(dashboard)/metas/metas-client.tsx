'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus, Loader2, X } from 'lucide-react'
import { VisaoGeralAba } from './visao-geral-aba'
import { MembrosAba }   from './membros-aba'
import { HistoricoAba } from './historico-aba'

// ── Tipos exportados ──────────────────────────────────────────────────────────

export type Membro = { id: string; nome: string; vulgo: string | null }

export type ItemTemplate = {
  id: string; meta_id: string
  item_nome: string; quantidade: number
  tipo_dinheiro: 'limpo' | 'sujo' | null; ordem: number
}

export type MembroMetaItem = {
  id: string; membro_meta_id: string
  item_nome: string
  quantidade_meta: number; quantidade_entregue: number
  tipo_dinheiro: 'limpo' | 'sujo' | null; ordem: number
}

export type MembroMeta = {
  id: string; meta_id: string; membro_id: string
  status: 'em_andamento' | 'completo' | 'incompleto' | 'justificado'
  status_forcado: boolean; observacao: string | null
  metas_membros_itens: MembroMetaItem[]
}

export type MetaSemanal = {
  id: string; titulo: string
  semana_inicio: string; semana_fim: string
  status: 'ativa' | 'encerrada' | 'rascunho'
  created_at: string
  metas_itens_template: ItemTemplate[]
  metas_membros: MembroMeta[]
}

export type MetaHistorico = {
  id: string; titulo: string
  semana_inicio: string; semana_fim: string
  status: string; created_at: string
  metas_membros: { id: string; status: string }[]
}

export type ContaMembro = { id: string; membro_id: string; saldo_sujo: number; saldo_limpo: number }

export type SbClient = () => ReturnType<typeof createClient>

// ── Helpers ───────────────────────────────────────────────────────────────────

export function progressoMembro(mm: MembroMeta): number {
  const itens = mm.metas_membros_itens
  if (!itens.length) return 0
  const total = itens.reduce((s, it) => s + Math.min(it.quantidade_entregue / (it.quantidade_meta || 1), 1), 0)
  return Math.round((total / itens.length) * 100)
}

export function fmtSemana(inicio: string, fim: string) {
  const fmt = (d: string) => {
    const [, m, dia] = d.split('-')
    return `${dia}/${m}`
  }
  return `${fmt(inicio)} – ${fmt(fim)}`
}

function getMondayOfWeek(d = new Date()): string {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(d)
  mon.setDate(d.getDate() + diff)
  return mon.toISOString().split('T')[0]
}

function getSundayOfWeek(d = new Date()): string {
  const mon = new Date(getMondayOfWeek(d))
  mon.setDate(mon.getDate() + 6)
  return mon.toISOString().split('T')[0]
}

type FormItem = { item_nome: string; quantidade: string; tipo_dinheiro: 'limpo' | 'sujo' | '' }
const ITEM_VAZIO: FormItem = { item_nome: '', quantidade: '', tipo_dinheiro: '' }

// ── Componente principal ──────────────────────────────────────────────────────

type Aba = 'visao' | 'membros' | 'historico'

interface Props {
  userId: string; userNome: string | null
  membros: Membro[]
  metaAtual: MetaSemanal | null
  metasHistorico: MetaHistorico[]
  contas: ContaMembro[]
  podeEditar: boolean; podeLancar: boolean
  catalogoItens: { id: string; nome: string }[]
  ultimaMetaItens: { item_nome: string; quantidade: number; tipo_dinheiro: 'limpo' | 'sujo' | null }[]
}

export function MetasClient({ userId, userNome, membros, metaAtual: metaAtualInicial, metasHistorico: histInicial, contas, podeEditar, podeLancar, catalogoItens, ultimaMetaItens }: Props) {
  const sb: SbClient = useCallback(() => createClient(), [])

  const [aba, setAba]             = useState<Aba>('visao')
  const [metaAtual, setMetaAtual] = useState<MetaSemanal | null>(metaAtualInicial)
  const [historico, setHistorico] = useState<MetaHistorico[]>(histInicial)

  // ── Modal nova meta ────────────────────────────────────────────────────────
  const [modalNova, setModalNova]     = useState(false)
  const [salvando, setSalvando]       = useState(false)
  const [aplicando, setAplicando]     = useState(false)

  // ── Modal selecionar membros para aplicar ──────────────────────────────────
  const [modalAplicar, setModalAplicar]         = useState(false)
  const [membrosParaAplicar, setMembrosParaAplicar] = useState<Set<string>>(new Set())
  const [titulo, setTitulo]           = useState('')
  const [dataInicio, setDataInicio]   = useState(getMondayOfWeek)
  const [dataFim, setDataFim]         = useState(getSundayOfWeek)
  const [itensMeta, setItensMeta]     = useState<FormItem[]>([{ ...ITEM_VAZIO }])

  function addItem() { setItensMeta(prev => [...prev, { ...ITEM_VAZIO }]) }
  function removeItem(i: number) { setItensMeta(prev => prev.filter((_, j) => j !== i)) }
  function setItem(i: number, patch: Partial<FormItem>) {
    setItensMeta(prev => prev.map((it, j) => j === i ? { ...it, ...patch } : it))
  }
  function adicionarSugerido(nome: string) {
    const td: 'limpo' | 'sujo' | '' = nome === 'Dinheiro Limpo' ? 'limpo' : nome === 'Dinheiro Sujo' ? 'sujo' : ''
    const item_nome = (nome === 'Dinheiro Limpo' || nome === 'Dinheiro Sujo') ? 'Dinheiro' : nome
    setItensMeta(prev => [...prev.filter(it => it.item_nome !== ''), { item_nome, quantidade: '', tipo_dinheiro: td }])
  }

  function adicionarHistorico(it: { item_nome: string; quantidade: number; tipo_dinheiro: 'limpo' | 'sujo' | null }) {
    setItensMeta(prev => {
      const semVazios = prev.filter(x => x.item_nome !== '')
      const jaExiste = semVazios.find(x => x.item_nome === it.item_nome && (x.tipo_dinheiro || '') === (it.tipo_dinheiro || ''))
      if (jaExiste) return prev
      return [...semVazios, { item_nome: it.item_nome, quantidade: String(it.quantidade), tipo_dinheiro: it.tipo_dinheiro ?? '' }]
    })
  }

  function abrirNovaMeta() {
    setTitulo('')
    setDataInicio(getMondayOfWeek())
    setDataFim(getSundayOfWeek())
    setItensMeta([{ ...ITEM_VAZIO }])
    setModalNova(true)
  }

  async function handleCriarMeta() {
    const itensValidos = itensMeta.filter(it => it.item_nome.trim() && Number(it.quantidade) > 0)
    if (!dataInicio || !dataFim) { toast.error('Datas obrigatórias'); return }
    if (!itensValidos.length)    { toast.error('Adicione pelo menos um item'); return }

    setSalvando(true)
    try {
      const tituloFinal = titulo.trim() || `Semana ${fmtSemana(dataInicio, dataFim)}`

      // 1. Inserir a meta
      const { data: metaRow, error: errMeta } = await sb().from('metas_semanais').insert({
        titulo: tituloFinal, semana_inicio: dataInicio, semana_fim: dataFim,
        status: 'ativa', created_by: userId,
      }).select('id').single()
      if (errMeta) { toast.error(errMeta.message); return }

      // 2. Inserir itens do template
      const rows = itensValidos.map((it, i) => ({
        meta_id: metaRow.id, item_nome: it.item_nome.trim(),
        quantidade: Number(it.quantidade),
        tipo_dinheiro: it.tipo_dinheiro || null, ordem: i,
      }))
      const { error: errIt } = await sb().from('metas_itens_template').insert(rows)
      if (errIt) { toast.error(errIt.message); return }

      // 3. Buscar meta completa com dados nested reais
      const { data: metaCompleta, error: errFetch } = await sb()
        .from('metas_semanais')
        .select('*, metas_itens_template(*), metas_membros(*, metas_membros_itens(*))')
        .eq('id', metaRow.id)
        .single()
      if (errFetch) { toast.error(errFetch.message); return }

      setMetaAtual(metaCompleta as MetaSemanal)
      setModalNova(false)
      toast.success('Meta criada!')
    } finally { setSalvando(false) }
  }

  function abrirModalAplicar() {
    if (!metaAtual) return
    const membrosExistentes = new Set(metaAtual.metas_membros.map(m => m.membro_id))
    const disponiveis = membros.filter(m => !membrosExistentes.has(m.id))
    if (!disponiveis.length) { toast.info('Todos os membros já têm meta'); return }
    setMembrosParaAplicar(new Set(disponiveis.map(m => m.id)))
    setModalAplicar(true)
  }

  async function aplicarParaSelecionados() {
    if (!metaAtual || !membrosParaAplicar.size) return
    const membrosExistentes = new Set(metaAtual.metas_membros.map(m => m.membro_id))
    const novosMembros = membros.filter(m => membrosParaAplicar.has(m.id) && !membrosExistentes.has(m.id))
    if (!novosMembros.length) { toast.info('Nenhum membro novo selecionado'); return }

    setModalAplicar(false)
    setAplicando(true)
    try {
      const novosMembrosMeta: MembroMeta[] = []
      for (const membro of novosMembros) {
        const { data: mm, error: errMm } = await sb().from('metas_membros').insert({
          meta_id: metaAtual.id, membro_id: membro.id,
          status: 'em_andamento', status_forcado: false,
        }).select('*').single()
        if (errMm) continue

        const itensRows = metaAtual.metas_itens_template.map((it, i) => ({
          membro_meta_id: mm.id, item_nome: it.item_nome,
          quantidade_meta: it.quantidade, quantidade_entregue: 0,
          tipo_dinheiro: it.tipo_dinheiro, ordem: i,
        }))
        const { data: itensData } = await sb().from('metas_membros_itens').insert(itensRows).select('*')
        novosMembrosMeta.push({ ...mm, metas_membros_itens: (itensData ?? []) as MembroMetaItem[] } as MembroMeta)
      }

      setMetaAtual(prev => prev ? { ...prev, metas_membros: [...prev.metas_membros, ...novosMembrosMeta] } : prev)
      toast.success(`${novosMembrosMeta.length} membro(s) adicionado(s) à meta`)
    } finally { setAplicando(false) }
  }

  async function handleEncerrarMeta() {
    if (!metaAtual) return
    const { error } = await sb().from('metas_semanais').update({ status: 'encerrada' }).eq('id', metaAtual.id)
    if (error) { toast.error(error.message); return }
    const hist: MetaHistorico = {
      id: metaAtual.id, titulo: metaAtual.titulo,
      semana_inicio: metaAtual.semana_inicio, semana_fim: metaAtual.semana_fim,
      status: 'encerrada', created_at: metaAtual.created_at,
      metas_membros: metaAtual.metas_membros.map(m => ({ id: m.id, status: m.status })),
    }
    setHistorico(prev => [hist, ...prev])
    setMetaAtual(null)
    toast.success('Meta encerrada')
  }

  const ABAS: [Aba, string][] = [['visao', 'Visão Geral'], ['membros', 'Membros'], ['historico', 'Histórico']]

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* ── Subheader ── */}
      <div className="border-b border-border bg-card px-6 py-3 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-1">
          {ABAS.map(([a, label]) => (
            <button key={a} onClick={() => setAba(a)}
              className={cn('px-3 py-1.5 text-xs rounded-md transition-colors',
                aba === a ? 'bg-primary/15 text-foreground font-medium' : 'text-muted-foreground hover:text-foreground')}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {metaAtual && (
            <>
              <span className="text-xs text-muted-foreground">{metaAtual.titulo} · {fmtSemana(metaAtual.semana_inicio, metaAtual.semana_fim)}</span>
              {podeEditar && (
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={abrirModalAplicar} disabled={aplicando}>
                  {aplicando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  Aplicar a todos
                </Button>
              )}
              {podeEditar && (
                <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={handleEncerrarMeta}>
                  Encerrar semana
                </Button>
              )}
            </>
          )}
          {!metaAtual && podeEditar && (
            <Button size="sm" className="h-7 text-xs gap-1" onClick={abrirNovaMeta}>
              <Plus className="h-3 w-3" /> Nova Meta
            </Button>
          )}
        </div>
      </div>

      {/* ── Conteúdo ── */}
      <div className="flex-1 overflow-hidden">
        {aba === 'visao'     && <VisaoGeralAba metaAtual={metaAtual} membros={membros} contas={contas} sb={sb} userId={userId} userNome={userNome} setMetaAtual={setMetaAtual} podeEditar={podeEditar} podeLancar={podeLancar} onAbrirNovaMeta={abrirNovaMeta} catalogoItens={catalogoItens} />}
        {aba === 'membros'   && <MembrosAba   metaAtual={metaAtual} membros={membros} contas={contas} sb={sb} userId={userId} userNome={userNome} setMetaAtual={setMetaAtual} podeEditar={podeEditar} podeLancar={podeLancar} catalogoItens={catalogoItens} />}
        {aba === 'historico' && <HistoricoAba historico={historico} membros={membros} sb={sb} setHistorico={setHistorico} setMetaAtual={setMetaAtual} podeEditar={podeEditar} />}
      </div>

      {/* ── Modal Nova Meta ── */}
      <Dialog open={modalNova} onOpenChange={o => { if (!salvando) setModalNova(o) }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Nova Meta Semanal</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Título */}
            <div className="space-y-1.5">
              <Label className="text-xs">Título (opcional)</Label>
              <Input className="h-9 text-sm" placeholder={`Semana ${fmtSemana(dataInicio, dataFim)}`}
                value={titulo} onChange={e => setTitulo(e.target.value)} />
            </div>

            {/* Datas */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Início da semana</Label>
                <Input type="date" className="h-9 text-sm" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fim da semana</Label>
                <Input type="date" className="h-9 text-sm" value={dataFim} onChange={e => setDataFim(e.target.value)} />
              </div>
            </div>

            {/* Sugestões da última meta */}
            {ultimaMetaItens.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] text-muted-foreground font-medium">Última meta</p>
                <div className="flex flex-wrap gap-1.5">
                  {ultimaMetaItens.map((it, i) => (
                    <button key={i} onClick={() => adicionarHistorico(it)}
                      className="px-2.5 py-1 text-[11px] rounded-full border border-border hover:border-primary/50 hover:text-primary transition-colors text-muted-foreground">
                      + {it.item_nome}{it.tipo_dinheiro ? ` (${it.tipo_dinheiro})` : ''} <span className="opacity-60">× {it.quantidade}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sugestões do catálogo de ingredientes */}
            <div className="space-y-2">
              <Label className="text-xs">Itens da Meta</Label>
              {catalogoItens.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {catalogoItens.map(item => (
                    <button key={item.id} onClick={() => adicionarSugerido(item.nome)}
                      className="px-2.5 py-1 text-[11px] rounded-full border border-border hover:border-primary/50 hover:text-primary transition-colors text-muted-foreground">
                      + {item.nome}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Lista de itens */}
            <datalist id="metas-itens-list">
              {catalogoItens.map(item => <option key={item.id} value={item.nome} />)}
            </datalist>
            <div className="space-y-2">
              {itensMeta.map((it, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input className="h-8 text-xs flex-1" placeholder="Nome do item" list="metas-itens-list"
                    value={it.item_nome} onChange={e => setItem(i, { item_nome: e.target.value })} />
                  <Input className="h-8 text-xs w-24" placeholder="Qtd" type="number" min="0"
                    value={it.quantidade} onChange={e => setItem(i, { quantidade: e.target.value })} />
                  <Select value={it.tipo_dinheiro || 'none'} onValueChange={v => setItem(i, { tipo_dinheiro: v === 'none' ? '' : v as 'limpo' | 'sujo' })}>
                    <SelectTrigger className="h-8 text-xs w-28"><SelectValue placeholder="Tipo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      <SelectItem value="limpo">Limpo</SelectItem>
                      <SelectItem value="sujo">Sujo</SelectItem>
                    </SelectContent>
                  </Select>
                  <button onClick={() => removeItem(i)} className="p-1 text-muted-foreground hover:text-red-400 transition-colors">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button onClick={addItem} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <Plus className="h-3 w-3" /> Adicionar item
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 mt-2 border-t border-border">
            <Button variant="outline" size="sm" onClick={() => setModalNova(false)} disabled={salvando}>Cancelar</Button>
            <Button size="sm" onClick={handleCriarMeta} disabled={salvando}>
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar Meta'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal selecionar membros ── */}
      {(() => {
        const membrosExistentes = new Set(metaAtual?.metas_membros.map(m => m.membro_id) ?? [])
        const disponiveis = membros.filter(m => !membrosExistentes.has(m.id))
        const todosSelecionados = disponiveis.length > 0 && disponiveis.every(m => membrosParaAplicar.has(m.id))
        return (
          <Dialog open={modalAplicar} onOpenChange={o => { if (!o) setModalAplicar(false) }}>
            <DialogContent className="max-w-sm" aria-describedby={undefined}>
              <DialogHeader>
                <DialogTitle>Selecionar membros</DialogTitle>
              </DialogHeader>
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {disponiveis.map(m => (
                  <label key={m.id} className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-white/[0.04] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={membrosParaAplicar.has(m.id)}
                      onChange={e => {
                        setMembrosParaAplicar(prev => {
                          const next = new Set(prev)
                          e.target.checked ? next.add(m.id) : next.delete(m.id)
                          return next
                        })
                      }}
                      className="accent-primary"
                    />
                    <span className="text-sm">{m.nome}{m.vulgo ? ` (${m.vulgo})` : ''}</span>
                  </label>
                ))}
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <button
                  onClick={() => setMembrosParaAplicar(todosSelecionados ? new Set() : new Set(disponiveis.map(m => m.id)))}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {todosSelecionados ? 'Desmarcar todos' : 'Selecionar todos'}
                </button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setModalAplicar(false)}>Cancelar</Button>
                  <Button size="sm" onClick={aplicarParaSelecionados} disabled={membrosParaAplicar.size === 0}>
                    Aplicar ({membrosParaAplicar.size})
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )
      })()}

    </div>
  )
}


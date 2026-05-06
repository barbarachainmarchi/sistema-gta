'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { UserCheck, UserX, CircleDashed, ChevronLeft, ChevronRight, Check, X } from 'lucide-react'

type Presenca = {
  id: string
  membro_id: string
  data: string
  presente: boolean
  motivo: string | null
  registrado_por_user_id: string | null
}

type Membro = {
  id: string
  nome: string
  vulgo: string | null
  status: string
  faccao_id: string | null
}

type Filtro = 'todos' | 'presentes' | 'ausentes' | 'sem_registro'

interface Props {
  userId: string
  membroIdUsuario: string | null
  membrosIniciais: Membro[]
  presencasIniciais: Presenca[]
  hojeInicial: string
  podeEditar: boolean
}

const STATUS_CFG = {
  presente:       { label: 'Presente',             cls: 'bg-emerald-500/15 text-emerald-400', Icon: UserCheck },
  ausente_just:   { label: 'Ausente justificado',  cls: 'bg-amber-500/15 text-amber-400',    Icon: UserX },
  ausente_injust: { label: 'Ausente',              cls: 'bg-red-500/15 text-red-400',         Icon: UserX },
  sem_registro:   { label: 'Sem registro',         cls: 'bg-muted/40 text-muted-foreground',  Icon: CircleDashed },
} as const

type StatusKey = keyof typeof STATUS_CFG

function getStatus(presencaMap: Record<string, Presenca>, membroId: string): StatusKey {
  const p = presencaMap[membroId]
  if (!p) return 'sem_registro'
  if (p.presente) return 'presente'
  return p.motivo ? 'ausente_just' : 'ausente_injust'
}

function fmtData(d: string, hojeInicial: string): string {
  const [y, m, dia] = d.split('-')
  const dt = new Date(Number(y), Number(m) - 1, Number(dia))
  const hoje = new Date(hojeInicial + 'T12:00:00')
  hoje.setHours(0, 0, 0, 0)
  const ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1)
  if (dt.getTime() === hoje.getTime())
    return `Hoje — ${dt.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}`
  if (dt.getTime() === ontem.getTime())
    return `Ontem — ${dt.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}`
  return dt.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
}

export function PresencasClient({
  userId, membroIdUsuario, membrosIniciais, presencasIniciais, hojeInicial, podeEditar,
}: Props) {
  const sb = useCallback(() => createClient(), [])

  const [presencas, setPresencas]       = useState<Presenca[]>(presencasIniciais)
  const [dataSel, setDataSel]           = useState(hojeInicial)
  const [carregando, setCarregando]     = useState(false)
  const [filtro, setFiltro]             = useState<Filtro>('todos')

  const [modalMembro, setModalMembro]   = useState<Membro | null>(null)
  const [modalPresente, setModalPresente] = useState<boolean | null>(null)
  const [modalMotivo, setModalMotivo]   = useState('')
  const [salvando, setSalvando]         = useState(false)

  const presencaMap = Object.fromEntries(presencas.map(p => [p.membro_id, p]))

  const presentes      = membrosIniciais.filter(m => presencaMap[m.id]?.presente === true).length
  const ausentesJust   = membrosIniciais.filter(m => presencaMap[m.id]?.presente === false && presencaMap[m.id]?.motivo).length
  const ausentesInjust = membrosIniciais.filter(m => presencaMap[m.id]?.presente === false && !presencaMap[m.id]?.motivo).length
  const semRegistro    = membrosIniciais.filter(m => !presencaMap[m.id]).length
  const totalAusentes  = ausentesJust + ausentesInjust

  const membrosFiltrados = membrosIniciais.filter(m => {
    const p = presencaMap[m.id]
    switch (filtro) {
      case 'presentes':    return p?.presente === true
      case 'ausentes':     return p?.presente === false
      case 'sem_registro': return !p
      default:             return true
    }
  })

  async function carregarData(novaData: string) {
    setCarregando(true)
    setDataSel(novaData)
    try {
      const { data: rows, error } = await sb().from('presencas').select('*').eq('data', novaData)
      if (error) { toast.error(error.message); return }
      setPresencas(rows ?? [])
    } finally { setCarregando(false) }
  }

  function navData(delta: number) {
    const d = new Date(dataSel + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    carregarData(d.toISOString().split('T')[0]!)
  }

  function abrirModal(membro: Membro) {
    const p = presencaMap[membro.id]
    setModalMembro(membro)
    setModalPresente(p ? p.presente : null)
    setModalMotivo(p?.motivo ?? '')
  }

  async function salvarPresenca() {
    if (!modalMembro || modalPresente === null) return
    setSalvando(true)
    try {
      const existing = presencaMap[modalMembro.id]
      const payload = {
        membro_id: modalMembro.id,
        data: dataSel,
        presente: modalPresente,
        motivo: modalPresente ? null : (modalMotivo.trim() || null),
        registrado_por_user_id: userId,
      }

      if (existing) {
        const { data: row, error } = await sb()
          .from('presencas')
          .update({ presente: payload.presente, motivo: payload.motivo, registrado_por_user_id: userId })
          .eq('id', existing.id)
          .select('*')
          .single()
        if (error) { toast.error(error.message); return }
        setPresencas(prev => prev.map(p => p.id === existing.id ? row : p))
      } else {
        const { data: row, error } = await sb()
          .from('presencas')
          .insert(payload)
          .select('*')
          .single()
        if (error) { toast.error(error.message); return }
        setPresencas(prev => [...prev, row])
      }

      toast.success(modalPresente ? 'Presença registrada' : 'Ausência registrada')
      setModalMembro(null)
    } finally { setSalvando(false) }
  }

  const isHoje = dataSel === hojeInicial

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-4xl space-y-6">

      {/* Navegação de data */}
      <div className="flex items-center gap-3">
        <button onClick={() => navData(-1)} disabled={carregando}
          className="h-8 w-8 rounded-md border border-border flex items-center justify-center hover:bg-white/[0.04] disabled:opacity-50 transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 text-center">
          <p className={cn('text-sm font-medium capitalize', carregando && 'opacity-50 animate-pulse')}>
            {fmtData(dataSel, hojeInicial)}
          </p>
        </div>
        <button onClick={() => navData(1)} disabled={carregando || isHoje}
          className="h-8 w-8 rounded-md border border-border flex items-center justify-center hover:bg-white/[0.04] disabled:opacity-50 transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Presentes',           value: presentes,      cls: 'text-emerald-400', bg: 'bg-emerald-500/[0.06] border-emerald-500/20' },
          { label: 'Ausentes justif.',    value: ausentesJust,   cls: 'text-amber-400',   bg: 'bg-amber-500/[0.06] border-amber-500/20' },
          { label: 'Ausentes s/ justif.', value: ausentesInjust, cls: 'text-red-400',     bg: 'bg-red-500/[0.06] border-red-500/20' },
          { label: 'Sem registro',        value: semRegistro,    cls: 'text-muted-foreground', bg: 'bg-muted/20 border-border' },
        ].map(s => (
          <div key={s.label} className={cn('rounded-xl border p-3 space-y-1', s.bg)}>
            <p className={cn('text-2xl font-bold', s.cls)}>{s.value}</p>
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-1 rounded-lg bg-muted/20 border border-border p-1 w-fit flex-wrap">
        {([
          ['todos',        'Todos',        membrosIniciais.length],
          ['presentes',    'Presentes',    presentes],
          ['ausentes',     'Ausentes',     totalAusentes],
          ['sem_registro', 'Sem registro', semRegistro],
        ] as [Filtro, string, number][]).map(([key, label, count]) => (
          <button key={key}
            onClick={() => setFiltro(key)}
            className={cn(
              'px-3 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5',
              filtro === key ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
            )}>
            {label}
            <span className={cn('text-[10px] px-1 rounded', filtro === key ? 'bg-primary/10' : 'bg-muted/40')}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Lista de membros */}
      <div className="rounded-xl border border-border overflow-hidden">
        {membrosFiltrados.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Nenhum membro nesta categoria</div>
        ) : (
          <div className="divide-y divide-border/50">
            {membrosFiltrados.map(m => {
              const status = getStatus(presencaMap, m.id)
              const cfg = STATUS_CFG[status]
              const p = presencaMap[m.id]
              const canEdit = podeEditar || m.id === membroIdUsuario

              return (
                <div
                  key={m.id}
                  onClick={() => canEdit && abrirModal(m)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3',
                    canEdit && 'hover:bg-white/[0.02] cursor-pointer transition-colors'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{m.nome}</span>
                      {m.vulgo && <span className="text-[11px] text-muted-foreground">({m.vulgo})</span>}
                    </div>
                    {p?.presente === false && p.motivo && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">Motivo: {p.motivo}</p>
                    )}
                    {p?.presente === false && !p.motivo && (
                      <p className="text-[11px] text-red-400/60 mt-0.5">Sem justificativa</p>
                    )}
                  </div>
                  <span className={cn('text-[11px] px-2 py-0.5 rounded flex items-center gap-1 shrink-0', cfg.cls)}>
                    <cfg.Icon className="h-3 w-3" />
                    {cfg.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal registrar presença */}
      <Dialog open={!!modalMembro} onOpenChange={o => { if (!o) setModalMembro(null) }}>
        <DialogContent className="max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{modalMembro?.nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs capitalize">{fmtData(dataSel, hojeInicial)}</Label>
              <div className="flex gap-2">
                <button
                  onClick={() => setModalPresente(true)}
                  className={cn(
                    'flex-1 py-2 rounded-lg border text-sm font-medium transition-colors flex items-center justify-center gap-2',
                    modalPresente === true
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  )}>
                  <Check className="h-4 w-4" /> Presente
                </button>
                <button
                  onClick={() => setModalPresente(false)}
                  className={cn(
                    'flex-1 py-2 rounded-lg border text-sm font-medium transition-colors flex items-center justify-center gap-2',
                    modalPresente === false
                      ? 'bg-red-500/20 text-red-400 border-red-500/30'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  )}>
                  <X className="h-4 w-4" /> Ausente
                </button>
              </div>
            </div>

            {modalPresente === false && (
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Motivo da ausência <span className="text-muted-foreground font-normal">(opcional)</span>
                </Label>
                <textarea
                  value={modalMotivo}
                  onChange={e => setModalMotivo(e.target.value)}
                  placeholder="Ex: viagem, compromisso, doença..."
                  rows={2}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring resize-none"
                />
                <p className="text-[11px] text-muted-foreground">Deixe em branco para ausência injustificada.</p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setModalMembro(null)}>Cancelar</Button>
            <Button size="sm" onClick={salvarPresenca} disabled={salvando || modalPresente === null}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

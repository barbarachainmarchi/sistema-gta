'use client'

import { useState } from 'react'
import { Plus, Edit2, Trash2, Loader2, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { AcaoTipo, TipoForm } from './acao-shared'
import { emptyTipoForm } from './acao-shared'

interface Props {
  tipos: AcaoTipo[]
  salvando: boolean
  podeEditar: boolean
  onSave: (form: TipoForm, editId: string | null) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
}

export function TabTipos({ tipos, salvando, podeEditar, onSave, onDelete }: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<TipoForm>(emptyTipoForm)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  function abrirNovo() {
    setForm(emptyTipoForm); setEditId(null); setModalOpen(true)
  }

  function abrirEditar(tipo: AcaoTipo) {
    setForm({
      nome: tipo.nome,
      min_participantes: String(tipo.min_participantes),
      max_participantes: tipo.max_participantes ? String(tipo.max_participantes) : '',
      descricao: tipo.descricao ?? '',
      regras: tipo.regras ?? '',
      conta_pontuacao: tipo.conta_pontuacao,
      pontos_valor: String(tipo.pontos_valor),
      ativo: tipo.ativo,
    })
    setEditId(tipo.id); setModalOpen(true)
  }

  async function handleSave() {
    const ok = await onSave(form, editId)
    if (ok) setModalOpen(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{tipos.length} tipo(s) cadastrado(s)</p>
        {podeEditar && (
          <Button size="sm" className="gap-1.5" onClick={abrirNovo}>
            <Plus className="h-3.5 w-3.5" />Novo Tipo
          </Button>
        )}
      </div>

      {tipos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <Zap className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum tipo de ação cadastrado</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {tipos.map(tipo => (
            <div key={tipo.id} className={cn('rounded-lg border border-border p-4 space-y-2', !tipo.ativo && 'opacity-50')}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span className="font-semibold text-sm">{tipo.nome}</span>
                  {!tipo.ativo && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Inativo</span>
                  )}
                  {tipo.conta_pontuacao && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400 font-medium">
                      ★ {tipo.pontos_valor} pts
                    </span>
                  )}
                </div>
                {podeEditar && (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => abrirEditar(tipo)}
                      className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06]">
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setConfirmDeleteId(tipo.id)}
                      className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {tipo.min_participantes === tipo.max_participantes
                  ? `${tipo.min_participantes} participante(s)`
                  : tipo.max_participantes
                  ? `${tipo.min_participantes}–${tipo.max_participantes} participantes`
                  : `Min. ${tipo.min_participantes} participante(s)`}
              </p>
              {tipo.descricao && <p className="text-xs text-muted-foreground">{tipo.descricao}</p>}
              {tipo.regras && (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer hover:text-foreground">Ver regras</summary>
                  <p className="mt-1 whitespace-pre-wrap pl-2 border-l border-border">{tipo.regras}</p>
                </details>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Form dialog */}
      <Dialog open={modalOpen} onOpenChange={o => { if (!o && !salvando) setModalOpen(false) }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? 'Editar Tipo de Ação' : 'Novo Tipo de Ação'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                placeholder="Nome do tipo de ação" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Participantes mínimo</Label>
                <Input type="number" min="1" value={form.min_participantes}
                  onChange={e => setForm(f => ({ ...f, min_participantes: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Participantes máximo</Label>
                <Input type="number" min="1" value={form.max_participantes}
                  onChange={e => setForm(f => ({ ...f, max_participantes: e.target.value }))}
                  placeholder="Ilimitado" className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                placeholder="Descrição breve..." rows={2} className="mt-1 resize-none" />
            </div>
            <div>
              <Label>Regras detalhadas</Label>
              <Textarea value={form.regras} onChange={e => setForm(f => ({ ...f, regras: e.target.value }))}
                placeholder="Regras, instruções, requisitos..." rows={3} className="mt-1 resize-none" />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Conta pontuação</p>
                <p className="text-xs text-muted-foreground">Participantes ganham pontos ao completar</p>
              </div>
              <Switch checked={form.conta_pontuacao} onCheckedChange={v => setForm(f => ({ ...f, conta_pontuacao: v }))} />
            </div>
            {form.conta_pontuacao && (
              <div>
                <Label>Pontos por participante</Label>
                <Input type="number" min="0" value={form.pontos_valor}
                  onChange={e => setForm(f => ({ ...f, pontos_valor: e.target.value }))} className="mt-1 w-32" />
              </div>
            )}
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Ativo</p>
                <p className="text-xs text-muted-foreground">Disponível para novos registros</p>
              </div>
              <Switch checked={form.ativo} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)} disabled={salvando}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={salvando}>
              {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : editId ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!confirmDeleteId} onOpenChange={o => { if (!o) setConfirmDeleteId(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Excluir tipo de ação?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            O tipo será removido. Ações já registradas com este tipo manterão o nome salvo.
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

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus, Trash2, Edit2, Loader2, Send, Eye, EyeOff } from 'lucide-react'
import { TIPOS_LOG } from '@/lib/telegram'
import type { TipoLog } from '@/lib/telegram'

// ── Tipos ─────────────────────────────────────────────────────────────────────

type TipoConfig = { tipo: string; ativo: boolean }

type Destino = {
  id: string
  nome: string
  bot_token: string
  chat_id: string
  ativo: boolean
  created_at: string
  telegram_tipos_log: TipoConfig[]
}

interface Props {
  iniciais: Destino[]
}

// ── Componente ────────────────────────────────────────────────────────────────

export function TelegramConfig({ iniciais }: Props) {
  const [destinos, setDestinos] = useState<Destino[]>(iniciais)
  const [dialogAberto, setDialogAberto] = useState(false)
  const [editando, setEditando] = useState<Destino | null>(null)
  const [saving, setSaving] = useState(false)
  const [testando, setTestando] = useState<string | null>(null)
  const [mostrarToken, setMostrarToken] = useState<string | null>(null)

  const [form, setForm] = useState({ nome: '', bot_token: '', chat_id: '' })

  function abrirAdicionar() {
    setEditando(null)
    setForm({ nome: '', bot_token: '', chat_id: '' })
    setDialogAberto(true)
  }

  function abrirEditar(d: Destino) {
    setEditando(d)
    setForm({ nome: d.nome, bot_token: d.bot_token, chat_id: d.chat_id })
    setDialogAberto(true)
  }

  async function handleSalvar() {
    if (!form.nome.trim() || !form.bot_token.trim() || !form.chat_id.trim()) {
      toast.error('Preencha todos os campos')
      return
    }
    setSaving(true)
    try {
      if (editando) {
        const res = await fetch('/api/telegram', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'update_destino', id: editando.id, ...form }),
        })
        if (!res.ok) throw new Error((await res.json()).error)
        const updated = await res.json()
        setDestinos(prev => prev.map(d => d.id === editando.id ? { ...d, ...updated } : d))
        toast.success('Destino atualizado')
      } else {
        const res = await fetch('/api/telegram', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error((await res.json()).error)
        const novo = await res.json()
        setDestinos(prev => [...prev, novo])
        toast.success('Destino adicionado')
      }
      setDialogAberto(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeletar(d: Destino) {
    if (!confirm(`Remover "${d.nome}"?`)) return
    const res = await fetch(`/api/telegram?id=${d.id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Erro ao remover'); return }
    setDestinos(prev => prev.filter(x => x.id !== d.id))
    toast.success('Destino removido')
  }

  async function toggleAtivo(d: Destino) {
    const res = await fetch('/api/telegram', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'update_destino', id: d.id, ativo: !d.ativo }),
    })
    if (!res.ok) { toast.error('Erro'); return }
    setDestinos(prev => prev.map(x => x.id === d.id ? { ...x, ativo: !d.ativo } : x))
  }

  async function toggleTipo(d: Destino, tipo: TipoLog, ativo: boolean) {
    const res = await fetch('/api/telegram', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_tipo', destino_id: d.id, tipo, ativo }),
    })
    if (!res.ok) { toast.error('Erro'); return }
    setDestinos(prev => prev.map(x => {
      if (x.id !== d.id) return x
      const existente = x.telegram_tipos_log.find(t => t.tipo === tipo)
      const novos = existente
        ? x.telegram_tipos_log.map(t => t.tipo === tipo ? { ...t, ativo } : t)
        : [...x.telegram_tipos_log, { tipo, ativo }]
      return { ...x, telegram_tipos_log: novos }
    }))
  }

  async function handleTestar(d: Destino) {
    setTestando(d.id)
    try {
      const res = await fetch('/api/telegram', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'test', id: d.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success('Mensagem de teste enviada!')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao testar')
    } finally {
      setTestando(null)
    }
  }

  return (
    <section className="px-6 py-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Telegram</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure destinos (bot + chat) para receber notificações de log
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={abrirAdicionar} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Adicionar destino
        </Button>
      </div>

      {/* Lista de destinos */}
      {destinos.length === 0 ? (
        <p className="text-xs text-muted-foreground/60 py-2">Nenhum destino cadastrado.</p>
      ) : (
        <div className="space-y-4">
          {destinos.map(d => {
            const tiposMap: Record<string, boolean> = {}
            for (const t of d.telegram_tipos_log) tiposMap[t.tipo] = t.ativo

            return (
              <div key={d.id} className="rounded-lg border border-border bg-card p-4 space-y-4">
                {/* Card header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{d.nome}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${d.ativo ? 'bg-green-500/10 text-green-400' : 'bg-zinc-500/10 text-zinc-500'}`}>
                        {d.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                      <span>Chat: {d.chat_id}</span>
                      <span className="flex items-center gap-1">
                        Token:{' '}
                        {mostrarToken === d.id ? d.bot_token : '●'.repeat(Math.min(d.bot_token.length, 20))}
                        <button
                          type="button"
                          onClick={() => setMostrarToken(prev => prev === d.id ? null : d.id)}
                          className="hover:text-foreground transition-colors"
                        >
                          {mostrarToken === d.id ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </button>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Switch checked={d.ativo} onCheckedChange={() => toggleAtivo(d)} />
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => abrirEditar(d)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeletar(d)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Tipos de log */}
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Tipos de notificação
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {TIPOS_LOG.map(t => {
                      const ativo = tiposMap[t.tipo] ?? false
                      return (
                        <label
                          key={t.tipo}
                          className="flex items-center gap-2 cursor-pointer select-none"
                        >
                          <Switch
                            checked={ativo}
                            onCheckedChange={v => toggleTipo(d, t.tipo as TipoLog, v)}
                            className="shrink-0"
                          />
                          <span className="text-xs text-foreground/80">
                            {t.icone} {t.label}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>

                {/* Testar */}
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 h-7 text-xs"
                  onClick={() => handleTestar(d)}
                  disabled={testando === d.id}
                >
                  {testando === d.id
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Send className="h-3 w-3" />}
                  Testar envio
                </Button>
              </div>
            )
          })}
        </div>
      )}

      {/* Dialog add/edit */}
      <Dialog open={dialogAberto} onOpenChange={v => !v && setDialogAberto(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar destino' : 'Novo destino Telegram'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome</Label>
              <Input
                placeholder="Ex: Grupo Admin"
                value={form.nome}
                onChange={e => setForm(prev => ({ ...prev, nome: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Bot Token</Label>
              <Input
                type="password"
                placeholder="110201543:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw"
                value={form.bot_token}
                onChange={e => setForm(prev => ({ ...prev, bot_token: e.target.value }))}
              />
              <p className="text-[10px] text-muted-foreground">
                Obtido com o @BotFather no Telegram
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Chat ID</Label>
              <Input
                placeholder="-1001234567890"
                value={form.chat_id}
                onChange={e => setForm(prev => ({ ...prev, chat_id: e.target.value }))}
              />
              <p className="text-[10px] text-muted-foreground">
                ID do grupo/canal. Use @userinfobot para descobrir.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAberto(false)}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              {editando ? 'Salvar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

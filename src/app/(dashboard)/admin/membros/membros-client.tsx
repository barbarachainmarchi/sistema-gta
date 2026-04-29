'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Edit2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type UsuarioSimples = { id: string; nome: string; membro_id: string | null }
type UsuarioDetalhado = {
  id: string; nome: string; status: 'ativo' | 'inativo' | 'pendente'
  membro_id: string | null; perfil_id: string | null; perfil_nome: string | null
  local_trabalho_loja_id: string | null; local_trabalho_faccao_id: string | null
  trabalho_principal: 'loja' | 'faccao' | null
}
type Membro = {
  id: string; nome: string; vulgo: string | null; cargo_faccao: string | null
  status: string; data_entrada: string | null; data_saida: string | null
  usuario: UsuarioDetalhado | null
}
type Perfil = { id: string; nome: string }
type Loja = { id: string; nome: string }
type Faccao = { id: string; nome: string; tag: string | null }

interface Props {
  membros: Membro[]
  usuarios: UsuarioSimples[]
  lojas: Loja[]
  faccoesTodas: Faccao[]
  faccoesSelecionaveis: Faccao[]
  perfis: Perfil[]
}

function fmtData(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}

export function MembrosAdminClient({ membros: initialMembros, usuarios, lojas, faccoesTodas, faccoesSelecionaveis, perfis }: Props) {
  const router = useRouter()
  const sbRef = useRef<ReturnType<typeof createClient> | null>(null)
  const sb = useCallback(() => { if (!sbRef.current) sbRef.current = createClient(); return sbRef.current }, [])

  const [membros, setMembros] = useState(initialMembros)
  const [loading, setLoading] = useState<string | null>(null)

  // ── Modal de edição ────────────────────────────────────────────────────────
  const [editMembro, setEditMembro] = useState<Membro | null>(null)
  const [editForm, setEditForm] = useState({ usuario_id: '', perfil_id: '', loja_id: '', faccao_id: '', trabalho_principal: '' as '' | 'loja' | 'faccao' })
  const [saving, setSaving] = useState(false)

  function openEdit(m: Membro) {
    setEditMembro(m)
    setEditForm({
      usuario_id: m.usuario?.id ?? '',
      perfil_id: m.usuario?.perfil_id ?? '',
      loja_id: m.usuario?.local_trabalho_loja_id ?? '',
      faccao_id: m.usuario?.local_trabalho_faccao_id ?? '',
      trabalho_principal: m.usuario?.trabalho_principal ?? '',
    })
  }

  async function handleSalvar() {
    if (!editMembro) return
    setSaving(true)

    const originalUserId = editMembro.usuario?.id ?? null
    const novoUserId = editForm.usuario_id || null
    const lojaId = editForm.loja_id || null
    const faccaoId = editForm.faccao_id || null
    const tp = (editForm.trabalho_principal || null) as 'loja' | 'faccao' | null

    // Remove vínculo do usuário anterior se trocou
    if (originalUserId && originalUserId !== novoUserId) {
      await fetch('/api/admin/usuarios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: originalUserId, membro_id: null }),
      })
    }

    // Aplica vínculo + perfil + local de trabalho no usuário novo/atual
    if (novoUserId) {
      const res = await fetch('/api/admin/usuarios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: novoUserId,
          membro_id: editMembro.id,
          perfil_id: editForm.perfil_id || null,
          local_trabalho_loja_id: lojaId,
          local_trabalho_faccao_id: faccaoId,
          trabalho_principal: lojaId && faccaoId ? tp : null,
        }),
      })
      if (!res.ok) {
        const j = await res.json()
        setSaving(false)
        toast.error(j.error ?? 'Erro ao salvar')
        return
      }
    }

    setSaving(false)
    toast.success('Membro atualizado')
    setEditMembro(null)
    router.refresh()
  }

  // ── Desativar ──────────────────────────────────────────────────────────────
  async function handleDesativar(m: Membro) {
    setLoading(m.id)
    const hoje = new Date().toISOString().slice(0, 10)
    const { error } = await sb().from('membros').update({ status: 'inativo', faccao_id: null, data_saida: hoje }).eq('id', m.id)
    if (error) { toast.error('Erro ao desativar'); setLoading(null); return }
    if (m.usuario) {
      await fetch('/api/admin/usuarios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: m.usuario.id, status: 'inativo' }),
      })
    }
    setMembros(prev => prev.map(mb => mb.id === m.id ? { ...mb, status: 'inativo', data_saida: hoje } : mb))
    setLoading(null)
    toast.success(`${m.nome} desativado`)
    router.refresh()
  }

  // ── Reativar ───────────────────────────────────────────────────────────────
  async function handleReativar(m: Membro) {
    setLoading(m.id)
    const { error } = await sb().from('membros').update({ status: 'ativo', data_saida: null }).eq('id', m.id)
    setLoading(null)
    if (error) { toast.error('Erro ao reativar'); return }
    setMembros(prev => prev.map(mb => mb.id === m.id ? { ...mb, status: 'ativo', data_saida: null } : mb))
    toast.success(`${m.nome} reativado — vincule um usuário para restaurar o acesso`)
    router.refresh()
  }

  const ativos = membros.filter(m => m.status === 'ativo')
  const inativos = membros.filter(m => m.status === 'inativo')
  const temDoisEmpregos = !!editForm.loja_id && !!editForm.faccao_id

  return (
    <>
      <Header title="Membros" description="Equipe, perfil de acesso e local de trabalho" />

      <div className="flex-1 p-6 space-y-6">

        {/* ── Equipe ativa ──────────────────────────────────────────────────── */}
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary/80 px-1">
            Equipe ativa ({ativos.length})
          </p>

          {ativos.length === 0 ? (
            <div className="rounded-lg border border-border py-10 text-center text-muted-foreground text-sm">
              Nenhum membro ativo
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="grid grid-cols-[1fr_130px_110px_1fr_110px] gap-3 px-4 py-2 bg-white/[0.02] border-b border-border text-[10px] text-muted-foreground font-medium">
                <span>Nome</span><span>Cargo</span><span>Entrada</span><span>Usuário / Perfil / Local</span><span />
              </div>
              {ativos.map((m, idx) => (
                <div key={m.id} className={cn('grid grid-cols-[1fr_130px_110px_1fr_110px] gap-3 items-start px-4 py-3', idx < ativos.length - 1 && 'border-b border-border/40')}>
                  <div>
                    <span className="text-sm font-medium">{m.nome}</span>
                    {m.vulgo && <span className="ml-1.5 text-xs text-muted-foreground">"{m.vulgo}"</span>}
                  </div>
                  <span className="text-xs text-muted-foreground pt-0.5">{m.cargo_faccao ?? '—'}</span>
                  <span className="text-xs text-muted-foreground pt-0.5">{fmtData(m.data_entrada)}</span>
                  <div className="space-y-0.5">
                    {m.usuario ? (
                      <>
                        <div className="flex items-center gap-1.5">
                          <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', m.usuario.status === 'ativo' ? 'bg-green-400' : 'bg-zinc-500')} />
                          <span className="text-sm">{m.usuario.nome}</span>
                        </div>
                        <div className="flex items-center gap-1 flex-wrap pl-3">
                          {m.usuario.perfil_nome && (
                            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{m.usuario.perfil_nome}</span>
                          )}
                          {m.usuario.local_trabalho_loja_id && (
                            <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded">
                              {lojas.find(l => l.id === m.usuario!.local_trabalho_loja_id)?.nome ?? 'Loja'}
                            </span>
                          )}
                          {m.usuario.local_trabalho_faccao_id && (
                            <span className="text-[10px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded">
                              {faccoesTodas.find(f => f.id === m.usuario!.local_trabalho_faccao_id)?.nome ?? 'Facção'}
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sem usuário vinculado</span>
                    )}
                  </div>
                  <div className="flex justify-end items-start gap-1">
                    {loading === m.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground mt-1" />
                    ) : (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(m)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => handleDesativar(m)}>
                          Desativar
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Ex-membros ────────────────────────────────────────────────────── */}
        {inativos.length > 0 && (
          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 px-1">
              Ex-membros ({inativos.length})
            </p>
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <div className="grid grid-cols-[1fr_130px_110px_110px_100px] gap-3 px-4 py-2 bg-white/[0.02] border-b border-border text-[10px] text-muted-foreground font-medium">
                <span>Nome</span><span>Cargo</span><span>Entrada</span><span>Saída</span><span />
              </div>
              {inativos.map((m, idx) => (
                <div key={m.id} className={cn('grid grid-cols-[1fr_130px_110px_110px_100px] gap-3 items-center px-4 py-3 opacity-70', idx < inativos.length - 1 && 'border-b border-border/40')}>
                  <div>
                    <span className="text-sm font-medium">{m.nome}</span>
                    {m.vulgo && <span className="ml-1.5 text-xs text-muted-foreground">"{m.vulgo}"</span>}
                  </div>
                  <span className="text-xs text-muted-foreground">{m.cargo_faccao ?? '—'}</span>
                  <span className="text-xs text-muted-foreground">{fmtData(m.data_entrada)}</span>
                  <span className="text-xs text-muted-foreground">{fmtData(m.data_saida)}</span>
                  <div className="flex justify-end">
                    {loading === m.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    ) : (
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleReativar(m)}>
                        Reativar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ── Modal de edição ─────────────────────────────────────────────────── */}
      <Dialog open={!!editMembro} onOpenChange={v => !v && setEditMembro(null)}>
        <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>
              {editMembro?.nome}
              {editMembro?.vulgo && (
                <span className="ml-1.5 text-sm font-normal text-muted-foreground">"{editMembro.vulgo}"</span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">

            <div className="space-y-1.5">
              <Label className="text-xs">Usuário do sistema</Label>
              <Select
                value={editForm.usuario_id || '_none'}
                onValueChange={v => setEditForm(f => ({ ...f, usuario_id: v === '_none' ? '' : v }))}
              >
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Sem usuário..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sem usuário</SelectItem>
                  {usuarios
                    .filter(u => !u.membro_id || u.membro_id === editMembro?.id || u.id === editForm.usuario_id)
                    .map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)
                  }
                </SelectContent>
              </Select>
            </div>

            {editForm.usuario_id && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Perfil de acesso</Label>
                  <Select
                    value={editForm.perfil_id || '_none'}
                    onValueChange={v => setEditForm(f => ({ ...f, perfil_id: v === '_none' ? '' : v }))}
                  >
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Sem perfil..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Sem perfil</SelectItem>
                      {perfis.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="pt-1 border-t border-border space-y-3">
                  <p className="text-xs text-muted-foreground">Local de trabalho</p>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Loja</Label>
                    <Select
                      value={editForm.loja_id || '_none'}
                      onValueChange={v => setEditForm(f => ({ ...f, loja_id: v === '_none' ? '' : v }))}
                    >
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Nenhuma..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Nenhuma</SelectItem>
                        {lojas.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Facção</Label>
                    <Select
                      value={editForm.faccao_id || '_none'}
                      onValueChange={v => setEditForm(f => ({ ...f, faccao_id: v === '_none' ? '' : v }))}
                    >
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Nenhuma..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Nenhuma</SelectItem>
                        {faccoesSelecionaveis.map(f => (
                          <SelectItem key={f.id} value={f.id}>{f.nome}{f.tag ? ` [${f.tag}]` : ''}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {temDoisEmpregos && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Trabalho principal</Label>
                      <Select
                        value={editForm.trabalho_principal || '_none'}
                        onValueChange={v => setEditForm(f => ({ ...f, trabalho_principal: v === '_none' ? '' : v as 'loja' | 'faccao' }))}
                      >
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Não definido..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">Não definido</SelectItem>
                          <SelectItem value="loja">Loja</SelectItem>
                          <SelectItem value="faccao">Facção</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditMembro(null)}>Cancelar</Button>
            <Button size="sm" onClick={handleSalvar} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

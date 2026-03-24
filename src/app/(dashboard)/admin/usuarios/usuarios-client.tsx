'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Plus, Search, Edit2, Trash2, Loader2, Link2, Shield, Check, Copy, Clock, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Módulos ──────────────────────────────────────────────────────────────────

const MODULOS = [
  { key: 'admin_cadastros',   label: 'Cadastros',    grupo: 'Admin' },
  { key: 'admin_usuarios',    label: 'Usuários',     grupo: 'Admin' },
  { key: 'admin_layout',      label: 'Layout',       grupo: 'Admin' },
  { key: 'admin_logs',        label: 'Logs',         grupo: 'Admin' },
  { key: 'admin_integracoes', label: 'Integrações',  grupo: 'Admin' },
  { key: 'admin_backup',      label: 'Backup',       grupo: 'Admin' },
  { key: 'investigacao',      label: 'Investigação', grupo: 'Investigação' },
  { key: 'vendas',            label: 'Vendas',       grupo: 'Vendas' },
  { key: 'encomendas',        label: 'Encomendas',   grupo: 'Vendas' },
  { key: 'vendas_concluidas', label: 'Concluídas',   grupo: 'Vendas' },
  { key: 'calculadora',       label: 'Calculadora',  grupo: 'Ferramentas' },
  { key: 'cotacao',           label: 'Cotação',      grupo: 'Ferramentas' },
  { key: 'metas',             label: 'Metas',        grupo: 'Interno' },
  { key: 'acao',              label: 'Ação',         grupo: 'Interno' },
  { key: 'financeiro',        label: 'Financeiro',   grupo: 'Interno' },
]
const GRUPOS = ['Admin', 'Investigação', 'Vendas', 'Ferramentas', 'Interno']

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Usuario = {
  id: string
  email: string
  nome: string
  cargo: string | null
  perfil_id: string | null
  membro_id: string | null
  local_trabalho_loja_id: string | null
  local_trabalho_faccao_id: string | null
  perfil_nome: string | null
  status: 'ativo' | 'inativo' | 'pendente'
  created_at: string
  ultimo_acesso: string | null
}

type LojaSimples = { id: string; nome: string }
type FaccaoSimples = { id: string; nome: string; tag: string | null }

type MembroInvestigacao = {
  id: string
  nome: string
  vulgo: string | null
  faccao_id: string | null
  cargo_faccao: string | null
  status: string
  membro_proprio: boolean
  data_entrada: string | null
  data_saida: string | null
  faccoes: { nome: string; cor_tag: string } | null
}

type Permissao = { modulo: string; pode_ver: boolean; pode_editar: boolean }

type Perfil = {
  id: string
  nome: string
  descricao: string | null
  permissoes: Permissao[]
}

type Convite = {
  token: string
  expires_at: string
  criado_em: string
}

interface Props {
  usuarios: Usuario[]
  perfis: Perfil[]
  convites: Convite[]
  currentUserId: string
  membros: MembroInvestigacao[]
  lojas: LojaSimples[]
  faccoes: FaccaoSimples[]
  defaultLojaId: string | null
  defaultFaccaoId: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function formatExpiry(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffH = Math.round((d.getTime() - now.getTime()) / 3600000)
  if (diffH < 1) return 'Expira em breve'
  if (diffH < 24) return `Expira em ${diffH}h`
  return `Expira em ${Math.ceil(diffH / 24)}d`
}

function StatusBadge({ status }: { status: Usuario['status'] }) {
  if (status === 'pendente') return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400">
      <span className="h-1 w-1 rounded-full bg-yellow-400" />
      Pendente
    </span>
  )
  if (status === 'ativo') return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded bg-green-500/10 text-green-400">
      <span className="h-1 w-1 rounded-full bg-green-400" />
      Ativo
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded bg-zinc-500/10 text-zinc-500">
      <span className="h-1 w-1 rounded-full bg-zinc-500" />
      Inativo
    </span>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function UsuariosClient({ usuarios: initialUsuarios, perfis: initialPerfis, convites: initialConvites, currentUserId, membros, lojas, faccoes, defaultLojaId, defaultFaccaoId }: Props) {
  const router = useRouter()
  const sbRef = useRef<ReturnType<typeof createClient> | null>(null)
  const sb = useCallback(() => { if (!sbRef.current) sbRef.current = createClient(); return sbRef.current }, [])

  const [usuarios, setUsuarios] = useState(initialUsuarios)
  const [perfis, setPerfis] = useState(initialPerfis)
  const [convites, setConvites] = useState(initialConvites)
  const [busca, setBusca] = useState('')

  // ── Vínculo e gestão membro <-> usuário ───────────────────────────────────
  const [membrosState, setMembrosState] = useState<MembroInvestigacao[]>(membros)
  const [vinculandoId, setVinculandoId] = useState<string | null>(null)

  async function handleVincularMembro(usuarioId: string, membroId: string | null) {
    setVinculandoId(usuarioId)
    const { error } = await sb().from('usuarios').update({ membro_id: membroId }).eq('id', usuarioId)
    setVinculandoId(null)
    if (error) { toast.error('Erro ao vincular'); return }
    setUsuarios(prev => prev.map(u => u.id === usuarioId ? { ...u, membro_id: membroId } : u))
    toast.success(membroId ? 'Membro vinculado!' : 'Vínculo removido')
  }

  async function handleDesativarMembro(membro: MembroInvestigacao) {
    setVinculandoId(membro.id)
    const hoje = new Date().toISOString().slice(0, 10)
    const { error } = await sb().from('membros').update({ status: 'inativo', faccao_id: null, data_saida: hoje }).eq('id', membro.id)
    if (error) { toast.error('Erro ao desativar membro'); setVinculandoId(null); return }
    // Desativar o usuário vinculado também
    const usuarioVinculado = usuarios.find(u => u.membro_id === membro.id)
    if (usuarioVinculado) {
      await fetch('/api/admin/usuarios', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: usuarioVinculado.id, status: 'inativo' }) })
      setUsuarios(prev => prev.map(u => u.id === usuarioVinculado.id ? { ...u, status: 'inativo' } : u))
    }
    setMembrosState(prev => prev.map(m => m.id === membro.id ? { ...m, status: 'inativo', faccao_id: null, faccoes: null, data_saida: hoje } : m))
    setVinculandoId(null)
    toast.success(`${membro.nome} desativado`)
  }

  async function handleReativarMembro(membro: MembroInvestigacao) {
    setVinculandoId(membro.id)
    const { error } = await sb().from('membros').update({ status: 'ativo', data_saida: null }).eq('id', membro.id)
    setVinculandoId(null)
    if (error) { toast.error('Erro ao reativar'); return }
    setMembrosState(prev => prev.map(m => m.id === membro.id ? { ...m, status: 'ativo', data_saida: null } : m))
    toast.success(`${membro.nome} reativado — vincule um usuário para restaurar o acesso`)
  }

  // ── Gerar link de convite ──────────────────────────────────────────────────
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkHoras, setLinkHoras] = useState('168') // 7 dias
  const [linkGerado, setLinkGerado] = useState<string | null>(null)
  const [linkSaving, setLinkSaving] = useState(false)
  const [linkCopiado, setLinkCopiado] = useState(false)

  function openGerarLink() {
    setLinkGerado(null)
    setLinkHoras('168')
    setLinkCopiado(false)
    setLinkOpen(true)
  }

  async function handleGerarLink() {
    setLinkSaving(true)
    const res = await fetch('/api/convite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ horas: parseInt(linkHoras) }),
    })
    const json = await res.json()
    setLinkSaving(false)
    if (!res.ok) { toast.error(json.error ?? 'Erro ao gerar link'); return }
    const url = `${window.location.origin}/convite/${json.token}`
    setLinkGerado(url)
    const expires_at = new Date(Date.now() + parseInt(linkHoras) * 3600000).toISOString()
    setConvites(prev => [...prev, { token: json.token, expires_at, criado_em: new Date().toISOString() }])
  }

  function handleCopiarLink() {
    if (!linkGerado) return
    navigator.clipboard.writeText(linkGerado)
    setLinkCopiado(true)
    setTimeout(() => setLinkCopiado(false), 2000)
    toast.success('Link copiado!')
  }

  async function handleRevogarConvite(token: string) {
    await fetch('/api/convite', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    setConvites(prev => prev.filter(c => c.token !== token))
    toast.success('Convite revogado')
  }

  // ── Ativar usuário pendente ────────────────────────────────────────────────
  const [ativarUsuario, setAtivarUsuario] = useState<Usuario | null>(null)
  const [ativarForm, setAtivarForm] = useState({ cargo: '', perfil_id: '' })
  const [ativarSaving, setAtivarSaving] = useState(false)

  function openAtivar(u: Usuario) {
    setAtivarUsuario(u)
    setAtivarForm({ cargo: '', perfil_id: '' })
  }

  async function handleAtivar() {
    if (!ativarUsuario) return
    setAtivarSaving(true)
    const res = await fetch('/api/admin/usuarios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ativarUsuario.id, nome: ativarUsuario.nome, cargo: ativarForm.cargo, perfil_id: ativarForm.perfil_id, status: 'ativo' }),
    })
    const json = await res.json()
    setAtivarSaving(false)
    if (!res.ok) { toast.error(json.error ?? 'Erro ao ativar'); return }
    toast.success(`${ativarUsuario.nome} ativado`)
    const perfilNome = perfis.find(p => p.id === ativarForm.perfil_id)?.nome ?? null
    setUsuarios(prev => prev.map(u =>
      u.id === ativarUsuario.id
        ? { ...u, cargo: ativarForm.cargo || null, perfil_id: ativarForm.perfil_id || null, perfil_nome: perfilNome, status: 'ativo' }
        : u
    ))
    setAtivarUsuario(null)
  }

  // ── Editar usuário ─────────────────────────────────────────────────────────
  const [editUsuario, setEditUsuario] = useState<Usuario | null>(null)
  const [editForm, setEditForm] = useState({
    nome: '', cargo: '', perfil_id: '', status: 'ativo' as 'ativo' | 'inativo',
    local_trabalho_loja_id: '',
    local_trabalho_faccao_id: '',
  })
  const [editSaving, setEditSaving] = useState(false)

  function openEdit(u: Usuario) {
    setEditUsuario(u)
    setEditForm({
      nome: u.nome, cargo: u.cargo ?? '', perfil_id: u.perfil_id ?? '',
      status: u.status === 'pendente' ? 'ativo' : u.status,
      // Se o usuário ainda não tem local definido, usa o padrão do admin
      local_trabalho_loja_id: u.local_trabalho_loja_id ?? defaultLojaId ?? '',
      local_trabalho_faccao_id: u.local_trabalho_faccao_id ?? defaultFaccaoId ?? '',
    })
  }

  async function handleSalvarUsuario() {
    if (!editUsuario) return
    setEditSaving(true)
    const res = await fetch('/api/admin/usuarios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editUsuario.id, nome: editForm.nome, cargo: editForm.cargo, perfil_id: editForm.perfil_id, status: editForm.status }),
    })
    const json = await res.json()
    if (!res.ok) { setEditSaving(false); toast.error(json.error ?? 'Erro ao salvar'); return }

    const novoLojaId = editForm.local_trabalho_loja_id || null
    const novoFaccaoId = editForm.local_trabalho_faccao_id || null
    const localMudou = novoLojaId !== editUsuario.local_trabalho_loja_id || novoFaccaoId !== editUsuario.local_trabalho_faccao_id
    await sb().from('usuarios').update({
      local_trabalho_loja_id: novoLojaId,
      local_trabalho_faccao_id: novoFaccaoId,
    }).eq('id', editUsuario.id)
    if (localMudou) {
      await sb().from('items').update({ eh_meu_produto: false, meu_produto_usuario_id: null }).eq('meu_produto_usuario_id', editUsuario.id)
    }

    setEditSaving(false)
    toast.success('Usuário atualizado')
    const perfilNome = perfis.find(p => p.id === editForm.perfil_id)?.nome ?? null
    setUsuarios(prev => prev.map(u =>
      u.id === editUsuario.id
        ? { ...u, nome: editForm.nome, cargo: editForm.cargo || null, perfil_id: editForm.perfil_id || null, perfil_nome: perfilNome, status: editForm.status, local_trabalho_loja_id: novoLojaId, local_trabalho_faccao_id: novoFaccaoId }
        : u
    ))
    setEditUsuario(null)
  }

  // ── Remover usuário ────────────────────────────────────────────────────────
  const [confirmRemover, setConfirmRemover] = useState<Usuario | null>(null)
  const [removendo, setRemovendo] = useState(false)

  async function handleRemover() {
    if (!confirmRemover) return
    setRemovendo(true)
    const res = await fetch('/api/admin/usuarios', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: confirmRemover.id }),
    })
    const json = await res.json()
    setRemovendo(false)
    if (!res.ok) { toast.error(json.error ?? 'Erro ao remover'); return }
    toast.success('Usuário removido')
    setConfirmRemover(null)
    setUsuarios(prev => prev.filter(u => u.id !== confirmRemover.id))
  }

  // ── Perfis ─────────────────────────────────────────────────────────────────
  const [perfilOpen, setPerfilOpen] = useState(false)
  const [editPerfil, setEditPerfil] = useState<Perfil | null>(null)
  const [perfilForm, setPerfilForm] = useState({ nome: '', descricao: '' })
  const [perfilPerms, setPerfilPerms] = useState<Record<string, { ver: boolean; editar: boolean }>>({})
  const [perfilSaving, setPerfilSaving] = useState(false)
  const [confirmRemoverPerfil, setConfirmRemoverPerfil] = useState<Perfil | null>(null)
  const [removendoPerfil, setRemovendoPerfil] = useState(false)

  function buildPermsMap(permissoes: Permissao[]) {
    return Object.fromEntries(MODULOS.map(m => {
      const p = permissoes.find(pm => pm.modulo === m.key)
      return [m.key, { ver: p?.pode_ver ?? false, editar: p?.pode_editar ?? false }]
    }))
  }

  function openNovoPerfil() {
    setEditPerfil(null)
    setPerfilForm({ nome: '', descricao: '' })
    setPerfilPerms(buildPermsMap([]))
    setPerfilOpen(true)
  }

  function openEditPerfil(p: Perfil) {
    setEditPerfil(p)
    setPerfilForm({ nome: p.nome, descricao: p.descricao ?? '' })
    setPerfilPerms(buildPermsMap(p.permissoes))
    setPerfilOpen(true)
  }

  function togglePerm(modulo: string, campo: 'ver' | 'editar') {
    setPerfilPerms(prev => {
      const curr = prev[modulo]
      if (campo === 'ver') {
        const novoVer = !curr.ver
        return { ...prev, [modulo]: { ver: novoVer, editar: novoVer ? curr.editar : false } }
      } else {
        const novoEditar = !curr.editar
        return { ...prev, [modulo]: { ver: novoEditar ? true : curr.ver, editar: novoEditar } }
      }
    })
  }

  async function handleSalvarPerfil() {
    if (!perfilForm.nome) { toast.error('Nome é obrigatório'); return }
    setPerfilSaving(true)

    if (editPerfil) {
      const { error } = await sb().from('perfis_acesso').update({ nome: perfilForm.nome, descricao: perfilForm.descricao || null }).eq('id', editPerfil.id)
      if (error) { toast.error('Erro ao salvar perfil'); setPerfilSaving(false); return }
      await sb().from('perfil_permissoes').delete().eq('perfil_id', editPerfil.id)
      const rows = MODULOS.map(m => ({ perfil_id: editPerfil.id, modulo: m.key, pode_ver: perfilPerms[m.key]?.ver ?? false, pode_editar: perfilPerms[m.key]?.editar ?? false }))
      await sb().from('perfil_permissoes').insert(rows)
      setPerfis(prev => prev.map(p => p.id === editPerfil.id ? { ...p, nome: perfilForm.nome, descricao: perfilForm.descricao || null, permissoes: rows.map(r => ({ modulo: r.modulo, pode_ver: r.pode_ver, pode_editar: r.pode_editar })) } : p))
      toast.success('Perfil atualizado')
    } else {
      const { data: novo, error } = await sb().from('perfis_acesso').insert({ nome: perfilForm.nome, descricao: perfilForm.descricao || null }).select().single()
      if (error || !novo) { toast.error('Erro ao criar perfil'); setPerfilSaving(false); return }
      const rows = MODULOS.map(m => ({ perfil_id: novo.id, modulo: m.key, pode_ver: perfilPerms[m.key]?.ver ?? false, pode_editar: perfilPerms[m.key]?.editar ?? false }))
      await sb().from('perfil_permissoes').insert(rows)
      setPerfis(prev => [...prev, { id: novo.id, nome: novo.nome, descricao: novo.descricao, permissoes: rows.map(r => ({ modulo: r.modulo, pode_ver: r.pode_ver, pode_editar: r.pode_editar })) }])
      toast.success('Perfil criado')
    }
    setPerfilSaving(false)
    setPerfilOpen(false)
  }

  async function handleRemoverPerfil() {
    if (!confirmRemoverPerfil) return
    setRemovendoPerfil(true)
    const { error } = await sb().from('perfis_acesso').delete().eq('id', confirmRemoverPerfil.id)
    setRemovendoPerfil(false)
    if (error) { toast.error('Erro ao remover — verifique se há usuários com este perfil'); return }
    toast.success('Perfil removido')
    setPerfis(prev => prev.filter(p => p.id !== confirmRemoverPerfil.id))
    setConfirmRemoverPerfil(null)
  }

  // ── Filtro ─────────────────────────────────────────────────────────────────
  const pendentes = usuarios.filter(u => u.status === 'pendente')
  const ativos = usuarios.filter(u => u.status !== 'pendente' && (
    !busca || u.nome.toLowerCase().includes(busca.toLowerCase())
  ))

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <>
      <Header title="Usuários" description="Gerenciar acessos e permissões" />

      <div className="flex-1 p-6 space-y-4">
        <Tabs defaultValue="usuarios">
          <TabsList className="mb-4">
            <TabsTrigger value="usuarios">
              Usuários
              {pendentes.length > 0 && (
                <span className="ml-1.5 text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full">
                  {pendentes.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="convites">
              Convites
              {convites.length > 0 && (
                <span className="ml-1.5 text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                  {convites.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="perfis">Perfis de Acesso</TabsTrigger>
            <TabsTrigger value="membros">Membros</TabsTrigger>
          </TabsList>

          {/* ── Aba Usuários ─────────────────────────────────────────────── */}
          <TabsContent value="usuarios" className="space-y-4">

            {/* Pendentes */}
            {pendentes.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-yellow-400 px-1">Aguardando aprovação</p>
                <div className="rounded-lg border border-yellow-500/20 overflow-hidden">
                  {pendentes.map(u => (
                    <div key={u.id} className="flex items-center justify-between px-4 py-3 border-b border-yellow-500/10 last:border-0 bg-yellow-500/[0.03]">
                      <div>
                        <p className="text-sm font-medium">{u.nome}</p>
                        <p className="text-xs text-muted-foreground">Cadastrado em {formatDate(u.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" className="h-7 text-xs gap-1" onClick={() => openAtivar(u)}>
                          <Check className="h-3 w-3" />
                          Ativar
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setConfirmRemover(u)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ativos/Inativos */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-8 h-8 text-sm" />
              </div>
              <Button size="sm" className="h-8 gap-1.5" onClick={openGerarLink}>
                <Link2 className="h-3.5 w-3.5" />
                Gerar Link de Convite
              </Button>
            </div>

            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">Apelido</TableHead>
                    <TableHead className="text-xs">Cargo</TableHead>
                    <TableHead className="text-xs">Perfil</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Último acesso</TableHead>
                    <TableHead className="text-xs w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ativos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground text-sm py-10">
                        Nenhum usuário encontrado
                      </TableCell>
                    </TableRow>
                  ) : ativos.map(u => (
                    <TableRow key={u.id}>
                      <TableCell className="text-sm font-medium">
                        {u.nome}
                        {u.id === currentUserId && <span className="ml-1.5 text-[10px] text-muted-foreground">(você)</span>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.cargo ?? '—'}</TableCell>
                      <TableCell>
                        {u.perfil_nome
                          ? <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">{u.perfil_nome}</span>
                          : <span className="text-xs text-muted-foreground">—</span>
                        }
                      </TableCell>
                      <TableCell><StatusBadge status={u.status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(u.ultimo_acesso)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(u)}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setConfirmRemover(u)}
                            disabled={u.id === currentUserId}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ── Aba Convites ─────────────────────────────────────────────── */}
          <TabsContent value="convites" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Links ativos aguardando uso</p>
              <Button size="sm" className="h-8 gap-1.5" onClick={openGerarLink}>
                <Link2 className="h-3.5 w-3.5" />
                Gerar Novo Link
              </Button>
            </div>

            {convites.length === 0 ? (
              <div className="rounded-lg border border-border py-10 text-center text-muted-foreground text-sm">
                Nenhum convite ativo
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                {convites.map((c, idx) => (
                  <div key={c.token} className={cn('flex items-center justify-between px-4 py-3', idx < convites.length - 1 && 'border-b border-border/60')}>
                    <div className="flex items-center gap-3">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-sm font-mono text-muted-foreground">{c.token.slice(0, 16)}…</p>
                        <p className="text-[11px] text-muted-foreground">{formatExpiry(c.expires_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost" size="sm" className="h-7 gap-1.5 text-xs"
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/convite/${c.token}`)
                          toast.success('Link copiado!')
                        }}
                      >
                        <Copy className="h-3 w-3" />
                        Copiar
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleRevogarConvite(c.token)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Aba Perfis ───────────────────────────────────────────────── */}
          <TabsContent value="perfis" className="space-y-4">
            <div className="flex justify-end">
              <Button size="sm" className="h-8 gap-1.5" onClick={openNovoPerfil}>
                <Plus className="h-3.5 w-3.5" />
                Novo Perfil
              </Button>
            </div>

            {perfis.length === 0 ? (
              <div className="rounded-lg border border-border py-10 text-center text-muted-foreground text-sm">
                Nenhum perfil criado ainda
              </div>
            ) : (
              <div className="grid gap-3">
                {perfis.map(p => {
                  const totalVer = p.permissoes.filter(pm => pm.pode_ver).length
                  const totalEditar = p.permissoes.filter(pm => pm.pode_editar).length
                  return (
                    <div key={p.id} className="rounded-lg border border-border bg-card p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
                          <Shield className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{p.nome}</p>
                          {p.descricao && <p className="text-xs text-muted-foreground">{p.descricao}</p>}
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {totalVer} módulo{totalVer !== 1 ? 's' : ''} visível{totalVer !== 1 ? 'is' : ''} · {totalEditar} com edição
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => openEditPerfil(p)}>
                          <Edit2 className="h-3 w-3" />
                          Editar
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setConfirmRemoverPerfil(p)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </TabsContent>

          {/* ── Aba Membros ──────────────────────────────────────────────── */}
          <TabsContent value="membros" className="space-y-6">

            {/* Equipe ativa */}
            {(() => {
              const ativos = membrosState.filter(m => m.membro_proprio && m.status === 'ativo')
              const inativos = membrosState.filter(m => m.membro_proprio && m.status === 'inativo')
              const fmtData = (d: string | null) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'

              return (
                <>
                  <section className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-widest text-primary/80 px-1">Equipe ativa ({ativos.length})</p>

                    {ativos.length === 0 ? (
                      <div className="rounded-lg border border-border py-8 text-center text-muted-foreground text-sm">
                        Nenhum membro da equipe ativo
                      </div>
                    ) : (
                      <div className="rounded-lg border border-border overflow-hidden">
                        <div className="grid grid-cols-[1fr_130px_130px_1fr_120px] gap-3 px-4 py-2 bg-white/[0.02] border-b border-border text-[10px] text-muted-foreground font-medium">
                          <span>Nome</span><span>Cargo</span><span>Entrada</span><span>Usuário do sistema</span><span />
                        </div>
                        {ativos.map((m, idx) => {
                          const usuarioVinculado = usuarios.find(u => u.membro_id === m.id)
                          const isLoading = vinculandoId === m.id
                          return (
                            <div key={m.id} className={cn('grid grid-cols-[1fr_130px_130px_1fr_120px] gap-3 items-center px-4 py-3', idx < ativos.length - 1 && 'border-b border-border/40')}>
                              <div>
                                <span className="text-sm font-medium">{m.nome}</span>
                                {m.vulgo && <span className="ml-1.5 text-xs text-muted-foreground">"{m.vulgo}"</span>}
                              </div>
                              <span className="text-xs text-muted-foreground">{m.cargo_faccao ?? '—'}</span>
                              <span className="text-xs text-muted-foreground">{fmtData(m.data_entrada)}</span>
                              <div>
                                {usuarioVinculado ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', usuarioVinculado.status === 'ativo' ? 'bg-green-400' : 'bg-zinc-500')} />
                                    <span className="text-sm">{usuarioVinculado.nome}</span>
                                    {usuarioVinculado.status !== 'ativo' && <span className="text-[10px] text-zinc-500">(inativo)</span>}
                                  </div>
                                ) : (
                                  <Select onValueChange={uid => handleVincularMembro(uid, m.id)}>
                                    <SelectTrigger className="h-7 text-xs w-32">
                                      <SelectValue placeholder="Vincular..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {usuarios.filter(u => u.status !== 'pendente' && !u.membro_id).map(u => (
                                        <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
                              <div className="flex justify-end gap-1">
                                {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : (
                                  <>
                                    {usuarioVinculado && (
                                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => handleVincularMembro(usuarioVinculado.id, null)} title="Desvincular usuário">
                                        <X className="h-3 w-3" />
                                      </Button>
                                    )}
                                    <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive gap-1" onClick={() => handleDesativarMembro(m)} title="Desativar membro e revogar acesso">
                                      Desativar
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </section>

                  {/* Ex-membros */}
                  {inativos.length > 0 && (
                    <section className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 px-1">Ex-membros ({inativos.length})</p>
                      <div className="rounded-lg border border-border/50 overflow-hidden">
                        <div className="grid grid-cols-[1fr_130px_130px_130px_100px] gap-3 px-4 py-2 bg-white/[0.02] border-b border-border text-[10px] text-muted-foreground font-medium">
                          <span>Nome</span><span>Cargo</span><span>Entrada</span><span>Saída</span><span />
                        </div>
                        {inativos.map((m, idx) => (
                          <div key={m.id} className={cn('grid grid-cols-[1fr_130px_130px_130px_100px] gap-3 items-center px-4 py-3 opacity-70', idx < inativos.length - 1 && 'border-b border-border/40')}>
                            <div>
                              <span className="text-sm font-medium">{m.nome}</span>
                              {m.vulgo && <span className="ml-1.5 text-xs text-muted-foreground">"{m.vulgo}"</span>}
                              {m.faccoes && (
                                <span className="ml-1.5 text-[10px] px-1 py-0.5 rounded" style={{ background: `${m.faccoes.cor_tag}20`, color: m.faccoes.cor_tag }}>
                                  {m.faccoes.nome}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">{m.cargo_faccao ?? '—'}</span>
                            <span className="text-xs text-muted-foreground">{fmtData(m.data_entrada)}</span>
                            <span className="text-xs text-muted-foreground">{fmtData(m.data_saida)}</span>
                            <div className="flex justify-end">
                              {vinculandoId === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : (
                                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => handleReativarMembro(m)}>
                                  Reativar
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )
            })()}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Modal: Gerar Link ───────────────────────────────────────────────── */}
      <Dialog open={linkOpen} onOpenChange={v => { setLinkOpen(v); if (!v) setLinkGerado(null) }}>
        <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Gerar Link de Convite</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!linkGerado ? (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Validade do link</Label>
                  <Select value={linkHoras} onValueChange={setLinkHoras}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24">24 horas</SelectItem>
                      <SelectItem value="72">3 dias</SelectItem>
                      <SelectItem value="168">7 dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  A pessoa receberá este link, escolherá um apelido e senha, e ficará pendente até você aprovar.
                </p>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">Link gerado! Copie e envie para a pessoa:</p>
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.03] border border-border">
                  <p className="text-xs font-mono text-muted-foreground flex-1 truncate">{linkGerado}</p>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={handleCopiarLink}>
                    {linkCopiado ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">Válido por {parseInt(linkHoras) < 48 ? `${linkHoras} horas` : `${parseInt(linkHoras) / 24} dias`}. Após o uso, o link expira automaticamente.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            {!linkGerado ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setLinkOpen(false)}>Cancelar</Button>
                <Button size="sm" onClick={handleGerarLink} disabled={linkSaving}>
                  {linkSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Gerar link'}
                </Button>
              </>
            ) : (
              <Button size="sm" className="w-full gap-1.5" onClick={handleCopiarLink}>
                {linkCopiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {linkCopiado ? 'Copiado!' : 'Copiar link'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Ativar Pendente ──────────────────────────────────────────── */}
      <Dialog open={!!ativarUsuario} onOpenChange={v => !v && setAtivarUsuario(null)}>
        <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Ativar — {ativarUsuario?.nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Cargo</Label>
              <Input placeholder="Ex: Vendedor, Entregador..." value={ativarForm.cargo} onChange={e => setAtivarForm(f => ({ ...f, cargo: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Perfil de Acesso</Label>
              <Select value={ativarForm.perfil_id || '_none'} onValueChange={v => setAtivarForm(f => ({ ...f, perfil_id: v === '_none' ? '' : v }))}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Selecionar perfil..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sem perfil</SelectItem>
                  {perfis.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAtivarUsuario(null)}>Cancelar</Button>
            <Button size="sm" onClick={handleAtivar} disabled={ativarSaving}>
              {ativarSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Ativar usuário'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Editar Usuário ───────────────────────────────────────────── */}
      <Dialog open={!!editUsuario} onOpenChange={v => !v && setEditUsuario(null)}>
        <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Editar — {editUsuario?.nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Apelido</Label>
              <Input value={editForm.nome} onChange={e => setEditForm(f => ({ ...f, nome: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cargo</Label>
              <Input placeholder="Ex: Vendedor, Gerente..." value={editForm.cargo} onChange={e => setEditForm(f => ({ ...f, cargo: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Perfil de Acesso</Label>
              <Select value={editForm.perfil_id || '_none'} onValueChange={v => setEditForm(f => ({ ...f, perfil_id: v === '_none' ? '' : v }))}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sem perfil</SelectItem>
                  {perfis.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between py-1">
              <Label className="text-xs">Status</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{editForm.status === 'ativo' ? 'Ativo' : 'Inativo'}</span>
                <Switch checked={editForm.status === 'ativo'} onCheckedChange={v => setEditForm(f => ({ ...f, status: v ? 'ativo' : 'inativo' }))} />
              </div>
            </div>
            <div className="space-y-2 pt-1 border-t border-border">
              <Label className="text-xs text-muted-foreground">Local de Trabalho (Meus Produtos)</Label>
              <div className="space-y-1.5">
                <Label className="text-xs">Loja de Trabalho</Label>
                <Select value={editForm.local_trabalho_loja_id || '_none'} onValueChange={v => setEditForm(f => ({ ...f, local_trabalho_loja_id: v === '_none' ? '' : v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Nenhuma..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Nenhuma</SelectItem>
                    {lojas.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Facção de Trabalho</Label>
                <Select value={editForm.local_trabalho_faccao_id || '_none'} onValueChange={v => setEditForm(f => ({ ...f, local_trabalho_faccao_id: v === '_none' ? '' : v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Nenhuma..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Nenhuma</SelectItem>
                    {faccoes.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}{f.tag ? ` [${f.tag}]` : ''}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditUsuario(null)}>Cancelar</Button>
            <Button size="sm" onClick={handleSalvarUsuario} disabled={editSaving}>
              {editSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Criar/Editar Perfil ──────────────────────────────────────── */}
      <Dialog open={perfilOpen} onOpenChange={setPerfilOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{editPerfil ? 'Editar Perfil' : 'Novo Perfil'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome do perfil *</Label>
              <Input placeholder="Ex: Admin, Vendedor..." value={perfilForm.nome} onChange={e => setPerfilForm(f => ({ ...f, nome: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descrição</Label>
              <Input placeholder="Opcional..." value={perfilForm.descricao} onChange={e => setPerfilForm(f => ({ ...f, descricao: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Permissões</Label>
                <div className="flex gap-4 text-[11px] text-muted-foreground pr-2">
                  <span className="w-12 text-center">Ver</span>
                  <span className="w-12 text-center">Editar</span>
                </div>
              </div>
              {GRUPOS.map(grupo => (
                <div key={grupo}>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 px-1">{grupo}</p>
                  <div className="rounded-lg border border-border overflow-hidden">
                    {MODULOS.filter(m => m.grupo === grupo).map((m, idx, arr) => (
                      <div key={m.key} className={cn('flex items-center justify-between px-3 py-2 hover:bg-white/[0.02]', idx < arr.length - 1 && 'border-b border-border/60')}>
                        <span className="text-sm">{m.label}</span>
                        <div className="flex gap-4">
                          {(['ver', 'editar'] as const).map(campo => (
                            <div key={campo} className="w-12 flex justify-center">
                              <button
                                onClick={() => togglePerm(m.key, campo)}
                                className={cn('h-5 w-5 rounded border transition-colors flex items-center justify-center', perfilPerms[m.key]?.[campo] ? 'bg-primary border-primary' : 'border-border hover:border-muted-foreground')}
                              >
                                {perfilPerms[m.key]?.[campo] && <Check className="h-3 w-3 text-background" />}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter className="sticky bottom-0 bg-background pt-2">
            <Button variant="outline" size="sm" onClick={() => setPerfilOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSalvarPerfil} disabled={perfilSaving}>
              {perfilSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Salvar perfil'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirms ───────────────────────────────────────────────────────── */}
      <AlertDialog open={!!confirmRemover} onOpenChange={v => !v && setConfirmRemover(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{confirmRemover?.nome}</strong> será removido permanentemente e perderá o acesso ao sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemover} disabled={removendo} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {removendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmRemoverPerfil} onOpenChange={v => !v && setConfirmRemoverPerfil(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover perfil?</AlertDialogTitle>
            <AlertDialogDescription>
              O perfil <strong>{confirmRemoverPerfil?.nome}</strong> será removido. Usuários com este perfil ficarão sem acesso configurado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoverPerfil} disabled={removendoPerfil} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {removendoPerfil ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

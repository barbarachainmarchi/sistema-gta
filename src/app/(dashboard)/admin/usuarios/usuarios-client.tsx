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
import { Plus, Search, Edit2, Trash2, Loader2, Link2, Shield, Check, Copy, Clock, X, Crown, Lock, UserPlus } from 'lucide-react'
import { cn, norm } from '@/lib/utils'

// ─── Módulos ──────────────────────────────────────────────────────────────────

const MODULOS = [
  { key: 'admin_cadastros',   label: 'Cadastros',    grupo: 'Admin' },
  { key: 'admin_usuarios',    label: 'Usuários',     grupo: 'Admin' },
  { key: 'admin_layout',      label: 'Layout',       grupo: 'Admin' },
  { key: 'admin_logs',        label: 'Logs',         grupo: 'Admin' },
  { key: 'admin_integracoes', label: 'Integrações',  grupo: 'Admin' },
  { key: 'admin_backup',      label: 'Backup',       grupo: 'Admin' },
  { key: 'admin_membros',     label: 'Membros',      grupo: 'Admin' },
  { key: 'investigacao',      label: 'Investigação', grupo: 'Investigação' },
  { key: 'vendas',            label: 'Vendas',       grupo: 'Vendas' },
  { key: 'encomendas',        label: 'Encomendas',   grupo: 'Vendas' },
  { key: 'vendas_concluidas',         label: 'Concluídas',          grupo: 'Vendas' },
  { key: 'vendas_excluir_concluida',  label: 'Excluir Concluídas',  grupo: 'Vendas' },
  { key: 'calculadora',       label: 'Calculadora',  grupo: 'Ferramentas' },
  { key: 'cotacao',           label: 'Cotação',      grupo: 'Ferramentas' },
  { key: 'metas',             label: 'Metas',        grupo: 'Interno' },
  { key: 'estoque',           label: 'Estoque',      grupo: 'Interno' },
  { key: 'acao',              label: 'Ação',         grupo: 'Interno' },
  { key: 'financeiro',        label: 'Financeiro',   grupo: 'Interno' },
]
const GRUPOS = ['Admin', 'Investigação', 'Vendas', 'Ferramentas', 'Interno']

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Usuario = {
  id: string
  email: string
  nome: string
  nome_personagem: string | null
  cargo: string | null
  perfil_id: string | null
  membro_id: string | null
  local_trabalho_loja_id: string | null
  local_trabalho_faccao_id: string | null
  trabalho_principal: 'loja' | 'faccao' | null
  perfil_nome: string | null
  status: 'ativo' | 'inativo' | 'pendente'
  created_at: string
  ultimo_acesso: string | null
  ultima_pagina: string | null
}

type LojaSimples = { id: string; nome: string }
type FaccaoSimples = { id: string; nome: string; tag: string | null }

type MembroInvestigacao = {
  id: string; nome: string; vulgo: string | null; cargo_faccao: string | null
  status: string; membro_proprio: boolean; data_entrada: string | null; data_saida: string | null
  faccao_id?: string | null
}

type Permissao = { modulo: string; pode_ver: boolean; pode_criar: boolean; pode_editar: boolean; pode_excluir: boolean }

type Perfil = {
  id: string
  nome: string
  descricao: string | null
  is_sistema: boolean
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
  isFantasma: boolean
  membros: MembroInvestigacao[]
  allMembros: { id: string; nome: string }[]
  lojas: LojaSimples[]
  faccoes: FaccaoSimples[]
  defaultLojaId: string | null
  defaultFaccaoId: string | null
  donoSecundarioId: string | null
  faccaoServidorId: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loginDisplay(email: string) { return email.split('@')[0] }

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

export function UsuariosClient({ usuarios: initialUsuarios, perfis: initialPerfis, convites: initialConvites, currentUserId, isFantasma, membros: initialMembros, allMembros, lojas, faccoes, defaultLojaId, defaultFaccaoId, donoSecundarioId: initialDonoSecundarioId, faccaoServidorId: initialFaccaoServidorId }: Props) {
  const router = useRouter()
  const sbRef = useRef<ReturnType<typeof createClient> | null>(null)
  const sb = useCallback(() => { if (!sbRef.current) sbRef.current = createClient(); return sbRef.current }, [])

  const [usuarios, setUsuarios] = useState(initialUsuarios)
  const [perfis, setPerfis] = useState(initialPerfis)
  const [convites, setConvites] = useState(initialConvites)
  const [busca, setBusca] = useState('')
  const [donoSecundarioId, setDonoSecundarioId] = useState<string | null>(initialDonoSecundarioId)
  const [salvandoDono, setSalvandoDono] = useState(false)
  const [infoUsuario, setInfoUsuario] = useState<Usuario | null>(null)
  const [novoUsuarioOpen, setNovoUsuarioOpen] = useState(false)
  const [novoUsuarioForm, setNovoUsuarioForm] = useState({ membro_id: '', apelido: '', senha: '', perfil_id: '' })
  const [novoUsuarioSaving, setNovoUsuarioSaving] = useState(false)
  const [faccaoServidor, setFaccaoServidor] = useState<string | null>(initialFaccaoServidorId)
  const [salvandoFaccaoServidor, setSalvandoFaccaoServidor] = useState(false)

  // ── Dono secundário ───────────────────────────────────────────────────────
  async function handleDefinirDono(userId: string | null) {
    setSalvandoDono(true)
    const { error } = await sb()
      .from('config_sistema')
      .upsert({ chave: 'dono_secundario_id', valor: userId ?? '' }, { onConflict: 'chave' })
    setSalvandoDono(false)
    if (error) { toast.error('Erro ao salvar dono secundário'); return }
    setDonoSecundarioId(userId)
    toast.success(userId ? 'Dono secundário definido!' : 'Dono secundário removido')
    router.refresh()
  }

  // ── Facção do Servidor ───────────────────────────────────────────────────
  async function handleDefinirFaccaoServidor(faccaoId: string | null) {
    setSalvandoFaccaoServidor(true)
    const { error } = await sb()
      .from('config_sistema')
      .upsert({ chave: 'faccao_servidor_id', valor: faccaoId ?? '' }, { onConflict: 'chave' })
    setSalvandoFaccaoServidor(false)
    if (error) { toast.error('Erro ao salvar facção do servidor'); return }
    setFaccaoServidor(faccaoId)
    toast.success(faccaoId ? 'Facção do servidor definida!' : 'Facção do servidor removida')
  }

  // ── Novo Usuário ──────────────────────────────────────────────────────────
  async function handleNovoUsuario() {
    if (!novoUsuarioForm.apelido || !novoUsuarioForm.senha) { toast.error('Apelido e senha são obrigatórios'); return }
    setNovoUsuarioSaving(true)
    const res = await fetch('/api/admin/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apelido: novoUsuarioForm.apelido,
        senha: novoUsuarioForm.senha,
        perfil_id: novoUsuarioForm.perfil_id || null,
        membro_id: novoUsuarioForm.membro_id || null,
      }),
    })
    const json = await res.json()
    setNovoUsuarioSaving(false)
    if (!res.ok) { toast.error(json.error ?? 'Erro ao criar usuário'); return }
    toast.success(`Usuário ${novoUsuarioForm.apelido} criado!`)
    setNovoUsuarioOpen(false)
    router.refresh()
  }

  // ── Membros ────────────────────────────────────────────────────────────────
  const [membrosState, setMembrosState] = useState<MembroInvestigacao[]>(initialMembros)
  const [membroLoading, setMembroLoading] = useState<string | null>(null)
  const [editMembroId, setEditMembroId] = useState<string | null>(null)
  const [editMembroForm, setEditMembroForm] = useState({ perfil_id: '', loja_id: '', faccao_id: '', trabalho_principal: '' as '' | 'loja' | 'faccao', usuario_id_vincular: '' })
  const [editMembroSaving, setEditMembroSaving] = useState(false)
  const [confirmDeleteMembro, setConfirmDeleteMembro] = useState<MembroInvestigacao | null>(null)
  const [deletandoMembro, setDeletandoMembro] = useState(false)

  async function handleDeleteMembro(modo: 'civil' | 'deletar') {
    if (!confirmDeleteMembro) return
    setDeletandoMembro(true)

    if (modo === 'civil') {
      // Mantém na investigação mas remove da equipe (sem facção)
      const { error } = await sb().from('membros').update({
        membro_proprio: false,
        faccao_id: null,
        data_saida: new Date().toISOString().slice(0, 10),
      }).eq('id', confirmDeleteMembro.id)
      setDeletandoMembro(false)
      if (error) { toast.error('Erro ao atualizar membro'); return }
      setMembrosState(prev => prev.filter(m => m.id !== confirmDeleteMembro.id))
      toast.success(`${confirmDeleteMembro.nome} mantido na investigação como civil`)
    } else {
      // Remove completamente — usuarios.membro_id é SET NULL automaticamente via FK
      const { error } = await sb().from('membros').delete().eq('id', confirmDeleteMembro.id)
      setDeletandoMembro(false)
      if (error) { toast.error('Erro ao excluir membro'); return }
      setMembrosState(prev => prev.filter(m => m.id !== confirmDeleteMembro.id))
      toast.success(`${confirmDeleteMembro.nome} removido permanentemente`)
    }

    setConfirmDeleteMembro(null)
    router.refresh()
  }

  function openEditMembro(m: MembroInvestigacao) {
    const u = usuarios.find(u => u.membro_id === m.id)
    setEditMembroId(m.id)
    setEditMembroForm({
      perfil_id: u?.perfil_id ?? '',
      loja_id: u?.local_trabalho_loja_id ?? '',
      faccao_id: u?.local_trabalho_faccao_id ?? '',
      trabalho_principal: u?.trabalho_principal ?? '',
      usuario_id_vincular: '',
    })
  }

  async function handleSalvarMembro() {
    const m = membrosState.find(m => m.id === editMembroId)
    if (!m) return
    let u = usuarios.find(u => u.membro_id === m.id)

    // Vincular conta se ainda não há usuário e foi selecionado um
    if (!u && editMembroForm.usuario_id_vincular) {
      const res = await fetch('/api/admin/usuarios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editMembroForm.usuario_id_vincular, membro_id: m.id }),
      })
      if (!res.ok) { toast.error('Erro ao vincular conta'); return }
      const usuarioVinculado = usuarios.find(us => us.id === editMembroForm.usuario_id_vincular)
      if (usuarioVinculado) {
        u = { ...usuarioVinculado, membro_id: m.id }
        setUsuarios(prev => prev.map(us => us.id === editMembroForm.usuario_id_vincular ? { ...us, membro_id: m.id } : us))
      }
    }

    if (!u) { toast.error('Selecione uma conta para vincular'); return }
    setEditMembroSaving(true)
    const lojaId = editMembroForm.loja_id || null
    const faccaoId = editMembroForm.faccao_id || null
    const res = await fetch('/api/admin/usuarios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: u.id,
        perfil_id: editMembroForm.perfil_id || null,
        local_trabalho_loja_id: lojaId,
        local_trabalho_faccao_id: faccaoId,
        trabalho_principal: lojaId && faccaoId ? (editMembroForm.trabalho_principal || null) : null,
      }),
    })
    const json = await res.json()
    if (!res.ok) { setEditMembroSaving(false); toast.error(json.error ?? 'Erro ao salvar'); return }

    // Se a facção de trabalho é a facção do servidor, auto-vincular na investigação
    if (faccaoId && faccaoId === faccaoServidor) {
      await sb().from('membros').update({ faccao_id: faccaoId }).eq('id', m.id)
      setMembrosState(prev => prev.map(mb => mb.id === m.id ? { ...mb, faccao_id: faccaoId } : mb))
    }

    setEditMembroSaving(false)
    const perfilNome = perfis.find(p => p.id === editMembroForm.perfil_id)?.nome ?? null
    setUsuarios(prev => prev.map(us => us.id === u.id ? {
      ...us,
      perfil_id: editMembroForm.perfil_id || null,
      perfil_nome: perfilNome,
      local_trabalho_loja_id: lojaId,
      local_trabalho_faccao_id: faccaoId,
      trabalho_principal: (lojaId && faccaoId ? (editMembroForm.trabalho_principal || null) : null) as 'loja' | 'faccao' | null,
    } : us))
    toast.success('Membro atualizado')
    setEditMembroId(null)
    router.refresh()
  }

  async function handleDesativarMembro(m: MembroInvestigacao) {
    setMembroLoading(m.id)
    const hoje = new Date().toISOString().slice(0, 10)
    const { error } = await sb().from('membros').update({ status: 'inativo', faccao_id: null, data_saida: hoje }).eq('id', m.id)
    if (error) { toast.error('Erro ao desativar'); setMembroLoading(null); return }
    // Remove de loja_membros
    await sb().from('loja_membros').delete().eq('membro_id', m.id)
    // Desativa e limpa local de trabalho do usuário vinculado
    const u = usuarios.find(u => u.membro_id === m.id)
    if (u) {
      await fetch('/api/admin/usuarios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: u.id, status: 'inativo', local_trabalho_loja_id: null, local_trabalho_faccao_id: null, trabalho_principal: null }),
      })
      setUsuarios(prev => prev.map(us => us.id === u.id ? { ...us, status: 'inativo', local_trabalho_loja_id: null, local_trabalho_faccao_id: null } : us))
    }
    setMembrosState(prev => prev.map(mb => mb.id === m.id ? { ...mb, status: 'inativo', faccao_id: null, data_saida: hoje } : mb))
    setMembroLoading(null)
    toast.success(`${m.nome} desativado`)
    router.refresh()
  }

  async function handleReativarMembro(m: MembroInvestigacao) {
    setMembroLoading(m.id)
    const { error } = await sb().from('membros').update({ status: 'ativo', data_saida: null }).eq('id', m.id)
    setMembroLoading(null)
    if (error) { toast.error('Erro ao reativar'); return }
    setMembrosState(prev => prev.map(mb => mb.id === m.id ? { ...mb, status: 'ativo', data_saida: null } : mb))
    toast.success(`${m.nome} reativado`)
    router.refresh()
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
  const [ativarForm, setAtivarForm] = useState({
    cargo: '', perfil_id: '',
    loja_id: '', faccao_id: '', trabalho_principal: '' as '' | 'loja' | 'faccao',
    membro_opcao: 'criar' as 'criar' | 'vincular' | 'nenhum',
    membro_id_vincular: '',
    membro_nome_criar: '',
  })
  const [ativarSaving, setAtivarSaving] = useState(false)

  function openAtivar(u: Usuario) {
    setAtivarUsuario(u)
    setAtivarForm({
      cargo: '', perfil_id: '',
      loja_id: '', faccao_id: '', trabalho_principal: '',
      membro_opcao: 'criar',
      membro_id_vincular: '',
      membro_nome_criar: u.nome_personagem ?? u.nome,
    })
  }

  async function handleAtivar() {
    if (!ativarUsuario) return
    setAtivarSaving(true)

    let membroId: string | null = ativarUsuario.membro_id

    if (ativarForm.membro_opcao === 'criar' && ativarForm.membro_nome_criar.trim()) {
      const { data: novoMembro, error } = await sb().from('membros').insert({
        nome: ativarForm.membro_nome_criar.trim(),
        status: 'ativo',
        membro_proprio: true,
      }).select('id').single()
      if (error) { toast.error('Erro ao criar membro'); setAtivarSaving(false); return }
      membroId = novoMembro.id
      setMembrosState(prev => [...prev, { id: novoMembro.id, nome: ativarForm.membro_nome_criar.trim(), vulgo: null, cargo_faccao: null, status: 'ativo', membro_proprio: true, data_entrada: null, data_saida: null }])
    } else if (ativarForm.membro_opcao === 'vincular') {
      membroId = ativarForm.membro_id_vincular || null
    } else if (ativarForm.membro_opcao === 'nenhum') {
      membroId = null
    }

    const res = await fetch('/api/admin/usuarios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: ativarUsuario.id,
        nome: ativarUsuario.nome,
        cargo: ativarForm.cargo,
        perfil_id: ativarForm.perfil_id,
        status: 'ativo',
        membro_id: membroId,
        local_trabalho_loja_id: ativarForm.loja_id || null,
        local_trabalho_faccao_id: ativarForm.faccao_id || null,
        trabalho_principal: ativarForm.trabalho_principal || null,
      }),
    })
    const json = await res.json()
    setAtivarSaving(false)
    if (!res.ok) { toast.error(json.error ?? 'Erro ao ativar'); return }
    toast.success(`${ativarUsuario.nome} ativado`)
    const perfilNome = perfis.find(p => p.id === ativarForm.perfil_id)?.nome ?? null
    setUsuarios(prev => prev.map(u =>
      u.id === ativarUsuario.id
        ? { ...u, cargo: ativarForm.cargo || null, perfil_id: ativarForm.perfil_id || null, perfil_nome: perfilNome, status: 'ativo', membro_id: membroId, local_trabalho_loja_id: ativarForm.loja_id || null, local_trabalho_faccao_id: ativarForm.faccao_id || null }
        : u
    ))
    setAtivarUsuario(null)
    router.refresh()
  }

  // ── Editar usuário ─────────────────────────────────────────────────────────
  const [editUsuario, setEditUsuario] = useState<Usuario | null>(null)
  const [editForm, setEditForm] = useState({
    nome: '', login: '', cargo: '', perfil_id: '', status: 'ativo' as 'ativo' | 'inativo',
    local_trabalho_loja_id: '',
    local_trabalho_faccao_id: '',
    trabalho_principal: '' as '' | 'loja' | 'faccao',
    nome_no_jogo: '',
    membro_id_vincular: '',
  })
  const [editSaving, setEditSaving] = useState(false)

  function openEdit(u: Usuario) {
    const membroVinculado = membrosState.find(m => m.id === u.membro_id)
    setEditUsuario(u)
    setEditForm({
      nome: u.nome, login: u.email.split('@')[0] ?? '', cargo: u.cargo ?? '', perfil_id: u.perfil_id ?? '',
      status: u.status === 'pendente' ? 'ativo' : u.status,
      local_trabalho_loja_id: u.local_trabalho_loja_id ?? defaultLojaId ?? '',
      local_trabalho_faccao_id: u.local_trabalho_faccao_id ?? defaultFaccaoId ?? '',
      trabalho_principal: u.trabalho_principal ?? '',
      nome_no_jogo: membroVinculado?.nome ?? '',
      membro_id_vincular: '',
    })
  }

  async function handleSalvarUsuario() {
    if (!editUsuario) return
    setEditSaving(true)
    const novoLojaId = editForm.local_trabalho_loja_id || null
    const novoFaccaoId = editForm.local_trabalho_faccao_id || null
    const membroIdFinal = editUsuario.membro_id ?? (editForm.membro_id_vincular || null)
    const loginAtual = editUsuario.email.split('@')[0] ?? ''
    const loginNovo = editForm.login.trim().toLowerCase()
    const body: Record<string, unknown> = {
      id: editUsuario.id,
      nome: editForm.nome, cargo: editForm.cargo, perfil_id: editForm.perfil_id, status: editForm.status,
      local_trabalho_loja_id: novoLojaId,
      local_trabalho_faccao_id: novoFaccaoId,
      trabalho_principal: editForm.trabalho_principal || null,
      membro_id: membroIdFinal,
    }
    if (loginNovo && loginNovo !== loginAtual) body.apelido = loginNovo

    const res = await fetch('/api/admin/usuarios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!res.ok) { setEditSaving(false); toast.error(json.error ?? 'Erro ao salvar'); return }

    // Atualiza nome no jogo do membro vinculado
    if (editUsuario.membro_id && editForm.nome_no_jogo.trim()) {
      await sb().from('membros').update({ nome: editForm.nome_no_jogo.trim() }).eq('id', editUsuario.membro_id)
      setMembrosState(prev => prev.map(m => m.id === editUsuario.membro_id ? { ...m, nome: editForm.nome_no_jogo.trim() } : m))
    }

    const localMudou = novoLojaId !== editUsuario.local_trabalho_loja_id || novoFaccaoId !== editUsuario.local_trabalho_faccao_id
    if (localMudou) {
      await sb().from('items').update({ eh_meu_produto: false, meu_produto_usuario_id: null }).eq('meu_produto_usuario_id', editUsuario.id)
    }

    setEditSaving(false)
    toast.success('Usuário atualizado')
    const perfilNome = perfis.find(p => p.id === editForm.perfil_id)?.nome ?? null
    const novoEmail = loginNovo && loginNovo !== loginAtual ? `${loginNovo}@gta.local` : editUsuario.email
    setUsuarios(prev => prev.map(u =>
      u.id === editUsuario.id
        ? { ...u, email: novoEmail, nome: editForm.nome, cargo: editForm.cargo || null, perfil_id: editForm.perfil_id || null, perfil_nome: perfilNome, status: editForm.status, membro_id: membroIdFinal, local_trabalho_loja_id: novoLojaId, local_trabalho_faccao_id: novoFaccaoId }
        : u
    ))
    setEditUsuario(null)
    router.refresh()
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
    router.refresh()
  }

  // ── Perfis ─────────────────────────────────────────────────────────────────
  const [perfilOpen, setPerfilOpen] = useState(false)
  const [editPerfil, setEditPerfil] = useState<Perfil | null>(null)
  const [perfilForm, setPerfilForm] = useState({ nome: '', descricao: '' })
  const [perfilPerms, setPerfilPerms] = useState<Record<string, { ver: boolean; criar: boolean; editar: boolean; excluir: boolean }>>({})
  const [perfilSaving, setPerfilSaving] = useState(false)
  const [confirmRemoverPerfil, setConfirmRemoverPerfil] = useState<Perfil | null>(null)
  const [removendoPerfil, setRemovendoPerfil] = useState(false)

  function buildPermsMap(permissoes: Permissao[]) {
    return Object.fromEntries(MODULOS.map(m => {
      const p = permissoes.find(pm => pm.modulo === m.key)
      return [m.key, { ver: p?.pode_ver ?? false, criar: p?.pode_criar ?? false, editar: p?.pode_editar ?? false, excluir: p?.pode_excluir ?? false }]
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

  function togglePerm(modulo: string, campo: 'ver' | 'criar' | 'editar' | 'excluir') {
    if (modulo.startsWith('admin_') && !podeEditarAdmin) return
    setPerfilPerms(prev => {
      const curr = prev[modulo]
      if (campo === 'ver') {
        const v = !curr.ver
        return { ...prev, [modulo]: { ver: v, criar: v ? curr.criar : false, editar: v ? curr.editar : false, excluir: v ? curr.excluir : false } }
      } else if (campo === 'criar') {
        const c = !curr.criar
        return { ...prev, [modulo]: { ver: c ? true : curr.ver, criar: c, editar: curr.editar, excluir: curr.excluir } }
      } else if (campo === 'editar') {
        const e = !curr.editar
        return { ...prev, [modulo]: { ver: e ? true : curr.ver, criar: curr.criar, editar: e, excluir: e ? curr.excluir : false } }
      } else {
        const x = !curr.excluir
        return { ...prev, [modulo]: { ver: x ? true : curr.ver, criar: curr.criar, editar: x ? true : curr.editar, excluir: x } }
      }
    })
  }

  async function handleSalvarPerfil() {
    if (!perfilForm.nome) { toast.error('Nome é obrigatório'); return }
    setPerfilSaving(true)

    const permissoes = MODULOS.map(m => ({
      modulo: m.key,
      pode_ver: perfilPerms[m.key]?.ver ?? false,
      pode_criar: perfilPerms[m.key]?.criar ?? false,
      pode_editar: perfilPerms[m.key]?.editar ?? false,
      pode_excluir: perfilPerms[m.key]?.excluir ?? false,
    }))

    const res = await fetch('/api/admin/perfis', {
      method: editPerfil ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(editPerfil ? { id: editPerfil.id } : {}),
        nome: perfilForm.nome,
        descricao: perfilForm.descricao || null,
        permissoes,
      }),
    })
    const json = await res.json()
    setPerfilSaving(false)
    if (!res.ok) { toast.error(json.error ?? 'Erro ao salvar perfil'); return }

    const permsEstado = permissoes.map(p => ({ modulo: p.modulo, pode_ver: p.pode_ver, pode_criar: p.pode_criar, pode_editar: p.pode_editar, pode_excluir: p.pode_excluir }))
    if (editPerfil) {
      setPerfis(prev => prev.map(p => p.id === editPerfil.id
        ? { ...p, nome: perfilForm.nome, descricao: perfilForm.descricao || null, permissoes: permsEstado }
        : p
      ))
      toast.success('Perfil atualizado')
    } else {
      setPerfis(prev => [...prev, { id: json.id, nome: json.nome, descricao: json.descricao, is_sistema: false, permissoes: permsEstado }])
      toast.success('Perfil criado')
    }
    setPerfilOpen(false)
    router.refresh()
  }

  async function handleRemoverPerfil() {
    if (!confirmRemoverPerfil) return
    setRemovendoPerfil(true)
    const res = await fetch('/api/admin/perfis', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: confirmRemoverPerfil.id }),
    })
    const json = await res.json()
    setRemovendoPerfil(false)
    if (!res.ok) { toast.error(json.error ?? 'Erro ao remover — verifique se há usuários com este perfil'); return }
    toast.success('Perfil removido')
    setPerfis(prev => prev.filter(p => p.id !== confirmRemoverPerfil.id))
    setConfirmRemoverPerfil(null)
    router.refresh()
  }

  // ── Permissões do usuário atual ───────────────────────────────────────────
  const currentUserPerfilNome = usuarios.find(u => u.id === currentUserId)?.perfil_nome ?? null
  const isDono = currentUserPerfilNome === 'Dono'
  const isDonoSecundario = currentUserId === donoSecundarioId
  const podeEditarAdmin = isFantasma || isDonoSecundario

  // ── Filtro ─────────────────────────────────────────────────────────────────
  const pendentes = usuarios.filter(u => u.status === 'pendente')
  const ativos = usuarios.filter(u => u.status !== 'pendente' && (
    !busca || norm(u.nome).includes(norm(busca))
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

            {/* Dono Fantasma — só visível para barbarachainmarchi */}
            {isFantasma && (
              <div className="flex items-center gap-3 p-3 rounded-lg border border-orange-500/20 bg-orange-500/[0.03]">
                <div className="h-8 w-8 rounded flex items-center justify-center bg-orange-500/10 shrink-0">
                  <Crown className="h-4 w-4 text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-orange-400">Dono Fantasma</p>
                  <p className="text-[11px] text-muted-foreground">
                    {donoSecundarioId
                      ? `${usuarios.find(u => u.id === donoSecundarioId)?.nome ?? '—'} tem acesso total igual a você, mas aparece normal para os outros.`
                      : 'Nenhum. Selecione um usuário para dar acesso total invisível.'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Select
                    value={donoSecundarioId || '_none'}
                    onValueChange={v => handleDefinirDono(v === '_none' ? null : v)}
                    disabled={salvandoDono}
                  >
                    <SelectTrigger className="h-7 text-xs w-44">
                      <SelectValue placeholder="Nenhum..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Nenhum</SelectItem>
                      {usuarios.filter(u => u.status !== 'pendente' && u.id !== currentUserId).map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Ativos/Inativos */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-8 h-8 text-sm" />
              </div>
              <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={openGerarLink}>
                <Link2 className="h-3.5 w-3.5" />
                Gerar Convite
              </Button>
              <Button size="sm" className="h-8 gap-1.5" onClick={() => { setNovoUsuarioForm({ membro_id: '', apelido: '', senha: '', perfil_id: '' }); setNovoUsuarioOpen(true) }}>
                <UserPlus className="h-3.5 w-3.5" />
                Novo Usuário
              </Button>
            </div>

            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">Usuário</TableHead>
                    <TableHead className="text-xs">Local</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    {(isFantasma || isDonoSecundario) && <TableHead className="text-xs">Último acesso</TableHead>}
                    <TableHead className="text-xs w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ativos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground text-sm py-10">
                        Nenhum usuário encontrado
                      </TableCell>
                    </TableRow>
                  ) : ativos.map(u => (
                    <TableRow key={u.id} className="cursor-pointer" onClick={() => setInfoUsuario(u)}>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium">{u.nome}</span>
                            {u.id === currentUserId && <span className="text-[10px] text-muted-foreground">(você)</span>}
                            {u.perfil_nome && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{u.perfil_nome}</span>}
                            {isFantasma && u.id === donoSecundarioId && (
                              <span className="text-[10px] bg-orange-500/10 text-orange-400 px-1.5 py-0.5 rounded font-medium">Dono 2</span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground font-mono">{loginDisplay(u.email)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 flex-wrap">
                          {u.local_trabalho_loja_id && <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded">{lojas.find(l => l.id === u.local_trabalho_loja_id)?.nome ?? 'Loja'}</span>}
                          {u.local_trabalho_faccao_id && <span className="text-[10px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded">{faccoes.find(f => f.id === u.local_trabalho_faccao_id)?.nome ?? 'Facção'}</span>}
                          {!u.local_trabalho_loja_id && !u.local_trabalho_faccao_id && <span className="text-xs text-muted-foreground">—</span>}
                        </div>
                      </TableCell>
                      <TableCell><StatusBadge status={u.status} /></TableCell>
                      {(isFantasma || isDonoSecundario) && (
                        <TableCell className="text-xs text-muted-foreground">
                          <div>{formatDate(u.ultimo_acesso)}</div>
                          {u.ultima_pagina && (
                            <div className="font-mono text-[10px] opacity-60 truncate max-w-[140px]" title={u.ultima_pagina}>
                              {u.ultima_pagina}
                            </div>
                          )}
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          {isFantasma && (
                            <Button
                              variant="ghost" size="icon" className={cn('h-7 w-7', u.id === donoSecundarioId ? 'text-yellow-400 hover:text-yellow-300' : 'text-muted-foreground hover:text-yellow-400')}
                              onClick={() => handleDefinirDono(u.id === donoSecundarioId ? null : u.id)}
                              disabled={salvandoDono}
                            >
                              <Crown className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setConfirmRemover(u)}
                            disabled={u.id === currentUserId || (!isFantasma && u.id === donoSecundarioId)}
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
                  const totalExcluir = p.permissoes.filter(pm => pm.pode_excluir).length
                  return (
                    <div key={p.id} className={cn('rounded-lg border bg-card p-4 flex items-center justify-between gap-4', p.is_sistema ? 'border-yellow-500/30' : 'border-border')}>
                      <div className="flex items-center gap-3">
                        <div className={cn('h-8 w-8 rounded flex items-center justify-center shrink-0', p.is_sistema ? 'bg-yellow-500/10' : 'bg-primary/10')}>
                          {p.is_sistema
                            ? <Lock className="h-4 w-4 text-yellow-400" />
                            : <Shield className="h-4 w-4 text-primary" />
                          }
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium">{p.nome}</p>
                            {p.is_sistema && (
                              <span className="text-[10px] bg-yellow-500/10 text-yellow-400 px-1.5 py-0.5 rounded font-medium">Sistema</span>
                            )}
                          </div>
                          {p.descricao && <p className="text-xs text-muted-foreground">{p.descricao}</p>}
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {totalVer} visível{totalVer !== 1 ? 'is' : ''} · {totalEditar} com edição · {totalExcluir} com exclusão
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!p.is_sistema && (
                          <>
                            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => openEditPerfil(p)}>
                              <Edit2 className="h-3 w-3" />
                              Editar
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setConfirmRemoverPerfil(p)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </TabsContent>

          {/* ── Aba Membros ──────────────────────────────────────────────── */}
          <TabsContent value="membros" className="space-y-6">
            {(() => {
              const ativos  = membrosState.filter(m => m.membro_proprio && m.status === 'ativo')
              const inativos = membrosState.filter(m => m.membro_proprio && m.status === 'inativo')
              const fmtData = (d: string | null) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'
              const faccaoServidorNome = faccaoServidor ? faccoes.find(f => f.id === faccaoServidor)?.nome : null
              return (
                <>
                  {/* Config: Facção do servidor */}
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
                    <div className="flex-1 space-y-0.5">
                      <p className="text-xs font-medium">Facção do Servidor</p>
                      <p className="text-[11px] text-muted-foreground">Ao salvar um membro com esta facção como trabalho, ele é automaticamente vinculado na investigação.</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {faccaoServidorNome && (
                        <span className="text-[10px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded">{faccaoServidorNome}</span>
                      )}
                      {(isFantasma || isDonoSecundario) ? (
                        <Select
                          value={faccaoServidor || '_none'}
                          onValueChange={v => handleDefinirFaccaoServidor(v === '_none' ? null : v)}
                        >
                          <SelectTrigger className="h-7 text-xs w-32" disabled={salvandoFaccaoServidor}>
                            <SelectValue placeholder="Nenhuma..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">Nenhuma</SelectItem>
                            {faccoes.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}{f.tag ? ` [${f.tag}]` : ''}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">{faccaoServidorNome ?? 'Não definida'}</span>
                      )}
                    </div>
                  </div>

                  <section className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-widest text-primary/80 px-1">Equipe ativa ({ativos.length})</p>
                    {ativos.length === 0 ? (
                      <div className="rounded-lg border border-border py-8 text-center text-muted-foreground text-sm">Nenhum membro ativo</div>
                    ) : (
                      <div className="rounded-lg border border-border overflow-hidden">
                        <div className="grid grid-cols-[1fr_120px_110px_1fr_100px] gap-3 px-4 py-2 bg-white/[0.02] border-b border-border text-[10px] text-muted-foreground font-medium">
                          <span>Nome</span><span>Cargo</span><span>Entrada</span><span>Usuário / Perfil / Local</span><span />
                        </div>
                        {ativos.map((m, idx) => {
                          const u = usuarios.find(u => u.membro_id === m.id)
                          return (
                            <div key={m.id} className={cn('grid grid-cols-[1fr_120px_110px_1fr_100px] gap-3 items-start px-4 py-3', idx < ativos.length - 1 && 'border-b border-border/40')}>
                              <div>
                                <span className="text-sm font-medium">{m.nome}</span>
                                {m.vulgo && <span className="ml-1.5 text-xs text-muted-foreground">"{m.vulgo}"</span>}
                                {faccaoServidor && m.faccao_id === faccaoServidor && (
                                  <span className="ml-1.5 text-[10px] bg-purple-500/10 text-purple-400 px-1 rounded">servidor</span>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground pt-0.5">{m.cargo_faccao ?? '—'}</span>
                              <span className="text-xs text-muted-foreground pt-0.5">{fmtData(m.data_entrada)}</span>
                              <div className="space-y-0.5">
                                {u ? (
                                  <>
                                    <div className="flex items-center gap-1.5">
                                      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', u.status === 'ativo' ? 'bg-green-400' : 'bg-zinc-500')} />
                                      <span className="text-sm">{u.nome}</span>
                                    </div>
                                    <div className="flex items-center gap-1 flex-wrap pl-3">
                                      {u.perfil_nome && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{u.perfil_nome}</span>}
                                      {u.local_trabalho_loja_id && <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded">{lojas.find(l => l.id === u.local_trabalho_loja_id)?.nome ?? 'Loja'}</span>}
                                      {u.local_trabalho_faccao_id && <span className="text-[10px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded">{faccoes.find(f => f.id === u.local_trabalho_faccao_id)?.nome ?? 'Facção'}</span>}
                                    </div>
                                  </>
                                ) : <span className="text-xs text-muted-foreground">Sem usuário vinculado</span>}
                              </div>
                              <div className="flex justify-end items-start gap-1">
                                {membroLoading === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground mt-1" /> : (
                                  <>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditMembro(m)}>
                                      <Edit2 className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => handleDesativarMembro(m)}>
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

                  {inativos.length > 0 && (
                    <section className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 px-1">Ex-membros ({inativos.length})</p>
                      <div className="rounded-lg border border-border/50 overflow-hidden">
                        <div className="grid grid-cols-[1fr_120px_110px_110px_100px] gap-3 px-4 py-2 bg-white/[0.02] border-b border-border text-[10px] text-muted-foreground font-medium">
                          <span>Nome</span><span>Cargo</span><span>Entrada</span><span>Saída</span><span />
                        </div>
                        {inativos.map((m, idx) => (
                          <div key={m.id} className={cn('grid grid-cols-[1fr_120px_110px_110px_auto] gap-3 items-center px-4 py-3 opacity-70', idx < inativos.length - 1 && 'border-b border-border/40')}>
                            <div>
                              <span className="text-sm font-medium">{m.nome}</span>
                              {m.vulgo && <span className="ml-1.5 text-xs text-muted-foreground">"{m.vulgo}"</span>}
                            </div>
                            <span className="text-xs text-muted-foreground">{m.cargo_faccao ?? '—'}</span>
                            <span className="text-xs text-muted-foreground">{fmtData(m.data_entrada)}</span>
                            <span className="text-xs text-muted-foreground">{fmtData(m.data_saida)}</span>
                            <div className="flex justify-end gap-1">
                              {membroLoading === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : (
                                <>
                                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleReativarMembro(m)}>Reativar</Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setConfirmDeleteMembro(m)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </>
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

      {/* ── Modal: Editar Membro ──────────────────────────────────────────── */}
      {(() => {
        const m = membrosState.find(m => m.id === editMembroId)
        const temDois = !!editMembroForm.loja_id && !!editMembroForm.faccao_id
        return (
          <Dialog open={!!editMembroId} onOpenChange={v => !v && setEditMembroId(null)}>
            <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
              <DialogHeader>
                <DialogTitle>
                  {m?.nome}
                  {m?.vulgo && <span className="ml-1.5 text-sm font-normal text-muted-foreground">"{m.vulgo}"</span>}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                {(() => {
                  const mAtual = membrosState.find(m => m.id === editMembroId)
                  const uAtual = mAtual ? usuarios.find(u => u.membro_id === mAtual.id) : null
                  const usuariosLivres = usuarios.filter(u => !u.membro_id)
                  if (!uAtual) return (
                    <div className="space-y-1.5 pb-3 border-b border-border">
                      <Label className="text-xs font-semibold">Vincular conta de usuário</Label>
                      <Select value={editMembroForm.usuario_id_vincular || '_none'} onValueChange={v => setEditMembroForm(f => ({ ...f, usuario_id_vincular: v === '_none' ? '' : v }))}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecionar conta..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">— sem vínculo —</SelectItem>
                          {usuariosLivres.map(u => <SelectItem key={u.id} value={u.id}>{u.nome} ({u.email.split('@')[0]})</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {usuariosLivres.length === 0 && (
                        <p className="text-[11px] text-muted-foreground">Nenhuma conta livre. Crie um novo usuário na aba Usuários.</p>
                      )}
                    </div>
                  )
                  return null
                })()}
                <div className="space-y-1.5">
                  <Label className="text-xs">Perfil de acesso</Label>
                  <Select value={editMembroForm.perfil_id || '_none'} onValueChange={v => setEditMembroForm(f => ({ ...f, perfil_id: v === '_none' ? '' : v }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Sem perfil..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Sem perfil</SelectItem>
                      {perfis.filter(p => !p.is_sistema).map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="pt-1 border-t border-border space-y-3">
                  <p className="text-xs text-muted-foreground">Local de trabalho</p>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Loja</Label>
                    <Select value={editMembroForm.loja_id || '_none'} onValueChange={v => setEditMembroForm(f => ({ ...f, loja_id: v === '_none' ? '' : v }))}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Nenhuma..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Nenhuma</SelectItem>
                        {lojas.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Facção</Label>
                    <Select value={editMembroForm.faccao_id || '_none'} onValueChange={v => setEditMembroForm(f => ({ ...f, faccao_id: v === '_none' ? '' : v }))}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Nenhuma..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Nenhuma</SelectItem>
                        {faccoes.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}{f.tag ? ` [${f.tag}]` : ''}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {temDois && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Trabalho principal</Label>
                      <Select value={editMembroForm.trabalho_principal || '_none'} onValueChange={v => setEditMembroForm(f => ({ ...f, trabalho_principal: v === '_none' ? '' : v as 'loja' | 'faccao' }))}>
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
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setEditMembroId(null)}>Cancelar</Button>
                <Button size="sm" onClick={handleSalvarMembro} disabled={editMembroSaving}>
                  {editMembroSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Salvar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )
      })()}

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
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Aceitar — {ativarUsuario?.nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">

            {/* Vínculo de membro */}
            <div className="space-y-2 pb-3 border-b border-border">
              <Label className="text-xs font-semibold">Membro na investigação</Label>
              {ativarUsuario?.nome_personagem && (
                <p className="text-xs text-muted-foreground">Nome informado no cadastro: <span className="text-foreground font-medium">{ativarUsuario.nome_personagem}</span></p>
              )}
              <div className="grid grid-cols-3 gap-1.5">
                {ativarUsuario?.nome_personagem && (
                  <button
                    type="button"
                    onClick={() => setAtivarForm(f => ({ ...f, membro_opcao: 'criar', membro_nome_criar: ativarUsuario.nome_personagem ?? '' }))}
                    className={cn('text-xs px-2 py-1.5 rounded border transition-colors', ativarForm.membro_opcao === 'criar' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/50')}
                  >
                    Criar novo
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setAtivarForm(f => ({ ...f, membro_opcao: 'vincular' }))}
                  className={cn('text-xs px-2 py-1.5 rounded border transition-colors', ativarForm.membro_opcao === 'vincular' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/50')}
                >
                  Vincular existente
                </button>
                <button
                  type="button"
                  onClick={() => setAtivarForm(f => ({ ...f, membro_opcao: 'nenhum' }))}
                  className={cn('text-xs px-2 py-1.5 rounded border transition-colors', ativarForm.membro_opcao === 'nenhum' ? 'border-border bg-white/5 text-muted-foreground' : 'border-border text-muted-foreground hover:border-primary/50')}
                >
                  Sem vínculo
                </button>
              </div>

              {ativarForm.membro_opcao === 'criar' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome do membro</Label>
                  <Input value={ativarForm.membro_nome_criar} onChange={e => setAtivarForm(f => ({ ...f, membro_nome_criar: e.target.value }))} placeholder="Nome no jogo..." className="h-8 text-sm" />
                </div>
              )}
              {ativarForm.membro_opcao === 'vincular' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Selecionar membro existente</Label>
                  <Select value={ativarForm.membro_id_vincular || '_none'} onValueChange={v => setAtivarForm(f => ({ ...f, membro_id_vincular: v === '_none' ? '' : v }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— selecionar —</SelectItem>
                      {membrosState.filter(m => m.status === 'ativo').map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.nome}{m.vulgo ? ` "${m.vulgo}"` : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Cargo e Perfil */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Cargo</Label>
                <Input placeholder="Vendedor..." value={ativarForm.cargo} onChange={e => setAtivarForm(f => ({ ...f, cargo: e.target.value }))} className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Perfil de acesso</Label>
                <Select value={ativarForm.perfil_id || '_none'} onValueChange={v => setAtivarForm(f => ({ ...f, perfil_id: v === '_none' ? '' : v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Sem perfil..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Sem perfil</SelectItem>
                    {perfis.filter(p => !p.is_sistema).map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Local de trabalho */}
            <div className="space-y-2 pt-1 border-t border-border">
              <Label className="text-xs text-muted-foreground">Local de trabalho</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Loja</Label>
                  <Select value={ativarForm.loja_id || '_none'} onValueChange={v => setAtivarForm(f => ({ ...f, loja_id: v === '_none' ? '' : v }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Nenhuma..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Nenhuma</SelectItem>
                      {lojas.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Facção</Label>
                  <Select value={ativarForm.faccao_id || '_none'} onValueChange={v => setAtivarForm(f => ({ ...f, faccao_id: v === '_none' ? '' : v }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Nenhuma..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Nenhuma</SelectItem>
                      {faccoes.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}{f.tag ? ` [${f.tag}]` : ''}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {ativarForm.loja_id && ativarForm.faccao_id && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Trabalho principal</Label>
                  <Select value={ativarForm.trabalho_principal || '_none'} onValueChange={v => setAtivarForm(f => ({ ...f, trabalho_principal: v === '_none' ? '' : v as 'loja' | 'faccao' }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Não definido..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Não definido</SelectItem>
                      <SelectItem value="faccao">Facção</SelectItem>
                      <SelectItem value="loja">Loja</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
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
              <Label className="text-xs">Login <span className="text-muted-foreground font-normal">(para entrar no sistema)</span></Label>
              <Input
                value={editForm.login}
                onChange={e => setEditForm(f => ({ ...f, login: e.target.value.toLowerCase().replace(/\s/g, '') }))}
                className="h-8 text-sm font-mono"
                placeholder="ex: babi"
              />
              <p className="text-[11px] text-muted-foreground">Usado na tela de login. Sem espaços, sem @.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Apelido <span className="text-muted-foreground font-normal">(nome exibido no sistema)</span></Label>
              <Input value={editForm.nome} onChange={e => setEditForm(f => ({ ...f, nome: e.target.value }))} className="h-8 text-sm" />
            </div>
            {editUsuario?.membro_id ? (
              <div className="space-y-1.5">
                <Label className="text-xs">Nome no jogo</Label>
                <Input placeholder="Nome do personagem..." value={editForm.nome_no_jogo} onChange={e => setEditForm(f => ({ ...f, nome_no_jogo: e.target.value }))} className="h-8 text-sm" />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs">Vincular ao membro</Label>
                <Select value={editForm.membro_id_vincular || '_none'} onValueChange={v => setEditForm(f => ({ ...f, membro_id_vincular: v === '_none' ? '' : v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Sem vínculo..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Sem vínculo</SelectItem>
                    {allMembros.filter(m => !usuarios.some(u => u.membro_id === m.id)).map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Cargo</Label>
              <Input placeholder="Ex: Vendedor, Gerente..." value={editForm.cargo} onChange={e => setEditForm(f => ({ ...f, cargo: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Perfil de Acesso</Label>
              <Select
                value={editForm.perfil_id || '_none'}
                onValueChange={v => setEditForm(f => ({ ...f, perfil_id: v === '_none' ? '' : v }))}
                disabled={!isFantasma && editUsuario?.id === donoSecundarioId}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sem perfil</SelectItem>
                  {perfis.filter(p => !p.is_sistema).map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              {!isFantasma && editUsuario?.id === donoSecundarioId && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Lock className="h-3 w-3" />Somente o dono principal pode alterar este perfil</p>
              )}
            </div>
            <div className="flex items-center justify-between py-1">
              <Label className="text-xs">Status</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{editForm.status === 'ativo' ? 'Ativo' : 'Inativo'}</span>
                <Switch checked={editForm.status === 'ativo'} onCheckedChange={v => setEditForm(f => ({ ...f, status: v ? 'ativo' : 'inativo' }))} />
              </div>
            </div>
            <div className="space-y-2 pt-1 border-t border-border">
              <Label className="text-xs text-muted-foreground">Local de Trabalho</Label>
              <div className="space-y-1.5">
                <Label className="text-xs">Loja</Label>
                <Select value={editForm.local_trabalho_loja_id || '_none'} onValueChange={v => setEditForm(f => ({ ...f, local_trabalho_loja_id: v === '_none' ? '' : v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Nenhuma..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Nenhuma</SelectItem>
                    {lojas.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Facção</Label>
                <Select value={editForm.local_trabalho_faccao_id || '_none'} onValueChange={v => setEditForm(f => ({ ...f, local_trabalho_faccao_id: v === '_none' ? '' : v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Nenhuma..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Nenhuma</SelectItem>
                    {faccoes.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}{f.tag ? ` [${f.tag}]` : ''}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {editForm.local_trabalho_loja_id && editForm.local_trabalho_faccao_id && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Trabalho principal</Label>
                  <Select value={editForm.trabalho_principal || '_none'} onValueChange={v => setEditForm(f => ({ ...f, trabalho_principal: v === '_none' ? '' : v as 'loja' | 'faccao' }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Não definido..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Não definido</SelectItem>
                      <SelectItem value="faccao">Facção</SelectItem>
                      <SelectItem value="loja">Loja</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
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
                  <span className="w-12 text-center">Criar</span>
                  <span className="w-12 text-center">Editar</span>
                  <span className="w-12 text-center">Excluir</span>
                </div>
              </div>
              {GRUPOS.map(grupo => {
                const isAdminGrupo = grupo === 'Admin'
                const locked = isAdminGrupo && !podeEditarAdmin
                return (
                  <div key={grupo}>
                    <div className="flex items-center gap-1.5 mb-1.5 px-1">
                      <p className={cn('text-[10px] font-semibold uppercase tracking-widest', locked ? 'text-muted-foreground/50' : 'text-muted-foreground')}>{grupo}</p>
                      {locked && <Lock className="h-3 w-3 text-muted-foreground/50" />}
                    </div>
                    <div className={cn('rounded-lg border border-border overflow-hidden', locked && 'opacity-50 pointer-events-none')}>
                      {MODULOS.filter(m => m.grupo === grupo).map((m, idx, arr) => (
                        <div key={m.key} className={cn('flex items-center justify-between px-3 py-2 hover:bg-white/[0.02]', idx < arr.length - 1 && 'border-b border-border/60')}>
                          <span className="text-sm">{m.label}</span>
                          <div className="flex gap-4">
                            {(['ver', 'criar', 'editar', 'excluir'] as const).map(campo => (
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
                )
              })}
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

      {/* ── Modal: Info Usuário ────────────────────────────────────────────── */}
      <Dialog open={!!infoUsuario} onOpenChange={v => !v && setInfoUsuario(null)}>
        <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {infoUsuario?.nome}
              {infoUsuario?.id === currentUserId && <span className="text-xs font-normal text-muted-foreground">(você)</span>}
            </DialogTitle>
          </DialogHeader>
          {infoUsuario && (
            <div className="space-y-3 py-1">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Login</span>
                  <span className="text-xs font-mono">{loginDisplay(infoUsuario.email)}</span>
                </div>
                {infoUsuario.cargo && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Cargo</span>
                    <span className="text-xs">{infoUsuario.cargo}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Perfil</span>
                  {infoUsuario.perfil_nome
                    ? <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">{infoUsuario.perfil_nome}</span>
                    : <span className="text-xs text-muted-foreground">—</span>
                  }
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Local</span>
                  <div className="flex items-center gap-1">
                    {infoUsuario.local_trabalho_loja_id && <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded">{lojas.find(l => l.id === infoUsuario.local_trabalho_loja_id)?.nome ?? 'Loja'}</span>}
                    {infoUsuario.local_trabalho_faccao_id && <span className="text-[10px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded">{faccoes.find(f => f.id === infoUsuario.local_trabalho_faccao_id)?.nome ?? 'Facção'}</span>}
                    {!infoUsuario.local_trabalho_loja_id && !infoUsuario.local_trabalho_faccao_id && <span className="text-xs text-muted-foreground">—</span>}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Status</span>
                  <StatusBadge status={infoUsuario.status} />
                </div>
                {(isFantasma || isDonoSecundario) && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground shrink-0">Último acesso</span>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">{formatDate(infoUsuario.ultimo_acesso)}</div>
                    {infoUsuario.ultima_pagina && (
                      <div className="font-mono text-[10px] text-muted-foreground/50 truncate max-w-[160px]" title={infoUsuario.ultima_pagina}>
                        {infoUsuario.ultima_pagina}
                      </div>
                    )}
                  </div>
                </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Cadastrado em</span>
                  <span className="text-xs text-muted-foreground">{formatDate(infoUsuario.created_at)}</span>
                </div>
              </div>
              {infoUsuario.id !== currentUserId && (
                <div className="flex items-center gap-2 pt-2 border-t border-border">
                  <Button
                    variant="outline" size="sm" className="flex-1 h-8 text-xs gap-1.5"
                    onClick={() => { openEdit(infoUsuario); setInfoUsuario(null) }}
                  >
                    <Edit2 className="h-3 w-3" />
                    Editar
                  </Button>
                  <Button
                    variant="outline" size="sm" className="flex-1 h-8 text-xs"
                    onClick={async () => {
                      const novoStatus = infoUsuario.status === 'ativo' ? 'inativo' : 'ativo'
                      const res = await fetch('/api/admin/usuarios', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: infoUsuario.id, status: novoStatus }),
                      })
                      if (res.ok) {
                        setUsuarios(prev => prev.map(u => u.id === infoUsuario.id ? { ...u, status: novoStatus } : u))
                        setInfoUsuario(prev => prev ? { ...prev, status: novoStatus } : null)
                        toast.success(novoStatus === 'ativo' ? 'Usuário ativado' : 'Usuário desativado')
                      }
                    }}
                  >
                    {infoUsuario.status === 'ativo' ? 'Desativar' : 'Ativar'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Modal: Novo Usuário ─────────────────────────────────────────────── */}
      <Dialog open={novoUsuarioOpen} onOpenChange={setNovoUsuarioOpen}>
        <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Vincular a Pessoa (Investigação)</Label>
              <Select
                value={novoUsuarioForm.membro_id || '_none'}
                onValueChange={v => {
                  const membro = membrosState.find(m => m.id === v)
                  setNovoUsuarioForm(f => ({
                    ...f,
                    membro_id: v === '_none' ? '' : v,
                    apelido: membro ? (membro.vulgo ?? membro.nome) : f.apelido,
                  }))
                }}
              >
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Sem vínculo..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sem vínculo</SelectItem>
                  {membrosState
                    .filter(m => m.membro_proprio && !usuarios.some(u => u.membro_id === m.id))
                    .map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nome}{m.vulgo ? ` "${m.vulgo}"` : ''}
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Apelido / Login *</Label>
              <Input
                placeholder="sem espaços..."
                value={novoUsuarioForm.apelido}
                onChange={e => setNovoUsuarioForm(f => ({ ...f, apelido: e.target.value.replace(/\s/g, '') }))}
                className="h-8 text-sm font-mono"
              />
              {novoUsuarioForm.apelido && (
                <p className="text-[11px] text-muted-foreground">Login: {novoUsuarioForm.apelido}@gta.local</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Senha *</Label>
              <Input
                type="password"
                placeholder="Mínimo 6 caracteres..."
                value={novoUsuarioForm.senha}
                onChange={e => setNovoUsuarioForm(f => ({ ...f, senha: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Perfil de Acesso</Label>
              <Select value={novoUsuarioForm.perfil_id || '_none'} onValueChange={v => setNovoUsuarioForm(f => ({ ...f, perfil_id: v === '_none' ? '' : v }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Sem perfil..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sem perfil</SelectItem>
                  {perfis.filter(p => !p.is_sistema).map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setNovoUsuarioOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleNovoUsuario} disabled={novoUsuarioSaving}>
              {novoUsuarioSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Criar usuário'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      <AlertDialog open={!!confirmDeleteMembro} onOpenChange={v => !v && setConfirmDeleteMembro(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>O que fazer com {confirmDeleteMembro?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta pessoa já foi da facção. Como deseja tratá-la na investigação?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogCancel disabled={deletandoMembro}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletandoMembro}
              className="bg-zinc-700 hover:bg-zinc-600 text-white"
              onClick={() => handleDeleteMembro('civil')}
            >
              {deletandoMembro ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Deixar como civil'}
            </AlertDialogAction>
            <AlertDialogAction
              disabled={deletandoMembro}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => handleDeleteMembro('deletar')}
            >
              {deletandoMembro ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Excluir da investigação'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

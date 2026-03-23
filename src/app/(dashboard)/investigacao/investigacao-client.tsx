'use client'

import { useState, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Plus, Search, Edit2, Trash2, Loader2, Users, Car, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FaccaoDetalhe, type Faccao, type Membro, type Veiculo, type FaccaoPreco, type Produto } from './faccao-detalhe'
import { LojaDetalhe } from './loja-detalhe'

type Loja = { id: string; nome: string; localizacao: string | null; tipo: string | null; status: 'ativo' | 'inativo' }

const FACTION_COLORS = [
  '#6366f1','#8b5cf6','#a855f7','#ec4899',
  '#ef4444','#f97316','#eab308','#22c55e',
  '#10b981','#06b6d4','#3b82f6','#6b7280',
]

const emptyFaccaoForm: { nome: string; sigla: string; descricao: string; territorio: string; cor_tag: string; status: 'ativo' | 'inativo' } = { nome: '', sigla: '', descricao: '', territorio: '', cor_tag: '#6366f1', status: 'ativo' }
const emptyMembroForm: { nome: string; vulgo: string; telefone: string; faccao_id: string; status: 'ativo' | 'inativo'; observacoes: string } = { nome: '', vulgo: '', telefone: '', faccao_id: 'sem', status: 'ativo', observacoes: '' }
const emptyVeiculoForm: { placa: string; modelo: string; cor: string; proprietario_tipo: 'membro' | 'faccao' | 'desconhecido'; proprietario_id: string; observacoes: string } = { placa: '', modelo: '', cor: '', proprietario_tipo: 'desconhecido', proprietario_id: '', observacoes: '' }
const emptyLojaForm: { nome: string; localizacao: string; tipo: string; status: 'ativo' | 'inativo' } = { nome: '', localizacao: '', tipo: '', status: 'ativo' }

interface Props {
  initialFaccoes: Faccao[]
  initialMembros: Membro[]
  initialVeiculos: Veiculo[]
  initialLojas: Loja[]
  todosProdutos: Produto[]
  initialFaccaoPrecos: FaccaoPreco[]
}

function StatusBadge({ status }: { status: 'ativo' | 'inativo' }) {
  return (
    <span className={cn('text-[11px] px-1.5 py-0.5 rounded inline-flex items-center gap-1',
      status === 'ativo' ? 'bg-green-500/10 text-green-400' : 'bg-zinc-500/10 text-zinc-500')}>
      <span className={cn('h-1 w-1 rounded-full', status === 'ativo' ? 'bg-green-400' : 'bg-zinc-500')} />
      {status === 'ativo' ? 'Ativo' : 'Inativo'}
    </span>
  )
}

export function InvestigacaoClient({ initialFaccoes, initialMembros, initialVeiculos, initialLojas, todosProdutos, initialFaccaoPrecos }: Props) {
  const sbRef = useRef<ReturnType<typeof createClient> | null>(null)
  const sb = useCallback(() => { if (!sbRef.current) sbRef.current = createClient(); return sbRef.current }, [])

  const [faccoes, setFaccoes] = useState(initialFaccoes)
  const [membros, setMembros] = useState(initialMembros)
  const [veiculos, setVeiculos] = useState(initialVeiculos)
  const [lojas, setLojas] = useState(initialLojas)
  const [faccaoPrecos, setFaccaoPrecos] = useState(initialFaccaoPrecos)

  const [activeTab, setActiveTab] = useState('faccoes')

  // ── Facção detalhe ─────────────────────────────────────────────────────────
  const [detalhe, setDetalhe] = useState<Faccao | null>(null)
  function abrirDetalhe(f: Faccao) { setDetalhe(f) }

  // ── Loja detalhe ───────────────────────────────────────────────────────────
  const [detalheLoja, setDetalheLoja] = useState<Loja | null>(null)

  // ── Busca por produto nas lojas ────────────────────────────────────────────
  const [modoBuscaProduto, setModoBuscaProduto] = useState(false)
  const [buscaProduto, setBuscaProduto] = useState('')
  const [resultadosBusca, setResultadosBusca] = useState<{ loja_id: string; loja_nome: string; item_nome: string; preco: number }[]>([])
  const [buscando, setBuscando] = useState(false)

  async function buscarProdutoNasLojas(termo: string) {
    if (!termo.trim()) { setResultadosBusca([]); return }
    setBuscando(true)
    const { data } = await sb()
      .from('loja_item_precos')
      .select('preco, lojas(id, nome), items(nome)')
      .order('preco')
    setBuscando(false)
    if (!data) return
    const termo_lower = termo.toLowerCase()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filtrado = (data as any[])
      .filter((r: any) => r.items?.nome?.toLowerCase().includes(termo_lower))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((r: any) => ({ loja_id: r.lojas?.id ?? '', loja_nome: r.lojas?.nome ?? '—', item_nome: r.items?.nome ?? '—', preco: r.preco }))
    setResultadosBusca(filtrado)
  }

  // ── Facção: CRUD ───────────────────────────────────────────────────────────
  const [faccaoModal, setFaccaoModal] = useState(false)
  const [faccaoForm, setFaccaoForm] = useState(emptyFaccaoForm)
  const [faccaoEditId, setFaccaoEditId] = useState<string | null>(null)
  const [faccaoSaving, setFaccaoSaving] = useState(false)
  const [confirmDeleteFaccao, setConfirmDeleteFaccao] = useState<Faccao | null>(null)
  const [deletingFaccao, setDeletingFaccao] = useState(false)
  const [buscaFaccao, setBuscaFaccao] = useState('')

  function openNovaFaccao() { setFaccaoForm(emptyFaccaoForm); setFaccaoEditId(null); setFaccaoModal(true) }
  function openEditFaccao(f: Faccao) { setFaccaoForm({ nome: f.nome, sigla: f.sigla ?? '', descricao: f.descricao ?? '', territorio: f.territorio ?? '', cor_tag: f.cor_tag, status: f.status }); setFaccaoEditId(f.id); setFaccaoModal(true) }

  async function handleSalvarFaccao() {
    if (!faccaoForm.nome) { toast.error('Nome obrigatório'); return }
    setFaccaoSaving(true)
    if (faccaoEditId) {
      const { data, error } = await sb().from('faccoes').update({ ...faccaoForm, sigla: faccaoForm.sigla.trim() || null, descricao: faccaoForm.descricao || null, territorio: faccaoForm.territorio || null }).eq('id', faccaoEditId).select().single()
      if (error) { toast.error('Erro ao salvar'); setFaccaoSaving(false); return }
      setFaccoes(prev => prev.map(f => f.id === faccaoEditId ? data as Faccao : f))
    } else {
      const { data, error } = await sb().from('faccoes').insert({ ...faccaoForm, sigla: faccaoForm.sigla.trim() || null, descricao: faccaoForm.descricao || null, territorio: faccaoForm.territorio || null }).select().single()
      if (error) { toast.error('Erro ao salvar'); setFaccaoSaving(false); return }
      setFaccoes(prev => [...prev, data as Faccao].sort((a, b) => a.nome.localeCompare(b.nome)))
    }
    setFaccaoSaving(false); setFaccaoModal(false); toast.success('Facção salva')
  }

  async function handleDeleteFaccao() {
    if (!confirmDeleteFaccao) return
    setDeletingFaccao(true)
    const { error } = await sb().from('faccoes').delete().eq('id', confirmDeleteFaccao.id)
    setDeletingFaccao(false)
    if (error) { toast.error('Erro ao excluir'); return }
    setFaccoes(prev => prev.filter(f => f.id !== confirmDeleteFaccao.id))
    setMembros(prev => prev.map(m => m.faccao_id === confirmDeleteFaccao.id ? { ...m, faccao_id: null, faccoes: null } : m))
    setConfirmDeleteFaccao(null); toast.success('Facção excluída')
  }

  const faccoesFiltradas = faccoes.filter(f => !buscaFaccao || f.nome.toLowerCase().includes(buscaFaccao.toLowerCase()) || f.territorio?.toLowerCase().includes(buscaFaccao.toLowerCase()))

  // ── Membro: CRUD ───────────────────────────────────────────────────────────
  const [membroModal, setMembroModal] = useState(false)
  const [membroForm, setMembroForm] = useState(emptyMembroForm)
  const [membroEditId, setMembroEditId] = useState<string | null>(null)
  const [membroSaving, setMembroSaving] = useState(false)
  const [confirmDeleteMembro, setConfirmDeleteMembro] = useState<Membro | null>(null)
  const [deletingMembro, setDeletingMembro] = useState(false)
  const [buscaMembro, setBuscaMembro] = useState('')
  const [filtrFaccaoId, setFiltrFaccaoId] = useState('todas')

  function openNovoMembro() { setMembroForm(emptyMembroForm); setMembroEditId(null); setMembroModal(true) }
  function openEditMembro(m: Membro) { setMembroForm({ nome: m.nome, vulgo: m.vulgo ?? '', telefone: m.telefone ?? '', faccao_id: m.faccao_id ?? 'sem', status: m.status, observacoes: m.observacoes ?? '' }); setMembroEditId(m.id); setMembroModal(true) }

  async function handleSalvarMembro() {
    if (!membroForm.nome) { toast.error('Nome obrigatório'); return }
    setMembroSaving(true)
    const row = { nome: membroForm.nome, vulgo: membroForm.vulgo || null, telefone: membroForm.telefone || null, faccao_id: membroForm.faccao_id === 'sem' ? null : membroForm.faccao_id || null, status: membroForm.status, observacoes: membroForm.observacoes || null }
    if (membroEditId) {
      const { data, error } = await sb().from('membros').update(row).eq('id', membroEditId).select('*, faccoes(id, nome, cor_tag)').single()
      if (error) { toast.error('Erro ao salvar'); setMembroSaving(false); return }
      setMembros(prev => prev.map(m => m.id === membroEditId ? data as Membro : m))
    } else {
      const { data, error } = await sb().from('membros').insert(row).select('*, faccoes(id, nome, cor_tag)').single()
      if (error) { toast.error('Erro ao salvar'); setMembroSaving(false); return }
      setMembros(prev => [...prev, data as Membro].sort((a, b) => a.nome.localeCompare(b.nome)))
    }
    setMembroSaving(false); setMembroModal(false); toast.success('Membro salvo')
  }

  async function handleDeleteMembro() {
    if (!confirmDeleteMembro) return
    setDeletingMembro(true)
    const { error } = await sb().from('membros').delete().eq('id', confirmDeleteMembro.id)
    setDeletingMembro(false)
    if (error) { toast.error('Erro ao excluir'); return }
    setMembros(prev => prev.filter(m => m.id !== confirmDeleteMembro.id))
    setConfirmDeleteMembro(null); toast.success('Membro excluído')
  }

  const membrosFiltrados = membros.filter(m => {
    const matchBusca = !buscaMembro || m.nome.toLowerCase().includes(buscaMembro.toLowerCase()) || m.telefone?.includes(buscaMembro) || m.vulgo?.toLowerCase().includes(buscaMembro.toLowerCase())
    const matchFaccao = filtrFaccaoId === 'todas' || (filtrFaccaoId === 'sem' ? !m.faccao_id : m.faccao_id === filtrFaccaoId)
    return matchBusca && matchFaccao
  })

  // ── Veículo: CRUD ──────────────────────────────────────────────────────────
  const [veiculoModal, setVeiculoModal] = useState(false)
  const [veiculoForm, setVeiculoForm] = useState(emptyVeiculoForm)
  const [veiculoEditId, setVeiculoEditId] = useState<string | null>(null)
  const [veiculoSaving, setVeiculoSaving] = useState(false)
  const [confirmDeleteVeiculo, setConfirmDeleteVeiculo] = useState<Veiculo | null>(null)
  const [deletingVeiculo, setDeletingVeiculo] = useState(false)
  const [buscaVeiculo, setBuscaVeiculo] = useState('')

  function openNovoVeiculo() { setVeiculoForm(emptyVeiculoForm); setVeiculoEditId(null); setVeiculoModal(true) }
  function openEditVeiculo(v: Veiculo) { setVeiculoForm({ placa: v.placa, modelo: v.modelo ?? '', cor: v.cor ?? '', proprietario_tipo: v.proprietario_tipo ?? 'desconhecido', proprietario_id: v.proprietario_id ?? '', observacoes: v.observacoes ?? '' }); setVeiculoEditId(v.id); setVeiculoModal(true) }

  function getProprietarioNome(v: Veiculo) {
    if (v.proprietario_tipo === 'membro') return membros.find(m => m.id === v.proprietario_id)?.nome ?? 'Desconhecido'
    if (v.proprietario_tipo === 'faccao') return faccoes.find(f => f.id === v.proprietario_id)?.nome ?? 'Desconhecido'
    return 'Desconhecido'
  }

  async function handleSalvarVeiculo() {
    if (!veiculoForm.placa) { toast.error('Placa obrigatória'); return }
    setVeiculoSaving(true)
    const row = { placa: veiculoForm.placa.toUpperCase(), modelo: veiculoForm.modelo || null, cor: veiculoForm.cor || null, proprietario_tipo: veiculoForm.proprietario_tipo, proprietario_id: veiculoForm.proprietario_id || null, observacoes: veiculoForm.observacoes || null }
    if (veiculoEditId) {
      const { data, error } = await sb().from('veiculos').update(row).eq('id', veiculoEditId).select().single()
      if (error) { toast.error('Erro ao salvar'); setVeiculoSaving(false); return }
      setVeiculos(prev => prev.map(v => v.id === veiculoEditId ? data as Veiculo : v))
    } else {
      const { data, error } = await sb().from('veiculos').insert(row).select().single()
      if (error) { toast.error(error.message.includes('unique') ? 'Placa já cadastrada' : 'Erro ao salvar'); setVeiculoSaving(false); return }
      setVeiculos(prev => [...prev, data as Veiculo].sort((a, b) => a.placa.localeCompare(b.placa)))
    }
    setVeiculoSaving(false); setVeiculoModal(false); toast.success('Veículo salvo')
  }

  async function handleDeleteVeiculo() {
    if (!confirmDeleteVeiculo) return
    setDeletingVeiculo(true)
    const { error } = await sb().from('veiculos').delete().eq('id', confirmDeleteVeiculo.id)
    setDeletingVeiculo(false)
    if (error) { toast.error('Erro ao excluir'); return }
    setVeiculos(prev => prev.filter(v => v.id !== confirmDeleteVeiculo.id))
    setConfirmDeleteVeiculo(null); toast.success('Veículo excluído')
  }

  const veiculosFiltrados = veiculos.filter(v => !buscaVeiculo || v.placa.toLowerCase().includes(buscaVeiculo.toLowerCase()) || v.modelo?.toLowerCase().includes(buscaVeiculo.toLowerCase()))

  const veiculosPorMembro = useMemo(() => {
    const map: Record<string, Veiculo[]> = {}
    veiculos.filter(v => v.proprietario_tipo === 'membro' && v.proprietario_id).forEach(v => {
      const id = v.proprietario_id!
      if (!map[id]) map[id] = []
      map[id].push(v)
    })
    return map
  }, [veiculos])

  // ── Loja: CRUD ─────────────────────────────────────────────────────────────
  const [lojaModal, setLojaModal] = useState(false)
  const [lojaForm, setLojaForm] = useState(emptyLojaForm)
  const [lojaEditId, setLojaEditId] = useState<string | null>(null)
  const [lojaSaving, setLojaSaving] = useState(false)
  const [confirmDeleteLoja, setConfirmDeleteLoja] = useState<Loja | null>(null)
  const [deletingLoja, setDeletingLoja] = useState(false)
  const [buscaLoja, setBuscaLoja] = useState('')

  function openNovaLoja() { setLojaForm(emptyLojaForm); setLojaEditId(null); setLojaModal(true) }
  function openEditLoja(l: Loja) { setLojaForm({ nome: l.nome, localizacao: l.localizacao ?? '', tipo: l.tipo ?? '', status: l.status }); setLojaEditId(l.id); setLojaModal(true) }

  async function handleSalvarLoja() {
    if (!lojaForm.nome) { toast.error('Nome obrigatório'); return }
    setLojaSaving(true)
    const row = { nome: lojaForm.nome, localizacao: lojaForm.localizacao || null, tipo: lojaForm.tipo || null, status: lojaForm.status }
    if (lojaEditId) {
      const { data, error } = await sb().from('lojas').update(row).eq('id', lojaEditId).select().single()
      if (error) { toast.error('Erro ao salvar'); setLojaSaving(false); return }
      setLojas(prev => prev.map(l => l.id === lojaEditId ? data as Loja : l))
    } else {
      const { data, error } = await sb().from('lojas').insert(row).select().single()
      if (error) { toast.error('Erro ao salvar'); setLojaSaving(false); return }
      setLojas(prev => [...prev, data as Loja].sort((a, b) => a.nome.localeCompare(b.nome)))
    }
    setLojaSaving(false); setLojaModal(false); toast.success('Loja salva')
  }

  async function handleDeleteLoja() {
    if (!confirmDeleteLoja) return
    setDeletingLoja(true)
    const { error } = await sb().from('lojas').delete().eq('id', confirmDeleteLoja.id)
    setDeletingLoja(false)
    if (error) { toast.error('Erro ao excluir — verifique se há preços vinculados'); return }
    setLojas(prev => prev.filter(l => l.id !== confirmDeleteLoja.id))
    setConfirmDeleteLoja(null); toast.success('Loja excluída')
  }

  const lojasFiltradas = lojas.filter(l => !buscaLoja || l.nome.toLowerCase().includes(buscaLoja.toLowerCase()) || l.localizacao?.toLowerCase().includes(buscaLoja.toLowerCase()))

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <Header title="Investigação" description="Facções, membros, veículos e lojas" />

      <div className="flex-1 p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="faccoes">Facções <span className="ml-1.5 text-[10px] text-muted-foreground">({faccoes.length})</span></TabsTrigger>
            <TabsTrigger value="membros">Membros <span className="ml-1.5 text-[10px] text-muted-foreground">({membros.length})</span></TabsTrigger>
            <TabsTrigger value="veiculos">Veículos <span className="ml-1.5 text-[10px] text-muted-foreground">({veiculos.length})</span></TabsTrigger>
            <TabsTrigger value="lojas">Lojas <span className="ml-1.5 text-[10px] text-muted-foreground">({lojas.length})</span></TabsTrigger>
          </TabsList>

          {/* ── Facções ──────────────────────────────────────────────────── */}
          <TabsContent value="faccoes" className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Buscar facção ou território..." value={buscaFaccao} onChange={e => setBuscaFaccao(e.target.value)} className="pl-8 h-8 text-sm" />
              </div>
              <Button size="sm" className="h-8 gap-1.5" onClick={openNovaFaccao}>
                <Plus className="h-3.5 w-3.5" />Nova Facção
              </Button>
            </div>

            {faccoesFiltradas.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">Nenhuma facção encontrada</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {faccoesFiltradas.map(f => {
                  const nMembros = membros.filter(m => m.faccao_id === f.id).length
                  const nVeiculos = veiculos.filter(v =>
                    (v.proprietario_tipo === 'faccao' && v.proprietario_id === f.id) ||
                    (v.proprietario_tipo === 'membro' && membros.some(m => m.id === v.proprietario_id && m.faccao_id === f.id))
                  ).length
                  return (
                    <div key={f.id} className="rounded-lg border border-border bg-card p-4 space-y-3 hover:border-border/80 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="h-3 w-3 rounded-full shrink-0 mt-0.5" style={{ background: f.cor_tag }} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-semibold truncate">{f.nome}</p>
                              {f.sigla && <span className="text-[10px] font-mono text-muted-foreground bg-white/[0.06] px-1 py-0.5 rounded shrink-0">{f.sigla}</span>}
                            </div>
                            {f.territorio && <p className="text-xs text-muted-foreground truncate">{f.territorio}</p>}
                          </div>
                        </div>
                        <StatusBadge status={f.status} />
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" />{nMembros} membros</span>
                        <span className="flex items-center gap-1"><Car className="h-3 w-3" />{nVeiculos} veículos</span>
                      </div>
                      <div className="flex items-center gap-1.5 pt-1 border-t border-border/60">
                        <Button variant="ghost" size="sm" className="h-7 text-xs flex-1" onClick={() => abrirDetalhe(f)}>Ver detalhes</Button>
                        <button onClick={() => openEditFaccao(f)} className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors">
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setConfirmDeleteFaccao(f)} className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-white/[0.06] transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </TabsContent>

          {/* ── Membros ───────────────────────────────────────────────────── */}
          <TabsContent value="membros" className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Nome, vulgo ou parte do telefone..." value={buscaMembro} onChange={e => setBuscaMembro(e.target.value)} className="pl-8 h-8 text-sm" />
              </div>
              <Select value={filtrFaccaoId} onValueChange={setFiltrFaccaoId}>
                <SelectTrigger className="h-8 text-sm w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as facções</SelectItem>
                  <SelectItem value="sem">Sem facção</SelectItem>
                  {faccoes.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" className="h-8 gap-1.5 ml-auto" onClick={openNovoMembro}>
                <Plus className="h-3.5 w-3.5" />Novo Membro
              </Button>
            </div>

            <div className="rounded-lg border border-border overflow-hidden">
              <div className="grid grid-cols-[1fr_100px_130px_140px_80px_64px] gap-2 px-4 py-2 bg-white/[0.02] border-b border-border text-[11px] text-muted-foreground font-medium">
                <span>Nome / Vulgo</span><span>Telefone</span><span>Facção</span><span>Observações</span><span>Status</span><span />
              </div>
              {membrosFiltrados.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">Nenhum membro encontrado</div>
              ) : membrosFiltrados.map(m => (
                <div key={m.id} className="grid grid-cols-[1fr_100px_130px_140px_80px_64px] gap-2 items-center px-4 py-2.5 border-b border-border/40 last:border-0 hover:bg-white/[0.02]">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="min-w-0">
                      <span className="text-sm font-medium">{m.nome}</span>
                      {m.vulgo && <span className="ml-1.5 text-xs text-muted-foreground">"{m.vulgo}"</span>}
                    </div>
                    {(veiculosPorMembro[m.id] ?? []).map(v => (
                      <span key={v.id} title={`${v.placa}${v.modelo ? ` — ${v.modelo}` : ''}${v.cor ? ` (${v.cor})` : ''}`} className="shrink-0 cursor-default">
                        <Car className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
                      </span>
                    ))}
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">{m.telefone ?? '—'}</span>
                  <span>
                    {m.faccoes
                      ? <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded" style={{ background: m.faccoes.cor_tag + '22', color: m.faccoes.cor_tag }}>
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.faccoes.cor_tag }} />
                          {m.faccoes.nome}
                        </span>
                      : <span className="text-xs text-muted-foreground">Sem facção</span>
                    }
                  </span>
                  <span className="text-xs text-muted-foreground truncate">{m.observacoes ?? '—'}</span>
                  <StatusBadge status={m.status} />
                  <div className="flex gap-1">
                    <button onClick={() => openEditMembro(m)} className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors"><Edit2 className="h-3.5 w-3.5" /></button>
                    <button onClick={() => setConfirmDeleteMembro(m)} className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-white/[0.06] transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ── Veículos ──────────────────────────────────────────────────── */}
          <TabsContent value="veiculos" className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Placa (parcial) ou modelo..." value={buscaVeiculo} onChange={e => setBuscaVeiculo(e.target.value)} className="pl-8 h-8 text-sm" />
              </div>
              <Button size="sm" className="h-8 gap-1.5 ml-auto" onClick={openNovoVeiculo}>
                <Plus className="h-3.5 w-3.5" />Novo Veículo
              </Button>
            </div>

            <div className="rounded-lg border border-border overflow-hidden">
              <div className="grid grid-cols-[100px_1fr_80px_1fr_1fr_64px] gap-2 px-4 py-2 bg-white/[0.02] border-b border-border text-[11px] text-muted-foreground font-medium">
                <span>Placa</span><span>Modelo</span><span>Cor</span><span>Proprietário</span><span>Observações</span><span />
              </div>
              {veiculosFiltrados.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">Nenhum veículo encontrado</div>
              ) : veiculosFiltrados.map(v => (
                <div key={v.id} className="grid grid-cols-[100px_1fr_80px_1fr_1fr_64px] gap-2 items-center px-4 py-2.5 border-b border-border/40 last:border-0 hover:bg-white/[0.02]">
                  <span className="font-mono text-sm font-medium">{v.placa}</span>
                  <span className="text-sm">{v.modelo ?? '—'}</span>
                  <span className="text-sm text-muted-foreground">{v.cor ?? '—'}</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {v.proprietario_tipo === 'desconhecido' || !v.proprietario_tipo
                      ? <span className="text-xs text-muted-foreground">Desconhecido</span>
                      : <>
                          <span className="text-xs">{getProprietarioNome(v)}</span>
                          {v.proprietario_tipo === 'membro' && (() => {
                            const fac = membros.find(m => m.id === v.proprietario_id)?.faccoes
                            return fac ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ background: fac.cor_tag + '22', color: fac.cor_tag }}>{fac.nome}</span>
                            ) : null
                          })()}
                        </>
                    }
                  </div>
                  <span className="text-xs text-muted-foreground truncate">{v.observacoes ?? '—'}</span>
                  <div className="flex gap-1">
                    <button onClick={() => openEditVeiculo(v)} className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors"><Edit2 className="h-3.5 w-3.5" /></button>
                    <button onClick={() => setConfirmDeleteVeiculo(v)} className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-white/[0.06] transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ── Lojas ─────────────────────────────────────────────────────── */}
          <TabsContent value="lojas" className="space-y-4">
            {/* Toggle: lista / busca por produto */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex rounded-md border border-border overflow-hidden text-xs">
                <button onClick={() => setModoBuscaProduto(false)} className={cn('px-3 py-1.5 transition-colors', !modoBuscaProduto ? 'bg-white/[0.08] text-foreground' : 'text-muted-foreground hover:text-foreground')}>Lojas</button>
                <button onClick={() => setModoBuscaProduto(true)} className={cn('px-3 py-1.5 transition-colors border-l border-border', modoBuscaProduto ? 'bg-white/[0.08] text-foreground' : 'text-muted-foreground hover:text-foreground')}>Busca por produto</button>
              </div>
              {!modoBuscaProduto && (
                <>
                  <div className="relative flex-1 min-w-[160px] max-w-xs">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input placeholder="Buscar loja ou localização..." value={buscaLoja} onChange={e => setBuscaLoja(e.target.value)} className="pl-8 h-8 text-sm" />
                  </div>
                  <Button size="sm" className="h-8 gap-1.5 ml-auto" onClick={openNovaLoja}>
                    <Plus className="h-3.5 w-3.5" />Nova Loja
                  </Button>
                </>
              )}
            </div>

            {modoBuscaProduto ? (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Digitar nome do produto para comparar preços..."
                    value={buscaProduto}
                    onChange={e => { setBuscaProduto(e.target.value); buscarProdutoNasLojas(e.target.value) }}
                    className="pl-8 h-9 text-sm"
                    autoFocus
                  />
                </div>
                {buscando && <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>}
                {!buscando && buscaProduto && resultadosBusca.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhuma loja vende esse produto</p>
                )}
                {resultadosBusca.length > 0 && (() => {
                  // agrupar por item_nome
                  const porItem: Record<string, typeof resultadosBusca> = {}
                  resultadosBusca.forEach(r => { if (!porItem[r.item_nome]) porItem[r.item_nome] = []; porItem[r.item_nome].push(r) })
                  const menorPreco = (lista: typeof resultadosBusca) => Math.min(...lista.map(r => r.preco))
                  return Object.entries(porItem).sort(([a], [b]) => a.localeCompare(b)).map(([itemNome, linhas]) => {
                    const menor = menorPreco(linhas)
                    return (
                      <div key={itemNome} className="space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground px-1">{itemNome}</p>
                        <div className="rounded-lg border border-border overflow-hidden">
                          {linhas.sort((a, b) => a.preco - b.preco).map((r, idx) => (
                            <div key={`${r.loja_id}-${idx}`} className={cn('flex items-center justify-between px-4 py-2', idx < linhas.length - 1 && 'border-b border-border/40')}>
                              <button className="text-sm text-left hover:text-primary transition-colors" onClick={() => { const l = lojas.find(x => x.id === r.loja_id); if (l) setDetalheLoja(l) }}>
                                {r.loja_nome}
                              </button>
                              <div className="flex items-center gap-2">
                                <span className={cn('text-sm font-medium tabular-nums', r.preco === menor && 'text-green-400')}>
                                  R$ {r.preco.toLocaleString('pt-BR')}
                                </span>
                                {r.preco === menor && <span className="text-[10px] text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded">menor preço</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="grid grid-cols-[1fr_1fr_120px_80px_72px] gap-2 px-4 py-2 bg-white/[0.02] border-b border-border text-[11px] text-muted-foreground font-medium">
                  <span>Nome</span><span>Localização</span><span>Tipo</span><span>Status</span><span />
                </div>
                {lojasFiltradas.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-sm">Nenhuma loja encontrada</div>
                ) : lojasFiltradas.map(l => (
                  <div key={l.id} className="grid grid-cols-[1fr_1fr_120px_80px_72px] gap-2 items-center px-4 py-2.5 border-b border-border/40 last:border-0 hover:bg-white/[0.02]">
                    <button className="text-sm font-medium text-left hover:text-primary transition-colors" onClick={() => setDetalheLoja(l)}>{l.nome}</button>
                    <span className="text-sm text-muted-foreground">{l.localizacao ?? '—'}</span>
                    <span className="text-sm text-muted-foreground">{l.tipo ?? '—'}</span>
                    <StatusBadge status={l.status} />
                    <div className="flex gap-1">
                      <button onClick={() => openEditLoja(l)} className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors"><Edit2 className="h-3.5 w-3.5" /></button>
                      <button onClick={() => setConfirmDeleteLoja(l)} className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-white/[0.06] transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Modal: Facção ──────────────────────────────────────────────────── */}
      <Dialog open={faccaoModal} onOpenChange={setFaccaoModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{faccaoEditId ? 'Editar Facção' : 'Nova Facção'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-[1fr_100px] gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome *</Label>
                <Input value={faccaoForm.nome} onChange={e => setFaccaoForm(f => ({ ...f, nome: e.target.value }))} className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Sigla / Tag</Label>
                <Input value={faccaoForm.sigla} onChange={e => setFaccaoForm(f => ({ ...f, sigla: e.target.value }))} placeholder="CV, PCC..." className="h-8 text-sm" maxLength={10} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Território</Label>
                <Input value={faccaoForm.territorio} onChange={e => setFaccaoForm(f => ({ ...f, territorio: e.target.value }))} placeholder="Ex: Zona Sul..." className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Descrição</Label>
                <Input value={faccaoForm.descricao} onChange={e => setFaccaoForm(f => ({ ...f, descricao: e.target.value }))} className="h-8 text-sm" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Cor</Label>
              <div className="flex flex-wrap gap-2">
                {FACTION_COLORS.map(cor => (
                  <button key={cor} onClick={() => setFaccaoForm(f => ({ ...f, cor_tag: cor }))}
                    className={cn('h-7 w-7 rounded-md border-2 transition-all flex items-center justify-center', faccaoForm.cor_tag === cor ? 'border-white/60 scale-110' : 'border-transparent hover:border-white/20')}
                    style={{ background: cor }}>
                    {faccaoForm.cor_tag === cor && <Check className="h-3 w-3 text-white drop-shadow" />}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Status</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{faccaoForm.status === 'ativo' ? 'Ativa' : 'Inativa'}</span>
                <Switch checked={faccaoForm.status === 'ativo'} onCheckedChange={v => setFaccaoForm(f => ({ ...f, status: v ? 'ativo' : 'inativo' }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setFaccaoModal(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSalvarFaccao} disabled={faccaoSaving}>
              {faccaoSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Membro ──────────────────────────────────────────────────── */}
      <Dialog open={membroModal} onOpenChange={setMembroModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{membroEditId ? 'Editar Membro' : 'Novo Membro'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome *</Label>
                <Input value={membroForm.nome} onChange={e => setMembroForm(f => ({ ...f, nome: e.target.value }))} className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Vulgo</Label>
                <Input value={membroForm.vulgo} onChange={e => setMembroForm(f => ({ ...f, vulgo: e.target.value }))} placeholder="Apelido..." className="h-8 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Telefone</Label>
                <Input value={membroForm.telefone} onChange={e => setMembroForm(f => ({ ...f, telefone: e.target.value }))} placeholder="Ex: 555-1234" className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Facção</Label>
                <Select value={membroForm.faccao_id} onValueChange={v => setMembroForm(f => ({ ...f, faccao_id: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Sem facção" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sem">Sem facção</SelectItem>
                    {faccoes.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Observações</Label>
              <Input value={membroForm.observacoes} onChange={e => setMembroForm(f => ({ ...f, observacoes: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Status</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{membroForm.status === 'ativo' ? 'Ativo' : 'Inativo'}</span>
                <Switch checked={membroForm.status === 'ativo'} onCheckedChange={v => setMembroForm(f => ({ ...f, status: v ? 'ativo' : 'inativo' }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setMembroModal(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSalvarMembro} disabled={membroSaving}>
              {membroSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Veículo ─────────────────────────────────────────────────── */}
      <Dialog open={veiculoModal} onOpenChange={setVeiculoModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{veiculoEditId ? 'Editar Veículo' : 'Novo Veículo'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Placa *</Label>
                <Input value={veiculoForm.placa} onChange={e => setVeiculoForm(f => ({ ...f, placa: e.target.value.toUpperCase() }))} placeholder="ABC1234" className="h-8 text-sm font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Modelo</Label>
                <Input value={veiculoForm.modelo} onChange={e => setVeiculoForm(f => ({ ...f, modelo: e.target.value }))} placeholder="Ex: Sultan RS..." className="h-8 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Cor</Label>
                <Input value={veiculoForm.cor} onChange={e => setVeiculoForm(f => ({ ...f, cor: e.target.value }))} placeholder="Ex: Preto..." className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo do proprietário</Label>
                <Select value={veiculoForm.proprietario_tipo} onValueChange={v => setVeiculoForm(f => ({ ...f, proprietario_tipo: v as typeof f.proprietario_tipo, proprietario_id: '' }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desconhecido">Desconhecido</SelectItem>
                    <SelectItem value="membro">Membro</SelectItem>
                    <SelectItem value="faccao">Facção</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {veiculoForm.proprietario_tipo !== 'desconhecido' && (
              <div className="space-y-1.5">
                <Label className="text-xs">{veiculoForm.proprietario_tipo === 'membro' ? 'Membro' : 'Facção'}</Label>
                <Select value={veiculoForm.proprietario_id} onValueChange={v => setVeiculoForm(f => ({ ...f, proprietario_id: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {veiculoForm.proprietario_tipo === 'membro'
                      ? membros.map(m => <SelectItem key={m.id} value={m.id}>{m.nome}{m.vulgo ? ` (${m.vulgo})` : ''}</SelectItem>)
                      : faccoes.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)
                    }
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Observações</Label>
              <Input value={veiculoForm.observacoes} onChange={e => setVeiculoForm(f => ({ ...f, observacoes: e.target.value }))} className="h-8 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setVeiculoModal(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSalvarVeiculo} disabled={veiculoSaving}>
              {veiculoSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Loja ────────────────────────────────────────────────────── */}
      <Dialog open={lojaModal} onOpenChange={setLojaModal}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{lojaEditId ? 'Editar Loja' : 'Nova Loja'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome *</Label>
              <Input value={lojaForm.nome} onChange={e => setLojaForm(f => ({ ...f, nome: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Localização</Label>
                <Input value={lojaForm.localizacao} onChange={e => setLojaForm(f => ({ ...f, localizacao: e.target.value }))} placeholder="Ex: Pillbox Hill..." className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo</Label>
                <Input value={lojaForm.tipo} onChange={e => setLojaForm(f => ({ ...f, tipo: e.target.value }))} placeholder="Ex: Mercado, Armas..." className="h-8 text-sm" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Status</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{lojaForm.status === 'ativo' ? 'Ativa' : 'Inativa'}</span>
                <Switch checked={lojaForm.status === 'ativo'} onCheckedChange={v => setLojaForm(f => ({ ...f, status: v ? 'ativo' : 'inativo' }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setLojaModal(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSalvarLoja} disabled={lojaSaving}>
              {lojaSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirms ───────────────────────────────────────────────────────── */}
      {[
        { open: !!confirmDeleteFaccao, title: 'Excluir facção?', desc: `"${confirmDeleteFaccao?.nome}" será excluída. Os membros ficam sem facção.`, onConfirm: handleDeleteFaccao, loading: deletingFaccao, onCancel: () => setConfirmDeleteFaccao(null) },
        { open: !!confirmDeleteMembro, title: 'Excluir membro?', desc: `"${confirmDeleteMembro?.nome}" será excluído permanentemente.`, onConfirm: handleDeleteMembro, loading: deletingMembro, onCancel: () => setConfirmDeleteMembro(null) },
        { open: !!confirmDeleteVeiculo, title: 'Excluir veículo?', desc: `Placa "${confirmDeleteVeiculo?.placa}" será excluída.`, onConfirm: handleDeleteVeiculo, loading: deletingVeiculo, onCancel: () => setConfirmDeleteVeiculo(null) },
        { open: !!confirmDeleteLoja, title: 'Excluir loja?', desc: `"${confirmDeleteLoja?.nome}" será excluída.`, onConfirm: handleDeleteLoja, loading: deletingLoja, onCancel: () => setConfirmDeleteLoja(null) },
      ].map((c, i) => (
        <AlertDialog key={i} open={c.open} onOpenChange={v => !v && c.onCancel()}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{c.title}</AlertDialogTitle>
              <AlertDialogDescription>{c.desc}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={c.onConfirm} disabled={c.loading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {c.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Excluir'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ))}

      {/* ── Loja Detalhe ───────────────────────────────────────────────────── */}
      {detalheLoja && (
        <LojaDetalhe
          loja={detalheLoja}
          todosProdutos={todosProdutos}
          todosMembros={membros}
          open={!!detalheLoja}
          onClose={() => setDetalheLoja(null)}
          onUpdateLoja={l => { setLojas(prev => prev.map(x => x.id === l.id ? l : x)); setDetalheLoja(l) }}
        />
      )}

      {/* ── Facção Detalhe ─────────────────────────────────────────────────── */}
      {detalhe && (
        <FaccaoDetalhe
          faccao={detalhe}
          membros={membros.filter(m => m.faccao_id === detalhe.id)}
          veiculos={veiculos.filter(v => {
            if (v.proprietario_tipo === 'faccao') return v.proprietario_id === detalhe.id
            if (v.proprietario_tipo === 'membro') return membros.some(m => m.id === v.proprietario_id && m.faccao_id === detalhe.id)
            return false
          })}
          todosProdutos={todosProdutos}
          faccaoPrecos={faccaoPrecos.filter(p => p.faccao_id === detalhe.id)}
          open={!!detalhe}
          onClose={() => setDetalhe(null)}
          onUpdateFaccao={f => { setFaccoes(prev => prev.map(x => x.id === f.id ? f : x)); setDetalhe(f) }}
          onUpdateFaccaoPrecos={precos => setFaccaoPrecos(prev => [...prev.filter(p => p.faccao_id !== detalhe.id), ...precos])}
        />
      )}
    </>
  )
}

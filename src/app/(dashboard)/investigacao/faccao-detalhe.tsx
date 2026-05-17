'use client'

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Edit2, ExternalLink, Loader2, Plus, Check, X, Users, Car, Package, MapPin, Search, ImageUp, Copy, Trash2, Percent, ChevronDown, Layers, Handshake } from 'lucide-react'
import { gerarImagemFaccao } from '@/lib/gerarImagem'
import { uploadImgbb, getImgbbKey } from '@/lib/imgbb'
import { cn, norm } from '@/lib/utils'

const FACTION_COLORS = [
  '#6366f1','#8b5cf6','#a855f7','#ec4899',
  '#ef4444','#f97316','#eab308','#22c55e',
  '#10b981','#06b6d4','#3b82f6','#6b7280',
]

export type Faccao      = { id: string; nome: string; sigla: string | null; descricao: string | null; territorio: string | null; cor_tag: string; deep: string | null; status: 'ativo' | 'inativo'; desconto_padrao_pct: number; telefone: string | null; observacoes: string | null; tem_parceria: boolean; parceria_obs: string | null; is_darkchat: boolean; created_at: string; updated_at: string }
export type Membro      = { id: string; nome: string; vulgo: string | null; telefone: string | null; instagram: string | null; deep: string | null; faccao_id: string | null; cargo_faccao: string | null; status: 'ativo' | 'inativo'; observacoes: string | null; membro_proprio: boolean; data_entrada: string | null; data_saida: string | null; local_trabalho_loja_id: string | null; faccoes: { id: string; nome: string; cor_tag: string } | null }
export type Veiculo     = { id: string; placa: string | null; modelo: string | null; cor: string | null; proprietario_tipo: 'membro' | 'faccao' | 'desconhecido' | null; proprietario_id: string | null; observacoes: string | null }
export type FaccaoPreco = {
  id: string; faccao_id: string; item_id: string
  tipo: 'percentual' | 'fixo'; percentual: number | null
  preco_sujo: number | null; preco_limpo: number | null
  parceria_tipo: string | null; parceria_pct: number | null
  preco_sujo_parceria: number | null; preco_limpo_parceria: number | null
  desconto_qtd_minima: number | null
  desconto_qtd_tipo: string | null; desconto_qtd_pct: number | null
  desconto_qtd_preco_sujo: number | null; desconto_qtd_preco_limpo: number | null
  observacoes: string | null
}
export type FaixaPreco   = { id: string; faccao_id: string; item_id: string; quantidade_min: number; preco_sujo: number | null; preco_limpo: number | null }
export type Produto      = { id: string; nome: string; categoria?: string | null; apelidos?: string | null }
export type DescontoItem = { id: string; faccao_id: string; item_id: string; desconto_pct: number }
export type Servico      = { id: string; nome: string; descricao: string | null; preco_sujo: number | null; preco_limpo: number | null; desconto_pct: number }
type FaccaoProdutoExtra = { id: string; faccao_id: string; nome: string; valor_sujo: number | null; valor_limpo: number | null; created_at: string }

function fmt(v: number | null) {
  if (v == null) return '—'
  return `R$ ${v.toLocaleString('pt-BR')}`
}

const emptyMembroForm = { nome: '', vulgo: '', telefone: '', cargo_faccao: '', status: 'ativo' as 'ativo' | 'inativo', observacoes: '', loja_id: '' }
const emptyVeiculoForm = { placa: '', modelo: '', cor: '', proprietario_tipo: 'faccao' as 'membro' | 'faccao' | 'desconhecido', proprietario_id: '', observacoes: '' }

interface Props {
  faccao: Faccao
  membros: Membro[]
  veiculos: Veiculo[]
  todosProdutos: Produto[]
  todoServicos: Servico[]
  faccaoPrecos: FaccaoPreco[]
  open: boolean
  onClose: () => void
  onUpdateFaccao: (f: Faccao) => void
  onUpdateFaccaoPrecos: (precos: FaccaoPreco[]) => void
  onMembroSaved: (m: Membro, isNew: boolean) => void
  onMembroDeleted: (id: string) => void
  onVeiculoSaved: (v: Veiculo, isNew: boolean) => void
  onVeiculoDeleted: (id: string) => void
}

export function FaccaoDetalhe({ faccao, membros, veiculos, todosProdutos, todoServicos, faccaoPrecos, open, onClose, onUpdateFaccao, onUpdateFaccaoPrecos, onMembroSaved, onMembroDeleted, onVeiculoSaved, onVeiculoDeleted }: Props) {
  const sbRef = useRef<ReturnType<typeof createClient> | null>(null)
  const sb = useCallback(() => { if (!sbRef.current) sbRef.current = createClient(); return sbRef.current }, [])

  // ── DarkChat ───────────────────────────────────────────────────────────────
  const [darkchatVendas, setDarkchatVendas] = useState<{ id: string; cliente_nome: string; status: string; created_at: string }[] | null>(null)
  const [darkchatMembros, setDarkchatMembros] = useState<{ id: string; nome: string; deep: string; faccoes?: { nome: string } | null }[]>([])
  const [loadingDarkchat, setLoadingDarkchat] = useState(false)

  useEffect(() => {
    if (!open || !faccao.is_darkchat) return
    setLoadingDarkchat(true)
    setDarkchatVendas(null)
    Promise.all([
      sb().from('vendas').select('id, cliente_nome, status, created_at').eq('faccao_id', faccao.id).order('created_at', { ascending: false }),
      sb().from('membros').select('id, nome, deep, faccoes(nome)').not('deep', 'is', null),
    ]).then(([{ data: v }, { data: m }]) => {
      setDarkchatVendas(v ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setDarkchatMembros((m ?? []).filter((x: any) => x.deep).map((x: any) => ({
        id: x.id,
        nome: x.nome,
        deep: x.deep as string,
        faccoes: Array.isArray(x.faccoes) ? (x.faccoes[0] ?? null) : (x.faccoes ?? null),
      })))
      setLoadingDarkchat(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, faccao.is_darkchat, faccao.id])

  // ── Edição básica ──────────────────────────────────────────────────────────
  const [editando, setEditando] = useState(false)
  const [geralForm, setGeralForm] = useState({ nome: faccao.nome, sigla: faccao.sigla ?? '', descricao: faccao.descricao ?? '', territorio: faccao.territorio ?? '', deep: faccao.deep ?? '', cor_tag: faccao.cor_tag, status: faccao.status, desconto_padrao_pct: faccao.desconto_padrao_pct ?? 0, telefone: faccao.telefone ?? '', observacoes: faccao.observacoes ?? '', tem_parceria: faccao.tem_parceria ?? false, parceria_obs: faccao.parceria_obs ?? '', is_darkchat: faccao.is_darkchat ?? false })
  const [geralSaving, setGeralSaving] = useState(false)

  function abrirEdicao() {
    setGeralForm({ nome: faccao.nome, sigla: faccao.sigla ?? '', descricao: faccao.descricao ?? '', territorio: faccao.territorio ?? '', deep: faccao.deep ?? '', cor_tag: faccao.cor_tag, status: faccao.status, desconto_padrao_pct: faccao.desconto_padrao_pct ?? 0, telefone: faccao.telefone ?? '', observacoes: faccao.observacoes ?? '', tem_parceria: faccao.tem_parceria ?? false, parceria_obs: faccao.parceria_obs ?? '', is_darkchat: faccao.is_darkchat ?? false })
    setEditando(true)
  }

  async function handleSalvarGeral() {
    if (!geralForm.nome) { toast.error('Nome obrigatório'); return }
    setGeralSaving(true)
    const { data, error } = await sb().from('faccoes').update({
      nome: geralForm.nome, sigla: geralForm.sigla.trim() || null,
      descricao: geralForm.descricao || null, territorio: geralForm.territorio || null,
      deep: geralForm.deep || null,
      cor_tag: geralForm.cor_tag, status: geralForm.status,
      desconto_padrao_pct: geralForm.desconto_padrao_pct ?? 0,
      telefone: geralForm.telefone.trim() || null,
      observacoes: geralForm.observacoes.trim() || null,
      tem_parceria: geralForm.tem_parceria,
      parceria_obs: geralForm.tem_parceria ? (geralForm.parceria_obs.trim() || null) : null,
      is_darkchat: geralForm.is_darkchat,
    }).eq('id', faccao.id).select().single()
    setGeralSaving(false)
    if (error) { toast.error('Erro ao salvar'); return }
    onUpdateFaccao(data as Faccao)
    setEditando(false)
    toast.success('Facção atualizada')
  }

  // ── Compartilhar imagem ────────────────────────────────────────────────────
  const [compartilhando, setCompartilhando] = useState(false)
  const [linkImagem, setLinkImagem] = useState<string | null>(null)
  const [linkCopiado, setLinkCopiado] = useState(false)

  async function handleCompartilhar() {
    setCompartilhando(true)
    try {
      const key = await getImgbbKey()
      if (!key) { toast.error('Chave imgbb não configurada — veja Admin > Integrações'); setCompartilhando(false); return }
      const base64 = gerarImagemFaccao({ nome: faccao.nome, sigla: faccao.sigla, cor: faccao.cor_tag, territorio: faccao.territorio, status: faccao.status, membros, veiculos, faccaoPrecos, todosProdutos })
      const url = await uploadImgbb(base64, key, `faccao-${faccao.nome}`)
      setLinkImagem(url)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar imagem')
    } finally {
      setCompartilhando(false)
    }
  }

  function copiarLink() {
    if (!linkImagem) return
    navigator.clipboard.writeText(linkImagem)
    setLinkCopiado(true)
    setTimeout(() => setLinkCopiado(false), 2000)
    toast.success('Link copiado!')
  }

  // ── Busca por seção ────────────────────────────────────────────────────────
  const [buscaMembro, setBuscaMembro] = useState('')
  const [buscaVeiculo, setBuscaVeiculo] = useState('')
  const [buscaProduto, setBuscaProduto] = useState('')

  type TamanhoTexto = 'xs' | 'sm' | 'base'
  const [tamanhoTexto, setTamanhoTexto] = useState<TamanhoTexto>(() => {
    if (typeof window === 'undefined') return 'xs'
    return (localStorage.getItem('faccao_item_font_size') as TamanhoTexto) ?? 'xs'
  })
  function mudarTamanho(t: TamanhoTexto) {
    setTamanhoTexto(t)
    localStorage.setItem('faccao_item_font_size', t)
  }
  const itemNomeClass = tamanhoTexto === 'base' ? 'text-sm' : tamanhoTexto === 'sm' ? 'text-[13px]' : 'text-xs'

  const membrosFiltrados = useMemo(() => membros.filter(m =>
    !buscaMembro || norm(m.nome).includes(norm(buscaMembro)) ||
    norm(m.vulgo).includes(norm(buscaMembro)) ||
    m.telefone?.includes(buscaMembro)
  ), [membros, buscaMembro])

  const veiculosFiltrados = useMemo(() => veiculos.filter(v => {
    if (!buscaVeiculo) return true
    const q = norm(buscaVeiculo)
    const dono = v.proprietario_tipo === 'membro' ? membros.find(m => m.id === v.proprietario_id)?.nome : undefined
    return norm(v.placa).includes(q) || norm(v.modelo).includes(q) || norm(dono).includes(q)
  }), [veiculos, buscaVeiculo, membros])

  const veiculosPorMembro = useMemo(() => {
    const map: Record<string, Veiculo[]> = {}
    veiculos.filter(v => v.proprietario_tipo === 'membro' && v.proprietario_id).forEach(v => {
      const id = v.proprietario_id!
      if (!map[id]) map[id] = []
      map[id].push(v)
    })
    return map
  }, [veiculos])

  const precosFiltrados = useMemo(() => faccaoPrecos.filter(p => {
    if (!buscaProduto) return true
    const produto = todosProdutos.find(x => x.id === p.item_id)
    return norm(produto?.nome).includes(norm(buscaProduto))
  }), [faccaoPrecos, buscaProduto, todosProdutos])

  // ── CRUD Membros ───────────────────────────────────────────────────────────
  const [membroDialog, setMembroDialog] = useState<{ membro: Membro | null } | null>(null) // null = fechado, { membro: null } = novo, { membro: m } = editar
  const [membroForm, setMembroForm] = useState(emptyMembroForm)
  const [membroSaving, setMembroSaving] = useState(false)
  const [confirmDeleteMembro, setConfirmDeleteMembro] = useState<Membro | null>(null)
  const [membroSugestoes, setMembroSugestoes] = useState<{id: string, nome: string, vulgo: string|null, telefone: string|null, cargo_faccao: string|null}[]>([])
  const [membroExistenteId, setMembroExistenteId] = useState<string | null>(null)
  const [membroLojaBusca, setMembroLojaBusca] = useState('')
  const [todasLojas, setTodasLojas] = useState<{id: string, nome: string}[]>([])
  const [membroVeiculoInline, setMembroVeiculoInline] = useState({ ativo: false, placa: '', modelo: '', cor: '' })

  function abrirNovoMembro() {
    setMembroForm(emptyMembroForm)
    setMembroDialog({ membro: null })
    setMembroSugestoes([])
    setMembroExistenteId(null)
    setMembroLojaBusca('')
    setMembroVeiculoInline({ ativo: false, placa: '', modelo: '', cor: '' })
  }

  function abrirEditarMembro(m: Membro) {
    const lojaAtual = todasLojas.find(l => l.id === m.local_trabalho_loja_id)
    setMembroForm({ nome: m.nome, vulgo: m.vulgo ?? '', telefone: m.telefone ?? '', cargo_faccao: m.cargo_faccao ?? '', status: m.status, observacoes: m.observacoes ?? '', loja_id: m.local_trabalho_loja_id ?? '' })
    setMembroLojaBusca(lojaAtual?.nome ?? '')
    setMembroDialog({ membro: m })
    setMembroSugestoes([])
    setMembroExistenteId(null)
    setMembroVeiculoInline({ ativo: false, placa: '', modelo: '', cor: '' })
  }

  async function handleMembroNomeChange(nome: string) {
    setMembroExistenteId(null)
    setMembroForm(f => ({ ...f, nome }))
    if (nome.length < 2) { setMembroSugestoes([]); return }
    let query = sb().from('membros').select('id, nome, vulgo, telefone, cargo_faccao').ilike('nome', `%${nome}%`).limit(8)
    if (membroDialog?.membro) query = query.neq('id', membroDialog.membro.id)
    const { data } = await query
    setMembroSugestoes(data ?? [])
  }

  function selecionarMembroExistente(m: {id: string, nome: string, vulgo: string|null, telefone: string|null, cargo_faccao: string|null}) {
    setMembroForm(f => ({ ...f, nome: m.nome, vulgo: m.vulgo ?? '', telefone: m.telefone ?? '', cargo_faccao: m.cargo_faccao ?? '' }))
    setMembroExistenteId(m.id)
    setMembroSugestoes([])
  }

  async function handleSalvarMembro() {
    if (!membroForm.nome.trim()) { toast.error('Nome obrigatório'); return }
    const tel = membroForm.telefone.trim()
    if (tel) {
      let query = sb().from('membros').select('id, nome').eq('telefone', tel).neq('status', 'inativo')
      if (membroDialog?.membro) query = query.neq('id', membroDialog.membro.id)
      const { data: dup } = await query.maybeSingle()
      if (dup) toast.warning(`Telefone já cadastrado para "${dup.nome}"`)
    }
    setMembroSaving(true)
    const payload = {
      nome: membroForm.nome.trim(),
      vulgo: membroForm.vulgo.trim() || null,
      telefone: membroForm.telefone.trim() || null,
      cargo_faccao: membroForm.cargo_faccao.trim() || null,
      status: membroForm.status,
      observacoes: membroForm.observacoes.trim() || null,
      faccao_id: faccao.id,
      local_trabalho_loja_id: membroForm.loja_id || null,
      membro_proprio: false,
    }
    const isNew = !membroDialog?.membro
    let data: Membro | null = null
    const faccaoEmbutida = { id: faccao.id, nome: faccao.nome, cor_tag: faccao.cor_tag }
    if (isNew && membroExistenteId) {
      const res = await sb().from('membros').update(payload).eq('id', membroExistenteId).select('*').single()
      setMembroSaving(false)
      if (res.error) { toast.error('Erro ao vincular membro'); return }
      onMembroSaved({ ...res.data, faccoes: faccaoEmbutida } as Membro, true)
      setMembroDialog(null); setMembroSugestoes([]); setMembroExistenteId(null)
      toast.success('Membro vinculado à facção')
      return
    }
    if (isNew) {
      const res = await sb().from('membros').insert(payload).select('*').single()
      if (res.error) { toast.error('Erro ao criar membro'); setMembroSaving(false); return }
      data = { ...res.data, faccoes: faccaoEmbutida } as Membro
    } else {
      const res = await sb().from('membros').update(payload).eq('id', membroDialog!.membro!.id).select('*').single()
      if (res.error) { toast.error('Erro ao salvar membro'); setMembroSaving(false); return }
      data = { ...res.data, faccoes: faccaoEmbutida } as Membro
    }
    // Salvar veículo inline se preenchido
    if (data && membroVeiculoInline.ativo && (membroVeiculoInline.placa || membroVeiculoInline.modelo || membroVeiculoInline.cor)) {
      const { data: vData } = await sb().from('veiculos').insert({
        placa: membroVeiculoInline.placa ? membroVeiculoInline.placa.toUpperCase() : null,
        modelo: membroVeiculoInline.modelo || null,
        cor: membroVeiculoInline.cor || null,
        proprietario_tipo: 'membro',
        proprietario_id: data.id,
        observacoes: null,
      }).select().single()
      if (vData) onVeiculoSaved(vData as Veiculo, true)
    }
    setMembroSaving(false)
    onMembroSaved(data!, isNew)
    setMembroDialog(null); setMembroSugestoes([]); setMembroExistenteId(null)
    setMembroVeiculoInline({ ativo: false, placa: '', modelo: '', cor: '' })
    toast.success(isNew ? 'Membro adicionado' : 'Membro atualizado')
  }

  async function handleDeletarMembro(m: Membro) {
    const { error } = await sb().from('membros').delete().eq('id', m.id)
    if (error) { toast.error('Erro ao excluir membro'); return }
    onMembroDeleted(m.id)
    setConfirmDeleteMembro(null)
    toast.success('Membro excluído')
  }

  // ── CRUD Veículos ──────────────────────────────────────────────────────────
  const [veiculoDialog, setVeiculoDialog] = useState<{ veiculo: Veiculo | null } | null>(null)
  const [veiculoForm, setVeiculoForm] = useState(emptyVeiculoForm)
  const [veiculoSaving, setVeiculoSaving] = useState(false)
  const [confirmDeleteVeiculo, setConfirmDeleteVeiculo] = useState<Veiculo | null>(null)
  const [veiculoMembroBusca, setVeiculoMembroBusca] = useState('')

  function abrirNovoVeiculo() {
    setVeiculoForm(emptyVeiculoForm)
    setVeiculoDialog({ veiculo: null })
    setVeiculoMembroBusca('')
  }

  function abrirEditarVeiculo(v: Veiculo) {
    const membroDono = v.proprietario_tipo === 'membro' ? membros.find(m => m.id === v.proprietario_id) : null
    setVeiculoForm({ placa: v.placa ?? '', modelo: v.modelo ?? '', cor: v.cor ?? '', proprietario_tipo: v.proprietario_tipo ?? 'faccao', proprietario_id: v.proprietario_id ?? '', observacoes: v.observacoes ?? '' })
    setVeiculoMembroBusca(membroDono ? membroDono.nome + (membroDono.vulgo ? ` "${membroDono.vulgo}"` : '') : '')
    setVeiculoDialog({ veiculo: v })
  }

  async function handleSalvarVeiculo() {
    setVeiculoSaving(true)
    const payload = {
      placa: veiculoForm.placa.trim() || null,
      modelo: veiculoForm.modelo.trim() || null,
      cor: veiculoForm.cor.trim() || null,
      proprietario_tipo: veiculoForm.proprietario_tipo,
      proprietario_id: veiculoForm.proprietario_tipo === 'membro' && veiculoForm.proprietario_id ? veiculoForm.proprietario_id : veiculoForm.proprietario_tipo === 'faccao' ? faccao.id : null,
      observacoes: veiculoForm.observacoes.trim() || null,
    }
    const isNew = !veiculoDialog?.veiculo
    let data: Veiculo | null = null
    if (isNew) {
      const res = await sb().from('veiculos').insert(payload).select().single()
      if (res.error) { toast.error('Erro ao criar veículo'); setVeiculoSaving(false); return }
      data = res.data as Veiculo
    } else {
      const res = await sb().from('veiculos').update(payload).eq('id', veiculoDialog!.veiculo!.id).select().single()
      if (res.error) { toast.error('Erro ao salvar veículo'); setVeiculoSaving(false); return }
      data = res.data as Veiculo
    }
    setVeiculoSaving(false)
    onVeiculoSaved(data!, isNew)
    setVeiculoDialog(null)
    toast.success(isNew ? 'Veículo adicionado' : 'Veículo atualizado')
  }

  async function handleDeletarVeiculo(v: Veiculo) {
    const { error } = await sb().from('veiculos').delete().eq('id', v.id)
    if (error) { toast.error('Erro ao excluir veículo'); return }
    onVeiculoDeleted(v.id)
    setConfirmDeleteVeiculo(null)
    toast.success('Veículo excluído')
  }

  // ── Preços / Produtos ──────────────────────────────────────────────────────
  const [editPreco, setEditPreco] = useState<Produto | null>(null)
  const [precoForm, setPrecoForm] = useState({
    tipo: 'fixo' as 'percentual' | 'fixo',
    percentual: '', preco_sujo: '', preco_limpo: '',
    parceria_tipo: 'fixo' as 'fixo' | 'percentual',
    parceria_pct: '', preco_sujo_parceria: '', preco_limpo_parceria: '',
  })
  const [faixasPrecos, setFaixasPrecos] = useState<Record<string, FaixaPreco[]>>({})
  const [faixasForm, setFaixasForm] = useState<{ qtd_min: string; preco_sujo: string; preco_limpo: string }[]>([])
  const [precoSaving, setPrecoSaving] = useState(false)
  const [addingPreco, setAddingPreco] = useState(false)
  const [newItemId, setNewItemId] = useState('')
  const [buscaNovoPreco, setBuscaNovoPreco] = useState('')
  const [extraProdutos, setExtraProdutos] = useState<Produto[]>([])
  const [criandoProduto, setCriandoProduto] = useState(false)

  const todosProds = useMemo(() => [...todosProdutos, ...extraProdutos], [todosProdutos, extraProdutos])
  const produtosDisponiveis = useMemo(() => todosProds.filter(p => !faccaoPrecos.some(fp => fp.item_id === p.id)), [todosProds, faccaoPrecos])

  async function handleCriarProduto() {
    if (!buscaNovoPreco.trim() || criandoProduto) return
    setCriandoProduto(true)
    try {
      const { data, error } = await sb().from('items').insert({ nome: buscaNovoPreco.trim(), status: 'ativo', eh_compravel: true }).select('id, nome').single()
      if (error) throw error
      setExtraProdutos(prev => [...prev, { id: (data as { id: string; nome: string }).id, nome: (data as { id: string; nome: string }).nome }])
      setNewItemId((data as { id: string; nome: string }).id)
      setBuscaNovoPreco((data as { id: string; nome: string }).nome)
    } catch { toast.error('Erro ao cadastrar produto') }
    finally { setCriandoProduto(false) }
  }

  useEffect(() => {
    if (!open) return
    sb().from('faccao_item_preco_faixas').select('*').eq('faccao_id', faccao.id)
      .then(({ data }) => {
        const map: Record<string, FaixaPreco[]> = {}
        for (const f of (data ?? [])) {
          if (!map[f.item_id]) map[f.item_id] = []
          map[f.item_id].push(f as FaixaPreco)
        }
        setFaixasPrecos(map)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, faccao.id])

  // ── Descontos por Item ─────────────────────────────────────────────────────
  const [descontosItem, setDescontosItem] = useState<DescontoItem[]>([])
  const [loadingDescontos, setLoadingDescontos] = useState(false)
  const [descontoItemDialog, setDescontoItemDialog] = useState<{ item: DescontoItem | null } | null>(null)
  const [descontoForm, setDescontoForm] = useState({ item_id: '', desconto_pct: '' })
  const [descontoSaving, setDescontoSaving] = useState(false)
  const [buscaDesconto, setBuscaDesconto] = useState('')

  useEffect(() => {
    if (!open) return
    setLoadingDescontos(true)
    sb().from('faccao_desconto_por_item').select('*').eq('faccao_id', faccao.id)
      .then(({ data }) => { setDescontosItem((data ?? []) as DescontoItem[]); setLoadingDescontos(false) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, faccao.id])

  const [produtosExpandidos, setProdutosExpandidos] = useState<Set<string>>(new Set())
  const [produtosExtras, setProdutosExtras] = useState<FaccaoProdutoExtra[]>([])
  const [loadingExtras, setLoadingExtras] = useState(false)
  const [novoDescontoModal, setNovoDescontoModal] = useState(false)
  const [novoDescontoTab, setNovoDescontoTab] = useState<'lote' | 'manual'>('lote')
  const [loteSelecao, setLoteSelecao] = useState<Record<string, string>>({})
  const [loteSaving, setLoteSaving] = useState(false)
  const [manualForm, setManualForm] = useState({ nome: '', valor_sujo: '', valor_limpo: '' })
  const [manualSaving, setManualSaving] = useState(false)
  const [editandoExtra, setEditandoExtra] = useState<FaccaoProdutoExtra | null>(null)

  useEffect(() => {
    if (!open) return
    setLoadingExtras(true)
    sb().from('faccao_produto_extra').select('*').eq('faccao_id', faccao.id).order('nome')
      .then(({ data }) => { setProdutosExtras((data ?? []) as FaccaoProdutoExtra[]); setLoadingExtras(false) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, faccao.id])

  useEffect(() => {
    if (!open) return
    sb().from('lojas').select('id, nome').eq('status', 'ativo').order('nome')
      .then(({ data }) => setTodasLojas(data ?? []))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // ── Serviços vinculados ────────────────────────────────��───────────────────
  const [faccaoServicosIds, setFaccaoServicosIds] = useState<string[]>([])
  const [servicoAddOpen, setServicoAddOpen] = useState(false)
  const [novoServicoId, setNovoServicoId] = useState('')
  const [servicoSaving, setServicoSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    sb().from('faccao_servicos').select('servico_id').eq('faccao_id', faccao.id)
      .then(({ data }) => setFaccaoServicosIds((data ?? []).map((r: { servico_id: string }) => r.servico_id)))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, faccao.id])

  async function handleAdicionarServico() {
    if (!novoServicoId) return
    setServicoSaving(true)
    const { error } = await sb().from('faccao_servicos').insert({ faccao_id: faccao.id, servico_id: novoServicoId })
    setServicoSaving(false)
    if (error) { toast.error('Erro ao adicionar serviço'); return }
    setFaccaoServicosIds(prev => [...prev, novoServicoId])
    setNovoServicoId('')
    setServicoAddOpen(false)
    toast.success('Serviço adicionado')
  }

  async function handleRemoverServico(servicoId: string) {
    await sb().from('faccao_servicos').delete().eq('faccao_id', faccao.id).eq('servico_id', servicoId)
    setFaccaoServicosIds(prev => prev.filter(id => id !== servicoId))
    toast.success('Serviço removido')
  }

  const combosFiltradosProduto = useMemo(() =>
    faccaoServicosIds.map(sid => todoServicos.find(s => s.id === sid)).filter(Boolean).filter(s =>
      !buscaProduto || norm(s!.nome).includes(norm(buscaProduto))
    ) as Servico[]
  , [faccaoServicosIds, todoServicos, buscaProduto])

  const combosFiltradosDesconto = useMemo(() =>
    faccaoServicosIds.map(sid => todoServicos.find(s => s.id === sid)).filter(Boolean).filter(s =>
      s!.desconto_pct > 0 && (!buscaDesconto || norm(s!.nome).includes(norm(buscaDesconto)))
    ) as Servico[]
  , [faccaoServicosIds, todoServicos, buscaDesconto])

  const produtosParaDesconto = useMemo(() => todosProdutos.filter(p => !descontosItem.some(d => d.item_id === p.id)), [todosProdutos, descontosItem])

  const descontosFiltrados = useMemo(() => descontosItem.filter(d => {
    if (!buscaDesconto) return true
    const nome = todosProdutos.find(p => p.id === d.item_id)?.nome ?? ''
    return norm(nome).includes(norm(buscaDesconto))
  }), [descontosItem, buscaDesconto, todosProdutos])

  const extrasFiltrados = useMemo(() => produtosExtras.filter(e => {
    if (!buscaDesconto) return true
    return norm(e.nome).includes(norm(buscaDesconto))
  }), [produtosExtras, buscaDesconto])

  function abrirNovoDesconto() {
    setDescontoForm({ item_id: '', desconto_pct: '' })
    setDescontoItemDialog({ item: null })
  }

  function abrirEditarDesconto(d: DescontoItem) {
    setDescontoForm({ item_id: d.item_id, desconto_pct: String(d.desconto_pct) })
    setDescontoItemDialog({ item: d })
  }

  async function handleSalvarDesconto() {
    if (!descontoForm.item_id) { toast.error('Selecione um produto'); return }
    const pct = parseFloat(descontoForm.desconto_pct)
    if (isNaN(pct) || pct < 0 || pct > 100) { toast.error('Desconto deve ser entre 0 e 100'); return }
    setDescontoSaving(true)
    const row = { faccao_id: faccao.id, item_id: descontoForm.item_id, desconto_pct: pct }
    const { data, error } = await sb().from('faccao_desconto_por_item').upsert(row, { onConflict: 'faccao_id,item_id' }).select().single()
    setDescontoSaving(false)
    if (error) { toast.error('Erro ao salvar desconto'); return }
    setDescontosItem(prev => [...prev.filter(d => d.item_id !== descontoForm.item_id), data as DescontoItem])
    setDescontoItemDialog(null)
    toast.success('Desconto salvo')
  }

  async function handleRemoverDesconto(d: DescontoItem) {
    const { error } = await sb().from('faccao_desconto_por_item').delete().eq('id', d.id)
    if (error) { toast.error('Erro ao remover'); return }
    setDescontosItem(prev => prev.filter(x => x.id !== d.id))
    toast.success('Desconto removido')
  }

  async function handleSalvarLote() {
    const itens = Object.entries(loteSelecao).filter(([, v]) => v !== '')
    if (itens.length === 0) { toast.error('Selecione pelo menos um produto'); return }
    setLoteSaving(true)
    const rows = itens.map(([item_id, pct]) => ({ faccao_id: faccao.id, item_id, desconto_pct: parseFloat(pct) || 0 }))
    const { error } = await sb().from('faccao_desconto_por_item').upsert(rows, { onConflict: 'faccao_id,item_id' })
    setLoteSaving(false)
    if (error) { toast.error('Erro ao salvar'); return }
    const { data } = await sb().from('faccao_desconto_por_item').select('*').eq('faccao_id', faccao.id)
    setDescontosItem((data ?? []) as DescontoItem[])
    setNovoDescontoModal(false)
    setLoteSelecao({})
    toast.success(`${itens.length} produto(s) salvo(s)`)
  }

  async function handleSalvarManual() {
    if (!manualForm.nome.trim()) { toast.error('Nome obrigatório'); return }
    setManualSaving(true)
    const row = { faccao_id: faccao.id, nome: manualForm.nome.trim(), valor_sujo: manualForm.valor_sujo ? parseFloat(manualForm.valor_sujo) : null, valor_limpo: manualForm.valor_limpo ? parseFloat(manualForm.valor_limpo) : null }
    if (editandoExtra) {
      const { error } = await sb().from('faccao_produto_extra').update(row).eq('id', editandoExtra.id)
      setManualSaving(false)
      if (error) { toast.error('Erro ao salvar'); return }
      setProdutosExtras(prev => prev.map(e => e.id === editandoExtra.id ? { ...e, ...row } : e))
      setEditandoExtra(null)
    } else {
      const { data, error } = await sb().from('faccao_produto_extra').insert(row).select().single()
      setManualSaving(false)
      if (error) { toast.error('Erro ao salvar'); return }
      setProdutosExtras(prev => [...prev, data as FaccaoProdutoExtra])
    }
    setNovoDescontoModal(false)
    setManualForm({ nome: '', valor_sujo: '', valor_limpo: '' })
    toast.success('Salvo')
  }

  async function handleRemoverExtra(id: string) {
    const { error } = await sb().from('faccao_produto_extra').delete().eq('id', id)
    if (error) { toast.error('Erro ao remover'); return }
    setProdutosExtras(prev => prev.filter(e => e.id !== id))
    toast.success('Removido')
  }

  function abrirNovoDescontoModal() {
    setLoteSelecao({})
    setManualForm({ nome: '', valor_sujo: '', valor_limpo: '' })
    setEditandoExtra(null)
    setNovoDescontoTab('lote')
    setNovoDescontoModal(true)
  }

  function openEditPreco(produto: Produto) {
    const existing = faccaoPrecos.find(p => p.item_id === produto.id)
    setPrecoForm({
      tipo: existing?.tipo ?? 'fixo',
      percentual: existing?.percentual?.toString() ?? '',
      preco_sujo: existing?.preco_sujo?.toString() ?? '',
      preco_limpo: existing?.preco_limpo?.toString() ?? '',
      parceria_tipo: (existing?.parceria_tipo as 'fixo' | 'percentual') ?? 'fixo',
      parceria_pct: existing?.parceria_pct?.toString() ?? '',
      preco_sujo_parceria: existing?.preco_sujo_parceria?.toString() ?? '',
      preco_limpo_parceria: existing?.preco_limpo_parceria?.toString() ?? '',
    })
    const faixasExistentes = (faixasPrecos[produto.id] ?? []).sort((a, b) => a.quantidade_min - b.quantidade_min)
    setFaixasForm(faixasExistentes.map(f => ({
      qtd_min: String(f.quantidade_min),
      preco_sujo: f.preco_sujo != null ? String(f.preco_sujo) : '',
      preco_limpo: f.preco_limpo != null ? String(f.preco_limpo) : '',
    })))
    setEditPreco(produto)
  }

  function handleAdicionarProduto() {
    if (!newItemId) return
    const produto = todosProdutos.find(p => p.id === newItemId)
    if (!produto) return
    setAddingPreco(false); setNewItemId(''); setBuscaNovoPreco('')
    openEditPreco(produto)
  }

  async function handleSalvarPreco() {
    if (!editPreco) return
    setPrecoSaving(true)
    const temParceria = precoForm.parceria_pct || precoForm.preco_sujo_parceria || precoForm.preco_limpo_parceria
    const row = {
      faccao_id: faccao.id, item_id: editPreco.id, tipo: precoForm.tipo,
      percentual: precoForm.tipo === 'percentual' && precoForm.percentual ? parseFloat(precoForm.percentual) : null,
      preco_sujo: precoForm.preco_sujo ? parseFloat(precoForm.preco_sujo) : null,
      preco_limpo: precoForm.preco_limpo ? parseFloat(precoForm.preco_limpo) : null,
      parceria_tipo: temParceria ? precoForm.parceria_tipo : null,
      parceria_pct: temParceria && precoForm.parceria_tipo === 'percentual' && precoForm.parceria_pct ? parseFloat(precoForm.parceria_pct) : null,
      preco_sujo_parceria: temParceria && precoForm.parceria_tipo === 'fixo' && precoForm.preco_sujo_parceria ? parseFloat(precoForm.preco_sujo_parceria) : null,
      preco_limpo_parceria: temParceria && precoForm.parceria_tipo === 'fixo' && precoForm.preco_limpo_parceria ? parseFloat(precoForm.preco_limpo_parceria) : null,
      // campos legados de qtd — zerados, usamos a tabela faixas agora
      desconto_qtd_minima: null, desconto_qtd_tipo: null, desconto_qtd_pct: null,
      desconto_qtd_preco_sujo: null, desconto_qtd_preco_limpo: null,
    }
    const { data, error } = await sb().from('faccao_item_precos').upsert(row, { onConflict: 'faccao_id,item_id' }).select().single()
    if (error) { toast.error('Erro ao salvar preço'); setPrecoSaving(false); return }

    await sb().from('items').update({ eh_compravel: true }).eq('id', editPreco.id)

    // Salvar faixas: apaga as antigas e insere as novas
    await sb().from('faccao_item_preco_faixas').delete().eq('faccao_id', faccao.id).eq('item_id', editPreco.id)
    const faixasValidas = faixasForm.filter(f => f.qtd_min && parseInt(f.qtd_min) > 0)
    if (faixasValidas.length > 0) {
      await sb().from('faccao_item_preco_faixas').insert(faixasValidas.map(f => ({
        faccao_id: faccao.id, item_id: editPreco.id,
        quantidade_min: parseInt(f.qtd_min),
        preco_sujo: f.preco_sujo ? parseFloat(f.preco_sujo) : null,
        preco_limpo: f.preco_limpo ? parseFloat(f.preco_limpo) : null,
      })))
    }
    const { data: novasFaixas } = await sb().from('faccao_item_preco_faixas').select('*').eq('faccao_id', faccao.id).eq('item_id', editPreco.id)

    setPrecoSaving(false)
    onUpdateFaccaoPrecos([...faccaoPrecos.filter(p => p.item_id !== editPreco.id), data as FaccaoPreco])
    setFaixasPrecos(prev => ({ ...prev, [editPreco.id]: (novasFaixas ?? []) as FaixaPreco[] }))
    toast.success('Preço salvo')
    setEditPreco(null)
  }

  async function handleRemoverPreco(itemId: string) {
    await Promise.all([
      sb().from('faccao_item_preco_faixas').delete().eq('faccao_id', faccao.id).eq('item_id', itemId),
      sb().from('faccao_item_precos').delete().eq('faccao_id', faccao.id).eq('item_id', itemId),
    ])
    const [{ count: cFac }, { count: cLoja }] = await Promise.all([
      sb().from('faccao_item_precos').select('*', { count: 'exact', head: true }).eq('item_id', itemId),
      sb().from('loja_item_precos').select('*', { count: 'exact', head: true }).eq('item_id', itemId),
    ])
    if ((cFac ?? 0) === 0 && (cLoja ?? 0) === 0) await sb().from('items').update({ eh_compravel: false }).eq('id', itemId)
    onUpdateFaccaoPrecos(faccaoPrecos.filter(p => p.item_id !== itemId))
    setFaixasPrecos(prev => { const n = { ...prev }; delete n[itemId]; return n })
    toast.success('Produto removido')
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent aria-describedby={undefined} className="max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0 pb-2 border-b border-border">
          <div className="flex items-center gap-3">
            <span className="h-5 w-5 rounded-full shrink-0" style={{ background: faccao.cor_tag }} />
            <DialogTitle className="text-lg">{faccao.nome}</DialogTitle>
            {faccao.sigla && <span className="text-xs font-mono text-muted-foreground bg-white/[0.06] px-1.5 py-0.5 rounded border border-white/10">{faccao.sigla}</span>}
            <span className={cn('text-[11px] px-2 py-0.5 rounded-full', faccao.status === 'ativo' ? 'bg-green-500/10 text-green-400' : 'bg-zinc-500/10 text-zinc-500')}>
              {faccao.status === 'ativo' ? 'Ativa' : 'Inativa'}
            </span>
            {faccao.is_darkchat && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 font-bold">DC</span>
            )}
            {faccao.tem_parceria && (
              <span title={faccao.parceria_obs ?? 'Parceria ativa'} className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400">
                <Handshake className="h-3 w-3" />
                Parceria
              </span>
            )}
            <div className="ml-auto flex items-center gap-1.5">
              {linkImagem && (
                <div className="flex items-center gap-1 rounded border border-border bg-white/[0.04] px-2 h-7 max-w-[220px]">
                  <span className="text-[11px] text-muted-foreground truncate flex-1">{linkImagem}</span>
                  <button onClick={copiarLink} title="Copiar link" className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                    {linkCopiado ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              )}
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={handleCompartilhar} disabled={compartilhando} title="Gerar imagem e enviar para imgbb">
                {compartilhando ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImageUp className="h-3 w-3" />}
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={editando ? () => setEditando(false) : abrirEdicao}>
                {editando ? <><X className="h-3 w-3" />Cancelar</> : <><Edit2 className="h-3 w-3" />Editar</>}
              </Button>
            </div>
          </div>
          {(faccao.territorio || faccao.descricao || faccao.deep || faccao.telefone || faccao.desconto_padrao_pct > 0 || faccao.observacoes) && (
            <div className="text-xs text-muted-foreground flex flex-wrap gap-3 pt-1 pl-8">
              {faccao.territorio && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{faccao.territorio}</span>}
              {faccao.descricao && <span>{faccao.descricao}</span>}
              {faccao.deep && <span className="font-mono text-[11px] bg-white/[0.05] px-1.5 py-0.5 rounded border border-white/10">{faccao.deep}</span>}
              {faccao.telefone && <span className="font-mono">{faccao.telefone}</span>}
              {faccao.desconto_padrao_pct > 0 && <span className="text-emerald-400">{faccao.desconto_padrao_pct}% desconto</span>}
              {faccao.observacoes && <span className="italic text-muted-foreground/70">{faccao.observacoes}</span>}
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* Form de edição inline */}
          {editando && (
            <div className="rounded-lg border border-border bg-white/[0.02] p-4 space-y-3">
              <div className="grid grid-cols-[1fr_120px] gap-3">
                <div className="space-y-1"><Label className="text-xs">Nome *</Label><Input value={geralForm.nome} onChange={e => setGeralForm(f => ({ ...f, nome: e.target.value }))} className="h-8 text-sm" /></div>
                <div className="space-y-1"><Label className="text-xs">Sigla</Label><Input value={geralForm.sigla} onChange={e => setGeralForm(f => ({ ...f, sigla: e.target.value }))} placeholder="Ex: CV" className="h-8 text-sm" maxLength={10} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1"><Label className="text-xs">Território</Label><Input value={geralForm.territorio} onChange={e => setGeralForm(f => ({ ...f, territorio: e.target.value }))} className="h-8 text-sm" /></div>
                <div className="space-y-1"><Label className="text-xs">Descrição</Label><Input value={geralForm.descricao} onChange={e => setGeralForm(f => ({ ...f, descricao: e.target.value }))} className="h-8 text-sm" /></div>
                <div className="space-y-1"><Label className="text-xs">Deep</Label><Input value={geralForm.deep} onChange={e => setGeralForm(f => ({ ...f, deep: e.target.value }))} placeholder="Endereço deep web..." className="h-8 text-sm" /></div>
              </div>
              <div>
                <Label className="text-xs">Cor</Label>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {FACTION_COLORS.map(cor => (
                    <button key={cor} onClick={() => setGeralForm(f => ({ ...f, cor_tag: cor }))}
                      className={cn('h-6 w-6 rounded border-2 transition-all flex items-center justify-center', geralForm.cor_tag === cor ? 'border-white/70 scale-110' : 'border-transparent hover:border-white/20')}
                      style={{ background: cor }}>
                      {geralForm.cor_tag === cor && <Check className="h-3 w-3 text-white drop-shadow" />}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {/* Telefone */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Telefone</Label>
                  <Input value={geralForm.telefone}
                    onChange={e => setGeralForm(prev => ({ ...prev, telefone: e.target.value }))}
                    placeholder="(xx) xxxxx-xxxx" className="h-8 text-sm" />
                </div>

                {/* Desconto nos meus produtos */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Desconto nos meus produtos (%)</Label>
                  <Input type="number" min="0" max="100" value={geralForm.desconto_padrao_pct}
                    onChange={e => setGeralForm(prev => ({ ...prev, desconto_padrao_pct: parseFloat(e.target.value) || 0 }))}
                    placeholder="0" className="h-8 text-sm" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Observações internas</Label>
                <Textarea value={geralForm.observacoes} onChange={e => setGeralForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Notas, histórico, informações relevantes..." rows={3} className="text-sm resize-none" />
              </div>
              <div className="space-y-2 rounded-md border border-border/50 p-3 bg-sky-500/[0.03]">
                <div className="flex items-center gap-2">
                  <Switch checked={geralForm.tem_parceria} onCheckedChange={v => setGeralForm(f => ({ ...f, tem_parceria: v }))} />
                  <span className="text-xs font-medium text-muted-foreground">Parceria ativa</span>
                </div>
                {geralForm.tem_parceria && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Observações sobre a parceria</Label>
                    <Textarea value={geralForm.parceria_obs} onChange={e => setGeralForm(f => ({ ...f, parceria_obs: e.target.value }))} placeholder="Detalhes da parceria, acordos, condições..." rows={3} className="text-sm resize-none" />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 rounded-md border border-border/50 p-3 bg-cyan-500/[0.03]">
                <Switch checked={geralForm.is_darkchat} onCheckedChange={v => setGeralForm(f => ({ ...f, is_darkchat: v }))} />
                <span className="text-xs font-medium text-muted-foreground">Facção do Darkchat</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch checked={geralForm.status === 'ativo'} onCheckedChange={v => setGeralForm(f => ({ ...f, status: v ? 'ativo' : 'inativo' }))} />
                  <span className="text-xs text-muted-foreground">{geralForm.status === 'ativo' ? 'Ativa' : 'Inativa'}</span>
                </div>
                <Button size="sm" className="h-7 text-xs" onClick={handleSalvarGeral} disabled={geralSaving}>
                  {geralSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Salvar alterações'}
                </Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-8 items-start">
          {/* Membros - coluna esquerda */}
          <section className="space-y-2">
            <div className="flex items-center gap-3">
              <p className="text-sm font-semibold flex items-center gap-2 shrink-0"><Users className="h-4 w-4 text-muted-foreground" />Membros</p>
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input placeholder="Buscar por nome, vulgo ou telefone..." value={buscaMembro} onChange={e => setBuscaMembro(e.target.value)} className="pl-7 h-7 text-xs" />
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 shrink-0" onClick={abrirNovoMembro}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            {membrosFiltrados.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-5 rounded-lg border border-border border-dashed">
                {buscaMembro ? 'Nenhum resultado' : 'Nenhum membro nesta facção'}
              </p>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="grid grid-cols-[1fr_90px_120px_44px] gap-2 px-3 py-1.5 bg-white/[0.02] border-b border-border text-[10px] text-muted-foreground font-medium">
                  <span>Nome / Vulgo</span><span>Cargo</span><span>Telefone</span><span />
                </div>
                {membrosFiltrados.map((m, idx) => (
                  <div key={m.id} className={cn('grid grid-cols-[1fr_90px_120px_44px] gap-2 items-center px-3 py-2.5', idx < membrosFiltrados.length - 1 && 'border-b border-border/40')}>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="min-w-0">
                        <span className="text-sm font-medium">{m.nome}</span>
                        {m.vulgo && <span className="ml-1.5 text-xs text-muted-foreground">"{m.vulgo}"</span>}
                      </div>
                      {(veiculosPorMembro[m.id] ?? []).map(v => (
                        <span key={v.id} title={`${v.placa ?? 'S/P'}${v.modelo ? ` — ${v.modelo}` : ''}${v.cor ? ` (${v.cor})` : ''}`} className="shrink-0 cursor-default">
                          <Car className="h-3 w-3 text-muted-foreground hover:text-foreground transition-colors" />
                        </span>
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground truncate">{m.cargo_faccao ?? '—'}</span>
                    <span className="text-xs font-mono text-muted-foreground">{m.telefone ?? '—'}</span>
                    <div className="flex gap-0.5">
                      <button onClick={() => abrirEditarMembro(m)} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"><Edit2 className="h-3 w-3" /></button>
                      <button onClick={() => setConfirmDeleteMembro(m)} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-white/[0.06]"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Veículos - coluna direita */}
          <section className="space-y-2">
            <div className="flex items-center gap-3">
              <p className="text-sm font-semibold flex items-center gap-2 shrink-0"><Car className="h-4 w-4 text-muted-foreground" />Veículos</p>
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input placeholder="Buscar por placa ou modelo..." value={buscaVeiculo} onChange={e => setBuscaVeiculo(e.target.value)} className="pl-7 h-7 text-xs" />
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 shrink-0" onClick={abrirNovoVeiculo}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            {veiculosFiltrados.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-5 rounded-lg border border-border border-dashed">
                {buscaVeiculo ? 'Nenhum resultado' : 'Nenhum veículo desta facção'}
              </p>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="grid grid-cols-[90px_1fr_60px_1fr_44px] gap-2 px-3 py-1.5 bg-white/[0.02] border-b border-border text-[10px] text-muted-foreground font-medium">
                  <span>Placa</span><span>Modelo</span><span>Cor</span><span>Proprietário</span><span />
                </div>
                {veiculosFiltrados.map((v, idx) => {
                  const dono = v.proprietario_tipo === 'membro' ? membros.find(m => m.id === v.proprietario_id) : null
                  return (
                  <div key={v.id} className={cn('grid grid-cols-[90px_1fr_60px_1fr_44px] gap-2 items-center px-3 py-2.5', idx < veiculosFiltrados.length - 1 && 'border-b border-border/40')}>
                    <span className="font-mono text-sm font-semibold">{v.placa ?? '—'}</span>
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="text-sm text-muted-foreground truncate">{v.modelo ?? '—'}</span>
                      {v.modelo && (
                        <button
                          type="button"
                          title={`Buscar "${v.modelo} GTA" no Google Imagens`}
                          onClick={() => window.open(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(v.modelo! + ' GTA')}`, '_blank')}
                          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">{v.cor ?? '—'}</span>
                    <span className="text-xs truncate">{dono ? dono.nome : v.proprietario_tipo === 'faccao' ? 'Facção' : <span className="text-muted-foreground/40 italic">Desconhecido</span>}</span>
                    <div className="flex gap-0.5">
                      <button onClick={() => abrirEditarVeiculo(v)} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"><Edit2 className="h-3 w-3" /></button>
                      <button onClick={() => setConfirmDeleteVeiculo(v)} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-white/[0.06]"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  </div>
                  )
                })}
              </div>
            )}
          </section>
          </div>{/* end grid 2 colunas */}

          {/* ── Produtos + Descontos — lado a lado ── */}
          <div className="grid grid-cols-2 gap-8 items-start border-t border-border pt-4">

          {/* ── Coluna esquerda: Produto deles ── */}
          <section className="space-y-2">
            <div className="flex items-center gap-3">
              <p className="text-sm font-semibold flex items-center gap-2 shrink-0"><Package className="h-4 w-4 text-muted-foreground" />Produto deles ({precosFiltrados.length + faccaoServicosIds.length})</p>
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input placeholder="Buscar produto..." value={buscaProduto} onChange={e => setBuscaProduto(e.target.value)} className="pl-7 h-7 text-xs" />
              </div>
              <div className="flex items-center gap-0.5 shrink-0 border border-border/50 rounded overflow-hidden">
                {(['xs', 'sm', 'base'] as TamanhoTexto[]).map(t => (
                  <button key={t} onClick={() => mudarTamanho(t)} title={t === 'xs' ? 'Pequeno' : t === 'sm' ? 'Médio' : 'Grande'}
                    className={cn('px-1.5 py-1 text-[9px] font-mono transition-colors', tamanhoTexto === t ? 'bg-primary/20 text-primary' : 'text-muted-foreground/50 hover:text-muted-foreground')}>
                    {t === 'xs' ? 'P' : t === 'sm' ? 'M' : 'G'}
                  </button>
                ))}
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 shrink-0" onClick={() => setAddingPreco(true)} title="Adicionar produto">
                <Plus className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 shrink-0" onClick={() => setServicoAddOpen(true)} disabled={todoServicos.filter(s => !faccaoServicosIds.includes(s.id)).length === 0} title="Adicionar combo">
                <Layers className="h-3 w-3" />
              </Button>
            </div>
            {servicoAddOpen && (
              <div className="flex gap-2 items-center">
                <Select value={novoServicoId} onValueChange={setNovoServicoId}>
                  <SelectTrigger className="flex-1 h-8 text-sm"><SelectValue placeholder="Selecionar combo..." /></SelectTrigger>
                  <SelectContent>
                    {todoServicos.filter(s => !faccaoServicosIds.includes(s.id)).map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" className="h-8 px-3" onClick={handleAdicionarServico} disabled={!novoServicoId || servicoSaving}>
                  {servicoSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                </Button>
                <Button variant="ghost" size="sm" className="h-8 px-3" onClick={() => { setServicoAddOpen(false); setNovoServicoId('') }}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            {(precosFiltrados.length === 0 && combosFiltradosProduto.length === 0) ? (
              <p className="text-xs text-muted-foreground text-center py-6 rounded-lg border border-border border-dashed">
                {buscaProduto ? 'Nenhum resultado' : 'Nenhum produto cadastrado'}
              </p>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                {precosFiltrados.map((preco, idx) => {
                  const produto = todosProdutos.find(p => p.id === preco.item_id)
                  const temParceria = preco.parceria_pct != null || preco.preco_sujo_parceria != null || preco.preco_limpo_parceria != null
                  const faixas = (faixasPrecos[preco.item_id] ?? []).sort((a, b) => a.quantidade_min - b.quantidade_min)
                  const minFaixa = faixas[0]?.quantidade_min
                  const allSujo = [preco.preco_sujo, ...faixas.map(f => f.preco_sujo)].filter((p): p is number => p != null)
                  const menorSujo: number | null = allSujo.length > 0 ? Math.min(...allSujo) : null
                  const allLimpo = [preco.preco_limpo, ...faixas.map(f => f.preco_limpo)].filter((p): p is number => p != null)
                  const menorLimpo: number | null = allLimpo.length > 0 ? Math.min(...allLimpo) : null
                  const expandido = produtosExpandidos.has(preco.item_id)
                  const tipoIcone = temParceria ? '⭐' : faixas.length > 0 ? '📦' : '🟢'
                  const tipoTitulo = temParceria ? 'Parceria' : faixas.length > 0 ? 'Por quantidade' : 'Normal'
                  return (
                    <div key={preco.item_id} className={cn(idx < precosFiltrados.length - 1 && 'border-b border-border/40')}>
                      {/* Linha compacta */}
                      <div
                        className={cn('flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-white/[0.03] transition-colors', expandido && 'bg-white/[0.02]')}
                        onClick={() => setProdutosExpandidos(prev => { const n = new Set(prev); expandido ? n.delete(preco.item_id) : n.add(preco.item_id); return n })}>
                        <span className="text-sm leading-none shrink-0" title={tipoTitulo}>{tipoIcone}</span>
                        <span className={cn(itemNomeClass, 'font-medium flex-1 min-w-0 truncate')}>{produto?.nome ?? '—'}</span>
                        <span className="text-xs tabular-nums text-muted-foreground/70 shrink-0">{fmt(menorSujo)}</span>
                        <span className="text-xs tabular-nums font-medium shrink-0">{fmt(menorLimpo)}</span>
                        <ChevronDown className={cn('h-3 w-3 text-muted-foreground/50 shrink-0 transition-transform', expandido && 'rotate-180')} />
                        <div className="flex gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                          <button onClick={() => openEditPreco({ id: preco.item_id, nome: produto?.nome ?? '' })} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06]" title="Editar preço"><Edit2 className="h-3 w-3" /></button>
                          <button onClick={() => handleRemoverPreco(preco.item_id)} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-white/[0.06]" title="Remover"><X className="h-3 w-3" /></button>
                        </div>
                      </div>
                      {/* Detalhe expandido */}
                      {expandido && (
                        <div className="px-4 pb-3 bg-white/[0.01]">
                          <div className="rounded border border-border/40 overflow-hidden text-xs">
                            <div className="grid grid-cols-[110px_1fr_1fr] divide-x divide-border/30">
                              <div className="px-2 py-1 bg-white/[0.02] text-[10px] text-muted-foreground/60 font-medium">Faixa</div>
                              <div className="px-2 py-1 bg-white/[0.02] text-[10px] text-muted-foreground/60 font-medium text-right">Sujo</div>
                              <div className="px-2 py-1 bg-white/[0.02] text-[10px] text-muted-foreground/60 font-medium text-right">Limpo</div>
                            </div>
                            <div className="grid grid-cols-[110px_1fr_1fr] divide-x divide-border/30 border-t border-border/30">
                              <div className="px-2 py-1.5 text-muted-foreground/70 tabular-nums text-[11px]">
                                {faixas.length > 0 ? `1 – ${minFaixa - 1} un.` : '1+ un.'}
                              </div>
                              <div className="px-2 py-1.5 text-right tabular-nums font-medium">{fmt(preco.preco_sujo)}</div>
                              <div className="px-2 py-1.5 text-right tabular-nums font-medium">{fmt(preco.preco_limpo)}</div>
                            </div>
                            {faixas.map((f, i) => (
                              <div key={i} className="grid grid-cols-[110px_1fr_1fr] divide-x divide-border/30 border-t border-border/20 bg-emerald-500/[0.04]">
                                <div className="px-2 py-1.5 text-emerald-400/80 tabular-nums text-[11px]">{f.quantidade_min}+ un.</div>
                                <div className="px-2 py-1.5 text-right tabular-nums text-emerald-400/90 font-medium">{fmt(f.preco_sujo)}</div>
                                <div className="px-2 py-1.5 text-right tabular-nums text-emerald-400/90 font-medium">{fmt(f.preco_limpo)}</div>
                              </div>
                            ))}
                            {temParceria && (
                              <div className="grid grid-cols-[110px_1fr_1fr] divide-x divide-border/30 border-t border-border/20 bg-sky-500/[0.04]">
                                <div className="px-2 py-1.5 text-sky-400/70 text-[11px]">parceria</div>
                                {preco.parceria_tipo === 'percentual' ? (
                                  <div className="col-span-2 px-2 py-1.5 text-sky-400/70 text-[11px]">-{preco.parceria_pct}% sobre o normal</div>
                                ) : (
                                  <>
                                    <div className="px-2 py-1.5 text-right tabular-nums text-sky-400/80">{fmt(preco.preco_sujo_parceria)}</div>
                                    <div className="px-2 py-1.5 text-right tabular-nums text-sky-400/80">{fmt(preco.preco_limpo_parceria)}</div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
                {combosFiltradosProduto.map((s, idx) => (
                  <div key={s.id} className={cn('flex items-center gap-2 px-3 py-2', (precosFiltrados.length > 0 || idx > 0) && 'border-t border-border/40')}>
                    <span title="Combo/Serviço"><Layers className="h-3 w-3 text-primary/50 shrink-0" /></span>
                    <span className={cn(itemNomeClass, 'font-medium flex-1 min-w-0 truncate')}>{s.nome}</span>
                    {s.preco_sujo != null && <span className="text-xs tabular-nums text-muted-foreground/70 shrink-0">{fmt(s.preco_sujo)}</span>}
                    {s.preco_limpo != null && <span className="text-xs tabular-nums font-medium shrink-0">{fmt(s.preco_limpo)}</span>}
                    <button onClick={() => handleRemoverServico(s.id)} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-white/[0.06]" title="Remover"><X className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Coluna direita: Desconto nosso ── */}
          <section className="space-y-2">
            <div className="flex items-center gap-3">
              <p className="text-sm font-semibold flex items-center gap-2 shrink-0"><Percent className="h-4 w-4 text-muted-foreground" />Desconto nosso</p>
              {faccao.desconto_padrao_pct > 0 && <span className="text-[11px] text-muted-foreground/60">{faccao.desconto_padrao_pct}% padrão</span>}
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input placeholder="Buscar produto..." value={buscaDesconto} onChange={e => setBuscaDesconto(e.target.value)} className="pl-7 h-7 text-xs" />
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 shrink-0" onClick={abrirNovoDescontoModal}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            {(loadingDescontos || loadingExtras) ? (
              <div className="flex justify-center py-5"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
            ) : (descontosFiltrados.length === 0 && extrasFiltrados.length === 0) ? (
              <p className="text-xs text-muted-foreground text-center py-5 rounded-lg border border-border border-dashed">
                {buscaDesconto ? 'Nenhum resultado' : 'Nenhum produto — usando desconto geral'}
              </p>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                {descontosFiltrados.map((d, idx) => {
                  const produto = todosProdutos.find(p => p.id === d.item_id)
                  const isLast = idx === descontosFiltrados.length - 1 && extrasFiltrados.length === 0
                  return (
                    <div key={d.id} className={cn('flex items-center gap-2 px-3 py-2', !isLast && 'border-b border-border/40')}>
                      <span className="text-[11px] shrink-0 text-muted-foreground/50" title="Produto do sistema">🎯</span>
                      <span className={cn(itemNomeClass, 'font-medium flex-1 min-w-0 truncate')}>{produto?.nome ?? '—'}</span>
                      <span className="text-xs tabular-nums text-emerald-400 shrink-0">-{d.desconto_pct}%</span>
                      <div className="flex gap-0.5 shrink-0">
                        <button onClick={() => abrirEditarDesconto(d)} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"><Edit2 className="h-3 w-3" /></button>
                        <button onClick={() => handleRemoverDesconto(d)} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-white/[0.06]"><X className="h-3 w-3" /></button>
                      </div>
                    </div>
                  )
                })}
                {extrasFiltrados.map((e, idx) => (
                  <div key={e.id} className={cn('flex items-center gap-2 px-3 py-2', (idx < extrasFiltrados.length - 1 || combosFiltradosDesconto.length > 0) && 'border-b border-border/40')}>
                    <span className="text-[11px] shrink-0 text-muted-foreground/50" title="Produto manual">📝</span>
                    <span className={cn(itemNomeClass, 'font-medium flex-1 min-w-0 truncate')}>{e.nome}</span>
                    {e.valor_sujo != null && <span className="text-xs tabular-nums text-muted-foreground/70 shrink-0">{fmt(e.valor_sujo)}</span>}
                    {e.valor_limpo != null && <span className="text-xs tabular-nums font-medium shrink-0">{fmt(e.valor_limpo)}</span>}
                    <div className="flex gap-0.5 shrink-0">
                      <button onClick={() => { setEditandoExtra(e); setManualForm({ nome: e.nome, valor_sujo: e.valor_sujo != null ? String(e.valor_sujo) : '', valor_limpo: e.valor_limpo != null ? String(e.valor_limpo) : '' }); setNovoDescontoTab('manual'); setNovoDescontoModal(true) }} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"><Edit2 className="h-3 w-3" /></button>
                      <button onClick={() => handleRemoverExtra(e.id)} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-white/[0.06]"><X className="h-3 w-3" /></button>
                    </div>
                  </div>
                ))}
                {combosFiltradosDesconto.map((s, idx) => (
                  <div key={s.id} className={cn('flex items-center gap-2 px-3 py-2', idx < combosFiltradosDesconto.length - 1 && 'border-b border-border/40')}>
                    <span title="Combo/Serviço"><Layers className="h-3 w-3 text-primary/50 shrink-0" /></span>
                    <span className={cn(itemNomeClass, 'font-medium flex-1 min-w-0 truncate')}>{s.nome}</span>
                    <span className="text-xs tabular-nums text-emerald-400 shrink-0">-{s.desconto_pct}%</span>
                  </div>
                ))}
              </div>
            )}
          </section>
          </div>{/* end grid produtos + descontos */}

          {/* ── Seção DarkChat ── */}
          {faccao.is_darkchat && (
            <div className="border-t border-border pt-4 space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <span className="text-cyan-400 font-bold text-xs px-1.5 py-0.5 rounded bg-cyan-500/10">DC</span>
                  Nicks DarkChat
                </p>
                {loadingDarkchat && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              </div>
              {darkchatVendas === null ? (
                <p className="text-xs text-muted-foreground italic">Carregando...</p>
              ) : darkchatVendas.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-5 rounded-lg border border-border border-dashed">
                  Nenhuma venda registrada para esta facção
                </p>
              ) : (() => {
                const nicks = [...new Set(darkchatVendas.map(v => v.cliente_nome).filter(Boolean))]
                return (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <div className="grid grid-cols-[1fr_1fr_80px] gap-2 px-3 py-1.5 bg-white/[0.02] border-b border-border text-[10px] text-muted-foreground font-medium">
                      <span>Nick / Deep</span><span>Identificado nas investigações</span><span className="text-right">Vendas</span>
                    </div>
                    {nicks.map(nick => {
                      const identificado = darkchatMembros.find(m => norm(m.deep) === norm(nick))
                      const qtd = darkchatVendas.filter(v => v.cliente_nome === nick).length
                      return (
                        <div key={nick} className="grid grid-cols-[1fr_1fr_80px] gap-2 items-center px-3 py-2.5 border-b border-border/40 last:border-0">
                          <span className="text-sm font-mono font-medium">{nick}</span>
                          {identificado ? (
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="font-medium">{identificado.nome}</span>
                              {identificado.faccoes?.nome && (
                                <span className="text-[10px] text-muted-foreground">({identificado.faccoes.nome})</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground/40 italic">Não identificado</span>
                          )}
                          <span className="text-xs text-right text-muted-foreground">{qtd}</span>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          )}

        </div>
      </DialogContent>

      {/* Modal: Desconto por Item */}
      <Dialog open={!!descontoItemDialog} onOpenChange={v => !v && setDescontoItemDialog(null)}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-xs">
          <DialogHeader><DialogTitle className="text-sm">{descontoItemDialog?.item ? 'Editar Desconto' : 'Novo Desconto por Item'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            {!descontoItemDialog?.item && (
              <div className="space-y-1.5">
                <Label className="text-xs">Produto</Label>
                <Select value={descontoForm.item_id || '_none'} onValueChange={v => setDescontoForm(f => ({ ...f, item_id: v === '_none' ? '' : v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>{produtosParaDesconto.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {descontoItemDialog?.item && (
              <p className="text-sm font-medium">{todosProdutos.find(p => p.id === descontoItemDialog.item!.item_id)?.nome}</p>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Desconto (%)</Label>
              <Input type="number" min="0" max="100" placeholder="Ex: 15" value={descontoForm.desconto_pct}
                onChange={e => setDescontoForm(f => ({ ...f, desconto_pct: e.target.value }))} className="h-8 text-sm" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setDescontoItemDialog(null)}>Cancelar</Button>
            <Button size="sm" onClick={handleSalvarDesconto} disabled={descontoSaving}>{descontoSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Salvar'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Desconto nosso — novo/lote/manual */}
      <Dialog open={novoDescontoModal} onOpenChange={v => { if (!v) { setNovoDescontoModal(false); setLoteSelecao({}); setManualForm({ nome: '', valor_sujo: '', valor_limpo: '' }); setEditandoExtra(null) } }}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-md max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader><DialogTitle className="text-sm">{editandoExtra ? 'Editar produto manual' : 'Desconto nosso — Adicionar'}</DialogTitle></DialogHeader>
          {!editandoExtra && (
            <div className="flex gap-0 border-b border-border shrink-0 -mx-6 px-6">
              <button onClick={() => setNovoDescontoTab('lote')}
                className={cn('px-4 py-2 text-xs font-medium transition-colors border-b-2', novoDescontoTab === 'lote' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>
                Produtos cadastrados
              </button>
              <button onClick={() => setNovoDescontoTab('manual')}
                className={cn('px-4 py-2 text-xs font-medium transition-colors border-b-2', novoDescontoTab === 'manual' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>
                Produto manual
              </button>
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            {(novoDescontoTab === 'lote' && !editandoExtra) && (
              <div className="py-3 space-y-1">
                <p className="text-[11px] text-muted-foreground pb-1">Informe o desconto (%) para os produtos desejados. Deixe em branco para pular.</p>
                {produtosParaDesconto.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Todos os produtos já têm desconto cadastrado.</p>
                ) : (
                  produtosParaDesconto.map(p => (
                    <div key={p.id} className="flex items-center gap-2 py-1.5 border-b border-border/20 last:border-0">
                      <span className="text-xs flex-1 min-w-0 truncate">{p.nome}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <Input
                          type="number" min="0" max="100" placeholder="%" step="0.5"
                          value={loteSelecao[p.id] ?? ''}
                          onChange={e => setLoteSelecao(prev => { const n = { ...prev }; if (e.target.value === '') delete n[p.id]; else n[p.id] = e.target.value; return n })}
                          className="h-7 text-xs w-16 text-right" />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            {(novoDescontoTab === 'manual' || editandoExtra) && (
              <div className="py-3 space-y-3">
                <p className="text-[11px] text-muted-foreground">Produto específico desta facção, não cadastrado globalmente.</p>
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome *</Label>
                  <Input placeholder="Nome do produto" value={manualForm.nome}
                    onChange={e => setManualForm(f => ({ ...f, nome: e.target.value }))} className="h-8 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Valor Sujo</Label>
                    <Input type="number" min="0" placeholder="0" value={manualForm.valor_sujo}
                      onChange={e => setManualForm(f => ({ ...f, valor_sujo: e.target.value }))} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Valor Limpo</Label>
                    <Input type="number" min="0" placeholder="0" value={manualForm.valor_limpo}
                      onChange={e => setManualForm(f => ({ ...f, valor_limpo: e.target.value }))} className="h-8 text-sm" />
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-border shrink-0">
            <Button variant="outline" size="sm" onClick={() => { setNovoDescontoModal(false); setLoteSelecao({}); setManualForm({ nome: '', valor_sujo: '', valor_limpo: '' }); setEditandoExtra(null) }}>Cancelar</Button>
            {(novoDescontoTab === 'lote' && !editandoExtra) ? (
              <Button size="sm" onClick={handleSalvarLote} disabled={loteSaving || Object.keys(loteSelecao).length === 0}>
                {loteSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : `Salvar${Object.keys(loteSelecao).length > 0 ? ` (${Object.keys(loteSelecao).length})` : ''}`}
              </Button>
            ) : (
              <Button size="sm" onClick={handleSalvarManual} disabled={manualSaving || !manualForm.nome.trim()}>
                {manualSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Salvar'}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Selecionar produto */}
      <Dialog open={addingPreco} onOpenChange={v => { if (!v) { setAddingPreco(false); setNewItemId(''); setBuscaNovoPreco('') } }}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-xs">
          <DialogHeader><DialogTitle className="text-sm">Adicionar produto</DialogTitle></DialogHeader>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              autoFocus
              placeholder="Buscar produto..."
              value={buscaNovoPreco}
              onChange={e => { setBuscaNovoPreco(e.target.value); setNewItemId('') }}
              className={cn('h-9 text-sm pl-8', newItemId && 'border-primary')}
            />
            {buscaNovoPreco && !newItemId && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-52 overflow-y-auto">
                {produtosDisponiveis.filter(p => norm(p.nome).includes(norm(buscaNovoPreco))).length === 0
                  ? (
                    <button onClick={handleCriarProduto} disabled={criandoProduto}
                      className="w-full text-left px-3 py-2 text-xs text-primary hover:bg-accent transition-colors flex items-center gap-1.5 disabled:opacity-50">
                      {criandoProduto ? <Loader2 className="h-3 w-3 animate-spin shrink-0" /> : <Plus className="h-3 w-3 shrink-0" />}
                      Cadastrar &ldquo;{buscaNovoPreco}&rdquo;
                    </button>
                  )
                  : produtosDisponiveis
                      .filter(p => norm(p.nome).includes(norm(buscaNovoPreco)))
                      .map(p => (
                        <button key={p.id} className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors" onClick={() => { setNewItemId(p.id); setBuscaNovoPreco(p.nome) }}>
                          {p.nome}
                        </button>
                      ))
                }
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setAddingPreco(false); setNewItemId(''); setBuscaNovoPreco('') }}>Cancelar</Button>
            <Button size="sm" onClick={handleAdicionarProduto} disabled={!newItemId}>Continuar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar preço */}
      <Dialog open={!!editPreco} onOpenChange={v => !v && setEditPreco(null)}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-sm font-semibold">Preço — {editPreco?.nome}</DialogTitle></DialogHeader>
          <div className="space-y-0 divide-y divide-border/40">

            {/* ── Preço principal ── */}
            <div className="space-y-3 pb-5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground pt-1">Preço principal</p>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo</Label>
                <Select value={precoForm.tipo} onValueChange={v => setPrecoForm(f => ({ ...f, tipo: v as 'percentual' | 'fixo' }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixo">Valor fixo (sujo / limpo)</SelectItem>
                    <SelectItem value="percentual">Percentual sobre referência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {precoForm.tipo === 'percentual' ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">% sobre referência <span className="text-muted-foreground">(positivo = desconto)</span></Label>
                  <Input type="number" placeholder="Ex: 10" value={precoForm.percentual} onChange={e => setPrecoForm(f => ({ ...f, percentual: e.target.value }))} className="h-8 text-sm" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label className="text-xs">Preço Sujo</Label><Input type="number" placeholder="0" value={precoForm.preco_sujo} onChange={e => setPrecoForm(f => ({ ...f, preco_sujo: e.target.value }))} className="h-8 text-sm" /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Preço Limpo</Label><Input type="number" placeholder="0" value={precoForm.preco_limpo} onChange={e => setPrecoForm(f => ({ ...f, preco_limpo: e.target.value }))} className="h-8 text-sm" /></div>
                </div>
              )}
            </div>

            {/* ── Faixas de quantidade ── */}
            <div className="space-y-3 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Preço por quantidade</p>
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5">Cada faixa sobrescreve o preço base quando a quantidade atingir o mínimo</p>
                </div>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                  onClick={() => setFaixasForm(prev => [...prev, { qtd_min: '', preco_sujo: '', preco_limpo: '' }])}>
                  <Plus className="h-3 w-3" />Faixa
                </Button>
              </div>
              {faixasForm.length === 0 ? (
                <p className="text-xs text-muted-foreground/50 italic py-2">Sem faixas de quantidade. Clique em &quot;+ Faixa&quot; para adicionar.</p>
              ) : (
                <div className="rounded-md border border-border overflow-hidden">
                  <div className="grid grid-cols-[120px_1fr_1fr_32px] gap-2 px-3 py-1.5 bg-white/[0.02] text-[10px] text-muted-foreground font-medium">
                    <span>A partir de (un.)</span><span className="text-right">Sujo (R$)</span><span className="text-right">Limpo (R$)</span><span />
                  </div>
                  {faixasForm.map((f, i) => (
                    <div key={i} className="grid grid-cols-[120px_1fr_1fr_32px] gap-2 items-center px-3 py-2 border-t border-border/30">
                      <Input type="number" min="2" placeholder="Ex: 1000"
                        value={f.qtd_min}
                        onChange={e => setFaixasForm(prev => prev.map((x, j) => j === i ? { ...x, qtd_min: e.target.value } : x))}
                        className="h-7 text-xs" />
                      <Input type="number" min="0" placeholder="—"
                        value={f.preco_sujo}
                        onChange={e => setFaixasForm(prev => prev.map((x, j) => j === i ? { ...x, preco_sujo: e.target.value } : x))}
                        className="h-7 text-xs text-right" />
                      <Input type="number" min="0" placeholder="—"
                        value={f.preco_limpo}
                        onChange={e => setFaixasForm(prev => prev.map((x, j) => j === i ? { ...x, preco_limpo: e.target.value } : x))}
                        className="h-7 text-xs text-right" />
                      <button onClick={() => setFaixasForm(prev => prev.filter((_, j) => j !== i))}
                        className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {/* Pré-visualização */}
                  {(precoForm.preco_sujo || precoForm.preco_limpo) && faixasForm.some(f => f.qtd_min) && (
                    <div className="border-t border-border/30 bg-white/[0.01] px-3 py-2">
                      <p className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-wide mb-1.5">Pré-visualização</p>
                      <div className="space-y-1">
                        {(() => {
                          const faixasOrdenadas = [...faixasForm].filter(f => f.qtd_min && parseInt(f.qtd_min) > 0).sort((a, b) => parseInt(a.qtd_min) - parseInt(b.qtd_min))
                          const firstMin = faixasOrdenadas[0] ? parseInt(faixasOrdenadas[0].qtd_min) : null
                          return (
                            <>
                              <div className="flex gap-4 text-[11px]">
                                <span className="text-muted-foreground/60 w-28">1{firstMin ? `–${firstMin - 1}` : '+'} un.</span>
                                <span>Sujo: <span className="font-medium">{precoForm.preco_sujo ? `R$${parseFloat(precoForm.preco_sujo).toLocaleString('pt-BR')}` : '—'}</span></span>
                                <span>Limpo: <span className="font-medium">{precoForm.preco_limpo ? `R$${parseFloat(precoForm.preco_limpo).toLocaleString('pt-BR')}` : '—'}</span></span>
                              </div>
                              {faixasOrdenadas.map((f, i) => (
                                <div key={i} className="flex gap-4 text-[11px] text-emerald-400/80">
                                  <span className="w-28">{f.qtd_min}+ un.</span>
                                  <span>Sujo: <span className="font-medium">{f.preco_sujo ? `R$${parseFloat(f.preco_sujo).toLocaleString('pt-BR')}` : '—'}</span></span>
                                  <span>Limpo: <span className="font-medium">{f.preco_limpo ? `R$${parseFloat(f.preco_limpo).toLocaleString('pt-BR')}` : '—'}</span></span>
                                </div>
                              ))}
                            </>
                          )
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Parceria ── */}
            <div className="space-y-3 py-5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Valor parceria <span className="font-normal normal-case text-muted-foreground/60">(opcional)</span></p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs">Tipo</Label>
                  <Select value={precoForm.parceria_tipo} onValueChange={v => setPrecoForm(f => ({ ...f, parceria_tipo: v as 'fixo' | 'percentual' }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixo">Valor direto (sujo / limpo)</SelectItem>
                      <SelectItem value="percentual">% de desconto sobre o preço normal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {precoForm.parceria_tipo === 'percentual' ? (
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs">Desconto parceria (%)</Label>
                    <Input type="number" min="0" max="100" placeholder="Ex: 10" value={precoForm.parceria_pct} onChange={e => setPrecoForm(f => ({ ...f, parceria_pct: e.target.value }))} className="h-8 text-sm" />
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5"><Label className="text-xs">Sujo parceria</Label><Input type="number" placeholder="—" value={precoForm.preco_sujo_parceria} onChange={e => setPrecoForm(f => ({ ...f, preco_sujo_parceria: e.target.value }))} className="h-8 text-sm" /></div>
                    <div className="space-y-1.5"><Label className="text-xs">Limpo parceria</Label><Input type="number" placeholder="—" value={precoForm.preco_limpo_parceria} onChange={e => setPrecoForm(f => ({ ...f, preco_limpo_parceria: e.target.value }))} className="h-8 text-sm" /></div>
                  </>
                )}
              </div>
            </div>

          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
            <Button variant="outline" size="sm" onClick={() => setEditPreco(null)}>Cancelar</Button>
            <Button size="sm" onClick={handleSalvarPreco} disabled={precoSaving}>{precoSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Salvar preço'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Membro (add/edit) */}
      <Dialog open={!!membroDialog} onOpenChange={v => !v && setMembroDialog(null)}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">{membroDialog?.membro ? 'Editar membro' : 'Novo membro'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 relative">
                <Label className="text-xs">Nome *</Label>
                <Input value={membroForm.nome} onChange={e => handleMembroNomeChange(e.target.value)} className="h-8 text-sm" placeholder="Nome ingame" autoComplete="off" />
                {membroSugestoes.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {membroSugestoes.map(s => (
                      <button key={s.id} className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2" onMouseDown={e => { e.preventDefault(); selecionarMembroExistente(s) }}>
                        <span>{s.nome}</span>
                        {s.vulgo && <span className="text-xs text-muted-foreground">"{s.vulgo}"</span>}
                        {s.telefone && <span className="text-xs font-mono text-muted-foreground ml-auto">{s.telefone}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {membroExistenteId && <p className="text-[11px] text-sky-400">Membro existente — será vinculado</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Vulgo</Label>
                <Input value={membroForm.vulgo} onChange={e => setMembroForm(f => ({ ...f, vulgo: e.target.value }))} className="h-8 text-sm" placeholder="Apelido" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Telefone</Label>
                <Input value={membroForm.telefone} onChange={e => setMembroForm(f => ({ ...f, telefone: e.target.value }))} className="h-8 text-sm" placeholder="Ex: 555-1234" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Cargo</Label>
                <Input value={membroForm.cargo_faccao} onChange={e => setMembroForm(f => ({ ...f, cargo_faccao: e.target.value }))} className="h-8 text-sm" placeholder="Ex: Soldado" />
              </div>
            </div>
            <div className="space-y-1.5 relative">
              <Label className="text-xs">Loja <span className="text-muted-foreground font-normal">(local de trabalho)</span></Label>
              <Input
                placeholder="Buscar loja..."
                value={membroLojaBusca}
                onChange={e => { setMembroLojaBusca(e.target.value); if (!e.target.value) setMembroForm(f => ({ ...f, loja_id: '' })) }}
                className={cn('h-8 text-sm', membroForm.loja_id && 'border-primary')}
                autoComplete="off"
              />
              {membroLojaBusca && !membroForm.loja_id && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-40 overflow-y-auto">
                  {todasLojas.filter(l => norm(l.nome).includes(norm(membroLojaBusca))).length === 0
                    ? <p className="px-3 py-2 text-xs text-muted-foreground">Nenhuma loja encontrada</p>
                    : todasLojas.filter(l => norm(l.nome).includes(norm(membroLojaBusca))).map(l => (
                      <button key={l.id} className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors" onMouseDown={e => { e.preventDefault(); setMembroForm(f => ({ ...f, loja_id: l.id })); setMembroLojaBusca(l.nome) }}>
                        {l.nome}
                      </button>
                    ))
                  }
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Observações</Label>
              <Input value={membroForm.observacoes} onChange={e => setMembroForm(f => ({ ...f, observacoes: e.target.value }))} className="h-8 text-sm" placeholder="Notas..." />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={membroForm.status === 'ativo'} onCheckedChange={v => setMembroForm(f => ({ ...f, status: v ? 'ativo' : 'inativo' }))} />
              <span className="text-xs text-muted-foreground">{membroForm.status === 'ativo' ? 'Ativo' : 'Inativo'}</span>
            </div>
            {/* Veículo inline */}
            <div className="space-y-2 border-t border-border/40 pt-3">
              <button
                type="button"
                onClick={() => setMembroVeiculoInline(f => ({ ...f, ativo: !f.ativo }))}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <Car className="h-3 w-3" />
                <span>{membroVeiculoInline.ativo ? 'Remover veículo' : '+ Veículo (opcional)'}</span>
                <ChevronDown className={cn('h-3 w-3 transition-transform', membroVeiculoInline.ativo && 'rotate-180')} />
              </button>
              {membroVeiculoInline.ativo && (
                <div className="grid grid-cols-3 gap-2 pl-2 border-l border-border/50">
                  <div className="space-y-1">
                    <Label className="text-[10px]">Placa</Label>
                    <Input value={membroVeiculoInline.placa} onChange={e => setMembroVeiculoInline(f => ({ ...f, placa: e.target.value }))} className="h-7 text-xs font-mono" placeholder="ABC1234" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Modelo</Label>
                    <Input value={membroVeiculoInline.modelo} onChange={e => setMembroVeiculoInline(f => ({ ...f, modelo: e.target.value }))} className="h-7 text-xs" placeholder="Sultan" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Cor</Label>
                    <Input value={membroVeiculoInline.cor} onChange={e => setMembroVeiculoInline(f => ({ ...f, cor: e.target.value }))} className="h-7 text-xs" placeholder="Preto" />
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setMembroDialog(null); setMembroVeiculoInline({ ativo: false, placa: '', modelo: '', cor: '' }) }}>Cancelar</Button>
            <Button size="sm" onClick={handleSalvarMembro} disabled={membroSaving}>
              {membroSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Confirmar exclusão de membro */}
      <Dialog open={!!confirmDeleteMembro} onOpenChange={v => !v && setConfirmDeleteMembro(null)}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-xs">
          <DialogHeader><DialogTitle className="text-sm">Excluir membro</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Tem certeza que deseja excluir <strong className="text-foreground">{confirmDeleteMembro?.nome}</strong>? Esta ação não pode ser desfeita.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmDeleteMembro(null)}>Cancelar</Button>
            <Button variant="destructive" size="sm" onClick={() => confirmDeleteMembro && handleDeletarMembro(confirmDeleteMembro)}>Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Veículo (add/edit) */}
      <Dialog open={!!veiculoDialog} onOpenChange={v => !v && setVeiculoDialog(null)}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">{veiculoDialog?.veiculo ? 'Editar veículo' : 'Novo veículo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Placa</Label>
                <Input value={veiculoForm.placa} onChange={e => setVeiculoForm(f => ({ ...f, placa: e.target.value }))} className="h-8 text-sm font-mono" placeholder="ABC1234" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Modelo</Label>
                <Input value={veiculoForm.modelo} onChange={e => setVeiculoForm(f => ({ ...f, modelo: e.target.value }))} className="h-8 text-sm" placeholder="Ex: Sultan" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Cor</Label>
                <Input value={veiculoForm.cor} onChange={e => setVeiculoForm(f => ({ ...f, cor: e.target.value }))} className="h-8 text-sm" placeholder="Ex: Preto" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Proprietário</Label>
              <Select value={veiculoForm.proprietario_tipo} onValueChange={v => { setVeiculoForm(f => ({ ...f, proprietario_tipo: v as typeof f.proprietario_tipo, proprietario_id: '' })); setVeiculoMembroBusca('') }}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="faccao">Facção ({faccao.nome})</SelectItem>
                  <SelectItem value="membro">Membro específico</SelectItem>
                  <SelectItem value="desconhecido">Desconhecido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {veiculoForm.proprietario_tipo === 'membro' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Membro</Label>
                <div className="relative">
                  <Input
                    placeholder="Buscar membro..."
                    value={veiculoMembroBusca}
                    onChange={e => { setVeiculoMembroBusca(e.target.value); setVeiculoForm(f => ({ ...f, proprietario_id: '' })) }}
                    className={cn('h-8 text-sm', veiculoForm.proprietario_id && 'border-primary')}
                    autoComplete="off"
                  />
                  {veiculoMembroBusca && !veiculoForm.proprietario_id && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {membros.filter(m => norm(m.nome).includes(norm(veiculoMembroBusca)) || norm(m.vulgo).includes(norm(veiculoMembroBusca))).length === 0
                        ? <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum membro encontrado</p>
                        : membros.filter(m => norm(m.nome).includes(norm(veiculoMembroBusca)) || norm(m.vulgo).includes(norm(veiculoMembroBusca))).map(m => (
                          <button key={m.id} className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors" onMouseDown={e => { e.preventDefault(); setVeiculoForm(f => ({ ...f, proprietario_id: m.id })); setVeiculoMembroBusca(m.nome + (m.vulgo ? ` "${m.vulgo}"` : '')) }}>
                            {m.nome}{m.vulgo ? ` "${m.vulgo}"` : ''}
                          </button>
                        ))
                      }
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Observações</Label>
              <Input value={veiculoForm.observacoes} onChange={e => setVeiculoForm(f => ({ ...f, observacoes: e.target.value }))} className="h-8 text-sm" placeholder="Notas..." />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setVeiculoDialog(null)}>Cancelar</Button>
            <Button size="sm" onClick={handleSalvarVeiculo} disabled={veiculoSaving}>
              {veiculoSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Confirmar exclusão de veículo */}
      <Dialog open={!!confirmDeleteVeiculo} onOpenChange={v => !v && setConfirmDeleteVeiculo(null)}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-xs">
          <DialogHeader><DialogTitle className="text-sm">Excluir veículo</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Excluir <strong className="text-foreground">{confirmDeleteVeiculo?.modelo ?? confirmDeleteVeiculo?.placa ?? 'este veículo'}</strong>?</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmDeleteVeiculo(null)}>Cancelar</Button>
            <Button variant="destructive" size="sm" onClick={() => confirmDeleteVeiculo && handleDeletarVeiculo(confirmDeleteVeiculo)}>Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}

'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type {
  AcaoTipo, Acao, AcaoParticipante, Escalacao, EscalacaoParticipante,
  Membro, TipoForm, AcaoForm, EscalacaoForm,
  Competicao, CompEquipe, CompEquipeMembro, CompForm,
  CompTipo, CompItem, CatalogItem,
} from './acao-shared'
import { calcTeamProgress } from './acao-shared'
import { TabTipos } from './tab-tipos'
import { TabRegistros } from './tab-registros'
import { TabEscalacoes } from './tab-escalacoes'
import { TabRanking } from './tab-ranking'
import { TabCompeticoes } from './tab-competicoes'

interface Props {
  userId: string
  userNome: string | null
  membroId: string | null
  podeEditar: boolean
  tiposIniciais: AcaoTipo[]
  acoesIniciais: Acao[]
  participantesIniciais: AcaoParticipante[]
  escalacoesIniciais: Escalacao[]
  escalacaoParticipantesIniciais: EscalacaoParticipante[]
  membrosIniciais: Membro[]
  competicoesIniciais: Competicao[]
  compEquipesIniciais: CompEquipe[]
  compEquipeMembrosIniciais: CompEquipeMembro[]
  compTiposIniciais: CompTipo[]
  compItensIniciais: CompItem[]
  catalogItemsIniciais: CatalogItem[]
}

type Aba = 'registros' | 'escalacoes' | 'tipos' | 'ranking' | 'competicoes'

const ABAS: { key: Aba; label: string }[] = [
  { key: 'registros', label: 'Registros' },
  { key: 'escalacoes', label: 'Escalações' },
  { key: 'competicoes', label: 'Competições' },
  { key: 'tipos', label: 'Tipos de Ação' },
  { key: 'ranking', label: 'Ranking' },
]

export function AcaoClient({
  userId, userNome, membroId, podeEditar,
  tiposIniciais, acoesIniciais, participantesIniciais,
  escalacoesIniciais, escalacaoParticipantesIniciais, membrosIniciais,
  competicoesIniciais, compEquipesIniciais, compEquipeMembrosIniciais,
  compTiposIniciais, compItensIniciais, catalogItemsIniciais,
}: Props) {
  const sbRef = useRef<ReturnType<typeof createClient> | null>(null)
  const sb = useCallback(() => {
    if (!sbRef.current) sbRef.current = createClient()
    return sbRef.current
  }, [])
  const router = useRouter()

  const userFaccaoId = membrosIniciais.find(m => m.id === membroId)?.faccao_id ?? null

  const [aba, setAba] = useState<Aba>('registros')
  const [tipos, setTipos] = useState<AcaoTipo[]>(tiposIniciais)
  const [acoes, setAcoes] = useState<Acao[]>(acoesIniciais)
  const [participantes, setParticipantes] = useState<AcaoParticipante[]>(participantesIniciais)
  const [escalacoes, setEscalacoes] = useState<Escalacao[]>(escalacoesIniciais)
  const [escalacaoParticipantes, setEscalacaoParticipantes] = useState<EscalacaoParticipante[]>(escalacaoParticipantesIniciais)
  const [competicoes, setCompeticoes] = useState<Competicao[]>(competicoesIniciais)
  const [compEquipes, setCompEquipes] = useState<CompEquipe[]>(compEquipesIniciais)
  const [compEquipeMembros, setCompEquipeMembros] = useState<CompEquipeMembro[]>(compEquipeMembrosIniciais)
  const [compTipos, setCompTipos] = useState<CompTipo[]>(compTiposIniciais)
  const [compItens, setCompItens] = useState<CompItem[]>(compItensIniciais)
  const [salvando, setSalvando] = useState(false)
  const [lancamentosAcao, setLancamentosAcao] = useState<Record<string, { id: string; valor: number }>>({})

  useEffect(() => {
    sb().from('financeiro_lancamentos')
      .select('id, acao_id, valor')
      .not('acao_id', 'is', null)
      .then(({ data }) => {
        if (data) {
          const map: Record<string, { id: string; valor: number }> = {}
          for (const l of data) {
            if (l.acao_id) map[l.acao_id as string] = { id: l.id, valor: l.valor }
          }
          setLancamentosAcao(map)
        }
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Tipos ──────────────────────────────────────────────────────────────────────

  async function handleSaveTipo(form: TipoForm, editId: string | null): Promise<boolean> {
    if (!form.nome.trim()) { toast.error('Nome é obrigatório'); return false }
    setSalvando(true)
    try {
      const row = {
        nome: form.nome.trim(),
        min_participantes: parseInt(form.min_participantes) || 1,
        max_participantes: form.max_participantes ? parseInt(form.max_participantes) : null,
        descricao: form.descricao.trim() || null,
        regras: form.regras.trim() || null,
        conta_pontuacao: form.conta_pontuacao,
        pontos_valor: form.conta_pontuacao ? (parseInt(form.pontos_valor) || 0) : 0,
        ativo: form.ativo,
      }
      if (editId) {
        const { error } = await sb().from('acao_tipos').update(row).eq('id', editId)
        if (error) throw error
        setTipos(prev => prev.map(t => t.id === editId ? { ...t, ...row } : t))
        toast.success('Tipo atualizado')
      } else {
        const { data, error } = await sb().from('acao_tipos').insert(row).select().single()
        if (error) throw error
        setTipos(prev => [...prev, data as AcaoTipo].sort((a, b) => a.nome.localeCompare(b.nome)))
        toast.success('Tipo criado')
      }
      return true
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro'); return false }
    finally { setSalvando(false) }
  }

  async function handleDeleteTipo(id: string): Promise<boolean> {
    setSalvando(true)
    try {
      const { error } = await sb().from('acao_tipos').delete().eq('id', id)
      if (error) throw error
      setTipos(prev => prev.filter(t => t.id !== id))
      toast.success('Tipo excluído')
      return true
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro'); return false }
    finally { setSalvando(false) }
  }

  // ── Ações ──────────────────────────────────────────────────────────────────────

  async function handleSaveAcao(form: AcaoForm, escalacaoId?: string): Promise<boolean> {
    if (!form.tipo_id) { toast.error('Selecione o tipo de ação'); return false }
    if (!form.data) { toast.error('Informe a data'); return false }
    if (form.participantes.length === 0) { toast.error('Selecione pelo menos um participante'); return false }
    setSalvando(true)
    try {
      const tipo = tipos.find(t => t.id === form.tipo_id)
      const compTipoEntry = form.competicao_id
        ? compTipos.find(ct => ct.competicao_id === form.competicao_id && ct.tipo_id === form.tipo_id)
        : null
      const pontos = form.conta_pontuacao
        ? (compTipoEntry?.pontos_valor ?? (tipo?.conta_pontuacao ? (tipo.pontos_valor ?? 0) : 0))
        : 0

      const data_hora_iso = new Date(`${form.data}T${form.hora || '00:00'}`).toISOString()

      const { data: acaoData, error: acaoErr } = await sb().from('acoes').insert({
        tipo_id: form.tipo_id,
        tipo_nome: tipo?.nome ?? null,
        data_hora: data_hora_iso,
        observacoes: form.observacoes.trim() || null,
        para_caixa_faccao: form.para_caixa_faccao,
        conta_pontuacao: form.conta_pontuacao,
        tipo_dinheiro: form.tipo_dinheiro,
        resultado: form.resultado || null,
        competicao_id: form.competicao_id || null,
        equipe_id: form.equipe_id || null,
        quantidade_item: form.quantidade_item ? parseInt(form.quantidade_item) : null,
        item_id: form.item_id || null,
        created_by: userId,
        created_by_nome: userNome,
      }).select().single()
      if (acaoErr) throw acaoErr
      const novaAcao = acaoData as Acao

      const parts = form.participantes.map(mId => {
        const m = membrosIniciais.find(mb => mb.id === mId)
        return { acao_id: novaAcao.id, membro_id: mId, membro_nome: m?.nome ?? mId, pontos_atribuidos: pontos }
      })
      const { data: partsData, error: partsErr } = await sb().from('acao_participantes').insert(parts).select()
      if (partsErr) throw partsErr

      const updatedAcoes = [novaAcao, ...acoes]
      const updatedParts = [...participantes, ...(partsData as AcaoParticipante[])]
      setAcoes(updatedAcoes)
      setParticipantes(updatedParts)

      // Lançar no financeiro se para_caixa_faccao com valor
      if (form.para_caixa_faccao) {
        const valorNum = parseFloat(form.valor_financeiro)
        if (valorNum > 0) {
          const { data: contaFaccao } = await sb()
            .from('financeiro_contas')
            .select('id, saldo_sujo, saldo_limpo')
            .eq('tipo', 'faccao')
            .eq('status', 'ativo')
            .order('created_at')
            .limit(1)
            .maybeSingle()
          if (contaFaccao) {
            const { data: lancData } = await sb().from('financeiro_lancamentos').insert({
              conta_id: contaFaccao.id,
              tipo: 'entrada',
              tipo_dinheiro: form.tipo_dinheiro,
              valor: valorNum,
              total: valorNum,
              descricao: `Ação: ${tipo?.nome ?? 'Ação'}`,
              acao_referencia: tipo?.nome ?? null,
              acao_id: novaAcao.id,
              vai_para_faccao: true,
              categoria: 'acao',
              data: new Date().toISOString().split('T')[0],
              created_by: userId,
              responsavel_nome: userNome,
            }).select('id').single()
            if (form.tipo_dinheiro === 'limpo') {
              await sb().from('financeiro_contas').update({
                saldo_limpo: (contaFaccao.saldo_limpo ?? 0) + valorNum,
              }).eq('id', contaFaccao.id)
            } else {
              await sb().from('financeiro_contas').update({
                saldo_sujo: (contaFaccao.saldo_sujo ?? 0) + valorNum,
              }).eq('id', contaFaccao.id)
            }
            if (lancData) {
              setLancamentosAcao(prev => ({ ...prev, [novaAcao.id]: { id: lancData.id, valor: valorNum } }))
            }
          }
        }
      }

      if (escalacaoId) {
        await sb().from('escalacoes').update({ status: 'convertida', acao_id: novaAcao.id }).eq('id', escalacaoId)
        setEscalacoes(prev => prev.map(e => e.id === escalacaoId
          ? { ...e, status: 'convertida' as const, acao_id: novaAcao.id } : e))
      }

      // auto-encerrar competição se meta atingida
      if (novaAcao.competicao_id && novaAcao.equipe_id) {
        const comp = competicoes.find(c => c.id === novaAcao.competicao_id && c.status === 'ativa')
        if (comp && comp.tipo_encerramento !== 'prazo' && comp.meta_valor) {
          const equipes = compEquipes.filter(e => e.competicao_id === comp.id)
          const membros = compEquipeMembros
          const todasAcoes = updatedAcoes
          const todosParticipantes = updatedParts
          const progEquipe = calcTeamProgress(comp, novaAcao.equipe_id, todasAcoes, todosParticipantes)
          if (progEquipe >= comp.meta_valor) {
            const equipe = equipes.find(e => e.id === novaAcao.equipe_id)
            await sb().from('acao_competicoes').update({
              status: 'encerrada',
              vencedor_equipe_id: novaAcao.equipe_id,
              vencedor_equipe_nome: equipe?.nome ?? null,
            }).eq('id', comp.id)
            setCompeticoes(prev => prev.map(c => c.id === comp.id
              ? { ...c, status: 'encerrada' as const, vencedor_equipe_id: novaAcao.equipe_id, vencedor_equipe_nome: equipe?.nome ?? null }
              : c))
            toast.success(`Competição encerrada! Equipe ${equipe?.nome ?? ''} atingiu a meta!`)
          }
        }
      }

      toast.success('Ação registrada!')
      return true
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro'); return false }
    finally { setSalvando(false) }
  }

  async function handleEditAcao(id: string, form: AcaoForm): Promise<boolean> {
    if (!form.tipo_id) { toast.error('Selecione o tipo de ação'); return false }
    if (!form.data) { toast.error('Informe a data'); return false }
    if (form.participantes.length === 0) { toast.error('Selecione pelo menos um participante'); return false }
    setSalvando(true)
    try {
      const tipo = tipos.find(t => t.id === form.tipo_id)
      const compTipoEntry = form.competicao_id
        ? compTipos.find(ct => ct.competicao_id === form.competicao_id && ct.tipo_id === form.tipo_id)
        : null
      const pontos = form.conta_pontuacao
        ? (compTipoEntry?.pontos_valor ?? (tipo?.conta_pontuacao ? (tipo.pontos_valor ?? 0) : 0))
        : 0

      const data_hora_iso = new Date(`${form.data}T${form.hora || '00:00'}`).toISOString()

      const { error: acaoErr } = await sb().from('acoes').update({
        tipo_id: form.tipo_id,
        tipo_nome: tipo?.nome ?? null,
        data_hora: data_hora_iso,
        observacoes: form.observacoes.trim() || null,
        para_caixa_faccao: form.para_caixa_faccao,
        conta_pontuacao: form.conta_pontuacao,
        tipo_dinheiro: form.tipo_dinheiro,
        resultado: form.resultado || null,
        competicao_id: form.competicao_id || null,
        equipe_id: form.equipe_id || null,
        quantidade_item: form.quantidade_item ? parseInt(form.quantidade_item) : null,
        item_id: form.item_id || null,
      }).eq('id', id)
      if (acaoErr) throw acaoErr

      // ── Sincronizar lançamento financeiro ────────────────────────────────────
      const lancExistente = lancamentosAcao[id]
      const oldAcao = acoes.find(a => a.id === id)

      if (oldAcao?.para_caixa_faccao && !form.para_caixa_faccao) {
        // Estava para caixa, agora não: deletar lançamento e reverter saldo
        if (lancExistente) {
          const { data: lancData } = await sb().from('financeiro_lancamentos')
            .select('conta_id, tipo_dinheiro, valor').eq('id', lancExistente.id).maybeSingle()
          if (lancData) {
            const { data: contaD } = await sb().from('financeiro_contas')
              .select('saldo_sujo, saldo_limpo').eq('id', lancData.conta_id).single()
            if (contaD) {
              const isSujo = lancData.tipo_dinheiro === 'sujo'
              await sb().from('financeiro_contas').update({
                saldo_sujo: isSujo ? contaD.saldo_sujo - lancData.valor : contaD.saldo_sujo,
                saldo_limpo: !isSujo ? contaD.saldo_limpo - lancData.valor : contaD.saldo_limpo,
              }).eq('id', lancData.conta_id)
            }
            await sb().from('financeiro_lancamentos').delete().eq('id', lancExistente.id)
          }
          setLancamentosAcao(prev => { const n = { ...prev }; delete n[id]; return n })
        }
      } else if (form.para_caixa_faccao) {
        const valorNum = parseFloat(form.valor_financeiro)
        if (valorNum > 0) {
          if (lancExistente) {
            // Atualizar lançamento existente
            const { data: lancData } = await sb().from('financeiro_lancamentos')
              .select('conta_id, tipo_dinheiro, valor').eq('id', lancExistente.id).maybeSingle()
            if (lancData) {
              const { data: contaD } = await sb().from('financeiro_contas')
                .select('saldo_sujo, saldo_limpo').eq('id', lancData.conta_id).single()
              if (contaD) {
                const oldIsSujo = lancData.tipo_dinheiro === 'sujo'
                const newIsSujo = form.tipo_dinheiro === 'sujo'
                await sb().from('financeiro_contas').update({
                  saldo_sujo: contaD.saldo_sujo - (oldIsSujo ? lancData.valor : 0) + (newIsSujo ? valorNum : 0),
                  saldo_limpo: contaD.saldo_limpo - (!oldIsSujo ? lancData.valor : 0) + (!newIsSujo ? valorNum : 0),
                }).eq('id', lancData.conta_id)
              }
              await sb().from('financeiro_lancamentos').update({
                tipo_dinheiro: form.tipo_dinheiro,
                valor: valorNum,
                total: valorNum,
              }).eq('id', lancExistente.id)
              setLancamentosAcao(prev => ({ ...prev, [id]: { id: lancExistente.id, valor: valorNum } }))
            }
          } else {
            // Criar novo lançamento (era false, agora true)
            const { data: contaFaccao } = await sb().from('financeiro_contas')
              .select('id, saldo_sujo, saldo_limpo').eq('tipo', 'faccao').eq('status', 'ativo')
              .order('created_at').limit(1).maybeSingle()
            if (contaFaccao) {
              const { data: novoLanc } = await sb().from('financeiro_lancamentos').insert({
                conta_id: contaFaccao.id,
                tipo: 'entrada',
                tipo_dinheiro: form.tipo_dinheiro,
                valor: valorNum,
                total: valorNum,
                descricao: `Ação: ${tipo?.nome ?? 'Ação'}`,
                acao_referencia: tipo?.nome ?? null,
                acao_id: id,
                vai_para_faccao: true,
                categoria: 'acao',
                data: new Date().toISOString().split('T')[0],
                created_by: userId,
                responsavel_nome: userNome,
              }).select('id').single()
              const isSujo = form.tipo_dinheiro === 'sujo'
              await sb().from('financeiro_contas').update({
                saldo_sujo: contaFaccao.saldo_sujo + (isSujo ? valorNum : 0),
                saldo_limpo: contaFaccao.saldo_limpo + (!isSujo ? valorNum : 0),
              }).eq('id', contaFaccao.id)
              if (novoLanc) setLancamentosAcao(prev => ({ ...prev, [id]: { id: novoLanc.id, valor: valorNum } }))
            }
          }
        }
      }
      // ── Fim sincronização ────────────────────────────────────────────────────

      await sb().from('acao_participantes').delete().eq('acao_id', id)

      const parts = form.participantes.map(mId => {
        const m = membrosIniciais.find(mb => mb.id === mId)
        return { acao_id: id, membro_id: mId, membro_nome: m?.nome ?? mId, pontos_atribuidos: pontos }
      })
      const { data: partsData, error: partsErr } = await sb().from('acao_participantes').insert(parts).select()
      if (partsErr) throw partsErr

      setAcoes(prev => prev.map(a => a.id === id ? {
        ...a,
        tipo_id: form.tipo_id, tipo_nome: tipo?.nome ?? null,
        data_hora: data_hora_iso,
        observacoes: form.observacoes.trim() || null,
        para_caixa_faccao: form.para_caixa_faccao,
        conta_pontuacao: form.conta_pontuacao,
        tipo_dinheiro: form.tipo_dinheiro,
        resultado: (form.resultado || null) as 'vencida' | 'perdida' | null,
        competicao_id: form.competicao_id || null,
        equipe_id: form.equipe_id || null,
        quantidade_item: form.quantidade_item ? parseInt(form.quantidade_item) : null,
        item_id: form.item_id || null,
      } : a))
      setParticipantes(prev => [
        ...prev.filter(p => p.acao_id !== id),
        ...(partsData as AcaoParticipante[]),
      ])
      toast.success('Ação atualizada!')
      return true
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro'); return false }
    finally { setSalvando(false) }
  }

  async function handleDeleteAcao(id: string): Promise<boolean> {
    setSalvando(true)
    try {
      // Sincronizar: deletar lançamento financeiro vinculado e reverter saldo
      const lancExistente = lancamentosAcao[id]
      if (lancExistente) {
        const { data: lancData } = await sb().from('financeiro_lancamentos')
          .select('conta_id, tipo_dinheiro, valor').eq('id', lancExistente.id).maybeSingle()
        if (lancData) {
          const { data: contaD } = await sb().from('financeiro_contas')
            .select('saldo_sujo, saldo_limpo').eq('id', lancData.conta_id).single()
          if (contaD) {
            const isSujo = lancData.tipo_dinheiro === 'sujo'
            await sb().from('financeiro_contas').update({
              saldo_sujo: isSujo ? contaD.saldo_sujo - lancData.valor : contaD.saldo_sujo,
              saldo_limpo: !isSujo ? contaD.saldo_limpo - lancData.valor : contaD.saldo_limpo,
            }).eq('id', lancData.conta_id)
          }
          await sb().from('financeiro_lancamentos').delete().eq('id', lancExistente.id)
        }
        setLancamentosAcao(prev => { const n = { ...prev }; delete n[id]; return n })
      }

      const { error } = await sb().from('acoes').delete().eq('id', id)
      if (error) throw error
      setAcoes(prev => prev.filter(a => a.id !== id))
      setParticipantes(prev => prev.filter(p => p.acao_id !== id))
      toast.success('Ação excluída')
      router.refresh()
      return true
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro'); return false }
    finally { setSalvando(false) }
  }

  async function handleToggleAcaoContaPontuacao(acao: Acao) {
    const novoValor = !acao.conta_pontuacao
    try {
      const { error } = await sb().from('acoes').update({ conta_pontuacao: novoValor }).eq('id', acao.id)
      if (error) throw error
      setAcoes(prev => prev.map(a => a.id === acao.id ? { ...a, conta_pontuacao: novoValor } : a))
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro') }
  }

  // ── Escalações ────────────────────────────────────────────────────────────────

  async function handleSaveEscalacao(form: EscalacaoForm): Promise<boolean> {
    if (!form.tipo_id) { toast.error('Selecione o tipo de ação'); return false }
    if (!form.data_hora_prevista) { toast.error('Informe a data e hora previstas'); return false }
    setSalvando(true)
    try {
      const tipo = tipos.find(t => t.id === form.tipo_id)
      const { data: escData, error: escErr } = await sb().from('escalacoes').insert({
        tipo_id: form.tipo_id,
        tipo_nome: tipo?.nome ?? null,
        data_hora_prevista: new Date(form.data_hora_prevista).toISOString(),
        modo: form.modo,
        observacoes: form.observacoes.trim() || null,
        status: 'pendente',
        created_by: userId,
        created_by_nome: userNome,
      }).select().single()
      if (escErr) throw escErr
      const novaEsc = escData as Escalacao

      const novosParts: EscalacaoParticipante[] = []
      if (form.modo === 'manual') {
        const rows = [
          ...form.participantes.map(mId => {
            const m = membrosIniciais.find(mb => mb.id === mId)
            return { escalacao_id: novaEsc.id, membro_id: mId, membro_nome: m?.nome ?? mId, status: 'convocado' as const }
          }),
          ...form.reservas.map(mId => {
            const m = membrosIniciais.find(mb => mb.id === mId)
            return { escalacao_id: novaEsc.id, membro_id: mId, membro_nome: m?.nome ?? mId, status: 'reserva' as const }
          }),
        ]
        if (rows.length > 0) {
          const { data: partsData, error: partsErr } = await sb().from('escalacao_participantes').insert(rows).select()
          if (partsErr) throw partsErr
          novosParts.push(...(partsData as EscalacaoParticipante[]))
        }
      }

      setEscalacoes(prev => [novaEsc, ...prev])
      setEscalacaoParticipantes(prev => [...prev, ...novosParts])
      toast.success('Escalação criada!')
      return true
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro'); return false }
    finally { setSalvando(false) }
  }

  async function handleEditEscalacao(id: string, form: EscalacaoForm): Promise<boolean> {
    if (!form.tipo_id) { toast.error('Selecione o tipo de ação'); return false }
    if (!form.data_hora_prevista) { toast.error('Informe a data e hora previstas'); return false }
    setSalvando(true)
    try {
      const tipo = tipos.find(t => t.id === form.tipo_id)
      const { error } = await sb().from('escalacoes').update({
        tipo_id: form.tipo_id,
        tipo_nome: tipo?.nome ?? null,
        data_hora_prevista: new Date(form.data_hora_prevista).toISOString(),
        modo: form.modo,
        observacoes: form.observacoes.trim() || null,
      }).eq('id', id)
      if (error) throw error

      // Reconcile convocados e reservas (preserva confirmados/recusados/candidatos)
      await sb().from('escalacao_participantes').delete().eq('escalacao_id', id).in('status', ['convocado', 'reserva'])
      const novosRows: EscalacaoParticipante[] = []
      if (form.modo === 'manual') {
        const rows = [
          ...form.participantes.map(mId => {
            const m = membrosIniciais.find(mb => mb.id === mId)
            return { escalacao_id: id, membro_id: mId, membro_nome: m?.nome ?? mId, status: 'convocado' as const }
          }),
          ...form.reservas.map(mId => {
            const m = membrosIniciais.find(mb => mb.id === mId)
            return { escalacao_id: id, membro_id: mId, membro_nome: m?.nome ?? mId, status: 'reserva' as const }
          }),
        ]
        if (rows.length > 0) {
          const { data, error: pErr } = await sb().from('escalacao_participantes').insert(rows).select()
          if (pErr) throw pErr
          novosRows.push(...(data as EscalacaoParticipante[]))
        }
      }

      setEscalacoes(prev => prev.map(e => e.id === id ? {
        ...e,
        tipo_id: form.tipo_id, tipo_nome: tipo?.nome ?? null,
        data_hora_prevista: new Date(form.data_hora_prevista).toISOString(),
        modo: form.modo as 'aberta' | 'manual',
        observacoes: form.observacoes.trim() || null,
      } : e))
      setEscalacaoParticipantes(prev => [
        ...prev.filter(p => !(p.escalacao_id === id && (p.status === 'convocado' || p.status === 'reserva'))),
        ...novosRows,
      ])
      toast.success('Escalação atualizada!')
      return true
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro'); return false }
    finally { setSalvando(false) }
  }

  async function handleDeleteEscalacao(id: string): Promise<boolean> {
    setSalvando(true)
    try {
      const { error } = await sb().from('escalacoes').delete().eq('id', id)
      if (error) throw error
      setEscalacoes(prev => prev.filter(e => e.id !== id))
      setEscalacaoParticipantes(prev => prev.filter(p => p.escalacao_id !== id))
      toast.success('Escalação excluída')
      router.refresh()
      return true
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro'); return false }
    finally { setSalvando(false) }
  }

  async function handleCandidatar(escalacaoId: string): Promise<void> {
    if (!membroId) { toast.error('Conta não vinculada a um membro'); return }
    const membro = membrosIniciais.find(m => m.id === membroId)
    try {
      const { data, error } = await sb().from('escalacao_participantes').insert({
        escalacao_id: escalacaoId,
        membro_id: membroId,
        membro_nome: membro?.nome ?? userNome ?? 'Desconhecido',
        status: 'candidato',
      }).select().single()
      if (error) throw error
      setEscalacaoParticipantes(prev => [...prev, data as EscalacaoParticipante])
      toast.success('Candidatura enviada!')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro') }
  }

  async function handleResponderConvocacao(partId: string, escalacaoId: string, status: 'confirmado' | 'recusado'): Promise<void> {
    try {
      const { error } = await sb().from('escalacao_participantes').update({ status }).eq('id', partId)
      if (error) throw error
      setEscalacaoParticipantes(prev => prev.map(p => p.id === partId ? { ...p, status } : p))
      toast.success(status === 'confirmado' ? 'Presença confirmada!' : 'Convocação recusada')

      // Auto-promover primeira reserva quando recusado
      if (status === 'recusado') {
        const reservas = escalacaoParticipantes
          .filter(p => p.escalacao_id === escalacaoId && p.status === 'reserva')
          .sort((a, b) => a.id.localeCompare(b.id))
        if (reservas.length > 0) {
          const primeira = reservas[0]!
          const { error: rErr } = await sb().from('escalacao_participantes')
            .update({ status: 'convocado' }).eq('id', primeira.id)
          if (!rErr) {
            setEscalacaoParticipantes(prev => prev.map(p =>
              p.id === primeira.id ? { ...p, status: 'convocado' as const } : p
            ))
            toast.info(`${primeira.membro_nome} saiu do banco de reservas e foi convocado!`)
          }
        }
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro') }
  }

  async function handleCancelarEscalacao(id: string): Promise<void> {
    try {
      const { error } = await sb().from('escalacoes').update({ status: 'cancelada' }).eq('id', id)
      if (error) throw error
      setEscalacoes(prev => prev.map(e => e.id === id ? { ...e, status: 'cancelada' as const } : e))
      toast.success('Escalação cancelada')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro') }
  }

  // ── Competições ───────────────────────────────────────────────────────────────

  async function handleSaveCompeticao(form: CompForm): Promise<boolean> {
    if (!form.nome.trim()) { toast.error('Nome é obrigatório'); return false }
    if (form.equipes.length < 2) { toast.error('Adicione pelo menos 2 equipes'); return false }
    if (form.tipos.filter(t => t.tipo_id).length === 0) { toast.error('Selecione pelo menos um tipo de ação'); return false }
    if (form.tipo_encerramento !== 'meta' && !form.prazo) { toast.error('Informe o prazo'); return false }
    if (form.tipo_encerramento !== 'prazo' && !form.meta_valor) { toast.error('Informe a meta'); return false }
    if (form.modo_progresso === 'item' && form.itens.length === 0) { toast.error('Selecione pelo menos um item'); return false }
    setSalvando(true)
    try {
      const tiposValidos = form.tipos.filter(t => t.tipo_id)
      const primeiroTipoId = tiposValidos[0]?.tipo_id ?? null
      const primeiroTipoNome = primeiroTipoId ? tipos.find(t => t.id === primeiroTipoId)?.nome ?? null : null

      const { data: compData, error: compErr } = await sb().from('acao_competicoes').insert({
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || null,
        tipo_acao_id: primeiroTipoId,
        tipo_acao_nome: primeiroTipoNome,
        modo_progresso: form.modo_progresso,
        item_nome: null,
        tipo_encerramento: form.tipo_encerramento,
        prazo: form.prazo ? new Date(form.prazo).toISOString() : null,
        meta_valor: form.meta_valor ? parseInt(form.meta_valor) : null,
        status: 'ativa',
        created_by: userId,
        created_by_nome: userNome,
      }).select().single()
      if (compErr) throw compErr
      const novaComp = compData as Competicao

      // Inserir tipos permitidos
      const tiposRows = tiposValidos.map(t => ({
        competicao_id: novaComp.id,
        tipo_id: t.tipo_id,
        pontos_valor: parseInt(t.pontos_valor) || 0,
      }))
      const { data: tiposData, error: tiposErr } = await sb().from('acao_competicao_tipos').insert(tiposRows).select()
      if (tiposErr) throw tiposErr
      const novosTipos = tiposData as CompTipo[]

      // Inserir itens (modo item)
      const novosItens: CompItem[] = []
      if (form.modo_progresso === 'item' && form.itens.length > 0) {
        const itensRows = form.itens.map(itemId => ({ competicao_id: novaComp.id, item_id: itemId }))
        const { data: itensData, error: itensErr } = await sb().from('acao_competicao_itens').insert(itensRows).select()
        if (itensErr) throw itensErr
        novosItens.push(...(itensData as CompItem[]))
      }

      const novasEquipes: CompEquipe[] = []
      const novosMembros: CompEquipeMembro[] = []

      for (const eq of form.equipes) {
        const { data: eqData, error: eqErr } = await sb().from('acao_competicao_equipes').insert({
          competicao_id: novaComp.id,
          nome: eq.nome.trim(),
          cor: eq.cor,
        }).select().single()
        if (eqErr) throw eqErr
        const novaEquipe = eqData as CompEquipe
        novasEquipes.push(novaEquipe)

        if (eq.membros.length > 0) {
          const rows = eq.membros.map(mId => {
            const m = membrosIniciais.find(mb => mb.id === mId)
            return { equipe_id: novaEquipe.id, membro_id: mId, membro_nome: m?.nome ?? mId }
          })
          const { data: mData, error: mErr } = await sb().from('acao_competicao_equipe_membros').insert(rows).select()
          if (mErr) throw mErr
          novosMembros.push(...(mData as CompEquipeMembro[]))
        }
      }

      setCompeticoes(prev => [novaComp, ...prev])
      setCompEquipes(prev => [...prev, ...novasEquipes])
      setCompEquipeMembros(prev => [...prev, ...novosMembros])
      setCompTipos(prev => [...prev, ...novosTipos])
      setCompItens(prev => [...prev, ...novosItens])
      toast.success('Competição criada!')
      return true
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro'); return false }
    finally { setSalvando(false) }
  }

  async function handleDeleteCompeticao(id: string): Promise<boolean> {
    setSalvando(true)
    try {
      const { error } = await sb().from('acao_competicoes').delete().eq('id', id)
      if (error) throw error
      const equipeIds = compEquipes.filter(e => e.competicao_id === id).map(e => e.id)
      setCompeticoes(prev => prev.filter(c => c.id !== id))
      setCompEquipes(prev => prev.filter(e => e.competicao_id !== id))
      setCompEquipeMembros(prev => prev.filter(m => !equipeIds.includes(m.equipe_id)))
      setCompTipos(prev => prev.filter(ct => ct.competicao_id !== id))
      setCompItens(prev => prev.filter(ci => ci.competicao_id !== id))
      toast.success('Competição excluída')
      return true
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro'); return false }
    finally { setSalvando(false) }
  }

  async function handleEncerrarCompeticao(id: string, vencedorEquipeId: string | null): Promise<void> {
    setSalvando(true)
    try {
      const equipe = vencedorEquipeId ? compEquipes.find(e => e.id === vencedorEquipeId) : null
      const { error } = await sb().from('acao_competicoes').update({
        status: 'encerrada',
        vencedor_equipe_id: vencedorEquipeId ?? null,
        vencedor_equipe_nome: equipe?.nome ?? null,
      }).eq('id', id)
      if (error) throw error
      setCompeticoes(prev => prev.map(c => c.id === id
        ? { ...c, status: 'encerrada' as const, vencedor_equipe_id: vencedorEquipeId, vencedor_equipe_nome: equipe?.nome ?? null }
        : c))
      toast.success('Competição encerrada!')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro') }
    finally { setSalvando(false) }
  }

  async function handleAdicionarMembroEquipe(equipeId: string, membroId: string): Promise<void> {
    const membro = membrosIniciais.find(m => m.id === membroId)
    try {
      const { data, error } = await sb().from('acao_competicao_equipe_membros').insert({
        equipe_id: equipeId,
        membro_id: membroId,
        membro_nome: membro?.nome ?? membroId,
      }).select().single()
      if (error) throw error
      setCompEquipeMembros(prev => [...prev, data as CompEquipeMembro])
      toast.success('Membro adicionado')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro') }
  }

  async function handleRemoverMembroEquipe(membroEquipeId: string): Promise<void> {
    try {
      const { error } = await sb().from('acao_competicao_equipe_membros').delete().eq('id', membroEquipeId)
      if (error) throw error
      setCompEquipeMembros(prev => prev.filter(m => m.id !== membroEquipeId))
      toast.success('Membro removido')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro') }
  }

  // ── Ranking ───────────────────────────────────────────────────────────────────

  async function handleZerarRanking(): Promise<void> {
    setSalvando(true)
    try {
      await sb().from('acao_participantes').update({ pontos_atribuidos: 0 }).neq('id', '00000000-0000-0000-0000-000000000000')
      await sb().from('acoes').update({ conta_pontuacao: false }).eq('conta_pontuacao', true)
      setParticipantes(prev => prev.map(p => ({ ...p, pontos_atribuidos: 0 })))
      setAcoes(prev => prev.map(a => ({ ...a, conta_pontuacao: false })))
      toast.success('Ranking zerado!')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Erro') }
    finally { setSalvando(false) }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex gap-0.5 border-b border-border px-6 pt-4">
        {ABAS.map(a => (
          <button key={a.key} onClick={() => setAba(a.key)}
            className={cn('px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              aba === a.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}>
            {a.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {aba === 'tipos' && (
          <TabTipos tipos={tipos} salvando={salvando} podeEditar={podeEditar} onSave={handleSaveTipo} onDelete={handleDeleteTipo} />
        )}
        {aba === 'registros' && (
          <TabRegistros
            acoes={acoes} participantes={participantes} tipos={tipos} membros={membrosIniciais}
            competicoes={competicoes} compEquipes={compEquipes}
            compTipos={compTipos} compItens={compItens} catalogItems={catalogItemsIniciais}
            salvando={salvando} podeEditar={podeEditar} userFaccaoId={userFaccaoId}
            lancamentosAcao={lancamentosAcao}
            onSaveAcao={handleSaveAcao}
            onEditAcao={handleEditAcao}
            onDeleteAcao={handleDeleteAcao}
            onToggleContaPontuacao={handleToggleAcaoContaPontuacao}
          />
        )}
        {aba === 'escalacoes' && (
          <TabEscalacoes
            escalacoes={escalacoes} escalacaoParticipantes={escalacaoParticipantes}
            tipos={tipos} membros={membrosIniciais} acoes={acoes}
            userId={userId} membroId={membroId}
            salvando={salvando} podeEditar={podeEditar} userFaccaoId={userFaccaoId}
            onSaveEscalacao={handleSaveEscalacao}
            onEditEscalacao={handleEditEscalacao}
            onDeleteEscalacao={handleDeleteEscalacao}
            onCandidatar={handleCandidatar}
            onResponderConvocacao={handleResponderConvocacao}
            onCancelarEscalacao={handleCancelarEscalacao}
            onSaveAcaoFromEscalacao={handleSaveAcao}
          />
        )}
        {aba === 'competicoes' && (
          <TabCompeticoes
            competicoes={competicoes} compEquipes={compEquipes} compEquipeMembros={compEquipeMembros}
            compTipos={compTipos} compItens={compItens} catalogItems={catalogItemsIniciais}
            acoes={acoes} participantes={participantes} tipos={tipos} membros={membrosIniciais}
            salvando={salvando} podeEditar={podeEditar}
            onSave={handleSaveCompeticao}
            onDelete={handleDeleteCompeticao}
            onEncerrar={handleEncerrarCompeticao}
            onAdicionarMembro={handleAdicionarMembroEquipe}
            onRemoverMembro={handleRemoverMembroEquipe}
          />
        )}
        {aba === 'ranking' && (
          <TabRanking
            acoes={acoes} participantes={participantes} membros={membrosIniciais}
            podeEditar={podeEditar} salvando={salvando}
            onZerarRanking={handleZerarRanking}
          />
        )}
      </div>
    </div>
  )
}

'use client'

import { useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { ExtratoAba } from './extrato-aba'
import { BancoAba } from './banco-aba'
import { TransferenciasAba } from './transferencias-aba'
import { LavagemAba } from './lavagem-aba'
import { ContasAba } from './contas-aba'

// ── Tipos exportados ──────────────────────────────────────────────────────────

export type Conta = {
  id: string; nome: string
  tipo: 'faccao' | 'membro' | 'caixa' | 'setor' | 'outro'
  membro_id: string | null
  saldo_sujo: number; saldo_limpo: number
  status: 'ativo' | 'inativo'; created_at: string
}

export type Lancamento = {
  id: string; conta_id: string
  tipo: 'entrada' | 'saida' | 'transferencia' | 'venda'
  tipo_dinheiro: 'sujo' | 'limpo' | null
  valor: number; data: string | null
  origem_tipo: 'faccao' | 'loja' | 'pessoa' | null
  item_descricao: string | null; descricao: string | null
  categoria: string | null
  preco: number | null; quantidade: number | null; total: number | null
  conta_destino_id: string | null; cotacao_id: string | null
  vai_para_faccao: boolean; acao_referencia: string | null
  origem: string | null
  created_by: string | null; created_at: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cotacoes?: any
}

export type Lavagem = {
  id: string; conta_id: string
  conversao_tipo: 'sujo_para_limpo' | 'limpo_para_sujo'
  valor_origem: number; valor_destino: number
  taxa_percentual: number | null; data: string | null
  descricao: string | null; created_at: string
}

export type Membro  = { id: string; nome: string; vulgo: string | null }
export type Cotacao = { id: string; titulo: string | null; fornecedor_nome: string; fornecedor_tipo: string }
export type SbClient = () => ReturnType<typeof createClient>

// ── Tipos da aba ──────────────────────────────────────────────────────────────

type Aba = 'extrato' | 'banco' | 'transferencias' | 'lavagem' | 'contas'

const ABAS: [Aba, string][] = [
  ['extrato',       'Extrato'],
  ['banco',         'Banco'],
  ['transferencias','Transferências'],
  ['lavagem',       'Lavagem'],
  ['contas',        'Cadastro de Contas'],
]

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  userId: string; userNome: string | null
  contasIniciais: Conta[]; lancamentosIniciais: Lancamento[]
  lavagensIniciais: Lavagem[]; membros: Membro[]; cotacoesFinaliz: Cotacao[]
  podeEditar: boolean
  tabPadrao?: string
}

// ── Componente ────────────────────────────────────────────────────────────────

export function FinanceiroClient({
  userId, contasIniciais, lancamentosIniciais, lavagensIniciais, membros, cotacoesFinaliz, podeEditar, tabPadrao,
}: Props) {
  const sbRef = useRef<ReturnType<typeof createClient> | null>(null)
  const sb: SbClient = useCallback(() => {
    if (!sbRef.current) sbRef.current = createClient()
    return sbRef.current
  }, [])

  const [aba, setAba]               = useState<Aba>((tabPadrao as Aba) || 'extrato')
  const [contas, setContas]         = useState<Conta[]>(contasIniciais)
  const [lancamentos, setLancamentos] = useState<Lancamento[]>(lancamentosIniciais)
  const [lavagens, setLavagens]     = useState<Lavagem[]>(lavagensIniciais)

  // Ref para evitar stale closure em atualizarSaldo
  const contasRef = useRef(contas)
  contasRef.current = contas

  async function atualizarSaldo(contaId: string, deltaSujo: number, deltaLimpo: number) {
    const conta = contasRef.current.find(c => c.id === contaId)
    if (!conta) return
    const saldo_sujo  = conta.saldo_sujo  + deltaSujo
    const saldo_limpo = conta.saldo_limpo + deltaLimpo
    await sb().from('financeiro_contas').update({ saldo_sujo, saldo_limpo }).eq('id', contaId)
    setContas(prev => prev.map(c => c.id === contaId ? { ...c, saldo_sujo, saldo_limpo } : c))
  }

  return (
    <div className="h-[calc(100vh-3rem)] flex flex-col overflow-hidden">

      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <div className="flex border-b border-border shrink-0 px-6">
        {ABAS.map(([key, label]) => (
          <button key={key} onClick={() => setAba(key)}
            className={cn(
              'px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px',
              aba === key
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Conteúdo ─────────────────────────────────────────────────────────── */}
      {/* Todas as abas ficam montadas; só a ativa fica visível (evita remount/reload) */}
      <div className={cn('flex-1 overflow-hidden', aba !== 'extrato' && 'hidden')}>
        <ExtratoAba
          contas={contas} setContas={setContas}
          lancamentos={lancamentos} setLancamentos={setLancamentos}
          atualizarSaldo={atualizarSaldo} userId={userId}
          cotacoesFinaliz={cotacoesFinaliz} membros={membros} sb={sb}
          podeEditar={podeEditar}
        />
      </div>
      <div className={cn('flex-1 overflow-hidden', aba !== 'banco' && 'hidden')}>
        <BancoAba contas={contas} lancamentos={lancamentos} />
      </div>
      <div className={cn('flex-1 overflow-hidden', aba !== 'transferencias' && 'hidden')}>
        <TransferenciasAba
          contas={contas} lancamentos={lancamentos} setLancamentos={setLancamentos}
          atualizarSaldo={atualizarSaldo} userId={userId} sb={sb}
          podeEditar={podeEditar}
        />
      </div>
      <div className={cn('flex-1 overflow-hidden', aba !== 'lavagem' && 'hidden')}>
        <LavagemAba
          contas={contas} lavagens={lavagens} setLavagens={setLavagens}
          atualizarSaldo={atualizarSaldo} userId={userId} sb={sb}
          podeEditar={podeEditar}
        />
      </div>
      <div className={cn('flex-1 overflow-hidden', aba !== 'contas' && 'hidden')}>
        <ContasAba
          contas={contas} setContas={setContas} membros={membros} sb={sb}
          podeEditar={podeEditar}
        />
      </div>
    </div>
  )
}

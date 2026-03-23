import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Users, Car, Package, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'

function fmt(v: number | null) {
  if (v == null) return '—'
  return `R$ ${v.toLocaleString('pt-BR')}`
}

export default async function FaccaoRelatorioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [
    { data: faccao },
    { data: membros },
    { data: veiculos },
    { data: precos },
  ] = await Promise.all([
    supabase.from('faccoes').select('*').eq('id', id).single(),
    supabase.from('membros').select('*').eq('faccao_id', id).order('nome'),
    supabase.from('veiculos').select('*').eq('proprietario_tipo', 'faccao').eq('proprietario_id', id).order('placa'),
    supabase.from('faccao_item_precos').select('*, items(nome)').eq('faccao_id', id).order('items(nome)'),
  ])

  if (!faccao) notFound()

  const membrosAtivos = (membros ?? []).filter(m => m.status === 'ativo')
  const membrosInativos = (membros ?? []).filter(m => m.status === 'inativo')

  return (
    <div className="flex-1 p-6 max-w-4xl mx-auto space-y-6">
      {/* Voltar */}
      <Link href="/investigacao" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar para Investigação
      </Link>

      {/* Header da facção */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full shrink-0 border-2 border-white/10" style={{ background: faccao.cor_tag }} />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">{faccao.nome}</h1>
                {faccao.sigla && (
                  <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-white/[0.08] text-muted-foreground border border-white/10">
                    {faccao.sigla}
                  </span>
                )}
              </div>
              {faccao.territorio && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3" />{faccao.territorio}
                </p>
              )}
            </div>
          </div>
          <span className={cn(
            'text-xs px-2 py-1 rounded-full font-medium',
            faccao.status === 'ativo' ? 'bg-green-500/10 text-green-400' : 'bg-zinc-500/10 text-zinc-500'
          )}>
            {faccao.status === 'ativo' ? 'Ativa' : 'Inativa'}
          </span>
        </div>

        {faccao.descricao && (
          <p className="text-sm text-muted-foreground border-t border-border pt-3">{faccao.descricao}</p>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 border-t border-border pt-3">
          <div className="text-center">
            <p className="text-2xl font-bold tabular-nums">{membros?.length ?? 0}</p>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-0.5"><Users className="h-3 w-3" />Membros</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold tabular-nums">{veiculos?.length ?? 0}</p>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-0.5"><Car className="h-3 w-3" />Veículos</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold tabular-nums">{precos?.length ?? 0}</p>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-0.5"><Package className="h-3 w-3" />Produtos</p>
          </div>
        </div>
      </div>

      {/* Membros */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />Membros
            <span className="text-xs font-normal text-muted-foreground">({membros?.length ?? 0})</span>
          </h2>
          {membrosInativos.length > 0 && (
            <span className="text-xs text-muted-foreground">{membrosInativos.length} inativo{membrosInativos.length !== 1 ? 's' : ''}</span>
          )}
        </div>

        {!membros || membros.length === 0 ? (
          <div className="rounded-lg border border-border py-8 text-center text-sm text-muted-foreground">Nenhum membro registrado</div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="grid grid-cols-[1fr_100px_130px_80px] gap-3 px-4 py-2 bg-white/[0.02] border-b border-border text-[11px] text-muted-foreground font-medium">
              <span>Nome / Vulgo</span><span>Telefone</span><span>Observações</span><span>Status</span>
            </div>
            {membros.map((m, idx) => (
              <div key={m.id} className={cn('grid grid-cols-[1fr_100px_130px_80px] gap-3 items-center px-4 py-2.5', idx < membros.length - 1 && 'border-b border-border/40')}>
                <div>
                  <span className="text-sm font-medium">{m.nome}</span>
                  {m.vulgo && <span className="ml-2 text-xs text-muted-foreground">"{m.vulgo}"</span>}
                </div>
                <span className="text-xs font-mono text-muted-foreground">{m.telefone ?? '—'}</span>
                <span className="text-xs text-muted-foreground truncate">{m.observacoes ?? '—'}</span>
                <span className={cn('text-[11px] px-1.5 py-0.5 rounded inline-flex items-center gap-1 w-fit',
                  m.status === 'ativo' ? 'bg-green-500/10 text-green-400' : 'bg-zinc-500/10 text-zinc-500')}>
                  <span className={cn('h-1 w-1 rounded-full', m.status === 'ativo' ? 'bg-green-400' : 'bg-zinc-500')} />
                  {m.status === 'ativo' ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Veículos */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Car className="h-4 w-4 text-muted-foreground" />Veículos
          <span className="text-xs font-normal text-muted-foreground">({veiculos?.length ?? 0})</span>
        </h2>

        {!veiculos || veiculos.length === 0 ? (
          <div className="rounded-lg border border-border py-8 text-center text-sm text-muted-foreground">Nenhum veículo registrado</div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="grid grid-cols-[110px_1fr_80px_1fr] gap-3 px-4 py-2 bg-white/[0.02] border-b border-border text-[11px] text-muted-foreground font-medium">
              <span>Placa</span><span>Modelo</span><span>Cor</span><span>Observações</span>
            </div>
            {veiculos.map((v, idx) => (
              <div key={v.id} className={cn('grid grid-cols-[110px_1fr_80px_1fr] gap-3 items-center px-4 py-2.5', idx < veiculos.length - 1 && 'border-b border-border/40')}>
                <span className="font-mono text-sm font-medium">{v.placa}</span>
                <span className="text-sm text-muted-foreground">{v.modelo ?? '—'}</span>
                <span className="text-sm text-muted-foreground">{v.cor ?? '—'}</span>
                <span className="text-xs text-muted-foreground truncate">{v.observacoes ?? '—'}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Produtos */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />Produtos
          <span className="text-xs font-normal text-muted-foreground">({precos?.length ?? 0})</span>
        </h2>

        {!precos || precos.length === 0 ? (
          <div className="rounded-lg border border-border py-8 text-center text-sm text-muted-foreground">Nenhum produto registrado</div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="grid grid-cols-[1fr_110px_110px_90px] gap-3 px-4 py-2 bg-white/[0.02] border-b border-border text-[11px] text-muted-foreground font-medium">
              <span>Produto</span><span className="text-right">Preço Sujo</span><span className="text-right">Preço Limpo</span><span>Tipo</span>
            </div>
            {precos.map((p, idx) => (
              <div key={p.id} className={cn('grid grid-cols-[1fr_110px_110px_90px] gap-3 items-center px-4 py-2.5', idx < precos.length - 1 && 'border-b border-border/40')}>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <span className="text-sm font-medium">{(p as any).items?.nome ?? '—'}</span>
                <span className="text-sm text-right tabular-nums">{fmt(p.preco_sujo)}</span>
                <span className="text-sm text-right tabular-nums">{fmt(p.preco_limpo)}</span>
                <span className="text-xs text-muted-foreground">
                  {p.tipo === 'percentual'
                    ? `${p.percentual != null && p.percentual > 0 ? '-' : '+'}${Math.abs(p.percentual ?? 0)}%`
                    : 'fixo'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

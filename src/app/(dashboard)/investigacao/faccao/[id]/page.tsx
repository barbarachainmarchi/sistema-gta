import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Users, Car, Package, MapPin, Phone } from 'lucide-react'
import { cn } from '@/lib/utils'

function fmt(v: number | null) {
  if (v == null) return '—'
  return `R$ ${v.toLocaleString('pt-BR')}`
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '255, 255, 255'
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
  const cor = faccao.cor_tag ?? '#ffffff'
  const rgb = hexToRgb(cor)

  return (
    <div className="flex-1 p-6 max-w-4xl mx-auto space-y-4">
      {/* Voltar */}
      <Link href="/investigacao" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar para Investigação
      </Link>

      {/* DOCUMENTO DOSSIÊ */}
      <div className="rounded-xl overflow-hidden border border-white/10 shadow-2xl">

        {/* Header principal */}
        <div className="bg-card px-6 pt-5 pb-4 space-y-4">
          <div className="flex items-start gap-5">
            {/* Emblema da cor */}
            <div
              className="h-14 w-14 rounded-lg shrink-0 flex items-center justify-center text-[10px] font-mono font-bold shadow-inner"
              style={{
                background: `rgba(${rgb}, 0.15)`,
                border: `2px solid rgba(${rgb}, 0.5)`,
                color: cor,
              }}
            >
              {faccao.sigla?.slice(0, 3) ?? '?'}
            </div>

            {/* Nome e info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight">{faccao.nome}</h1>
                {faccao.sigla && (
                  <span
                    className="text-xs font-mono px-2 py-0.5 rounded border font-bold"
                    style={{ color: cor, borderColor: `rgba(${rgb}, 0.4)`, background: `rgba(${rgb}, 0.08)` }}
                  >
                    {faccao.sigla}
                  </span>
                )}
                <span className={cn(
                  'ml-auto text-[11px] px-2.5 py-0.5 rounded-full font-semibold tracking-wide',
                  faccao.status === 'ativo'
                    ? 'bg-green-500/10 text-green-400 ring-1 ring-green-500/20'
                    : 'bg-zinc-500/10 text-zinc-500 ring-1 ring-zinc-500/20'
                )}>
                  {faccao.status === 'ativo' ? 'ATIVA' : 'INATIVA'}
                </span>
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                {faccao.territorio && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" style={{ color: cor, opacity: 0.8 }} />
                    {faccao.territorio}
                  </p>
                )}
                {faccao.telefone && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" style={{ color: cor, opacity: 0.8 }} />
                    <span className="font-mono">{faccao.telefone}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {faccao.descricao && (
            <p
              className="text-sm text-muted-foreground px-4 py-3 rounded-lg"
              style={{ background: `rgba(${rgb}, 0.05)`, borderLeft: `3px solid rgba(${rgb}, 0.4)` }}
            >
              {faccao.descricao}
            </p>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 pt-1">
            {[
              { icon: Users, label: 'Membros', value: membros?.length ?? 0, sub: membrosAtivos.length > 0 ? `${membrosAtivos.length} ativos` : undefined },
              { icon: Car, label: 'Veículos', value: veiculos?.length ?? 0 },
              { icon: Package, label: 'Produtos', value: precos?.length ?? 0 },
            ].map(({ icon: Icon, label, value, sub }) => (
              <div
                key={label}
                className="rounded-lg px-4 py-3 text-center"
                style={{ background: `rgba(${rgb}, 0.06)`, border: `1px solid rgba(${rgb}, 0.15)` }}
              >
                <p className="text-2xl font-bold tabular-nums" style={{ color: cor }}>{value}</p>
                <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1 mt-0.5">
                  <Icon className="h-3 w-3" />{label}
                </p>
                {sub && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>}
              </div>
            ))}
          </div>
        </div>

        {/* Linha divisória com acento */}
        <div style={{ height: '2px', background: `linear-gradient(to right, rgba(${rgb}, 0.5), transparent)` }} />

        {/* Corpo do dossiê */}
        <div className="bg-card/50 divide-y divide-border/50">

          {/* Seção Membros */}
          <section className="px-6 py-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-mono font-bold tracking-[0.15em] uppercase flex items-center gap-2.5"
                style={{ color: cor }}>
                <span className="opacity-40">01 //</span> Membros Registrados
                <span className="text-muted-foreground font-normal normal-case tracking-normal text-xs">
                  ({membros?.length ?? 0})
                </span>
              </h2>
              {membrosInativos.length > 0 && (
                <span className="text-[11px] text-muted-foreground">
                  {membrosInativos.length} inativo{membrosInativos.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {!membros || membros.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhum membro registrado</p>
            ) : (
              <div className="rounded-lg overflow-hidden border border-border/60">
                <div className="grid grid-cols-[1fr_100px_140px_80px] gap-3 px-4 py-2 text-[10px] text-muted-foreground font-mono font-medium tracking-wider uppercase"
                  style={{ background: `rgba(${rgb}, 0.04)`, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span>Nome / Vulgo</span><span>Telefone</span><span>Observações</span><span>Status</span>
                </div>
                {membros.map((m, idx) => (
                  <div key={m.id} className={cn(
                    'grid grid-cols-[1fr_100px_140px_80px] gap-3 items-center px-4 py-2.5 hover:bg-white/[0.02] transition-colors',
                    idx < membros.length - 1 && 'border-b border-border/30'
                  )}>
                    <div>
                      <span className="text-sm font-medium">{m.nome}</span>
                      {m.vulgo && <span className="ml-2 text-xs text-muted-foreground italic">"{m.vulgo}"</span>}
                    </div>
                    <span className="text-xs font-mono text-muted-foreground">{m.telefone ?? '—'}</span>
                    <span className="text-xs text-muted-foreground truncate">{m.observacoes ?? '—'}</span>
                    <span className={cn(
                      'text-[10px] px-2 py-0.5 rounded-full font-medium w-fit',
                      m.status === 'ativo'
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-zinc-500/10 text-zinc-500'
                    )}>
                      {m.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Seção Veículos */}
          <section className="px-6 py-5 space-y-3">
            <h2 className="text-[11px] font-mono font-bold tracking-[0.15em] uppercase flex items-center gap-2.5"
              style={{ color: cor }}>
              <span className="opacity-40">02 //</span> Veículos Identificados
              <span className="text-muted-foreground font-normal normal-case tracking-normal text-xs">
                ({veiculos?.length ?? 0})
              </span>
            </h2>

            {!veiculos || veiculos.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhum veículo registrado</p>
            ) : (
              <div className="rounded-lg overflow-hidden border border-border/60">
                <div className="grid grid-cols-[110px_1fr_80px_1fr] gap-3 px-4 py-2 text-[10px] text-muted-foreground font-mono font-medium tracking-wider uppercase"
                  style={{ background: `rgba(${rgb}, 0.04)`, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span>Placa</span><span>Modelo</span><span>Cor</span><span>Observações</span>
                </div>
                {veiculos.map((v, idx) => (
                  <div key={v.id} className={cn(
                    'grid grid-cols-[110px_1fr_80px_1fr] gap-3 items-center px-4 py-2.5 hover:bg-white/[0.02] transition-colors',
                    idx < veiculos.length - 1 && 'border-b border-border/30'
                  )}>
                    <span className="font-mono text-sm font-semibold tracking-widest">{v.placa}</span>
                    <span className="text-sm text-muted-foreground">{v.modelo ?? '—'}</span>
                    <span className="text-sm text-muted-foreground">{v.cor ?? '—'}</span>
                    <span className="text-xs text-muted-foreground truncate">{v.observacoes ?? '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Seção Preços */}
          <section className="px-6 py-5 space-y-3">
            <h2 className="text-[11px] font-mono font-bold tracking-[0.15em] uppercase flex items-center gap-2.5"
              style={{ color: cor }}>
              <span className="opacity-40">03 //</span> Tabela de Preços
              <span className="text-muted-foreground font-normal normal-case tracking-normal text-xs">
                ({precos?.length ?? 0})
              </span>
            </h2>

            {!precos || precos.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhum produto registrado</p>
            ) : (
              <div className="rounded-lg overflow-hidden border border-border/60">
                <div className="grid grid-cols-[1fr_110px_110px_90px] gap-3 px-4 py-2 text-[10px] text-muted-foreground font-mono font-medium tracking-wider uppercase"
                  style={{ background: `rgba(${rgb}, 0.04)`, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span>Produto</span>
                  <span className="text-right">Preço Sujo</span>
                  <span className="text-right">Preço Limpo</span>
                  <span>Tipo</span>
                </div>
                {precos.map((p, idx) => (
                  <div key={p.id} className={cn(
                    'grid grid-cols-[1fr_110px_110px_90px] gap-3 items-center px-4 py-2.5 hover:bg-white/[0.02] transition-colors',
                    idx < precos.length - 1 && 'border-b border-border/30'
                  )}>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <span className="text-sm font-medium">{(p as any).items?.nome ?? '—'}</span>
                    <span className="text-sm text-right tabular-nums font-mono">{fmt(p.preco_sujo)}</span>
                    <span className="text-sm text-right tabular-nums font-mono">{fmt(p.preco_limpo)}</span>
                    <span className="text-xs text-muted-foreground font-mono">
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

      </div>
    </div>
  )
}

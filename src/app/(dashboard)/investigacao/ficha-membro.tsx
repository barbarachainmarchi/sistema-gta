'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Car, ExternalLink, ImageUp, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { uploadImgbb, getImgbbKey } from '@/lib/imgbb'
import { gerarImagemMembro } from '@/lib/gerarImagem'
import { cn } from '@/lib/utils'
import type { Membro, Veiculo } from './faccao-detalhe'

interface Props {
  membro: Membro | null
  veiculos: Veiculo[]
  lojasNomes: string[]
  open: boolean
  onClose: () => void
}

export function FichaMembroModal({ membro, veiculos, lojasNomes, open, onClose }: Props) {
  const [exportando, setExportando] = useState(false)

  if (!membro) return null

  const membroVeiculos = veiculos.filter(
    v => v.proprietario_tipo === 'membro' && v.proprietario_id === membro.id
  )

  async function handleExportar() {
    if (!membro) return
    setExportando(true)
    try {
      const key = await getImgbbKey()
      if (!key) { toast.error('Chave imgbb não configurada'); setExportando(false); return }
      const base64 = gerarImagemMembro({ membro, veiculos: membroVeiculos, lojasNomes })
      const url = await uploadImgbb(base64, key, `membro-${membro.nome}`)
      navigator.clipboard.writeText(url).catch(() => {})
      toast.success('Imagem enviada!', {
        description: 'Link copiado para área de transferência',
        action: { label: 'Abrir', onClick: () => window.open(url, '_blank') },
      })
    } catch {
      toast.error('Erro ao exportar imagem')
    }
    setExportando(false)
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
        <DialogHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <DialogTitle className="text-xl">{membro.nome}</DialogTitle>
              {membro.vulgo && (
                <span className="text-base text-muted-foreground italic">"{membro.vulgo}"</span>
              )}
              {membro.faccoes && (
                <span
                  className="text-xs px-2 py-0.5 rounded font-medium"
                  style={{ background: membro.faccoes.cor_tag + '22', color: membro.faccoes.cor_tag }}
                >
                  {membro.faccoes.nome}
                </span>
              )}
              {membro.cargo_faccao && (
                <span className="text-sm text-muted-foreground">· {membro.cargo_faccao}</span>
              )}
              <span className={cn(
                'text-xs px-2 py-0.5 rounded',
                membro.status === 'ativo' ? 'bg-green-500/10 text-green-400' : 'bg-zinc-500/10 text-zinc-500'
              )}>
                {membro.status === 'ativo' ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportar}
              disabled={exportando}
              className="shrink-0 gap-1.5"
            >
              {exportando
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <ImageUp className="h-3.5 w-3.5" />}
              Exportar
            </Button>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6 items-start">
          {/* Dados do membro */}
          <div className="space-y-5">
            <section className="space-y-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contato</p>
              <div className="space-y-2 text-sm">
                {membro.telefone && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-24 shrink-0">Telefone</span>
                    <span className="font-mono">{membro.telefone}</span>
                  </div>
                )}
                {membro.instagram && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-24 shrink-0">Instagram</span>
                    <span className="text-blue-400">@{membro.instagram.replace(/^@/, '')}</span>
                  </div>
                )}
                {membro.deep && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-24 shrink-0">Deep</span>
                    <span className="font-mono text-xs bg-white/[0.04] px-2 py-0.5 rounded border border-white/10 break-all">
                      {membro.deep}
                    </span>
                  </div>
                )}
                {!membro.telefone && !membro.instagram && !membro.deep && (
                  <p className="text-xs text-muted-foreground">Sem dados de contato</p>
                )}
              </div>
            </section>

            <section className="space-y-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Organização</p>
              <div className="space-y-2 text-sm">
                {membro.faccoes && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-24 shrink-0">Facção</span>
                    <span style={{ color: membro.faccoes.cor_tag }}>{membro.faccoes.nome}</span>
                  </div>
                )}
                {membro.cargo_faccao && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-24 shrink-0">Cargo</span>
                    <span>{membro.cargo_faccao}</span>
                  </div>
                )}
                {lojasNomes.length > 0 && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-24 shrink-0">Lojas</span>
                    <div className="flex flex-wrap gap-1">
                      {lojasNomes.map(l => (
                        <span key={l} className="text-xs bg-white/[0.05] px-2 py-0.5 rounded border border-white/10">
                          {l}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {membro.data_entrada && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-24 shrink-0">Entrada</span>
                    <span>{new Date(membro.data_entrada).toLocaleDateString('pt-BR')}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-24 shrink-0">Tipo</span>
                  <span>{membro.membro_proprio ? 'Membro próprio' : 'Externo'}</span>
                </div>
              </div>
            </section>

            {membro.observacoes && (
              <section className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Observações</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{membro.observacoes}</p>
              </section>
            )}
          </div>

          {/* Veículos */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Car className="h-3.5 w-3.5" />
              Veículos ({membroVeiculos.length})
            </p>
            {membroVeiculos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum veículo cadastrado</p>
            ) : (
              <div className="space-y-2">
                {membroVeiculos.map(v => (
                  <div key={v.id} className="rounded-lg border border-border p-3 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-semibold">{v.placa ?? 'S/P'}</span>
                      {v.cor && <span className="text-xs text-muted-foreground">({v.cor})</span>}
                    </div>
                    {v.modelo && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{v.modelo}</span>
                        <button
                          type="button"
                          title={`Buscar "${v.modelo} GTA" no Google Imagens`}
                          onClick={() =>
                            window.open(
                              `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(v.modelo! + ' GTA')}`,
                              '_blank'
                            )
                          }
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    {v.observacoes && (
                      <p className="text-xs text-muted-foreground">{v.observacoes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

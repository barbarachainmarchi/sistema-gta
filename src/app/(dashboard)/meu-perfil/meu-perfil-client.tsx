'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Loader2, Building2, Shield, Briefcase } from 'lucide-react'

type Loja = { id: string; nome: string }
type Faccao = { id: string; nome: string; tag: string | null }

interface Props {
  lojaAtual: string | null
  faccaoAtual: string | null
  trabalhoPrincipalAtual: 'loja' | 'faccao' | null
  lojas: Loja[]
  faccoes: Faccao[]
  nomeUsuario: string | null
}

export function MeuPerfilClient({ lojaAtual, faccaoAtual, trabalhoPrincipalAtual, lojas, faccoes, nomeUsuario }: Props) {
  const router = useRouter()
  const [lojaId, setLojaId] = useState(lojaAtual ?? '')
  const [faccaoId, setFaccaoId] = useState(faccaoAtual ?? '')
  const [trabalhoPrincipal, setTrabalhoPrincipal] = useState<'' | 'loja' | 'faccao'>(trabalhoPrincipalAtual ?? '')
  const [saving, setSaving] = useState(false)

  const temDois = !!lojaId && !!faccaoId

  async function handleSalvar() {
    setSaving(true)
    const res = await fetch('/api/meu-perfil', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        local_trabalho_loja_id: lojaId || null,
        local_trabalho_faccao_id: faccaoId || null,
        trabalho_principal: temDois ? (trabalhoPrincipal || null) : null,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const j = await res.json()
      toast.error(j.error ?? 'Erro ao salvar')
      return
    }
    toast.success('Local de trabalho atualizado!')
    router.refresh()
  }

  return (
    <>
      <Header title="Meu Perfil" description="Altere onde você trabalha" />

      <div className="flex-1 p-6">
        <div className="max-w-md space-y-6">

          <div className="rounded-lg border border-border bg-card p-5 space-y-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Briefcase className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">{nomeUsuario ?? 'Usuário'}</p>
                <p className="text-xs text-muted-foreground">Local de trabalho</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5">
                  <Building2 className="h-3 w-3" />
                  Loja
                </Label>
                <Select value={lojaId || '_none'} onValueChange={v => setLojaId(v === '_none' ? '' : v)}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Nenhuma..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Nenhuma</SelectItem>
                    {lojas.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5">
                  <Shield className="h-3 w-3" />
                  Facção
                </Label>
                <Select value={faccaoId || '_none'} onValueChange={v => setFaccaoId(v === '_none' ? '' : v)}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Nenhuma..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Nenhuma</SelectItem>
                    {faccoes.map(f => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nome}{f.tag ? ` [${f.tag}]` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {temDois && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Trabalho principal</Label>
                  <Select value={trabalhoPrincipal || '_none'} onValueChange={v => setTrabalhoPrincipal(v === '_none' ? '' : v as 'loja' | 'faccao')}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Não definido..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Não definido</SelectItem>
                      <SelectItem value="loja">Loja</SelectItem>
                      <SelectItem value="faccao">Facção</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">Vendas e financeiro usam o trabalho principal do dono do servidor.</p>
                </div>
              )}
            </div>
          </div>

          <Button onClick={handleSalvar} disabled={saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
          </Button>
        </div>
      </div>
    </>
  )
}

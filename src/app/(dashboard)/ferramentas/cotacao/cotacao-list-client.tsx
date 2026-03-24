'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, FileText, Loader2, Clock, CheckCircle2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type Cotacao = {
  id: string
  titulo: string | null
  fornecedor_nome: string
  fornecedor_tipo: string
  modo_preco: string
  status: string
  created_at: string
  criado_por_nome: string | null
}

type Faccao = { id: string; nome: string; cor_tag: string }
type Loja = { id: string; nome: string }
type Membro = { id: string; nome: string; vulgo: string | null }

interface Props {
  userId: string
  userNome: string | null
  cotacoes: Cotacao[]
  faccoes: Faccao[]
  lojas: Loja[]
  membros: Membro[]
  podeEditar: boolean
}

const statusIcon = { rascunho: Clock, finalizada: CheckCircle2, cancelada: XCircle }
const statusLabel = { rascunho: 'Rascunho', finalizada: 'Finalizada', cancelada: 'Cancelada' }
const statusColor = { rascunho: 'text-yellow-400', finalizada: 'text-green-400', cancelada: 'text-zinc-500' }

export function CotacaoListClient({ userId, userNome, cotacoes, faccoes, lojas, membros, podeEditar }: Props) {
  const router = useRouter()
  const [novaOpen, setNovaOpen] = useState(false)
  const [criando, setCriando] = useState(false)
  const [form, setForm] = useState({
    titulo: '',
    fornecedor_tipo: 'faccao' as 'faccao' | 'loja' | 'livre',
    fornecedor_id: '',
    fornecedor_nome_livre: '',
    modo_preco: 'limpo' as 'sujo' | 'limpo',
  })

  async function handleCriar() {
    let fornecedor_id: string | null = null
    let fornecedor_nome = ''

    if (form.fornecedor_tipo === 'faccao') {
      if (!form.fornecedor_id) { toast.error('Selecione a facção'); return }
      fornecedor_id = form.fornecedor_id
      fornecedor_nome = faccoes.find(f => f.id === form.fornecedor_id)?.nome ?? ''
    } else if (form.fornecedor_tipo === 'loja') {
      if (!form.fornecedor_id) { toast.error('Selecione a loja'); return }
      fornecedor_id = form.fornecedor_id
      fornecedor_nome = lojas.find(l => l.id === form.fornecedor_id)?.nome ?? ''
    } else {
      if (!form.fornecedor_nome_livre.trim()) { toast.error('Informe o fornecedor'); return }
      fornecedor_nome = form.fornecedor_nome_livre.trim()
    }

    setCriando(true)
    const sb = createClient()
    const { data, error } = await sb.from('cotacoes').insert({
      titulo: form.titulo.trim() || null,
      fornecedor_tipo: form.fornecedor_tipo,
      fornecedor_id,
      fornecedor_nome,
      modo_preco: form.modo_preco,
      created_by: userId,
      criado_por_nome: userNome,
    }).select('id').single()

    setCriando(false)
    if (error) { toast.error('Erro ao criar cotação'); return }
    router.push(`/ferramentas/cotacao/${data.id}`)
  }

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {cotacoes.length === 0 ? 'Nenhuma cotação ainda' : `${cotacoes.length} cotação${cotacoes.length !== 1 ? 'ões' : ''}`}
        </p>
        {podeEditar && (
          <Button size="sm" className="gap-1.5" onClick={() => setNovaOpen(true)}>
            <Plus className="h-3.5 w-3.5" />Nova Cotação
          </Button>
        )}
      </div>

      {cotacoes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center space-y-2">
          <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">Crie uma cotação para montar um pedido de compra</p>
          {podeEditar && (
            <Button variant="outline" size="sm" className="mt-2" onClick={() => setNovaOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />Nova Cotação
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {cotacoes.map(c => {
            const Icon = statusIcon[c.status as keyof typeof statusIcon] ?? Clock
            return (
              <button
                key={c.id}
                onClick={() => router.push(`/ferramentas/cotacao/${c.id}`)}
                className="w-full flex items-center gap-4 p-4 rounded-lg border border-border bg-card hover:bg-white/[0.03] transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {c.titulo ?? c.fornecedor_nome}
                    </span>
                    {c.titulo && (
                      <span className="text-xs text-muted-foreground truncate">— {c.fornecedor_nome}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[11px] text-muted-foreground capitalize">{c.fornecedor_tipo}</span>
                    <span className="text-[11px] text-muted-foreground">preço {c.modo_preco}</span>
                    {c.criado_por_nome && <span className="text-[11px] text-muted-foreground">por {c.criado_por_nome}</span>}
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </div>
                <div className={cn('flex items-center gap-1.5 text-xs', statusColor[c.status as keyof typeof statusColor])}>
                  <Icon className="h-3.5 w-3.5" />
                  {statusLabel[c.status as keyof typeof statusLabel]}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Dialog: Nova cotação */}
      <Dialog open={novaOpen} onOpenChange={v => !v && setNovaOpen(false)}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">Nova Cotação</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Título (opcional)</Label>
              <Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Compra semanal armas" className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de fornecedor</Label>
              <Select value={form.fornecedor_tipo} onValueChange={v => setForm(f => ({ ...f, fornecedor_tipo: v as typeof f.fornecedor_tipo, fornecedor_id: '' }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="faccao">Facção</SelectItem>
                  <SelectItem value="loja">Loja</SelectItem>
                  <SelectItem value="livre">Texto livre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.fornecedor_tipo === 'faccao' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Facção</Label>
                <Select value={form.fornecedor_id} onValueChange={v => setForm(f => ({ ...f, fornecedor_id: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {faccoes.map(fc => <SelectItem key={fc.id} value={fc.id}>{fc.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.fornecedor_tipo === 'loja' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Loja</Label>
                <Select value={form.fornecedor_id} onValueChange={v => setForm(f => ({ ...f, fornecedor_id: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {lojas.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.fornecedor_tipo === 'livre' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Nome do fornecedor</Label>
                <Input value={form.fornecedor_nome_livre} onChange={e => setForm(f => ({ ...f, fornecedor_nome_livre: e.target.value }))} placeholder="Ex: Binha da Silva" className="h-8 text-sm" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Preço padrão</Label>
              <Select value={form.modo_preco} onValueChange={v => setForm(f => ({ ...f, modo_preco: v as 'sujo' | 'limpo' }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="limpo">Limpo</SelectItem>
                  <SelectItem value="sujo">Sujo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setNovaOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleCriar} disabled={criando}>
              {criando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Criar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

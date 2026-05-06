'use client'

import { useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Shield, Loader2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'

type Usuario = { id: string; nome: string | null; exclusao_suprema: boolean }

export function ExclusaoSupremaConfig({ usuariosIniciais }: { usuariosIniciais: Usuario[] }) {
  const sbRef = useRef<ReturnType<typeof createClient> | null>(null)
  const sb = useCallback(() => { if (!sbRef.current) sbRef.current = createClient(); return sbRef.current }, [])

  const [usuarios, setUsuarios] = useState<Usuario[]>(usuariosIniciais)
  const [salvando, setSalvando] = useState<string | null>(null)

  async function handleToggle(id: string, valor: boolean) {
    setSalvando(id)
    const { error } = await sb().from('usuarios').update({ exclusao_suprema: valor }).eq('id', id)
    if (error) { toast.error('Erro ao salvar: ' + error.message); setSalvando(null); return }
    setUsuarios(prev => prev.map(u => u.id === id ? { ...u, exclusao_suprema: valor } : u))
    toast.success(valor ? 'Exclusão Suprema concedida' : 'Exclusão Suprema removida')
    setSalvando(null)
  }

  return (
    <section className="px-6 py-5">
      <div className="flex items-center gap-2 mb-1">
        <Shield className="h-4 w-4 text-red-400" />
        <h3 className="text-sm font-semibold">Exclusão Suprema</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Permite excluir qualquer pedido a qualquer momento sem aprovação, equivalente aos donos.
      </p>
      <div className="space-y-2 max-w-sm">
        {usuarios.length === 0 && (
          <p className="text-xs text-muted-foreground italic">Nenhum usuário cadastrado.</p>
        )}
        {usuarios.map(u => (
          <div key={u.id} className={cn(
            'flex items-center justify-between gap-3 px-3 py-2 rounded-lg border',
            u.exclusao_suprema ? 'border-red-500/30 bg-red-500/[0.04]' : 'border-border'
          )}>
            <span className="text-sm truncate">{u.nome ?? u.id}</span>
            <div className="flex items-center gap-2 shrink-0">
              {salvando === u.id && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              <Switch
                checked={u.exclusao_suprema}
                disabled={salvando === u.id}
                onCheckedChange={v => handleToggle(u.id, v)}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

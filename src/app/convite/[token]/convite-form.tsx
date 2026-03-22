'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export function ConviteForm({ token, nomeSistema }: { token: string; nomeSistema: string }) {
  const router = useRouter()
  const [apelido, setApelido] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (senha !== confirmar) { toast.error('As senhas não coincidem'); return }

    setLoading(true)
    const res = await fetch('/api/convite/usar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, apelido, senha }),
    })
    const json = await res.json()
    setLoading(false)

    if (!res.ok) { toast.error(json.error ?? 'Erro ao criar conta'); return }
    router.push('/aguardando')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-[size:48px_48px]" />

      <div className="relative w-full max-w-[360px] px-4">
        <div className="rounded-xl border border-border bg-card p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-1">
            <div className="inline-flex items-center justify-center h-10 w-10 rounded-lg bg-white/5 border border-border mb-3">
              <svg className="h-5 w-5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <h1 className="text-lg font-semibold tracking-tight">{nomeSistema}</h1>
            <p className="text-xs text-muted-foreground">Você foi convidado. Crie seu acesso abaixo.</p>
          </div>

          <div className="h-px bg-border" />

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="apelido" className="text-xs text-muted-foreground">Apelido</Label>
              <Input
                id="apelido"
                placeholder="seunome"
                value={apelido}
                onChange={e => setApelido(e.target.value)}
                required
                autoComplete="username"
                className="h-9 text-sm"
              />
              <p className="text-[11px] text-muted-foreground">3–20 caracteres, sem espaços</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="senha" className="text-xs text-muted-foreground">Senha</Label>
              <Input
                id="senha"
                type="password"
                placeholder="••••••••"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                required
                autoComplete="new-password"
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmar" className="text-xs text-muted-foreground">Confirmar senha</Label>
              <Input
                id="confirmar"
                type="password"
                placeholder="••••••••"
                value={confirmar}
                onChange={e => setConfirmar(e.target.value)}
                required
                autoComplete="new-password"
                className="h-9 text-sm"
              />
            </div>

            <Button type="submit" className="w-full h-9 mt-2" disabled={loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Criar minha conta'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

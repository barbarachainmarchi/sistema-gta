'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, ArrowRight } from 'lucide-react'

export function ConviteForm({ token, nomeSistema }: { token: string; nomeSistema: string }) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [apelido, setApelido] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [nomePersonagem, setNomePersonagem] = useState('')
  const [loading, setLoading] = useState(false)

  function handleStep1(e: React.FormEvent) {
    e.preventDefault()
    if (senha !== confirmar) { toast.error('As senhas não coincidem'); return }
    if (senha.length < 6) { toast.error('Senha deve ter pelo menos 6 caracteres'); return }
    setStep(2)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch('/api/convite/usar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, apelido, senha, nomePersonagem: nomePersonagem.trim() || null }),
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
            <p className="text-xs text-muted-foreground">
              {step === 1 ? 'Você foi convidado. Crie seu acesso abaixo.' : 'Qual é o nome do seu personagem?'}
            </p>
          </div>

          <div className="h-px bg-border" />

          {/* Indicador de step */}
          <div className="flex items-center gap-2 justify-center">
            <span className={`h-1.5 w-8 rounded-full transition-colors ${step >= 1 ? 'bg-primary' : 'bg-border'}`} />
            <span className={`h-1.5 w-8 rounded-full transition-colors ${step >= 2 ? 'bg-primary' : 'bg-border'}`} />
          </div>

          {step === 1 ? (
            <form onSubmit={handleStep1} className="space-y-4">
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

              <Button type="submit" className="w-full h-9 mt-2 gap-1.5">
                Próximo <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="nome" className="text-xs text-muted-foreground">Nome do personagem</Label>
                <Input
                  id="nome"
                  placeholder="Ex: John Smith"
                  value={nomePersonagem}
                  onChange={e => setNomePersonagem(e.target.value)}
                  autoFocus
                  className="h-9 text-sm"
                />
                <p className="text-[11px] text-muted-foreground">Deixe em branco para preencher depois.</p>
              </div>

              <Button type="submit" className="w-full h-9 mt-2" disabled={loading}>
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Criar minha conta'}
              </Button>
              <button type="button" onClick={() => setStep(1)}
                className="w-full text-xs text-muted-foreground hover:text-foreground text-center transition-colors">
                ← Voltar
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

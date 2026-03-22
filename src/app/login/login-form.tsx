'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export function LoginForm({ nomeSistema }: { nomeSistema: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  function getSupabase() {
    if (!supabaseRef.current) supabaseRef.current = createClient()
    return supabaseRef.current
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    // Aceita apelido (sem @) ou email completo
    const loginEmail = email.includes('@') ? email : `${email}@gta.local`
    const { error } = await getSupabase().auth.signInWithPassword({ email: loginEmail, password })

    if (error) {
      toast.error('Email ou senha incorretos')
      setLoading(false)
      return
    }

    router.push('/admin/cadastros')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      {/* Grade decorativa de fundo */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-[size:48px_48px]" />

      <div className="relative w-full max-w-[360px] px-4">
        {/* Card */}
        <div className="rounded-xl border border-border bg-card p-8 shadow-2xl space-y-6">
          {/* Logo */}
          <div className="text-center space-y-1">
            <div className="inline-flex items-center justify-center h-10 w-10 rounded-lg bg-white/5 border border-border mb-3">
              <svg className="h-5 w-5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <h1 className="text-lg font-semibold tracking-tight">{nomeSistema}</h1>
            <p className="text-xs text-muted-foreground">Acesso restrito — faça login para continuar</p>
          </div>

          {/* Divisor */}
          <div className="h-px bg-border" />

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs text-muted-foreground">Apelido ou Email</Label>
              <Input
                id="email"
                type="text"
                placeholder="seunome ou email@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs text-muted-foreground">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="h-9 text-sm"
              />
            </div>

            <Button type="submit" className="w-full h-9 mt-2" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

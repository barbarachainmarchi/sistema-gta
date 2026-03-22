import { createClient } from '@/lib/supabase/server'

export default async function AguardandoPage() {
  const supabase = await createClient()
  const { data: configRow } = await supabase
    .from('config_sistema')
    .select('valor')
    .eq('chave', 'tema')
    .single()
  const tema = configRow ? JSON.parse(configRow.valor) : null
  const nomeSistema = tema?.nomeSistema || 'Sistema GTA'

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-[size:48px_48px]" />
      <div className="relative text-center space-y-3 px-4 max-w-xs">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 mb-2">
          <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-base font-semibold">{nomeSistema}</h1>
        <p className="text-sm text-foreground font-medium">Conta criada com sucesso!</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Sua conta está aguardando aprovação do administrador. Assim que for ativada, você poderá fazer login.
        </p>
      </div>
    </div>
  )
}

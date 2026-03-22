import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { ConviteForm } from './convite-form'

export default async function ConvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: convite } = await admin
    .from('convites')
    .select('expires_at, usado_em')
    .eq('token', token)
    .single()

  if (!convite) {
    return <ConviteErro mensagem="Link inválido ou inexistente." />
  }
  if (convite.usado_em) {
    return <ConviteErro mensagem="Este link já foi utilizado." />
  }
  if (new Date(convite.expires_at) < new Date()) {
    return <ConviteErro mensagem="Este link expirou." />
  }

  const supabase = await createClient()
  const { data: configRow } = await supabase
    .from('config_sistema')
    .select('valor')
    .eq('chave', 'tema')
    .single()
  const tema = configRow ? JSON.parse(configRow.valor) : null
  const nomeSistema = tema?.nomeSistema || 'Sistema GTA'

  return <ConviteForm token={token} nomeSistema={nomeSistema} />
}

function ConviteErro({ mensagem }: { mensagem: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-2">
        <p className="text-sm font-medium text-foreground">{mensagem}</p>
        <p className="text-xs text-muted-foreground">Peça um novo link para o administrador.</p>
      </div>
    </div>
  )
}

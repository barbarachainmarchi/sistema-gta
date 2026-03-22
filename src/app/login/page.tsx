import { createClient } from '@/lib/supabase/server'
import { LoginForm } from './login-form'

export default async function LoginPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('config_sistema')
    .select('valor')
    .eq('chave', 'tema')
    .single()

  const tema = data ? JSON.parse(data.valor) : null
  const nomeSistema = tema?.nomeSistema || 'Sistema GTA'

  return <LoginForm nomeSistema={nomeSistema} />
}

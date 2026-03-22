import { getTema } from '@/lib/getTema'
import { LoginForm } from './login-form'

export default async function LoginPage() {
  const tema = await getTema()
  const nomeSistema = tema?.nomeSistema || 'Sistema GTA'
  return <LoginForm nomeSistema={nomeSistema} />
}

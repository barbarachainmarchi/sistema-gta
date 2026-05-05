import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/header'
import { ImgbbConfig, VendasConfig } from '../layout/layout-client'
import { TelegramConfig } from './telegram-config'

export default async function IntegracoesPage() {
  const supabase = await createClient()
  const [{ data: imgbbData }, { data: ocultarData }] = await Promise.all([
    supabase.from('config_sistema').select('valor').eq('chave', 'imgbb_key').maybeSingle(),
    supabase.from('config_sistema').select('valor').eq('chave', 'ocultar_concluidos_dias').maybeSingle(),
  ])
  const imgbbKey = imgbbData?.valor ?? ''
  const ocultarDias = ocultarData?.valor ? parseInt(ocultarData.valor) || 7 : 7

  // Telegram destinos (usa admin client pois tem dados sensíveis como bot_token)
  let telegramDestinos: unknown[] = []
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const admin = createAdminClient()
    const { data } = await admin
      .from('telegram_destinos')
      .select('*, telegram_tipos_log(tipo, ativo)')
      .order('created_at')
    telegramDestinos = data ?? []
  }

  return (
    <>
      <Header title="Integrações" description="Configurações de serviços externos" />
      <div className="divide-y divide-border">
        <ImgbbConfig initialKey={imgbbKey} />
        <VendasConfig initialDias={ocultarDias} />
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <TelegramConfig iniciais={telegramDestinos as any} />
      </div>
    </>
  )
}

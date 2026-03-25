import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { ImgbbConfig, VendasConfig } from '../layout/layout-client'

export default async function IntegracoesPage() {
  const supabase = await createClient()
  const [{ data: imgbbData }, { data: ocultarData }] = await Promise.all([
    supabase.from('config_sistema').select('valor').eq('chave', 'imgbb_key').maybeSingle(),
    supabase.from('config_sistema').select('valor').eq('chave', 'ocultar_concluidos_dias').maybeSingle(),
  ])
  const imgbbKey = imgbbData?.valor ?? ''
  const ocultarDias = ocultarData?.valor ? parseInt(ocultarData.valor) || 7 : 7

  return (
    <>
      <Header title="Integrações" description="Configurações de serviços externos" />
      <div className="divide-y divide-border">
        <ImgbbConfig initialKey={imgbbKey} />
        <VendasConfig initialDias={ocultarDias} />
      </div>
    </>
  )
}

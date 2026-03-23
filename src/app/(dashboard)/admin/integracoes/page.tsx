import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { ImgbbConfig } from '../layout/layout-client'

export default async function IntegracoesPage() {
  const supabase = await createClient()
  const { data } = await supabase.from('config_sistema').select('valor').eq('chave', 'imgbb_key').single()
  const imgbbKey = data?.valor ?? ''

  return (
    <>
      <Header title="Integrações" description="Configurações de serviços externos" />
      <ImgbbConfig initialKey={imgbbKey} />
    </>
  )
}

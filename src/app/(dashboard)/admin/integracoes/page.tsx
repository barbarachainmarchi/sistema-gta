import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { ImgbbConfig, VendasConfig } from '../layout/layout-client'
import { TelegramConfig } from './telegram-config'
import { ExclusaoSupremaConfig } from './exclusao-suprema-config'

export default async function IntegracoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: imgbbData },
    { data: ocultarData },
    { data: permRow },
    { data: donoConfig },
  ] = await Promise.all([
    supabase.from('config_sistema').select('valor').eq('chave', 'imgbb_key').maybeSingle(),
    supabase.from('config_sistema').select('valor').eq('chave', 'ocultar_concluidos_dias').maybeSingle(),
    supabase.from('usuarios').select('perfis_acesso(perfil_permissoes(modulo))').eq('id', user.id).maybeSingle(),
    supabase.from('config_sistema').select('valor').eq('chave', 'dono_secundario_id').maybeSingle(),
  ])

  const imgbbKey = imgbbData?.valor ?? ''
  const ocultarDias = ocultarData?.valor ? parseInt(ocultarData.valor) || 7 : 7

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const perms = (permRow as any)?.perfis_acesso?.perfil_permissoes
  const isDono = perms == null
  const isDonoFantasma = !isDono && donoConfig?.valor === user.id
  const podeGerenciarExclusao = isDono || isDonoFantasma

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

  // Usuários para exclusão suprema (só carregado para donos)
  let usuariosExclusao: { id: string; nome: string | null; exclusao_suprema: boolean }[] = []
  if (podeGerenciarExclusao && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const admin = createAdminClient()
    const { data } = await admin
      .from('usuarios')
      .select('id, nome, exclusao_suprema')
      .order('nome')
    // Filtrar fantasma (sem perfil) da lista — donos não devem aparecer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    usuariosExclusao = (data ?? []).map((u: any) => ({
      id: u.id,
      nome: u.nome,
      exclusao_suprema: u.exclusao_suprema ?? false,
    }))
  }

  return (
    <>
      <Header title="Integrações" description="Configurações de serviços externos" />
      <div className="divide-y divide-border">
        <ImgbbConfig initialKey={imgbbKey} />
        <VendasConfig initialDias={ocultarDias} />
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <TelegramConfig iniciais={telegramDestinos as any} />
        {podeGerenciarExclusao && (
          <ExclusaoSupremaConfig usuariosIniciais={usuariosExclusao} />
        )}
      </div>
    </>
  )
}

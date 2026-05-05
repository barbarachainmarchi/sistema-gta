export const TIPOS_LOG = [
  { tipo: 'acesso',        label: 'Novo Acesso ao Sistema', icone: '🔔' },
  { tipo: 'login',         label: 'Novo Login',             icone: '🔑' },
  { tipo: 'erro_critico',  label: 'Erro Crítico',           icone: '🚨' },
  { tipo: 'novo_cadastro', label: 'Novo Cadastro',          icone: '✅' },
  { tipo: 'alteracao',     label: 'Alteração de Dados',     icone: '📝' },
  { tipo: 'backup',        label: 'Backup Realizado',       icone: '💾' },
  { tipo: 'encomenda',     label: 'Nova Encomenda',         icone: '📦' },
] as const

export type TipoLog = typeof TIPOS_LOG[number]['tipo']

export interface EncomendaDados {
  destinatario: string
  itens: { nome: string; quantidade: number }[]
  total: number
  link: string
}

export interface NotifParams {
  tipo: TipoLog
  usuario_nome: string
  pagina?: string
  link_log?: string
  encomenda?: EncomendaDados
}

function fmtData(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatarMensagem(params: NotifParams): string {
  const meta = TIPOS_LOG.find(t => t.tipo === params.tipo)
  const icone = meta?.icone ?? '🔔'
  const label = meta?.label ?? params.tipo.toUpperCase()
  const dataStr = fmtData(new Date())

  if (params.tipo === 'encomenda' && params.encomenda) {
    const e = params.encomenda
    const itensStr = e.itens.map(it => `  • ${it.nome} — ${it.quantidade}`).join('\n')
    const totalStr = e.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
    return [
      `📦 *NOVA ENCOMENDA*`,
      ``,
      `👤 Criado por: ${params.usuario_nome}`,
      `🎯 Para: ${e.destinatario}`,
      `📋 Itens:`,
      itensStr,
      `📅 Data: ${dataStr}`,
      `💰 Total: R$ ${totalStr}`,
      ``,
      `🔗 Ver encomenda: ${e.link}`,
    ].join('\n')
  }

  const linhas = [
    `${icone} *${label.toUpperCase()}*`,
    ``,
    `👤 Usuário: ${params.usuario_nome}`,
    `📅 Data: ${dataStr}`,
  ]
  if (params.pagina) linhas.push(`📄 Página: ${params.pagina}`)
  if (params.link_log) linhas.push(``, `🔗 Ver log completo: ${params.link_log}`)

  return linhas.join('\n')
}

export async function enviarParaBot(botToken: string, chatId: string, texto: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: 'Markdown' }),
    })
    return res.ok
  } catch {
    return false
  }
}

// Deve receber um cliente Supabase com service role para bypassar RLS
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function dispararNotificacao(adminClient: any, params: NotifParams): Promise<void> {
  const { data: destinos } = await adminClient
    .from('telegram_destinos')
    .select('id, bot_token, chat_id, telegram_tipos_log(tipo, ativo)')
    .eq('ativo', true)

  if (!destinos?.length) return

  const texto = formatarMensagem(params)

  for (const d of destinos) {
    const tipos: { tipo: string; ativo: boolean }[] = d.telegram_tipos_log ?? []
    const tipoAtivo = tipos.find(t => t.tipo === params.tipo)
    if (!tipoAtivo?.ativo) continue
    void enviarParaBot(d.bot_token, d.chat_id, texto)
  }
}

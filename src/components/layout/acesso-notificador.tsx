'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

interface Props {
  usuarioNome: string
}

// Dispara notificação Telegram de "acesso" uma vez por sessão de browser
export function AcessoNotificador({ usuarioNome }: Props) {
  const pathname = usePathname()

  useEffect(() => {
    const key = 'tg_acesso_ok'
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    fetch('/api/telegram/notify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tipo: 'acesso', usuario_nome: usuarioNome, pagina: pathname }),
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

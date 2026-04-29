import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { local_trabalho_loja_id, local_trabalho_faccao_id, trabalho_principal } = await req.json()

  const admin = createAdminClient()
  const { error } = await admin
    .from('usuarios')
    .upsert({
      id: user.id,
      local_trabalho_loja_id: local_trabalho_loja_id ?? null,
      local_trabalho_faccao_id: local_trabalho_faccao_id ?? null,
      trabalho_principal: trabalho_principal ?? null,
    }, { onConflict: 'id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

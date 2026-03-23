export async function uploadImgbb(base64: string, key: string, nome?: string): Promise<string> {
  const form = new FormData()
  form.append('key', key)
  form.append('image', base64)
  if (nome) form.append('name', nome)
  const res = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: form })
  const data = await res.json()
  if (!data.success) throw new Error(data.error?.message ?? 'Upload para imgbb falhou')
  return data.data.url as string
}

export async function getImgbbKey(): Promise<string> {
  const { createClient } = await import('@/lib/supabase/client')
  const sb = createClient()
  const { data } = await sb.from('config_sistema').select('valor').eq('chave', 'imgbb_key').single()
  return data?.valor ?? ''
}

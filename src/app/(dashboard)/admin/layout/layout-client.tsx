'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Check, RotateCcw, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const PRESETS = [
  { label: 'Branco',   h: 0,   s: 0,   l: 90 },
  { label: 'Cinza',    h: 0,   s: 0,   l: 55 },
  { label: 'Vermelho', h: 0,   s: 72,  l: 50 },
  { label: 'Laranja',  h: 24,  s: 95,  l: 52 },
  { label: 'Âmbar',    h: 45,  s: 93,  l: 47 },
  { label: 'Verde',    h: 142, s: 71,  l: 42 },
  { label: 'Ciano',    h: 187, s: 85,  l: 43 },
  { label: 'Azul',     h: 217, s: 91,  l: 60 },
  { label: 'Índigo',   h: 245, s: 58,  l: 55 },
  { label: 'Roxo',     h: 270, s: 60,  l: 55 },
  { label: 'Rosa',     h: 330, s: 70,  l: 55 },
]

const CATEGORIAS = [
  { key: 'admin',        label: 'Admin' },
  { key: 'investigacao', label: 'Investigação' },
  { key: 'vendas',       label: 'Vendas' },
  { key: 'ferramentas',  label: 'Ferramentas' },
  { key: 'gestao',       label: 'Gestão' },
]

type CategoriaCores = Partial<Record<string, string>>

interface Tema {
  accentH: number
  accentS: number
  accentL: number
  nomeSistema: string
  categoriaCores?: CategoriaCores
  paginaInicial?: string
  financeiroTabPadrao?: string
}

export function ImgbbConfig({ initialKey }: { initialKey: string }) {
  const [chave, setChave] = useState(initialKey)
  const [saving, setSaving] = useState(false)

  async function handleSalvar() {
    setSaving(true)
    try {
      const sb = createClient()
      const { error } = await sb.from('config_sistema').upsert({ chave: 'imgbb_key', valor: chave, updated_at: new Date().toISOString() })
      if (error) throw error
      toast.success('Chave salva!')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex-1 p-6 max-w-2xl">
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Integrações</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Configurações de serviços externos</p>
        </div>

        <div className="p-4 rounded-lg border border-border space-y-3">
          <div>
            <p className="text-sm font-medium">imgbb</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Chave de API para upload de imagens. Obtenha em{' '}
              <span className="font-mono text-[11px] bg-white/[0.06] px-1.5 py-0.5 rounded border border-white/10">imgbb.com → API</span>
            </p>
          </div>
          <div className="flex gap-2">
            <input
              type="password"
              value={chave}
              onChange={e => setChave(e.target.value)}
              placeholder="Cole sua API key aqui..."
              className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus:border-ring"
            />
            <button
              onClick={handleSalvar}
              disabled={saving}
              className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

function applyTheme(tema: Tema) {
  const hsl = `hsl(${tema.accentH}, ${tema.accentS}%, ${tema.accentL}%)`
  document.documentElement.style.setProperty('--color-primary', hsl)
  document.documentElement.style.setProperty('--color-ring', hsl)
}

export function LayoutClient({ initialTema }: { initialTema: Tema }) {
  const [saved, setSaved] = useState<Tema>(initialTema)
  const [preview, setPreview] = useState<Tema>(initialTema)
  const [saving, setSaving] = useState(false)

  const hasChanges = JSON.stringify(preview) !== JSON.stringify(saved)
  const previewColor = `hsl(${preview.accentH}, ${preview.accentS}%, ${preview.accentL}%)`

  function updatePreview(next: Tema) {
    setPreview(next)
    applyTheme(next)
  }

  function selectPreset(p: typeof PRESETS[0]) {
    updatePreview({ ...preview, accentH: p.h, accentS: p.s, accentL: p.l })
  }

  function setCategoriaColor(key: string, h: number, s: number, l: number) {
    const cores = { ...(preview.categoriaCores ?? {}), [key]: `hsl(${h}, ${s}%, ${l}%)` }
    setPreview({ ...preview, categoriaCores: cores })
  }

  function clearCategoriaColor(key: string) {
    const cores = { ...(preview.categoriaCores ?? {}) }
    delete cores[key]
    setPreview({ ...preview, categoriaCores: cores })
  }

  async function handleSave() {
    setSaving(true)
    try {
      const sb = createClient()
      const { error } = await sb
        .from('config_sistema')
        .upsert({ chave: 'tema', valor: JSON.stringify(preview), updated_at: new Date().toISOString() })
      if (error) throw error
      await fetch('/api/revalidar-tema', { method: 'POST' })
      setSaved(preview)
      applyTheme(preview)
      toast.success('Tema salvo!')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
    updatePreview(saved)
  }

  return (
    <>
      <Header title="Layout" description="Aparência do sistema">
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleReset}>
              <RotateCcw className="h-3 w-3 mr-1" />Reverter
            </Button>
          )}
          <Button size="sm" className="h-8 text-xs" onClick={handleSave} disabled={!hasChanges || saving}>
            <Check className="h-3 w-3 mr-1" />
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </Header>

      <div className="flex-1 p-6 max-w-2xl space-y-8">

        {/* Nome */}
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">Nome do sistema</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Aparece na sidebar e na aba do navegador</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Nome</Label>
            <Input
              value={preview.nomeSistema}
              onChange={e => updatePreview({ ...preview, nomeSistema: e.target.value })}
              className="h-9 max-w-xs"
              placeholder="Nome do sistema"
            />
          </div>
        </section>

        <div className="h-px bg-border" />

        {/* Cor de destaque */}
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold">Cor de destaque</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Itens ativos da sidebar, botões e indicadores</p>
          </div>

          <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card/50">
            <div className="h-8 w-8 rounded-md border border-white/10 shrink-0" style={{ background: previewColor }} />
            <div className="flex-1">
              <p className="text-sm font-medium" style={{ color: previewColor }}>Texto ativo</p>
              <p className="text-xs text-muted-foreground">
                hsl({preview.accentH}, {preview.accentS}%, {preview.accentL}%)
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ background: previewColor }} />
              Indicador
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">Paleta rápida</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map(preset => {
                const color = `hsl(${preset.h}, ${preset.s}%, ${preset.l}%)`
                const isSelected = preview.accentH === preset.h && preview.accentS === preset.s && preview.accentL === preset.l
                return (
                  <button
                    key={preset.label}
                    onClick={() => selectPreset(preset)}
                    title={preset.label}
                    className={cn(
                      'h-8 w-8 rounded-md border-2 transition-all flex items-center justify-center',
                      isSelected ? 'border-white/40 scale-110' : 'border-transparent hover:border-white/20'
                    )}
                    style={{ background: color }}
                  >
                    {isSelected && <Check className="h-3.5 w-3.5 text-black/60" />}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Personalizado (HSL)</p>
            <div className="grid grid-cols-3 gap-3 max-w-sm">
              <div className="space-y-1">
                <Label className="text-xs">Matiz (0–360)</Label>
                <Input type="number" min={0} max={360} className="h-9 text-sm" value={preview.accentH}
                  onChange={e => updatePreview({ ...preview, accentH: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Saturação (%)</Label>
                <Input type="number" min={0} max={100} className="h-9 text-sm" value={preview.accentS}
                  onChange={e => updatePreview({ ...preview, accentS: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Luminosidade (%)</Label>
                <Input type="number" min={0} max={100} className="h-9 text-sm" value={preview.accentL}
                  onChange={e => updatePreview({ ...preview, accentL: Number(e.target.value) })} />
              </div>
            </div>
          </div>
        </section>

        <div className="h-px bg-border" />

        {/* Cores das categorias */}
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold">Cor das categorias</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Cor do título de cada grupo na sidebar</p>
          </div>

          <div className="space-y-3">
            {CATEGORIAS.map(cat => {
              const corAtual = preview.categoriaCores?.[cat.key]
              return (
                <div key={cat.key} className="flex items-center gap-4 p-3 rounded-lg border border-border">
                  <div className="w-28 shrink-0">
                    <p
                      className="text-[11px] font-semibold uppercase tracking-widest"
                      style={{ color: corAtual ?? undefined }}
                    >
                      {cat.label}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap flex-1">
                    {PRESETS.map(preset => {
                      const cor = `hsl(${preset.h}, ${preset.s}%, ${preset.l}%)`
                      const isSelected = corAtual === cor
                      return (
                        <button
                          key={preset.label}
                          onClick={() => setCategoriaColor(cat.key, preset.h, preset.s, preset.l)}
                          title={preset.label}
                          className={cn(
                            'h-5 w-5 rounded border-2 transition-all flex items-center justify-center shrink-0',
                            isSelected ? 'border-white/50 scale-110' : 'border-transparent hover:border-white/20'
                          )}
                          style={{ background: cor }}
                        >
                          {isSelected && <Check className="h-2.5 w-2.5 text-black/60" />}
                        </button>
                      )
                    })}
                  </div>

                  {corAtual && (
                    <button
                      onClick={() => clearCategoriaColor(cat.key)}
                      title="Remover cor"
                      className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        <div className="h-px bg-border" />

        {/* Comportamento */}
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold">Comportamento</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Redirecionamentos e abas padrão</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Página inicial</Label>
              <select
                value={preview.paginaInicial ?? 'ferramentas/calculadora'}
                onChange={e => updatePreview({ ...preview, paginaInicial: e.target.value })}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus:border-ring"
              >
                <option value="ferramentas/calculadora">Calculadora</option>
                <option value="financeiro">Financeiro</option>
                <option value="admin/cadastros">Cadastros</option>
                <option value="investigacao">Investigação</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tab padrão do Financeiro</Label>
              <select
                value={preview.financeiroTabPadrao ?? 'extrato'}
                onChange={e => updatePreview({ ...preview, financeiroTabPadrao: e.target.value })}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus:border-ring"
              >
                <option value="extrato">Extrato</option>
                <option value="banco">Banco</option>
                <option value="transferencias">Transferências</option>
                <option value="lavagem">Lavagem</option>
                <option value="contas">Cadastro de Contas</option>
              </select>
            </div>
          </div>
        </section>

      </div>
    </>
  )
}

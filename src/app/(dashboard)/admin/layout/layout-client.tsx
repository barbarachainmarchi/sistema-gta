'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Check, RotateCcw } from 'lucide-react'
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

interface Tema {
  accentH: number
  accentS: number
  accentL: number
  nomeSistema: string
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

  async function handleSave() {
    setSaving(true)
    try {
      const sb = createClient()
      const { error } = await sb
        .from('config_sistema')
        .upsert({ chave: 'tema', valor: JSON.stringify(preview), updated_at: new Date().toISOString() })
      if (error) throw error
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

        {/* Cor */}
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold">Cor de destaque</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Itens ativos da sidebar, botões e indicadores</p>
          </div>

          {/* Preview */}
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

          {/* Presets */}
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

          {/* HSL manual */}
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
      </div>
    </>
  )
}

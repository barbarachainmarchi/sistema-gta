'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Download, Upload, Loader2, Package, Search, DollarSign, Database, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const MODULOS = [
  { key: 'produtos',      label: 'Produtos',      descricao: 'Itens, categorias, receitas, preços, reciclagem', icon: Package },
  { key: 'investigacao',  label: 'Investigação',   descricao: 'Facções, membros, veículos, lojas, preços',      icon: Search },
  { key: 'financeiro',    label: 'Financeiro',     descricao: 'Contas, lançamentos e lavagem',                  icon: DollarSign },
  { key: 'tudo',          label: 'Tudo',           descricao: 'Backup completo de todos os módulos',            icon: Database },
]

type ResultadoImport = Record<string, { ok: boolean; count: number; erro?: string }>

export function BackupClient() {
  const [baixando, setBaixando] = useState<string | null>(null)
  const [importando, setImportando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoImport | null>(null)
  const [arquivoNome, setArquivoNome] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleExportar(modulo: string) {
    setBaixando(modulo)
    try {
      const res = await fetch(`/api/backup?modulo=${modulo}`)
      if (!res.ok) throw new Error('Erro ao gerar backup')
      const json = await res.json()
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `backup-${modulo}-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Backup de ${modulo} exportado!`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao exportar')
    } finally {
      setBaixando(null)
    }
  }

  async function handleArquivoSelecionado(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setArquivoNome(file.name)
    setResultado(null)
    setImportando(true)
    try {
      const texto = await file.text()
      const json = JSON.parse(texto)
      if (!json.tabelas || !json.modulo) throw new Error('Arquivo inválido — não é um backup do sistema')
      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modulo: json.modulo, tabelas: json.tabelas }),
      })
      const data = await res.json()
      setResultado(data.resultados)
      if (data.ok) {
        toast.success('Importação concluída!')
      } else {
        toast.error('Importação concluída com erros')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao importar')
    } finally {
      setImportando(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex-1 p-6 space-y-8 max-w-2xl">

      {/* Exportar */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Exportar backup</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Baixa um arquivo JSON com todos os dados do módulo selecionado</p>
        </div>

        <div className="space-y-2">
          {MODULOS.map(m => {
            const Icon = m.icon
            const loading = baixando === m.key
            return (
              <div
                key={m.key}
                className={cn(
                  'flex items-center justify-between p-4 rounded-lg border border-border bg-card/30'
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{m.label}</p>
                    <p className="text-xs text-muted-foreground">{m.descricao}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5 shrink-0"
                  onClick={() => handleExportar(m.key)}
                  disabled={!!baixando}
                >
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  {loading ? 'Exportando...' : 'Exportar'}
                </Button>
              </div>
            )
          })}
        </div>
      </section>

      <div className="h-px bg-border" />

      {/* Importar */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Importar backup</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Selecione um arquivo de backup JSON exportado pelo sistema. Dados existentes com mesmo ID serão sobrescritos.
          </p>
        </div>

        <div
          className="flex flex-col items-center justify-center gap-3 p-8 rounded-lg border-2 border-dashed border-border hover:border-primary/40 transition-colors cursor-pointer"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-6 w-6 text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm font-medium">
              {arquivoNome ? arquivoNome : 'Clique para selecionar arquivo'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">backup-*.json</p>
          </div>
          {importando && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          <input
            ref={inputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleArquivoSelecionado}
          />
        </div>

        {/* Resultado */}
        {resultado && (
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="px-4 py-2 bg-white/[0.03] border-b border-border">
              <p className="text-xs font-semibold">Resultado da importação</p>
            </div>
            {Object.entries(resultado).map(([tabela, r]) => (
              <div key={tabela} className="flex items-center justify-between px-4 py-2.5 border-b border-border/40 last:border-0">
                <div className="flex items-center gap-2">
                  {r.ok
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />
                    : <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                  }
                  <span className="text-sm font-mono">{tabela}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {r.ok ? `${r.count} registro(s)` : r.erro}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  )
}

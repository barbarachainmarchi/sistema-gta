'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  Search, ShoppingCart, BarChart2, Wallet,
  Calculator, TrendingUp, Target, DollarSign, Shield,
  Users, Database, Palette, FileText, LogOut,
  ChevronDown, Zap, Activity, HardDriveDownload, Home
} from 'lucide-react'

const navGroups = [
  {
    key: 'inicio',
    label: 'Início',
    items: [
      { href: '/', label: 'Dashboard', icon: Home, perm: 'dashboard', exact: true, alwaysShow: true },
    ],
  },
  {
    key: 'admin',
    label: 'Admin',
    items: [
      { href: '/admin/cadastros',   label: 'Cadastros',    icon: Database,     perm: 'admin_cadastros' },
      { href: '/admin/usuarios',    label: 'Usuários',     icon: Users,        perm: 'admin_usuarios' },
      { href: '/admin/layout',      label: 'Layout',       icon: Palette,      perm: 'admin_layout' },
      { href: '/admin/logs',        label: 'Logs',         icon: FileText,     perm: 'admin_logs' },
      { href: '/admin/integracoes',  label: 'Integrações',  icon: Activity,     perm: 'admin_integracoes' },
      { href: '/admin/backup',      label: 'Backup',       icon: HardDriveDownload, perm: 'admin_backup' },
    ],
  },
  {
    key: 'investigacao',
    label: 'Investigação',
    items: [
      { href: '/investigacao',      label: 'Investigação', icon: Search,       perm: 'investigacao' },
    ],
  },
  {
    key: 'vendas',
    label: 'Vendas',
    items: [
      { href: '/vendas',                  label: 'Vendas',         icon: ShoppingCart, perm: 'vendas', exact: true },
      { href: '/vendas/relatorios',       label: 'Relatórios',     icon: BarChart2,    perm: 'vendas' },
      { href: '/vendas/minha-carteira',   label: 'Minha Carteira', icon: Wallet,       perm: 'vendas' },
    ],
  },
  {
    key: 'ferramentas',
    label: 'Ferramentas',
    items: [
      { href: '/ferramentas/calculadora', label: 'Calculadora', icon: Calculator,  perm: 'calculadora' },
      { href: '/ferramentas/cotacao',     label: 'Cotação',     icon: TrendingUp,  perm: 'cotacao' },
    ],
  },
  {
    key: 'financeiro',
    label: 'Financeiro',
    items: [
      { href: '/financeiro',        label: 'Financeiro',   icon: DollarSign,   perm: 'financeiro' },
    ],
  },
  {
    key: 'gestao',
    label: 'Gestão',
    items: [
      { href: '/metas',             label: 'Metas',        icon: Target,       perm: 'metas' },
      { href: '/acao',              label: 'Ação',         icon: Zap,          perm: 'acao' },
    ],
  },
]

const STORAGE_KEY = 'sidebar_collapsed'

export function Sidebar({ nomeSistema, modulosVisiveis, categoriaCores }: { nomeSistema: string; modulosVisiveis: string[] | null; categoriaCores: Record<string, string> }) {
  const pathname = usePathname()
  const router = useRouter()

  // Estado de recolhimento por grupo — inicia tudo aberto
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [mounted, setMounted] = useState(false)

  // Carrega do localStorage após montar (evita hydration mismatch)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setCollapsed(JSON.parse(saved))
    } catch {}
    setMounted(true)
  }, [])

  function toggle(key: string) {
    setCollapsed(prev => {
      const next = { ...prev, [key]: !prev[key] }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  // Se um item do grupo está ativo, nunca recolhe visualmente
  function isGroupActive(group: typeof navGroups[0]) {
    return group.items.some(
      item => pathname === item.href || pathname.startsWith(item.href + '/')
    )
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (!mounted) return null

  // Filtra grupos/itens pelo perfil (null = sem restrição)
  const gruposVisiveis = navGroups
    .map(group => ({
      ...group,
      items: modulosVisiveis === null
        ? group.items
        : group.items.filter(item => ('alwaysShow' in item && item.alwaysShow) || modulosVisiveis.includes(item.perm)),
    }))
    .filter(group => group.items.length > 0)

  return (
    <aside className="fixed left-0 top-0 h-screen w-[var(--sidebar-width)] flex flex-col bg-card border-r border-border z-50">

      {/* Logo */}
      <div className="h-12 flex items-center px-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center">
            <Shield className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="font-semibold text-sm tracking-wide text-foreground">{nomeSistema}</span>
        </div>
      </div>

      {/* Navegação */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {gruposVisiveis.map((group) => {
          const active = isGroupActive(group)
          const isCollapsed = collapsed[group.key] && !active

          return (
            <div key={group.key} className="mb-1">

              {/* Cabeçalho do grupo — clicável */}
              <button
                onClick={() => toggle(group.key)}
                className={cn(
                  'w-full flex items-center justify-between px-2 py-1.5 rounded-md',
                  'text-[11px] font-semibold uppercase tracking-widest transition-colors',
                  active
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <span style={categoriaCores[group.key] ? { color: categoriaCores[group.key] } : undefined}>{group.label}</span>
                <ChevronDown
                  className={cn(
                    'h-3 w-3 transition-transform duration-200',
                    isCollapsed ? '-rotate-90' : 'rotate-0'
                  )}
                />
              </button>

              {/* Itens do grupo */}
              <div
                className={cn(
                  'overflow-hidden transition-all duration-200',
                  isCollapsed ? 'max-h-0 opacity-0' : 'max-h-96 opacity-100'
                )}
              >
                <ul className="mt-0.5 space-y-0.5 pb-1">
                  {group.items.map((item) => {
                    const Icon = item.icon
                    const isActive = 'exact' in item && item.exact
                      ? pathname === item.href
                      : pathname === item.href || pathname.startsWith(item.href + '/')

                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={cn(
                            'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors',
                            isActive
                              ? 'bg-primary/[0.08] text-foreground font-medium'
                              : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]'
                          )}
                        >
                          <Icon className={cn('h-3.5 w-3.5 shrink-0', isActive && 'text-primary')} />
                          {item.label}
                          {isActive && (
                            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                          )}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>

              {/* Separador */}
              <div className="h-px bg-border/50 mx-1 mt-1" />
            </div>
          )
        })}
      </nav>

      {/* Sair */}
      <div className="shrink-0 p-2 border-t border-border">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors"
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" />
          Sair
        </button>
      </div>
    </aside>
  )
}

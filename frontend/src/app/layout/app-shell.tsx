import { motion } from 'framer-motion'
import {
  Activity,
  Bot,
  CalendarClock,
  Gauge,
  ListChecks,
  Menu,
  PlayCircle,
  Settings,
  Users,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { api } from '@/shared/lib/api'
import { cn } from '@/shared/lib/utils'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: Gauge },
  { to: '/contas', label: 'Contas', icon: Users },
  { to: '/automacoes', label: 'Automações', icon: Bot },
  { to: '/execucoes', label: 'Execuções', icon: ListChecks },
  { to: '/executar-agora', label: 'Executar Agora', icon: PlayCircle },
  { to: '/agendamentos', label: 'Agendamentos', icon: CalendarClock },
  { to: '/resultados', label: 'Resultados', icon: Activity },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
]

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 w-72 border-r border-border/70 bg-bg/95 px-3 py-4 backdrop-blur md:static md:block',
        open ? 'block' : 'hidden md:block',
      )}
    >
      <div className="mb-4 flex items-center justify-between px-3">
        <div>
          <p className="font-display text-xl font-bold text-slate-50">AutoFeedr</p>
          <p className="text-xs uppercase tracking-wide text-muted">Ops Console</p>
        </div>
        <button className="md:hidden" onClick={onClose} type="button">
          <X size={18} />
        </button>
      </div>

      <nav className="space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                isActive
                  ? 'bg-accent/20 text-accent'
                  : 'text-muted hover:bg-surface hover:text-slate-100',
              )
            }
            to={item.to}
            onClick={onClose}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

export function AppShell() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: api.health,
    refetchInterval: 15_000,
    retry: 1,
  })

  return (
    <div className="min-h-screen md:grid md:grid-cols-[18rem_1fr]">
      <Sidebar open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 border-b border-border/70 bg-bg/80 px-4 py-3 backdrop-blur md:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button className="md:hidden" onClick={() => setMobileMenuOpen(true)} type="button">
                <Menu size={18} />
              </button>
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-muted">Ambiente</p>
                <p className="font-mono text-xs text-slate-100">{import.meta.env.MODE}</p>
              </div>
              <Badge variant={healthQuery.data?.status === 'ok' ? 'success' : 'danger'}>
                API {healthQuery.data?.status === 'ok' ? 'online' : 'offline'}
              </Badge>
            </div>

            <Button size="sm" onClick={() => navigate('/executar-agora')}>
              <PlayCircle className="mr-2 h-4 w-4" /> Executar agora
            </Button>
          </div>
        </header>

        <main className="flex-1 px-4 py-5 md:px-6 md:py-6">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  )
}

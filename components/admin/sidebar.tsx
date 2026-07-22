'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  LayoutDashboard, Fish, Scissors, ShoppingCart,
  Users, Star, BarChart3, Settings, LogOut, Menu, X, QrCode, MessageCircle, Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DrFishLogo } from '@/components/icons/DrFishLogo';
import { GowaStatusDot } from '@/components/GowaStatus';

const navItems = [
  { href: '/dashboard',     label: 'Dashboard',      icon: LayoutDashboard, badge: null },
  { href: '/products',      label: 'Produits',        icon: Fish,            badge: null },
  { href: '/services',      label: 'Services',        icon: Scissors,        badge: null },
  { href: '/sales',         label: 'Ventes',          icon: ShoppingCart,    badge: null },
  { href: '/clients',       label: 'Clients',         icon: Users,           badge: null },
  { href: '/subscriptions', label: 'Abonnements',     icon: Star,            badge: null },
  { href: '/agents',        label: 'Agents',          icon: BarChart3,       badge: null },
  { href: '/referrals',     label: 'Parrainage',      icon: QrCode,          badge: null },
  { href: '/campaigns',     label: 'Campagnes WA',    icon: MessageCircle,   badge: 'gowa' },
  { href: '/alerts',        label: 'Alertes auto',    icon: Bell,            badge: null },
  { href: '/settings',      label: 'Paramètres',      icon: Settings,        badge: null },
];

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const initials = session?.user?.name?.[0]?.toUpperCase() ?? '?';

  return (
    <aside
      className="flex flex-col h-full w-[240px] lg:w-[220px]"
      style={{ background: 'var(--navy)' }}
    >
      {/* Logo — top padding includes status bar safe area */}
      <div className="px-5 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', paddingTop: 'calc(env(safe-area-inset-top) + 20px)', paddingBottom: '20px' }}>
        <div className="flex items-center gap-2">
          <DrFishLogo variant="white" size="sm" />
          <p className="text-[11px] ml-1" style={{ color: 'rgba(255,255,255,0.3)' }}>CRM</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors p-1 lg:hidden">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto no-scrollbar">
        {navItems.map(({ href, label, icon: Icon, badge }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-[10px] rounded-xl text-[13px] font-medium transition-all duration-150"
              style={{
                color: isActive ? '#fff' : 'rgba(255,255,255,0.5)',
                background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--blue)' : '3px solid transparent',
              }}
            >
              <Icon size={16} className="flex-shrink-0"
                style={{ color: isActive ? 'var(--blue-light)' : 'rgba(255,255,255,0.4)' }} />
              <span className="flex-1">{label}</span>
              {badge === 'gowa' && <GowaStatusDot />}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0"
            style={{ background: 'var(--blue)' }}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-[13px] font-semibold truncate">{session?.user?.name}</p>
            <p className="text-[11px] truncate" style={{ color: 'rgba(255,255,255,0.3)' }}>{session?.user?.email}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 w-full"
          style={{ color: 'rgba(255,255,255,0.4)' }}
          onMouseEnter={e => { const el = e.currentTarget; el.style.background = 'rgba(255,255,255,0.07)'; el.style.color = '#fff'; }}
          onMouseLeave={e => { const el = e.currentTarget; el.style.background = 'transparent'; el.style.color = 'rgba(255,255,255,0.4)'; }}
        >
          <LogOut size={14} />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}

export function AdminSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: session } = useSession();

  return (
    <>
      {/* ── Mobile top bar ── */}
      <header
        className="lg:hidden fixed top-0 left-0 right-0 z-30"
        style={{ background: 'var(--navy)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        {/* Fills the status bar zone so background extends behind it */}
        <div style={{ height: 'env(safe-area-inset-top)' }} />
        <div className="h-14 flex items-center justify-between px-4">
          <button
            onClick={() => setMobileOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-white/70 hover:text-white transition-colors"
            style={{ background: 'rgba(255,255,255,0.07)' }}
          >
            <Menu size={19} />
          </button>

          <DrFishLogo variant="white" size="sm" />

          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-[12px] font-bold"
            style={{ background: 'var(--blue)' }}>
            {session?.user?.name?.[0]?.toUpperCase() ?? '?'}
          </div>
        </div>
      </header>

      {/* ── Desktop sidebar ── */}
      <div className="hidden lg:block fixed left-0 top-0 h-screen z-40 shadow-[2px_0_20px_rgba(0,0,0,0.15)]">
        <SidebarContent />
      </div>

      {/* ── Mobile overlay ── */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile drawer ── */}
      <div
        className={cn(
          'lg:hidden fixed left-0 top-0 h-screen z-50 shadow-[4px_0_30px_rgba(0,0,0,0.3)]',
          'transition-transform duration-300 ease-in-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <SidebarContent onClose={() => setMobileOpen(false)} />
      </div>
    </>
  );
}

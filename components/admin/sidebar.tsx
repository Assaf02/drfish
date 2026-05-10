'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  LayoutDashboard, Fish, Scissors, ShoppingCart,
  Users, Star, BarChart3, Settings, LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard',     label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/products',      label: 'Produits',      icon: Fish },
  { href: '/services',      label: 'Services',      icon: Scissors },
  { href: '/sales',         label: 'Ventes',        icon: ShoppingCart },
  { href: '/clients',       label: 'Clients',       icon: Users },
  { href: '/subscriptions', label: 'Abonnements',   icon: Star },
  { href: '/agents',        label: 'Agents',        icon: BarChart3 },
  { href: '/settings',      label: 'Paramètres',    icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const initials = session?.user?.name?.[0]?.toUpperCase() ?? '?';

  return (
    <aside
      className="fixed left-0 top-0 h-screen w-[220px] flex flex-col z-40"
      style={{ background: 'var(--navy)' }}
    >
      {/* Logo */}
      <div className="px-5 py-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            🐟
          </div>
          <div>
            <p className="text-white font-bold text-[15px] leading-tight">Dr Fish</p>
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>CRM Admin</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto no-scrollbar">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-[9px] rounded-xl text-[13px] font-medium transition-all duration-150 group',
              )}
              style={{
                color: isActive ? '#fff' : 'rgba(255,255,255,0.5)',
                background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--blue)' : '3px solid transparent',
              }}
            >
              <Icon
                size={16}
                className="flex-shrink-0"
                style={{ color: isActive ? 'var(--blue-light)' : 'rgba(255,255,255,0.4)' }}
              />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0"
            style={{ background: 'var(--blue)' }}
          >
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

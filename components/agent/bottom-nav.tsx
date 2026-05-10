'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Home, PlusCircle, Clock, Users, User } from 'lucide-react';

const navItems = [
  { href: '/home',        label: 'Accueil',    icon: Home },
  { href: '/new-sale',    label: 'Vente',      icon: PlusCircle },
  { href: '/history',     label: 'Historique', icon: Clock },
  { href: '/client-list', label: 'Clients',    icon: Users },
  { href: '/profile',     label: 'Profil',     icon: User },
];

export function AgentBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [active, setActive] = useState(pathname);

  useEffect(() => { setActive(pathname); }, [pathname]);

  const handleNav = (href: string) => {
    setActive(href);
    router.push(href);
  };

  return (
    <nav className="bottom-nav">
      <div className="flex items-center justify-around h-[72px] px-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = active === href;
          return (
            <button
              key={href}
              onClick={() => handleNav(href)}
              className="relative flex flex-col items-center justify-center flex-1 h-full gap-1 outline-none"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              {isActive && (
                <motion.div
                  layoutId="activeNavPill"
                  className="absolute inset-x-1 inset-y-2 rounded-[100px]"
                  style={{ background: 'var(--navy)' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <div className="relative z-10 flex flex-col items-center gap-[3px]">
                <Icon
                  size={20}
                  style={{
                    color: isActive ? '#fff' : 'var(--gray-400)',
                    transition: 'color 150ms',
                  }}
                />
                <span
                  className="text-[10px] font-semibold"
                  style={{
                    color: isActive ? '#fff' : 'var(--gray-400)',
                    transition: 'color 150ms',
                  }}
                >
                  {label}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

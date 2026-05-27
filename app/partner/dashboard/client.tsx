'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { toast } from 'sonner';
import {
  Copy, LogOut, TrendingUp, ShoppingCart, BarChart3, Calendar,
  Check, Fish, Scissors,
} from 'lucide-react';
import { formatCFA } from '@/lib/utils';
import { FishIcon } from '@/components/icons/FishIcon';

type Order = {
  id: string;
  date: string;
  products: string;
  totalAmount: number;
  hasServices: boolean;
  commission: number;
};

type Stats = {
  totalOrders: number;
  totalRevenue: number;
  totalCommission: number;
  monthOrders: number;
  monthCommission: number;
  monthWithServicesCount: number;
  monthNoServicesCount: number;
  monthWithServicesCommission: number;
  monthNoServicesCommission: number;
  commissionWithServiceRate: number;
  commissionNoServiceRate: number;
};

type RefInfo = {
  id: string;
  code: string;
  name: string;
  username: string;
  whatsappLink: string;
  commissionWithService: number;
  commissionNoService: number;
};

export function PartnerDashboardClient({
  ref, stats, orders,
}: {
  ref: RefInfo;
  stats: Stats;
  orders: Order[];
}) {
  const [dateFilter, setDateFilter] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(ref.code);
    setCodeCopied(true);
    toast.success('Code copié !');
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const filteredOrders = dateFilter
    ? orders.filter((o) => o.date.includes(dateFilter))
    : orders;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  return (
    <div
      className="min-h-screen pb-10"
      style={{ background: 'var(--off-white)' }}
    >
      {/* Nav */}
      <nav
        className="sticky top-0 z-10 flex items-center justify-between px-4 py-3"
        style={{
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--gray-50)',
          paddingTop: 'calc(env(safe-area-inset-top) + 12px)',
        }}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--navy)' }}>
            <FishIcon size={16} color="white" />
          </div>
          <span className="font-bold text-sm" style={{ color: 'var(--navy)' }}>Dr Fish</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold ml-1"
            style={{ background: 'rgba(46,109,180,0.1)', color: 'var(--blue)' }}>
            Partenaire
          </span>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/partner/login' })}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl transition-colors"
          style={{ color: 'var(--gray-400)' }}
        >
          <LogOut size={13} /> Déconnexion
        </button>
      </nav>

      <div className="max-w-xl mx-auto px-4 pt-6 space-y-5 animate-fade-in">

        {/* Hero greeting */}
        <div
          className="rounded-3xl px-6 py-6"
          style={{
            background: 'linear-gradient(135deg, var(--navy) 0%, #1a3a5c 100%)',
            boxShadow: '0 8px 32px rgba(10,22,40,0.2)',
          }}
        >
          <p className="text-[13px] mb-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {greeting},
          </p>
          <h1 className="font-extrabold text-white mb-4" style={{ fontSize: 24, letterSpacing: '-0.5px' }}>
            {ref.name}
          </h1>
          {/* Code display */}
          <div
            className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1"
                style={{ color: 'rgba(255,255,255,0.4)' }}>
                Votre code de parrainage
              </p>
              <p className="font-extrabold font-mono tracking-widest text-white" style={{ fontSize: 17 }}>
                {ref.code}
              </p>
            </div>
            <button
              onClick={copyCode}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
              style={{
                background: codeCopied ? 'rgba(26,122,74,0.3)' : 'rgba(255,255,255,0.12)',
                color: codeCopied ? '#86efac' : 'rgba(255,255,255,0.8)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              {codeCopied ? <><Check size={12} /> Copié</> : <><Copy size={12} /> Copier</>}
            </button>
          </div>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              label: 'Commandes (total)',
              value: stats.totalOrders.toString(),
              icon: <ShoppingCart size={15} />,
              accent: 'var(--blue)',
              accentBg: 'rgba(46,109,180,0.08)',
            },
            {
              label: 'Commandes ce mois',
              value: stats.monthOrders.toString(),
              icon: <Calendar size={15} />,
              accent: 'var(--teal)',
              accentBg: 'rgba(0,180,166,0.08)',
            },
            {
              label: 'Commission (total)',
              value: formatCFA(stats.totalCommission),
              icon: <BarChart3 size={15} />,
              accent: 'var(--blue)',
              accentBg: 'rgba(46,109,180,0.08)',
            },
            {
              label: 'Commission ce mois',
              value: formatCFA(stats.monthCommission),
              icon: <TrendingUp size={15} />,
              accent: 'var(--orange)',
              accentBg: 'rgba(192,92,0,0.08)',
            },
          ].map(({ label, value, icon, accent, accentBg }) => (
            <div
              key={label}
              className="card p-4"
              style={{ borderLeft: `3px solid ${accent}` }}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--gray-400)' }}>
                  {label}
                </p>
                <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: accentBg, color: accent }}>
                  {icon}
                </span>
              </div>
              <p className="font-extrabold truncate"
                style={{ fontSize: 'clamp(14px, 4vw, 22px)', color: 'var(--navy)', letterSpacing: '-0.5px' }}>
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* Commission breakdown this month */}
        {(stats.monthWithServicesCount > 0 || stats.monthNoServicesCount > 0) && (
          <div className="card p-5">
            <p className="font-bold text-sm mb-4" style={{ color: 'var(--navy)' }}>
              Détail commissions ce mois
            </p>
            <div className="space-y-2.5">
              {stats.monthWithServicesCount > 0 && (
                <div className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: 'rgba(46,109,180,0.06)' }}>
                  <div className="flex items-center gap-2">
                    <Scissors size={13} style={{ color: 'var(--blue)' }} />
                    <div>
                      <p className="text-xs font-semibold" style={{ color: 'var(--navy)' }}>
                        Avec préparation
                      </p>
                      <p className="text-[10px]" style={{ color: 'var(--gray-400)' }}>
                        {stats.monthWithServicesCount} commande{stats.monthWithServicesCount > 1 ? 's' : ''} · {stats.commissionWithServiceRate}%
                      </p>
                    </div>
                  </div>
                  <p className="font-bold text-sm" style={{ color: 'var(--blue)' }}>
                    {formatCFA(stats.monthWithServicesCommission)}
                  </p>
                </div>
              )}
              {stats.monthNoServicesCount > 0 && (
                <div className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: 'rgba(0,180,166,0.06)' }}>
                  <div className="flex items-center gap-2">
                    <Fish size={13} style={{ color: 'var(--teal)' }} />
                    <div>
                      <p className="text-xs font-semibold" style={{ color: 'var(--navy)' }}>
                        Sans préparation
                      </p>
                      <p className="text-[10px]" style={{ color: 'var(--gray-400)' }}>
                        {stats.monthNoServicesCount} commande{stats.monthNoServicesCount > 1 ? 's' : ''} · {stats.commissionNoServiceRate}%
                      </p>
                    </div>
                  </div>
                  <p className="font-bold text-sm" style={{ color: 'var(--teal)' }}>
                    {formatCFA(stats.monthNoServicesCommission)}
                  </p>
                </div>
              )}
              {/* Total due */}
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl border-t mt-1 pt-3"
                style={{ borderColor: 'var(--gray-100)' }}>
                <p className="font-bold text-sm" style={{ color: 'var(--navy)' }}>Total dû ce mois</p>
                <p className="font-extrabold" style={{ fontSize: 18, color: 'var(--orange)', letterSpacing: '-0.5px' }}>
                  {formatCFA(stats.monthCommission)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Orders table */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between gap-3"
            style={{ borderBottom: '1px solid var(--gray-50)' }}>
            <p className="font-bold text-sm" style={{ color: 'var(--navy)' }}>
              Commandes ({filteredOrders.length})
            </p>
            <input
              type="month"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value ? e.target.value : '')}
              className="text-xs px-3 py-1.5 rounded-xl border outline-none"
              style={{ borderColor: 'var(--gray-100)', color: 'var(--navy)', background: 'var(--white)' }}
            />
          </div>

          {filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <FishIcon size={36} color="var(--gray-100)" />
              <p className="text-sm" style={{ color: 'var(--gray-400)' }}>Aucune commande</p>
            </div>
          ) : (
            <div>
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="px-4 py-3.5 flex items-start gap-3 border-b last:border-0"
                  style={{ borderColor: 'var(--gray-50)' }}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: order.hasServices ? 'rgba(46,109,180,0.08)' : 'rgba(0,180,166,0.08)' }}>
                    {order.hasServices
                      ? <Scissors size={14} style={{ color: 'var(--blue)' }} />
                      : <Fish size={14} style={{ color: 'var(--teal)' }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--navy)' }}>
                      {order.products}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[10px]" style={{ color: 'var(--gray-400)' }}>{order.date}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                        style={{
                          background: order.hasServices ? 'rgba(46,109,180,0.08)' : 'rgba(0,180,166,0.08)',
                          color: order.hasServices ? 'var(--blue)' : 'var(--teal)',
                        }}>
                        {order.hasServices ? 'Avec prép.' : 'Sans prép.'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-semibold" style={{ color: 'var(--navy)' }}>
                      {formatCFA(order.totalAmount)}
                    </p>
                    <p className="text-[11px] font-bold mt-0.5" style={{ color: 'var(--orange)' }}>
                      +{formatCFA(order.commission)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Monthly summary */}
          {filteredOrders.length > 0 && (
            <div className="px-4 py-3 flex items-center justify-between"
              style={{ background: 'var(--off-white)', borderTop: '1px solid var(--gray-50)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--gray-400)' }}>
                Total ({filteredOrders.length} cmde{filteredOrders.length > 1 ? 's' : ''})
              </p>
              <div className="text-right">
                <p className="text-xs font-semibold" style={{ color: 'var(--navy)' }}>
                  {formatCFA(filteredOrders.reduce((s, o) => s + o.totalAmount, 0))}
                </p>
                <p className="text-xs font-bold" style={{ color: 'var(--orange)' }}>
                  +{formatCFA(filteredOrders.reduce((s, o) => s + o.commission, 0))} commission
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

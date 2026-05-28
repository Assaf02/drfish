'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  TrendingUp, ShoppingCart, Star, AlertTriangle, Clock,
  Fish, Users, Sparkles, ChevronLeft, ChevronRight, Loader2,
} from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import type { DateRange } from 'react-day-picker';
import { fr } from 'date-fns/locale';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, subDays } from 'date-fns';
import 'react-day-picker/dist/style.css';

import { getDashboardData } from '@/app/actions/sales';
import { getPeriodLabel } from '@/lib/utils';
import type { Period } from '@/lib/utils';
import { KPICard } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCFA, getPaymentStatusLabel } from '@/lib/utils';
import { RevenueChart } from '@/components/admin/revenue-chart';
import { FishIcon } from '@/components/icons/FishIcon';

// ── Types ──────────────────────────────────────────────────────────────────────

type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

const PERIODS: Array<{ key: Period; label: string }> = [
  { key: 'today', label: "Aujourd'hui" },
  { key: '7d',    label: '7 jours' },
  { key: '30d',   label: '30 jours' },
  { key: 'month', label: 'Ce mois' },
  { key: 'custom', label: 'Personnalisé' },
];

function periodToRange(p: Period): { from: Date; to: Date } {
  const now = new Date();
  switch (p) {
    case 'today':  return { from: startOfDay(now), to: endOfDay(now) };
    case '7d':     return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case 'month':  return { from: startOfMonth(now), to: endOfMonth(now) };
    default:       return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
  }
}

// ── Main component ─────────────────────────────────────────────────────────────

export function DashboardClient({
  initialData,
  initialPeriod,
  initialFromISO,
  initialToISO,
  firstName,
  todayLabel,
}: {
  initialData: DashboardData;
  initialPeriod: Period;
  initialFromISO: string;
  initialToISO: string;
  firstName: string;
  todayLabel: string;
}) {
  const router   = useRouter();
  const [data,      setData]      = useState<DashboardData>(initialData);
  const [period,    setPeriod]    = useState<Period>(initialPeriod);
  const [fromISO,   setFromISO]   = useState(initialFromISO);
  const [toISO,     setToISO]     = useState(initialToISO);
  const [isLoading, setIsLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(initialFromISO + 'T12:00:00'),
    to:   new Date(initialToISO   + 'T12:00:00'),
  });
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close calendar on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  const applyRange = useCallback(async (
    newPeriod: Period,
    from: Date,
    to: Date,
  ) => {
    const fStr = from.toISOString().split('T')[0];
    const tStr = to.toISOString().split('T')[0];

    setPeriod(newPeriod);
    setFromISO(fStr);
    setToISO(tStr);
    setIsLoading(true);

    const params = new URLSearchParams();
    if (newPeriod === 'custom') {
      params.set('from', fStr);
      params.set('to',   tStr);
    } else {
      params.set('period', newPeriod);
    }
    router.replace(`/dashboard?${params}`, { scroll: false });

    try {
      const newData = await getDashboardData(from.toISOString(), to.toISOString());
      setData(newData);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  function handlePillClick(p: Period) {
    if (p === 'custom') {
      setShowPicker((v) => !v);
      return;
    }
    setShowPicker(false);
    const range = periodToRange(p);
    applyRange(p, range.from, range.to);
  }

  function handleApplyCustom() {
    if (!dateRange?.from || !dateRange?.to) return;
    setShowPicker(false);
    applyRange('custom', startOfDay(dateRange.from), endOfDay(dateRange.to));
  }

  const label = getPeriodLabel(period, fromISO, toISO);

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div
        className="rounded-[20px] px-7 py-6"
        style={{
          background: 'linear-gradient(135deg, var(--navy) 0%, var(--navy-light) 100%)',
          boxShadow: '0 8px 32px rgba(10,22,40,0.2)',
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          {/* Greeting */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] mb-2"
              style={{ color: 'rgba(255,255,255,0.4)' }}>
              {todayLabel}
            </p>
            <h1 className="text-white font-extrabold flex items-center gap-2"
              style={{ fontSize: 28, letterSpacing: '-0.5px', lineHeight: 1.2 }}>
              Bonjour {firstName}
              <Sparkles size={22} className="text-blue-300 opacity-80" />
            </h1>
            <p className="text-[14px] mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
              {label}
            </p>
          </div>

          {/* ── Period selector ─────────────────────────────────────────── */}
          <div className="relative flex-shrink-0" ref={pickerRef}>
            <div
              className="flex items-center gap-1 p-1 rounded-2xl"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {PERIODS.map(({ key, label: lbl }) => {
                const active = period === key;
                return (
                  <button
                    key={key}
                    onClick={() => handlePillClick(key)}
                    className="whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
                    style={{
                      background: active ? 'white' : 'transparent',
                      color: active ? 'var(--navy)' : 'rgba(255,255,255,0.6)',
                      boxShadow: active ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
                    }}
                  >
                    {lbl}
                  </button>
                );
              })}
              {isLoading && (
                <Loader2 size={14} className="animate-spin ml-1 flex-shrink-0"
                  style={{ color: 'rgba(255,255,255,0.6)' }} />
              )}
            </div>

            {/* Custom date picker popover */}
            {showPicker && (
              <div
                className="absolute right-0 top-full mt-2 z-50 rounded-2xl p-4"
                style={{
                  background: 'white',
                  boxShadow: '0 8px 32px rgba(10,22,40,0.18), 0 2px 8px rgba(0,0,0,0.08)',
                  border: '1px solid var(--gray-50)',
                  minWidth: 280,
                }}
              >
                <p className="text-xs font-semibold mb-3 uppercase tracking-wide"
                  style={{ color: 'var(--gray-400)' }}>
                  Sélectionner une période
                </p>
                <DayPicker
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  locale={fr}
                  numberOfMonths={1}
                  components={{
                    IconLeft:  () => <ChevronLeft  size={14} />,
                    IconRight: () => <ChevronRight size={14} />,
                  }}
                />
                <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--gray-50)' }}>
                  <button
                    onClick={() => setShowPicker(false)}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold"
                    style={{ background: 'var(--gray-50)', color: 'var(--gray-400)' }}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleApplyCustom}
                    disabled={!dateRange?.from || !dateRange?.to}
                    className="flex-1 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-40"
                    style={{ background: 'var(--navy)', color: 'white' }}
                  >
                    Appliquer
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Filtered content (fades during loading) ───────────────────────── */}
      <div
        className="space-y-6 transition-opacity duration-200"
        style={{ opacity: isLoading ? 0.55 : 1, pointerEvents: isLoading ? 'none' : 'auto' }}
      >
        {/* KPI grid */}
        <div className="grid grid-cols-2 gap-4">
          <KPICard
            title="Revenus"
            value={formatCFA(data.revenue)}
            subtitle={label}
            icon={<TrendingUp size={16} />}
            accentColor="blue"
          />
          <KPICard
            title="Commandes"
            value={String(data.orders)}
            subtitle={label}
            icon={<ShoppingCart size={16} />}
            accentColor="teal"
          />
          <KPICard
            title="Marge"
            value={`${data.margin.toFixed(1)}%`}
            subtitle={label}
            icon={<Star size={16} />}
            accentColor="blue"
          />
          <KPICard
            title="En attente"
            value={String(data.pendingOrders)}
            subtitle="Paiements"
            icon={<Clock size={16} />}
            accentColor="teal"
          />
        </div>

        {/* Revenue chart */}
        <div className="card p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="font-bold" style={{ fontSize: 18, letterSpacing: '-0.3px', color: 'var(--navy)' }}>
                Évolution des revenus
              </h2>
              <p className="text-[13px] mt-0.5" style={{ color: 'var(--gray-400)' }}>
                {label}
              </p>
            </div>
          </div>
          {data.chartData.length > 0 ? (
            <RevenueChart data={data.chartData} />
          ) : (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <FishIcon size={32} color="var(--gray-100)" />
              <p className="text-sm" style={{ color: 'var(--gray-400)' }}>Aucune donnée pour cette période</p>
            </div>
          )}
        </div>

        {/* Bottom grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Recent sales */}
          <div className="lg:col-span-2 card overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between"
              style={{ borderBottom: '1px solid var(--gray-50)' }}>
              <div className="flex items-center gap-2">
                <Clock size={15} style={{ color: 'var(--gray-400)' }} />
                <h2 className="font-bold" style={{ fontSize: 15, color: 'var(--navy)' }}>
                  Ventes récentes
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[12px]" style={{ color: 'var(--gray-400)' }}>{label}</span>
                <a href="/sales" className="text-[12px] font-semibold" style={{ color: 'var(--blue)' }}>
                  Voir tout →
                </a>
              </div>
            </div>

            {data.recentSales.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 gap-3">
                <FishIcon size={48} color="var(--gray-100)" />
                <p className="text-[14px] font-medium" style={{ color: 'var(--gray-400)' }}>
                  Aucune vente sur cette période
                </p>
              </div>
            ) : (
              <div>
                {data.recentSales.map((sale) => (
                  <div key={sale.id}
                    className="px-5 py-3.5 flex items-center gap-4 transition-colors hover:bg-gray-50/70 border-b border-gray-50">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(46,109,180,0.08)' }}>
                      <Fish size={15} style={{ color: 'var(--blue)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold truncate" style={{ color: 'var(--navy)' }}>
                        {sale.clientName ?? 'Anonyme'} · {sale.agentName}
                      </p>
                      <p className="text-[12px] mt-0.5 truncate" style={{ color: 'var(--gray-400)' }}>
                        {sale.products} · {sale.relativeStr}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0 space-y-1">
                      <p className="font-extrabold" style={{ fontSize: 14, color: 'var(--navy)', letterSpacing: '-0.3px' }}>
                        {formatCFA(sale.totalAmount)}
                      </p>
                      <Badge variant={sale.paymentStatus === 'PAID' ? 'green' : 'orange'} dot>
                        {getPaymentStatusLabel(sale.paymentStatus)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-4">

            {/* Best product */}
            <div className="card p-5">
              <p className="label mb-3">Meilleur produit · {label}</p>
              {data.bestProduct ? (
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(0,180,166,0.08)' }}>
                    <FishIcon size={22} color="var(--teal)" />
                  </div>
                  <div>
                    <p className="font-bold" style={{ fontSize: 15, color: 'var(--navy)' }}>
                      {data.bestProduct.name}
                    </p>
                    <p className="text-[12px] mt-0.5" style={{ color: 'var(--gray-400)' }}>
                      {data.bestProduct.quantity.toFixed(1)} kg
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-[14px]" style={{ color: 'var(--gray-400)' }}>Aucune donnée</p>
              )}
            </div>

            {/* Alerts */}
            {(data.pendingOrders > 0 || data.expiringSubscriptions.length > 0) && (
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={14} style={{ color: 'var(--orange)' }} />
                  <p className="label mb-0">Alertes</p>
                </div>
                <div className="space-y-2">
                  {data.pendingOrders > 0 && (
                    <div className="rounded-xl p-3" style={{ background: '#fff3e0' }}>
                      <p className="text-[12px] font-semibold" style={{ color: 'var(--orange)' }}>
                        {data.pendingOrders} paiement{data.pendingOrders > 1 ? 's' : ''} en attente
                      </p>
                    </div>
                  )}
                  {data.expiringSubscriptions.map((sub) => (
                    <div key={sub.id} className="rounded-xl p-3" style={{ background: '#dbeafe' }}>
                      <p className="text-[12px] font-semibold" style={{ color: 'var(--blue)' }}>
                        Abonnement {sub.clientName} expire le {sub.endDateStr}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Agent performance */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Users size={14} style={{ color: 'var(--gray-400)' }} />
                <p className="label mb-0">Agents · {label}</p>
              </div>
              {data.agentsStats.length === 0 ? (
                <p className="text-[13px]" style={{ color: 'var(--gray-400)' }}>Aucune vente sur cette période</p>
              ) : (
                <div className="space-y-3">
                  {data.agentsStats.map((agent) => (
                    <div key={agent.id} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[12px] font-bold flex-shrink-0"
                        style={{ background: 'rgba(46,109,180,0.08)', color: 'var(--blue)' }}>
                        {agent.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold truncate" style={{ color: 'var(--navy)' }}>
                          {agent.name}
                        </p>
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--gray-400)' }}>
                          {agent.orders} commande{agent.orders !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <p className="font-extrabold text-[13px]" style={{ color: 'var(--navy)' }}>
                        {formatCFA(agent.revenue)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Subscriptions */}
            <div className="card p-5">
              <div className="flex items-center justify-between">
                <p className="label mb-0">Abonnements actifs</p>
                <p className="font-extrabold text-[22px]" style={{ color: 'var(--navy)', letterSpacing: '-0.5px' }}>
                  {data.activeSubscriptions}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { Suspense } from 'react';
import { TrendingUp, ShoppingCart, Star, AlertTriangle, Clock, Fish, Users, Sparkles } from 'lucide-react';
import { getDashboardKPIs, getRevenueChart } from '@/app/actions/sales';
import { getAllAgentsStats } from '@/app/actions/agents';
import { getExpiringSubscriptions } from '@/app/actions/subscriptions';
import { KPICard } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { KPICardSkeleton } from '@/components/ui/skeleton';
import { formatCFA, formatRelative, formatDate, getPaymentStatusLabel } from '@/lib/utils';
import { RevenueChart } from '@/components/admin/revenue-chart';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { FishIcon } from '@/components/icons/FishIcon';

export const metadata = { title: 'Dashboard' };
export const revalidate = 60;

async function DashboardContent() {
  const [kpis, chartData, agentsStats, expiring, session] = await Promise.all([
    getDashboardKPIs(),
    getRevenueChart(7),
    getAllAgentsStats(),
    getExpiringSubscriptions(7),
    getServerSession(authOptions),
  ]);

  const firstName = session?.user?.name?.split(' ')[0] ?? 'Admin';
  const today = format(new Date(), "EEEE d MMMM yyyy", { locale: fr });
  const todayCapitalized = today.charAt(0).toUpperCase() + today.slice(1);

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Hero */}
      <div
        className="rounded-[20px] px-7 py-6"
        style={{
          background: 'linear-gradient(135deg, var(--navy) 0%, var(--navy-light) 100%)',
          boxShadow: '0 8px 32px rgba(10,22,40,0.2)',
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {todayCapitalized}
            </p>
            <h1
              className="text-white font-extrabold flex items-center gap-2"
              style={{ fontSize: 28, letterSpacing: '-0.5px', lineHeight: 1.2 }}
            >
              Bonjour {firstName}
              <Sparkles size={22} className="text-blue-300 opacity-80" />
            </h1>
            <p className="text-[14px] mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Voici l&apos;état de Dr Fish aujourd&apos;hui
            </p>
          </div>
          <div
            className="w-14 h-14 rounded-2xl items-center justify-center hidden sm:flex"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <FishIcon size={32} color="rgba(255,255,255,0.7)" />
          </div>
        </div>
      </div>

      {/* KPI grid — 2×2 */}
      <div className="grid grid-cols-2 gap-4">
        <KPICard
          title="Revenus du jour"
          value={formatCFA(kpis.revenueToday)}
          subtitle={`${kpis.ordersToday} commande${kpis.ordersToday !== 1 ? 's' : ''}`}
          icon={<TrendingUp size={16} />}
          accentColor="blue"
        />
        <KPICard
          title="Commandes"
          value={String(kpis.ordersMonth)}
          subtitle="Ce mois-ci"
          icon={<ShoppingCart size={16} />}
          accentColor="teal"
        />
        <KPICard
          title="Ce mois"
          value={formatCFA(kpis.revenueMonth)}
          subtitle={`${kpis.ordersWeek} cmd cette semaine`}
          icon={<TrendingUp size={16} />}
          accentColor="blue"
        />
        <KPICard
          title="Marge"
          value={`${kpis.marginOverview.toFixed(1)}%`}
          subtitle="Marge mensuelle"
          icon={<Star size={16} />}
          accentColor="teal"
        />
      </div>

      {/* Chart */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-bold" style={{ fontSize: 18, letterSpacing: '-0.3px', color: 'var(--navy)' }}>
              Évolution des revenus
            </h2>
            <p className="text-[13px] mt-0.5" style={{ color: 'var(--gray-400)' }}>7 derniers jours</p>
          </div>
        </div>
        <RevenueChart data={chartData} />
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Recent sales */}
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--gray-50)' }}>
            <div className="flex items-center gap-2">
              <Clock size={15} style={{ color: 'var(--gray-400)' }} />
              <h2 className="font-bold" style={{ fontSize: 15, color: 'var(--navy)' }}>Ventes récentes</h2>
            </div>
            <a href="/sales" className="text-[12px] font-semibold" style={{ color: 'var(--blue)' }}>
              Voir tout →
            </a>
          </div>

          {kpis.recentSales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3">
              <FishIcon size={48} color="var(--gray-100)" />
              <p className="text-[14px] font-medium" style={{ color: 'var(--gray-400)' }}>Aucune vente aujourd&apos;hui</p>
            </div>
          ) : (
            <div>
              {kpis.recentSales.map((sale) => (
                <div key={sale.id}
                  className="px-5 py-3.5 flex items-center gap-4 transition-colors hover:bg-gray-50/70 border-b border-gray-50"
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(46,109,180,0.08)' }}>
                    <Fish size={15} style={{ color: 'var(--blue)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold truncate" style={{ color: 'var(--navy)' }}>
                      {sale.client?.name ?? 'Anonyme'} · {sale.agent.name}
                    </p>
                    <p className="text-[12px] mt-0.5 truncate" style={{ color: 'var(--gray-400)' }}>
                      {sale.items.map(i => i.product.name).join(', ')} · {formatRelative(sale.date)}
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
            <p className="label mb-3">Meilleur produit</p>
            {kpis.bestProduct ? (
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(0,180,166,0.08)' }}>
                  <FishIcon size={22} color="var(--teal)" />
                </div>
                <div>
                  <p className="font-bold" style={{ fontSize: 15, color: 'var(--navy)' }}>{kpis.bestProduct.name}</p>
                  <p className="text-[12px] mt-0.5" style={{ color: 'var(--gray-400)' }}>
                    {kpis.bestProduct.quantity.toFixed(1)} kg cette semaine
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-[14px]" style={{ color: 'var(--gray-400)' }}>Pas encore de données</p>
            )}
          </div>

          {/* Alerts */}
          {(kpis.pendingOrders > 0 || expiring.length > 0) && (
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={14} style={{ color: 'var(--orange)' }} />
                <p className="label mb-0">Alertes</p>
              </div>
              <div className="space-y-2">
                {kpis.pendingOrders > 0 && (
                  <div className="rounded-xl p-3" style={{ background: '#fff3e0' }}>
                    <p className="text-[12px] font-semibold" style={{ color: 'var(--orange)' }}>
                      {kpis.pendingOrders} paiement{kpis.pendingOrders > 1 ? 's' : ''} en attente
                    </p>
                  </div>
                )}
                {expiring.map(sub => (
                  <div key={sub.id} className="rounded-xl p-3" style={{ background: '#dbeafe' }}>
                    <p className="text-[12px] font-semibold" style={{ color: 'var(--blue)' }}>
                      Abonnement {sub.client.name} expire le {sub.endDate ? formatDate(sub.endDate) : '—'}
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
              <p className="label mb-0">Agents ce mois</p>
            </div>
            <div className="space-y-3">
              {agentsStats.map(agent => (
                <div key={agent.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[12px] font-bold flex-shrink-0"
                    style={{ background: 'rgba(46,109,180,0.08)', color: 'var(--blue)' }}>
                    {agent.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold truncate" style={{ color: 'var(--navy)' }}>{agent.name}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--gray-400)' }}>{agent.ordersMonth} commandes</p>
                  </div>
                  <p className="font-extrabold text-[13px]" style={{ color: 'var(--navy)' }}>{formatCFA(agent.revenueMonth)}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="rounded-[20px] h-[108px] skeleton" />
        <div className="grid grid-cols-2 gap-4">
          {[0,1,2,3].map(i => <KPICardSkeleton key={i} />)}
        </div>
        <div className="card h-64 skeleton" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}

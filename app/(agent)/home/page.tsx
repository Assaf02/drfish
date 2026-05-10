import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { getAgentDailySummary } from '@/app/actions/sales';
import { getAgentStats } from '@/app/actions/agents';
import Link from 'next/link';
import { PlusCircle, TrendingUp, Clock, Fish } from 'lucide-react';
import { formatCFA, formatRelative, getPaymentStatusLabel } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export const metadata = { title: 'Accueil' };
export const revalidate = 30;

export default async function AgentHomePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const [summary, stats] = await Promise.all([
    getAgentDailySummary(session.user.id),
    getAgentStats(session.user.id),
  ]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  return (
    <div className="px-4 pt-8 pb-4 space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <p className="text-sm text-gray-500">{greeting},</p>
        <h1 className="text-2xl font-bold text-navy">{session.user.name} 👋</h1>
      </div>

      {/* Daily summary */}
      <div className="bg-navy rounded-2xl p-5 shadow-float">
        <p className="text-white/50 text-xs uppercase tracking-wide mb-4">Aujourd&apos;hui</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-3xl font-bold text-white">{summary.totalOrders}</p>
            <p className="text-white/60 text-sm mt-0.5">commandes</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-white">{formatCFA(summary.totalRevenue)}</p>
            <p className="text-white/60 text-sm mt-0.5">chiffre d&apos;affaires</p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <Link
        href="/new-sale"
        className="flex items-center justify-center gap-3 w-full bg-royal text-white font-bold rounded-2xl py-5 text-lg shadow-glow active:scale-[0.98] transition-all"
      >
        <PlusCircle size={22} />
        Nouvelle vente
      </Link>

      {/* Stats this month */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 shadow-card border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={15} className="text-royal" />
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Ce mois</p>
          </div>
          <p className="text-xl font-bold text-navy">{stats.ordersMonth}</p>
          <p className="text-xs text-gray-400">commandes</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-card border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={15} className="text-success" />
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Salaire</p>
          </div>
          <p className="text-xl font-bold text-navy">{formatCFA(stats.salary)}</p>
          <p className="text-xs text-gray-400">estimé ce mois</p>
        </div>
      </div>

      {/* Recent sales */}
      {summary.sales.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock size={15} className="text-gray-400" />
              <h2 className="font-semibold text-navy text-sm">Ventes du jour</h2>
            </div>
            <Link href="/history" className="text-xs text-royal font-medium">Voir tout →</Link>
          </div>
          <div className="space-y-2">
            {summary.sales.slice(0, 5).map((sale) => (
              <div key={sale.id} className="bg-white rounded-xl p-4 shadow-card border border-gray-100 flex items-center gap-3">
                <div className="w-9 h-9 bg-royal/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Fish size={16} className="text-royal" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy truncate">
                    {sale.client?.name ?? 'Client anonyme'}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {sale.items.map((i) => i.product.name).join(', ')} • {formatRelative(sale.date)}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-navy">{formatCFA(sale.totalAmount)}</p>
                  <Badge variant={sale.paymentStatus === 'PAID' ? 'green' : 'orange'} dot>
                    {getPaymentStatusLabel(sale.paymentStatus)}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary.sales.length === 0 && (
        <div className="text-center py-8">
          <div className="text-4xl mb-3">🐟</div>
          <p className="text-navy font-semibold">Aucune vente aujourd&apos;hui</p>
          <p className="text-gray-400 text-sm mt-1">Appuyez sur &ldquo;Nouvelle vente&rdquo; pour commencer</p>
        </div>
      )}
    </div>
  );
}

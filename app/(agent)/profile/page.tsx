import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { getAgentStats } from '@/app/actions/agents';
import { formatCFA } from '@/lib/utils';
import { LogOut, TrendingUp, ShoppingCart, DollarSign } from 'lucide-react';
import { SignOutButton } from '@/components/shared/sign-out-button';

export const metadata = { title: 'Profil' };
export const revalidate = 60;

export default async function AgentProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const stats = await getAgentStats(session.user.id);

  const bonusPercent = stats.ordersMonth >= 20 ? 10 : stats.ordersMonth >= 10 ? 5 : 0;

  return (
    <div className="px-4 pt-6 pb-4 animate-fade-in space-y-6">
      {/* Avatar */}
      <div className="flex flex-col items-center text-center py-4">
        <div className="w-20 h-20 bg-gradient-to-br from-royal to-royal-700 rounded-2xl flex items-center justify-center text-white text-3xl font-bold mb-4 shadow-glow">
          {session.user.name[0]}
        </div>
        <h1 className="text-xl font-bold text-navy">{session.user.name}</h1>
        <p className="text-gray-400 text-sm mt-0.5">{session.user.email}</p>
        <span className="mt-2 px-3 py-1 bg-royal/10 text-royal text-xs font-semibold rounded-full">
          Chargée de clientèle
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl p-3 shadow-card border border-gray-100 text-center">
          <ShoppingCart size={18} className="text-royal mx-auto mb-1" />
          <p className="text-xl font-bold text-navy">{stats.ordersToday}</p>
          <p className="text-xs text-gray-400">Aujourd&apos;hui</p>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-card border border-gray-100 text-center">
          <TrendingUp size={18} className="text-royal mx-auto mb-1" />
          <p className="text-xl font-bold text-navy">{stats.ordersMonth}</p>
          <p className="text-xs text-gray-400">Ce mois</p>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-card border border-gray-100 text-center">
          <DollarSign size={18} className="text-success mx-auto mb-1" />
          <p className="text-lg font-bold text-navy">{formatCFA(stats.revenueMonth)}</p>
          <p className="text-xs text-gray-400">Revenus</p>
        </div>
      </div>

      {/* Salary */}
      <div className="bg-navy rounded-2xl p-5">
        <p className="text-white/50 text-xs uppercase tracking-wide mb-3">Salaire estimé ce mois</p>
        <p className="text-3xl font-bold text-white">{formatCFA(stats.salary)}</p>
        <div className="mt-3 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-white/60">Salaire de base</span>
            <span className="text-white font-medium">25 000 FCFA</span>
          </div>
          {bonusPercent > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Bonus performance (+{bonusPercent}%)</span>
              <span className="text-success font-medium">+{formatCFA(stats.salary - 25000)}</span>
            </div>
          )}
        </div>
        {stats.ordersMonth < 10 ? (
          <p className="mt-3 text-xs text-white/40">
            Encore {10 - stats.ordersMonth} commande{10 - stats.ordersMonth > 1 ? 's' : ''} pour débloquer le bonus +5%
          </p>
        ) : stats.ordersMonth < 20 ? (
          <p className="mt-3 text-xs text-white/40">
            Encore {20 - stats.ordersMonth} commande{20 - stats.ordersMonth > 1 ? 's' : ''} pour le bonus +10%
          </p>
        ) : (
          <p className="mt-3 text-xs text-success">Bonus maximum atteint ! 🎉</p>
        )}
      </div>

      {/* Sign out */}
      <SignOutButton />
    </div>
  );
}

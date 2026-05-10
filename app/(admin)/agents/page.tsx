import { Suspense } from 'react';
import { getAllAgentsStats } from '@/app/actions/agents';
import { formatCFA, getDateRange } from '@/lib/utils';
import { prisma } from '@/lib/prisma';
import { BarChart3, TrendingUp, Users, DollarSign, Award } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export const metadata = { title: 'Agents' };
export const revalidate = 60;

async function AgentsContent() {
  const stats = await getAllAgentsStats();

  return (
    <div className="space-y-6">
      {stats.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-card border border-gray-100">
          <Users size={48} className="text-gray-200 mx-auto mb-4" />
          <p className="text-navy font-semibold">Aucun agent actif</p>
          <p className="text-gray-400 text-sm mt-1">Ajoutez des agents dans les Paramètres</p>
        </div>
      ) : stats.map((agent) => {
        const bonusPercent = agent.ordersMonth >= 20 ? 10 : agent.ordersMonth >= 10 ? 5 : 0;
        return (
          <div key={agent.id} className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
            {/* Agent header */}
            <div className="flex items-center gap-3 px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-50">
              <div className="w-11 h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-royal to-royal-700 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                {agent.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-bold text-navy text-base sm:text-lg">{agent.name}</h2>
                  {bonusPercent > 0 && <Badge variant="green"><Award size={10} /> Bonus {bonusPercent}%</Badge>}
                </div>
                <p className="text-sm text-gray-400 truncate">{agent.email}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-base sm:text-xl font-bold text-navy">{formatCFA(agent.salary)}</p>
                <p className="text-xs text-gray-400">salaire estimé</p>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 divide-x divide-gray-50">
              <div className="p-3 sm:p-4 text-center">
                <p className="text-xl sm:text-2xl font-bold text-navy">{agent.ordersMonth}</p>
                <p className="text-xs text-gray-500 mt-0.5">cmd ce mois</p>
              </div>
              <div className="p-3 sm:p-4 text-center overflow-hidden">
                <p className="text-sm sm:text-xl font-bold text-navy truncate">{formatCFA(agent.revenueMonth)}</p>
                <p className="text-xs text-gray-500 mt-0.5">CA ce mois</p>
              </div>
              <div className="p-3 sm:p-4 text-center overflow-hidden">
                <p className="text-sm sm:text-xl font-bold text-navy truncate">{formatCFA(25000)}</p>
                <p className="text-xs text-gray-500 mt-0.5">salaire base</p>
              </div>
            </div>

            {/* Salary breakdown */}
            <div className="px-6 pb-5 pt-2 space-y-2 bg-gray-50/50">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Salaire de base</span>
                <span className="font-semibold text-navy">{formatCFA(25000)}</span>
              </div>
              {bonusPercent > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Bonus +{bonusPercent}% ({agent.ordersMonth >= 20 ? '≥20 cmd' : '≥10 cmd'})</span>
                  <span className="font-semibold text-success">+{formatCFA(agent.salary - 25000)}</span>
                </div>
              )}
              {bonusPercent === 0 && (
                <p className="text-xs text-gray-400">
                  {10 - agent.ordersMonth > 0 ? `Encore ${10 - agent.ordersMonth} commandes pour le bonus +5%` : ''}
                </p>
              )}
              <div className="flex justify-between text-sm border-t border-gray-200 pt-2 mt-2">
                <span className="font-bold text-navy">Total</span>
                <span className="font-bold text-navy">{formatCFA(agent.salary)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AgentsPage() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Performance agents</h1>
        <p className="page-subtitle">Suivi et rémunération de l&apos;équipe</p>
      </div>
      <Suspense fallback={<div className="animate-pulse space-y-4">{[...Array(2)].map((_, i) => <div key={i} className="h-48 bg-gray-200 rounded-2xl" />)}</div>}>
        <AgentsContent />
      </Suspense>
    </div>
  );
}

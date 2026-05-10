import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { getSales } from '@/app/actions/sales';
import { formatCFA, formatDateTime, getPaymentStatusLabel, getPaymentMethodLabel } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Fish } from 'lucide-react';
import { FishIcon } from '@/components/icons/FishIcon';

export const metadata = { title: 'Historique' };
export const revalidate = 30;

export default async function AgentHistoryPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const { sales } = await getSales({ agentId: session.user.id, limit: 50 });

  return (
    <div className="px-4 pt-6 pb-4 animate-fade-in">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-navy">Mes ventes</h1>
        <p className="text-sm text-gray-500 mt-0.5">{sales.length} vente{sales.length !== 1 ? 's' : ''} au total</p>
      </div>

      {sales.length === 0 ? (
        <div className="text-center py-16">
          <div className="flex justify-center mb-4">
            <FishIcon size={56} color="var(--gray-100)" />
          </div>
          <p className="text-navy font-semibold">Aucune vente enregistrée</p>
          <p className="text-gray-400 text-sm mt-1">Votre historique apparaîtra ici</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sales.map((sale) => (
            <div key={sale.id} className="bg-white rounded-xl p-4 shadow-card border border-gray-100">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-royal/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Fish size={16} className="text-royal" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-navy text-sm truncate">
                        {sale.client?.name ?? 'Client anonyme'}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {sale.items.map((i) => `${i.product.name} ×${i.quantity}kg`).join(', ')}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-navy text-sm">{formatCFA(sale.totalAmount)}</p>
                      <Badge variant={sale.paymentStatus === 'PAID' ? 'green' : 'orange'} dot className="mt-0.5">
                        {getPaymentStatusLabel(sale.paymentStatus)}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <p className="text-xs text-gray-400">{formatDateTime(sale.date)}</p>
                    <Badge variant="gray">{getPaymentMethodLabel(sale.paymentMethod)}</Badge>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

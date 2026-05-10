import { notFound } from 'next/navigation';
import { getClientWithStats } from '@/app/actions/clients';
import { formatCFA, formatDate, formatDateTime, getPaymentStatusLabel, getPaymentMethodLabel } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Phone, MapPin, Fish, Star } from 'lucide-react';
import Link from 'next/link';

export const revalidate = 60;

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const client = await getClientWithStats(params.id);
  if (!client) notFound();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Link href="/clients" className="p-2 rounded-xl hover:bg-white border border-gray-200 text-gray-500 hover:text-navy transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-navy">{client.name}</h1>
          <p className="text-gray-500 text-sm">Profil client</p>
        </div>
      </div>

      {/* Info card */}
      <div className="bg-white rounded-2xl p-6 shadow-card border border-gray-100">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 bg-royal/10 rounded-2xl flex items-center justify-center text-royal font-bold text-2xl flex-shrink-0">
            {client.name[0].toUpperCase()}
          </div>
          <div className="flex-1 space-y-2">
            <h2 className="text-xl font-bold text-navy">{client.name}</h2>
            {client.phone && <div className="flex items-center gap-2 text-sm text-gray-500"><Phone size={14} />{client.phone}</div>}
            {client.address && <div className="flex items-center gap-2 text-sm text-gray-500"><MapPin size={14} />{client.address}</div>}
            {client.notes && <p className="text-sm text-gray-400 bg-gray-50 rounded-lg p-2">{client.notes}</p>}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-white rounded-2xl p-3 sm:p-4 shadow-card border border-gray-100 text-center">
          <p className="text-xl sm:text-2xl font-bold text-navy">{client.sales.length}</p>
          <p className="text-xs text-gray-500">commandes</p>
        </div>
        <div className="bg-white rounded-2xl p-3 sm:p-4 shadow-card border border-gray-100 text-center overflow-hidden">
          <p className="text-sm sm:text-xl font-bold text-navy truncate">{formatCFA(client.totalSpent)}</p>
          <p className="text-xs text-gray-500">total dépensé</p>
        </div>
        <div className="bg-white rounded-2xl p-3 sm:p-4 shadow-card border border-gray-100 text-center">
          <p className="text-xl sm:text-2xl font-bold text-navy">{client.subscriptions.length}</p>
          <p className="text-xs text-gray-500">abonnements</p>
        </div>
      </div>

      {/* Sales history */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Historique des commandes</h2>
        <div className="space-y-3">
          {client.sales.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center shadow-card border border-gray-100">
              <Fish size={40} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Aucune commande</p>
            </div>
          ) : client.sales.map((sale) => (
            <div key={sale.id} className="bg-white rounded-2xl p-4 shadow-card border border-gray-100">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-navy">
                    {sale.items.map((i) => `${i.product.name} ×${i.quantity}kg`).join(', ')}
                  </p>
                  {sale.services.length > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5">{sale.services.map((s) => s.service.name).join(', ')}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <p className="text-xs text-gray-400">{formatDateTime(sale.date)}</p>
                    <Badge variant="gray" className="text-xs">{sale.agent.name}</Badge>
                    <Badge variant="gray" className="text-xs">{getPaymentMethodLabel(sale.paymentMethod)}</Badge>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <p className="font-bold text-navy">{formatCFA(sale.totalAmount)}</p>
                  <Badge variant={sale.paymentStatus === 'PAID' ? 'green' : 'orange'} dot className="mt-1">
                    {getPaymentStatusLabel(sale.paymentStatus)}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

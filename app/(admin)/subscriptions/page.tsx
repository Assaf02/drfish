import { Suspense } from 'react';
import { getSubscriptions, getExpiringSubscriptions } from '@/app/actions/subscriptions';
import { getClients } from '@/app/actions/clients';
import { SubscriptionsManager } from '@/components/admin/subscriptions-manager';

export const metadata = { title: 'Abonnements' };
export const revalidate = 60;

async function SubscriptionsContent() {
  const [subscriptions, expiring, clients] = await Promise.all([
    getSubscriptions(),
    getExpiringSubscriptions(7),
    getClients(),
  ]);
  const mappedSubs = subscriptions.map((s) => ({
    ...s,
    status: s.status as string,
    client: { id: s.client.id ?? '', name: s.client.name, phone: s.client.phone },
  })) as Parameters<typeof SubscriptionsManager>[0]['initialSubscriptions'];

  return <SubscriptionsManager
    initialSubscriptions={mappedSubs}
    expiring={expiring as unknown as Parameters<typeof SubscriptionsManager>[0]['expiring']}
    clients={clients as Parameters<typeof SubscriptionsManager>[0]['clients']}
  />;
}

export default function SubscriptionsPage() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Abonnements</h1>
        <p className="page-subtitle">Suivi des clients abonnés</p>
      </div>
      <Suspense fallback={<div className="animate-pulse h-64 bg-gray-200 rounded-2xl" />}>
        <SubscriptionsContent />
      </Suspense>
    </div>
  );
}

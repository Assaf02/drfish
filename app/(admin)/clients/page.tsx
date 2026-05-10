import { Suspense } from 'react';
import { getClients } from '@/app/actions/clients';
import { ClientsManager } from '@/components/admin/clients-manager';

export const metadata = { title: 'Clients' };
export const revalidate = 60;

async function ClientsContent() {
  const clients = await getClients();
  return <ClientsManager initialClients={clients as Parameters<typeof ClientsManager>[0]['initialClients']} />;
}

export default function ClientsPage() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Clients</h1>
        <p className="page-subtitle">Gestion de la clientèle Dr Fish</p>
      </div>
      <Suspense fallback={<div className="animate-pulse h-64 bg-gray-200 rounded-2xl" />}>
        <ClientsContent />
      </Suspense>
    </div>
  );
}

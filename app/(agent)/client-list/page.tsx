import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { getClients } from '@/app/actions/clients';
import { Users } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export const metadata = { title: 'Clients' };
export const revalidate = 60;

export default async function AgentClientsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const clients = await getClients();

  return (
    <div className="px-4 pt-6 pb-4 animate-fade-in">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-navy">Clients</h1>
        <p className="text-sm text-gray-500 mt-0.5">{clients.length} client{clients.length !== 1 ? 's' : ''}</p>
      </div>

      {clients.length === 0 ? (
        <div className="text-center py-16">
          <Users size={48} className="text-gray-200 mx-auto mb-4" />
          <p className="text-navy font-semibold">Aucun client</p>
          <p className="text-gray-400 text-sm mt-1">Les clients apparaîtront ici</p>
        </div>
      ) : (
        <div className="space-y-2">
          {clients.map((client) => (
            <div key={client.id} className="bg-white rounded-xl p-4 shadow-card border border-gray-100 flex items-center gap-3">
              <div className="w-10 h-10 bg-royal/10 rounded-xl flex items-center justify-center text-royal font-bold text-sm flex-shrink-0">
                {client.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-navy text-sm">{client.name}</p>
                {client.phone && <p className="text-xs text-gray-400">{client.phone}</p>}
                {client.address && <p className="text-xs text-gray-400 truncate">{client.address}</p>}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-gray-400">{(client as { _count?: { sales: number } })._count?.sales ?? 0} cmd</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

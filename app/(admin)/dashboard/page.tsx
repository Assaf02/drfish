import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { getDashboardData } from '@/app/actions/sales';
import { periodToDateRange } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { DashboardClient } from './client';
import type { Period } from '@/lib/utils';

export const metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Record<string, string>;
}) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') redirect('/login');

  // Resolve date range from URL params
  const period = (searchParams.period ?? '30d') as Period;
  let from: Date;
  let to: Date;

  if (period === 'custom' && searchParams.from && searchParams.to) {
    from = new Date(searchParams.from + 'T00:00:00');
    to   = new Date(searchParams.to   + 'T23:59:59');
  } else {
    const range = periodToDateRange(period);
    from = range.from;
    to   = range.to;
  }

  let data;
  try {
    data = await getDashboardData(from.toISOString(), to.toISOString());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[dashboard] getDashboardData error:', msg);
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6 text-center">
        <p className="font-bold text-lg" style={{ color: 'var(--navy)' }}>
          Erreur de chargement du tableau de bord
        </p>
        <p className="text-sm max-w-md" style={{ color: 'var(--gray-400)' }}>
          {msg.includes('column') || msg.includes('relation') || msg.includes('table')
            ? 'La base de données doit être mise à jour. Exécute npx prisma db push sur la base Neon puis redéploie.'
            : msg}
        </p>
        <pre className="text-xs text-left bg-gray-50 rounded-xl p-4 max-w-lg overflow-auto" style={{ color: 'var(--gray-400)' }}>
          {msg}
        </pre>
      </div>
    );
  }

  const firstName    = session.user.name?.split(' ')[0] ?? 'Admin';
  const todayRaw     = format(new Date(), "EEEE d MMMM yyyy", { locale: fr });
  const todayLabel   = todayRaw.charAt(0).toUpperCase() + todayRaw.slice(1);

  return (
    <DashboardClient
      initialData={data}
      initialPeriod={period}
      initialFromISO={from.toISOString().split('T')[0]}
      initialToISO={to.toISOString().split('T')[0]}
      firstName={firstName}
      todayLabel={todayLabel}
    />
  );
}

import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { getPartnerStats } from '@/app/actions/referrals';
import { prisma } from '@/lib/prisma';
import { formatDate } from '@/lib/utils';
import { PartnerDashboardClient } from './client';

export const metadata = { title: 'Mon espace partenaire — Dr Fish' };
export const revalidate = 60;

export default async function PartnerDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'PARTNER') redirect('/partner/login');

  const referralCodeId = (session.user as unknown as { referralCodeId: string }).referralCodeId;

  const [ref, stats] = await Promise.all([
    prisma.referralCode.findUnique({
      where: { id: referralCodeId },
      select: { id: true, code: true, name: true, username: true, whatsappLink: true,
        commissionWithService: true, commissionNoService: true },
    }),
    getPartnerStats(referralCodeId),
  ]);

  if (!ref) redirect('/partner/login');

  // Prepare orders for table
  const orders = stats.orders.map((o) => ({
    id: o.id,
    date: formatDate(o.date),
    products: o.items.map((i) => i.product.name).join(', '),
    totalAmount: o.totalAmount,
    hasServices: o.services.length > 0,
    commission: o.commission ?? 0,
  }));

  return (
    <PartnerDashboardClient
      refInfo={ref}
      stats={{
        totalOrders: stats.totalOrders,
        totalRevenue: stats.totalRevenue,
        totalCommission: stats.totalCommission,
        monthOrders: stats.monthOrders,
        monthCommission: stats.monthCommission,
        monthWithServicesCount: stats.monthWithServicesCount,
        monthNoServicesCount: stats.monthNoServicesCount,
        monthWithServicesCommission: stats.monthWithServicesCommission,
        monthNoServicesCommission: stats.monthNoServicesCommission,
        commissionWithServiceRate: stats.commissionWithServiceRate,
        commissionNoServiceRate: stats.commissionNoServiceRate,
      }}
      orders={orders}
    />
  );
}

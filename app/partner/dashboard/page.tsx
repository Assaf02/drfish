import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { getPartnerPortalData } from '@/app/actions/referrals';
import { formatDate } from '@/lib/utils';
import { PartnerDashboardClient } from './client';

export const metadata = { title: 'Mon espace partenaire — Dr Fish' };
export const revalidate = 60;

export default async function PartnerDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'PARTNER') redirect('/partner/login');

  const u = session.user as unknown as {
    referralCodeId: string;
    partnerLevel: number;
  };

  const data = await getPartnerPortalData(u.referralCodeId);
  if (!data) redirect('/partner/login');

  const orders = data.orders.map((o) => ({
    id: o.id,
    date: formatDate(o.date),
    products: o.products,
    totalAmount: o.totalAmount,
    hasServices: o.hasServices,
  }));

  return (
    <PartnerDashboardClient
      partnerLevel={u.partnerLevel}
      refInfo={{
        id: data.id,
        code: data.code,
        name: data.name,
        username: data.username,
        whatsappLink: data.whatsappLink,
        level: data.level,
      }}
      stats={{
        totalDirectOrders: data.totalDirectOrders,
        totalDirectRevenue: data.totalDirectRevenue,
        monthDirectOrders: data.monthDirectOrders,
        monthDirectRevenue: data.monthDirectRevenue,
        totalSubOrders: data.totalSubOrders,
        monthSubOrders: data.monthSubOrders,
      }}
      orders={orders}
      subCodes={data.subCodes}
    />
  );
}

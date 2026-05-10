import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { AdminSidebar } from '@/components/admin/sidebar';
import { PWAInstallBanner } from '@/components/shared/pwa-install-banner';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/home');

  return (
    <div className="min-h-screen bg-surface">
      <AdminSidebar />
      <main className="ml-[220px] min-h-screen">
        <div className="max-w-7xl mx-auto p-6 lg:p-8 animate-fade-in">{children}</div>
      </main>
      <PWAInstallBanner />
    </div>
  );
}

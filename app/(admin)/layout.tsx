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
    <div className="min-h-screen" style={{ background: 'var(--off-white)' }}>
      <AdminSidebar />
      {/* Desktop: ml-[220px] — Mobile: ml-0 + pt-14 for top bar */}
      <main className="lg:ml-[220px] pt-14 lg:pt-0 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 py-5 lg:p-8 animate-fade-in">
          {children}
        </div>
      </main>
      <PWAInstallBanner />
    </div>
  );
}

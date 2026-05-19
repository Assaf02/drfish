import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { AgentBottomNav } from '@/components/agent/bottom-nav';
import { PWAInstallBanner } from '@/components/shared/pwa-install-banner';

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  return (
    <div className="min-h-screen bg-surface pb-safe">
      {/* fills the iOS status bar zone so the brand color extends behind it */}
      <div style={{ height: 'env(safe-area-inset-top)', background: 'var(--navy)' }} />
      <main className="max-w-2xl mx-auto">{children}</main>
      <AgentBottomNav />
      <PWAInstallBanner />
    </div>
  );
}

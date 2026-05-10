import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { AgentBottomNav } from '@/components/agent/bottom-nav';
import { PWAInstallBanner } from '@/components/shared/pwa-install-banner';

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  return (
    <div className="min-h-screen bg-surface pb-24">
      <main className="max-w-2xl mx-auto">{children}</main>
      <AgentBottomNav />
      <PWAInstallBanner />
    </div>
  );
}

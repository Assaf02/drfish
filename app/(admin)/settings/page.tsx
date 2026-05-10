import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import { getAgents } from '@/app/actions/agents';
import { SettingsManager } from '@/components/admin/settings-manager';

export const metadata = { title: 'Paramètres' };
export const revalidate = 60;

async function SettingsContent() {
  const [settings, agents] = await Promise.all([
    prisma.setting.findMany(),
    prisma.user.findMany({ where: { role: 'AGENT' }, orderBy: { name: 'asc' } }),
  ]);
  const settingsMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  return <SettingsManager settings={settingsMap} agents={agents} />;
}

export default function SettingsPage() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Paramètres</h1>
        <p className="page-subtitle">Configuration de Dr Fish CRM</p>
      </div>
      <Suspense fallback={<div className="animate-pulse space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-gray-200 rounded-2xl" />)}</div>}>
        <SettingsContent />
      </Suspense>
    </div>
  );
}

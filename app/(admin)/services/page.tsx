import { getServices } from '@/app/actions/services';
import { ServicesManager } from '@/components/admin/services-manager';
import { Suspense } from 'react';

export const metadata = { title: 'Services' };
export const revalidate = 60;

async function ServicesContent() {
  const services = await getServices(true);
  return <ServicesManager initialServices={services} />;
}

export default function ServicesPage() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Catalogue services</h1>
        <p className="page-subtitle">Nettoyage, Découpage, Filetage</p>
      </div>
      <Suspense fallback={<div className="animate-pulse space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-2xl" />)}</div>}>
        <ServicesContent />
      </Suspense>
    </div>
  );
}

import { Suspense } from 'react';
import { getSales } from '@/app/actions/sales';
import { getAgents } from '@/app/actions/agents';
import { getProducts } from '@/app/actions/products';
import { SalesTable } from '@/components/admin/sales-table';

export const metadata = { title: 'Ventes' };
export const revalidate = 30;

async function SalesContent() {
  const [{ sales, total }, agents, products] = await Promise.all([
    getSales({ limit: 100 }),
    getAgents(),
    getProducts(true),
  ]);
  return <SalesTable initialSales={sales} total={total} agents={agents} products={products} />;
}

export default function SalesPage() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Historique des ventes</h1>
        <p className="page-subtitle">Toutes les transactions Dr Fish</p>
      </div>
      <Suspense fallback={<div className="animate-pulse h-64 bg-gray-200 rounded-2xl" />}>
        <SalesContent />
      </Suspense>
    </div>
  );
}

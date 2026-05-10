import { Suspense } from 'react';
import { getProducts } from '@/app/actions/products';
import { formatCFA, getCategoryLabel, calcMargin } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { KPICardSkeleton } from '@/components/ui/skeleton';
import { Fish, Plus } from 'lucide-react';
import { ProductsManager } from '@/components/admin/products-manager';

export const metadata = { title: 'Produits' };
export const revalidate = 60;

async function ProductsContent() {
  const products = await getProducts(true);
  return <ProductsManager initialProducts={products} />;
}

export default function ProductsPage() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Catalogue produits</h1>
        <p className="page-subtitle">Gestion des poissons et crustacés</p>
      </div>
      <Suspense fallback={<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <KPICardSkeleton key={i} />)}</div>}>
        <ProductsContent />
      </Suspense>
    </div>
  );
}

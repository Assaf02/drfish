'use client';

import { useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Fish, Plus, Edit2, ToggleLeft, ToggleRight, TrendingUp } from 'lucide-react';
import { createProduct, updateProduct, deleteProduct } from '@/app/actions/products';
import { formatCFA, getCategoryLabel, calcMargin, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Product = {
  id: string; name: string; category: string; purchasePrice: number;
  sellingPrice: number; unit: string; stock: number | null; active: boolean; photoUrl: string | null;
};

const schema = z.object({
  name: z.string().min(1, 'Nom requis'),
  category: z.enum(['POISSON', 'CRUSTACE', 'AUTRE']),
  purchasePrice: z.coerce.number().positive("Prix d'achat requis"),
  sellingPrice: z.coerce.number().positive('Prix de vente requis'),
  unit: z.string().default('kg'),
  stock: z.coerce.number().optional().nullable(),
  active: z.boolean().default(true),
  photoUrl: z.string().url().optional().nullable().or(z.literal('')),
});

type FormData = z.infer<typeof schema>;

export function ProductsManager({ initialProducts }: { initialProducts: Product[] }) {
  const [products, setProducts] = useState(initialProducts);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, reset, formState: { errors }, watch } = useForm<FormData>({
    resolver: zodResolver(schema) as unknown as Resolver<FormData>,
    defaultValues: { category: 'POISSON', unit: 'kg', active: true },
  });

  const purchasePrice = watch('purchasePrice');
  const sellingPrice = watch('sellingPrice');
  const liveMargin = purchasePrice && sellingPrice ? calcMargin(Number(purchasePrice), Number(sellingPrice)) : 0;

  const openCreate = () => { reset({ category: 'POISSON', unit: 'kg', active: true }); setEditingProduct(null); setShowForm(true); };
  const openEdit = (p: Product) => {
    reset({ ...p, category: p.category as 'POISSON' | 'CRUSTACE' | 'AUTRE', stock: p.stock ?? undefined, photoUrl: p.photoUrl ?? '' });
    setEditingProduct(p);
    setShowForm(true);
  };

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      const cleaned = { ...data, photoUrl: data.photoUrl || null, stock: data.stock ?? null };
      if (editingProduct) {
        const res = await updateProduct(editingProduct.id, cleaned);
        setProducts((prev) => prev.map((p) => p.id === editingProduct.id ? res.product : p));
        toast.success('Produit mis à jour');
      } else {
        const res = await createProduct(cleaned as Parameters<typeof createProduct>[0]);
        setProducts((prev) => [...prev, res.product]);
        toast.success('Produit créé');
      }
      setShowForm(false);
    } catch {
      toast.error('Erreur lors de la sauvegarde');
    } finally { setIsLoading(false); }
  };

  const toggleActive = async (p: Product) => {
    try {
      if (p.active) {
        await deleteProduct(p.id);
        setProducts((prev) => prev.map((x) => x.id === p.id ? { ...x, active: false } : x));
      } else {
        const res = await updateProduct(p.id, { active: true });
        setProducts((prev) => prev.map((x) => x.id === p.id ? res.product : x));
      }
      toast.success(p.active ? 'Produit désactivé' : 'Produit activé');
    } catch { toast.error('Erreur'); }
  };

  const categories = ['POISSON', 'CRUSTACE', 'AUTRE'] as const;

  return (
    <div>
      <div className="flex justify-end mb-6">
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Nouveau produit
        </button>
      </div>

      {categories.map((cat) => {
        const catProducts = products.filter((p) => p.category === cat);
        if (catProducts.length === 0) return null;
        return (
          <div key={cat} className="mb-8">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{getCategoryLabel(cat)}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {catProducts.map((p) => {
                const margin = calcMargin(p.purchasePrice, p.sellingPrice);
                return (
                  <div key={p.id} className={cn('bg-white rounded-2xl p-5 shadow-card border', p.active ? 'border-gray-100' : 'border-gray-100 opacity-60')}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-royal/10 rounded-xl flex items-center justify-center">
                          <Fish size={18} className="text-royal" />
                        </div>
                        <div>
                          <p className="font-bold text-navy">{p.name}</p>
                          <p className="text-xs text-gray-400">{getCategoryLabel(p.category)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(p)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-navy transition-colors">
                          <Edit2 size={15} />
                        </button>
                        <button onClick={() => toggleActive(p)} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
                          {p.active ? <ToggleRight size={18} className="text-success" /> : <ToggleLeft size={18} className="text-gray-300" />}
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-gray-400">Achat</p>
                        <p className="font-semibold text-navy">{formatCFA(p.purchasePrice)}/kg</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Vente</p>
                        <p className="font-semibold text-navy">{formatCFA(p.sellingPrice)}/kg</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <TrendingUp size={13} className={margin > 30 ? 'text-success' : 'text-warning'} />
                      <p className={cn('text-xs font-semibold', margin > 30 ? 'text-success' : 'text-warning')}>
                        Marge {margin.toFixed(0)}%
                      </p>
                      {p.stock != null && <Badge variant="gray" className="ml-auto">Stock: {p.stock} kg</Badge>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Modifier le produit' : 'Nouveau produit'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label">Nom</label>
                <input {...register('name')} className="input-field" placeholder="Dorade, Thon..." />
                {errors.name && <p className="text-danger text-xs mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <label className="label">Catégorie</label>
                <select {...register('category')} className="input-field">
                  <option value="POISSON">Poisson</option>
                  <option value="CRUSTACE">Crustacé</option>
                  <option value="AUTRE">Autre</option>
                </select>
              </div>
              <div>
                <label className="label">Unité</label>
                <input {...register('unit')} className="input-field" defaultValue="kg" />
              </div>
              <div>
                <label className="label">Prix d&apos;achat (FCFA/kg)</label>
                <input {...register('purchasePrice')} type="number" step="100" className="input-field" inputMode="numeric" />
                {errors.purchasePrice && <p className="text-danger text-xs mt-1">{errors.purchasePrice.message}</p>}
              </div>
              <div>
                <label className="label">Prix de vente (FCFA/kg)</label>
                <input {...register('sellingPrice')} type="number" step="100" className="input-field" inputMode="numeric" />
                {errors.sellingPrice && <p className="text-danger text-xs mt-1">{errors.sellingPrice.message}</p>}
              </div>
              <div className="col-span-2">
                <label className="label">Stock (kg, optionnel)</label>
                <input {...register('stock')} type="number" step="0.5" className="input-field" />
              </div>
            </div>
            {purchasePrice && sellingPrice && (
              <div className={cn('p-3 rounded-xl text-sm font-medium', liveMargin > 30 ? 'bg-success-light text-success' : 'bg-warning-light text-warning')}>
                Marge calculée: {liveMargin.toFixed(1)}% ({formatCFA(Number(sellingPrice) - Number(purchasePrice))}/kg de bénéfice)
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Annuler</button>
              <button type="submit" disabled={isLoading} className="btn-primary flex-1">
                {isLoading ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

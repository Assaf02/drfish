'use client';

import { useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Scissors, Plus, Edit2, ToggleLeft, ToggleRight, Tag } from 'lucide-react';
import { createService, updateService, toggleServicePromo } from '@/app/actions/services';
import { formatCFA, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Service = { id: string; name: string; price: number; promoPrice: number | null; isPromo: boolean; active: boolean };

const schema = z.object({
  name: z.string().min(1),
  price: z.coerce.number().min(0),
  promoPrice: z.coerce.number().min(0).optional().nullable(),
  isPromo: z.boolean().default(false),
  active: z.boolean().default(true),
});
type FormData = z.infer<typeof schema>;

export function ServicesManager({ initialServices }: { initialServices: Service[] }) {
  const [services, setServices] = useState(initialServices);
  const [editing, setEditing] = useState<Service | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as unknown as Resolver<FormData>,
    defaultValues: { active: true, isPromo: false },
  });

  const openCreate = () => { reset({ active: true, isPromo: false }); setEditing(null); setShowForm(true); };
  const openEdit = (s: Service) => { reset({ ...s, promoPrice: s.promoPrice ?? undefined }); setEditing(s); setShowForm(true); };

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const payload = { ...data, promoPrice: data.promoPrice ?? null };
      if (editing) {
        const res = await updateService(editing.id, payload);
        setServices((prev) => prev.map((s) => s.id === editing.id ? res.service : s));
        toast.success('Service mis à jour');
      } else {
        const res = await createService(payload as Parameters<typeof createService>[0]);
        setServices((prev) => [...prev, res.service]);
        toast.success('Service créé');
      }
      setShowForm(false);
    } catch { toast.error('Erreur'); } finally { setLoading(false); }
  };

  const handleTogglePromo = async (s: Service) => {
    try {
      const res = await toggleServicePromo(s.id);
      setServices((prev) => prev.map((x) => x.id === s.id ? res.service : x));
      toast.success(res.service.isPromo ? 'Promo activée' : 'Promo désactivée');
    } catch { toast.error('Erreur'); }
  };

  return (
    <div>
      <div className="flex justify-end mb-6">
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Nouveau service
        </button>
      </div>

      <div className="space-y-4">
        {services.map((s) => (
          <div key={s.id} className="bg-white rounded-2xl p-4 sm:p-5 shadow-card border border-gray-100">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 bg-royal/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <Scissors size={20} className="text-royal" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-navy text-base sm:text-lg">{s.name}</p>
                      {s.isPromo && <Badge variant="green"><Tag size={10} /> Promo</Badge>}
                      {!s.active && <Badge variant="gray">Inactif</Badge>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <p className="text-sm text-gray-500">
                        Normal: <span className="font-semibold text-navy">{formatCFA(s.price)}/kg</span>
                      </p>
                      {s.promoPrice != null && (
                        <p className="text-sm text-gray-500">
                          Promo: <span className={cn('font-semibold', s.isPromo ? 'text-success' : 'text-navy')}>{s.promoPrice === 0 ? 'Gratuit' : `${formatCFA(s.promoPrice)}/kg`}</span>
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => handleTogglePromo(s)} className={cn(
                      'px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap',
                      s.isPromo ? 'bg-success-light text-success hover:bg-success/20' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}>
                      {s.isPromo ? 'Stop promo' : 'Promo'}
                    </button>
                    <button onClick={() => openEdit(s)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-navy transition-colors">
                      <Edit2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Modifier le service' : 'Nouveau service'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <div>
              <label className="label">Nom du service</label>
              <input {...register('name')} className="input-field" placeholder="Nettoyage, Découpage..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Prix normal (FCFA/kg)</label>
                <input {...register('price')} type="number" step="50" className="input-field" inputMode="numeric" />
              </div>
              <div>
                <label className="label">Prix promo (FCFA/kg)</label>
                <input {...register('promoPrice')} type="number" step="50" className="input-field" inputMode="numeric" placeholder="0 = Gratuit" />
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <input {...register('isPromo')} type="checkbox" id="isPromo" className="w-4 h-4 accent-royal" />
              <label htmlFor="isPromo" className="text-sm font-medium text-navy">Promo active maintenant</label>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Annuler</button>
              <button type="submit" disabled={loading} className="btn-primary flex-1">{loading ? 'Sauvegarde...' : 'Sauvegarder'}</button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

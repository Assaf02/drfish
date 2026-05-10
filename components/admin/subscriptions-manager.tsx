'use client';

import { useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Star, Plus, AlertTriangle, Phone, Calendar } from 'lucide-react';
import { createSubscription, updateSubscription } from '@/app/actions/subscriptions';
import { formatDate, getSubscriptionStatusLabel, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Subscription = {
  id: string; clientId: string; startDate: Date; endDate: Date | null; status: string;
  weeklyDeliveries: number; referredBy: string | null; bonusApplied: boolean; notes: string | null;
  client: { id: string; name: string; phone: string | null };
};
type Client = { id: string; name: string; phone: string | null; _count: { sales: number } };

const schema = z.object({
  clientId: z.string().min(1, 'Client requis'),
  startDate: z.string().min(1),
  endDate: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'EXPIRED']).default('ACTIVE'),
  weeklyDeliveries: z.coerce.number().int().default(0),
  referredBy: z.string().optional().nullable(),
  bonusApplied: z.boolean().default(false),
  notes: z.string().optional().nullable(),
});
type FormData = z.infer<typeof schema>;

export function SubscriptionsManager({ initialSubscriptions, expiring, clients }: {
  initialSubscriptions: Subscription[]; expiring: Subscription[]; clients: Client[];
}) {
  const [subscriptions, setSubscriptions] = useState(initialSubscriptions);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as unknown as Resolver<FormData>,
    defaultValues: { status: 'ACTIVE', weeklyDeliveries: 0, bonusApplied: false },
  });

  const openCreate = () => { reset({ status: 'ACTIVE', weeklyDeliveries: 0, bonusApplied: false }); setEditing(null); setShowForm(true); };
  const openEdit = (s: Subscription) => {
    reset({
      clientId: s.clientId,
      status: s.status as 'ACTIVE' | 'SUSPENDED' | 'EXPIRED',
      weeklyDeliveries: s.weeklyDeliveries,
      bonusApplied: s.bonusApplied,
      notes: s.notes,
      referredBy: s.referredBy,
      startDate: new Date(s.startDate).toISOString().split('T')[0],
      endDate: s.endDate ? new Date(s.endDate).toISOString().split('T')[0] : '',
    });
    setEditing(s); setShowForm(true);
  };

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      if (editing) {
        const res = await updateSubscription(editing.id, data);
        setSubscriptions((prev) => prev.map((s) => s.id === editing.id ? { ...s, ...res.subscription } : s));
        toast.success('Abonnement mis à jour');
      } else {
        const res = await createSubscription(data);
        const client = clients.find((c) => c.id === data.clientId)!;
        setSubscriptions((prev) => [...prev, { ...res.subscription, client: { id: client.id, name: client.name, phone: client.phone } }] as Subscription[]);
        toast.success('Abonnement créé');
      }
      setShowForm(false);
    } catch { toast.error('Erreur'); } finally { setLoading(false); }
  };

  const statusBadge: Record<string, 'green' | 'orange' | 'red'> = { ACTIVE: 'green', SUSPENDED: 'orange', EXPIRED: 'red' };

  const filtered = subscriptions.filter((s) => !filterStatus || s.status === filterStatus);

  return (
    <div className="space-y-6">
      {/* Expiry alerts */}
      {expiring.length > 0 && (
        <div className="bg-warning-light border border-warning/20 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-warning" />
            <p className="text-warning font-semibold text-sm">{expiring.length} abonnement{expiring.length > 1 ? 's' : ''} expire bientôt</p>
          </div>
          <div className="space-y-2">
            {expiring.map((sub) => (
              <div key={sub.id} className="flex items-center justify-between text-sm">
                <span className="font-medium text-navy">{sub.client.name}</span>
                <span className="text-warning">Expire le {sub.endDate ? formatDate(sub.endDate) : '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input-field py-2.5 text-sm min-w-36">
          <option value="">Tous les statuts</option>
          <option value="ACTIVE">Actif</option>
          <option value="SUSPENDED">Suspendu</option>
          <option value="EXPIRED">Expiré</option>
        </select>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2"><Plus size={18} /> Nouvel abonnement</button>
      </div>

      <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Star size={48} className="text-gray-200 mx-auto mb-4" />
            <p className="text-navy font-semibold">Aucun abonnement</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map((sub) => (
              <div key={sub.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/50 transition-colors">
                <div className="w-10 h-10 bg-royal/10 rounded-xl flex items-center justify-center text-royal font-bold text-sm flex-shrink-0">
                  {sub.client.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-navy text-sm">{sub.client.name}</p>
                    {sub.bonusApplied && <Badge variant="purple">+1 kg bonus</Badge>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {sub.client.phone && <span className="text-xs text-gray-400 flex items-center gap-1"><Phone size={10} />{sub.client.phone}</span>}
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Calendar size={10} /> Début: {formatDate(sub.startDate)}
                    </span>
                    {sub.endDate && <span className="text-xs text-gray-400">Fin: {formatDate(sub.endDate)}</span>}
                    <span className="text-xs text-gray-400">{sub.weeklyDeliveries} livr./sem.</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant={statusBadge[sub.status] ?? 'gray'} dot>{getSubscriptionStatusLabel(sub.status)}</Badge>
                  <button onClick={() => openEdit(sub)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-navy transition-colors text-xs font-medium">
                    Modifier
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Modifier l\'abonnement' : 'Nouvel abonnement'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <div>
              <label className="label">Client *</label>
              <select {...register('clientId')} className="input-field">
                <option value="">Sélectionner un client</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {errors.clientId && <p className="text-danger text-xs mt-1">{errors.clientId.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Date de début *</label>
                <input {...register('startDate')} type="date" className="input-field" />
              </div>
              <div>
                <label className="label">Date de fin</label>
                <input {...register('endDate')} type="date" className="input-field" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Statut</label>
                <select {...register('status')} className="input-field">
                  <option value="ACTIVE">Actif</option>
                  <option value="SUSPENDED">Suspendu</option>
                  <option value="EXPIRED">Expiré</option>
                </select>
              </div>
              <div>
                <label className="label">Livraisons/semaine</label>
                <input {...register('weeklyDeliveries')} type="number" min="0" className="input-field" inputMode="numeric" />
              </div>
            </div>
            <div>
              <label className="label">Parrainé par</label>
              <input {...register('referredBy')} className="input-field" placeholder="Nom du parrain" />
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <input {...register('bonusApplied')} type="checkbox" id="bonusApplied" className="w-4 h-4 accent-royal" />
              <label htmlFor="bonusApplied" className="text-sm font-medium text-navy">Bonus parrainage appliqué (+1 kg)</label>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea {...register('notes')} className="input-field" rows={2} />
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

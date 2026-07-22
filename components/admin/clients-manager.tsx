'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import Link from 'next/link';
import { Search, Plus, Users, Phone, MapPin, ShoppingCart, ChevronRight, Download } from 'lucide-react';
import { createClient, updateClient } from '@/app/actions/clients';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Client = { id: string; name: string; phone: string | null; address: string | null; notes: string | null; birthDate: Date | string | null; _count: { sales: number } };

const schema = z.object({
  name:      z.string().min(1, 'Nom requis'),
  phone:     z.string().optional().nullable(),
  address:   z.string().optional().nullable(),
  notes:     z.string().optional().nullable(),
  birthDate: z.string().optional().nullable(),
});
type FormData = z.infer<typeof schema>;

export function ClientsManager({ initialClients }: { initialClients: Client[] }) {
  const [clients, setClients] = useState(initialClients);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });

  const filtered = useMemo(() => clients.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone && c.phone.includes(search))
  ), [clients, search]);

  const openCreate = () => { reset({}); setEditing(null); setShowForm(true); };
  const openEdit = (c: Client) => {
    const bd = c.birthDate ? new Date(c.birthDate).toISOString().split('T')[0] : null;
    reset({ ...c, birthDate: bd });
    setEditing(c);
    setShowForm(true);
  };

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      if (editing) {
        const res = await updateClient(editing.id, data);
        setClients((prev) => prev.map((c) => c.id === editing.id ? { ...c, ...res.client } : c));
        toast.success('Client mis à jour');
      } else {
        const res = await createClient(data);
        setClients((prev) => [...prev, { ...res.client, _count: { sales: 0 } }]);
        toast.success('Client créé');
      }
      setShowForm(false);
    } catch { toast.error('Erreur'); } finally { setLoading(false); }
  };

  const exportCSV = () => {
    const rows = [['Nom', 'Téléphone', 'Adresse', 'Commandes'], ...clients.map((c) => [c.name, c.phone ?? '', c.address ?? '', c._count.sales])];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'clients-drfish.csv'; a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 sm:gap-3 flex-wrap">
        <div className="flex-1 min-w-[180px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher..." className="input-field pl-9 py-2.5 text-sm" />
        </div>
        <button onClick={exportCSV} className="btn-secondary flex items-center gap-2 py-2.5 text-sm"><Download size={15} /> CSV</button>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2"><Plus size={18} /> Nouveau</button>
      </div>

      <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Users size={48} className="text-gray-200 mx-auto mb-4" />
            <p className="text-navy font-semibold">Aucun client</p>
            <p className="text-gray-400 text-sm mt-1">Créez votre premier client</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map((client) => (
              <div key={client.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/50 transition-colors group">
                <div className="w-10 h-10 bg-royal/10 rounded-xl flex items-center justify-center text-royal font-bold text-sm flex-shrink-0">
                  {client.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-navy text-sm">{client.name}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {client.phone && <span className="text-xs text-gray-400 flex items-center gap-1"><Phone size={10} />{client.phone}</span>}
                    {client.address && <span className="text-xs text-gray-400 flex items-center gap-1 truncate"><MapPin size={10} />{client.address}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="flex items-center gap-1 text-xs text-gray-400"><ShoppingCart size={12} />{client._count.sales}</span>
                  <Link href={`/clients/${client.id}`} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-navy transition-colors">
                    <ChevronRight size={16} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Modifier le client' : 'Nouveau client'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <div>
              <label className="label">Nom *</label>
              <input {...register('name')} className="input-field" placeholder="Marie Adjovi" />
              {errors.name && <p className="text-danger text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="label">Téléphone</label>
              <input {...register('phone')} className="input-field" inputMode="tel" placeholder="+229 96..." />
            </div>
            <div>
              <label className="label">Adresse</label>
              <input {...register('address')} className="input-field" placeholder="Akpakpa, Cotonou" />
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea {...register('notes')} className="input-field" rows={2} placeholder="Préférences, infos..." />
            </div>
            <div>
              <label className="label">Date de naissance <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>(pour alertes anniversaire)</span></label>
              <input {...register('birthDate')} type="date" className="input-field" />
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

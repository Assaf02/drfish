'use client';

import { useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Settings, Users, Building2, Plus, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';
import { createUser, updateUser } from '@/app/actions/agents';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

type Agent = { id: string; name: string; email: string; role: string; active: boolean; createdAt: Date };

const businessSchema = z.object({
  business_name: z.string().min(1),
  business_phone: z.string(),
  whatsapp_link: z.string(),
  business_address: z.string(),
});

const userSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Minimum 6 caractères'),
  role: z.enum(['AGENT', 'ADMIN']).default('AGENT'),
});

type BusinessForm = z.infer<typeof businessSchema>;
type UserForm = z.infer<typeof userSchema>;

export function SettingsManager({ settings, agents: initialAgents }: { settings: Record<string, string>; agents: Agent[] }) {
  const [agents, setAgents] = useState(initialAgents);
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingBiz, setSavingBiz] = useState(false);

  const bizForm = useForm<BusinessForm>({
    resolver: zodResolver(businessSchema) as unknown as Resolver<BusinessForm>,
    defaultValues: {
      business_name: settings.business_name ?? 'Dr Fish',
      business_phone: settings.business_phone ?? '',
      whatsapp_link: settings.whatsapp_link ?? '',
      business_address: settings.business_address ?? '',
    },
  });

  const userForm = useForm<UserForm>({
    resolver: zodResolver(userSchema) as unknown as Resolver<UserForm>,
    defaultValues: { role: 'AGENT' },
  });

  const saveBusiness = async (data: BusinessForm) => {
    setSavingBiz(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      toast.success('Paramètres sauvegardés');
    } catch { toast.error('Erreur lors de la sauvegarde'); }
    finally { setSavingBiz(false); }
  };

  const onCreateUser = async (data: UserForm) => {
    setLoading(true);
    try {
      const res = await createUser(data);
      setAgents((prev) => [...prev, res.user as Agent]);
      toast.success('Utilisateur créé');
      setShowUserForm(false);
      userForm.reset();
    } catch { toast.error('Erreur lors de la création'); } finally { setLoading(false); }
  };

  const toggleAgentActive = async (agent: Agent) => {
    try {
      await updateUser(agent.id, { active: !agent.active });
      setAgents((prev) => prev.map((a) => a.id === agent.id ? { ...a, active: !a.active } : a));
      toast.success(agent.active ? 'Agent désactivé' : 'Agent activé');
    } catch { toast.error('Erreur'); }
  };

  return (
    <div className="space-y-8">
      {/* Business info */}
      <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-50">
          <Building2 size={18} className="text-royal" />
          <h2 className="font-bold text-navy">Informations entreprise</h2>
        </div>
        <form onSubmit={bizForm.handleSubmit(saveBusiness)} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Nom de l&apos;entreprise</label>
              <input {...bizForm.register('business_name')} className="input-field" />
            </div>
            <div>
              <label className="label">Téléphone</label>
              <input {...bizForm.register('business_phone')} className="input-field" inputMode="tel" />
            </div>
            <div>
              <label className="label">Lien WhatsApp</label>
              <input {...bizForm.register('whatsapp_link')} className="input-field" placeholder="https://wa.me/..." />
            </div>
            <div>
              <label className="label">Adresse</label>
              <input {...bizForm.register('business_address')} className="input-field" />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={savingBiz} className="btn-primary flex items-center gap-2">
              {savingBiz ? <><Loader2 size={16} className="animate-spin" /> Sauvegarde...</> : 'Sauvegarder'}
            </button>
          </div>
        </form>
      </div>

      {/* Users management */}
      <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
          <div className="flex items-center gap-3">
            <Users size={18} className="text-royal" />
            <h2 className="font-bold text-navy">Gestion des utilisateurs</h2>
          </div>
          <button onClick={() => { userForm.reset({ role: 'AGENT' }); setShowUserForm(true); }} className="btn-primary text-sm flex items-center gap-2 py-2">
            <Plus size={16} /> Nouvel utilisateur
          </button>
        </div>
        <div className="divide-y divide-gray-50">
          {agents.map((agent) => (
            <div key={agent.id} className="flex items-center gap-4 px-6 py-4">
              <div className="w-10 h-10 bg-royal/10 rounded-xl flex items-center justify-center text-royal font-bold text-sm flex-shrink-0">
                {agent.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-navy text-sm">{agent.name}</p>
                  <Badge variant={agent.active ? 'green' : 'gray'} dot>{agent.active ? 'Actif' : 'Inactif'}</Badge>
                </div>
                <p className="text-xs text-gray-400">{agent.email}</p>
              </div>
              <button onClick={() => toggleAgentActive(agent)} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
                {agent.active ? <ToggleRight size={22} className="text-success" /> : <ToggleLeft size={22} className="text-gray-300" />}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Create user dialog */}
      <Dialog open={showUserForm} onOpenChange={setShowUserForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvel utilisateur</DialogTitle></DialogHeader>
          <form onSubmit={userForm.handleSubmit(onCreateUser)} className="space-y-4 mt-2">
            <div>
              <label className="label">Nom complet *</label>
              <input {...userForm.register('name')} className="input-field" placeholder="Irène Bello" />
              {userForm.formState.errors.name && <p className="text-danger text-xs mt-1">{userForm.formState.errors.name.message}</p>}
            </div>
            <div>
              <label className="label">Email *</label>
              <input {...userForm.register('email')} type="email" className="input-field" placeholder="irene@drfish.bj" />
              {userForm.formState.errors.email && <p className="text-danger text-xs mt-1">{userForm.formState.errors.email.message}</p>}
            </div>
            <div>
              <label className="label">Mot de passe *</label>
              <input {...userForm.register('password')} type="password" className="input-field" placeholder="Minimum 6 caractères" />
              {userForm.formState.errors.password && <p className="text-danger text-xs mt-1">{userForm.formState.errors.password.message}</p>}
            </div>
            <div>
              <label className="label">Rôle</label>
              <select {...userForm.register('role')} className="input-field">
                <option value="AGENT">Agent (Chargée de clientèle)</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowUserForm(false)} className="btn-secondary flex-1">Annuler</button>
              <button type="submit" disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
                {loading ? <><Loader2 size={16} className="animate-spin" /> Création...</> : 'Créer'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

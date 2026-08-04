'use client';

import { useEffect, useState } from 'react';
import { Bell, CreditCard, UserX, Cake, Save, Loader2, ToggleLeft, ToggleRight, Send } from 'lucide-react';
import { toast } from 'sonner';

type AlertRule = {
  id:        string;
  type:      string;
  active:    boolean;
  delayDays: number;
  message:   string;
};

const META: Record<string, { icon: React.ReactNode; label: string; color: string; bg: string; delayLabel: string; vars: string[] }> = {
  PAYMENT_REMINDER: {
    icon:       <CreditCard size={18} />,
    label:      'Rappel paiement en retard',
    color:      '#dc2626',
    bg:         'rgba(239,68,68,0.08)',
    delayLabel: 'Envoyer si non payé après',
    vars:       ['{nom}', '{date}', '{montant}', '{jours}'],
  },
  INACTIVE_CLIENT: {
    icon:       <UserX size={18} />,
    label:      'Relance clients inactifs',
    color:      'var(--orange)',
    bg:         'rgba(255,152,0,0.08)',
    delayLabel: 'Envoyer si aucune commande depuis',
    vars:       ['{nom}', '{jours}'],
  },
  BIRTHDAY: {
    icon:       <Cake size={18} />,
    label:      'Message d\'anniversaire',
    color:      'var(--teal)',
    bg:         'rgba(0,180,166,0.08)',
    delayLabel: 'Envoi le jour même',
    vars:       ['{nom}'],
  },
};

const ORDER = ['PAYMENT_REMINDER', 'INACTIVE_CLIENT', 'BIRTHDAY'];

export default function AlertsPage() {
  const [rules,   setRules]   = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    fetch('/api/alerts/rules')
      .then((r) => r.json())
      .then((data: AlertRule[]) => { setRules(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function getRule(type: string): AlertRule | undefined {
    return rules.find((r) => r.type === type);
  }

  function patchRule(type: string, patch: Partial<AlertRule>) {
    setRules((prev) => prev.map((r) => r.type === type ? { ...r, ...patch } : r));
  }

  async function saveRule(type: string) {
    const rule = getRule(type);
    if (!rule) return;
    setSaving(type);
    try {
      const res  = await fetch('/api/alerts/rules', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ type: rule.type, active: rule.active, delayDays: rule.delayDays, message: rule.message }),
      });
      const data = await res.json() as AlertRule;
      setRules((prev) => prev.map((r) => r.type === type ? data : r));
      toast.success('Alerte enregistrée');
    } catch {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(null);
    }
  }

  async function runNow() {
    setRunning(true);
    try {
      const res  = await fetch('/api/cron/alerts');
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `Erreur ${res.status}`);
      }
      const data = await res.json() as { created: string[] };
      if (data.created.length === 0) {
        toast.info('Aucune alerte à envoyer pour le moment');
      } else {
        toast.success(`${data.created.length} campagne(s) créée(s) : ${data.created.join(', ')}`);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur lors de l\'exécution');
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] gap-3">
        <Loader2 size={20} className="animate-spin" style={{ color: 'var(--blue)' }} />
        <span className="text-sm" style={{ color: 'var(--gray-400)' }}>Chargement…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-extrabold" style={{ fontSize: 26, color: 'var(--navy)', letterSpacing: '-0.5px' }}>
            Alertes WhatsApp automatiques
          </h1>
          <p className="text-[14px] mt-1" style={{ color: 'var(--gray-400)' }}>
            Des campagnes sont créées automatiquement chaque matin selon ces règles. Tu les démarres depuis la page Campagnes.
          </p>
        </div>
        <button
          onClick={runNow}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-50 flex-shrink-0"
          style={{ background: 'var(--navy)', color: 'white' }}
        >
          {running ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Tester maintenant
        </button>
      </div>

      {/* Info banner */}
      <div className="rounded-2xl px-5 py-4 flex items-start gap-3"
        style={{ background: 'rgba(46,109,180,0.06)', border: '1px solid rgba(46,109,180,0.12)' }}>
        <Bell size={16} style={{ color: 'var(--blue)', flexShrink: 0, marginTop: 2 }} />
        <div className="text-sm" style={{ color: 'var(--navy)' }}>
          <p className="font-semibold mb-1">Comment ça marche</p>
          <p style={{ color: 'var(--gray-400)' }}>
            Chaque matin à 9h, le système vérifie les règles actives et crée automatiquement les campagnes correspondantes (visibles dans <strong>Campagnes</strong>). Les messages sont personnalisés avec le nom du client, le montant, etc.
          </p>
        </div>
      </div>

      {/* Rules */}
      <div className="space-y-4">
        {ORDER.map((type) => {
          const rule = getRule(type);
          const meta = META[type];
          if (!rule || !meta) return null;

          return (
            <div key={type} className="card p-5 space-y-4">

              {/* Card header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: meta.bg, color: meta.color }}>
                    {meta.icon}
                  </div>
                  <div>
                    <p className="font-bold" style={{ color: 'var(--navy)', fontSize: 15 }}>{meta.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--gray-400)' }}>
                      Variables disponibles : {meta.vars.join(', ')}
                    </p>
                  </div>
                </div>

                {/* Toggle */}
                <button
                  onClick={() => patchRule(type, { active: !rule.active })}
                  className="flex items-center gap-2 transition-all"
                  style={{ color: rule.active ? meta.color : 'var(--gray-400)' }}
                >
                  {rule.active
                    ? <ToggleRight size={32} />
                    : <ToggleLeft  size={32} />}
                  <span className="text-xs font-semibold hidden sm:block">
                    {rule.active ? 'Activée' : 'Désactivée'}
                  </span>
                </button>
              </div>

              {/* Config */}
              {type !== 'BIRTHDAY' && (
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium whitespace-nowrap" style={{ color: 'var(--gray-400)' }}>
                    {meta.delayLabel}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={rule.delayDays}
                      onChange={(e) => patchRule(type, { delayDays: Number(e.target.value) })}
                      className="input-field text-center"
                      style={{ width: 72 }}
                    />
                    <span className="text-sm font-medium" style={{ color: 'var(--gray-400)' }}>jours</span>
                  </div>
                </div>
              )}
              {type === 'BIRTHDAY' && (
                <p className="text-sm" style={{ color: 'var(--gray-400)' }}>
                  Le message est envoyé le jour de l'anniversaire. Pense à renseigner la date de naissance dans les fiches clients.
                </p>
              )}

              {/* Message template */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--gray-400)' }}>
                  Message
                </label>
                <textarea
                  rows={3}
                  value={rule.message}
                  onChange={(e) => patchRule(type, { message: e.target.value })}
                  className="input-field resize-none text-sm w-full"
                  placeholder="Votre message personnalisé..."
                />
              </div>

              {/* Save */}
              <div className="flex justify-end">
                <button
                  onClick={() => saveRule(type)}
                  disabled={saving === type}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-50"
                  style={{ background: meta.color, color: 'white' }}
                >
                  {saving === type
                    ? <Loader2 size={13} className="animate-spin" />
                    : <Save size={13} />}
                  Enregistrer
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

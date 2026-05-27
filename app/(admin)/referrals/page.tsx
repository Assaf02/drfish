'use client';

import { useState, useEffect, useTransition } from 'react';
import { toast } from 'sonner';
import {
  Plus, Copy, Pencil, Trash2, Check, X,
  ChevronDown, ChevronUp, ExternalLink, Download,
  ToggleLeft, ToggleRight, TrendingUp, Users, BarChart3,
  GitBranch,
} from 'lucide-react';
import {
  getReferralCodes, createReferralCode, updateReferralCode, deleteReferralCode,
  suggestReferralDefaults, getReferralAnalytics,
} from '@/app/actions/referrals';
import { formatCFA } from '@/lib/utils';
import { FishIcon } from '@/components/icons/FishIcon';

type Ref = Awaited<ReturnType<typeof getReferralCodes>>[0];
type Analytics = Awaited<ReturnType<typeof getReferralAnalytics>>[0];

const DEFAULT_FORM = {
  name: '', username: '', code: '',
  commissionWithService: 10, commissionNoService: 5,
  status: true, notes: '',
};

// ── Create/Edit form ──────────────────────────────────────────────────────────

function ReferralForm({
  initial, onSave, onCancel, isEdit,
}: {
  initial: typeof DEFAULT_FORM;
  onSave: (d: typeof DEFAULT_FORM) => Promise<void>;
  onCancel: () => void;
  isEdit?: boolean;
}) {
  const [form, setForm] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [nameBlurred, setNameBlurred] = useState(false);

  const set = (k: keyof typeof DEFAULT_FORM, v: unknown) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleNameBlur = async () => {
    if (!nameBlurred && form.name.trim() && !isEdit) {
      setNameBlurred(true);
      const s = await suggestReferralDefaults(form.name);
      setForm((p) => ({ ...p, code: p.code || s.code, username: p.username || s.username }));
    }
  };

  const submit = () =>
    startTransition(async () => {
      try { await onSave(form); } catch (e: unknown) { toast.error((e as Error).message ?? 'Erreur'); }
    });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Nom du commercial</label>
          <input className="input-field text-sm" value={form.name}
            onChange={(e) => set('name', e.target.value)} onBlur={handleNameBlur}
            placeholder="Ex: Kofi Mensah" />
        </div>
        <div>
          <label className="label">Nom d&apos;utilisateur (login)</label>
          <input className="input-field text-sm font-mono" value={form.username}
            onChange={(e) => set('username', e.target.value.toLowerCase().replace(/\s/g, '.'))}
            placeholder="kofi.mensah" />
        </div>
      </div>
      <div>
        <label className="label">Code de parrainage</label>
        <input className="input-field text-sm font-mono uppercase tracking-wider" value={form.code}
          onChange={(e) => set('code', e.target.value.toUpperCase())}
          placeholder="DRFISH-KOFI-2026" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Commission avec préparation (%)</label>
          <input type="number" min={0} max={100} step={0.5} className="input-field text-sm"
            value={form.commissionWithService}
            onChange={(e) => set('commissionWithService', parseFloat(e.target.value) || 0)} />
        </div>
        <div>
          <label className="label">Commission sans préparation (%)</label>
          <input type="number" min={0} max={100} step={0.5} className="input-field text-sm"
            value={form.commissionNoService}
            onChange={(e) => set('commissionNoService', parseFloat(e.target.value) || 0)} />
        </div>
      </div>
      <p className="text-[11px]" style={{ color: 'var(--blue)' }}>
        Les taux de commission se propagent automatiquement à tous les sous-codes.
      </p>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => set('status', !form.status)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-sm font-medium"
          style={{
            background: form.status ? 'rgba(26,122,74,0.08)' : 'var(--gray-50)',
            borderColor: form.status ? 'rgba(26,122,74,0.25)' : 'var(--gray-100)',
            color: form.status ? 'var(--green)' : 'var(--gray-400)',
          }}>
          {form.status ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
          {form.status ? 'Actif' : 'Inactif'}
        </button>
        <input className="input-field text-sm flex-1" value={form.notes ?? ''}
          onChange={(e) => set('notes', e.target.value)} placeholder="Notes (optionnel)" />
      </div>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={submit}
          disabled={pending || !form.name || !form.code || !form.username}
          className="flex-1 py-3 rounded-2xl font-bold text-sm text-white transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          style={{ background: 'var(--blue)', boxShadow: '0 4px 12px rgba(46,109,180,0.3)' }}>
          {pending ? 'Enregistrement...' : isEdit ? <><Check size={15} /> Enregistrer</> : <><Plus size={15} /> Créer</>}
        </button>
        <button type="button" onClick={onCancel} className="px-5 py-3 rounded-2xl font-semibold text-sm transition-all"
          style={{ background: 'var(--gray-50)', color: 'var(--gray-400)' }}>
          Annuler
        </button>
      </div>
    </div>
  );
}

// ── Sub-code row (inside tree) ────────────────────────────────────────────────

function SubCodeRow({
  sub,
  onRefresh,
}: {
  sub: Ref['subCodes'][0];
  onRefresh: () => void;
}) {
  const [, startTransition] = useTransition();

  const handleToggle = () =>
    startTransition(async () => {
      await updateReferralCode(sub.id, { status: !sub.status });
      onRefresh();
    });

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b last:border-0 transition-colors hover:bg-[var(--gray-50)]"
      style={{ borderColor: 'var(--gray-50)', opacity: sub.status ? 1 : 0.6 }}>
      {/* tree indent line */}
      <div className="flex items-center gap-0 flex-shrink-0 ml-2">
        <div className="w-px h-5 bg-gray-200 mr-1" />
        <div className="w-3 h-px bg-gray-200 mr-2" />
        <div className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: sub.status ? 'var(--teal)' : 'var(--gray-200)' }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs font-semibold" style={{ color: 'var(--navy)' }}>{sub.code}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
            style={{
              background: sub.status ? 'rgba(0,180,166,0.1)' : 'var(--gray-50)',
              color: sub.status ? 'var(--teal)' : 'var(--gray-400)',
            }}>
            {sub.status ? 'ACTIF' : 'INACTIF'}
          </span>
        </div>
        <p className="text-[11px] mt-0.5" style={{ color: 'var(--gray-400)' }}>
          {sub.name} · @{sub.username}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center hidden sm:grid">
        {[
          { v: sub.totalOrders.toString(), l: 'cmd' },
          { v: formatCFA(sub.totalRevenue), l: 'revenu' },
          { v: formatCFA(sub.totalCommission), l: 'commission' },
        ].map(({ v, l }) => (
          <div key={l}>
            <p className="font-bold text-xs" style={{ color: 'var(--navy)' }}>{v}</p>
            <p className="text-[10px]" style={{ color: 'var(--gray-400)' }}>{l}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={handleToggle} className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-gray-50"
          style={{ color: sub.status ? 'var(--green)' : 'var(--gray-400)' }}>
          {sub.status ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
        </button>
        <a href={`/api/qr/${sub.code}`} download={`drfish-${sub.code}.png`}
          className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-gray-50"
          style={{ color: 'var(--blue)' }}>
          <Download size={13} />
        </a>
      </div>
    </div>
  );
}

// ── Parent code card ──────────────────────────────────────────────────────────

function ReferralCard({ data: r, onRefresh }: { data: Ref; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [, startTransition] = useTransition();

  const copyLink = () => { navigator.clipboard.writeText(r.whatsappLink); toast.success('Lien WhatsApp copié !'); };

  const handleDelete = () => {
    if (!confirm(`Supprimer le code ${r.code} et ses ${r.subCodes.length} sous-code(s) ?`)) return;
    startTransition(async () => {
      await deleteReferralCode(r.id);
      onRefresh();
      toast.success('Code supprimé');
    });
  };

  const handleToggle = () =>
    startTransition(async () => {
      await updateReferralCode(r.id, { status: !r.status });
      onRefresh();
    });

  const totalSubOrders = r.subCodes.reduce((s, sc) => s + sc.totalOrders, 0);
  const totalSubRevenue = r.subCodes.reduce((s, sc) => s + sc.totalRevenue, 0);
  const totalSubCommission = r.subCodes.reduce((s, sc) => s + sc.totalCommission, 0);

  if (editing) {
    return (
      <div className="card p-5">
        <p className="label mb-3">Modifier — {r.code}</p>
        <ReferralForm
          initial={{
            name: r.name, username: r.username, code: r.code,
            commissionWithService: r.commissionWithService,
            commissionNoService: r.commissionNoService,
            status: r.status, notes: r.notes ?? '',
          }}
          isEdit
          onSave={async (d) => {
            await updateReferralCode(r.id, d);
            setEditing(false);
            onRefresh();
            toast.success('Code mis à jour — taux propagés aux sous-codes');
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="card overflow-hidden" style={{ opacity: r.status ? 1 : 0.65 }}>
      {/* Parent header */}
      <div className="p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: r.status ? 'rgba(46,109,180,0.08)' : 'var(--gray-50)' }}>
            <GitBranch size={16} style={{ color: r.status ? 'var(--blue)' : 'var(--gray-400)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-sm font-mono" style={{ color: 'var(--navy)' }}>{r.code}</p>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{
                  background: r.status ? 'rgba(26,122,74,0.1)' : 'var(--gray-50)',
                  color: r.status ? 'var(--green)' : 'var(--gray-400)',
                }}>
                {r.status ? 'ACTIF' : 'INACTIF'}
              </span>
              {r.subCodes.length > 0 && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(0,180,166,0.1)', color: 'var(--teal)' }}>
                  {r.subCodes.length} sous-code{r.subCodes.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--gray-400)' }}>
              {r.name} · @{r.username}
            </p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={handleToggle} className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-gray-50"
              style={{ color: r.status ? 'var(--green)' : 'var(--gray-400)' }}>
              {r.status ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
            </button>
            <button onClick={() => setEditing(true)} className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-gray-50"
              style={{ color: 'var(--gray-400)' }}>
              <Pencil size={14} />
            </button>
            <button onClick={handleDelete} className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-red-50"
              style={{ color: 'var(--red)' }}>
              <Trash2 size={14} />
            </button>
            {r.subCodes.length > 0 && (
              <button onClick={() => setExpanded(!expanded)}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-gray-50"
                style={{ color: 'var(--gray-400)' }}>
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            )}
          </div>
        </div>

        {/* KPI row — own + aggregated sub */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          {[
            { label: 'Direct', value: r.totalOrders.toString(), sub: totalSubOrders > 0 ? `+${totalSubOrders} sous` : null, icon: <Users size={12} />, color: 'var(--blue)' },
            { label: 'Revenu direct', value: formatCFA(r.totalRevenue), sub: totalSubRevenue > 0 ? `+${formatCFA(totalSubRevenue)} sous` : null, icon: <TrendingUp size={12} />, color: 'var(--blue)' },
            { label: 'Commission', value: formatCFA(r.totalCommission + totalSubCommission), sub: r.subCodes.length > 0 ? `dont ${formatCFA(totalSubCommission)} sous` : null, icon: <BarChart3 size={12} />, color: 'var(--orange)' },
          ].map(({ label, value, sub, icon, color }) => (
            <div key={label} className="rounded-xl p-2.5" style={{ background: 'var(--off-white)' }}>
              <div className="flex items-center gap-1 mb-1" style={{ color: 'var(--gray-400)' }}>
                {icon}
                <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
              </div>
              <p className="font-extrabold text-xs truncate" style={{ color: 'var(--navy)' }}>{value}</p>
              {sub && <p className="text-[10px] mt-0.5" style={{ color }}>{sub}</p>}
            </div>
          ))}
        </div>

        {/* Commission rates (admin-only) */}
        <div className="flex gap-2 mt-3">
          <div className="flex-1 rounded-xl p-2.5 text-center" style={{ background: 'rgba(46,109,180,0.06)' }}>
            <p className="text-[10px] font-semibold" style={{ color: 'var(--blue)' }}>Avec préparation</p>
            <p className="font-extrabold text-sm" style={{ color: 'var(--navy)' }}>{r.commissionWithService}%</p>
          </div>
          <div className="flex-1 rounded-xl p-2.5 text-center" style={{ background: 'rgba(0,180,166,0.06)' }}>
            <p className="text-[10px] font-semibold" style={{ color: 'var(--teal)' }}>Sans préparation</p>
            <p className="font-extrabold text-sm" style={{ color: 'var(--navy)' }}>{r.commissionNoService}%</p>
          </div>
          <button onClick={copyLink}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl text-xs font-semibold border transition-all"
            style={{ borderColor: 'var(--gray-100)', color: 'var(--navy)' }}>
            <Copy size={11} /> WA
          </button>
          <a href={`/api/qr/${r.code}`} download={`drfish-${r.code}.png`}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl text-xs font-semibold text-white transition-all"
            style={{ background: 'var(--blue)' }}>
            <Download size={11} /> QR
          </a>
        </div>
        {r.notes && <p className="text-xs italic mt-2" style={{ color: 'var(--gray-400)' }}>{r.notes}</p>}
      </div>

      {/* Sub-codes tree */}
      {r.subCodes.length > 0 && (expanded ? (
        <div style={{ borderTop: '1px solid var(--gray-50)' }}>
          <div className="px-5 py-2.5 flex items-center gap-2" style={{ background: 'var(--off-white)' }}>
            <GitBranch size={12} style={{ color: 'var(--teal)' }} />
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--teal)' }}>
              {r.subCodes.length} sous-code{r.subCodes.length > 1 ? 's' : ''}
            </p>
          </div>
          {r.subCodes.map((sc) => (
            <SubCodeRow key={sc.id} sub={sc} onRefresh={onRefresh} />
          ))}
        </div>
      ) : (
        <button onClick={() => setExpanded(true)}
          className="w-full px-5 py-2.5 text-left flex items-center gap-2 transition-colors hover:bg-gray-50"
          style={{ borderTop: '1px solid var(--gray-50)' }}>
          <GitBranch size={12} style={{ color: 'var(--teal)' }} />
          <span className="text-[11px]" style={{ color: 'var(--teal)' }}>
            Voir {r.subCodes.length} sous-code{r.subCodes.length > 1 ? 's' : ''}
          </span>
          <ChevronDown size={12} style={{ color: 'var(--teal)' }} />
        </button>
      ))}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ReferralsPage() {
  const [refs, setRefs] = useState<Ref[]>([]);
  const [analytics, setAnalytics] = useState<Analytics[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [, startTransition] = useTransition();

  const load = () => {
    startTransition(async () => {
      const [r, a] = await Promise.all([getReferralCodes(), getReferralAnalytics()]);
      setRefs(r);
      setAnalytics(a);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (d: typeof DEFAULT_FORM) => {
    await createReferralCode(d);
    setShowForm(false);
    load();
    toast.success(`Code ${d.code} créé avec succès`);
  };

  const totalCommissionMonth = analytics.reduce((s, a) => s + a.monthCommission, 0);
  const activeCount = refs.filter((r) => r.status).length;
  const totalSubCodes = refs.reduce((s, r) => s + r.subCodes.length, 0);

  const exportCSV = () => {
    const rows = [
      ['Niveau', 'Code', 'Nom', 'Statut', 'Cmdes (mois)', 'Commission (mois)', 'Total cmdes', 'Commission totale'],
      ...analytics.map((a) => [
        a.level === 0 ? 'Partenaire' : 'Sous-partenaire',
        a.code, a.name,
        a.status ? 'Actif' : 'Inactif',
        a.monthOrders.toString(),
        a.monthCommission.toString(),
        a.totalOrders.toString(),
        a.totalCommission.toString(),
      ]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `commissions-${new Date().toISOString().slice(0, 7)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        {[0, 1, 2].map((i) => <div key={i} className="h-40 skeleton rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-extrabold" style={{ fontSize: 26, color: 'var(--navy)', letterSpacing: '-0.5px' }}>
            Parrainage
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--gray-400)' }}>
            {activeCount} partenaire{activeCount !== 1 ? 's' : ''} actif{activeCount !== 1 ? 's' : ''}
            {totalSubCodes > 0 && ` · ${totalSubCodes} sous-code${totalSubCodes > 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all"
            style={{ borderColor: 'var(--gray-100)', color: 'var(--navy)' }}>
            <Download size={14} /> Export CSV
          </button>
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.98]"
            style={{ background: 'var(--blue)', boxShadow: '0 4px 12px rgba(46,109,180,0.3)' }}>
            <Plus size={15} /> Nouveau code
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      {refs.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Partenaires actifs', value: activeCount.toString(), color: 'var(--blue)' },
            { label: 'Sous-codes', value: totalSubCodes.toString(), color: 'var(--teal)' },
            { label: 'Revenu total', value: formatCFA(analytics.reduce((s, a) => s + a.totalRevenue, 0)), color: 'var(--blue)' },
            { label: 'Commission ce mois', value: formatCFA(totalCommissionMonth), color: 'var(--orange)' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card p-4" style={{ borderLeft: `3px solid ${color}` }}>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--gray-400)' }}>{label}</p>
              <p className="font-extrabold truncate" style={{ fontSize: 'clamp(14px, 3vw, 22px)', color: 'var(--navy)', letterSpacing: '-0.5px' }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="card p-6">
          <p className="font-bold mb-4" style={{ fontSize: 16, color: 'var(--navy)' }}>Nouveau code partenaire</p>
          <ReferralForm initial={DEFAULT_FORM} onSave={handleCreate} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {/* Tree */}
      {refs.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-20 gap-4">
          <FishIcon size={48} color="var(--gray-100)" />
          <div className="text-center">
            <p className="font-semibold text-sm" style={{ color: 'var(--navy)' }}>Aucun code de parrainage</p>
            <p className="text-xs mt-1" style={{ color: 'var(--gray-400)' }}>Créez votre premier code pour commencer</p>
          </div>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ background: 'var(--blue)' }}>
            <Plus size={14} /> Créer un code
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {refs.map((r) => <ReferralCard key={r.id} data={r} onRefresh={load} />)}
        </div>
      )}

      {/* Monthly commission table */}
      {analytics.some((a) => a.monthOrders > 0) && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--gray-50)' }}>
            <p className="font-bold text-sm" style={{ color: 'var(--navy)' }}>Commissions dues ce mois</p>
            <p className="font-extrabold text-sm" style={{ color: 'var(--orange)' }}>{formatCFA(totalCommissionMonth)}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {['Niveau', 'Partenaire', 'Code', 'Cmdes (mois)', 'Commission due'].map((h) => (
                    <th key={h} className="table-header-cell">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {analytics.filter((a) => a.monthOrders > 0)
                  .sort((a, b) => b.monthCommission - a.monthCommission)
                  .map((a) => (
                    <tr key={a.id} className="table-row">
                      <td className="table-cell">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{
                            background: a.level === 0 ? 'rgba(46,109,180,0.1)' : 'rgba(0,180,166,0.1)',
                            color: a.level === 0 ? 'var(--blue)' : 'var(--teal)',
                          }}>
                          {a.level === 0 ? 'Partenaire' : 'Sous'}
                        </span>
                      </td>
                      <td className="table-cell font-semibold">{a.name}</td>
                      <td className="table-cell font-mono text-xs">{a.code}</td>
                      <td className="table-cell">{a.monthOrders}</td>
                      <td className="table-cell font-bold" style={{ color: 'var(--orange)' }}>
                        {formatCFA(a.monthCommission)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

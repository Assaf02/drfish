'use client';

import { useState, useRef } from 'react';
import { signOut } from 'next-auth/react';
import { toast } from 'sonner';
import {
  Copy, LogOut, TrendingUp, ShoppingCart, Calendar, Check, Fish,
  Users, Plus, QrCode, ExternalLink, ChevronDown, ChevronUp,
  ToggleLeft, ToggleRight, Loader2, UserPlus, Scissors,
} from 'lucide-react';
import { formatCFA } from '@/lib/utils';
import { FishIcon } from '@/components/icons/FishIcon';
import {
  createSubCode,
  suggestSubCodeDefaults,
  toggleSubCodeStatus,
} from '@/app/actions/referrals';

type Order = {
  id: string;
  date: string;
  products: string;
  totalAmount: number;
  hasServices: boolean;
};

type SubCode = {
  id: string;
  code: string;
  name: string;
  username: string;
  status: boolean;
  whatsappLink: string;
  totalOrders: number;
  totalRevenue: number;
  monthOrders: number;
  monthRevenue: number;
};

type Stats = {
  totalDirectOrders: number;
  totalDirectRevenue: number;
  monthDirectOrders: number;
  monthDirectRevenue: number;
  totalSubOrders: number;
  monthSubOrders: number;
};

type RefInfo = {
  id: string;
  code: string;
  name: string;
  username: string;
  whatsappLink: string;
  level: number;
};

export function PartnerDashboardClient({
  partnerLevel,
  refInfo,
  stats,
  orders,
  subCodes: initialSubCodes,
}: {
  partnerLevel: number;
  refInfo: RefInfo;
  stats: Stats;
  orders: Order[];
  subCodes: SubCode[];
}) {
  const [dateFilter, setDateFilter] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  const [subCodes, setSubCodes] = useState(initialSubCodes);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [codePreview, setCodePreview] = useState('');
  const [suggestLoading, setSuggestLoading] = useState(false);
  const suggestTimer = useRef<ReturnType<typeof setTimeout>>();

  const copyCode = () => {
    navigator.clipboard.writeText(refInfo.code);
    setCodeCopied(true);
    toast.success('Code copié !');
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleNameChange = (val: string) => {
    setNewName(val);
    clearTimeout(suggestTimer.current);
    if (val.trim().length >= 2) {
      setSuggestLoading(true);
      suggestTimer.current = setTimeout(async () => {
        try {
          const s = await suggestSubCodeDefaults(refInfo.code, val.trim());
          setNewUsername(s.username);
          setNewSlug(s.subSlug);
          setCodePreview(s.subCode);
        } finally {
          setSuggestLoading(false);
        }
      }, 500);
    } else {
      setCodePreview('');
      setNewSlug('');
      setNewUsername('');
    }
  };

  const resetForm = () => {
    setNewName('');
    setNewUsername('');
    setNewSlug('');
    setCodePreview('');
    setShowCreateForm(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newSlug || !newUsername.trim()) return;
    setCreating(true);
    try {
      const created = await createSubCode({
        name: newName.trim(),
        username: newUsername.trim(),
        subSlug: newSlug,
      });
      setSubCodes((prev) => [
        ...prev,
        {
          id: created.id,
          code: created.code,
          name: created.name,
          username: created.username,
          status: created.status,
          whatsappLink: created.whatsappLink,
          totalOrders: 0,
          totalRevenue: 0,
          monthOrders: 0,
          monthRevenue: 0,
        },
      ]);
      toast.success(`Sous-parrain "${created.name}" créé !`);
      resetForm();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la création');
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (id: string, current: boolean) => {
    setTogglingId(id);
    try {
      await toggleSubCodeStatus(id, !current);
      setSubCodes((prev) =>
        prev.map((sc) => (sc.id === id ? { ...sc, status: !current } : sc)),
      );
    } catch {
      toast.error('Erreur lors du changement de statut');
    } finally {
      setTogglingId(null);
    }
  };

  const filteredOrders = dateFilter
    ? orders.filter((o) => o.date.includes(dateFilter))
    : orders;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  return (
    <div className="min-h-screen pb-10" style={{ background: 'var(--off-white)' }}>
      {/* Nav */}
      <nav
        className="sticky top-0 z-10 flex items-center justify-between px-4"
        style={{
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--gray-50)',
          paddingTop: 'calc(env(safe-area-inset-top) + 12px)',
          paddingBottom: 12,
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--navy)' }}
          >
            <FishIcon size={16} color="white" />
          </div>
          <span className="font-bold text-sm" style={{ color: 'var(--navy)' }}>
            Dr Fish
          </span>
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-semibold ml-1"
            style={{ background: 'rgba(46,109,180,0.1)', color: 'var(--blue)' }}
          >
            {partnerLevel === 0 ? 'Partenaire' : 'Sous-Partenaire'}
          </span>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/partner/login' })}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl"
          style={{ color: 'var(--gray-400)' }}
        >
          <LogOut size={13} /> Déconnexion
        </button>
      </nav>

      <div className="max-w-xl mx-auto px-4 pt-6 space-y-5 animate-fade-in">

        {/* Hero card */}
        <div
          className="rounded-3xl px-6 py-6"
          style={{
            background: 'linear-gradient(135deg, var(--navy) 0%, #1a3a5c 100%)',
            boxShadow: '0 8px 32px rgba(10,22,40,0.2)',
          }}
        >
          <p className="text-[13px] mb-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {greeting},
          </p>
          <h1
            className="font-extrabold text-white mb-4"
            style={{ fontSize: 24, letterSpacing: '-0.5px' }}
          >
            {refInfo.name}
          </h1>

          {/* Code row */}
          <div
            className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3 mb-3"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <div>
              <p
                className="text-[10px] font-semibold uppercase tracking-wider mb-1"
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                Votre code de parrainage
              </p>
              <p
                className="font-extrabold font-mono tracking-widest text-white"
                style={{ fontSize: 17 }}
              >
                {refInfo.code}
              </p>
            </div>
            <button
              onClick={copyCode}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
              style={{
                background: codeCopied ? 'rgba(26,122,74,0.3)' : 'rgba(255,255,255,0.12)',
                color: codeCopied ? '#86efac' : 'rgba(255,255,255,0.8)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              {codeCopied ? (
                <><Check size={12} /> Copié</>
              ) : (
                <><Copy size={12} /> Copier</>
              )}
            </button>
          </div>

          {/* WA + QR buttons */}
          <div className="flex gap-2">
            <a
              href={refInfo.whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-xs font-bold active:scale-95 transition-all"
              style={{
                background: 'rgba(37,211,102,0.15)',
                color: '#4ade80',
                border: '1px solid rgba(37,211,102,0.2)',
              }}
            >
              <ExternalLink size={12} /> WhatsApp
            </a>
            <a
              href={`/api/qr/${refInfo.code}`}
              download
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold active:scale-95 transition-all"
              style={{
                background: 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.8)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              <QrCode size={12} /> QR Code
            </a>
          </div>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              label: 'Commandes directes',
              value: stats.totalDirectOrders.toString(),
              icon: <ShoppingCart size={15} />,
              accent: 'var(--blue)',
              accentBg: 'rgba(46,109,180,0.08)',
            },
            {
              label: 'Ce mois (directes)',
              value: stats.monthDirectOrders.toString(),
              icon: <Calendar size={15} />,
              accent: 'var(--teal)',
              accentBg: 'rgba(0,180,166,0.08)',
            },
            ...(partnerLevel === 0
              ? [
                  {
                    label: 'Cmdes sous-parrains',
                    value: stats.totalSubOrders.toString(),
                    icon: <Users size={15} />,
                    accent: 'var(--orange)',
                    accentBg: 'rgba(192,92,0,0.08)',
                  },
                  {
                    label: 'Ce mois (sous-parrains)',
                    value: stats.monthSubOrders.toString(),
                    icon: <TrendingUp size={15} />,
                    accent: 'var(--orange)',
                    accentBg: 'rgba(192,92,0,0.08)',
                  },
                ]
              : [
                  {
                    label: "Chiffre d'affaires total",
                    value: formatCFA(stats.totalDirectRevenue),
                    icon: <TrendingUp size={15} />,
                    accent: 'var(--orange)',
                    accentBg: 'rgba(192,92,0,0.08)',
                  },
                  {
                    label: 'CA ce mois',
                    value: formatCFA(stats.monthDirectRevenue),
                    icon: <TrendingUp size={15} />,
                    accent: 'var(--orange)',
                    accentBg: 'rgba(192,92,0,0.08)',
                  },
                ]),
          ].map(({ label, value, icon, accent, accentBg }) => (
            <div key={label} className="card p-4" style={{ borderLeft: `3px solid ${accent}` }}>
              <div className="flex items-center justify-between mb-2">
                <p
                  className="text-[10px] font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--gray-400)' }}
                >
                  {label}
                </p>
                <span
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: accentBg, color: accent }}
                >
                  {icon}
                </span>
              </div>
              <p
                className="font-extrabold truncate"
                style={{
                  fontSize: 'clamp(14px, 4vw, 22px)',
                  color: 'var(--navy)',
                  letterSpacing: '-0.5px',
                }}
              >
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* Sub-partners section — level 0 only */}
        {partnerLevel === 0 && (
          <div className="card overflow-hidden">
            {/* Header */}
            <div
              className="px-5 py-4 flex items-center justify-between"
              style={{ borderBottom: '1px solid var(--gray-50)' }}
            >
              <div>
                <p className="font-bold text-sm" style={{ color: 'var(--navy)' }}>
                  Mes Sous-Parrains
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--gray-400)' }}>
                  {subCodes.length} sous-code{subCodes.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={() => setShowCreateForm((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
                style={{
                  background: showCreateForm ? 'rgba(46,109,180,0.1)' : 'var(--navy)',
                  color: showCreateForm ? 'var(--blue)' : 'white',
                }}
              >
                <Plus size={12} /> Nouveau
              </button>
            </div>

            {/* Create form */}
            {showCreateForm && (
              <form
                onSubmit={handleCreate}
                className="px-5 py-4 space-y-3"
                style={{
                  background: 'rgba(46,109,180,0.03)',
                  borderBottom: '1px solid var(--gray-50)',
                }}
              >
                <p className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--navy)' }}>
                  <UserPlus size={13} /> Créer un sous-parrain
                </p>

                <div>
                  <label
                    className="block text-[10px] font-semibold uppercase tracking-wide mb-1.5"
                    style={{ color: 'var(--gray-400)' }}
                  >
                    Nom complet
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Ex: Amos Mensah"
                    className="w-full text-sm px-3 py-2.5 rounded-xl border outline-none"
                    style={{
                      borderColor: 'var(--gray-100)',
                      color: 'var(--navy)',
                      background: 'white',
                    }}
                    required
                    minLength={2}
                  />
                </div>

                {codePreview && (
                  <div
                    className="rounded-xl p-3 space-y-2"
                    style={{
                      background: 'rgba(46,109,180,0.06)',
                      border: '1px solid rgba(46,109,180,0.12)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="text-[10px] font-semibold uppercase tracking-wide"
                        style={{ color: 'var(--gray-400)' }}
                      >
                        Code généré
                      </span>
                      {suggestLoading && (
                        <Loader2
                          size={10}
                          className="animate-spin"
                          style={{ color: 'var(--blue)' }}
                        />
                      )}
                    </div>
                    <p
                      className="font-extrabold font-mono text-sm tracking-wide"
                      style={{ color: 'var(--navy)' }}
                    >
                      {codePreview}
                    </p>
                    <div>
                      <label
                        className="block text-[10px] font-semibold uppercase tracking-wide mb-1"
                        style={{ color: 'var(--gray-400)' }}
                      >
                        Nom d&apos;utilisateur (connexion)
                      </label>
                      <input
                        type="text"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        className="w-full text-xs px-2.5 py-2 rounded-lg border outline-none"
                        style={{
                          borderColor: 'var(--gray-100)',
                          color: 'var(--navy)',
                          background: 'white',
                        }}
                        required
                        minLength={2}
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold"
                    style={{ background: 'var(--gray-50)', color: 'var(--gray-400)' }}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={creating || !codePreview || !newUsername.trim()}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
                    style={{ background: 'var(--navy)', color: 'white' }}
                  >
                    {creating && <Loader2 size={12} className="animate-spin inline mr-1" />}
                    {creating ? 'Création...' : 'Créer'}
                  </button>
                </div>
              </form>
            )}

            {/* Sub-code list */}
            {subCodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Users size={28} style={{ color: 'var(--gray-100)' }} />
                <p className="text-sm" style={{ color: 'var(--gray-400)' }}>
                  Aucun sous-parrain
                </p>
                <p className="text-[11px]" style={{ color: 'var(--gray-200)' }}>
                  Cliquez sur + Nouveau pour en ajouter
                </p>
              </div>
            ) : (
              <div>
                {subCodes.map((sc) => (
                  <SubCodeCard
                    key={sc.id}
                    sc={sc}
                    toggling={togglingId === sc.id}
                    onToggle={() => handleToggle(sc.id, sc.status)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Orders table */}
        <div className="card overflow-hidden">
          <div
            className="px-4 py-3 flex items-center justify-between gap-3"
            style={{ borderBottom: '1px solid var(--gray-50)' }}
          >
            <p className="font-bold text-sm" style={{ color: 'var(--navy)' }}>
              Mes commandes ({filteredOrders.length})
            </p>
            <input
              type="month"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-xl border outline-none"
              style={{
                borderColor: 'var(--gray-100)',
                color: 'var(--navy)',
                background: 'var(--white)',
              }}
            />
          </div>

          {filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <FishIcon size={36} color="var(--gray-100)" />
              <p className="text-sm" style={{ color: 'var(--gray-400)' }}>
                Aucune commande
              </p>
            </div>
          ) : (
            <div>
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="px-4 py-3.5 flex items-start gap-3 border-b last:border-0"
                  style={{ borderColor: 'var(--gray-50)' }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{
                      background: order.hasServices
                        ? 'rgba(46,109,180,0.08)'
                        : 'rgba(0,180,166,0.08)',
                    }}
                  >
                    {order.hasServices ? (
                      <Scissors size={14} style={{ color: 'var(--blue)' }} />
                    ) : (
                      <Fish size={14} style={{ color: 'var(--teal)' }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-xs font-semibold truncate"
                      style={{ color: 'var(--navy)' }}
                    >
                      {order.products}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px]" style={{ color: 'var(--gray-400)' }}>
                        {order.date}
                      </span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                        style={{
                          background: order.hasServices
                            ? 'rgba(46,109,180,0.08)'
                            : 'rgba(0,180,166,0.08)',
                          color: order.hasServices ? 'var(--blue)' : 'var(--teal)',
                        }}
                      >
                        {order.hasServices ? 'Avec prép.' : 'Sans prép.'}
                      </span>
                    </div>
                  </div>
                  <p
                    className="text-xs font-semibold flex-shrink-0"
                    style={{ color: 'var(--navy)' }}
                  >
                    {formatCFA(order.totalAmount)}
                  </p>
                </div>
              ))}
            </div>
          )}

          {filteredOrders.length > 0 && (
            <div
              className="px-4 py-3 flex items-center justify-between"
              style={{ background: 'var(--off-white)', borderTop: '1px solid var(--gray-50)' }}
            >
              <p className="text-xs font-semibold" style={{ color: 'var(--gray-400)' }}>
                Total ({filteredOrders.length} cmde{filteredOrders.length > 1 ? 's' : ''})
              </p>
              <p className="text-xs font-semibold" style={{ color: 'var(--navy)' }}>
                {formatCFA(filteredOrders.reduce((s, o) => s + o.totalAmount, 0))}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SubCodeCard({
  sc,
  toggling,
  onToggle,
}: {
  sc: SubCode;
  toggling: boolean;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b last:border-0" style={{ borderColor: 'var(--gray-50)' }}>
      <div className="px-4 py-3.5">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-semibold text-sm truncate" style={{ color: 'var(--navy)' }}>
                {sc.name}
              </p>
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0"
                style={{
                  background: sc.status ? 'rgba(26,122,74,0.1)' : 'rgba(239,68,68,0.1)',
                  color: sc.status ? '#16a34a' : '#dc2626',
                }}
              >
                {sc.status ? 'Actif' : 'Inactif'}
              </span>
            </div>
            <p
              className="font-mono text-[11px] font-bold tracking-wide"
              style={{ color: 'var(--blue)' }}
            >
              {sc.code}
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--gray-400)' }}>
              @{sc.username}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <button
              onClick={onToggle}
              disabled={toggling}
              className="transition-all active:scale-95 disabled:opacity-50"
              title={sc.status ? 'Désactiver' : 'Activer'}
            >
              {toggling ? (
                <Loader2 size={20} className="animate-spin" style={{ color: 'var(--gray-300)' }} />
              ) : sc.status ? (
                <ToggleRight size={24} style={{ color: 'var(--teal)' }} />
              ) : (
                <ToggleLeft size={24} style={{ color: 'var(--gray-300)' }} />
              )}
            </button>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-0.5 text-[10px] font-medium"
              style={{ color: 'var(--gray-400)' }}
            >
              {sc.totalOrders} cmd{sc.totalOrders !== 1 ? 's' : ''}
              {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
          </div>
        </div>

        {expanded && (
          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl p-3" style={{ background: 'rgba(46,109,180,0.05)' }}>
                <p className="text-[10px]" style={{ color: 'var(--gray-400)' }}>
                  Commandes
                </p>
                <p className="font-bold text-sm" style={{ color: 'var(--navy)' }}>
                  {sc.totalOrders}
                </p>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'rgba(0,180,166,0.05)' }}>
                <p className="text-[10px]" style={{ color: 'var(--gray-400)' }}>
                  CA total
                </p>
                <p
                  className="font-bold text-sm truncate"
                  style={{ color: 'var(--navy)' }}
                >
                  {formatCFA(sc.totalRevenue)}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <a
                href={sc.whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold"
                style={{ background: 'rgba(37,211,102,0.1)', color: '#16a34a' }}
              >
                <ExternalLink size={10} /> WhatsApp
              </a>
              <a
                href={`/api/qr/${sc.code}`}
                download
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold"
                style={{ background: 'rgba(46,109,180,0.08)', color: 'var(--blue)' }}
              >
                <QrCode size={10} /> QR Code
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

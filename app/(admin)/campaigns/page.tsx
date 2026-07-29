'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MessageCircle, Plus, Play, Eye, Wifi, WifiOff,
  RefreshCw, Upload, X, CheckCircle2, AlertCircle,
  Loader2, Users, FileText, Paperclip, Calendar, Shield, ChevronDown, Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { normalizePhone } from '@/lib/phoneUtils';

// ── Types ──────────────────────────────────────────────────────────────────────

type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'DONE' | 'STOPPED';

type Campaign = {
  id:               string;
  name:             string;
  status:           CampaignStatus;
  totalSent:        number;
  totalFailed:      number;
  totalTargets:     number;
  source:           string;
  baseDelaySeconds: number;
  createdAt:        string;
};

type GowaState = {
  connected:   boolean;
  unreachable: boolean;
  loading:     boolean;
  qrImage?:    string;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function statusBadge(status: CampaignStatus) {
  const map: Record<CampaignStatus, { v: 'green' | 'blue' | 'orange' | 'gray'; label: string }> = {
    DONE:      { v: 'green',  label: 'Terminée' },
    RUNNING:   { v: 'blue',   label: 'En cours' },
    STOPPED:   { v: 'orange', label: 'Arrêtée' },
    DRAFT:     { v: 'gray',   label: 'Brouillon' },
    SCHEDULED: { v: 'blue',   label: 'Programmée' },
  };
  const s = map[status] ?? map.DRAFT;
  return <Badge variant={s.v} dot>{s.label}</Badge>;
}

function extractPhones(text: string): string[] {
  // Match sequences of 8–20 chars that look like phone numbers
  const raw = text.match(/\+?[\d][\d\s\-\.()]{6,18}[\d]/g) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of raw) {
    const n = normalizePhone(r);
    if (n && !seen.has(n)) { seen.add(n); out.push(n); }
  }
  return out;
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns,    setCampaigns]    = useState<Campaign[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [gowa,         setGowa]         = useState<GowaState>({ connected: false, unreachable: false, loading: true, qrImage: undefined });
  const [showModal,    setShowModal]    = useState(false);
  const [starting,     setStarting]     = useState<string | null>(null);
  const [showPurge,    setShowPurge]    = useState(false);
  const [purgeDays,    setPurgeDays]    = useState(30);
  const [purging,      setPurging]      = useState(false);
  const [purgeResult,  setPurgeResult]  = useState<number | null>(null);

  // ── Fetch list ──────────────────────────────────────────────────────────────

  async function load() {
    try {
      const res  = await fetch('/api/campaigns');
      const data = await res.json();
      setCampaigns(data);
    } finally {
      setLoading(false);
    }
  }

  async function checkGowa() {
    try {
      const res  = await fetch('/api/whatsapp/status', { cache: 'no-store' });
      const data = await res.json();
      setGowa({ connected: data.connected, unreachable: !!data.unreachable, loading: false });
    } catch {
      setGowa({ connected: false, unreachable: true, loading: false });
    }
  }

  useEffect(() => {
    load();
    checkGowa();
  }, []);

  // ── Purge logs ──────────────────────────────────────────────────────────────

  async function purgeLogs() {
    setPurging(true);
    setPurgeResult(null);
    try {
      const res  = await fetch('/api/admin/purge-logs', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ days: purgeDays }),
      });
      const data = await res.json() as { deleted: number };
      setPurgeResult(data.deleted);
      toast.success(`${data.deleted} log${data.deleted !== 1 ? 's' : ''} supprimé${data.deleted !== 1 ? 's' : ''}`);
    } catch {
      toast.error('Erreur lors de la purge');
    } finally {
      setPurging(false);
    }
  }

  // ── Start campaign ──────────────────────────────────────────────────────────

  async function startCampaign(id: string) {
    setStarting(id);
    try {
      const res = await fetch(`/api/campaigns/${id}/start`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Campagne démarrée !');
      router.push(`/campaigns/${id}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setStarting(null);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── WhatsApp status banner ─────────────────────────────────────────── */}
      <GowaStatusBanner gowa={gowa} onRefresh={checkGowa} />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-extrabold" style={{ fontSize: 26, color: 'var(--navy)', letterSpacing: '-0.5px' }}>
            Campagnes WhatsApp
          </h1>
          <p className="text-[14px] mt-0.5" style={{ color: 'var(--gray-400)' }}>
            {campaigns.length} campagne{campaigns.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowPurge(true); setPurgeResult(null); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
            style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.15)' }}
          >
            <Trash2 size={14} /> Purger les logs
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95"
            style={{ background: 'var(--navy)', color: 'white', boxShadow: '0 2px 8px rgba(10,22,40,0.2)' }}
          >
            <Plus size={15} /> Nouvelle campagne
          </button>
        </div>
      </div>

      {/* ── Purge logs modal ───────────────────────────────────────────────── */}
      {showPurge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(10,22,40,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-5"
            style={{ background: 'white', boxShadow: '0 24px 64px rgba(10,22,40,0.2)' }}>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(239,68,68,0.08)' }}>
                <Trash2 size={18} color="#dc2626" />
              </div>
              <div>
                <h2 className="font-bold text-base" style={{ color: 'var(--navy)' }}>
                  Purger les logs de campagne
                </h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--gray-400)' }}>
                  Supprime les entrées plus anciennes que la période choisie
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--gray-400)' }}>
                Supprimer les logs de plus de
              </p>
              <div className="grid grid-cols-4 gap-2">
                {[7, 30, 60, 90].map((d) => (
                  <button
                    key={d}
                    onClick={() => setPurgeDays(d)}
                    className="py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95"
                    style={{
                      background: purgeDays === d ? '#dc2626' : 'rgba(239,68,68,0.06)',
                      color:      purgeDays === d ? 'white'   : '#dc2626',
                      border:     `1px solid ${purgeDays === d ? '#dc2626' : 'rgba(239,68,68,0.15)'}`,
                    }}
                  >
                    {d}j
                  </button>
                ))}
              </div>
            </div>

            {purgeResult !== null && (
              <div className="rounded-xl p-3 text-sm font-semibold text-center"
                style={{ background: 'rgba(0,180,166,0.08)', color: 'var(--teal)' }}>
                ✓ {purgeResult} log{purgeResult !== 1 ? 's' : ''} supprimé{purgeResult !== 1 ? 's' : ''}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowPurge(false)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold"
                style={{ background: 'var(--gray-50)', color: 'var(--gray-400)' }}
              >
                Fermer
              </button>
              <button
                onClick={purgeLogs}
                disabled={purging}
                className="flex-1 py-3 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: '#dc2626', color: 'white' }}
              >
                {purging
                  ? <><Loader2 size={14} className="animate-spin" /> Purge…</>
                  : <><Trash2 size={14} /> Purger {purgeDays} jours</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="card p-8 flex items-center justify-center gap-3">
          <Loader2 size={20} className="animate-spin" style={{ color: 'var(--blue)' }} />
          <span className="text-sm" style={{ color: 'var(--gray-400)' }}>Chargement…</span>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="card p-12 flex flex-col items-center gap-3">
          <MessageCircle size={40} style={{ color: 'var(--gray-100)' }} />
          <p className="font-semibold" style={{ color: 'var(--gray-400)' }}>Aucune campagne</p>
          <p className="text-sm text-center" style={{ color: 'var(--gray-400)' }}>
            Créez votre première campagne WhatsApp
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--gray-50)' }}>
                {['Nom', 'Date', 'Source', 'Cibles', 'Envoyés / Échoués', 'Statut', ''].map((h) => (
                  <th key={h} className="table-header-cell text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="table-row">
                  <td className="table-cell font-semibold">{c.name}</td>
                  <td className="table-cell" style={{ color: 'var(--gray-400)' }}>
                    {format(new Date(c.createdAt), 'dd MMM yyyy', { locale: fr })}
                  </td>
                  <td className="table-cell">
                    <span className="text-xs px-2 py-0.5 rounded-lg font-medium"
                      style={{ background: 'rgba(46,109,180,0.08)', color: 'var(--blue)' }}>
                      {c.source === 'DB_CLIENTS' ? 'Clients DB' : 'Importé'}
                    </span>
                  </td>
                  <td className="table-cell">{c.totalTargets || '—'}</td>
                  <td className="table-cell">
                    <span style={{ color: 'var(--teal)' }}>{c.totalSent}</span>
                    {' / '}
                    <span style={{ color: c.totalFailed > 0 ? 'var(--orange)' : 'var(--gray-400)' }}>
                      {c.totalFailed}
                    </span>
                  </td>
                  <td className="table-cell">{statusBadge(c.status)}</td>
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      {(c.status === 'DRAFT' || c.status === 'STOPPED') && (
                        <button
                          onClick={() => startCampaign(c.id)}
                          disabled={!!starting}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
                          style={{ background: 'rgba(0,180,166,0.1)', color: 'var(--teal)' }}
                        >
                          {starting === c.id
                            ? <Loader2 size={11} className="animate-spin" />
                            : <Play size={11} />}
                          Démarrer
                        </button>
                      )}
                      <button
                        onClick={() => router.push(`/campaigns/${c.id}`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                        style={{ background: 'rgba(46,109,180,0.08)', color: 'var(--blue)' }}
                      >
                        <Eye size={11} /> Détail
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── New campaign modal ──────────────────────────────────────────────── */}
      {showModal && (
        <NewCampaignModal
          onClose={() => setShowModal(false)}
          onCreated={(id) => {
            setShowModal(false);
            router.push(`/campaigns/${id}`);
          }}
        />
      )}
    </div>
  );
}

// ── GoWA status banner ─────────────────────────────────────────────────────────

function GowaStatusBanner({
  gowa, onRefresh,
}: {
  gowa:      GowaState;
  onRefresh: () => void;
}) {
  const router = useRouter();
  if (gowa.loading) return null;

  if (gowa.connected) {
    return (
      <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl"
        style={{ background: 'rgba(26,122,74,0.06)', border: '1px solid rgba(26,122,74,0.15)' }}>
        <Wifi size={16} style={{ color: '#16a34a' }} />
        <p className="text-sm font-semibold" style={{ color: '#15803d' }}>
          WhatsApp connecté — prêt à envoyer
        </p>
        <button onClick={onRefresh} className="ml-auto"
          style={{ color: 'rgba(21,128,61,0.6)' }}>
          <RefreshCw size={13} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-5 py-4 rounded-2xl"
      style={{ border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.04)' }}>
      <WifiOff size={16} style={{ color: '#dc2626', flexShrink: 0 }} />
      <div className="flex-1">
        <p className="text-sm font-semibold" style={{ color: '#b91c1c' }}>
          WhatsApp déconnecté
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--gray-400)' }}>
          Connectez WhatsApp pour pouvoir envoyer des campagnes.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ background: 'rgba(220,38,38,0.06)', color: '#b91c1c' }}
        >
          <RefreshCw size={11} /> Actualiser
        </button>
        <button
          onClick={() => router.push('/whatsapp')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ background: 'rgba(220,38,38,0.12)', color: '#b91c1c' }}
        >
          <MessageCircle size={11} /> Connecter →
        </button>
      </div>
    </div>
  );
}

// ── New campaign modal ─────────────────────────────────────────────────────────

function NewCampaignModal({
  onClose,
  onCreated,
}: {
  onClose:   () => void;
  onCreated: (id: string) => void;
}) {
  const [name,            setName]            = useState('');
  const [message,         setMessage]         = useState('');
  const [source,          setSource]          = useState<'DB_CLIENTS' | 'IMPORTED'>('DB_CLIENTS');
  const [delay,           setDelay]           = useState(12);
  const [phones,          setPhones]          = useState<string[]>([]);
  const [dbCount,         setDbCount]         = useState<number | null>(null);
  const [saving,          setSaving]          = useState(false);
  const [dragOver,        setDragOver]        = useState(false);
  const [mediaUrl,        setMediaUrl]        = useState('');
  const [mediaFileName,   setMediaFileName]   = useState('');
  const [mediaType,       setMediaType]       = useState('');
  const [uploading,       setUploading]       = useState(false);
  const [mediaDragOver,   setMediaDragOver]   = useState(false);
  const [scheduledAt,     setScheduledAt]     = useState('');
  const [dailyLimit,      setDailyLimit]      = useState(200);
  const [validateNumbers, setValidateNumbers] = useState(true);
  const [showAdvanced,    setShowAdvanced]    = useState(false);
  const fileRef      = useRef<HTMLInputElement>(null);
  const mediaFileRef = useRef<HTMLInputElement>(null);

  // Fetch DB client count on mount
  useEffect(() => {
    fetch('/api/campaigns')
      .then((r) => r.json())
      .then(() => {
        // Count clients with sales — quick estimate via /api/whatsapp/status reuse
        // We fetch from a dedicated count, but for now use a placeholder
      })
      .catch(() => {});

    // Fetch actual client count via a quick server query
    fetch('/api/campaigns?countClients=1')
      .then((r) => r.json())
      .then((d) => { if (typeof d.clientCount === 'number') setDbCount(d.clientCount); })
      .catch(() => {});
  }, []);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string ?? '';
      const extracted = extractPhones(text);
      setPhones(extracted);
      if (extracted.length > 0) {
        toast.success(`${extracted.length} numéro${extracted.length > 1 ? 's' : ''} extraits`);
      } else {
        toast.error('Aucun numéro valide trouvé dans le fichier');
      }
    };
    reader.readAsText(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  async function handleMediaUpload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? 'Erreur upload');
        return;
      }
      const data = await res.json();
      setMediaUrl(data.url);
      setMediaFileName(data.fileName);
      setMediaType(data.type);
      toast.success('Fichier joint !');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur réseau lors de l\'upload');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !message.trim()) return;
    if (source === 'IMPORTED' && phones.length === 0) {
      toast.error('Importez au moins un numéro');
      return;
    }

    setSaving(true);
    try {
      const res  = await fetch('/api/campaigns', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name, message, source, phones,
          baseDelaySeconds: delay,
          mediaUrl:         mediaUrl || null,
          scheduledAt:      scheduledAt ? new Date(scheduledAt).toISOString() : null,
          dailyLimit,
          validateNumbers,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erreur');
      const data = await res.json();
      onCreated(data.id);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  }

  const recipientCount = source === 'DB_CLIENTS' ? dbCount : phones.length;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(10,22,40,0.6)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl"
        style={{ background: 'white', boxShadow: '0 24px 64px rgba(10,22,40,0.25)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5"
          style={{ borderBottom: '1px solid var(--gray-50)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(37,211,102,0.1)' }}>
              <MessageCircle size={18} style={{ color: '#16a34a' }} />
            </div>
            <h2 className="font-bold text-[17px]" style={{ color: 'var(--navy)' }}>
              Nouvelle campagne
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:bg-gray-50">
            <X size={16} style={{ color: 'var(--gray-400)' }} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
              style={{ color: 'var(--gray-400)' }}>
              Nom de la campagne *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Promo Juin 2026"
              className="w-full text-sm px-4 py-2.5 rounded-xl border outline-none"
              style={{ borderColor: 'var(--gray-100)', color: 'var(--navy)' }}
              required
            />
          </div>

          {/* Source */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-2"
              style={{ color: 'var(--gray-400)' }}>
              Source des destinataires
            </label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { v: 'DB_CLIENTS', icon: <Users size={14} />,    label: 'Clients Dr Fish',   sub: 'Ayant déjà commandé' },
                { v: 'IMPORTED',   icon: <FileText size={14} />,  label: 'Importer une liste', sub: 'CSV / texte' },
              ] as const).map(({ v, icon, label, sub }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setSource(v)}
                  className="flex items-start gap-2 p-3 rounded-xl border text-left transition-all"
                  style={{
                    borderColor:  source === v ? 'var(--blue)' : 'var(--gray-100)',
                    background:   source === v ? 'rgba(46,109,180,0.05)' : 'white',
                  }}
                >
                  <span className="mt-0.5" style={{ color: source === v ? 'var(--blue)' : 'var(--gray-400)' }}>
                    {icon}
                  </span>
                  <div>
                    <p className="text-xs font-semibold" style={{ color: source === v ? 'var(--navy)' : 'var(--gray-400)' }}>
                      {label}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--gray-400)' }}>{sub}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Import zone */}
          {source === 'IMPORTED' && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
                style={{ color: 'var(--gray-400)' }}>
                Importer les numéros
              </label>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors"
                style={{
                  borderColor: dragOver ? 'var(--blue)' : 'var(--gray-100)',
                  background:  dragOver ? 'rgba(46,109,180,0.04)' : 'var(--off-white)',
                }}
              >
                <Upload size={20} className="mx-auto mb-2" style={{ color: 'var(--gray-400)' }} />
                <p className="text-xs font-semibold" style={{ color: 'var(--navy)' }}>
                  Glissez un fichier CSV / TXT
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--gray-400)' }}>
                  ou cliquez pour parcourir
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.txt,.tsv"
                  className="hidden"
                  onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
                />
              </div>

              {/* Manual paste */}
              <textarea
                placeholder="Ou collez des numéros ici (un par ligne ou séparés par virgule)&#10;229961234567&#10;229971234567"
                className="w-full mt-2 text-xs px-4 py-3 rounded-xl border outline-none resize-none"
                style={{ borderColor: 'var(--gray-100)', color: 'var(--navy)', minHeight: 80 }}
                onChange={(e) => {
                  const extracted = extractPhones(e.target.value);
                  if (extracted.length > 0) setPhones(extracted);
                }}
              />

              {phones.length > 0 && (
                <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-xl"
                  style={{ background: 'rgba(0,180,166,0.08)' }}>
                  <CheckCircle2 size={13} style={{ color: 'var(--teal)' }} />
                  <p className="text-xs font-semibold" style={{ color: 'var(--teal)' }}>
                    {phones.length} numéro{phones.length > 1 ? 's' : ''} valide{phones.length > 1 ? 's' : ''} prêt{phones.length > 1 ? 's' : ''}
                  </p>
                  <button type="button" onClick={() => setPhones([])} className="ml-auto">
                    <X size={12} style={{ color: 'var(--gray-400)' }} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Message */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
              style={{ color: 'var(--gray-400)' }}>
              Message *
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Bonjour ! 🐟 Dr Fish vous propose..."
              className="w-full text-sm px-4 py-3 rounded-xl border outline-none resize-none"
              style={{ borderColor: 'var(--gray-100)', color: 'var(--navy)', minHeight: 120 }}
              required
            />
            <p className="text-[11px] mt-1" style={{ color: 'var(--gray-400)' }}>
              {message.length} caractères — les sauts de ligne sont conservés
            </p>
          </div>

          {/* Media */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-2"
              style={{ color: 'var(--gray-400)' }}>
              <Paperclip size={11} className="inline mr-1" />
              Fichier joint (optionnel)
            </label>

            {/* Hidden file input */}
            <input
              ref={mediaFileRef}
              type="file"
              accept="image/*,video/mp4,video/quicktime,video/webm,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
              className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) handleMediaUpload(e.target.files[0]); }}
            />

            {mediaUrl ? (
              /* ── Media preview ── */
              <div className="flex items-center gap-3 p-3 rounded-xl"
                style={{ border: '1px solid var(--gray-100)', background: 'var(--off-white)' }}>
                {mediaType.startsWith('image/') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaUrl} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                    style={{ border: '1px solid var(--gray-100)' }} />
                ) : (
                  <div className="w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(46,109,180,0.08)', color: 'var(--blue)', fontSize: 24 }}>
                    {mediaType.startsWith('video/')  ? '🎬' :
                     mediaType === 'application/pdf' ? '📄' : '📎'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: 'var(--navy)' }}>
                    {mediaFileName || mediaUrl.split('/').pop()?.split('?')[0]}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--gray-400)' }}>
                    Le message sera envoyé en légende
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setMediaUrl(''); setMediaFileName(''); setMediaType(''); }}
                  className="p-1.5 rounded-lg transition-colors hover:bg-gray-100 flex-shrink-0"
                >
                  <X size={14} style={{ color: 'var(--gray-400)' }} />
                </button>
              </div>
            ) : (
              /* ── Upload zone ── */
              <div
                onDragOver={(e) => { e.preventDefault(); setMediaDragOver(true); }}
                onDragLeave={() => setMediaDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setMediaDragOver(false);
                  const f = e.dataTransfer.files[0];
                  if (f) handleMediaUpload(f);
                }}
                onClick={() => !uploading && mediaFileRef.current?.click()}
                className="border-2 border-dashed rounded-xl p-4 text-center transition-colors"
                style={{
                  borderColor: mediaDragOver ? 'var(--blue)' : 'var(--gray-100)',
                  background:  mediaDragOver ? 'rgba(46,109,180,0.04)' : 'var(--off-white)',
                  cursor:      uploading ? 'default' : 'pointer',
                }}
              >
                {uploading ? (
                  <Loader2 size={20} className="animate-spin mx-auto mb-1.5" style={{ color: 'var(--blue)' }} />
                ) : (
                  <Upload size={20} className="mx-auto mb-1.5" style={{ color: 'var(--gray-400)' }} />
                )}
                <p className="text-xs font-semibold" style={{ color: 'var(--navy)' }}>
                  {uploading ? 'Upload en cours…' : 'Glisser ou cliquer pour joindre'}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--gray-400)' }}>
                  Image · Vidéo · PDF · Word · Excel (max 20 Mo)
                </p>
              </div>
            )}
          </div>

          {/* Scheduling */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
              style={{ color: 'var(--gray-400)' }}>
              <Calendar size={11} className="inline mr-1" />
              Programmer l&apos;envoi (optionnel)
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
              className="w-full text-sm px-4 py-2.5 rounded-xl border outline-none"
              style={{ borderColor: 'var(--gray-100)', color: scheduledAt ? 'var(--navy)' : 'var(--gray-400)' }}
            />
            {scheduledAt && (
              <p className="text-[11px] mt-1" style={{ color: 'var(--blue)' }}>
                La campagne démarrera automatiquement à cette date
              </p>
            )}
          </div>

          {/* Delay */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
              style={{ color: 'var(--gray-400)' }}>
              Délai de base entre envois (secondes)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={8}
                max={60}
                value={delay}
                onChange={(e) => setDelay(Number(e.target.value))}
                className="flex-1"
                style={{ accentColor: 'var(--navy)' }}
              />
              <span className="w-10 text-center font-bold text-sm" style={{ color: 'var(--navy)' }}>
                {delay}s
              </span>
            </div>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--gray-400)' }}>
              Délai réel : {(delay * 0.7).toFixed(0)}–{(delay * 1.8).toFixed(0)}s (humanisé)
            </p>
          </div>

          {/* Anti-ban settings */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--gray-100)' }}>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="w-full flex items-center gap-2 px-4 py-3 text-left"
              style={{ background: 'var(--off-white)' }}
            >
              <Shield size={13} style={{ color: 'var(--blue)' }} />
              <span className="text-xs font-semibold flex-1" style={{ color: 'var(--navy)' }}>
                Paramètres anti-ban
              </span>
              <ChevronDown size={13} style={{ color: 'var(--gray-400)', transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>

            {showAdvanced && (
              <div className="px-4 py-4 space-y-4" style={{ borderTop: '1px solid var(--gray-100)' }}>
                {/* Validate numbers */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={validateNumbers}
                    onChange={(e) => setValidateNumbers(e.target.checked)}
                    style={{ accentColor: 'var(--navy)', width: 15, height: 15 }}
                  />
                  <div>
                    <p className="text-xs font-semibold" style={{ color: 'var(--navy)' }}>
                      Valider les numéros avant envoi
                    </p>
                    <p className="text-[11px]" style={{ color: 'var(--gray-400)' }}>
                      Vérifie chaque numéro sur WhatsApp — évite les envois vers des comptes inexistants
                    </p>
                  </div>
                </label>

                {/* Daily limit */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-semibold" style={{ color: 'var(--navy)' }}>
                      Limite journalière
                    </p>
                    <span className="font-bold text-xs" style={{ color: 'var(--navy)' }}>
                      {dailyLimit} msg/jour
                    </span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={500}
                    step={10}
                    value={dailyLimit}
                    onChange={(e) => setDailyLimit(Number(e.target.value))}
                    className="w-full"
                    style={{ accentColor: 'var(--navy)' }}
                  />
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--gray-400)' }}>
                    Recommandé : ≤200 pour les comptes récents — la campagne s&apos;arrête automatiquement si la limite est atteinte
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Recipient preview */}
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
            style={{ background: 'var(--off-white)', border: '1px solid var(--gray-50)' }}>
            <AlertCircle size={14} style={{ color: 'var(--blue)' }} />
            <p className="text-xs" style={{ color: 'var(--navy)' }}>
              <span className="font-bold">
                {recipientCount !== null ? recipientCount : '—'}
              </span>
              {' '}destinataire{(recipientCount ?? 0) !== 1 ? 's' : ''} estimé{(recipientCount ?? 0) !== 1 ? 's' : ''}
              {source === 'DB_CLIENTS' && ' (clients avec commandes)'}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm font-semibold"
              style={{ background: 'var(--gray-50)', color: 'var(--gray-400)' }}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50"
              style={{ background: 'var(--navy)', color: 'white' }}
            >
              {saving
                ? <Loader2 size={15} className="animate-spin inline mr-1" />
                : null}
              {saving ? 'Création…' : scheduledAt ? 'Programmer →' : 'Créer →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

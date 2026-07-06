'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft, Square, Play, RotateCcw, Loader2,
  CheckCircle2, XCircle, Clock, TrendingUp,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

// ── Types ──────────────────────────────────────────────────────────────────────

type CampaignStatus = 'DRAFT' | 'RUNNING' | 'DONE' | 'STOPPED';

type Log = {
  id:     string;
  phone:  string;
  status: 'SENT' | 'FAILED';
  error:  string | null;
  sentAt: string;
};

type Campaign = {
  id:               string;
  name:             string;
  message:          string;
  status:           CampaignStatus;
  totalSent:        number;
  totalFailed:      number;
  totalTargets:     number;
  baseDelaySeconds: number;
  source:           string;
  createdAt:        string;
  logs:             Log[];
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function statusBadge(status: CampaignStatus) {
  const map: Record<CampaignStatus, { v: 'green' | 'blue' | 'orange' | 'gray'; label: string }> = {
    DONE:    { v: 'green',  label: 'Terminée' },
    RUNNING: { v: 'blue',   label: 'En cours…' },
    STOPPED: { v: 'orange', label: 'Arrêtée' },
    DRAFT:   { v: 'gray',   label: 'Brouillon' },
  };
  const s = map[status] ?? map.DRAFT;
  return <Badge variant={s.v} dot>{s.label}</Badge>;
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CampaignDetailPage() {
  const router    = useRouter();
  const { id }    = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [stopping, setStopping] = useState(false);
  const [starting, setStarting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchCampaign = useCallback(async () => {
    const res  = await fetch(`/api/campaigns/${id}`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    setCampaign(data);
    setLoading(false);
    return data as Campaign;
  }, [id]);

  // ── Polling — every 2s while RUNNING ────────────────────────────────────

  useEffect(() => {
    fetchCampaign();

    pollRef.current = setInterval(async () => {
      const data = await fetchCampaign();
      if (data && data.status !== 'RUNNING') {
        clearInterval(pollRef.current);
      }
    }, 2_000);

    return () => clearInterval(pollRef.current);
  }, [fetchCampaign]);

  // ── Actions ──────────────────────────────────────────────────────────────

  async function stop() {
    setStopping(true);
    try {
      await fetch(`/api/campaigns/${id}/stop`, { method: 'POST' });
      toast.success('Arrêt en cours…');
    } finally {
      setStopping(false);
    }
  }

  async function start() {
    setStarting(true);
    try {
      const res = await fetch(`/api/campaigns/${id}/start`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Campagne démarrée !');
      // Re-start polling
      clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        const data = await fetchCampaign();
        if (data && data.status !== 'RUNNING') clearInterval(pollRef.current);
      }, 2_000);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setStarting(false);
    }
  }

  async function retryFailed() {
    if (!campaign) return;
    const failedPhones = campaign.logs
      .filter((l) => l.status === 'FAILED')
      .map((l) => l.phone);

    if (failedPhones.length === 0) {
      toast.error('Aucun numéro en échec');
      return;
    }

    setRetrying(true);
    try {
      // Create new campaign with failed phones
      const res = await fetch('/api/campaigns', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:             `Relance — ${campaign.name}`,
          message:          campaign.message,
          source:           'IMPORTED',
          phones:           failedPhones,
          baseDelaySeconds: campaign.baseDelaySeconds,
        }),
      });
      if (!res.ok) throw new Error('Erreur création');
      const newCampaign = await res.json();

      // Auto-start it
      await fetch(`/api/campaigns/${newCampaign.id}/start`, { method: 'POST' });
      toast.success(`Relance créée — ${failedPhones.length} numéros`);
      router.push(`/campaigns/${newCampaign.id}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setRetrying(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3">
        <Loader2 size={20} className="animate-spin" style={{ color: 'var(--blue)' }} />
        <span className="text-sm" style={{ color: 'var(--gray-400)' }}>Chargement…</span>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center py-16">
        <p style={{ color: 'var(--gray-400)' }}>Campagne introuvable</p>
        <button onClick={() => router.push('/campaigns')} className="mt-3 text-sm font-semibold"
          style={{ color: 'var(--blue)' }}>
          ← Retour
        </button>
      </div>
    );
  }

  const done      = campaign.totalSent + campaign.totalFailed;
  const remaining = Math.max(0, campaign.totalTargets - done);
  const pct       = campaign.totalTargets > 0 ? Math.round((done / campaign.totalTargets) * 100) : 0;
  const successRate = done > 0 ? ((campaign.totalSent / done) * 100).toFixed(1) : '—';

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => router.push('/campaigns')}
          className="p-2 rounded-xl transition-colors hover:bg-gray-100"
          style={{ color: 'var(--gray-400)' }}>
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-extrabold truncate" style={{ fontSize: 22, color: 'var(--navy)', letterSpacing: '-0.4px' }}>
              {campaign.name}
            </h1>
            {statusBadge(campaign.status)}
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--gray-400)' }}>
            Créée le {format(new Date(campaign.createdAt), 'dd MMMM yyyy à HH:mm', { locale: fr })}
            {' · '}
            Délai : {campaign.baseDelaySeconds}s
            {' · '}
            Source : {campaign.source === 'DB_CLIENTS' ? 'Clients DB' : 'Importée'}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {campaign.status === 'RUNNING' && (
            <button
              onClick={stop}
              disabled={stopping}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95"
              style={{ background: 'rgba(185,28,28,0.08)', color: 'var(--red)', border: '1.5px solid rgba(185,28,28,0.2)' }}
            >
              {stopping ? <Loader2 size={14} className="animate-spin" /> : <Square size={14} />}
              Arrêter
            </button>
          )}
          {(campaign.status === 'DRAFT' || campaign.status === 'STOPPED') && (
            <button
              onClick={start}
              disabled={starting}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95"
              style={{ background: 'var(--navy)', color: 'white', boxShadow: '0 2px 8px rgba(10,22,40,0.2)' }}
            >
              {starting ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              Démarrer
            </button>
          )}
          {(campaign.status === 'DONE' || campaign.status === 'STOPPED') && campaign.totalFailed > 0 && (
            <button
              onClick={retryFailed}
              disabled={retrying}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95"
              style={{ background: 'rgba(192,92,0,0.08)', color: 'var(--orange)', border: '1.5px solid rgba(192,92,0,0.2)' }}
            >
              {retrying ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
              Relancer les échoués ({campaign.totalFailed})
            </button>
          )}
        </div>
      </div>

      {/* ── Progress bar ───────────────────────────────────────────────────── */}
      {campaign.totalTargets > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold" style={{ color: 'var(--navy)' }}>
              Progression {campaign.status === 'RUNNING' && (
                <Loader2 size={12} className="animate-spin inline ml-1" style={{ color: 'var(--blue)' }} />
              )}
            </p>
            <p className="font-extrabold text-sm" style={{ color: 'var(--navy)' }}>
              {pct}%
            </p>
          </div>
          <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--gray-50)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                background: campaign.totalFailed === 0
                  ? 'var(--teal)'
                  : 'linear-gradient(90deg, var(--teal) 0%, var(--orange) 100%)',
              }}
            />
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--gray-400)' }}>
            {done} / {campaign.totalTargets} traités
            {remaining > 0 && ` — ${remaining} restants`}
          </p>
        </div>
      )}

      {/* ── KPI cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            icon: <CheckCircle2 size={15} />,
            label: 'Envoyés',
            value: campaign.totalSent,
            accent: 'var(--teal)',
            bg:     'rgba(0,180,166,0.08)',
          },
          {
            icon: <XCircle size={15} />,
            label: 'Échoués',
            value: campaign.totalFailed,
            accent: campaign.totalFailed > 0 ? 'var(--orange)' : 'var(--gray-400)',
            bg:     campaign.totalFailed > 0 ? 'rgba(192,92,0,0.08)' : 'var(--gray-50)',
          },
          {
            icon: <Clock size={15} />,
            label: 'Restants',
            value: remaining,
            accent: 'var(--blue)',
            bg:     'rgba(46,109,180,0.08)',
          },
          {
            icon: <TrendingUp size={15} />,
            label: 'Taux succès',
            value: `${successRate}%`,
            accent: 'var(--navy)',
            bg:     'rgba(10,22,40,0.06)',
          },
        ].map(({ icon, label, value, accent, bg }) => (
          <div key={label} className="card p-4" style={{ borderLeft: `3px solid ${accent}` }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--gray-400)' }}>
                {label}
              </p>
              <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: bg, color: accent }}>
                {icon}
              </span>
            </div>
            <p className="font-extrabold" style={{ fontSize: 'clamp(18px, 4vw, 26px)', color: 'var(--navy)', letterSpacing: '-0.5px' }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Message preview ────────────────────────────────────────────────── */}
      <div className="card p-5">
        <p className="label mb-3">Message envoyé</p>
        <div className="rounded-2xl p-4 text-sm whitespace-pre-wrap max-w-sm"
          style={{
            background:   'rgba(37,211,102,0.08)',
            border:       '1px solid rgba(37,211,102,0.15)',
            color:        'var(--navy)',
            fontFamily:   'inherit',
            lineHeight:   1.6,
          }}>
          {campaign.message}
        </div>
      </div>

      {/* ── Real-time log ──────────────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--gray-50)' }}>
          <p className="font-bold text-sm" style={{ color: 'var(--navy)' }}>
            Journal d&apos;envoi
            {campaign.status === 'RUNNING' && (
              <span className="ml-2 text-xs font-normal" style={{ color: 'var(--blue)' }}>
                mise à jour automatique
              </span>
            )}
          </p>
          <p className="text-xs" style={{ color: 'var(--gray-400)' }}>
            {campaign.logs.length} entrée{campaign.logs.length !== 1 ? 's' : ''}
          </p>
        </div>

        {campaign.logs.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <p className="text-sm" style={{ color: 'var(--gray-400)' }}>
              {campaign.status === 'DRAFT' ? "Démarrez la campagne pour voir les envois" : "Aucun envoi enregistré"}
            </p>
          </div>
        ) : (
          <div>
            {campaign.logs.map((log) => (
              <div
                key={log.id}
                className="px-5 py-3 flex items-center gap-4 border-b last:border-0"
                style={{ borderColor: 'var(--gray-50)' }}
              >
                {log.status === 'SENT' ? (
                  <CheckCircle2 size={14} style={{ color: 'var(--teal)', flexShrink: 0 }} />
                ) : (
                  <XCircle size={14} style={{ color: 'var(--orange)', flexShrink: 0 }} />
                )}
                <p className="font-mono text-xs flex-1 truncate" style={{ color: 'var(--navy)' }}>
                  {log.phone}
                </p>
                {log.error && (
                  <p className="text-[11px] truncate max-w-[200px]" style={{ color: 'var(--orange)' }}>
                    {log.error}
                  </p>
                )}
                <p className="text-[11px] flex-shrink-0" style={{ color: 'var(--gray-400)' }}>
                  {format(new Date(log.sentAt), 'HH:mm:ss', { locale: fr })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

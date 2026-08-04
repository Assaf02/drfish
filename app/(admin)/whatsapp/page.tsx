'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Wifi, WifiOff, Loader2, CheckCircle2, QrCode, RefreshCw, X,
} from 'lucide-react';

type Phase = 'checking' | 'idle' | 'connecting' | 'qr' | 'success' | 'failed';

const QR_WINDOW_SECONDS = 7;
const MAX_ATTEMPTS = 6;

export default function WhatsAppPage() {
  const router = useRouter();
  const [phase, setPhase]       = useState<Phase>('checking');
  const [qrImage, setQrImage]   = useState<string | null>(null);
  const [countdown, setCountdown] = useState(QR_WINDOW_SECONDS);
  const [attempts, setAttempts] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

  const esRef       = useRef<EventSource | null>(null);
  const cntdwnRef   = useRef<ReturnType<typeof setInterval>>();
  const pollRef     = useRef<ReturnType<typeof setInterval>>();
  const retryRef    = useRef<ReturnType<typeof setTimeout>>();
  const activeRef   = useRef(false);

  useEffect(() => {
    checkStatus();
    return () => cleanup();
  }, []);

  function cleanup() {
    activeRef.current = false;
    esRef.current?.close();
    esRef.current = null;
    clearInterval(cntdwnRef.current);
    clearInterval(pollRef.current);
    clearTimeout(retryRef.current);
  }

  async function checkStatus() {
    try {
      const res  = await fetch('/api/whatsapp/status', { cache: 'no-store' });
      const data = await res.json() as { connected: boolean };
      setPhase(data.connected ? 'success' : 'idle');
    } catch {
      setPhase('idle');
    }
  }

  function startQr(attempt = 0) {
    cleanup();
    activeRef.current = true;
    setAttempts(attempt);
    setPhase('connecting');
    setQrImage(null);

    const es = new EventSource('/api/whatsapp/qr');
    esRef.current = es;

    let secondsLeft = QR_WINDOW_SECONDS;

    es.onmessage = (e) => {
      if (!activeRef.current) return;
      try {
        const msg = JSON.parse(e.data as string) as { type: string; qrDataUrl?: string };

        if (msg.type === 'qr') {
          setQrImage(msg.qrDataUrl ?? null);
          setPhase('qr');
          secondsLeft = QR_WINDOW_SECONDS;
          setCountdown(secondsLeft);

          clearInterval(cntdwnRef.current);
          cntdwnRef.current = setInterval(() => {
            secondsLeft = Math.max(0, secondsLeft - 1);
            setCountdown(secondsLeft);
          }, 1_000);

          // Poll status every 2s — catches scan even if SSE closes before 'open' event
          clearInterval(pollRef.current);
          pollRef.current = setInterval(async () => {
            if (!activeRef.current) return;
            try {
              const res  = await fetch('/api/whatsapp/status', { cache: 'no-store' });
              const data = await res.json() as { connected: boolean };
              if (data.connected) {
                cleanup();
                setPhase('success');
              }
            } catch { /* ignore */ }
          }, 2_000);
        }

        if (msg.type === 'connected') {
          cleanup();
          setPhase('success');
        }

        if (msg.type === 'disconnected' || msg.type === 'error') {
          const errMsg = (msg as { type: string; message?: string; loggedOut?: boolean }).message
            ?? (msg.type === 'disconnected' ? 'WA a fermé la connexion' : 'Erreur serveur');
          setLastError(errMsg);
          clearInterval(cntdwnRef.current);
          clearInterval(pollRef.current);
          es.close();
          scheduleRetry(attempt);
        }
      } catch { /* ignore bad JSON */ }
    };

    es.onerror = () => {
      setLastError('Connexion SSE échouée (auth ou réseau)');
      clearInterval(cntdwnRef.current);
      clearInterval(pollRef.current);
      es.close();
      esRef.current = null;
      scheduleRetry(attempt);
    };
  }

  function scheduleRetry(attempt: number) {
    if (!activeRef.current) return;
    if (attempt >= MAX_ATTEMPTS - 1) {
      setPhase('failed');
      return;
    }
    // Brief pause then auto-retry
    retryRef.current = setTimeout(() => {
      if (activeRef.current) startQr(attempt + 1);
    }, 600);
  }

  function cancel() {
    cleanup();
    setPhase('idle');
    setQrImage(null);
  }

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-fade-in">

      {/* ── Title ─────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="font-extrabold" style={{ fontSize: 26, color: 'var(--navy)', letterSpacing: '-0.5px' }}>
          Connexion WhatsApp
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--gray-400)' }}>
          Liez votre numéro WhatsApp pour envoyer des campagnes depuis le CRM
        </p>
      </div>

      {/* ── Checking ──────────────────────────────────────────────────────── */}
      {phase === 'checking' && (
        <div className="card p-8 flex items-center justify-center gap-3">
          <Loader2 size={18} className="animate-spin" style={{ color: 'var(--blue)' }} />
          <span className="text-sm" style={{ color: 'var(--gray-400)' }}>Vérification du statut…</span>
        </div>
      )}

      {/* ── Success ───────────────────────────────────────────────────────── */}
      {phase === 'success' && (
        <div className="card p-8 flex flex-col items-center gap-5 text-center">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center"
            style={{ background: 'rgba(22,163,74,0.08)' }}>
            <CheckCircle2 size={36} style={{ color: '#16a34a' }} />
          </div>
          <div>
            <p className="font-bold text-xl" style={{ color: 'var(--navy)' }}>WhatsApp connecté !</p>
            <p className="text-sm mt-1.5" style={{ color: 'var(--gray-400)' }}>
              Votre numéro est lié. Vous pouvez maintenant envoyer des campagnes.
            </p>
          </div>
          <div className="flex gap-3 w-full max-w-xs">
            <button
              onClick={() => router.push('/campaigns')}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all active:scale-95"
              style={{ background: 'var(--navy)' }}
            >
              Campagnes →
            </button>
            <button
              onClick={() => { setPhase('idle'); }}
              className="px-4 py-3 rounded-xl text-sm font-semibold transition-all"
              style={{ background: 'var(--gray-50)', color: 'var(--gray-400)' }}
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── Idle / Failed ─────────────────────────────────────────────────── */}
      {(phase === 'idle' || phase === 'failed') && (
        <div className="card p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(220,38,38,0.08)' }}>
              <WifiOff size={18} style={{ color: '#dc2626' }} />
            </div>
            <div>
              <p className="font-semibold" style={{ color: '#b91c1c' }}>WhatsApp non connecté</p>
              <p className="text-xs" style={{ color: 'var(--gray-400)' }}>
                Suivez les étapes ci-dessous pour lier votre compte
              </p>
            </div>
          </div>

          {/* Pre-scan instructions */}
          <div className="rounded-xl p-4 space-y-2.5"
            style={{ background: 'rgba(46,109,180,0.04)', border: '1px solid rgba(46,109,180,0.1)' }}>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--blue)' }}>
              Préparez votre téléphone avant de cliquer :
            </p>
            {[
              'Ouvrez WhatsApp sur votre téléphone',
              'Appuyez sur Menu (⋮ ou ⚙) → Appareils liés',
              'Appuyez sur "Lier un appareil"',
              'Gardez la caméra ouverte et prête',
            ].map((step, i) => (
              <div key={step} className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
                  style={{ background: 'var(--blue)', color: 'white' }}>
                  {i + 1}
                </span>
                <p className="text-sm" style={{ color: 'var(--navy)' }}>{step}</p>
              </div>
            ))}
          </div>

          {phase === 'failed' && (
            <div className="rounded-xl p-3 text-xs"
              style={{ background: 'rgba(192,92,0,0.06)', color: 'var(--orange)', border: '1px solid rgba(192,92,0,0.15)' }}>
              Scan non détecté après plusieurs tentatives. Assurez-vous que WhatsApp est ouvert à
              l&apos;étape &quot;Lier un appareil&quot; et scannez dès que le QR apparaît.
            </div>
          )}

          <button
            onClick={() => startQr(0)}
            className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            style={{ background: 'var(--navy)', color: 'white' }}
          >
            <QrCode size={16} />
            {phase === 'failed' ? 'Réessayer' : 'Générer le QR code'}
          </button>
        </div>
      )}

      {/* ── Connecting / QR ───────────────────────────────────────────────── */}
      {(phase === 'connecting' || phase === 'qr') && (
        <div className="card p-6 space-y-5">
          <div className="flex items-center justify-between">
            <p className="font-bold" style={{ color: 'var(--navy)' }}>
              {phase === 'connecting' ? 'Connexion en cours…' : 'Scannez maintenant !'}
            </p>
            <button
              onClick={cancel}
              className="p-2 rounded-xl transition-colors hover:bg-gray-100"
              style={{ color: 'var(--gray-400)' }}
            >
              <X size={14} />
            </button>
          </div>

          <div className="flex gap-5 items-start">
            {/* QR or spinner */}
            <div className="relative flex-shrink-0">
              {phase === 'connecting' ? (
                <div className="w-44 h-44 rounded-2xl flex flex-col items-center justify-center gap-2"
                  style={{ border: '2px dashed rgba(46,109,180,0.2)', background: 'rgba(46,109,180,0.02)' }}>
                  <Loader2 size={28} className="animate-spin" style={{ color: 'var(--blue)', opacity: 0.5 }} />
                  <p className="text-[11px]" style={{ color: 'var(--gray-400)' }}>
                    2-3 secondes…
                  </p>
                </div>
              ) : (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrImage!}
                    alt="QR WhatsApp"
                    className="w-44 h-44 rounded-2xl"
                    style={{ border: '1.5px solid rgba(46,109,180,0.15)' }}
                  />
                  {/* Countdown badge */}
                  <div
                    className="absolute -top-2.5 -right-2.5 w-10 h-10 rounded-xl flex items-center justify-center text-base font-extrabold text-white shadow"
                    style={{ background: countdown <= 2 ? '#dc2626' : 'var(--teal)', transition: 'background 0.3s' }}
                  >
                    {countdown}
                  </div>
                </>
              )}
            </div>

            {/* Instructions */}
            <div className="flex-1 text-sm space-y-3">
              {phase === 'connecting' ? (
                <>
                  <p style={{ color: 'var(--gray-400)' }}>
                    Connexion à WhatsApp… Le QR code va apparaître.
                  </p>
                  <p className="font-semibold" style={{ color: 'var(--navy)' }}>
                    Préparez votre caméra !
                  </p>
                  {lastError && (
                    <p className="text-[11px] px-2 py-1.5 rounded-lg break-all"
                      style={{ background: 'rgba(220,38,38,0.06)', color: '#b91c1c', border: '1px solid rgba(220,38,38,0.15)' }}>
                      {lastError}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="font-semibold" style={{ color: 'var(--navy)' }}>
                    Pointez la caméra sur ce QR
                  </p>
                  {/* Progress bar */}
                  <div className="space-y-1.5">
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--gray-50)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(countdown / QR_WINDOW_SECONDS) * 100}%`,
                          background: countdown <= 2 ? '#dc2626' : 'var(--teal)',
                          transition: 'width 1s linear, background 0.3s',
                        }}
                      />
                    </div>
                    <p className="text-xs" style={{ color: countdown <= 2 ? '#dc2626' : 'var(--gray-400)' }}>
                      {countdown}s restantes — scannez vite !
                    </p>
                  </div>
                  {attempts > 0 && (
                    <p className="text-xs px-2 py-1.5 rounded-lg"
                      style={{ background: 'rgba(46,109,180,0.06)', color: 'var(--blue)' }}>
                      Tentative {attempts + 1}/{MAX_ATTEMPTS} — nouveau QR automatique si vous ratez
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Reminder */}
          {phase === 'qr' && (
            <div className="rounded-xl p-3 text-xs"
              style={{ background: 'rgba(37,211,102,0.05)', border: '1px solid rgba(37,211,102,0.15)' }}>
              <p className="font-semibold mb-0.5" style={{ color: 'var(--navy)' }}>Rappel :</p>
              <p style={{ color: 'var(--gray-400)' }}>
                WhatsApp → Menu → Appareils liés → Lier un appareil → pointez sur le QR
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Footer note ───────────────────────────────────────────────────── */}
      {phase !== 'success' && phase !== 'checking' && (
        <p className="text-xs text-center" style={{ color: 'var(--gray-400)' }}>
          La connexion est valable jusqu&apos;à déconnexion manuelle depuis WhatsApp.
        </p>
      )}
    </div>
  );
}

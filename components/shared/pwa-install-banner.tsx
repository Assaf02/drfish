'use client';

import { useState, useEffect } from 'react';
import { X, Download, Share, Plus } from 'lucide-react';
import { FishIcon } from '@/components/icons/FishIcon';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function detectIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) &&
    !(window as { MSStream?: unknown }).MSStream;
}

function isInStandaloneMode() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (('standalone' in window.navigator) &&
      (window.navigator as { standalone?: boolean }).standalone === true)
  );
}

export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (isInStandaloneMode()) return;
    if (localStorage.getItem('pwa-banner-dismissed')) return;

    const ios = detectIOS();
    setIsIOS(ios);

    if (ios) {
      setTimeout(() => setShow(true), 2500);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShow(true), 2500);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShow(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem('pwa-banner-dismissed', 'true');
  };

  if (!show) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 animate-slide-up"
      style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
    >
      <div
        className="rounded-2xl p-4 max-w-lg mx-auto"
        style={{
          background: 'var(--navy)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
      >
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--blue)' }}>
            <FishIcon size={22} color="white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm leading-snug">
              Installer Dr Fish sur l&apos;écran d&apos;accueil
            </p>
            <p className="text-[12px] mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Accès instantané · Mode hors-ligne · Expérience native
            </p>
          </div>
          <button onClick={handleDismiss} aria-label="Fermer"
            className="p-1 flex-shrink-0 transition-colors"
            style={{ color: 'rgba(255,255,255,0.35)' }}>
            <X size={16} />
          </button>
        </div>

        {isIOS ? (
          /* ── iOS instructions ── */
          <div className="rounded-xl p-3 space-y-2.5"
            style={{ background: 'rgba(255,255,255,0.06)' }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: 'rgba(255,255,255,0.4)' }}>
              2 étapes dans Safari
            </p>
            {/* Step 1 */}
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(74,158,255,0.2)' }}>
                <span className="text-[11px] font-bold" style={{ color: 'var(--blue-light)' }}>1</span>
              </div>
              <div className="flex items-center gap-2 flex-1">
                <p className="text-white text-[13px]">Appuyez sur</p>
                {/* iOS share icon */}
                <div className="flex items-center justify-center w-7 h-7 rounded-md"
                  style={{ background: 'rgba(74,158,255,0.15)', border: '1px solid rgba(74,158,255,0.3)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M12 3v13M7 8l5-5 5 5" stroke="#4A9EFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" stroke="#4A9EFF" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
                <p className="text-white text-[13px]">dans la barre Safari</p>
              </div>
            </div>
            {/* Step 2 */}
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(74,158,255,0.2)' }}>
                <span className="text-[11px] font-bold" style={{ color: 'var(--blue-light)' }}>2</span>
              </div>
              <div className="flex items-center gap-2 flex-1 flex-wrap">
                <p className="text-white text-[13px]">Choisissez</p>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md"
                  style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}>
                  <Plus size={11} color="white" />
                  <span className="text-white text-[12px] font-medium">Sur l&apos;écran d&apos;accueil</span>
                </div>
              </div>
            </div>
            <button onClick={handleDismiss}
              className="w-full text-center py-2 rounded-xl text-[13px] font-medium transition-colors mt-1"
              style={{ color: 'rgba(255,255,255,0.4)' }}>
              Pas maintenant
            </button>
          </div>
        ) : (
          /* ── Android / Chrome ── */
          <div className="flex gap-2.5">
            <button onClick={handleInstall}
              className="flex-1 text-white font-semibold rounded-xl py-2.5 text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              style={{ background: 'var(--blue)', boxShadow: '0 4px 12px rgba(46,109,180,0.4)' }}>
              <Download size={15} />
              Installer
            </button>
            <button onClick={handleDismiss}
              className="flex-1 font-medium rounded-xl py-2.5 text-sm transition-all active:scale-[0.98]"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
              Plus tard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

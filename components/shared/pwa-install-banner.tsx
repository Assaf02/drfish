'use client';

import { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const dismissed = localStorage.getItem('pwa-banner-dismissed');
    if (dismissed) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowBanner(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // iOS Safari detection
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) && !(window as { MSStream?: unknown }).MSStream;
    const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator as { standalone?: boolean }).standalone;

    if (isIOS && !isInStandaloneMode) {
      setTimeout(() => setShowBanner(true), 3000);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowBanner(false);
        setDeferredPrompt(null);
      }
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('pwa-banner-dismissed', 'true');
  };

  if (!showBanner || isInstalled) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-slide-up">
      <div className="bg-navy rounded-2xl p-4 shadow-float border border-white/10 max-w-lg mx-auto">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 bg-royal rounded-xl flex items-center justify-center text-xl flex-shrink-0">
            🐟
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm leading-snug">
              Installez Dr Fish sur votre écran d&apos;accueil
            </p>
            <p className="text-white/50 text-xs mt-0.5">
              Accès rapide, mode hors-ligne et expérience app native
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="text-white/40 hover:text-white/70 transition-colors flex-shrink-0 p-1"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex gap-2.5 mt-3">
          <button
            onClick={handleInstall}
            className="flex-1 bg-royal text-white font-semibold rounded-xl py-2.5 text-sm flex items-center justify-center gap-2 hover:bg-royal-600 transition-colors active:scale-[0.98]"
          >
            <Download size={15} />
            Installer
          </button>
          <button
            onClick={handleDismiss}
            className="flex-1 bg-white/10 text-white/70 font-medium rounded-xl py-2.5 text-sm hover:bg-white/15 transition-colors active:scale-[0.98]"
          >
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
}

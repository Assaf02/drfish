'use client';

import { WifiOff, RefreshCw, Info } from 'lucide-react';
import { FishIcon } from '@/components/icons/FishIcon';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-navy flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-8 animate-pulse-slow"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <FishIcon size={40} color="rgba(255,255,255,0.6)" />
      </div>
      <h1 className="text-2xl font-bold text-white mb-3">Vous êtes hors ligne</h1>
      <p className="text-white/60 text-base leading-relaxed max-w-sm mb-8">
        Vérifiez votre connexion internet. Vos données locales sont sauvegardées et seront synchronisées automatiquement.
      </p>
      <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-5 py-2.5 text-sm text-white/70 mb-6">
        <WifiOff size={14} className="text-orange-400" />
        Aucune connexion détectée
      </div>
      <button
        onClick={() => window.location.reload()}
        className="bg-blue-600 text-white font-semibold rounded-xl px-8 py-3.5 text-base hover:bg-blue-500 transition-colors w-full max-w-[280px] flex items-center justify-center gap-2"
      >
        <RefreshCw size={18} />
        Réessayer
      </button>
      <div className="mt-8 flex items-start gap-2 text-sm text-white/40 max-w-xs text-left">
        <Info size={14} className="flex-shrink-0 mt-0.5" />
        <p>Les ventes enregistrées hors ligne seront synchronisées automatiquement dès que vous vous reconnectez.</p>
      </div>
    </div>
  );
}

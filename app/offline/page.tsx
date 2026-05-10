'use client';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-navy flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 bg-gradient-to-br from-royal to-royal-700 rounded-2xl flex items-center justify-center text-4xl mb-8">
        🐟
      </div>
      <h1 className="text-2xl font-bold text-white mb-3">Vous êtes hors ligne</h1>
      <p className="text-white/60 text-base leading-relaxed max-w-sm mb-8">
        Vérifiez votre connexion internet pour accéder à Dr Fish CRM. Vos données locales sont sauvegardées.
      </p>
      <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-5 py-2.5 text-sm text-white/70 mb-6">
        <span className="w-2 h-2 bg-warning rounded-full animate-pulse" />
        Aucune connexion détectée
      </div>
      <button
        onClick={() => window.location.reload()}
        className="bg-royal text-white font-semibold rounded-xl px-8 py-3.5 text-base hover:bg-royal-600 transition-colors w-full max-width-[280px]"
      >
        Réessayer
      </button>
      <p className="mt-8 text-sm text-white/40 max-w-xs leading-relaxed">
        💡 Les ventes enregistrées hors ligne seront synchronisées automatiquement dès que vous vous reconnectez.
      </p>
    </div>
  );
}

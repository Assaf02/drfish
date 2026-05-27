'use client';

import { useState, FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Loader2, Lock, User } from 'lucide-react';
import { FishIcon } from '@/components/icons/FishIcon';

export default function PartnerLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await signIn('partner', {
      username: username.trim().toLowerCase(),
      code: code.trim().toUpperCase(),
      redirect: false,
    });

    setLoading(false);
    if (res?.ok) {
      router.push('/partner/dashboard');
    } else {
      setError('Identifiants incorrects ou compte inactif');
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: 'linear-gradient(160deg, var(--navy) 0%, #1a3a5c 100%)' }}
    >
      {/* Card */}
      <div
        className="w-full max-w-sm rounded-3xl p-8"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <FishIcon size={32} color="white" />
          </div>
          <h1
            className="font-extrabold text-white text-center"
            style={{ fontSize: 22, letterSpacing: '-0.5px' }}
          >
            Dr Fish CRM
          </h1>
          <p className="text-sm mt-1 text-center" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Portail partenaires
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5"
              style={{ color: 'rgba(255,255,255,0.45)' }}>
              Nom d&apos;utilisateur
            </label>
            <div className="relative">
              <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2"
                style={{ color: 'rgba(255,255,255,0.35)' }} />
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="kofi.mensah"
                className="w-full pl-9 pr-4 py-3 rounded-xl text-sm font-medium outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'white',
                }}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(46,109,180,0.6)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.12)'; }}
              />
            </div>
          </div>

          {/* Code */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5"
              style={{ color: 'rgba(255,255,255,0.45)' }}>
              Code de parrainage
            </label>
            <div className="relative">
              <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2"
                style={{ color: 'rgba(255,255,255,0.35)' }} />
              <input
                type="text"
                autoComplete="off"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                required
                placeholder="DRFISH-KOFI-2026"
                className="w-full pl-9 pr-4 py-3 rounded-xl text-sm font-mono tracking-wider outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'white',
                }}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(46,109,180,0.6)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.12)'; }}
              />
            </div>
          </div>

          {error && (
            <p className="text-xs font-medium text-center py-2 rounded-xl"
              style={{ background: 'rgba(220,38,38,0.12)', color: '#fca5a5' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !username || !code}
            className="w-full py-3.5 rounded-xl font-bold text-white text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-2"
            style={{
              background: loading || !username || !code ? 'rgba(255,255,255,0.12)' : 'var(--blue)',
              boxShadow: !loading && username && code ? '0 4px 20px rgba(46,109,180,0.4)' : 'none',
            }}
          >
            {loading ? <><Loader2 size={16} className="animate-spin" /> Connexion...</> : 'Se connecter'}
          </button>
        </form>

        <p className="text-center text-[11px] mt-6" style={{ color: 'rgba(255,255,255,0.25)' }}>
          Contactez l&apos;administrateur pour obtenir vos accès
        </p>
      </div>
    </div>
  );
}

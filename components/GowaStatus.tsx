'use client';

import { useEffect, useState } from 'react';

type Status = 'loading' | 'connected' | 'disconnected' | 'unreachable';

export function GowaStatusDot() {
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    let mounted = true;

    async function check() {
      try {
        const res  = await fetch('/api/whatsapp/status', { cache: 'no-store' });
        const data = await res.json();
        if (!mounted) return;
        if (data.unreachable) setStatus('unreachable');
        else setStatus(data.connected ? 'connected' : 'disconnected');
      } catch {
        if (mounted) setStatus('unreachable');
      }
    }

    check();
    const id = setInterval(check, 30_000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  if (status === 'loading') return null;

  const color =
    status === 'connected'    ? '#4ade80' :
    status === 'disconnected' ? '#f97316' :
    '#ef4444';

  return (
    <span
      className="w-2 h-2 rounded-full flex-shrink-0"
      style={{
        background:  color,
        boxShadow:   status === 'connected' ? `0 0 6px ${color}` : 'none',
      }}
      title={
        status === 'connected'    ? 'WhatsApp connecté' :
        status === 'disconnected' ? 'WhatsApp déconnecté' :
        'Green API injoignable'
      }
    />
  );
}

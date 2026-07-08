import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const GOWA_URL       = process.env.GOWA_URL        ?? '';
const GOWA_DEVICE_ID = process.env.GOWA_DEVICE_ID ?? 'drfish';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!GOWA_URL)
    return NextResponse.json({ connected: false, unreachable: true, reason: 'not_configured' });

  try {
    // GET /devices lists all devices without requiring device_id
    const res = await fetch(`${GOWA_URL}/devices`, {
      signal: AbortSignal.timeout(5_000),
      cache:  'no-store',
    });

    if (!res.ok) return NextResponse.json({ connected: false, unreachable: false });

    const data    = await res.json();
    const devices = Array.isArray(data?.results) ? data.results : [];
    const device  = devices.find((d: { id?: string; device?: string; state?: string }) =>
      (d.id ?? d.device) === GOWA_DEVICE_ID
    );

    const connected = device?.state === 'logged_in';
    return NextResponse.json({ connected, unreachable: false, deviceState: device?.state ?? null });
  } catch {
    return NextResponse.json({ connected: false, unreachable: true });
  }
}

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const GOWA_URL = process.env.GOWA_URL ?? 'http://localhost:3000';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const res = await fetch(`${GOWA_URL}/app/devices`, {
      signal: AbortSignal.timeout(5_000),
      cache:  'no-store',
    });

    if (!res.ok) return NextResponse.json({ connected: false, unreachable: false });

    const data = await res.json();
    // GoWA v4/v5: { results: Device[] }
    const devices = Array.isArray(data?.results) ? data.results : [];
    return NextResponse.json({ connected: devices.length > 0, devices });
  } catch {
    return NextResponse.json({ connected: false, unreachable: true });
  }
}

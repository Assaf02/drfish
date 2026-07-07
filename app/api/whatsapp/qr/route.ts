import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const GOWA_URL = process.env.GOWA_URL ?? '';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!GOWA_URL)
    return NextResponse.json({ error: 'GOWA_URL non configurée' }, { status: 503 });

  try {
    const res = await fetch(`${GOWA_URL}/app/login`, {
      signal: AbortSignal.timeout(10_000),
      cache:  'no-store',
    });

    if (!res.ok)
      return NextResponse.json({ error: 'GoWA indisponible' }, { status: 502 });

    const data = await res.json();
    // GoWA: { results: { qr_link, qr_data, qr_image, qr_duration } }
    const qrImage = data?.results?.qr_image ?? data?.qr_image ?? null;
    return NextResponse.json({ qrImage });
  } catch {
    return NextResponse.json({ error: 'GoWA injoignable' }, { status: 502 });
  }
}

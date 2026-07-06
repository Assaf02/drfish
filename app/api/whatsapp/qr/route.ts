import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const GREEN_API_URL      = process.env.GREEN_API_URL       ?? '';
const GREEN_API_INSTANCE = process.env.GREEN_API_INSTANCE_ID ?? '';
const GREEN_API_TOKEN    = process.env.GREEN_API_TOKEN      ?? '';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!GREEN_API_URL || !GREEN_API_INSTANCE || !GREEN_API_TOKEN)
    return NextResponse.json({ error: 'Green API non configurée' }, { status: 503 });

  try {
    const res = await fetch(
      `${GREEN_API_URL}/waInstance${GREEN_API_INSTANCE}/qr/${GREEN_API_TOKEN}`,
      { signal: AbortSignal.timeout(10_000), cache: 'no-store' },
    );

    if (!res.ok)
      return NextResponse.json({ error: 'QR indisponible' }, { status: 502 });

    const contentType = res.headers.get('content-type') ?? '';

    if (contentType.includes('image/')) {
      // Binary PNG → data URL
      const buffer = await res.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      return NextResponse.json({ qrImage: `data:image/png;base64,${base64}` });
    }

    // Green API JSON: { type: "qrCode", message: "<base64>" }
    const data = await res.json();
    const b64  = data?.message ?? data?.qr ?? data?.qrCode ?? null;
    if (b64) {
      return NextResponse.json({ qrImage: `data:image/png;base64,${b64}` });
    }

    return NextResponse.json({ error: 'Format QR inconnu' }, { status: 502 });
  } catch {
    return NextResponse.json({ error: 'Green API injoignable' }, { status: 502 });
  }
}

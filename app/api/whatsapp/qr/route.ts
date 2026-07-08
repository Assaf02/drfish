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
    return NextResponse.json({ error: 'GOWA_URL non configurée' }, { status: 503 });

  try {
    // Ensure device exists — create if missing
    await ensureDevice();

    const res = await fetch(`${GOWA_URL}/app/login?device_id=${GOWA_DEVICE_ID}`, {
      signal: AbortSignal.timeout(10_000),
      cache:  'no-store',
    });

    if (!res.ok)
      return NextResponse.json({ error: 'GoWA indisponible' }, { status: 502 });

    const data    = await res.json();
    const results = data?.results ?? data ?? {};

    // qr_image = base64 (older versions) | qr_link = URL to PNG (v8+)
    if (results.qr_image) {
      const qrImage = results.qr_image.startsWith('data:')
        ? results.qr_image
        : `data:image/png;base64,${results.qr_image}`;
      return NextResponse.json({ qrImage });
    }

    if (results.qr_link) {
      // Fetch the PNG server-side and convert to data URL (avoids mixed-content issues)
      const imgUrl = (results.qr_link as string).replace(/^http:\/\//, 'https://');
      try {
        const imgRes = await fetch(imgUrl, { signal: AbortSignal.timeout(10_000) });
        if (imgRes.ok) {
          const buf    = await imgRes.arrayBuffer();
          const b64    = Buffer.from(buf).toString('base64');
          const mime   = imgRes.headers.get('content-type') ?? 'image/png';
          return NextResponse.json({ qrImage: `data:${mime};base64,${b64}` });
        }
      } catch { /* fall through */ }
      // Fallback: return the URL directly (HTTPS)
      return NextResponse.json({ qrImage: imgUrl });
    }

    return NextResponse.json({ qrImage: null });
  } catch {
    return NextResponse.json({ error: 'GoWA injoignable' }, { status: 502 });
  }
}

async function ensureDevice() {
  try {
    const listRes = await fetch(`${GOWA_URL}/devices`, { signal: AbortSignal.timeout(5_000), cache: 'no-store' });
    if (!listRes.ok) return;
    const data    = await listRes.json();
    const devices = Array.isArray(data?.results) ? data.results : [];
    const exists  = devices.some((d: { id?: string; device?: string }) =>
      (d.id ?? d.device) === GOWA_DEVICE_ID
    );
    if (!exists) {
      await fetch(`${GOWA_URL}/devices`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ device_id: GOWA_DEVICE_ID }),
        signal:  AbortSignal.timeout(5_000),
      });
    }
  } catch { /* ignore */ }
}

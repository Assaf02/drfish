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
    return NextResponse.json({ connected: false, unreachable: true, reason: 'not_configured' });

  try {
    const res = await fetch(
      `${GREEN_API_URL}/waInstance${GREEN_API_INSTANCE}/getStateInstance/${GREEN_API_TOKEN}`,
      { signal: AbortSignal.timeout(5_000), cache: 'no-store' },
    );

    if (!res.ok) return NextResponse.json({ connected: false, unreachable: false });

    const data = await res.json();
    const connected = data?.stateInstance === 'authorized';
    return NextResponse.json({ connected, unreachable: false, stateInstance: data?.stateInstance });
  } catch {
    return NextResponse.json({ connected: false, unreachable: true });
  }
}

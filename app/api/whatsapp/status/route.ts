import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const waSession = await prisma.whatsAppSession.findUnique({ where: { id: 'singleton' } });

    // If no session at all, clearly disconnected
    if (!waSession?.creds) {
      return NextResponse.json({ connected: false, unreachable: false });
    }

    // If creds exist, we consider WhatsApp as "ready" (credentials stored = previously connected)
    // The real check happens at send time
    const creds = waSession.creds as Record<string, unknown>;
    const connected = !!(creds?.me || creds?.account || creds?.registered);

    return NextResponse.json({ connected, unreachable: false });
  } catch {
    return NextResponse.json({ connected: false, unreachable: false });
  }
}

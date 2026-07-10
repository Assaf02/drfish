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
    if (!waSession?.creds) {
      return NextResponse.json({ connected: false, unreachable: false });
    }
    const creds = waSession.creds as Record<string, unknown>;
    // "me" is set after a successful QR scan
    const connected = !!(creds?.me);
    return NextResponse.json({ connected, unreachable: false });
  } catch {
    return NextResponse.json({ connected: false, unreachable: false });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { days } = await req.json() as { days: number };

  if (!days || days < 1)
    return NextResponse.json({ error: 'Paramètre days invalide' }, { status: 400 });

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const { count } = await prisma.campaignLog.deleteMany({
    where: { sentAt: { lt: cutoff } },
  });

  return NextResponse.json({ deleted: count, before: cutoff.toISOString() });
}

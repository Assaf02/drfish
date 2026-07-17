import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const campaign = await prisma.campaign.findUnique({
    where: { id: params.id },
    include: {
      logs: {
        orderBy: { sentAt: 'desc' },
        take: 100,
      },
    },
  });

  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(campaign);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.dailyLimit       !== undefined) data.dailyLimit       = Number(body.dailyLimit);
  if (body.baseDelaySeconds !== undefined) data.baseDelaySeconds = Number(body.baseDelaySeconds);
  if (body.name             !== undefined) data.name             = String(body.name);

  // If campaign was stopped due to daily limit, reset it to STOPPED so it can be resumed
  if (body.dailyLimit !== undefined) {
    const current = await prisma.campaign.findUnique({ where: { id: params.id }, select: { stopReason: true } });
    if (current?.stopReason === 'DAILY_LIMIT') data.stopReason = null;
  }

  const updated = await prisma.campaign.update({ where: { id: params.id }, data });
  return NextResponse.json(updated);
}

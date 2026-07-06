import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendCampaign } from '@/lib/campaignRunner';

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const campaign = await prisma.campaign.findUnique({ where: { id: params.id } });
  if (!campaign)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (campaign.status === 'RUNNING')
    return NextResponse.json({ error: 'Already running' }, { status: 409 });

  // Fire and forget — responds immediately
  sendCampaign(params.id).catch((err) =>
    console.error('[campaignRunner]', err),
  );

  return NextResponse.json({ success: true });
}

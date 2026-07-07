import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { stopCampaign } from '@/lib/campaignRunner';

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // DB update — detected by the runner loop even across different processes
  await prisma.campaign.update({
    where: { id: params.id },
    data:  { status: 'STOPPED', stopReason: 'MANUAL' },
  });

  // In-memory flag — fast path if runner is in the same process
  stopCampaign(params.id);

  return NextResponse.json({ success: true });
}

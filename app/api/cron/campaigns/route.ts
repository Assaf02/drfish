import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendCampaign } from '@/lib/campaignRunner';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Vercel Cron sends x-vercel-cron: 1 + Authorization: Bearer {CRON_SECRET}
  const cronHeader = req.headers.get('x-vercel-cron');
  const authHeader = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;

  const authorized =
    cronHeader === '1' ||
    (secret && authHeader === `Bearer ${secret}`);

  if (!authorized)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date();

  const due = await prisma.campaign.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledAt: { lte: now },
    },
    select: { id: true, name: true },
  });

  for (const campaign of due) {
    sendCampaign(campaign.id).catch(console.error);
  }

  return NextResponse.json({ triggered: due.length, campaigns: due.map((c) => c.name), at: now.toISOString() });
}

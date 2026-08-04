import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createSchema = z.object({
  name:             z.string().min(1, 'Nom requis'),
  message:          z.string().min(1, 'Message requis'),
  baseDelaySeconds: z.number().min(8).default(12),
  source:           z.enum(['DB_CLIENTS', 'IMPORTED']),
  phones:           z.array(z.string()).default([]),
  mediaUrl:         z.string().url().optional().nullable(),
  scheduledAt:      z.string().datetime().optional().nullable(),
  dailyLimit:       z.number().min(10).max(1000).default(200),
  validateNumbers:  z.boolean().default(true),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // ?countClients=1 — quick count of clients with at least one sale
  if (req.nextUrl.searchParams.get('countClients') === '1') {
    const clientCount = await prisma.client.count({
      where: { phone: { not: null }, sales: { some: {} } },
    });
    return NextResponse.json({ clientCount });
  }

  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, name: true, status: true,
      totalSent: true, totalFailed: true, totalTargets: true,
      source: true, baseDelaySeconds: true, createdAt: true,
    },
  });

  return NextResponse.json(campaigns);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body   = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const scheduledAt = parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null;
  const isScheduled = scheduledAt && scheduledAt > new Date();

  try {
    const campaign = await prisma.campaign.create({
      data: {
        name:             parsed.data.name,
        message:          parsed.data.message,
        baseDelaySeconds: parsed.data.baseDelaySeconds,
        source:           parsed.data.source,
        phones:           parsed.data.phones,
        mediaUrl:         parsed.data.mediaUrl ?? null,
        scheduledAt:      scheduledAt,
        dailyLimit:       parsed.data.dailyLimit,
        validateNumbers:  parsed.data.validateNumbers,
        status:           isScheduled ? 'SCHEDULED' : 'DRAFT',
      },
    });
    return NextResponse.json(campaign, { status: 201 });
  } catch (err) {
    console.error('Campaign create error:', err);
    return NextResponse.json({ error: 'Erreur serveur lors de la création' }, { status: 500 });
  }
}

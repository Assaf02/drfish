import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const DEFAULTS = [
  {
    type: 'PAYMENT_REMINDER',
    delayDays: 7,
    message: 'Bonjour {nom}, nous vous rappelons que votre commande du {date} ({montant} FCFA) est en attente de paiement depuis {jours} jours. Merci de régulariser votre situation. — Dr Fish 🐟',
  },
  {
    type: 'INACTIVE_CLIENT',
    delayDays: 30,
    message: 'Bonjour {nom} ! Cela fait {jours} jours que vous n\'avez pas commandé chez Dr Fish. Revenez nous voir, nous avons du poisson frais qui vous attend ! 🐟',
  },
  {
    type: 'BIRTHDAY',
    delayDays: 0,
    message: 'Joyeux anniversaire {nom} ! 🎂 Toute l\'équipe Dr Fish vous souhaite une excellente journée et vous offre une réduction spéciale sur votre prochaine commande. 🐟',
  },
];

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Upsert defaults if missing
  await Promise.all(
    DEFAULTS.map((d) =>
      prisma.alertRule.upsert({
        where:  { type: d.type },
        create: { ...d, active: false },
        update: {},
      }),
    ),
  );

  const rules = await prisma.alertRule.findMany({ orderBy: { type: 'asc' } });
  return NextResponse.json(rules);
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { type: string; active?: boolean; delayDays?: number; message?: string };

  const data: Record<string, unknown> = {};
  if (body.active    !== undefined) data.active    = body.active;
  if (body.delayDays !== undefined) data.delayDays = Number(body.delayDays);
  if (body.message   !== undefined) data.message   = String(body.message);

  const rule = await prisma.alertRule.upsert({
    where:  { type: body.type },
    update: data,
    create: {
      type:      body.type,
      active:    (body.active    ?? false),
      delayDays: (body.delayDays ?? 7),
      message:   (body.message   ?? ''),
    },
  });

  return NextResponse.json(rule);
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { normalizePhone } from '@/lib/phoneUtils';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function fill(template: string, vars: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export async function GET(req: NextRequest) {
  const cronHeader = req.headers.get('x-vercel-cron');
  const authHeader = req.headers.get('authorization');
  const secret     = process.env.CRON_SECRET;
  const session    = await getServerSession(authOptions);
  const authorized =
    cronHeader === '1' ||
    (secret && authHeader === `Bearer ${secret}`) ||
    session?.user?.role === 'ADMIN';
  if (!authorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now      = new Date();
  const today    = now.toISOString().split('T')[0];
  const created: string[] = [];

  const rules = await prisma.alertRule.findMany({ where: { active: true } });

  for (const rule of rules) {
    const cutoff = new Date(now.getTime() - rule.delayDays * 86_400_000);

    // ── PAYMENT_REMINDER ───────────────────────────────────────────────────────
    if (rule.type === 'PAYMENT_REMINDER') {
      const sales = await prisma.sale.findMany({
        where: {
          paymentStatus: 'PENDING',
          date: { lt: cutoff },
          client: { phone: { not: null } },
        },
        include: { client: { select: { name: true, phone: true } } as const },
        orderBy: { date: 'asc' },
      });

      if (sales.length === 0) continue;

      // Already alerted today? Skip if a campaign was created today for this type.
      const existing = await prisma.campaign.findFirst({
        where: { name: { startsWith: `🔔 Rappel paiement - ${today}` } },
      });
      if (existing) continue;

      const phoneMessages: Record<string, string> = {};
      const phones: string[] = [];
      for (const sale of sales) {
        if (!sale.client) continue;
        const phone = normalizePhone(sale.client.phone!);
        if (!phone || phones.includes(phone)) continue;
        phones.push(phone);
        const jours = Math.floor((now.getTime() - new Date(sale.date).getTime()) / 86_400_000);
        phoneMessages[phone] = fill(rule.message, {
          nom:    sale.client.name,
          date:   fmtDate(new Date(sale.date)),
          montant: sale.totalAmount.toLocaleString('fr-FR'),
          jours:  String(jours),
        });
      }

      await prisma.campaign.create({
        data: {
          name:          `🔔 Rappel paiement - ${today}`,
          message:       rule.message,
          phoneMessages,
          phones,
          totalTargets:  phones.length,
          source:        'PHONES',
          status:        'DRAFT',
          baseDelaySeconds: 15,
        },
      });
      created.push(`PAYMENT_REMINDER (${phones.length} clients)`);
    }

    // ── INACTIVE_CLIENT ────────────────────────────────────────────────────────
    if (rule.type === 'INACTIVE_CLIENT') {
      // Clients whose most recent sale is older than cutoff
      const clients = await prisma.client.findMany({
        where: {
          phone: { not: null },
          sales: {
            none: { date: { gte: cutoff } },
            some: {},                          // has at least one sale ever
          },
        },
        include: {
          sales: { orderBy: { date: 'desc' }, take: 1, select: { date: true } },
        },
      });

      if (clients.length === 0) continue;

      const existing = await prisma.campaign.findFirst({
        where: { name: { startsWith: `💤 Clients inactifs - ${today}` } },
      });
      if (existing) continue;

      const phoneMessages: Record<string, string> = {};
      const phones: string[] = [];
      for (const client of clients) {
        const phone = normalizePhone(client.phone!);
        if (!phone || phones.includes(phone)) continue;
        phones.push(phone);
        const lastSale = client.sales[0]?.date ?? cutoff;
        const jours    = Math.floor((now.getTime() - new Date(lastSale).getTime()) / 86_400_000);
        phoneMessages[phone] = fill(rule.message, {
          nom:   client.name,
          jours: String(jours),
        });
      }

      await prisma.campaign.create({
        data: {
          name:          `💤 Clients inactifs - ${today}`,
          message:       rule.message,
          phoneMessages,
          phones,
          totalTargets:  phones.length,
          source:        'PHONES',
          status:        'DRAFT',
          baseDelaySeconds: 15,
        },
      });
      created.push(`INACTIVE_CLIENT (${phones.length} clients)`);
    }

    // ── BIRTHDAY ───────────────────────────────────────────────────────────────
    if (rule.type === 'BIRTHDAY') {
      const todayMD = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const clients = await prisma.client.findMany({
        where: { phone: { not: null }, birthDate: { not: null } },
        select: { name: true, phone: true, birthDate: true },
      });

      const birthdayClients = clients.filter((c) => {
        if (!c.birthDate) return false;
        const bd = new Date(c.birthDate);
        const md = `${String(bd.getMonth() + 1).padStart(2, '0')}-${String(bd.getDate()).padStart(2, '0')}`;
        return md === todayMD;
      });

      if (birthdayClients.length === 0) continue;

      const existing = await prisma.campaign.findFirst({
        where: { name: { startsWith: `🎂 Anniversaires - ${today}` } },
      });
      if (existing) continue;

      const phoneMessages: Record<string, string> = {};
      const phones: string[] = [];
      for (const client of birthdayClients) {
        const phone = normalizePhone(client.phone!);
        if (!phone || phones.includes(phone)) continue;
        phones.push(phone);
        phoneMessages[phone] = fill(rule.message, { nom: client.name });
      }

      await prisma.campaign.create({
        data: {
          name:          `🎂 Anniversaires - ${today}`,
          message:       rule.message,
          phoneMessages,
          phones,
          totalTargets:  phones.length,
          source:        'PHONES',
          status:        'DRAFT',
          baseDelaySeconds: 10,
        },
      });
      created.push(`BIRTHDAY (${phones.length} clients)`);
    }
  }

  return NextResponse.json({ created, at: now.toISOString() });
}

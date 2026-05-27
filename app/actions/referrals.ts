'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getDateRange } from '@/lib/utils';

const WA_NUMBER = '22990461241';

function buildWhatsAppLink(code: string): string {
  const text = encodeURIComponent(
    `Bonjour ! Je souhaite passer une commande. Code parrainage : ${code}`,
  );
  return `https://wa.me/${WA_NUMBER}?text=${text}`;
}

function generateCode(name: string): string {
  const year = new Date().getFullYear();
  const slug = name
    .split(' ')[0]
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z]/g, '')
    .slice(0, 6);
  return `DRFISH-${slug}-${year}`;
}

function generateUsername(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9.]/g, '');
}

const createSchema = z.object({
  name: z.string().min(2),
  username: z.string().min(2),
  code: z.string().min(4),
  commissionWithService: z.number().min(0).max(100),
  commissionNoService: z.number().min(0).max(100),
  status: z.boolean(),
  notes: z.string().optional().nullable(),
});

export async function suggestReferralDefaults(name: string) {
  const base = generateCode(name);
  const username = generateUsername(name);

  // Make code unique if collision
  let code = base;
  let attempt = 0;
  while (await prisma.referralCode.findUnique({ where: { code } })) {
    attempt++;
    code = `${base}-${attempt}`;
  }

  return { code, username };
}

export async function createReferralCode(data: z.infer<typeof createSchema>) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') throw new Error('Unauthorized');

  const validated = createSchema.parse(data);
  const whatsappLink = buildWhatsAppLink(validated.code);

  const ref = await prisma.referralCode.create({
    data: {
      code: validated.code,
      name: validated.name,
      username: validated.username,
      commissionWithService: validated.commissionWithService,
      commissionNoService: validated.commissionNoService,
      status: validated.status,
      notes: validated.notes,
      whatsappLink,
    },
  });

  revalidatePath('/referrals');
  return { success: true, referralCode: ref };
}

export async function updateReferralCode(
  id: string,
  data: Partial<z.infer<typeof createSchema>>,
) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') throw new Error('Unauthorized');

  const ref = await prisma.referralCode.update({
    where: { id },
    data: {
      ...data,
      // Regenerate whatsapp link if code changed
      ...(data.code ? { whatsappLink: buildWhatsAppLink(data.code) } : {}),
    },
  });

  revalidatePath('/referrals');
  return { success: true, referralCode: ref };
}

export async function deleteReferralCode(id: string) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') throw new Error('Unauthorized');

  await prisma.referralCode.delete({ where: { id } });
  revalidatePath('/referrals');
  return { success: true };
}

export async function getReferralCodes() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') throw new Error('Unauthorized');

  const codes = await prisma.referralCode.findMany({
    include: {
      orders: {
        select: {
          totalAmount: true,
          commission: true,
          services: { select: { id: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return codes.map((c) => ({
    ...c,
    totalOrders: c.orders.length,
    totalRevenue: c.orders.reduce((s, o) => s + o.totalAmount, 0),
    totalCommission: c.orders.reduce((s, o) => s + (o.commission ?? 0), 0),
  }));
}

export async function getActiveReferralCodes() {
  return prisma.referralCode.findMany({
    where: { status: true },
    select: { id: true, code: true, name: true },
    orderBy: { name: 'asc' },
  });
}

export async function validateReferralCode(code: string) {
  const ref = await prisma.referralCode.findUnique({
    where: { code },
    select: { id: true, name: true, status: true },
  });
  if (!ref || !ref.status) return null;
  return ref;
}

// ── Partner-facing actions ────────────────────────────────────────────────────

export async function getPartnerStats(referralCodeId: string) {
  const month = getDateRange('month');

  const [allOrders, monthOrders] = await Promise.all([
    prisma.sale.findMany({
      where: { referralCodeId },
      include: {
        items: { include: { product: { select: { name: true } } } },
        services: { select: { id: true } },
      },
      orderBy: { date: 'desc' },
    }),
    prisma.sale.findMany({
      where: { referralCodeId, date: { gte: month.start, lte: month.end } },
      select: { totalAmount: true, commission: true, services: { select: { id: true } } },
    }),
  ]);

  const ref = await prisma.referralCode.findUnique({
    where: { id: referralCodeId },
    select: { commissionWithService: true, commissionNoService: true },
  });

  const totalCommission = allOrders.reduce((s, o) => s + (o.commission ?? 0), 0);
  const monthCommission = monthOrders.reduce((s, o) => s + (o.commission ?? 0), 0);

  const monthWithServices = monthOrders.filter((o) => o.services.length > 0);
  const monthNoServices = monthOrders.filter((o) => o.services.length === 0);

  return {
    totalOrders: allOrders.length,
    totalRevenue: allOrders.reduce((s, o) => s + o.totalAmount, 0),
    totalCommission,
    monthOrders: monthOrders.length,
    monthCommission,
    monthWithServicesCount: monthWithServices.length,
    monthNoServicesCount: monthNoServices.length,
    monthWithServicesCommission: monthWithServices.reduce((s, o) => s + (o.commission ?? 0), 0),
    monthNoServicesCommission: monthNoServices.reduce((s, o) => s + (o.commission ?? 0), 0),
    commissionWithServiceRate: ref?.commissionWithService ?? 10,
    commissionNoServiceRate: ref?.commissionNoService ?? 5,
    orders: allOrders,
  };
}

// Admin analytics summary
export async function getReferralAnalytics() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') throw new Error('Unauthorized');

  const month = getDateRange('month');

  const codes = await prisma.referralCode.findMany({
    include: {
      orders: {
        select: {
          totalAmount: true,
          commission: true,
          date: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return codes.map((c) => {
    const monthOrders = c.orders.filter(
      (o) => o.date >= month.start && o.date <= month.end,
    );
    return {
      id: c.id,
      code: c.code,
      name: c.name,
      status: c.status,
      totalOrders: c.orders.length,
      totalRevenue: c.orders.reduce((s, o) => s + o.totalAmount, 0),
      totalCommission: c.orders.reduce((s, o) => s + (o.commission ?? 0), 0),
      monthOrders: monthOrders.length,
      monthCommission: monthOrders.reduce((s, o) => s + (o.commission ?? 0), 0),
    };
  });
}

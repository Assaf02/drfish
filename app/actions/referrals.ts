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

// ── Admin actions ─────────────────────────────────────────────────────────────

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
  const ref = await prisma.referralCode.create({
    data: {
      ...validated,
      level: 0,
      whatsappLink: buildWhatsAppLink(validated.code),
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
      ...(data.code ? { whatsappLink: buildWhatsAppLink(data.code) } : {}),
    },
  });

  // Cascade commission rates to all sub-codes
  const rateUpdate: { commissionWithService?: number; commissionNoService?: number } = {};
  if (data.commissionWithService !== undefined) rateUpdate.commissionWithService = data.commissionWithService;
  if (data.commissionNoService !== undefined) rateUpdate.commissionNoService = data.commissionNoService;
  if (Object.keys(rateUpdate).length > 0) {
    await prisma.referralCode.updateMany({
      where: { parentCodeId: id },
      data: rateUpdate,
    });
  }

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
    where: { level: 0 },
    include: {
      orders: { select: { totalAmount: true, commission: true } },
      subCodes: {
        include: {
          orders: { select: { totalAmount: true, commission: true } },
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
    subCodes: c.subCodes.map((sc) => ({
      ...sc,
      totalOrders: sc.orders.length,
      totalRevenue: sc.orders.reduce((s, o) => s + o.totalAmount, 0),
      totalCommission: sc.orders.reduce((s, o) => s + (o.commission ?? 0), 0),
    })),
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

export async function getReferralAnalytics() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') throw new Error('Unauthorized');
  const month = getDateRange('month');

  const codes = await prisma.referralCode.findMany({
    include: { orders: { select: { totalAmount: true, commission: true, date: true } } },
    orderBy: { level: 'asc' },
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
      level: c.level,
      parentCodeId: c.parentCodeId,
      totalOrders: c.orders.length,
      totalRevenue: c.orders.reduce((s, o) => s + o.totalAmount, 0),
      totalCommission: c.orders.reduce((s, o) => s + (o.commission ?? 0), 0),
      monthOrders: monthOrders.length,
      monthCommission: monthOrders.reduce((s, o) => s + (o.commission ?? 0), 0),
    };
  });
}

// ── Partner portal actions (NO commission amounts returned) ───────────────────

export async function createSubCode(data: {
  name: string;
  username: string;
  subSlug: string;
}) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'PARTNER') throw new Error('Unauthorized');

  const partnerInfo = session.user as unknown as {
    referralCodeId: string;
    partnerLevel: number;
  };
  if (partnerInfo.partnerLevel !== 0) throw new Error('Sub-partners cannot create sub-codes');

  const parent = await prisma.referralCode.findUnique({
    where: { id: partnerInfo.referralCodeId },
  });
  if (!parent) throw new Error('Parent code not found');

  const subCode = `${parent.code}-${data.subSlug.toUpperCase()}`;
  const existing = await prisma.referralCode.findUnique({ where: { code: subCode } });
  if (existing) throw new Error(`Le code ${subCode} existe déjà`);

  const existingUser = await prisma.referralCode.findUnique({ where: { username: data.username } });
  if (existingUser) throw new Error(`Le nom d'utilisateur "${data.username}" est déjà pris`);

  const created = await prisma.referralCode.create({
    data: {
      code: subCode,
      name: data.name,
      username: data.username,
      level: 1,
      parentCodeId: parent.id,
      // Inherit commission rates from parent (admin-controlled)
      commissionWithService: parent.commissionWithService,
      commissionNoService: parent.commissionNoService,
      status: true,
      whatsappLink: buildWhatsAppLink(subCode),
    },
  });

  revalidatePath('/partner/dashboard');
  // Return only non-commission data
  return {
    id: created.id,
    code: created.code,
    name: created.name,
    username: created.username,
    whatsappLink: created.whatsappLink,
    status: created.status,
  };
}

export async function toggleSubCodeStatus(subCodeId: string, status: boolean) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'PARTNER') throw new Error('Unauthorized');

  const partnerInfo = session.user as unknown as { referralCodeId: string; partnerLevel: number };
  if (partnerInfo.partnerLevel !== 0) throw new Error('Unauthorized');

  // Verify the sub-code belongs to this partner
  const sub = await prisma.referralCode.findUnique({ where: { id: subCodeId } });
  if (!sub || sub.parentCodeId !== partnerInfo.referralCodeId) throw new Error('Unauthorized');

  await prisma.referralCode.update({ where: { id: subCodeId }, data: { status } });
  revalidatePath('/partner/dashboard');
  return { success: true };
}

export async function suggestSubCodeDefaults(parentCode: string, subName: string) {
  const slug = subName
    .split(' ')[0]
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z]/g, '')
    .slice(0, 6);
  const subCode = `${parentCode}-${slug}`;
  const username = generateUsername(subName);

  // Check for collision
  const existing = await prisma.referralCode.findUnique({ where: { code: subCode } });
  return {
    subCode,
    subSlug: slug,
    username,
    available: !existing,
  };
}

// Partner portal data — intentionally omits all commission rate information
export async function getPartnerPortalData(referralCodeId: string) {
  const month = getDateRange('month');

  const ref = await prisma.referralCode.findUnique({
    where: { id: referralCodeId },
    include: {
      subCodes: {
        include: {
          orders: {
            select: { id: true, totalAmount: true, date: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!ref) return null;

  const directOrders = await prisma.sale.findMany({
    where: { referralCodeId },
    include: {
      items: { include: { product: { select: { name: true } } } },
      services: { select: { id: true } },
    },
    orderBy: { date: 'desc' },
  });

  const directMonthOrders = directOrders.filter(
    (o) => o.date >= month.start && o.date <= month.end,
  );

  // Sub-code aggregates (no commission data)
  const subCodeData = ref.subCodes.map((sc) => {
    const scMonthOrders = sc.orders.filter(
      (o) => o.date >= month.start && o.date <= month.end,
    );
    return {
      id: sc.id,
      code: sc.code,
      name: sc.name,
      username: sc.username,
      status: sc.status,
      whatsappLink: sc.whatsappLink,
      createdAt: sc.createdAt,
      totalOrders: sc.orders.length,
      totalRevenue: sc.orders.reduce((s, o) => s + o.totalAmount, 0),
      monthOrders: scMonthOrders.length,
      monthRevenue: scMonthOrders.reduce((s, o) => s + o.totalAmount, 0),
    };
  });

  const totalSubOrders = subCodeData.reduce((s, sc) => s + sc.totalOrders, 0);
  const monthSubOrders = subCodeData.reduce((s, sc) => s + sc.monthOrders, 0);

  return {
    id: ref.id,
    code: ref.code,
    name: ref.name,
    username: ref.username,
    whatsappLink: ref.whatsappLink,
    level: ref.level,
    // Stats — NO commission data
    totalDirectOrders: directOrders.length,
    totalDirectRevenue: directOrders.reduce((s, o) => s + o.totalAmount, 0),
    monthDirectOrders: directMonthOrders.length,
    monthDirectRevenue: directMonthOrders.reduce((s, o) => s + o.totalAmount, 0),
    totalSubOrders,
    monthSubOrders,
    subCodes: subCodeData,
    orders: directOrders.map((o) => ({
      id: o.id,
      date: o.date,
      products: o.items.map((i) => i.product.name).join(', '),
      totalAmount: o.totalAmount,
      hasServices: o.services.length > 0,
    })),
  };
}

// Admin-only: includes commission data for analytics
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

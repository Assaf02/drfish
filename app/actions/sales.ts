'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getDateRange, formatDate, formatRelative } from '@/lib/utils';
import { addDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { z } from 'zod';

const saleItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().positive(),
  pricePerKg: z.number().positive(),
  subtotal: z.number().positive(),
});

const saleServiceSchema = z.object({
  serviceId: z.string(),
  price: z.number().min(0),
});

const saleSchema = z.object({
  clientId: z.string().optional().nullable(),
  clientName: z.string().optional(),
  clientPhone: z.string().optional(),
  date: z.string().optional(),
  paymentStatus: z.enum(["PAID", "PENDING"] as const),
  paymentMethod: z.enum(["WHATSAPP", "WEBSITE", "DIRECT"] as const),
  notes: z.string().optional().nullable(),
  totalAmount: z.number().positive(),
  items: z.array(saleItemSchema).min(1, 'Au moins un produit requis'),
  services: z.array(saleServiceSchema).optional().default([]),
  referralCode: z.string().optional().nullable(),
});

export type SaleInput = z.infer<typeof saleSchema>;

export async function createSale(data: SaleInput) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error('Non authentifié');

  const validated = saleSchema.parse(data);

  // Create client if name provided but no clientId
  let clientId = validated.clientId;
  if (!clientId && validated.clientName) {
    const client = await prisma.client.create({
      data: {
        name: validated.clientName,
        phone: validated.clientPhone,
      },
    });
    clientId = client.id;
  }

  // Resolve referral code + calculate commission
  let referralCodeId: string | undefined;
  let commission: number | undefined;
  if (validated.referralCode) {
    const ref = await prisma.referralCode.findUnique({
      where: { code: validated.referralCode },
    });
    if (ref && ref.status) {
      referralCodeId = ref.id;
      const hasServices = (validated.services?.length ?? 0) > 0;
      const rate = hasServices
        ? ref.commissionWithService / 100
        : ref.commissionNoService / 100;
      const productTotal = validated.items.reduce((s, i) => s + i.subtotal, 0);
      commission = Math.round(productTotal * rate);
    }
  }

  const sale = await prisma.sale.create({
    data: {
      agentId: session.user.id,
      clientId,
      referralCodeId,
      commission,
      date: validated.date ? new Date(validated.date) : new Date(),
      paymentStatus: validated.paymentStatus,
      paymentMethod: validated.paymentMethod,
      notes: validated.notes,
      totalAmount: validated.totalAmount,
      items: {
        create: validated.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          pricePerKg: item.pricePerKg,
          subtotal: item.subtotal,
        })),
      },
      services: {
        create: validated.services.map((svc) => ({
          serviceId: svc.serviceId,
          price: svc.price,
        })),
      },
    },
    include: {
      items: { include: { product: true } },
      services: { include: { service: true } },
      client: true,
      agent: true,
    },
  });

  revalidatePath('/sales');
  revalidatePath('/dashboard');
  revalidatePath('/home');

  return { success: true, sale };
}

export async function getSales(filters?: {
  dateFrom?: Date;
  dateTo?: Date;
  agentId?: string;
  paymentStatus?: string;
  productId?: string;
  page?: number;
  limit?: number;
}) {
  const page = filters?.page ?? 1;
  const limit = filters?.limit ?? 50;
  const skip = (page - 1) * limit;

  const where = {
    ...(filters?.dateFrom || filters?.dateTo
      ? {
          date: {
            ...(filters.dateFrom && { gte: filters.dateFrom }),
            ...(filters.dateTo && { lte: filters.dateTo }),
          },
        }
      : {}),
    ...(filters?.agentId ? { agentId: filters.agentId } : {}),
    ...(filters?.paymentStatus ? { paymentStatus: filters.paymentStatus } : {}),
    ...(filters?.productId
      ? { items: { some: { productId: filters.productId } } }
      : {}),
  };

  const [sales, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      include: {
        agent: { select: { id: true, name: true } },
        client: { select: { id: true, name: true, phone: true } },
        items: { include: { product: { select: { id: true, name: true, category: true, purchasePrice: true } } } },
        services: { include: { service: { select: { id: true, name: true } } } },
      },
      orderBy: { date: 'desc' },
      skip,
      take: limit,
    }),
    prisma.sale.count({ where }),
  ]);

  return { sales, total, pages: Math.ceil(total / limit) };
}

export async function getDashboardKPIs() {
  const today = getDateRange('today');
  const week = getDateRange('week');
  const month = getDateRange('month');

  const [todaySales, weekSales, monthSales, recentSales, products] = await Promise.all([
    prisma.sale.findMany({
      where: { date: { gte: today.start, lte: today.end } },
      include: { items: { include: { product: true } } },
    }),
    prisma.sale.findMany({
      where: { date: { gte: week.start, lte: week.end } },
      include: { items: { include: { product: true } } },
    }),
    prisma.sale.findMany({
      where: { date: { gte: month.start, lte: month.end } },
      include: { items: { include: { product: true } } },
    }),
    prisma.sale.findMany({
      take: 10,
      orderBy: { date: 'desc' },
      include: {
        agent: { select: { name: true } },
        client: { select: { name: true } },
        items: { include: { product: { select: { name: true } } } },
      },
    }),
    prisma.product.findMany({ where: { active: true } }),
  ]);

  const calcRevenue = (sales: typeof todaySales) =>
    sales.reduce((sum, s) => sum + s.totalAmount, 0);

  // Best product of the week
  const productSales: Record<string, { name: string; quantity: number }> = {};
  weekSales.forEach((sale) => {
    sale.items.forEach((item) => {
      if (!productSales[item.productId]) {
        productSales[item.productId] = { name: item.product.name, quantity: 0 };
      }
      productSales[item.productId].quantity += item.quantity;
    });
  });

  const bestProduct = Object.values(productSales).sort((a, b) => b.quantity - a.quantity)[0] ?? null;

  // Margin overview (month)
  let totalRevenue = 0;
  let totalCost = 0;
  monthSales.forEach((sale) => {
    totalRevenue += sale.totalAmount;
    sale.items.forEach((item) => {
      totalCost += item.product.purchasePrice * item.quantity;
    });
  });
  const marginOverview = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;

  return {
    revenueToday: calcRevenue(todaySales),
    revenueWeek: calcRevenue(weekSales),
    revenueMonth: calcRevenue(monthSales),
    ordersToday: todaySales.length,
    ordersWeek: weekSales.length,
    ordersMonth: monthSales.length,
    bestProduct,
    marginOverview,
    pendingOrders: todaySales.filter((s) => s.paymentStatus === 'PENDING').length,
    recentSales,
    products,
  };
}

export async function getRevenueChart(days = 7) {
  const data = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const sales = await prisma.sale.findMany({
      where: { date: { gte: start, lte: end } },
      select: { totalAmount: true },
    });

    data.push({
      date: start.toISOString().split('T')[0],
      revenue: sales.reduce((sum, s) => sum + s.totalAmount, 0),
      orders: sales.length,
    });
  }
  return data;
}

export async function getAgentDailySummary(agentId: string) {
  const today = getDateRange('today');
  const sales = await prisma.sale.findMany({
    where: {
      agentId,
      date: { gte: today.start, lte: today.end },
    },
    include: {
      items: { include: { product: { select: { name: true } } } },
      client: { select: { name: true } },
    },
    orderBy: { date: 'desc' },
  });

  return {
    sales,
    totalOrders: sales.length,
    totalRevenue: sales.reduce((sum, s) => sum + s.totalAmount, 0),
  };
}

export async function updateSale(id: string, data: Partial<{ paymentStatus: string; notes: string }>) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') throw new Error('Unauthorized');

  const sale = await prisma.sale.update({ where: { id }, data });
  revalidatePath('/sales');
  return { success: true, sale };
}

export async function deleteSale(id: string) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') throw new Error('Unauthorized');

  await prisma.sale.delete({ where: { id } });
  revalidatePath('/sales');
  return { success: true };
}

// ── Dashboard unified data action ─────────────────────────────────────────────

export async function getDashboardData(fromISO: string, toISO: string) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') throw new Error('Unauthorized');

  const from = new Date(fromISO);
  const to   = new Date(toISO);

  const [sales, expiringRaw, activeSubCount] = await Promise.all([
    prisma.sale.findMany({
      where: { date: { gte: from, lte: to } },
      include: {
        items: { include: { product: { select: { name: true, purchasePrice: true, category: true } } } },
        agent:    { select: { id: true, name: true } },
        client:   { select: { name: true } },
        services: { select: { id: true } },
      },
      orderBy: { date: 'desc' },
    }),
    prisma.subscription.findMany({
      where: { status: 'ACTIVE', endDate: { lte: addDays(new Date(), 7) } },
      include: { client: { select: { name: true } } },
      orderBy: { endDate: 'asc' },
    }),
    prisma.subscription.count({ where: { status: 'ACTIVE' } }),
  ]);

  // KPIs
  const revenue      = sales.reduce((s, o) => s + o.totalAmount, 0);
  const orders       = sales.length;
  const pendingOrders = sales.filter((s) => s.paymentStatus === 'PENDING').length;

  // Margin
  let totalCost = 0;
  sales.forEach((sale) => {
    sale.items.forEach((item) => { totalCost += item.product.purchasePrice * item.quantity; });
  });
  const margin = revenue > 0 ? ((revenue - totalCost) / revenue) * 100 : 0;

  // Top products
  const productMap: Record<string, { name: string; category: string; quantity: number; revenue: number; orders: number }> = {};
  sales.forEach((sale) => {
    sale.items.forEach((item) => {
      const k = item.product.name;
      if (!productMap[k]) productMap[k] = { name: k, category: item.product.category, quantity: 0, revenue: 0, orders: 0 };
      productMap[k].quantity += item.quantity;
      productMap[k].revenue  += item.subtotal;
      productMap[k].orders++;
    });
  });
  const topProducts = Object.values(productMap).sort((a, b) => b.quantity - a.quantity).slice(0, 10);
  const bestProduct = topProducts[0] ?? null;

  // Recent sales — all fields pre-serialized
  const recentSales = sales.slice(0, 10).map((sale) => ({
    id:            sale.id,
    dateStr:       formatDate(sale.date),
    relativeStr:   formatRelative(sale.date),
    totalAmount:   sale.totalAmount,
    paymentStatus: sale.paymentStatus,
    agentName:     sale.agent.name,
    clientName:    sale.client?.name ?? null,
    products:      sale.items.map((i) => i.product.name).join(', '),
  }));

  // Chart data
  const diffDays = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  const chartData = buildChartPoints(sales, from, to, diffDays);

  // Agent stats
  const agentMap: Record<string, { id: string; name: string; orders: number; revenue: number }> = {};
  sales.forEach((sale) => {
    const id = sale.agent.id;
    if (!agentMap[id]) agentMap[id] = { id, name: sale.agent.name, orders: 0, revenue: 0 };
    agentMap[id].orders++;
    agentMap[id].revenue += sale.totalAmount;
  });
  const agentsStats = Object.values(agentMap).sort((a, b) => b.revenue - a.revenue);

  return {
    revenue,
    orders,
    pendingOrders,
    margin,
    bestProduct,
    topProducts,
    recentSales,
    chartData,
    agentsStats,
    activeSubscriptions: activeSubCount,
    expiringSubscriptions: expiringRaw.map((sub) => ({
      id:         sub.id,
      clientName: sub.client.name,
      endDateStr: sub.endDate ? formatDate(sub.endDate) : '—',
    })),
  };
}

function buildChartPoints(
  sales: Array<{ date: Date; totalAmount: number }>,
  from: Date,
  to: Date,
  diffDays: number,
): Array<{ date: string; label: string; revenue: number; orders: number }> {
  if (diffDays === 0) {
    // Hourly — today only
    const byHour = Array.from({ length: 24 }, () => ({ revenue: 0, orders: 0 }));
    sales.forEach((s) => { const h = new Date(s.date).getHours(); byHour[h].revenue += s.totalAmount; byHour[h].orders++; });
    return byHour.map((h, i) => ({
      date:    `${String(i).padStart(2, '0')}:00`,
      label:   `${String(i).padStart(2, '0')}h`,
      revenue: h.revenue,
      orders:  h.orders,
    }));
  }

  if (diffDays <= 60) {
    // Daily — iterate days in range
    const dayMap: Record<string, { revenue: number; orders: number }> = {};
    const cursor = new Date(from);
    cursor.setHours(0, 0, 0, 0);
    while (cursor <= to) {
      dayMap[cursor.toISOString().split('T')[0]] = { revenue: 0, orders: 0 };
      cursor.setDate(cursor.getDate() + 1);
    }
    sales.forEach((s) => {
      const key = new Date(s.date).toISOString().split('T')[0];
      if (dayMap[key]) { dayMap[key].revenue += s.totalAmount; dayMap[key].orders++; }
    });
    return Object.entries(dayMap).map(([date, v]) => ({
      date,
      label: diffDays <= 14
        ? format(new Date(date + 'T12:00:00'), 'EEE', { locale: fr })
        : format(new Date(date + 'T12:00:00'), 'dd/MM', { locale: fr }),
      ...v,
    }));
  }

  // Weekly — group by Monday
  const weekMap: Record<string, { revenue: number; orders: number }> = {};
  sales.forEach((s) => {
    const d = new Date(s.date);
    const day = d.getDay();
    const ws  = new Date(d);
    ws.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
    ws.setHours(0, 0, 0, 0);
    const key = ws.toISOString().split('T')[0];
    if (!weekMap[key]) weekMap[key] = { revenue: 0, orders: 0 };
    weekMap[key].revenue += s.totalAmount;
    weekMap[key].orders++;
  });
  return Object.entries(weekMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      label: format(new Date(date + 'T12:00:00'), 'dd MMM', { locale: fr }),
      ...v,
    }));
}

'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getDateRange } from '@/lib/utils';

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

  const sale = await prisma.sale.create({
    data: {
      agentId: session.user.id,
      clientId,
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

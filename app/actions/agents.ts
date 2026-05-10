'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getDateRange, calcSalary } from '@/lib/utils';
import bcrypt from 'bcryptjs';

import { z } from 'zod';

const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["ADMIN", "AGENT"] as const).default('AGENT'),
});

export async function getAgents() {
  return prisma.user.findMany({
    where: { role: 'AGENT' },
    orderBy: { name: 'asc' },
  });
}

export async function getAgentStats(agentId?: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error('Unauthorized');

  const id = agentId || session.user.id;
  const today = getDateRange('today');
  const week = getDateRange('week');
  const month = getDateRange('month');

  const [todaySales, weekSales, monthSales, agent] = await Promise.all([
    prisma.sale.count({ where: { agentId: id, date: { gte: today.start, lte: today.end } } }),
    prisma.sale.count({ where: { agentId: id, date: { gte: week.start, lte: week.end } } }),
    prisma.sale.findMany({
      where: { agentId: id, date: { gte: month.start, lte: month.end } },
      select: { totalAmount: true },
    }),
    prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true } }),
  ]);

  const revenueMonth = monthSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const salary = calcSalary(monthSales.length);

  return {
    agent,
    ordersToday: todaySales,
    ordersWeek: weekSales,
    ordersMonth: monthSales.length,
    revenueMonth,
    salary,
  };
}

export async function getAllAgentsStats() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') throw new Error('Unauthorized');

  const agents = await prisma.user.findMany({
    where: { role: 'AGENT', active: true },
    select: { id: true, name: true, email: true },
  });

  const month = getDateRange('month');

  const stats = await Promise.all(
    agents.map(async (agent) => {
      const sales = await prisma.sale.findMany({
        where: { agentId: agent.id, date: { gte: month.start, lte: month.end } },
        select: { totalAmount: true },
      });
      const revenueMonth = sales.reduce((sum, s) => sum + s.totalAmount, 0);
      return {
        ...agent,
        ordersMonth: sales.length,
        revenueMonth,
        salary: calcSalary(sales.length),
      };
    }),
  );

  return stats;
}

export async function createUser(data: z.infer<typeof userSchema>) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') throw new Error('Unauthorized');

  const validated = userSchema.parse(data);
  const hashed = await bcrypt.hash(validated.password, 12);

  const user = await prisma.user.create({
    data: { ...validated, password: hashed },
  });
  revalidatePath('/agents');
  revalidatePath('/settings');
  return { success: true, user };
}

export async function updateUser(id: string, data: { name?: string; email?: string; active?: boolean }) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') throw new Error('Unauthorized');

  const user = await prisma.user.update({ where: { id }, data });
  revalidatePath('/agents');
  revalidatePath('/settings');
  return { success: true, user };
}

export async function resetPassword(id: string, newPassword: string) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') throw new Error('Unauthorized');

  const hashed = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id }, data: { password: hashed } });
  return { success: true };
}

'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

import { z } from 'zod';
import { addDays } from 'date-fns';

const subscriptionSchema = z.object({
  clientId: z.string(),
  startDate: z.string(),
  endDate: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "SUSPENDED", "EXPIRED"] as const).default('ACTIVE'),
  weeklyDeliveries: z.number().int().default(0),
  referredBy: z.string().optional().nullable(),
  bonusApplied: z.boolean().default(false),
  notes: z.string().optional().nullable(),
});

export async function getSubscriptions(status?: string) {
  return prisma.subscription.findMany({
    where: status ? { status } : undefined,
    include: {
      client: { select: { id: true, name: true, phone: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getExpiringSubscriptions(daysAhead = 7) {
  const cutoff = addDays(new Date(), daysAhead);
  return prisma.subscription.findMany({
    where: {
      status: 'ACTIVE',
      endDate: { lte: cutoff },
    },
    include: { client: { select: { name: true, phone: true } } },
    orderBy: { endDate: 'asc' },
  });
}

export async function createSubscription(data: z.infer<typeof subscriptionSchema>) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') throw new Error('Unauthorized');

  const validated = subscriptionSchema.parse(data);
  const subscription = await prisma.subscription.create({
    data: {
      ...validated,
      startDate: new Date(validated.startDate),
      endDate: validated.endDate ? new Date(validated.endDate) : null,
    },
  });
  revalidatePath('/subscriptions');
  return { success: true, subscription };
}

export async function updateSubscription(id: string, data: Partial<z.infer<typeof subscriptionSchema>>) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') throw new Error('Unauthorized');

  const subscription = await prisma.subscription.update({
    where: { id },
    data: {
      ...data,
      ...(data.startDate ? { startDate: new Date(data.startDate) } : {}),
      ...(data.endDate ? { endDate: new Date(data.endDate) } : {}),
    },
  });
  revalidatePath('/subscriptions');
  return { success: true, subscription };
}

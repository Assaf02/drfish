'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const clientSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function getClients(search?: string) {
  return prisma.client.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search } },
            { phone: { contains: search } },
          ],
        }
      : undefined,
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { sales: true } },
    },
  });
}

export async function getClientWithStats(id: string) {
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      sales: {
        orderBy: { date: 'desc' },
        include: {
          items: { include: { product: true } },
          services: { include: { service: true } },
          agent: { select: { name: true } },
        },
      },
      subscriptions: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!client) return null;

  const totalSpent = client.sales.reduce((sum, s) => sum + s.totalAmount, 0);

  return { ...client, totalSpent };
}

export async function createClient(data: z.infer<typeof clientSchema>) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error('Unauthorized');

  const validated = clientSchema.parse(data);
  const client = await prisma.client.create({ data: validated });
  revalidatePath('/clients');
  return { success: true, client };
}

export async function updateClient(id: string, data: Partial<z.infer<typeof clientSchema>>) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error('Unauthorized');

  const client = await prisma.client.update({ where: { id }, data });
  revalidatePath('/clients');
  revalidatePath(`/clients/${id}`);
  return { success: true, client };
}

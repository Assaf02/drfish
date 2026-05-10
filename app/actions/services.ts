'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const serviceSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  price: z.number().min(0),
  promoPrice: z.number().min(0).optional().nullable(),
  isPromo: z.boolean().default(false),
  active: z.boolean().default(true),
});

export async function getServices(includeInactive = false) {
  return prisma.service.findMany({
    where: includeInactive ? undefined : { active: true },
    orderBy: { name: 'asc' },
  });
}

export async function createService(data: z.infer<typeof serviceSchema>) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') throw new Error('Unauthorized');

  const validated = serviceSchema.parse(data);
  const service = await prisma.service.create({ data: validated });
  revalidatePath('/services');
  return { success: true, service };
}

export async function updateService(id: string, data: Partial<z.infer<typeof serviceSchema>>) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') throw new Error('Unauthorized');

  const service = await prisma.service.update({ where: { id }, data });
  revalidatePath('/services');
  return { success: true, service };
}

export async function toggleServicePromo(id: string) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') throw new Error('Unauthorized');

  const service = await prisma.service.findUnique({ where: { id } });
  if (!service) throw new Error('Service not found');

  const updated = await prisma.service.update({
    where: { id },
    data: { isPromo: !service.isPromo },
  });
  revalidatePath('/services');
  return { success: true, service: updated };
}

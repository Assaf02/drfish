'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';


const productSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  category: z.enum(["POISSON", "CRUSTACE", "AUTRE"] as const),
  purchasePrice: z.number().positive('Prix d\'achat requis'),
  sellingPrice: z.number().positive('Prix de vente requis'),
  unit: z.string().default('kg'),
  stock: z.number().optional().nullable(),
  active: z.boolean().default(true),
  photoUrl: z.string().url().optional().nullable(),
});

export async function getProducts(includeInactive = false) {
  return prisma.product.findMany({
    where: includeInactive ? undefined : { active: true },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });
}

export async function createProduct(data: z.infer<typeof productSchema>) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') throw new Error('Unauthorized');

  const validated = productSchema.parse(data);
  const product = await prisma.product.create({ data: validated });
  revalidatePath('/products');
  return { success: true, product };
}

export async function updateProduct(id: string, data: Partial<z.infer<typeof productSchema>>) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') throw new Error('Unauthorized');

  const product = await prisma.product.update({ where: { id }, data });
  revalidatePath('/products');
  return { success: true, product };
}

export async function deleteProduct(id: string) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') throw new Error('Unauthorized');

  await prisma.product.update({ where: { id }, data: { active: false } });
  revalidatePath('/products');
  return { success: true };
}

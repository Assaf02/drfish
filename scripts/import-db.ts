/**
 * Import all DrFish data into a fresh DB (Supabase or Neon).
 * Run AFTER prisma db push on the new DB:
 *   DATABASE_URL=<new-url> DIRECT_URL=<new-url> npx tsx scripts/import-db.ts
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const SRC = path.join(__dirname, 'export');

function load<T>(name: string): T[] {
  const file = path.join(SRC, `${name}.json`);
  if (!fs.existsSync(file)) { console.log(`⚠ ${name}.json not found, skipping`); return []; }
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as T[];
}

async function main() {
  console.log('Importing data into new DB...\n');

  // ── 1. Users ────────────────────────────────────────────────────────────────
  const users = load<{ id: string; email: string; name: string; password: string; role: string; active: boolean; createdAt: string; updatedAt: string }>('users');
  for (const u of users) {
    await prisma.user.upsert({
      where: { id: u.id },
      create: { ...u, createdAt: new Date(u.createdAt), updatedAt: new Date(u.updatedAt) },
      update: {},
    });
  }
  console.log(`✓ users: ${users.length}`);

  // ── 2. Products ──────────────────────────────────────────────────────────────
  const products = load<Record<string, unknown>>('products');
  for (const p of products) {
    await prisma.product.upsert({
      where: { id: p.id as string },
      create: { ...p, createdAt: new Date(p.createdAt as string), updatedAt: new Date(p.updatedAt as string) } as never,
      update: {},
    });
  }
  console.log(`✓ products: ${products.length}`);

  // ── 3. Services ──────────────────────────────────────────────────────────────
  const services = load<Record<string, unknown>>('services');
  for (const s of services) {
    await prisma.service.upsert({
      where: { id: s.id as string },
      create: { ...s, createdAt: new Date(s.createdAt as string), updatedAt: new Date(s.updatedAt as string) } as never,
      update: {},
    });
  }
  console.log(`✓ services: ${services.length}`);

  // ── 4. Referral codes (parents first, then children) ────────────────────────
  const refs = load<Record<string, unknown>>('referral_codes');
  // Insert without parentCodeId first
  for (const r of refs) {
    const { parentCodeId, ...rest } = r;
    await prisma.referralCode.upsert({
      where: { id: rest.id as string },
      create: { ...rest, parentCodeId: null, createdAt: new Date(rest.createdAt as string), updatedAt: new Date(rest.updatedAt as string) } as never,
      update: {},
    });
  }
  // Then patch parentCodeId
  for (const r of refs) {
    if (r.parentCodeId) {
      await prisma.referralCode.update({
        where: { id: r.id as string },
        data: { parentCodeId: r.parentCodeId as string },
      });
    }
  }
  console.log(`✓ referral_codes: ${refs.length}`);

  // ── 5. Clients ───────────────────────────────────────────────────────────────
  const clients = load<Record<string, unknown>>('clients');
  for (const c of clients) {
    await prisma.client.upsert({
      where: { id: c.id as string },
      create: { ...c, createdAt: new Date(c.createdAt as string), updatedAt: new Date(c.updatedAt as string) } as never,
      update: {},
    });
  }
  console.log(`✓ clients: ${clients.length}`);

  // ── 6. Sales ─────────────────────────────────────────────────────────────────
  const sales = load<Record<string, unknown>>('sales');
  for (const s of sales) {
    await prisma.sale.upsert({
      where: { id: s.id as string },
      create: { ...s, date: new Date(s.date as string), createdAt: new Date(s.createdAt as string), updatedAt: new Date(s.updatedAt as string) } as never,
      update: {},
    });
  }
  console.log(`✓ sales: ${sales.length}`);

  // ── 7. Sale items ────────────────────────────────────────────────────────────
  const saleItems = load<Record<string, unknown>>('sale_items');
  for (const i of saleItems) {
    await prisma.saleItem.upsert({
      where: { id: i.id as string },
      create: { ...i, createdAt: new Date(i.createdAt as string) } as never,
      update: {},
    });
  }
  console.log(`✓ sale_items: ${saleItems.length}`);

  // ── 8. Sale services ─────────────────────────────────────────────────────────
  const saleServices = load<Record<string, unknown>>('sale_services');
  for (const s of saleServices) {
    await prisma.saleService.upsert({
      where: { id: s.id as string },
      create: { ...s, createdAt: new Date(s.createdAt as string) } as never,
      update: {},
    });
  }
  console.log(`✓ sale_services: ${saleServices.length}`);

  // ── 9. Subscriptions ─────────────────────────────────────────────────────────
  const subs = load<Record<string, unknown>>('subscriptions');
  for (const s of subs) {
    await prisma.subscription.upsert({
      where: { id: s.id as string },
      create: {
        ...s,
        startDate: new Date(s.startDate as string),
        endDate: s.endDate ? new Date(s.endDate as string) : null,
        createdAt: new Date(s.createdAt as string),
        updatedAt: new Date(s.updatedAt as string),
      } as never,
      update: {},
    });
  }
  console.log(`✓ subscriptions: ${subs.length}`);

  // ── 10. Settings ─────────────────────────────────────────────────────────────
  const settings = load<Record<string, unknown>>('settings');
  for (const s of settings) {
    await prisma.setting.upsert({
      where: { id: s.id as string },
      create: { ...s, createdAt: new Date(s.createdAt as string), updatedAt: new Date(s.updatedAt as string) } as never,
      update: {},
    });
  }
  console.log(`✓ settings: ${settings.length}`);

  // ── 11. Campaigns ────────────────────────────────────────────────────────────
  const campaigns = load<Record<string, unknown>>('campaigns');
  for (const c of campaigns) {
    await prisma.campaign.upsert({
      where: { id: c.id as string },
      create: {
        ...c,
        scheduledAt: c.scheduledAt ? new Date(c.scheduledAt as string) : null,
        createdAt: new Date(c.createdAt as string),
        updatedAt: new Date(c.updatedAt as string),
      } as never,
      update: {},
    });
  }
  console.log(`✓ campaigns: ${campaigns.length}`);

  // ── 12. Campaign logs ────────────────────────────────────────────────────────
  const logs = load<Record<string, unknown>>('campaign_logs');
  for (const l of logs) {
    await prisma.campaignLog.upsert({
      where: { id: l.id as string },
      create: { ...l, sentAt: new Date(l.sentAt as string) } as never,
      update: {},
    });
  }
  console.log(`✓ campaign_logs: ${logs.length}`);

  // ── 13. WhatsApp session ─────────────────────────────────────────────────────
  const waSessions = load<Record<string, unknown>>('whatsapp_sessions');
  for (const w of waSessions) {
    await prisma.whatsAppSession.upsert({
      where: { id: w.id as string },
      create: { ...w, updatedAt: new Date(w.updatedAt as string) } as never,
      update: {},
    });
  }
  console.log(`✓ whatsapp_sessions: ${waSessions.length}`);

  console.log('\n✅ Import terminé avec succès !');
}

main()
  .catch((e) => { console.error('❌ Erreur:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());

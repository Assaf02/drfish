/**
 * Export all DrFish data from Neon to JSON files in scripts/export/
 * Run: npx tsx scripts/export-db.ts
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const OUT = path.join(__dirname, 'export');

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  function save(name: string, data: unknown) {
    const file = path.join(OUT, `${name}.json`);
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    console.log(`✓ ${name}: ${Array.isArray(data) ? data.length : 1} records → ${file}`);
  }

  const [
    users,
    products,
    services,
    clients,
    sales,
    saleItems,
    saleServices,
    subscriptions,
    settings,
    referralCodes,
    campaigns,
    campaignLogs,
    waSessions,
  ] = await Promise.all([
    prisma.user.findMany(),
    prisma.product.findMany(),
    prisma.service.findMany(),
    prisma.client.findMany(),
    prisma.sale.findMany(),
    prisma.saleItem.findMany(),
    prisma.saleService.findMany(),
    prisma.subscription.findMany(),
    prisma.setting.findMany(),
    prisma.referralCode.findMany().catch(() => []),
    prisma.campaign.findMany().catch(() => []),
    prisma.campaignLog.findMany().catch(() => []),
    prisma.whatsAppSession.findMany().catch(() => []),
  ]);

  save('users', users);
  save('products', products);
  save('services', services);
  save('clients', clients);
  save('sales', sales);
  save('sale_items', saleItems);
  save('sale_services', saleServices);
  save('subscriptions', subscriptions);
  save('settings', settings);
  save('referral_codes', referralCodes);
  save('campaigns', campaigns);
  save('campaign_logs', campaignLogs);
  save('whatsapp_sessions', waSessions);

  console.log(`\nExport terminé → ${OUT}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

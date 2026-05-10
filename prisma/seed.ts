import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🐟 Seeding Dr Fish CRM...');

  // Users
  const adminPassword = await bcrypt.hash('DrFish2026!', 12);
  const agentPassword = await bcrypt.hash('Agent2026!', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'joresse@drfish.bj' },
    update: {},
    create: {
      email: 'joresse@drfish.bj',
      name: 'Joresse',
      password: adminPassword,
      role: 'ADMIN',
    },
  });

  const agent = await prisma.user.upsert({
    where: { email: 'irene@drfish.bj' },
    update: {},
    create: {
      email: 'irene@drfish.bj',
      name: 'Irène',
      password: agentPassword,
      role: 'AGENT',
    },
  });

  console.log(`✅ Users: ${admin.name} (Admin), ${agent.name} (Agent)`);

  // Products
  const products = [
    { name: 'Bar', category: 'POISSON', purchasePrice: 2500, sellingPrice: 4000 },
    { name: 'Brochet', category: 'POISSON', purchasePrice: 2000, sellingPrice: 3500 },
    { name: 'Calamar', category: 'CRUSTACE', purchasePrice: 4500, sellingPrice: 7000 },
    { name: 'Carpe rouge', category: 'POISSON', purchasePrice: 2500, sellingPrice: 4000 },
    { name: 'Maquereau', category: 'POISSON', purchasePrice: 1800, sellingPrice: 3000 },
    { name: 'Dorade', category: 'POISSON', purchasePrice: 2500, sellingPrice: 4000 },
    { name: 'Mérou', category: 'POISSON', purchasePrice: 2500, sellingPrice: 4000 },
    { name: 'Thon', category: 'POISSON', purchasePrice: 1500, sellingPrice: 2800 },
    { name: 'Tilapia', category: 'POISSON', purchasePrice: 2000, sellingPrice: 3500 },
    { name: 'Crevettes', category: 'CRUSTACE', purchasePrice: 2500, sellingPrice: 3800 },
    { name: 'Gambas', category: 'CRUSTACE', purchasePrice: 4000, sellingPrice: 6000 },
    { name: 'Langouste', category: 'CRUSTACE', purchasePrice: 6000, sellingPrice: 9000 },
  ];

  for (const product of products) {
    const existing = await prisma.product.findFirst({ where: { name: product.name } });
    if (!existing) await prisma.product.create({ data: product });
    else await prisma.product.update({ where: { id: existing.id }, data: product });
  }

  console.log(`✅ Products: ${products.length} created`);

  // Services
  const services = [
    { name: 'Nettoyage', price: 500, promoPrice: 0, isPromo: true },
    { name: 'Découpage', price: 500, promoPrice: 0, isPromo: false },
    { name: 'Filetage', price: 500, promoPrice: 250, isPromo: true },
  ];

  for (const service of services) {
    const existing = await prisma.service.findFirst({ where: { name: service.name } });
    if (!existing) await prisma.service.create({ data: service });
    else await prisma.service.update({ where: { id: existing.id }, data: service });
  }

  console.log(`✅ Services: ${services.length} created`);

  // Settings
  const settings = [
    { key: 'business_name', value: 'Dr Fish' },
    { key: 'business_phone', value: '+229 97 00 00 00' },
    { key: 'whatsapp_link', value: 'https://wa.me/22997000000' },
    { key: 'business_address', value: 'Cotonou, Bénin' },
    { key: 'promo_active', value: 'true' },
    { key: 'agent_base_salary', value: '25000' },
    { key: 'bonus_tier1_orders', value: '10' },
    { key: 'bonus_tier1_percent', value: '5' },
    { key: 'bonus_tier2_orders', value: '20' },
    { key: 'bonus_tier2_percent', value: '10' },
  ];

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
  }

  console.log(`✅ Settings: ${settings.length} configured`);

  // Sample clients
  const clients = [
    { name: 'Marie Adjovi', phone: '+229 96 11 22 33', address: 'Akpakpa, Cotonou' },
    { name: 'Koffi Mensah', phone: '+229 97 44 55 66', address: 'Cadjehoun, Cotonou' },
    { name: 'Aïcha Bello', phone: '+229 95 77 88 99', address: 'Fidjrossè, Cotonou' },
  ];

  for (const client of clients) {
    const existing = await prisma.client.findFirst({ where: { phone: client.phone } });
    if (!existing) {
      await prisma.client.create({ data: client });
    }
  }

  console.log(`✅ Clients: ${clients.length} sample clients created`);

  console.log('\n🎉 Seed completed successfully!');
  console.log('📧 Admin: joresse@drfish.bj / DrFish2026!');
  console.log('📧 Agent: irene@drfish.bj / Agent2026!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

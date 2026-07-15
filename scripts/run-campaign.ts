/**
 * Run a campaign locally (no Vercel timeout limitation).
 * Usage: npx tsx scripts/run-campaign.ts <campaign-id>
 *
 * - Uses the WhatsApp session from DB (must have run wa-setup.ts first)
 * - Sends messages with proper delays, respects dailyLimit
 * - Progress saved to Neon DB in real time
 * - Safe to interrupt (Ctrl+C) and resume later
 */

import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import makeWASocket, {
  BufferJSON,
  DisconnectReason,
  fetchLatestBaileysVersion,
  initAuthCreds,
  SignalDataTypeMap,
  AuthenticationState,
  WASocket,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { PrismaClient } from '@prisma/client';
import { startOfDay } from 'date-fns';

const prisma = new PrismaClient();

// ── DB auth state ──────────────────────────────────────────────────────────────

type DataSet = { [T in keyof SignalDataTypeMap]?: { [id: string]: SignalDataTypeMap[T] | null } };

async function useDbAuthState() {
  const session = await prisma.whatsAppSession.findUnique({ where: { id: 'singleton' } });
  const creds = session?.creds
    ? JSON.parse(JSON.stringify(session.creds), BufferJSON.reviver)
    : initAuthCreds();
  const keysRaw = (session?.keys ?? {}) as Record<string, Record<string, unknown>>;
  const keys: Record<string, Record<string, unknown>> = JSON.parse(JSON.stringify(keysRaw), BufferJSON.reviver);

  async function persist() {
    await prisma.whatsAppSession.upsert({
      where: { id: 'singleton' },
      update: { creds: JSON.parse(JSON.stringify(creds, BufferJSON.replacer)), keys: JSON.parse(JSON.stringify(keys, BufferJSON.replacer)) },
      create: { id: 'singleton', creds: JSON.parse(JSON.stringify(creds, BufferJSON.replacer)), keys: JSON.parse(JSON.stringify(keys, BufferJSON.replacer)) },
    });
  }

  const state: AuthenticationState = {
    creds,
    keys: {
      get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
        const result: { [id: string]: SignalDataTypeMap[T] } = {};
        for (const id of ids) {
          const v = (keys[type] as Record<string, SignalDataTypeMap[T]> | undefined)?.[id];
          if (v !== undefined) result[id] = v;
        }
        return result;
      },
      set: async (data: DataSet) => {
        for (const type of Object.keys(data) as (keyof SignalDataTypeMap)[]) {
          if (!keys[type]) keys[type] = {};
          for (const [id, val] of Object.entries(data[type] ?? {})) {
            if (val === null) delete keys[type][id];
            else keys[type][id] = val as unknown;
          }
        }
        await persist();
      },
    },
  };
  return { state, saveCreds: persist };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)); }

function humanDelay(baseSeconds: number) {
  return Math.round((0.7 + Math.random() * 1.1) * baseSeconds * 1_000);
}

function longPause() { return Math.round((25 + Math.random() * 30) * 1_000); }

function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 8) return null;
  if (digits.startsWith('229') && digits.length >= 11) return digits;
  if (digits.length === 8) return `229${digits}`;
  if (digits.length >= 10) return digits;
  return null;
}

function addVariation(text: string): string {
  return text + ['​', '‌', '‍'][Math.floor(Math.random() * 3)];
}

function progress(sent: number, failed: number, total: number, remaining: number) {
  const done = sent + failed;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const bar = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5));
  process.stdout.write(`\r[${bar}] ${pct}%  ✓ ${sent} envoyés  ✗ ${failed} échoués  (${remaining} restants)   `);
}

// ── Open Baileys socket ────────────────────────────────────────────────────────

async function openSocket(): Promise<WASocket> {
  const { state, saveCreds } = await useDbAuthState();

  if (!state.creds.me) {
    throw new Error('WhatsApp non connecté — lancez d\'abord : npx tsx scripts/wa-setup.ts');
  }

  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1035194821] as [number, number, number], isLatest: false }));

  return new Promise<WASocket>((resolve, reject) => {
    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      browser: ['Dr Fish CRM', 'Chrome', '120.0'],
      connectTimeoutMs: 30_000,
      defaultQueryTimeoutMs: undefined,
    });

    sock.ev.on('creds.update', saveCreds);

    const timeout = setTimeout(() => {
      try { sock.ws.close(); } catch { /* ignore */ }
      reject(new Error('Timeout connexion WhatsApp (30s)'));
    }, 35_000);

    sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        clearTimeout(timeout);
        try { sock.ws.close(); } catch { /* ignore */ }
        reject(new Error('Session WhatsApp expirée — relancez : npx tsx scripts/wa-setup.ts --reset'));
      }
      if (connection === 'open') {
        clearTimeout(timeout);
        resolve(sock);
      }
      if (connection === 'close') {
        clearTimeout(timeout);
        const isLoggedOut = (lastDisconnect?.error as Boom)?.output?.statusCode === DisconnectReason.loggedOut;
        reject(new Error(isLoggedOut ? 'Déconnecté par WhatsApp — relancez wa-setup.ts --reset' : 'Connexion fermée'));
      }
    });
  });
}

// ── Send one message ───────────────────────────────────────────────────────────

async function sendOne(sock: WASocket, phone: string, message: string, mediaUrl: string | null) {
  const jid = `${phone}@s.whatsapp.net`;
  try {
    if (mediaUrl) {
      const res = await fetch(mediaUrl, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`Cannot fetch media: ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      const mime = res.headers.get('content-type') ?? 'application/octet-stream';
      const fileName = new URL(mediaUrl).pathname.split('/').pop() ?? 'fichier';
      if (mime.startsWith('image/')) await sock.sendMessage(jid, { image: buffer, caption: addVariation(message || '') });
      else if (mime.startsWith('video/')) await sock.sendMessage(jid, { video: buffer, caption: addVariation(message || '') });
      else await sock.sendMessage(jid, { document: buffer, mimetype: mime, fileName, caption: addVariation(message || '') });
    } else {
      await sock.sendMessage(jid, { text: addVariation(message) });
    }
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: (err instanceof Error ? err.message : String(err)).slice(0, 200) };
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const campaignId = process.argv[2];
  if (!campaignId) {
    console.error('\nUsage: npx tsx scripts/run-campaign.ts <campaign-id>\n');
    process.exit(1);
  }

  console.log('\n🐟 Dr Fish CRM — Envoi de campagne\n');
  console.log('Connexion à la base de données Neon...');

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) { console.error(`❌ Campagne "${campaignId}" introuvable.`); process.exit(1); }
  if (campaign.status === 'DONE') { console.log('✅ Cette campagne est déjà terminée.'); process.exit(0); }

  console.log(`\n📋 Campagne : ${campaign.name}`);
  console.log(`   Délai : ${campaign.baseDelaySeconds}s  |  Limite journalière : ${campaign.dailyLimit}\n`);

  // Load existing logs
  const existingLogs = await prisma.campaignLog.findMany({ where: { campaignId }, select: { phone: true, status: true } });
  const alreadySent = new Set(existingLogs.filter(l => l.status === 'SENT').map(l => l.phone));
  let sent = existingLogs.filter(l => l.status === 'SENT').length;
  let failed = existingLogs.filter(l => l.status === 'FAILED').length;

  // Build phone list
  let rawPhones: string[] = [];
  if (campaign.source === 'DB_CLIENTS') {
    const clients = await prisma.client.findMany({ where: { phone: { not: null }, sales: { some: {} } }, select: { phone: true } });
    rawPhones = clients.map(c => c.phone!);
  } else {
    rawPhones = campaign.phones;
  }

  const seen = new Set<string>();
  const phones: string[] = [];
  for (const raw of rawPhones) {
    const n = normalizePhone(raw);
    if (n && !seen.has(n)) { seen.add(n); phones.push(n); }
  }

  const remainingPhones = phones.filter(p => !alreadySent.has(p));

  await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'RUNNING', stopReason: null, totalTargets: phones.length, totalSent: sent, totalFailed: failed } });

  if (remainingPhones.length === 0) {
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'DONE' } });
    console.log('✅ Tous les messages ont déjà été envoyés.');
    process.exit(0);
  }

  console.log(`📱 Connexion à WhatsApp...`);
  const sock = await openSocket();
  console.log(`✅ Connecté ! (${campaign.name}: ${remainingPhones.length} numéros restants)\n`);

  // Handle Ctrl+C gracefully
  let stopped = false;
  process.on('SIGINT', async () => {
    stopped = true;
    console.log('\n\n⏸  Arrêt demandé — sauvegarde de la progression...');
    try { sock.ws.close(); } catch { /* ignore */ }
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'STOPPED', stopReason: 'Arrêt manuel', totalSent: sent, totalFailed: failed } }).catch(() => {});
    await prisma.$disconnect().catch(() => {});
    console.log(`✅ Progression sauvegardée : ${sent} envoyés, ${failed} échoués. Relancez pour continuer.\n`);
    process.exit(0);
  });

  for (const phone of remainingPhones) {
    if (stopped) break;

    // Check daily limit
    const todaySent = await prisma.campaignLog.count({ where: { campaignId, status: 'SENT', sentAt: { gte: startOfDay(new Date()) } } });
    if (todaySent >= campaign.dailyLimit) {
      console.log(`\n\n📅 Limite journalière atteinte (${campaign.dailyLimit} messages/jour). Relancez demain.\n`);
      await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'STOPPED', stopReason: 'DAILY_LIMIT', totalSent: sent, totalFailed: failed } });
      break;
    }

    const result = await sendOne(sock, phone, campaign.message, campaign.mediaUrl ?? null);

    if (result.ok) {
      sent++;
      await prisma.campaignLog.create({ data: { campaignId, phone, status: 'SENT' } });
    } else {
      failed++;
      await prisma.campaignLog.create({ data: { campaignId, phone, status: 'FAILED', error: result.error } });
    }

    await prisma.campaign.update({ where: { id: campaignId }, data: { totalSent: sent, totalFailed: failed } });
    progress(sent, failed, phones.length, remainingPhones.length - (sent + failed - (existingLogs.length > 0 ? existingLogs.filter(l=>l.status==='SENT').length + existingLogs.filter(l=>l.status==='FAILED').length : 0)));

    if (!stopped && remainingPhones.indexOf(phone) < remainingPhones.length - 1) {
      const delay = Math.random() < 1 / 8 ? longPause() : humanDelay(campaign.baseDelaySeconds);
      await sleep(delay);
    }
  }

  if (!stopped) {
    const remaining = phones.filter(p => !alreadySent.has(p)).length - (sent - (existingLogs.filter(l=>l.status==='SENT').length));
    const allDone = sent + failed >= phones.length || remaining <= 0;
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: allDone ? 'DONE' : 'STOPPED', totalSent: sent, totalFailed: failed },
    });
    console.log(`\n\n${allDone ? '🎉 Campagne terminée !' : '✅ Progression sauvegardée.'}`);
    console.log(`   ✓ ${sent} envoyés  ✗ ${failed} échoués\n`);
  }

  try { sock.ws.close(); } catch { /* ignore */ }
  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('\n❌ Erreur :', err.message);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});

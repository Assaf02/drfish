import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion, WASocket } from '@whiskeysockets/baileys';
import { useDbAuthState, clearWhatsAppSession } from '@/lib/whatsapp-auth';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { startOfDay } from 'date-fns';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 8) return null;
  if (digits.startsWith('229') && digits.length >= 11) return digits;
  if (digits.length === 8) return `229${digits}`;
  if (digits.length >= 10) return digits;
  return null;
}

function humanDelayMs(base: number) {
  return Math.round((0.7 + Math.random() * 1.1) * base * 1_000);
}

function longPauseMs() { return Math.round((25 + Math.random() * 30) * 1_000); }

function addVariation(text: string) {
  return text + ['​', '‌', '‍'][Math.floor(Math.random() * 3)];
}

async function openWASocket(): Promise<WASocket> {
  const { state, saveCreds } = await useDbAuthState();
  if (!state.creds.me) throw new Error('WA_NOT_CONNECTED');

  const { version } = await fetchLatestBaileysVersion().catch(() => ({
    version: [2, 3000, 1035194821] as [number, number, number],
    isLatest: false,
  }));

  return new Promise<WASocket>((resolve, reject) => {
    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      browser: ['Dr Fish CRM', 'Chrome', '120.0'],
      connectTimeoutMs: 20_000,
      defaultQueryTimeoutMs: undefined,
    });

    sock.ev.on('creds.update', saveCreds);

    const timeout = setTimeout(() => {
      try { sock.ws.close(); } catch { /* ignore */ }
      reject(new Error('WA_TIMEOUT'));
    }, 22_000);

    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        clearTimeout(timeout);
        try { sock.ws.close(); } catch { /* ignore */ }
        await clearWhatsAppSession().catch(() => {});
        reject(new Error('WA_QR_NEEDED'));
      }
      if (connection === 'open') {
        clearTimeout(timeout);
        resolve(sock);
      }
      if (connection === 'close') {
        clearTimeout(timeout);
        const isLoggedOut = (lastDisconnect?.error as Boom)?.output?.statusCode === DisconnectReason.loggedOut;
        if (isLoggedOut) await clearWhatsAppSession().catch(() => {});
        reject(new Error(isLoggedOut ? 'WA_LOGGED_OUT' : 'WA_CLOSED'));
      }
    });
  });
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: campaignId } = params;
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return NextResponse.json({ status: 'not_found' }, { status: 404 });

  // Check daily limit
  const todaySent = await prisma.campaignLog.count({
    where: { campaignId, status: 'SENT', sentAt: { gte: startOfDay(new Date()) } },
  });
  if (todaySent >= campaign.dailyLimit) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data:  { status: 'STOPPED', stopReason: 'DAILY_LIMIT' },
    });
    return NextResponse.json({ status: 'daily_limit', dailyLimit: campaign.dailyLimit });
  }

  // Find next phone to send
  const existingLogs = await prisma.campaignLog.findMany({
    where: { campaignId }, select: { phone: true, status: true },
  });
  const alreadyDone = new Set(existingLogs.map(l => l.phone));

  let rawPhones: string[] = [];
  if (campaign.source === 'DB_CLIENTS') {
    const clients = await prisma.client.findMany({
      where: { phone: { not: null }, sales: { some: {} } }, select: { phone: true },
    });
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

  await prisma.campaign.update({
    where: { id: campaignId },
    data:  { totalTargets: phones.length },
  });

  const nextPhone = phones.find(p => !alreadyDone.has(p));
  if (!nextPhone) {
    const sent   = existingLogs.filter(l => l.status === 'SENT').length;
    const failed = existingLogs.filter(l => l.status === 'FAILED').length;
    await prisma.campaign.update({
      where: { id: campaignId },
      data:  { status: 'DONE', totalSent: sent, totalFailed: failed },
    });
    return NextResponse.json({ status: 'done', totalSent: sent, totalFailed: failed });
  }

  // Connect to WhatsApp and send
  let sock: WASocket | null = null;
  try {
    sock = await openWASocket();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const waErr = msg === 'WA_NOT_CONNECTED' || msg === 'WA_QR_NEEDED' || msg === 'WA_LOGGED_OUT';
    return NextResponse.json({ status: 'disconnected', error: msg, needsScan: waErr });
  }

  let ok = false;
  let sendError: string | undefined;

  try {
    const jid = `${nextPhone}@s.whatsapp.net`;
    if (campaign.mediaUrl) {
      const mediaRes = await fetch(campaign.mediaUrl, { signal: AbortSignal.timeout(15_000) });
      if (!mediaRes.ok) throw new Error(`Cannot fetch media: ${mediaRes.status}`);
      const buffer   = Buffer.from(await mediaRes.arrayBuffer());
      const mime     = mediaRes.headers.get('content-type') ?? 'application/octet-stream';
      const fileName = new URL(campaign.mediaUrl).pathname.split('/').pop() ?? 'fichier';
      if (mime.startsWith('image/')) {
        await sock.sendMessage(jid, { image: buffer, caption: addVariation(campaign.message || '') });
      } else if (mime.startsWith('video/')) {
        await sock.sendMessage(jid, { video: buffer, caption: addVariation(campaign.message || '') });
      } else {
        await sock.sendMessage(jid, { document: buffer, mimetype: mime, fileName, caption: addVariation(campaign.message || '') });
      }
    } else {
      await sock.sendMessage(jid, { text: addVariation(campaign.message) });
    }
    ok = true;
  } catch (err) {
    sendError = (err instanceof Error ? err.message : String(err)).slice(0, 200);
  } finally {
    try { sock.ws.close(); } catch { /* ignore */ }
  }

  await prisma.campaignLog.create({
    data: { campaignId, phone: nextPhone, status: ok ? 'SENT' : 'FAILED', error: sendError ?? null },
  });

  const newSent   = existingLogs.filter(l => l.status === 'SENT').length   + (ok ? 1 : 0);
  const newFailed = existingLogs.filter(l => l.status === 'FAILED').length + (ok ? 0 : 1);

  await prisma.campaign.update({
    where: { id: campaignId },
    data:  { status: 'RUNNING', totalSent: newSent, totalFailed: newFailed },
  });

  const remaining  = phones.filter(p => !alreadyDone.has(p)).length - 1;
  const delayMs    = remaining > 0
    ? (Math.random() < 1 / 8 ? longPauseMs() : humanDelayMs(campaign.baseDelaySeconds))
    : 0;

  return NextResponse.json({
    status:       ok ? 'sent' : 'failed',
    phone:        nextPhone,
    error:        sendError,
    delayMs,
    remaining,
    totalSent:    newSent,
    totalFailed:  newFailed,
    totalTargets: phones.length,
  });
}

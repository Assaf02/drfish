import { prisma } from './prisma';
import { normalizePhone as normPhone } from './phoneUtils';
import { useDbAuthState, clearWhatsAppSession } from './whatsapp-auth';
import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion, WASocket } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { startOfDay } from 'date-fns';

const stopFlags = new Map<string, boolean>();

export { normalizePhone } from './phoneUtils';

// ── Timing ─────────────────────────────────────────────────────────────────────

function humanDelay(baseSeconds: number): number {
  return Math.round((0.7 + Math.random() * 1.1) * baseSeconds * 1_000);
}

function longPause(): number {
  return Math.round((25 + Math.random() * 30) * 1_000);
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

const VARIATIONS = ['​', '‌', '‍'];
function addVariation(text: string): string {
  return text + VARIATIONS[Math.floor(Math.random() * VARIATIONS.length)];
}

// ── Open Baileys connection ────────────────────────────────────────────────────

function openWASocket(): Promise<WASocket> {
  return new Promise(async (resolve, reject) => {
    try {
      const { state, saveCreds } = await useDbAuthState();
      const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1035194821] as [number, number, number], isLatest: false }));

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
          // QR = session expired in WhatsApp. Clear DB so status shows "disconnected".
          clearTimeout(timeout);
          try { sock.ws.close(); } catch { /* ignore */ }
          clearWhatsAppSession().catch(() => {});
          reject(new Error('WhatsApp déconnecté — scannez le QR code depuis la page Campagnes'));
        }
        if (connection === 'open') {
          clearTimeout(timeout);
          resolve(sock);
        }
        if (connection === 'close') {
          clearTimeout(timeout);
          const loggedOut =
            (lastDisconnect?.error as Boom)?.output?.statusCode === DisconnectReason.loggedOut;
          reject(new Error(loggedOut ? 'Session WhatsApp expirée — rescannez le QR' : 'Connexion fermée'));
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

// ── Send one message ────────────────────────────────────────────────────────────

async function sendWA(
  sock:     WASocket,
  phone:    string,
  message:  string,
  mediaUrl: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const jid = `${phone}@s.whatsapp.net`;
  try {
    if (mediaUrl) {
      const mediaRes = await fetch(mediaUrl, { signal: AbortSignal.timeout(30_000) });
      if (!mediaRes.ok) throw new Error(`Cannot fetch media: HTTP ${mediaRes.status}`);
      const buffer = Buffer.from(await mediaRes.arrayBuffer());
      const mime   = mediaRes.headers.get('content-type') ?? 'application/octet-stream';
      const fileName = new URL(mediaUrl).pathname.split('/').pop() ?? 'fichier';

      if (mime.startsWith('image/')) {
        await sock.sendMessage(jid, { image: buffer, caption: addVariation(message || '') });
      } else if (mime.startsWith('video/')) {
        await sock.sendMessage(jid, { video: buffer, caption: addVariation(message || '') });
      } else {
        await sock.sendMessage(jid, { document: buffer, mimetype: mime, fileName, caption: addVariation(message || '') });
      }
    } else {
      await sock.sendMessage(jid, { text: addVariation(message) });
    }
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: (err instanceof Error ? err.message : String(err)).slice(0, 200) };
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function stopCampaign(campaignId: string): void {
  stopFlags.set(campaignId, true);
}

export async function sendCampaign(campaignId: string): Promise<void> {
  stopFlags.set(campaignId, false);
  let sock: WASocket | null = null;

  try {
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new Error('Campaign not found');

    const existingLogs = await prisma.campaignLog.findMany({
      where:  { campaignId },
      select: { phone: true, status: true },
    });
    const isResume    = existingLogs.length > 0;
    const alreadySent = new Set(existingLogs.filter(l => l.status === 'SENT').map(l => l.phone));
    let sent          = existingLogs.filter(l => l.status === 'SENT').length;
    let failed        = existingLogs.filter(l => l.status === 'FAILED').length;

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'RUNNING', stopReason: null, totalSent: sent, totalFailed: failed,
              ...(isResume ? {} : { totalSkipped: 0 }) },
    });

    let rawPhones: string[] = [];
    if (campaign.source === 'DB_CLIENTS') {
      const clients = await prisma.client.findMany({
        where:  { phone: { not: null }, sales: { some: {} } },
        select: { phone: true },
      });
      rawPhones = clients.map((c) => c.phone!);
    } else {
      rawPhones = campaign.phones;
    }

    const seen = new Set<string>();
    const phones: string[] = [];
    for (const raw of rawPhones) {
      const n = normPhone(raw);
      if (n && !seen.has(n)) { seen.add(n); phones.push(n); }
    }

    const remainingPhones = phones.filter(p => !alreadySent.has(p));
    if (!isResume) {
      await prisma.campaign.update({ where: { id: campaignId }, data: { totalTargets: phones.length } });
    }

    if (remainingPhones.length === 0) {
      await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'DONE', totalSent: sent, totalFailed: failed } });
      return;
    }

    // Connect Baileys once for the entire campaign
    sock = await openWASocket();

    for (const phone of remainingPhones) {
      if (stopFlags.get(campaignId)) break;

      const freshRow = await prisma.campaign.findUnique({
        where: { id: campaignId }, select: { status: true },
      });
      if (!freshRow || freshRow.status === 'STOPPED') break;

      if (sent > 0 && sent % 10 === 0) {
        const todaySent = await prisma.campaignLog.count({
          where: { campaignId, status: 'SENT', sentAt: { gte: startOfDay(new Date()) } },
        });
        if (todaySent >= campaign.dailyLimit) {
          await prisma.campaign.update({
            where: { id: campaignId },
            data:  { status: 'STOPPED', stopReason: 'DAILY_LIMIT', totalSent: sent, totalFailed: failed },
          });
          return;
        }
      }

      const result = await sendWA(sock, phone, campaign.message, campaign.mediaUrl ?? null);

      if (result.ok) {
        sent++;
        await prisma.campaignLog.create({ data: { campaignId, phone, status: 'SENT' } });
      } else {
        failed++;
        await prisma.campaignLog.create({ data: { campaignId, phone, status: 'FAILED', error: result.error } });
      }

      await prisma.campaign.update({ where: { id: campaignId }, data: { totalSent: sent, totalFailed: failed } });
      await sleep(Math.random() < 1 / 8 ? longPause() : humanDelay(campaign.baseDelaySeconds));
    }

    const finalRow = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { status: true } });
    if (finalRow?.status === 'RUNNING') {
      await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'DONE', totalSent: sent, totalFailed: failed } });
    }
  } catch (err) {
    console.error(`[Campaign ${campaignId}] Fatal:`, err);
    const errMsg = err instanceof Error ? err.message : String(err);
    await prisma.campaign.update({
      where: { id: campaignId },
      data:  { status: 'STOPPED', stopReason: errMsg.includes('QR') ? 'DISCONNECTED' : 'ERROR' },
    }).catch(() => {});
  } finally {
    stopFlags.delete(campaignId);
    try { sock?.ws?.close(); } catch { /* ignore */ }
  }
}

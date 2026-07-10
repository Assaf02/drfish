import { prisma } from './prisma';
import { useDbAuthState } from './whatsapp-auth';
import makeWASocket, { DisconnectReason, WASocket } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { startOfDay } from 'date-fns';

// ── In-memory fast-path stop ───────────────────────────────────────────────────
const stopFlags = new Map<string, boolean>();

// ── Phone utilities ────────────────────────────────────────────────────────────

export function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 8) return null;
  if (digits.startsWith('229') && digits.length >= 11) return digits;
  if (digits.length === 8) return `229${digits}`;
  if (digits.length >= 10) return digits;
  return null;
}

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

// ── Anti-ban text variation ────────────────────────────────────────────────────

const VARIATIONS = ['​', '‌', '‍'];
function addVariation(text: string): string {
  return text + VARIATIONS[Math.floor(Math.random() * VARIATIONS.length)];
}

// ── Baileys connection ─────────────────────────────────────────────────────────

function openWASocket(onQr?: () => void): Promise<WASocket> {
  return new Promise(async (resolve, reject) => {
    const { state, saveCreds } = await useDbAuthState().catch(reject as () => void) ?? { state: null, saveCreds: null };
    if (!state) return;

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      browser: ['Dr Fish CRM', 'Chrome', '120.0'],
      connectTimeoutMs: 30_000,
    });

    sock.ev.on('creds.update', saveCreds!);

    const timeout = setTimeout(() => {
      sock.ws?.close();
      reject(new Error('Timeout connexion WhatsApp (30s)'));
    }, 35_000);

    sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        // QR required means not connected — stop campaign
        onQr?.();
        clearTimeout(timeout);
        sock.ws?.close();
        reject(new Error('WhatsApp déconnecté — scannez le QR code'));
        return;
      }
      if (connection === 'open') {
        clearTimeout(timeout);
        resolve(sock);
      }
      if (connection === 'close') {
        clearTimeout(timeout);
        const loggedOut = (lastDisconnect?.error as Boom)?.output?.statusCode === DisconnectReason.loggedOut;
        reject(new Error(loggedOut ? 'Session WhatsApp expirée' : 'Connexion fermée'));
      }
    });
  });
}

// ── Message sending ────────────────────────────────────────────────────────────

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

      const buffer   = Buffer.from(await mediaRes.arrayBuffer());
      const mime     = mediaRes.headers.get('content-type') ?? 'application/octet-stream';
      const fileName = new URL(mediaUrl).pathname.split('/').pop() ?? 'fichier';

      if (mime.startsWith('image/')) {
        await sock.sendMessage(jid, { image: buffer, caption: addVariation(message || ''), mimetype: mime as Parameters<WASocket['sendMessage']>[1] extends { mimetype?: infer M } ? M : string });
      } else if (mime.startsWith('video/')) {
        await sock.sendMessage(jid, { video: buffer, caption: addVariation(message || '') });
      } else {
        await sock.sendMessage(jid, { document: buffer, caption: addVariation(message || ''), mimetype: mime, fileName });
      }
    } else {
      await sock.sendMessage(jid, { text: addVariation(message) });
    }
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg.slice(0, 200) };
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

    // ── Resume detection ────────────────────────────────────────────────────
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
      data: {
        status:      'RUNNING',
        stopReason:  null,
        totalSent:   sent,
        totalFailed: failed,
        ...(isResume ? {} : { totalSkipped: 0 }),
      },
    });

    // ── Resolve phones ──────────────────────────────────────────────────────
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
      const n = normalizePhone(raw);
      if (n && !seen.has(n)) { seen.add(n); phones.push(n); }
    }

    const remainingPhones = phones.filter(p => !alreadySent.has(p));
    if (!isResume) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data:  { totalTargets: phones.length },
      });
    }

    if (remainingPhones.length === 0) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data:  { status: 'DONE', totalSent: sent, totalFailed: failed },
      });
      return;
    }

    // ── Open Baileys connection once ────────────────────────────────────────
    sock = await openWASocket(async () => {
      // QR required = WhatsApp not connected
      await prisma.campaign.update({
        where: { id: campaignId },
        data:  { status: 'STOPPED', stopReason: 'DISCONNECTED', totalSent: sent, totalFailed: failed },
      });
    });

    // ── Send loop ───────────────────────────────────────────────────────────
    for (const phone of remainingPhones) {
      if (stopFlags.get(campaignId)) break;

      // DB stop check (cross-process)
      const freshRow = await prisma.campaign.findUnique({
        where:  { id: campaignId },
        select: { status: true },
      });
      if (!freshRow || freshRow.status === 'STOPPED') break;

      // Daily limit check every 10 sends
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

      await prisma.campaign.update({
        where: { id: campaignId },
        data:  { totalSent: sent, totalFailed: failed },
      });

      await sleep(Math.random() < 1 / 8 ? longPause() : humanDelay(campaign.baseDelaySeconds));
    }

    // ── Final status ────────────────────────────────────────────────────────
    const finalRow = await prisma.campaign.findUnique({
      where:  { id: campaignId },
      select: { status: true },
    });
    if (finalRow?.status === 'RUNNING') {
      await prisma.campaign.update({
        where: { id: campaignId },
        data:  { status: 'DONE', totalSent: sent, totalFailed: failed },
      });
    }
  } catch (err) {
    console.error(`[Campaign ${campaignId}] Fatal:`, err);
    await prisma.campaign
      .update({ where: { id: campaignId }, data: { status: 'STOPPED', stopReason: 'ERROR' } })
      .catch(() => {});
  } finally {
    stopFlags.delete(campaignId);
    try { sock?.ws?.close(); } catch { /* ignore */ }
  }
}

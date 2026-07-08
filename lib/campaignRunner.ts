import { prisma } from './prisma';
import { startOfDay } from 'date-fns';

const GOWA_URL       = process.env.GOWA_URL        ?? '';
const GOWA_DEVICE_ID = process.env.GOWA_DEVICE_ID ?? 'drfish';

// In-memory fast-path stop (works when start + stop hit the same process)
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

function toWaPhone(phone: string): string {
  return `${phone}@s.whatsapp.net`;
}

// ── Timing ─────────────────────────────────────────────────────────────────────

function humanDelay(baseSeconds: number): number {
  const factor = 0.7 + Math.random() * 1.1;
  return Math.round(baseSeconds * factor * 1_000);
}

function longPause(): number {
  return Math.round((25 + Math.random() * 30) * 1_000);
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

// ── Message sending ────────────────────────────────────────────────────────────

const VARIATIONS = ['​', '‌', '‍'];
function addVariation(text: string): string {
  return text + VARIATIONS[Math.floor(Math.random() * VARIATIONS.length)];
}

async function sendWA(
  phone:    string, // e.g. "229xxxxxxxx@s.whatsapp.net"
  message:  string,
  mediaUrl: string | null,
): Promise<{ ok: boolean; error?: string }> {
  try {
    let res: Response;

    if (mediaUrl) {
      // Fetch file from storage then forward to GoWA as multipart
      const mediaRes = await fetch(mediaUrl, { signal: AbortSignal.timeout(30_000) });
      if (!mediaRes.ok) throw new Error(`Cannot fetch media: HTTP ${mediaRes.status}`);

      const buffer      = await mediaRes.arrayBuffer();
      const mimeType    = mediaRes.headers.get('content-type') ?? 'application/octet-stream';
      const fileName    = new URL(mediaUrl).pathname.split('/').pop() ?? 'fichier';

      const form = new FormData();
      form.append('phone',   phone);
      form.append('caption', message || '');

      let endpoint = '/send/document';
      if (mimeType.startsWith('image/')) {
        endpoint = '/send/image';
        form.append('image',    new Blob([buffer], { type: mimeType }), fileName);
      } else if (mimeType.startsWith('video/')) {
        endpoint = '/send/video';
        form.append('video',    new Blob([buffer], { type: mimeType }), fileName);
      } else {
        form.append('document', new Blob([buffer], { type: mimeType }), fileName);
      }

      res = await fetch(`${GOWA_URL}${endpoint}`, {
        method:  'POST',
        headers: { 'X-Device-Id': GOWA_DEVICE_ID },
        body:    form,
        signal:  AbortSignal.timeout(60_000),
      });
    } else {
      res = await fetch(`${GOWA_URL}/send/message`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-Device-Id': GOWA_DEVICE_ID },
        body:    JSON.stringify({ phone, message: addVariation(message) }),
        signal:  AbortSignal.timeout(30_000),
      });
    }

    if (res.ok) return { ok: true };
    const raw = await res.text().catch(() => '');
    let errMsg = raw.slice(0, 200) || `HTTP ${res.status}`;
    try {
      const j = JSON.parse(raw);
      if (j?.message) errMsg = j.message;
      if (j?.error)   errMsg = j.error;
    } catch { /* not JSON */ }
    return { ok: false, error: errMsg };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('abort') || msg.includes('timeout')) {
      return { ok: false, error: "Timeout — GoWA n'a pas répondu à temps" };
    }
    return { ok: false, error: msg.slice(0, 200) };
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function stopCampaign(campaignId: string): void {
  stopFlags.set(campaignId, true);
}

export function isCampaignRunning(campaignId: string): boolean {
  return stopFlags.get(campaignId) === false;
}

export async function sendCampaign(campaignId: string): Promise<void> {
  stopFlags.set(campaignId, false);

  try {
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new Error('Campaign not found');

    // ── Resume detection ──────────────────────────────────────────────────────
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

    // ── Resolve phones ────────────────────────────────────────────────────────
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

    // Skip already-sent on resume; update targets only on fresh start
    const remainingPhones = phones.filter(p => !alreadySent.has(p));

    if (!isResume) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data:  { totalTargets: phones.length },
      });
    }

    for (const phone of remainingPhones) {
      // ── Stop: in-memory fast path ─────────────────────────────────────────
      if (stopFlags.get(campaignId)) return;

      // ── Stop: DB check (cross-process — real Vercel fix) ──────────────────
      const freshRow = await prisma.campaign.findUnique({
        where:  { id: campaignId },
        select: { status: true },
      });
      if (!freshRow || freshRow.status === 'STOPPED') {
        await prisma.campaign.update({
          where: { id: campaignId },
          data:  { totalSent: sent, totalFailed: failed },
        });
        return;
      }

      // ── Daily limit (check every 10 sends) ────────────────────────────────
      if (sent > 0 && sent % 10 === 0) {
        const todaySent = await prisma.campaignLog.count({
          where: { campaignId, status: 'SENT', sentAt: { gte: startOfDay(new Date()) } },
        });
        if (todaySent >= campaign.dailyLimit) {
          await prisma.campaign.update({
            where: { id: campaignId },
            data:  { status: 'STOPPED', totalSent: sent, totalFailed: failed, stopReason: 'DAILY_LIMIT' },
          });
          return;
        }
      }

      // ── Send ──────────────────────────────────────────────────────────────
      const result = await sendWA(toWaPhone(phone), campaign.message, campaign.mediaUrl ?? null);

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

    await prisma.campaign.update({
      where: { id: campaignId },
      data:  { status: 'DONE', totalSent: sent, totalFailed: failed },
    });
  } catch (err) {
    console.error(`[Campaign ${campaignId}] Fatal:`, err);
    await prisma.campaign
      .update({ where: { id: campaignId }, data: { status: 'STOPPED', stopReason: 'ERROR' } })
      .catch(() => {});
  } finally {
    stopFlags.delete(campaignId);
  }
}

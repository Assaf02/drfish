import { prisma } from './prisma';
import { startOfDay } from 'date-fns';

const GREEN_API_URL      = process.env.GREEN_API_URL       ?? '';
const GREEN_API_INSTANCE = process.env.GREEN_API_INSTANCE_ID ?? '';
const GREEN_API_TOKEN    = process.env.GREEN_API_TOKEN      ?? '';

function greenApiBase() {
  return `${GREEN_API_URL}/waInstance${GREEN_API_INSTANCE}`;
}

export function greenApiConfigured(): boolean {
  return !!(GREEN_API_URL && GREEN_API_INSTANCE && GREEN_API_TOKEN);
}

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
  return `${phone}@c.us`;
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

// ── Anti-ban: WhatsApp registration check ─────────────────────────────────────

async function checkIsOnWhatsApp(phone: string): Promise<boolean> {
  try {
    const res = await fetch(`${greenApiBase()}/checkWhatsapp/${GREEN_API_TOKEN}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ phoneNumber: phone }),
      signal:  AbortSignal.timeout(8_000),
    });
    if (!res.ok) return true;
    const data = await res.json();
    return data?.existsWhatsapp === true;
  } catch {
    return true;
  }
}

async function validatePhonesBatch(phones: string[], campaignId: string): Promise<{ valid: string[]; skipped: number }> {
  const BATCH = 3;
  const valid: string[] = [];
  let skipped = 0;

  for (let i = 0; i < phones.length; i += BATCH) {
    if (stopFlags.get(campaignId)) break;
    const batch = phones.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(async (p) => ({ phone: p, ok: await checkIsOnWhatsApp(p) })));
    for (const r of results) {
      if (r.ok) valid.push(r.phone);
      else skipped++;
    }
    await prisma.campaign.update({ where: { id: campaignId }, data: { totalSkipped: skipped } });
    if (i + BATCH < phones.length) await sleep(600);
  }

  return { valid, skipped };
}

// ── Message sending ────────────────────────────────────────────────────────────

const VARIATIONS = ['​', '‌', '‍'];
function addVariation(text: string): string {
  return text + VARIATIONS[Math.floor(Math.random() * VARIATIONS.length)];
}

function parseGreenApiError(raw: string, httpStatus: number): string {
  try {
    const j = JSON.parse(raw);
    if (j?.invokeStatus) return `Green API: ${j.invokeStatus}`;
    if (j?.message)      return j.message;
    if (j?.error)        return j.error;
  } catch { /* not JSON */ }
  return raw.slice(0, 200) || `HTTP ${httpStatus}`;
}

async function sendWA(
  chatId:   string,
  message:  string,
  mediaUrl: string | null,
): Promise<{ ok: boolean; error?: string }> {
  try {
    let res: Response;

    if (mediaUrl) {
      const fileName = mediaUrl.split('/').pop()?.split('?')[0] ?? 'fichier';
      res = await fetch(`${greenApiBase()}/sendFileByUrl/${GREEN_API_TOKEN}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ chatId, urlFile: mediaUrl, fileName, caption: message || undefined }),
        signal:  AbortSignal.timeout(45_000),
      });
    } else {
      res = await fetch(`${greenApiBase()}/sendMessage/${GREEN_API_TOKEN}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ chatId, message: addVariation(message) }),
        signal:  AbortSignal.timeout(30_000),
      });
    }

    if (res.ok) return { ok: true };
    const raw    = await res.text().catch(() => '');
    const errMsg = parseGreenApiError(raw, res.status);
    if (errMsg.includes('notAuthorized') || errMsg.includes('unauthorized')) {
      return { ok: false, error: 'WhatsApp déconnecté — rescannez le QR dans Campagnes' };
    }
    return { ok: false, error: errMsg };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('abort') || msg.includes('timeout')) {
      return { ok: false, error: "Timeout — Green API n'a pas répondu à temps" };
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
    // Load existing logs so we can skip already-sent numbers on resume
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

    // ── Resolve raw phone list ────────────────────────────────────────────────
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

    // Normalize + deduplicate
    const seen = new Set<string>();
    const phones: string[] = [];
    for (const raw of rawPhones) {
      const n = normalizePhone(raw);
      if (n && !seen.has(n)) { seen.add(n); phones.push(n); }
    }

    // Validate only on fresh start (already done on previous run)
    let validPhones = phones;
    if (!isResume && campaign.validateNumbers) {
      const { valid } = await validatePhonesBatch(phones, campaignId);
      validPhones = valid;
    }

    // Skip numbers already successfully received
    const remainingPhones = validPhones.filter(p => !alreadySent.has(p));

    await prisma.campaign.update({
      where: { id: campaignId },
      data:  { totalTargets: isResume ? campaign.totalTargets : validPhones.length },
    });

    for (const phone of remainingPhones) {
      // ── Stop: in-memory fast path (same process) ──────────────────────────
      if (stopFlags.get(campaignId)) return;

      // ── Stop: DB check — the real cross-process fix on Vercel ────────────
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

      // ── Daily limit (every 10 sends) ──────────────────────────────────────
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
        if (result.error?.includes('déconnecté') || result.error?.includes('notAuthorized')) {
          await prisma.campaign.update({
            where: { id: campaignId },
            data:  { status: 'STOPPED', totalSent: sent, totalFailed: failed, stopReason: 'DISCONNECTED' },
          });
          return;
        }
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

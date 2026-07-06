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

// Module-level singleton — persists across requests in the same Node.js process
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
  const factor = 0.7 + Math.random() * 1.1; // 0.7–1.8×
  return Math.round(baseSeconds * factor * 1_000);
}

function longPause(): number {
  return Math.round((25 + Math.random() * 30) * 1_000); // 25–55 s
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

// ── Anti-ban: WhatsApp registration check ─────────────────────────────────────
// Verifies that the number actually has a WhatsApp account before sending.
// Avoids sending to dead numbers (which triggers spam flags).

async function checkIsOnWhatsApp(phone: string): Promise<boolean> {
  try {
    const res = await fetch(`${greenApiBase()}/checkWhatsapp/${GREEN_API_TOKEN}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ phoneNumber: phone }),
      signal:  AbortSignal.timeout(8_000),
    });
    if (!res.ok) return true; // assume valid if check fails
    const data = await res.json();
    return data?.existsWhatsapp === true;
  } catch {
    return true; // assume valid on network error
  }
}

async function validatePhonesBatch(phones: string[], campaignId: string): Promise<{ valid: string[]; skipped: number }> {
  const BATCH = 3; // 3 concurrent checks — conservative to avoid rate limiting
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
    // Persist running skip count so the UI can show progress
    await prisma.campaign.update({ where: { id: campaignId }, data: { totalSkipped: skipped } });
    if (i + BATCH < phones.length) await sleep(600);
  }

  return { valid, skipped };
}

// ── Message sending ────────────────────────────────────────────────────────────

// Tiny per-message variation to avoid identical-message spam detection.
// Uses zero-width non-joiners which are invisible and survive copy-paste.
const VARIATIONS = ['​', '‌', '‍'];
function addVariation(text: string): string {
  return text + VARIATIONS[Math.floor(Math.random() * VARIATIONS.length)];
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
        body:    JSON.stringify({
          chatId,
          urlFile:  mediaUrl,
          fileName,
          caption:  message || undefined,
        }),
        signal: AbortSignal.timeout(30_000),
      });
    } else {
      res = await fetch(`${greenApiBase()}/sendMessage/${GREEN_API_TOKEN}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ chatId, message: addVariation(message) }),
        signal:  AbortSignal.timeout(15_000),
      });
    }

    if (res.ok) return { ok: true };
    const err = (await res.text().catch(() => `HTTP ${res.status}`)).slice(0, 500);
    return { ok: false, error: err };
  } catch (err: unknown) {
    return { ok: false, error: (err instanceof Error ? err.message : String(err)).slice(0, 500) };
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

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'RUNNING', totalSent: 0, totalFailed: 0, totalSkipped: 0, stopReason: null },
    });

    // ── Resolve raw phone list ────────────────────────────────────────────────
    let rawPhones: string[] = [];
    if (campaign.source === 'DB_CLIENTS') {
      const clients = await prisma.client.findMany({
        where: { phone: { not: null }, sales: { some: {} } },
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

    // ── Anti-ban: pre-validate numbers on WhatsApp ────────────────────────────
    let validPhones = phones;
    if (campaign.validateNumbers) {
      const { valid } = await validatePhonesBatch(phones, campaignId);
      validPhones = valid;
    }

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { totalTargets: validPhones.length },
    });

    let sent   = 0;
    let failed = 0;

    for (const phone of validPhones) {
      // ── Stop signal ──────────────────────────────────────────────────────
      if (stopFlags.get(campaignId)) {
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { status: 'STOPPED', totalSent: sent, totalFailed: failed, stopReason: 'MANUAL' },
        });
        return;
      }

      // ── Daily limit check (every 10 sends to limit DB queries) ───────────
      if (sent > 0 && sent % 10 === 0) {
        const todaySent = await prisma.campaignLog.count({
          where: {
            campaignId,
            status: 'SENT',
            sentAt: { gte: startOfDay(new Date()) },
          },
        });
        if (todaySent >= campaign.dailyLimit) {
          await prisma.campaign.update({
            where: { id: campaignId },
            data: {
              status:     'STOPPED',
              totalSent:  sent,
              totalFailed: failed,
              stopReason: 'DAILY_LIMIT',
            },
          });
          return;
        }
      }

      // ── Send ─────────────────────────────────────────────────────────────
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
        data: { totalSent: sent, totalFailed: failed },
      });

      // ── Humanized pacing — ~1/8 chance of a long pause ───────────────────
      await sleep(Math.random() < 1 / 8 ? longPause() : humanDelay(campaign.baseDelaySeconds));
    }

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'DONE', totalSent: sent, totalFailed: failed },
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

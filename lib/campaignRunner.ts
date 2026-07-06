import { prisma } from './prisma';

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
const stopFlags = new Map<string, boolean>(); // campaignId → shouldStop

// ── Phone utilities ────────────────────────────────────────────────────────────

export function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 8) return null;
  // Already has Bénin prefix 229
  if (digits.startsWith('229') && digits.length >= 11) return digits;
  // 8-digit local number → prepend 229
  if (digits.length === 8) return `229${digits}`;
  // Other international numbers (≥ 10 digits)
  if (digits.length >= 10) return digits;
  return null;
}

function toWaPhone(phone: string): string {
  return `${phone}@c.us`;
}

// ── Timing utilities ───────────────────────────────────────────────────────────

function humanDelay(baseSeconds: number): number {
  const factor = 0.7 + Math.random() * 1.1; // 0.7 – 1.8
  return Math.round(baseSeconds * factor * 1000);
}

function longPause(): number {
  return Math.round((25 + Math.random() * 30) * 1000); // 25–55 s
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function stopCampaign(campaignId: string): void {
  stopFlags.set(campaignId, true);
}

export function isCampaignRunning(campaignId: string): boolean {
  return stopFlags.get(campaignId) === false;
}

export async function sendCampaign(campaignId: string): Promise<void> {
  stopFlags.set(campaignId, false); // mark as running

  try {
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new Error('Campaign not found');

    await prisma.campaign.update({
      where: { id: campaignId },
      data:  { status: 'RUNNING', totalSent: 0, totalFailed: 0 },
    });

    // Resolve phone list
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

    await prisma.campaign.update({
      where: { id: campaignId },
      data:  { totalTargets: phones.length },
    });

    let sent   = 0;
    let failed = 0;

    for (const phone of phones) {
      // Check stop signal before every send
      if (stopFlags.get(campaignId)) {
        await prisma.campaign.update({
          where: { id: campaignId },
          data:  { status: 'STOPPED', totalSent: sent, totalFailed: failed },
        });
        return;
      }

      try {
        const res = await fetch(
          `${greenApiBase()}/sendMessage/${GREEN_API_TOKEN}`,
          {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ chatId: toWaPhone(phone), message: campaign.message }),
            signal:  AbortSignal.timeout(15_000),
          },
        );

        if (res.ok) {
          sent++;
          await prisma.campaignLog.create({
            data: { campaignId, phone, status: 'SENT' },
          });
        } else {
          const err = (await res.text().catch(() => `HTTP ${res.status}`)).slice(0, 500);
          failed++;
          await prisma.campaignLog.create({
            data: { campaignId, phone, status: 'FAILED', error: err },
          });
        }
      } catch (err: unknown) {
        failed++;
        const msg = (err instanceof Error ? err.message : String(err)).slice(0, 500);
        await prisma.campaignLog.create({
          data: { campaignId, phone, status: 'FAILED', error: msg },
        });
      }

      // Persist progress counters in real time
      await prisma.campaign.update({
        where: { id: campaignId },
        data:  { totalSent: sent, totalFailed: failed },
      });

      // Humanized pacing: ~1/8 chance of a long pause
      if (Math.random() < 1 / 8) {
        await sleep(longPause());
      } else {
        await sleep(humanDelay(campaign.baseDelaySeconds));
      }
    }

    await prisma.campaign.update({
      where: { id: campaignId },
      data:  { status: 'DONE', totalSent: sent, totalFailed: failed },
    });
  } catch (err) {
    console.error(`[Campaign ${campaignId}] Fatal:`, err);
    await prisma.campaign
      .update({ where: { id: campaignId }, data: { status: 'STOPPED' } })
      .catch(() => {});
  } finally {
    stopFlags.delete(campaignId);
  }
}

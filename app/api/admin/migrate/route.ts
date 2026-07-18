import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// One-time migration endpoint — adds columns/tables that were added after
// the initial Neon DB push. Safe to run multiple times (IF NOT EXISTS guards).
export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const results: string[] = [];
  const errors: string[] = [];

  async function run(label: string, sql: string) {
    try {
      await prisma.$executeRawUnsafe(sql);
      results.push(`✓ ${label}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // "already exists" errors are harmless — the column/table is already there
      if (msg.includes('already exists') || msg.includes('duplicate')) {
        results.push(`— ${label} (already exists)`);
      } else {
        errors.push(`✗ ${label}: ${msg}`);
      }
    }
  }

  // ── sales: add referral columns ──────────────────────────────────────────────
  await run(
    'sales.referralCodeId column',
    `ALTER TABLE "sales" ADD COLUMN "referralCodeId" TEXT`,
  );
  await run(
    'sales.commission column',
    `ALTER TABLE "sales" ADD COLUMN "commission" DOUBLE PRECISION`,
  );

  // ── referral_codes table ─────────────────────────────────────────────────────
  await run(
    'referral_codes table',
    `CREATE TABLE "referral_codes" (
      "id"                    TEXT NOT NULL,
      "code"                  TEXT NOT NULL,
      "name"                  TEXT NOT NULL,
      "username"              TEXT NOT NULL,
      "commissionWithService" DOUBLE PRECISION NOT NULL DEFAULT 10,
      "commissionNoService"   DOUBLE PRECISION NOT NULL DEFAULT 5,
      "status"                BOOLEAN NOT NULL DEFAULT true,
      "notes"                 TEXT,
      "whatsappLink"          TEXT NOT NULL DEFAULT '',
      "level"                 INTEGER NOT NULL DEFAULT 0,
      "parentCodeId"          TEXT,
      "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "referral_codes_pkey" PRIMARY KEY ("id")
    )`,
  );
  await run(
    'referral_codes.code unique index',
    `CREATE UNIQUE INDEX "referral_codes_code_key" ON "referral_codes"("code")`,
  );
  await run(
    'referral_codes.username unique index',
    `CREATE UNIQUE INDEX "referral_codes_username_key" ON "referral_codes"("username")`,
  );
  await run(
    'referral_codes self-referential FK',
    `ALTER TABLE "referral_codes" ADD CONSTRAINT "referral_codes_parentCodeId_fkey"
       FOREIGN KEY ("parentCodeId") REFERENCES "referral_codes"("id")
       ON DELETE SET NULL ON UPDATE CASCADE`,
  );
  await run(
    'sales → referral_codes FK',
    `ALTER TABLE "sales" ADD CONSTRAINT "sales_referralCodeId_fkey"
       FOREIGN KEY ("referralCodeId") REFERENCES "referral_codes"("id")
       ON DELETE SET NULL ON UPDATE CASCADE`,
  );

  // ── referral_codes: sub-referral columns (may already exist if table just created) ──
  await run(
    'referral_codes.level column',
    `ALTER TABLE "referral_codes" ADD COLUMN "level" INTEGER NOT NULL DEFAULT 0`,
  );
  await run(
    'referral_codes.parentCodeId column',
    `ALTER TABLE "referral_codes" ADD COLUMN "parentCodeId" TEXT`,
  );

  // ── campaigns table ──────────────────────────────────────────────────────────
  await run(
    'campaigns table',
    `CREATE TABLE "campaigns" (
      "id"               TEXT NOT NULL,
      "name"             TEXT NOT NULL,
      "message"          TEXT NOT NULL,
      "status"           TEXT NOT NULL DEFAULT 'DRAFT',
      "totalSent"        INTEGER NOT NULL DEFAULT 0,
      "totalFailed"      INTEGER NOT NULL DEFAULT 0,
      "totalTargets"     INTEGER NOT NULL DEFAULT 0,
      "totalSkipped"     INTEGER NOT NULL DEFAULT 0,
      "baseDelaySeconds" INTEGER NOT NULL DEFAULT 12,
      "source"           TEXT NOT NULL DEFAULT 'DB_CLIENTS',
      "phones"           TEXT[] DEFAULT ARRAY[]::TEXT[],
      "mediaUrl"         TEXT,
      "scheduledAt"      TIMESTAMP(3),
      "dailyLimit"       INTEGER NOT NULL DEFAULT 200,
      "validateNumbers"  BOOLEAN NOT NULL DEFAULT true,
      "stopReason"       TEXT,
      "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
    )`,
  );

  // ── campaign_logs table ──────────────────────────────────────────────────────
  await run(
    'campaign_logs table',
    `CREATE TABLE "campaign_logs" (
      "id"         TEXT NOT NULL,
      "campaignId" TEXT NOT NULL,
      "phone"      TEXT NOT NULL,
      "status"     TEXT NOT NULL,
      "error"      TEXT,
      "sentAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "campaign_logs_pkey" PRIMARY KEY ("id")
    )`,
  );
  await run(
    'campaign_logs → campaigns FK',
    `ALTER TABLE "campaign_logs" ADD CONSTRAINT "campaign_logs_campaignId_fkey"
       FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id")
       ON DELETE CASCADE ON UPDATE CASCADE`,
  );

  // ── whatsapp_sessions table ──────────────────────────────────────────────────
  await run(
    'whatsapp_sessions table',
    `CREATE TABLE "whatsapp_sessions" (
      "id"        TEXT NOT NULL DEFAULT 'singleton',
      "creds"     JSONB,
      "keys"      JSONB,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "whatsapp_sessions_pkey" PRIMARY KEY ("id")
    )`,
  );

  return NextResponse.json({
    ok: errors.length === 0,
    results,
    errors,
  });
}

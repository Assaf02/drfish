/**
 * Run once locally to scan WhatsApp QR and save credentials to Neon DB.
 * Usage:              npx tsx scripts/wa-setup.ts
 * Force rescan:       npx tsx scripts/wa-setup.ts --reset
 *
 * The QR appears in the terminal. Scan it with WhatsApp > Appareils liés.
 * Credentials are saved to Neon — Vercel reuses them for all campaign sends.
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
import qrcodeTerminal from 'qrcode-terminal';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── DB auth state (same logic as lib/whatsapp-auth.ts) ────────────────────────

type DataSet = {
  [T in keyof SignalDataTypeMap]?: { [id: string]: SignalDataTypeMap[T] | null };
};

async function useDbAuthState(): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}> {
  const session = await prisma.whatsAppSession.findUnique({ where: { id: 'singleton' } });

  const credsRaw = session?.creds;
  const keysRaw  = (session?.keys ?? {}) as Record<string, Record<string, unknown>>;

  const creds = credsRaw
    ? JSON.parse(JSON.stringify(credsRaw), BufferJSON.reviver)
    : initAuthCreds();

  const keys: Record<string, Record<string, unknown>> = JSON.parse(
    JSON.stringify(keysRaw),
    BufferJSON.reviver,
  );

  async function persist() {
    await prisma.whatsAppSession.upsert({
      where:  { id: 'singleton' },
      update: {
        creds: JSON.parse(JSON.stringify(creds, BufferJSON.replacer)),
        keys:  JSON.parse(JSON.stringify(keys,  BufferJSON.replacer)),
      },
      create: {
        id:    'singleton',
        creds: JSON.parse(JSON.stringify(creds, BufferJSON.replacer)),
        keys:  JSON.parse(JSON.stringify(keys,  BufferJSON.replacer)),
      },
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
          const entries = data[type] ?? {};
          for (const [id, val] of Object.entries(entries)) {
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

// ── Connect and wait for QR scan (auto-regenerates QR when it expires) ────────

async function connectAndScan(): Promise<void> {
  const { state, saveCreds } = await useDbAuthState();
  const { version, isLatest } = await fetchLatestBaileysVersion();
  if (!isLatest) console.warn('⚠️  Version Baileys potentiellement obsolète — mise à jour recommandée');
  console.log(`Connexion à WhatsApp (version ${version.join('.')})...\n`);

  return new Promise<void>((resolve, reject) => {
    const globalTimeout = setTimeout(() => {
      reject(new Error('Timeout — aucun scan après 5 minutes'));
    }, 5 * 60_000);

    let qrCount = 0;
    let currentSock: WASocket | null = null;
    let done = false;

    function openSock() {
      if (done) return;

      const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ['Dr Fish CRM', 'Chrome', '120.0'],
        connectTimeoutMs: 60_000,
        defaultQueryTimeoutMs: undefined,
      });

      currentSock = sock;
      sock.ev.on('creds.update', saveCreds);

      sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
        if (done) return;

        if (qr) {
          qrCount++;
          console.clear();
          console.log('\n🐟 Dr Fish CRM — Scanne ce QR dans WhatsApp > Appareils liés > Lier un appareil\n');
          qrcodeTerminal.generate(qr, { small: true });
          console.log(`\n⏳ En attente du scan... (QR n°${qrCount}${qrCount > 1 ? ' — le précédent a expiré' : ''})\n`);
        }

        if (connection === 'open') {
          done = true;
          clearTimeout(globalTimeout);
          await saveCreds();
          const me = sock.authState?.creds?.me;
          console.log(`\n✅ Connecté ! Compte : ${me?.name ?? '?'} (${me?.id ?? '?'})`);
          console.log('✅ Credentials sauvegardés dans Neon DB.');
          console.log('✅ Les campagnes Vercel peuvent maintenant envoyer des messages.\n');
          try { sock.ws.close(); } catch { /* ignore */ }
          resolve();
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const isLoggedOut = statusCode === DisconnectReason.loggedOut;

          if (isLoggedOut) {
            done = true;
            clearTimeout(globalTimeout);
            reject(new Error('Session refusée par WhatsApp — réessaie'));
            return;
          }

          if (qrCount === 0) {
            // Closed before any QR = expired session in DB
            done = true;
            clearTimeout(globalTimeout);
            console.log('⚠️  Session expirée en DB — effacement et reconnexion...\n');
            reject(new Error('SESSION_EXPIRED'));
            return;
          }

          // QR expired → reopen connection for a new QR
          console.log('\n🔄 QR expiré — nouveau QR en cours...\n');
          try { sock.ws.close(); } catch { /* ignore */ }
          setTimeout(openSock, 1_500);
        }
      });
    }

    openSock();
  });
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🐟 Dr Fish CRM — Connexion WhatsApp\n');
  console.log('Connexion à la base de données Neon...');

  // --reset flag: clear session before doing anything else
  if (process.argv.includes('--reset')) {
    console.log('🗑️  Suppression de la session existante...');
    await prisma.whatsAppSession.deleteMany({ where: { id: 'singleton' } });
    console.log('✅ Session supprimée.\n');
  } else {
    // Check if already connected
    const existingSession = await prisma.whatsAppSession.findUnique({ where: { id: 'singleton' } });
    if (existingSession?.creds) {
      const creds = JSON.parse(JSON.stringify(existingSession.creds), BufferJSON.reviver);
      if (creds?.me) {
        console.log(`\n✅ Session existante : ${creds.me.name ?? '?'} (${creds.me.id})`);
        console.log('ℹ️  Pour rescanner : npx tsx scripts/wa-setup.ts --reset\n');
        await prisma.$disconnect();
        process.exit(0);
      }
    }
  }

  let retries = 0;
  while (retries <= 2) {
    try {
      await connectAndScan();
      break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'SESSION_EXPIRED' && retries < 2) {
        await prisma.whatsAppSession.deleteMany({ where: { id: 'singleton' } });
        retries++;
        continue;
      }
      throw err;
    }
  }

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('\n❌ Erreur :', err.message);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});

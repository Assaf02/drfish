/**
 * Génère un QR WhatsApp dans le terminal et sauvegarde la session dans Neon DB.
 * Usage :           npx tsx scripts/wa-setup.ts
 * Forcer un rescan: npx tsx scripts/wa-setup.ts --reset
 *
 * Scannez le QR avec WhatsApp > Appareils liés > Lier un appareil.
 * Les credentials sont sauvegardés dans Neon — Vercel les réutilise pour les campagnes.
 */

import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { gzipSync, gunzipSync } from 'zlib';

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

// ── DB auth state (identical logic to lib/whatsapp-auth.ts, with gzip) ────────

type DataSet = {
  [T in keyof SignalDataTypeMap]?: { [id: string]: SignalDataTypeMap[T] | null };
};

function packKeys(keys: Record<string, unknown>): object {
  const json = JSON.stringify(keys, BufferJSON.replacer);
  return { _z: gzipSync(Buffer.from(json)).toString('base64') };
}

function unpackKeys(stored: unknown): Record<string, Record<string, unknown>> {
  if (stored && typeof stored === 'object' && '_z' in (stored as object)) {
    const b64 = (stored as { _z: string })._z;
    const json = gunzipSync(Buffer.from(b64, 'base64')).toString();
    return JSON.parse(json, BufferJSON.reviver);
  }
  // Legacy: clés non-compressées encore en DB → migration transparente
  return JSON.parse(JSON.stringify(stored ?? {}), BufferJSON.reviver);
}

async function useDbAuthState(): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}> {
  const session = await prisma.whatsAppSession.findUnique({ where: { id: 'singleton' } });

  const creds = session?.creds
    ? JSON.parse(JSON.stringify(session.creds), BufferJSON.reviver)
    : initAuthCreds();

  const keys: Record<string, Record<string, unknown>> = unpackKeys(session?.keys);

  async function persist() {
    const credsJson = JSON.parse(JSON.stringify(creds, BufferJSON.replacer));
    await prisma.whatsAppSession.upsert({
      where:  { id: 'singleton' },
      update: { creds: credsJson, keys: packKeys(keys) },
      create: { id: 'singleton', creds: credsJson, keys: packKeys(keys) },
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

// ── Connexion et attente du scan QR ───────────────────────────────────────────

async function connectAndScan(): Promise<void> {
  const { state, saveCreds } = await useDbAuthState();

  let version: [number, number, number] = [2, 3000, 1035194821];
  try {
    const res = await fetchLatestBaileysVersion();
    version = res.version;
    if (!res.isLatest) console.warn('⚠️  Version Baileys potentiellement obsolète');
  } catch {
    console.warn('⚠️  Impossible de récupérer la dernière version WA, version de repli utilisée');
  }

  console.log(`Connexion WA (version ${version.join('.')})...\n`);

  return new Promise<void>((resolve, reject) => {
    const globalTimeout = setTimeout(() => {
      reject(new Error('Timeout — aucun scan après 5 minutes'));
    }, 5 * 60_000);

    let qrCount = 0;
    let done = false;

    function openSock() {
      if (done) return;

      const sock: WASocket = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ['Dr Fish CRM', 'Chrome', '120.0'],
        connectTimeoutMs: 60_000,
        defaultQueryTimeoutMs: undefined,
      });

      sock.ev.on('creds.update', saveCreds);

      sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
        if (done) return;

        if (qr) {
          qrCount++;
          console.clear();
          console.log('\n🐟  Dr Fish CRM — Scanne ce QR dans WhatsApp > Appareils liés > Lier un appareil\n');
          qrcodeTerminal.generate(qr, { small: true });
          if (qrCount > 1) console.log(`\n⏳  QR n°${qrCount} — le précédent a expiré\n`);
          else console.log('\n⏳  En attente du scan...\n');
        }

        if (connection === 'open') {
          done = true;
          clearTimeout(globalTimeout);
          await saveCreds();
          const me = sock.authState?.creds?.me;
          console.log(`\n✅  Connecté ! Compte : ${me?.name ?? '?'} (${me?.id ?? '?'})`);
          console.log('✅  Session sauvegardée dans Neon DB.');
          console.log('✅  Vercel peut maintenant envoyer des campagnes WA.\n');
          try { sock.ws.close(); } catch { /* ignore */ }
          resolve();
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const isLoggedOut = statusCode === DisconnectReason.loggedOut;

          if (isLoggedOut) {
            done = true;
            clearTimeout(globalTimeout);
            reject(new Error('Session refusée par WhatsApp (loggedOut) — réessaie avec --reset'));
            return;
          }

          if (qrCount === 0) {
            // Fermé avant tout QR = session expirée en DB
            done = true;
            clearTimeout(globalTimeout);
            reject(new Error('SESSION_EXPIRED'));
            return;
          }

          // QR expiré → rouvre pour un nouveau QR
          console.log('\n🔄  QR expiré — nouveau QR en cours...\n');
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
  console.log('\n🐟  Dr Fish CRM — Connexion WhatsApp\n');

  const forceReset = process.argv.includes('--reset');

  if (forceReset) {
    console.log('🗑️   Suppression de la session existante...');
    await prisma.whatsAppSession.deleteMany({ where: { id: 'singleton' } });
    console.log('✅  Session supprimée.\n');
  } else {
    // Vérifie si déjà connecté
    const existing = await prisma.whatsAppSession.findUnique({ where: { id: 'singleton' } });
    if (existing?.creds) {
      const creds = JSON.parse(JSON.stringify(existing.creds), BufferJSON.reviver);
      if (creds?.me) {
        console.log(`✅  Session existante : ${creds.me.name ?? '?'} (${creds.me.id})`);
        console.log('ℹ️   Pour rescanner : npx tsx scripts/wa-setup.ts --reset\n');
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
        console.log('⚠️   Session expirée détectée — nettoyage et nouvelle tentative...\n');
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
  console.error('\n❌  Erreur :', err instanceof Error ? err.message : String(err));
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});

import {
  AuthenticationState,
  BufferJSON,
  initAuthCreds,
  SignalDataTypeMap,
} from '@whiskeysockets/baileys';
import { gzipSync, gunzipSync } from 'zlib';
import { prisma } from './prisma';

type DataSet = {
  [T in keyof SignalDataTypeMap]?: { [id: string]: SignalDataTypeMap[T] | null };
};

// Compress keys JSON before storing in DB (700 KB → ~50 KB, -93% bandwidth)
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
  // Legacy: uncompressed keys still in DB → migrate transparently
  return JSON.parse(JSON.stringify(stored ?? {}), BufferJSON.reviver);
}

export async function useDbAuthState(): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}> {
  // Fetch only creds first — skip keys until actually needed
  const session = await prisma.whatsAppSession.findUnique({ where: { id: 'singleton' } });

  const credsRaw = session?.creds;
  const creds = credsRaw
    ? JSON.parse(JSON.stringify(credsRaw), BufferJSON.reviver)
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

export async function clearWhatsAppSession() {
  await prisma.whatsAppSession.deleteMany({ where: { id: 'singleton' } });
}

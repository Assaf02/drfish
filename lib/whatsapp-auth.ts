import {
  AuthenticationState,
  BufferJSON,
  initAuthCreds,
  SignalDataTypeMap,
} from '@whiskeysockets/baileys';
import { prisma } from './prisma';

type DataSet = {
  [T in keyof SignalDataTypeMap]?: { [id: string]: SignalDataTypeMap[T] | null };
};

export async function useDbAuthState(): Promise<{
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

export async function clearWhatsAppSession() {
  await prisma.whatsAppSession.deleteMany({ where: { id: 'singleton' } });
}

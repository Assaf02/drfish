import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import { useDbAuthState, clearWhatsAppSession } from '@/lib/whatsapp-auth';
import { Boom } from '@hapi/boom';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Vercel Pro: 5 min; Hobby: ignored (uses 10s)

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  const send = (data: object) => {
    try { writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); } catch { /* closed */ }
  };

  const killTimer = setTimeout(() => writer.close().catch(() => {}), 280_000);

  (async () => {
    try {
      const { state, saveCreds } = await useDbAuthState();
      const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1035194821] as [number, number, number], isLatest: false }));

      const sock = makeWASocket({
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
        if (qr) {
          // QR = previous session expired. Clear stale creds so status shows "disconnected".
          await clearWhatsAppSession().catch(() => {});
          try {
            const qrDataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
            send({ type: 'qr', qrDataUrl });
          } catch {
            send({ type: 'error', message: 'Erreur génération QR' });
          }
        }

        if (connection === 'open') {
          send({ type: 'connected' });
          clearTimeout(killTimer);
          sock.ws.close();
          writer.close().catch(() => {});
        }

        if (connection === 'close') {
          const isLoggedOut =
            (lastDisconnect?.error as Boom)?.output?.statusCode === DisconnectReason.loggedOut;
          if (isLoggedOut) await clearWhatsAppSession();
          send({ type: 'disconnected', loggedOut: isLoggedOut });
          clearTimeout(killTimer);
          writer.close().catch(() => {});
        }
      });
    } catch (err) {
      send({ type: 'error', message: String(err) });
      writer.close().catch(() => {});
      clearTimeout(killTimer);
    }
  })();

  return new Response(readable, {
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache, no-transform',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

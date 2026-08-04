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
      // Always start fresh so Baileys connects as a new device and WA sends a QR.
      // If we reuse stale/broken creds, WA rejects the reconnect silently (no QR).
      await clearWhatsAppSession().catch(() => {});
      const { state, saveCreds } = await useDbAuthState();

      // Fetch latest WA version — stale hardcoded version can cause silent WA rejection
      let version: [number, number, number] = [2, 3000, 1035194821];
      try {
        const { version: v } = await fetchLatestBaileysVersion();
        version = v;
      } catch { /* keep fallback */ }

      const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ['Dr Fish CRM', 'Chrome', '120.0'],
        connectTimeoutMs: 8_000,
        defaultQueryTimeoutMs: undefined,
      });

      sock.ev.on('creds.update', saveCreds);

      sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
        if (qr) {
          try {
            const qrDataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
            send({ type: 'qr', qrDataUrl });
          } catch {
            send({ type: 'error', message: 'Erreur génération QR' });
          }
        }

        if (connection === 'open') {
          // Force-save the complete in-memory state before closing the response.
          // Baileys fires keys.set() and creds.update async — if we close the
          // writer first, Vercel may kill the function before those DB writes land,
          // leaving an incomplete session that causes WA_CLOSED on reconnect.
          await saveCreds();
          send({ type: 'connected' });
          clearTimeout(killTimer);
          sock.ws.close();
          writer.close().catch(() => {});
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const isLoggedOut = statusCode === DisconnectReason.loggedOut;
          if (isLoggedOut) await clearWhatsAppSession();
          send({ type: 'disconnected', loggedOut: isLoggedOut, code: statusCode ?? 0 });
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

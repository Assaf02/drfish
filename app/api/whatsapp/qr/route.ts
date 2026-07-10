import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import makeWASocket, { DisconnectReason } from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import { useDbAuthState, clearWhatsAppSession } from '@/lib/whatsapp-auth';
import { Boom } from '@hapi/boom';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const encoder = new TextEncoder();
  const stream  = new TransformStream<Uint8Array, Uint8Array>();
  const writer  = stream.writable.getWriter();

  const send = (data: object) => {
    try { writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); } catch { /* closed */ }
  };

  // Cleanup after 3 minutes (QR expires well before then)
  const killTimer = setTimeout(() => { writer.close().catch(() => {}); }, 180_000);

  (async () => {
    try {
      const { state, saveCreds } = await useDbAuthState();

      const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ['Dr Fish CRM', 'Chrome', '120.0'],
        connectTimeoutMs: 60_000,
      });

      sock.ev.on('creds.update', saveCreds);

      sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
        if (qr) {
          try {
            const qrDataUrl = await QRCode.toDataURL(qr, { width: 256, margin: 1 });
            send({ type: 'qr', qrDataUrl });
          } catch { send({ type: 'error', message: 'Erreur génération QR' }); }
        }

        if (connection === 'open') {
          send({ type: 'connected' });
          clearTimeout(killTimer);
          writer.close().catch(() => {});
          sock.ws?.close();
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

  return new Response(stream.readable, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

import QRCode from 'qrcode';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _req: NextRequest,
  { params }: { params: { code: string } },
) {
  const ref = await prisma.referralCode.findUnique({
    where: { code: params.code },
    select: { whatsappLink: true },
  });

  if (!ref) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const buffer = await QRCode.toBuffer(ref.whatsappLink, {
    errorCorrectionLevel: 'M',
    type: 'png',
    width: 1000,
    margin: 2,
    color: { dark: '#FFFFFF', light: '#0A1628' },
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="drfish-${params.code}.png"`,
      'Cache-Control': 'public, max-age=86400',
    },
  });
}

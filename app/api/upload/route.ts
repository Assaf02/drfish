import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const cloudName   = process.env.CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    return NextResponse.json(
      { error: 'Cloudinary non configuré — ajoute CLOUDINARY_CLOUD_NAME et CLOUDINARY_UPLOAD_PRESET dans les variables Vercel' },
      { status: 500 },
    );
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file)
    return NextResponse.json({ error: 'Aucun fichier reçu' }, { status: 400 });

  if (file.size > MAX_SIZE)
    return NextResponse.json({ error: 'Fichier trop lourd (max 20 Mo)' }, { status: 413 });

  if (!ALLOWED_TYPES.includes(file.type))
    return NextResponse.json({ error: 'Type de fichier non supporté' }, { status: 415 });

  // Forward to Cloudinary
  const buffer = Buffer.from(await file.arrayBuffer());
  const blob   = new Blob([buffer], { type: file.type });

  const cloudForm = new FormData();
  cloudForm.append('file', blob, file.name);
  cloudForm.append('upload_preset', uploadPreset);
  cloudForm.append('folder', 'drfish-campaigns');

  let cloudRes: Response;
  try {
    cloudRes = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
      { method: 'POST', body: cloudForm },
    );
  } catch (err) {
    return NextResponse.json({ error: `Erreur réseau Cloudinary: ${String(err)}` }, { status: 500 });
  }

  const data = await cloudRes.json() as Record<string, unknown>;

  if (!cloudRes.ok) {
    const msg = (data.error as { message?: string })?.message ?? 'Erreur Cloudinary';
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({
    url:      data.secure_url as string,
    fileName: file.name,
    size:     file.size,
    type:     file.type,
  });
}

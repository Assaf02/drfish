import { put } from '@vercel/blob';
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
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file)
    return NextResponse.json({ error: 'Aucun fichier reçu' }, { status: 400 });

  if (file.size > MAX_SIZE)
    return NextResponse.json({ error: 'Fichier trop lourd (max 20 Mo)' }, { status: 413 });

  if (!ALLOWED_TYPES.includes(file.type))
    return NextResponse.json({ error: 'Type de fichier non supporté' }, { status: 415 });

  const blob = await put(`campaigns/${Date.now()}-${file.name}`, file, {
    access: 'public',
  });

  return NextResponse.json({
    url:      blob.url,
    fileName: file.name,
    size:     file.size,
    type:     file.type,
  });
}

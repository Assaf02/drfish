import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

function FishSkeleton({ size }: { size: number }) {
  const s = size;
  return (
    <div
      style={{
        width: s,
        height: s,
        background: '#0A1628',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: s * 0.2,
      }}
    >
      <svg width={s * 0.65} height={s * 0.65} viewBox="0 0 24 24" fill="none">
        <line x1="3" y1="12" x2="19" y2="12" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="21" cy="12" r="2.2" fill="white" />
        <circle cx="21.7" cy="10.9" r="0.75" fill="#0A1628" />
        <line x1="16" y1="12" x2="13" y2="8.5"  stroke="white" strokeWidth="1.4" strokeLinecap="round" />
        <line x1="13" y1="12" x2="10" y2="8.5"  stroke="white" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="10" y1="12" x2="7"  y2="8.5"  stroke="white" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="16" y1="12" x2="13" y2="15.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
        <line x1="13" y1="12" x2="10" y2="15.5" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="10" y1="12" x2="7"  y2="15.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="3" y1="12" x2="0.5" y2="8.5"  stroke="white" strokeWidth="1.6" strokeLinecap="round" />
        <line x1="3" y1="12" x2="0.5" y2="15.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { file: string } },
) {
  const match = params.file.match(/icon-(\d+)\.png/);
  const size = match ? parseInt(match[1], 10) : 192;

  return new ImageResponse(<FishSkeleton size={size} />, {
    width: size,
    height: size,
  });
}

import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          background: '#0A1628',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 7,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <line x1="3" y1="12" x2="19" y2="12" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="21" cy="12" r="2.2" fill="white" />
          <line x1="16" y1="12" x2="13" y2="8.5"  stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="13" y1="12" x2="10" y2="8.5"  stroke="white" strokeWidth="1.4" strokeLinecap="round" />
          <line x1="10" y1="12" x2="7"  y2="8.5"  stroke="white" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="16" y1="12" x2="13" y2="15.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="13" y1="12" x2="10" y2="15.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
          <line x1="10" y1="12" x2="7"  y2="15.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="3" y1="12" x2="0.5" y2="8.5"  stroke="white" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="3" y1="12" x2="0.5" y2="15.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </div>
    ),
    { ...size },
  );
}

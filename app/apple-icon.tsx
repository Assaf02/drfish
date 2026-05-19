import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: '#0A1628',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 36,
        }}
      >
        <svg width="110" height="110" viewBox="0 0 24 24" fill="none">
          {/* Spine */}
          <line x1="3" y1="12" x2="19" y2="12" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
          {/* Head */}
          <circle cx="21" cy="12" r="2.2" fill="white" />
          <circle cx="21.7" cy="10.9" r="0.75" fill="#0A1628" />
          {/* Ribs top */}
          <line x1="16" y1="12" x2="13" y2="8.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
          <line x1="13" y1="12" x2="10" y2="8.5" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
          <line x1="10" y1="12" x2="7"  y2="8.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
          {/* Ribs bottom */}
          <line x1="16" y1="12" x2="13" y2="15.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
          <line x1="13" y1="12" x2="10" y2="15.5" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
          <line x1="10" y1="12" x2="7"  y2="15.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
          {/* Tail */}
          <line x1="3" y1="12" x2="0.5" y2="8.5"  stroke="white" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="3" y1="12" x2="0.5" y2="15.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>
    ),
    { ...size },
  );
}

interface DrFishLogoProps {
  variant?: 'white' | 'navy';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  animated?: boolean;
  className?: string;
}

const sizeMap = {
  sm: { fish: 28, dr: 13, ish: 28, gap: 2 },
  md: { fish: 40, dr: 16, ish: 40, gap: 3 },
  lg: { fish: 60, dr: 22, ish: 60, gap: 4 },
  xl: { fish: 96, dr: 34, ish: 96, gap: 6 },
};

export function DrFishLogo({
  variant = 'navy',
  size = 'md',
  animated = false,
  className = '',
}: DrFishLogoProps) {
  const c = variant === 'white' ? '#FFFFFF' : '#0A1628';
  const cSub = variant === 'white' ? 'rgba(255,255,255,0.5)' : 'rgba(10,22,40,0.45)';
  const s = sizeMap[size];
  const totalH = s.fish;
  const totalW = s.fish * 2.6;

  return (
    <svg
      width={totalW}
      height={totalH}
      viewBox={`0 0 ${totalW} ${totalH}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Dr Fish CRM"
    >
      {/* "Dr" text */}
      <text
        x="0"
        y={totalH * 0.72}
        fontFamily="'Clash Display', 'Plus Jakarta Sans', system-ui, sans-serif"
        fontSize={s.dr}
        fontWeight="400"
        fill={cSub}
        letterSpacing="-0.3"
      >
        Dr
      </text>

      {/* Fish skeleton — acting as the "F" */}
      {(() => {
        const fx = s.dr * 1.3 + s.gap;       // fish X start
        const fw = totalH * 0.45;             // fish width
        const fh = totalH * 0.88;             // fish height
        const fy = totalH * 0.06;             // fish Y start
        const cx = fx + fw * 0.38;            // spine X
        const spineTop = fy;
        const spineBot = fy + fh * 0.82;
        const tailY = fy + fh;
        const ribLen = fw * 0.7;
        const rib1Y = fy + fh * 0.22;
        const rib2Y = fy + fh * 0.38;
        const rib3Y = fy + fh * 0.54;
        const rib4Y = fy + fh * 0.66;
        const strokeW = totalH * 0.038;
        const anim = (delay: number, len: number) =>
          animated
            ? {
                strokeDasharray: len,
                strokeDashoffset: len,
                style: { animation: `fishDraw 0.6s ease ${delay}s forwards` },
              }
            : {};

        return (
          <g>
            {/* Spine */}
            <line x1={cx} y1={spineTop} x2={cx} y2={spineBot}
              stroke={c} strokeWidth={strokeW} strokeLinecap="round"
              {...anim(0, fh)}
            />
            {/* Head circle */}
            <ellipse cx={cx + fw * 0.18} cy={spineTop + fw * 0.18} rx={fw * 0.28} ry={fw * 0.22}
              stroke={c} strokeWidth={strokeW * 0.85} fill="none"
              {...(animated
                ? { strokeDasharray: 200, strokeDashoffset: 200, style: { animation: 'fishDraw 0.5s ease 0.05s forwards' } }
                : {})}
            />
            {/* Eye */}
            <circle cx={cx + fw * 0.24} cy={spineTop + fw * 0.12} r={strokeW * 0.9} fill={c}
              {...(animated ? { style: { opacity: 0, animation: 'scaleIn 0.2s ease 0.5s forwards' } } : {})}
            />
            {/* Rib 1 */}
            <line x1={cx} y1={rib1Y} x2={cx + ribLen} y2={rib1Y - fh * 0.07}
              stroke={c} strokeWidth={strokeW * 0.85} strokeLinecap="round"
              {...anim(0.15, ribLen)}
            />
            {/* Rib 2 */}
            <line x1={cx} y1={rib2Y} x2={cx + ribLen * 0.82} y2={rib2Y - fh * 0.05}
              stroke={c} strokeWidth={strokeW * 0.8} strokeLinecap="round"
              {...anim(0.2, ribLen)}
            />
            {/* Rib 3 */}
            <line x1={cx} y1={rib3Y} x2={cx + ribLen * 0.65} y2={rib3Y - fh * 0.04}
              stroke={c} strokeWidth={strokeW * 0.72} strokeLinecap="round"
              {...anim(0.25, ribLen)}
            />
            {/* Rib 4 */}
            <line x1={cx} y1={rib4Y} x2={cx + ribLen * 0.5} y2={rib4Y - fh * 0.03}
              stroke={c} strokeWidth={strokeW * 0.65} strokeLinecap="round"
              {...anim(0.3, ribLen)}
            />
            {/* Tail fork top */}
            <line x1={cx} y1={spineBot} x2={cx - fw * 0.28} y2={tailY}
              stroke={c} strokeWidth={strokeW} strokeLinecap="round"
              {...anim(0.35, fw)}
            />
            {/* Tail fork bottom */}
            <line x1={cx} y1={spineBot} x2={cx + fw * 0.3} y2={tailY}
              stroke={c} strokeWidth={strokeW} strokeLinecap="round"
              {...anim(0.35, fw)}
            />
          </g>
        );
      })()}

      {/* "ISH" text */}
      {(() => {
        const fx = s.dr * 1.3 + s.gap;
        const fw = totalH * 0.45;
        const ishX = fx + fw * 0.85 + s.gap;
        return (
          <text
            x={ishX}
            y={totalH * 0.92}
            fontFamily="'Clash Display', 'Plus Jakarta Sans', system-ui, sans-serif"
            fontSize={s.ish * 0.95}
            fontWeight="700"
            fill={c}
            letterSpacing="-1"
          >
            ISH
          </text>
        );
      })()}
    </svg>
  );
}

import { cn } from '@/lib/utils';

interface FishIconProps {
  size?: number;
  color?: string;
  className?: string;
  animated?: boolean;
}

export function FishIcon({ size = 24, color = 'currentColor', className, animated }: FishIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Spine */}
      <line
        x1="4" y1="12" x2="19" y2="12"
        stroke={color} strokeWidth="1.5" strokeLinecap="round"
        {...(animated ? {
          strokeDasharray: 20,
          strokeDashoffset: 20,
          style: { animation: 'fishDraw 0.5s ease 0.1s forwards' }
        } : {})}
      />
      {/* Head */}
      <circle cx="20.5" cy="12" r="2" fill={color}
        {...(animated ? { style: { opacity: 0, animation: 'scaleIn 0.3s ease 0.5s forwards' } } : {})}
      />
      {/* Eye */}
      <circle cx="21" cy="11.2" r="0.6" fill="white"
        {...(animated ? { style: { opacity: 0, animation: 'scaleIn 0.2s ease 0.7s forwards' } } : {})}
      />
      {/* Rib 1 */}
      <line x1="16" y1="12" x2="13" y2="9" stroke={color} strokeWidth="1.5" strokeLinecap="round"
        {...(animated ? { strokeDasharray: 10, strokeDashoffset: 10, style: { animation: 'fishDraw 0.3s ease 0.4s forwards' } } : {})}
      />
      {/* Rib 2 */}
      <line x1="13" y1="12" x2="10" y2="9" stroke={color} strokeWidth="1.5" strokeLinecap="round"
        {...(animated ? { strokeDasharray: 10, strokeDashoffset: 10, style: { animation: 'fishDraw 0.3s ease 0.5s forwards' } } : {})}
      />
      {/* Rib 3 */}
      <line x1="10" y1="12" x2="7" y2="9" stroke={color} strokeWidth="1.5" strokeLinecap="round"
        {...(animated ? { strokeDasharray: 10, strokeDashoffset: 10, style: { animation: 'fishDraw 0.3s ease 0.6s forwards' } } : {})}
      />
      {/* Rib 4 */}
      <line x1="16" y1="12" x2="13" y2="15" stroke={color} strokeWidth="1.5" strokeLinecap="round"
        {...(animated ? { strokeDasharray: 10, strokeDashoffset: 10, style: { animation: 'fishDraw 0.3s ease 0.4s forwards' } } : {})}
      />
      {/* Rib 5 */}
      <line x1="13" y1="12" x2="10" y2="15" stroke={color} strokeWidth="1.5" strokeLinecap="round"
        {...(animated ? { strokeDasharray: 10, strokeDashoffset: 10, style: { animation: 'fishDraw 0.3s ease 0.5s forwards' } } : {})}
      />
      {/* Rib 6 */}
      <line x1="10" y1="12" x2="7" y2="15" stroke={color} strokeWidth="1.5" strokeLinecap="round"
        {...(animated ? { strokeDasharray: 10, strokeDashoffset: 10, style: { animation: 'fishDraw 0.3s ease 0.6s forwards' } } : {})}
      />
      {/* Tail top */}
      <line x1="4" y1="12" x2="1" y2="9" stroke={color} strokeWidth="1.8" strokeLinecap="round"
        {...(animated ? { strokeDasharray: 8, strokeDashoffset: 8, style: { animation: 'fishDraw 0.3s ease 0.65s forwards' } } : {})}
      />
      {/* Tail bottom */}
      <line x1="4" y1="12" x2="1" y2="15" stroke={color} strokeWidth="1.8" strokeLinecap="round"
        {...(animated ? { strokeDasharray: 8, strokeDashoffset: 8, style: { animation: 'fishDraw 0.3s ease 0.65s forwards' } } : {})}
      />
    </svg>
  );
}

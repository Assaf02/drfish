import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  onClick?: () => void;
  variant?: 'default' | 'navy' | 'surface';
}

const paddingMap = { none: '', sm: 'p-4', md: 'p-6', lg: 'p-8' };
const variantMap = { default: 'card', navy: 'card-navy', surface: 'card-surface' };

export function Card({ children, className, padding = 'md', hover, onClick, variant = 'default' }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(variantMap[variant], paddingMap[padding], hover && 'card-hover cursor-pointer', onClick && 'cursor-pointer', className)}
    >
      {children}
    </div>
  );
}

export function KPICard({
  title, value, subtitle, icon, accentColor = 'blue', className,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'navy' | 'blue';
  accentColor?: 'blue' | 'teal';
  className?: string;
}) {
  const accent = accentColor === 'teal' ? '#00B4A6' : '#2E6DB4';
  const accentBg = accentColor === 'teal' ? 'rgba(0,180,166,0.08)' : 'rgba(46,109,180,0.08)';

  return (
    <div
      className={cn('card p-5 rounded-2xl', className)}
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <div className="flex items-start justify-between mb-3">
        <p
          className="text-[10px] font-semibold uppercase"
          style={{ color: 'var(--gray-400)', letterSpacing: '0.08em' }}
        >
          {title}
        </p>
        {icon && (
          <span
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: accentBg, color: accent }}
          >
            {icon}
          </span>
        )}
      </div>
      <p
        className="font-extrabold leading-none truncate"
        style={{ fontSize: 'clamp(16px, 4.5vw, 26px)', color: 'var(--navy)', letterSpacing: '-0.5px' }}
      >
        {value}
      </p>
      {subtitle && (
        <p className="text-[11px] mt-2" style={{ color: 'var(--gray-400)' }}>{subtitle}</p>
      )}
    </div>
  );
}

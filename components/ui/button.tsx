import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl select-none cursor-pointer';
const transition = 'transition-all duration-150';

const variantStyles: Record<string, string> = {
  primary:   'text-white',
  secondary: 'text-[#0A1628]',
  danger:    'text-white',
  ghost:     'text-[#8892A4]',
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, children, disabled, style, ...props }, ref) => {
    const isDisabled = disabled || loading;

    const getStyle = (): React.CSSProperties => {
      const base: React.CSSProperties = {
        minHeight: size === 'sm' ? 36 : size === 'lg' ? 56 : 48,
        fontFamily: "'Clash Display', 'Plus Jakarta Sans', system-ui, sans-serif",
        ...style,
      };
      if (variant === 'primary') return { ...base, background: 'var(--navy)', boxShadow: '0 2px 8px rgba(10,22,40,0.2)' };
      if (variant === 'secondary') return { ...base, background: 'var(--white)', border: '1.5px solid var(--gray-100)' };
      if (variant === 'danger') return { ...base, background: 'var(--red)', boxShadow: '0 2px 8px rgba(185,28,28,0.2)' };
      return { ...base, background: 'transparent' };
    };

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          base, transition,
          variantStyles[variant],
          size === 'sm' && 'px-3.5 text-sm',
          size === 'md' && 'px-5',
          size === 'lg' && 'px-7 text-lg',
          isDisabled ? 'opacity-45 cursor-not-allowed' : [
            'hover:scale-[1.02] active:scale-[0.98]',
            variant === 'primary' && 'hover:bg-[var(--blue)]',
            variant === 'secondary' && 'hover:bg-[var(--gray-50)]',
          ],
          className,
        )}
        style={getStyle()}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';

export { Button };

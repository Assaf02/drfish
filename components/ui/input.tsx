import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, leftIcon, rightIcon, type, style, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && <label className="label">{label}</label>}
        <div className="relative">
          {leftIcon && (
            <span className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--gray-400)' }}>
              {leftIcon}
            </span>
          )}
          <input
            type={type}
            ref={ref}
            className={cn(
              'input-field',
              error && 'border-[var(--red)] focus:border-[var(--red)] focus:shadow-[0_0_0_4px_rgba(185,28,28,0.08)]',
              leftIcon && 'pl-11',
              rightIcon && 'pr-11',
              className,
            )}
            style={style}
            {...props}
          />
          {rightIcon && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--gray-400)' }}>
              {rightIcon}
            </span>
          )}
        </div>
        {error && <p className="mt-1.5 text-[12px] font-medium" style={{ color: 'var(--red)' }}>{error}</p>}
        {hint && !error && <p className="mt-1.5 text-[12px]" style={{ color: 'var(--gray-400)' }}>{hint}</p>}
      </div>
    );
  },
);
Input.displayName = 'Input';

export { Input };

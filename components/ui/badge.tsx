import { cn } from '@/lib/utils';

type BadgeVariant = 'green' | 'orange' | 'red' | 'blue' | 'teal' | 'gray' | 'purple';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

const variantMap: Record<BadgeVariant, string> = {
  green:  'badge-green',
  orange: 'badge-orange',
  red:    'badge-red',
  blue:   'badge-blue',
  teal:   'badge-teal',
  gray:   'badge-gray',
  purple: 'bg-purple-50 text-purple-700',
};

const dotMap: Record<BadgeVariant, string> = {
  green:  'bg-green-600',
  orange: 'bg-orange-600',
  red:    'bg-red-600',
  blue:   'bg-blue-600',
  teal:   'bg-teal-500',
  gray:   'bg-gray-400',
  purple: 'bg-purple-600',
};

export function Badge({ variant = 'gray', children, className, dot }: BadgeProps) {
  return (
    <span className={cn('badge', variantMap[variant], className)}>
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dotMap[variant])} />}
      {children}
    </span>
  );
}

// legacy aliases used by existing pages
export { Badge as default };

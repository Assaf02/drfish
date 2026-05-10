interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

function FishIllustration() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="32" fill="var(--gray-50)" />
      <path d="M18 32 C18 24 26 18 36 22 L46 32 L36 42 C26 46 18 40 18 32Z"
        fill="var(--blue)" fillOpacity="0.15" stroke="var(--blue)" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M46 32 L52 26 L52 38 Z" fill="var(--blue)" fillOpacity="0.25" stroke="var(--blue)" strokeWidth="1.5" strokeLinejoin="round"/>
      <circle cx="28" cy="30" r="2" fill="var(--blue)" />
      <path d="M30 34 Q34 36 38 34" stroke="var(--blue)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="mb-5">
        {icon ?? <FishIllustration />}
      </div>
      <h3 className="text-base font-bold mb-2" style={{ color: 'var(--navy)' }}>{title}</h3>
      {description && (
        <p className="text-sm max-w-xs leading-relaxed" style={{ color: 'var(--gray-400)' }}>{description}</p>
      )}
      {action && (
        <button onClick={action.onClick} className="btn-primary mt-6 px-6">
          {action.label}
        </button>
      )}
    </div>
  );
}

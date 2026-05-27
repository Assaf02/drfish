export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen"
      style={{ background: 'var(--off-white)' }}
    >
      {children}
    </div>
  );
}

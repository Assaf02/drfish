import { KPICardSkeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="card-navy rounded-2xl px-6 py-5 h-[88px]" style={{ background: 'var(--navy)', opacity: 0.5 }} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => <KPICardSkeleton key={i} />)}
      </div>
      <div className="card p-6 h-64 skeleton" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 card h-80 skeleton" />
        <div className="space-y-4">
          <div className="card h-28 skeleton" />
          <div className="card h-28 skeleton" />
        </div>
      </div>
    </div>
  );
}

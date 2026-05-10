import { ListItemSkeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="pb-safe">
      <div className="sticky top-0 z-10 px-4 py-4 h-16" style={{ background: 'var(--white)', borderBottom: '1px solid var(--gray-100)' }} />
      <div className="card mx-4 mt-4 overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => <ListItemSkeleton key={i} />)}
      </div>
    </div>
  );
}

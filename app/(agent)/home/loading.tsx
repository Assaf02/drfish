import { Skeleton, ListItemSkeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="pb-safe space-y-4 px-4 pt-5">
      <Skeleton className="h-28 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
      <div className="card overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => <ListItemSkeleton key={i} />)}
      </div>
    </div>
  );
}

import { Skeleton, CardSkeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="pb-safe space-y-4 px-4 pt-5">
      <div className="card p-6 flex flex-col items-center gap-3">
        <Skeleton className="w-20 h-20 rounded-full" />
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-24" />
      </div>
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
}

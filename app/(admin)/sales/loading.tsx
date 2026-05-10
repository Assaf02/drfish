import { TableRowSkeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-9 w-48 rounded-xl" />
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b skeleton h-14" style={{ borderColor: 'var(--gray-100)' }} />
        <table className="w-full">
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

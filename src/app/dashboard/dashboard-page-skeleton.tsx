import {
  SKELETON_KEYS,
  SkeletonBlock,
  SkeletonCard,
  SkeletonPage,
  TableRowsSkeleton,
} from "../_components/page-skeleton";

export function DashboardPageSkeleton() {
  return (
    <SkeletonPage>
      <div className="mb-6 space-y-3">
        <SkeletonBlock className="h-3 w-52 rounded-md" />
        <SkeletonBlock className="h-9 w-64 max-w-full sm:h-10 sm:w-80" />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {SKELETON_KEYS.slice(0, 4).map((key) => (
          <SkeletonCard className="min-h-32" key={`stat-${key}`}>
            <SkeletonBlock className="h-3 w-24 rounded-md" />
            <SkeletonBlock className="mt-5 h-10 w-20" />
            <SkeletonBlock className="mt-4 h-3 w-32 rounded-md" />
          </SkeletonCard>
        ))}
      </div>

      <div className="mb-6">
        <TableRowsSkeleton count={3} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,0.96fr)_minmax(0,1.08fr)_minmax(0,0.96fr)]">
        {SKELETON_KEYS.slice(0, 3).map((key) => (
          <SkeletonCard
            className="min-h-72 sm:min-h-[340px] xl:min-h-[420px]"
            key={`panel-${key}`}
          >
            <SkeletonBlock className="h-5 w-36" />
            <SkeletonBlock className="mt-6 h-40 w-full rounded-2xl" />
          </SkeletonCard>
        ))}
      </div>
    </SkeletonPage>
  );
}

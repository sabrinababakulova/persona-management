import {
  SKELETON_KEYS,
  SkeletonBlock,
  SkeletonCard,
  SkeletonPage,
} from "../../_components/page-skeleton";

export function CandidateDetailPageSkeleton() {
  return (
    <SkeletonPage>
      <SkeletonBlock className="mb-4 hidden h-4 w-64 max-w-full rounded-md md:block" />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SkeletonBlock className="h-9 w-52 max-w-full sm:h-10 sm:w-72" />
        <SkeletonBlock className="h-9 w-28 rounded-lg" />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:flex sm:flex-wrap">
        {SKELETON_KEYS.slice(0, 3).map((key, index) => (
          <SkeletonBlock
            className={`h-11 w-full ${index === 2 ? "sm:w-48" : "sm:w-40"}`}
            key={`action-${key}`}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
        <SkeletonCard className="min-h-96">
          <SkeletonBlock className="h-20 w-20 rounded-2xl" />
          <SkeletonBlock className="mt-5 h-6 w-3/4" />
          <SkeletonBlock className="mt-3 h-4 w-1/2 rounded-md" />
          <div className="mt-6 grid grid-cols-2 gap-3">
            {SKELETON_KEYS.slice(0, 4).map((key) => (
              <SkeletonBlock className="h-16 w-full" key={`summary-${key}`} />
            ))}
          </div>
        </SkeletonCard>

        <SkeletonCard className="min-h-96">
          <SkeletonBlock className="h-6 w-48" />
          <SkeletonBlock className="mt-6 h-4 w-full rounded-md" />
          <SkeletonBlock className="mt-3 h-4 w-5/6 rounded-md" />
          <SkeletonBlock className="mt-8 h-6 w-36" />
          <SkeletonBlock className="mt-5 h-32 w-full rounded-2xl" />
        </SkeletonCard>

        <div className="space-y-5">
          <SkeletonCard className="min-h-56">
            <SkeletonBlock className="h-6 w-36" />
            <SkeletonBlock className="mt-5 h-24 w-full rounded-2xl" />
            <SkeletonBlock className="mt-4 h-11 w-full" />
          </SkeletonCard>
          <SkeletonCard className="min-h-40">
            <SkeletonBlock className="h-6 w-40" />
            <SkeletonBlock className="mt-5 h-16 w-full rounded-2xl" />
          </SkeletonCard>
        </div>
      </div>
    </SkeletonPage>
  );
}

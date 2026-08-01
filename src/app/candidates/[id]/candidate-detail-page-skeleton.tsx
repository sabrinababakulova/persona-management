import {
  SKELETON_KEYS,
  SkeletonBlock,
  SkeletonCard,
  SkeletonPage,
} from "../../_components/page-skeleton";

export function CandidateDetailPageSkeleton() {
  return (
    <SkeletonPage>
      <SkeletonBlock className="mb-5 h-4 w-64 max-w-full rounded-md" />
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-3">
          <SkeletonBlock className="h-10 w-72 max-w-full" />
          <SkeletonBlock className="h-7 w-28 rounded-full" />
        </div>
        <SkeletonBlock className="h-11 w-40" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          {SKELETON_KEYS.slice(0, 3).map((key) => (
            <SkeletonCard className="min-h-52" key={`detail-${key}`}>
              <SkeletonBlock className="h-6 w-48" />
              <SkeletonBlock className="mt-6 h-4 w-full rounded-md" />
              <SkeletonBlock className="mt-3 h-4 w-5/6 rounded-md" />
              <SkeletonBlock className="mt-3 h-4 w-2/3 rounded-md" />
            </SkeletonCard>
          ))}
        </div>
        <SkeletonCard className="h-fit min-h-80">
          <SkeletonBlock className="h-24 w-24 rounded-2xl" />
          <SkeletonBlock className="mt-6 h-6 w-3/4" />
          <SkeletonBlock className="mt-3 h-4 w-full rounded-md" />
          <SkeletonBlock className="mt-8 h-32 w-full" />
        </SkeletonCard>
      </div>
    </SkeletonPage>
  );
}

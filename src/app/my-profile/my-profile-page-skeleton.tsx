import {
  SKELETON_KEYS,
  SkeletonBlock,
  SkeletonCard,
  SkeletonPage,
} from "../_components/page-skeleton";

export function MyProfilePageSkeleton() {
  return (
    <SkeletonPage>
      <div className="mb-7 flex gap-3">
        <SkeletonBlock className="h-11 w-36" />
        <SkeletonBlock className="h-11 w-48" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <SkeletonCard className="h-fit">
          <SkeletonBlock className="mx-auto h-28 w-28 rounded-full" />
          <SkeletonBlock className="mx-auto mt-6 h-6 w-40" />
          <SkeletonBlock className="mx-auto mt-3 h-4 w-48 max-w-full rounded-md" />
          <SkeletonBlock className="mt-8 h-11 w-full" />
        </SkeletonCard>
        <div className="space-y-5">
          <SkeletonCard className="min-h-72">
            <SkeletonBlock className="h-7 w-48" />
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {SKELETON_KEYS.slice(0, 4).map((key) => (
                <SkeletonBlock className="h-20 w-full" key={`info-${key}`} />
              ))}
            </div>
          </SkeletonCard>
          <SkeletonCard className="min-h-56">
            <SkeletonBlock className="h-7 w-36" />
            <SkeletonBlock className="mt-6 h-28 w-full rounded-2xl" />
          </SkeletonCard>
        </div>
      </div>
    </SkeletonPage>
  );
}

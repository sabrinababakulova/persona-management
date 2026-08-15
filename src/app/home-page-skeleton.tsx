import {
  SKELETON_KEYS,
  SkeletonBlock,
  SkeletonCard,
  SkeletonPage,
} from "./_components/page-skeleton";

export function HomePageSkeleton() {
  return (
    <SkeletonPage>
      <SkeletonBlock className="mb-6 h-9 w-64 max-w-full sm:mb-7 sm:h-10 sm:w-80" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {SKELETON_KEYS.slice(0, 4).map((key) => (
          <SkeletonCard className="h-32" key={`home-${key}`}>
            <SkeletonBlock className="h-4 w-28 rounded-md" />
            <SkeletonBlock className="mt-5 h-9 w-20" />
          </SkeletonCard>
        ))}
      </div>
      <SkeletonBlock className="mt-6 h-60 w-full rounded-2xl sm:h-80" />
    </SkeletonPage>
  );
}

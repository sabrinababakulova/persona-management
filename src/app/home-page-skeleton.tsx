import {
  SKELETON_KEYS,
  SkeletonBlock,
  SkeletonCard,
  SkeletonPage,
} from "./_components/page-skeleton";

export function HomePageSkeleton() {
  return (
    <SkeletonPage>
      <SkeletonBlock className="mb-7 h-10 w-80 max-w-full" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {SKELETON_KEYS.slice(0, 4).map((key) => (
          <SkeletonCard className="h-32" key={`home-${key}`}>
            <SkeletonBlock className="h-4 w-28 rounded-md" />
            <SkeletonBlock className="mt-5 h-9 w-20" />
          </SkeletonCard>
        ))}
      </div>
      <SkeletonBlock className="mt-6 h-80 w-full rounded-2xl" />
    </SkeletonPage>
  );
}

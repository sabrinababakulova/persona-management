import {
  SKELETON_KEYS,
  SkeletonBlock,
  SkeletonCard,
  SkeletonPage,
} from "../../../_components/page-skeleton";

export function VacancyDescriptionPanelSkeleton() {
  return (
    <SkeletonCard className="min-h-64">
      <SkeletonBlock className="h-6 w-44" />
      <SkeletonBlock className="mt-6 h-4 w-full rounded-md" />
      <SkeletonBlock className="mt-3 h-4 w-5/6 rounded-md" />
      <SkeletonBlock className="mt-3 h-4 w-2/3 rounded-md" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <SkeletonBlock className="h-20 w-full" />
        <SkeletonBlock className="h-20 w-full" />
      </div>
    </SkeletonCard>
  );
}

export function VacancyFunnelPageSkeleton() {
  return (
    <SkeletonPage>
      <SkeletonBlock className="mb-5 h-4 w-52 rounded-md" />
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <SkeletonBlock className="h-10 w-96 max-w-full" />
        <SkeletonBlock className="h-11 w-52" />
      </div>
      <SkeletonBlock className="mb-5 h-11 w-80 max-w-full" />
      <div className="mb-5 flex gap-3">
        <SkeletonBlock className="h-12 flex-1" />
        <SkeletonBlock className="h-12 w-36" />
      </div>
      <div className="flex gap-4 overflow-hidden">
        {SKELETON_KEYS.slice(0, 4).map((columnKey, columnIndex) => (
          <SkeletonCard
            className="min-h-[440px] min-w-[270px] flex-1"
            key={`column-${columnKey}`}
          >
            <div className="flex items-center justify-between">
              <SkeletonBlock className="h-6 w-28" />
              <SkeletonBlock className="h-7 w-9 rounded-full" />
            </div>
            <div className="mt-5 space-y-4">
              {SKELETON_KEYS.slice(0, columnIndex % 2 === 0 ? 3 : 2).map(
                (cardKey) => (
                  <SkeletonBlock
                    className="h-28 w-full rounded-2xl"
                    key={`candidate-${columnKey}-${cardKey}`}
                  />
                ),
              )}
            </div>
          </SkeletonCard>
        ))}
      </div>
    </SkeletonPage>
  );
}

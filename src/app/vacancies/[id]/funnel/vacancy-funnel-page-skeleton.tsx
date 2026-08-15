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
      <SkeletonBlock className="hidden h-4 w-52 rounded-md md:block" />
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <SkeletonBlock className="h-9 w-4/5 max-w-96 sm:h-10" />
        <SkeletonBlock className="h-11 w-full sm:w-52" />
      </div>
      <SkeletonBlock className="mb-5 h-11 w-full max-w-80" />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <SkeletonBlock className="h-12 flex-1" />
        <SkeletonBlock className="h-12 w-full sm:w-36" />
      </div>
      <div className="-mx-1 flex gap-3 overflow-hidden px-1 pb-3">
        {SKELETON_KEYS.slice(0, 4).map((columnKey, columnIndex) => (
          <section
            aria-hidden="true"
            className="min-h-[440px] w-full shrink-0 rounded-xl border border-transparent bg-bg-input p-4 lg:w-80"
            key={`column-${columnKey}`}
          >
            <div className="flex items-center justify-between">
              <SkeletonBlock className="h-6 w-28" />
              <SkeletonBlock className="h-7 w-9 rounded-full" />
            </div>
            <div className="mt-5 space-y-4">
              {SKELETON_KEYS.slice(0, columnIndex % 2 === 0 ? 3 : 2).map(
                (cardKey) => (
                  <div
                    className="surface-card h-28 w-full p-4"
                    key={`candidate-${columnKey}-${cardKey}`}
                  >
                    <SkeletonBlock className="h-4 w-2/3 rounded-md" />
                    <SkeletonBlock className="mt-3 h-3 w-1/2 rounded-md" />
                    <SkeletonBlock className="mt-5 h-7 w-24 rounded-lg" />
                  </div>
                ),
              )}
            </div>
          </section>
        ))}
      </div>
    </SkeletonPage>
  );
}

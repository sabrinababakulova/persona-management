import {
  SkeletonBlock,
  SkeletonCard,
  SkeletonPage,
} from "../../../_components/page-skeleton";

export function CandidateCalendarSkeleton() {
  return (
    <SkeletonPage>
      <SkeletonBlock className="mb-4 hidden h-4 w-64 rounded-md md:block" />

      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <SkeletonBlock className="mb-2 h-4 w-36 rounded-md" />
          <SkeletonBlock className="h-9 w-56 sm:h-10 sm:w-80" />
        </div>
        <SkeletonBlock className="h-11 w-full sm:w-40" />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section aria-hidden="true" className="surface-card overflow-hidden">
          <div className="flex flex-col gap-3 border-border-light border-b p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <SkeletonBlock className="h-9 w-9" />
              <SkeletonBlock className="h-9 w-20" />
              <SkeletonBlock className="h-9 w-9" />
            </div>
            <SkeletonBlock className="h-6 w-40" />
          </div>
          <div className="h-[480px] bg-bg-canvas sm:h-[620px]" />
        </section>

        <SkeletonCard className="min-h-64">
          <SkeletonBlock className="h-6 w-40" />
          <SkeletonBlock className="mt-5 h-24 w-full rounded-2xl" />
          <SkeletonBlock className="mt-4 h-24 w-full rounded-2xl" />
        </SkeletonCard>
      </div>
    </SkeletonPage>
  );
}

import {
  FormFieldsSkeleton,
  SecondaryNavSkeleton,
  SkeletonBlock,
  SkeletonCard,
  SkeletonPage,
} from "../../_components/page-skeleton";

export function VacancyDetailPageSkeleton() {
  return (
    <SkeletonPage>
      <div className="flex flex-col gap-5 lg:flex-row lg:gap-8">
        <SecondaryNavSkeleton />

        <section className="min-w-0 flex-1">
          <div className="w-full max-w-[1040px]">
            <SkeletonBlock className="mb-5 hidden h-4 w-56 rounded-md md:block" />
            <SkeletonBlock className="mb-5 h-9 w-4/5 max-w-xl sm:h-10 sm:w-80" />

            <div className="mb-6">
              <div className="mb-3 flex items-center justify-between gap-4">
                <SkeletonBlock className="h-4 w-32 rounded-md" />
                <SkeletonBlock className="h-4 w-20 rounded-md" />
              </div>
              <SkeletonBlock className="h-2 w-full rounded-full" />
            </div>

            <div className="space-y-5">
              <SkeletonCard>
                <SkeletonBlock className="mb-6 h-6 w-48" />
                <SkeletonBlock className="mb-2 h-3 w-24 rounded-md" />
                <SkeletonBlock className="h-12 w-full" />
                <SkeletonBlock className="mt-5 mb-2 h-3 w-24 rounded-md" />
                <SkeletonBlock className="h-40 w-full" />
              </SkeletonCard>
              <SkeletonCard>
                <SkeletonBlock className="mb-6 h-6 w-32" />
                <FormFieldsSkeleton count={4} />
              </SkeletonCard>
            </div>
          </div>
        </section>
      </div>
    </SkeletonPage>
  );
}

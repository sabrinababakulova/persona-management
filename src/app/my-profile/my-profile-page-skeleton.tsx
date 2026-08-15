import {
  SecondaryNavSkeleton,
  SkeletonBlock,
  SkeletonCard,
  SkeletonPage,
} from "../_components/page-skeleton";

export function MyProfilePageSkeleton() {
  return (
    <SkeletonPage>
      <div className="flex flex-col gap-5 lg:flex-row lg:gap-8">
        <SecondaryNavSkeleton count={2} />

        <section className="min-w-0 flex-1">
          <div className="w-full max-w-2xl">
            <SkeletonBlock className="hidden h-4 w-44 rounded-md md:block" />

            <div className="mt-1 flex items-center gap-4 sm:gap-5 md:mt-5">
              <SkeletonBlock className="h-20 w-20 shrink-0 rounded-full sm:h-24 sm:w-24" />
              <div className="min-w-0 flex-1">
                <SkeletonBlock className="h-8 w-3/4 max-w-64 sm:h-10" />
                <SkeletonBlock className="mt-3 h-5 w-1/2 max-w-44 rounded-md" />
              </div>
            </div>

            <div className="mt-8 space-y-5">
              <SkeletonCard>
                <SkeletonBlock className="mb-6 h-6 w-44" />
                <div className="space-y-4">
                  {["name", "city", "email"].map((key) => (
                    <div key={key}>
                      <SkeletonBlock className="mb-2 h-3 w-20 rounded-md" />
                      <SkeletonBlock className="h-12 w-full" />
                    </div>
                  ))}
                </div>
              </SkeletonCard>

              <SkeletonCard>
                <SkeletonBlock className="mb-6 h-6 w-40" />
                <div className="space-y-4">
                  <SkeletonBlock className="h-12 w-full" />
                  <SkeletonBlock className="h-12 w-full" />
                </div>
                <SkeletonBlock className="mt-6 h-11 w-full sm:ml-auto sm:w-40" />
              </SkeletonCard>
            </div>
          </div>
        </section>
      </div>
    </SkeletonPage>
  );
}

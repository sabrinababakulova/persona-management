import {
  FormFieldsSkeleton,
  SkeletonBlock,
  SkeletonCard,
  SkeletonPage,
} from "../../../../../_components/page-skeleton";

export function PublicationEditPageSkeleton() {
  return (
    <SkeletonPage>
      <div className="mx-auto w-full max-w-[976px]">
        <SkeletonBlock className="mb-5 hidden h-4 w-56 rounded-md md:block" />
        <SkeletonBlock className="mb-5 h-9 w-4/5 max-w-sm sm:h-10" />

        <div className="space-y-5">
          <SkeletonCard>
            <SkeletonBlock className="mb-6 h-6 w-48" />
            <FormFieldsSkeleton count={4} />
            <SkeletonBlock className="mt-6 h-40 w-full" />
          </SkeletonCard>
          <SkeletonCard>
            <SkeletonBlock className="mb-6 h-6 w-36" />
            <FormFieldsSkeleton count={2} />
          </SkeletonCard>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:flex sm:justify-end">
          <SkeletonBlock className="h-11 w-full sm:w-36" />
          <SkeletonBlock className="h-11 w-full sm:w-44" />
        </div>
      </div>
    </SkeletonPage>
  );
}
